import type Database from 'better-sqlite3';
import type { CollectionSensitivity } from './collection-types.js';
import type { EvidenceKind } from './interfaces.js';

export interface CollectionOverview {
  collectionId: string;
  displayName: string;
  sensitivity: CollectionSensitivity;
  docCount: number;
  topKinds: Array<{ kind: EvidenceKind; count: number }>;
  recentAnchors: Array<{ anchor: string; title: string; updatedAt: string }>;
  indexable: false;
  sourceAnchors: string[];
}

export interface CollectionHealth {
  collectionId: string;
  indexFreshness: string;
  pendingReviewCount: number;
  secretFindingsCount: number;
  orphanedAnchorCount: number;
  indexable: false;
  sourceAnchors: string[];
}

export class CollectionReadModel {
  static computeOverview(
    collectionId: string,
    displayName: string,
    sensitivity: CollectionSensitivity,
    db: Database.Database,
  ): CollectionOverview {
    const docCount = (db.prepare('SELECT count(*) AS c FROM evidence_docs').get() as { c: number })?.c ?? 0;

    const topKinds = db
      .prepare('SELECT kind, count(*) AS count FROM evidence_docs GROUP BY kind ORDER BY count DESC LIMIT 5')
      .all() as Array<{ kind: EvidenceKind; count: number }>;

    const recentAnchors = db
      .prepare('SELECT anchor, title, updated_at AS updatedAt FROM evidence_docs ORDER BY updated_at DESC LIMIT 5')
      .all() as Array<{ anchor: string; title: string; updatedAt: string }>;

    return {
      collectionId,
      displayName,
      sensitivity,
      docCount,
      topKinds,
      recentAnchors,
      indexable: false,
      sourceAnchors: recentAnchors.map((r) => r.anchor),
    };
  }

  static computeHealth(collectionId: string, db: Database.Database): CollectionHealth {
    const lastUpdated =
      (db.prepare('SELECT max(updated_at) AS t FROM evidence_docs').get() as { t: string | null })?.t ?? '';

    // Phase A stub: markers live in YAML (MarkerQueue), not SQLite — wire to MarkerQueue in Phase B
    const pendingReviewCount = 0;

    let orphanedAnchorCount = 0;
    try {
      orphanedAnchorCount =
        (
          db
            .prepare(
              'SELECT count(*) AS c FROM edges WHERE from_anchor NOT IN (SELECT anchor FROM evidence_docs) OR to_anchor NOT IN (SELECT anchor FROM evidence_docs)',
            )
            .get() as { c: number }
        )?.c ?? 0;
    } catch {
      /* edges table may not exist */
    }

    return {
      collectionId,
      indexFreshness: lastUpdated,
      pendingReviewCount,
      secretFindingsCount: 0,
      orphanedAnchorCount,
      indexable: false,
      sourceAnchors: [],
    };
  }
}
