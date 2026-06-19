/**
 * Convention Graph Engine (F242) — domain-agnostic 引擎。
 *
 * 引擎不认任何特定 domain（MCP tool / skill / route 由 domain plugin 提供）。
 * 核心保证（两轮 brainstorm 收敛）：
 *  - 每条 edge 带 provenance（砚砚 OQ-8：错边比漏边危险，可追到 source span + extractor）
 *  - node identity 走 scope_key 复合键，不靠 display name（砚砚 OQ-2：解 codegraph 跨域混淆）
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { hashContent, inferDomains, rowToNode } from './engine-helpers.ts';
import type {
  Confidence,
  Consumer,
  ConventionEdge,
  ConventionGap,
  ConventionNode,
  ExtractionResult,
  Freshness,
  IngestOptions,
  NodeQuery,
  PendingChange,
  SourceContent,
} from './types.ts';

export type {
  Confidence,
  Consumer,
  ConventionEdge,
  ConventionGap,
  ConventionNode,
  ExtractionResult,
  Freshness,
  IngestOptions,
  NodeQuery,
  PendingChange,
  PendingChangeReason,
  Provenance,
  SourceContent,
} from './types.ts';

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');

export class ConventionGraphEngine {
  private readonly db: DatabaseSync;

  constructor(dbPath = ':memory:') {
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }

  insertNode(n: ConventionNode): void {
    this.db
      .prepare(
        `INSERT INTO nodes
         (id, domain_id, kind, name, scope_key, file_path, start_line, end_line, lang, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           domain_id = excluded.domain_id,
           kind = excluded.kind,
           name = excluded.name,
           scope_key = excluded.scope_key,
           file_path = excluded.file_path,
           start_line = excluded.start_line,
           end_line = excluded.end_line,
           lang = excluded.lang,
           metadata = excluded.metadata`,
      )
      .run(
        n.id,
        n.domainId,
        n.kind,
        n.name,
        n.scopeKey,
        n.filePath ?? null,
        n.startLine ?? null,
        n.endLine ?? null,
        n.lang ?? null,
        n.metadata ? JSON.stringify(n.metadata) : null,
      );
  }

  insertEdge(e: ConventionEdge): void {
    const p = e.provenance;
    this.db
      .prepare(
        `INSERT INTO edges
         (source, target, kind, domain_id, extractor, extractor_version, source_file, source_line, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source, target, kind, domain_id, extractor, extractor_version) DO UPDATE SET
           source_file = excluded.source_file,
           source_line = excluded.source_line,
           confidence = excluded.confidence`,
      )
      .run(
        e.source,
        e.target,
        e.kind,
        e.domainId,
        p.extractor,
        p.extractorVersion,
        p.sourceFile ?? null,
        p.sourceLine ?? null,
        p.confidence ?? 'static',
      );
  }

  insertGap(g: ConventionGap): void {
    this.db
      .prepare(`INSERT INTO gaps (domain_id, reason, file_path) VALUES (?, ?, ?)`)
      .run(g.domainId, g.reason, g.filePath ?? null);
  }

  ingestExtractionResult(r: ExtractionResult, options: IngestOptions = {}): void {
    this.db.exec('SAVEPOINT convention_graph_ingest');
    try {
      this.clearDomains(options.replaceDomains ?? inferDomains(r), r.nodes);
      for (const n of r.nodes) this.insertNode(n);
      for (const e of r.edges) this.insertEdge(e);
      for (const g of r.gaps ?? []) this.insertGap(g);
      this.db.exec('RELEASE convention_graph_ingest');
    } catch (error) {
      this.db.exec('ROLLBACK TO convention_graph_ingest');
      this.db.exec('RELEASE convention_graph_ingest');
      throw error;
    }
  }

  private clearDomains(domainIds: readonly string[], nextNodes: readonly ConventionNode[]): void {
    const unique = [...new Set(domainIds)].filter(Boolean);
    if (unique.length === 0) return;

    const nextIdsByDomain = new Map<string, string[]>();
    for (const node of nextNodes) {
      if (!unique.includes(node.domainId)) continue;
      const ids = nextIdsByDomain.get(node.domainId) ?? [];
      ids.push(node.id);
      nextIdsByDomain.set(node.domainId, ids);
    }

    const deleteEdges = this.db.prepare(`DELETE FROM edges WHERE domain_id = ?`);
    const deleteGaps = this.db.prepare(`DELETE FROM gaps WHERE domain_id = ?`);
    for (const domainId of unique) {
      deleteEdges.run(domainId);
      deleteGaps.run(domainId);
      const nextIds = nextIdsByDomain.get(domainId) ?? [];
      if (nextIds.length === 0) {
        this.db.prepare(`DELETE FROM nodes WHERE domain_id = ?`).run(domainId);
        continue;
      }
      this.db
        .prepare(`DELETE FROM nodes WHERE domain_id = ? AND id NOT IN (${nextIds.map(() => '?').join(', ')})`)
        .run(domainId, ...nextIds);
    }
  }

  setIndexCommit(commit: string): void {
    this.setMeta('index_commit', commit);
  }

  recordIndexedFiles(files: readonly SourceContent[], domainIds: readonly string[] = []): void {
    const indexedAt = Date.now();
    const incomingDomains = normalizeFileDomains(domainIds);
    const currentPaths = new Set(files.map((f) => f.path));
    const existingRows = this.db.prepare(`SELECT path, domain_id FROM files`).all() as {
      path: string;
      domain_id: string;
    }[];
    const deleteStmt = this.db.prepare(`DELETE FROM files WHERE path = ? AND domain_id = ?`);
    for (const row of existingRows) {
      if (!currentPaths.has(row.path) && incomingDomains.includes(row.domain_id)) {
        deleteStmt.run(row.path, row.domain_id);
      }
    }

    const stmt = this.db.prepare(
      `INSERT INTO files (path, domain_id, content_hash, indexed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(path, domain_id) DO UPDATE SET
         content_hash = excluded.content_hash,
         indexed_at = excluded.indexed_at`,
    );
    for (const f of files) {
      for (const domainId of incomingDomains) {
        stmt.run(f.path, domainId, hashContent(f.content), indexedAt);
      }
    }
  }

  freshness(
    currentFiles?: readonly SourceContent[],
    domainIds: readonly string[] = [],
    inScope?: (path: string) => boolean,
  ): Freshness {
    const indexCommit = this.getMeta('index_commit');
    if (!currentFiles) return { indexCommit, stale: false, pendingChanges: [] };

    const domains = domainIds.filter(Boolean);
    const indexedRows = (
      domains.length
        ? this.db
            .prepare(
              `SELECT path, content_hash FROM files
               WHERE domain_id IN (${domains.map(() => '?').join(', ')})
               ORDER BY path, domain_id`,
            )
            .all(...domains)
        : this.db.prepare(`SELECT path, content_hash FROM files ORDER BY path, domain_id`).all()
    ) as {
      path: string;
      content_hash: string;
    }[];
    const current = new Map(currentFiles.map((f) => [f.path, hashContent(f.content)]));
    const indexedPaths = new Set(indexedRows.map((r) => r.path));

    const pendingChanges: PendingChange[] = [];
    const addPending = (change: PendingChange): void => {
      if (!pendingChanges.some((existing) => existing.path === change.path && existing.reason === change.reason)) {
        pendingChanges.push(change);
      }
    };
    for (const { path, content_hash: indexedHash } of indexedRows) {
      const currentHash = current.get(path);
      if (!current.has(path)) {
        addPending({ path, reason: 'deleted' });
      } else if (currentHash !== indexedHash) {
        addPending({ path, reason: 'modified' });
      }
    }
    // untracked：current 有但未索引的文件。domain-scoped 时 membership 判定唯一真相源 =
    // 注入的 inScope（来自 plugin.invalidationScope）。inScope 缺失时 fail closed：
    // 报 unknown current paths 为 untracked，避免把无法证明完整的 graph 标 fresh。
    for (const path of [...current.keys()].sort()) {
      if (indexedPaths.has(path)) continue;
      if (domains.length > 0 && inScope && !inScope(path)) continue;
      addPending({ path, reason: 'untracked' });
    }
    return { indexCommit, stale: pendingChanges.length > 0, pendingChanges };
  }

  getNode(id: string): ConventionNode | null {
    const r = this.db.prepare(`SELECT * FROM nodes WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return r ? rowToNode(r) : null;
  }

  findNodes(query: NodeQuery): ConventionNode[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (query.domainId) {
      clauses.push('domain_id = ?');
      params.push(query.domainId);
    }
    if (query.kind) {
      clauses.push('kind = ?');
      params.push(query.kind);
    }
    if (query.name) {
      clauses.push('name = ?');
      params.push(query.name);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM nodes${where} ORDER BY file_path, start_line, name`)
      .all(...params) as Record<string, unknown>[];
    return rows.map(rowToNode);
  }

  /**
   * 顺藤摸瓜：谁消费了这个节点（incoming edges）+ 每条关联的 provenance。
   * 这是"改 X 找消费方"场景的引擎原语（AC-A1），结果自带可追溯证据（AC-A0）。
   */
  consumers(nodeId: string): Consumer[] {
    const rows = this.db
      .prepare(
        `SELECT
           n.id AS nid, n.domain_id AS ndomain, n.kind AS nkind, n.name AS nname,
           n.scope_key AS nscope, n.file_path AS nfile, n.start_line AS nsl,
           n.end_line AS nel, n.lang AS nlang, n.metadata AS nmeta,
           e.source AS esource, e.target AS etarget, e.kind AS ekind, e.domain_id AS edomain,
           e.extractor AS eext, e.extractor_version AS ever, e.source_file AS esf,
           e.source_line AS esl, e.confidence AS econf
         FROM edges e
         JOIN nodes n ON n.id = e.source
         WHERE e.target = ?`,
      )
      .all(nodeId) as Record<string, unknown>[];
    return rows.map((r) => ({
      node: rowToNode({
        id: r.nid,
        domain_id: r.ndomain,
        kind: r.nkind,
        name: r.nname,
        scope_key: r.nscope,
        file_path: r.nfile,
        start_line: r.nsl,
        end_line: r.nel,
        lang: r.nlang,
        metadata: r.nmeta,
      }),
      edge: {
        source: r.esource as string,
        target: r.etarget as string,
        kind: r.ekind as string,
        domainId: r.edomain as string,
        provenance: {
          extractor: r.eext as string,
          extractorVersion: r.ever as string,
          sourceFile: (r.esf as string | null) ?? undefined,
          sourceLine: (r.esl as number | null) ?? undefined,
          confidence: r.econf as Confidence,
        },
      },
    }));
  }

  close(): void {
    this.db.close();
  }

  private setMeta(key: string, value: string): void {
    this.db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`).run(key, value);
  }

  private getMeta(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }
}

function normalizeFileDomains(domainIds: readonly string[]): string[] {
  const normalized = [...new Set(domainIds)].filter(Boolean);
  return normalized.length > 0 ? normalized : ['__default__'];
}
