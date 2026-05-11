/**
 * RecentBrowseResolver — F188 Phase F (AC-F2)
 *
 * Metadata browse read-model. NOT part of F102 IEvidenceStore semantic
 * retrieval (砚砚 二审 P2 — F102 owns search_evidence, not list_recent).
 * Sits alongside CollectionReadModel for "no-query, scan recent" use case.
 *
 * Returns recent docs across stores, ordered by updatedAt desc. Respects
 * caller-collection visibility just like GraphResolver: callerCollections
 * is SERVER-derived (route layer parses HTTP query), never client-supplied
 * from MCP wrapper (KD-8).
 */

import type Database from 'better-sqlite3';
import type { CollectionSensitivity } from './collection-types.js';
import type { IEvidenceStore } from './interfaces.js';

export interface RecentItem {
  anchor: string;
  title: string;
  kind: string;
  updatedAt: string;
  source: string;
}

export interface ListRecentOptions {
  scope?: 'docs' | 'threads' | 'memory' | 'all';
  since: string; // "7d" / "24h" / ISO 8601 date string
  limit: number;
  kinds?: readonly string[];
  callerCollections?: readonly string[]; // server-derived ACL, not from MCP client
}

/** Map scope filter to evidence_docs.kind values (砚砚 三审 P1-4 — true cross-surface). */
const SCOPE_KIND_MAP: Record<string, readonly string[] | null> = {
  docs: ['feature', 'decision', 'lesson', 'plan', 'phase', 'research', 'spec', 'adr'],
  threads: ['discussion', 'thread', 'thread-digest', 'session'],
  memory: ['memory', 'session-digest', 'reflection'],
  all: null, // no filter
};

type StoreWithDb = IEvidenceStore & { getDb?: () => Database.Database };

interface CatalogLike {
  list(): Array<{ id: string; sensitivity: CollectionSensitivity; kind: string }>;
}

export class RecentBrowseResolver {
  constructor(
    private readonly catalog: CatalogLike,
    private readonly stores: Map<string, IEvidenceStore>,
  ) {}

  async list(opts: ListRecentOptions): Promise<RecentItem[]> {
    const cutoff = parseSinceToIso(opts.since);
    const callerSet = opts.callerCollections ? new Set(opts.callerCollections) : null;
    const manifests = new Map(this.catalog.list().map((m) => [m.id, m]));

    const results: RecentItem[] = [];
    for (const [id, store] of this.stores) {
      const manifest = manifests.get(id);
      if (!manifest) continue;

      // Privacy: private/restricted collections require explicit caller include
      if ((manifest.sensitivity === 'private' || manifest.sensitivity === 'restricted') && !callerSet?.has(id)) {
        continue;
      }

      const db = (store as StoreWithDb).getDb?.();
      if (!db) continue;

      // 砚砚 三审 P1-4: scope maps to evidence_docs.kind filter (cross-surface in single table)
      // 砚砚 cloud-3 P2: `kinds` NARROWS scope, doesn't replace it. If both supplied,
      // intersect — caller saying `scope=threads&kinds=feature` means "feature-shaped
      // items within thread scope", which is empty for the current mapping (feature is
      // docs-side). Returning docs would violate the scope contract.
      const scopeKinds = opts.scope ? SCOPE_KIND_MAP[opts.scope] : null;
      let effectiveKinds: readonly string[] | null;
      if (opts.kinds && opts.kinds.length > 0) {
        if (scopeKinds) {
          const scopeSet = new Set(scopeKinds);
          effectiveKinds = opts.kinds.filter((k) => scopeSet.has(k));
        } else {
          // scope='all' or unspecified → kinds alone (no scope ceiling)
          effectiveKinds = opts.kinds;
        }
      } else {
        effectiveKinds = scopeKinds;
      }
      // Intersection empty → no rows can match; skip this store to avoid degenerate query
      if (opts.kinds && opts.kinds.length > 0 && scopeKinds && effectiveKinds && effectiveKinds.length === 0) {
        continue;
      }
      const placeholders = effectiveKinds && effectiveKinds.length > 0 ? effectiveKinds.map(() => '?').join(',') : null;
      const sql = placeholders
        ? `SELECT anchor, title, kind, updated_at AS updatedAt FROM evidence_docs
           WHERE updated_at >= ? AND kind IN (${placeholders})
           ORDER BY updated_at DESC LIMIT ?`
        : `SELECT anchor, title, kind, updated_at AS updatedAt FROM evidence_docs
           WHERE updated_at >= ?
           ORDER BY updated_at DESC LIMIT ?`;

      const params: Array<string | number> = [cutoff];
      if (effectiveKinds) params.push(...effectiveKinds);
      params.push(opts.limit);

      const rows = db.prepare(sql).all(...params) as Array<{
        anchor: string;
        title: string;
        kind: string;
        updatedAt: string;
      }>;

      for (const r of rows) {
        results.push({ anchor: r.anchor, title: r.title, kind: r.kind, updatedAt: r.updatedAt, source: id });
      }
    }

    return results
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
      .slice(0, opts.limit);
  }
}

/** Parse "7d" / "24h" / ISO date → canonical UTC ISO 8601 cutoff string. */
export function parseSinceToIso(since: string, now: Date = new Date()): string {
  // 砚砚 cloud-11 P2: guard against `since=999999999999999d` overflow.
  // Route validator caps digits, but defensive bounds here too — if computed
  // date is non-finite (e.g. Date(now - massive_ms) overflow), fall back to
  // epoch-zero cutoff which is safe for SQL compare (matches "all rows").
  const tryToIso = (ms: number): string => {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '1970-01-01T00:00:00.000Z';
    return d.toISOString();
  };
  const dayMatch = /^(\d+)d$/.exec(since);
  if (dayMatch) {
    const days = Number.parseInt(dayMatch[1]!, 10);
    return tryToIso(now.getTime() - days * 86_400_000);
  }
  const hourMatch = /^(\d+)h$/.exec(since);
  if (hourMatch) {
    const hours = Number.parseInt(hourMatch[1]!, 10);
    return tryToIso(now.getTime() - hours * 3_600_000);
  }
  // 砚砚 cloud-10 P2: normalize ISO inputs to canonical UTC. SQL compares
  // `updated_at >= ?` as TEXT (sqlite ISO stored as `...Z`), so passing
  // back `2026-05-01T08:00+14:00` would lex-compare wrong against `...Z`
  // rows and drop valid recent items. `new Date(s).toISOString()` returns
  // canonical `YYYY-MM-DDTHH:mm:ss.sssZ` regardless of input offset.
  const parsed = new Date(since);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  // Last-resort: return input unchanged (route layer should have rejected
  // invalid since earlier; this preserves test fixture behavior).
  return since;
}
