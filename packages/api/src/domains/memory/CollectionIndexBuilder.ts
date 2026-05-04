// F186 Phase B Task 4: Orchestrates collection scan → hash dedup → store upsert → stale cleanup

import { createHash } from 'node:crypto';
import type { CollectionManifest } from './collection-types.js';
import type { EvidenceItem, RepoScanner } from './interfaces.js';
import type { SqliteEvidenceStore } from './SqliteEvidenceStore.js';

export interface CollectionRebuildResult {
  indexed: number;
  skipped: number;
}

export class CollectionIndexBuilder {
  constructor(
    private readonly store: SqliteEvidenceStore,
    private readonly manifest: CollectionManifest,
    private readonly scanner: RepoScanner,
  ) {}

  async rebuild(options?: { force?: boolean }): Promise<CollectionRebuildResult> {
    const force = options?.force ?? false;
    const results = this.scanner.discover(this.manifest.root);
    const now = new Date().toISOString();

    let indexed = 0;
    let skipped = 0;
    const currentAnchors = new Set<string>();

    for (const result of results) {
      const hash = createHash('sha256').update(result.rawContent).digest('hex');
      const anchor = result.item.anchor;
      currentAnchors.add(anchor);

      if (!force) {
        const existing = await this.store.getByAnchor(anchor);
        if (existing?.sourceHash === hash) {
          skipped++;
          continue;
        }
      }

      const item: EvidenceItem = {
        ...result.item,
        sourceHash: hash,
        updatedAt: now,
      };
      await this.store.upsert([item]);
      indexed++;
    }

    await this.cleanStale(currentAnchors);
    return { indexed, skipped };
  }

  private async cleanStale(currentAnchors: Set<string>): Promise<void> {
    const prefix = `${this.manifest.id}:`;
    const db = this.store.getDb();
    const rows = db.prepare('SELECT anchor FROM evidence_docs WHERE anchor LIKE ?').all(`${prefix}%`) as {
      anchor: string;
    }[];
    for (const row of rows) {
      if (!currentAnchors.has(row.anchor)) {
        await this.store.deleteByAnchor(row.anchor);
      }
    }
  }
}
