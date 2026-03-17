/**
 * Evidence Search Route
 * GET /api/evidence/search — search project knowledge via SQLite evidence store.
 *
 * Phase 5.0: Evidence-first search.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IEvidenceStore } from '../domains/memory/interfaces.js';
import type { EvidenceResult } from './evidence-helpers.js';

/** Accepted query parameters */
const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export type { EvidenceConfidence, EvidenceSourceType } from './evidence-helpers.js';

export interface EvidenceFreshness {
  status: 'fresh' | 'stale' | 'unknown';
  checkedAt: string;
  headCommit?: string;
  watermarkCommit?: string;
  reason?: 'commit_match' | 'commit_mismatch' | 'watermark_missing' | 'head_unavailable';
}

export interface EvidenceReimportTrigger {
  status: 'triggered' | 'cooldown' | 'skipped' | 'disabled' | 'failed';
  reason?: string;
  nextAllowedAt?: string;
}

export interface EvidenceSearchResponse {
  results: EvidenceResult[];
  degraded: boolean;
  degradeReason?: string;
  freshness?: EvidenceFreshness;
  reimportTrigger?: EvidenceReimportTrigger;
}

export interface EvidenceRoutesOptions {
  docsRoot?: string;
  /** F102: SQLite evidence store — the only backend */
  evidenceStore: IEvidenceStore;
}

export const evidenceRoutes: FastifyPluginAsync<EvidenceRoutesOptions> = async (app, opts) => {
  app.get('/api/evidence/search', async (request, reply) => {
    const parseResult = searchSchema.safeParse(request.query);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid query parameters', details: parseResult.error.issues };
    }

    const { q, limit } = parseResult.data;

    const effectiveLimit = limit ?? 5;
    try {
      const items = await opts.evidenceStore.search(q, { limit: effectiveLimit });
      const results: EvidenceResult[] = items.map((item) => ({
        title: item.title,
        anchor: item.anchor,
        snippet: item.summary ?? '',
        confidence: 'mid' as const,
        sourceType: (item.kind === 'decision'
          ? 'decision'
          : item.kind === 'plan'
            ? 'phase'
            : 'discussion') as EvidenceResult['sourceType'],
      }));
      return { results, degraded: false } satisfies Partial<EvidenceSearchResponse>;
    } catch {
      return {
        results: [],
        degraded: true,
        degradeReason: 'evidence_store_error',
      } satisfies Partial<EvidenceSearchResponse>;
    }
  });

  // F102 D-2/D-8: Memory status (AC-D8)
  app.get('/api/evidence/status', async () => {
    try {
      const db = (opts.evidenceStore as { getDb?: () => unknown }).getDb?.() as
        | { prepare: (sql: string) => { get: () => Record<string, unknown> } }
        | undefined;
      if (!db) return { backend: 'sqlite', healthy: false, reason: 'no_db' };

      const docCount = (db.prepare('SELECT count(*) AS c FROM evidence_docs').get() as { c: number }).c;
      const edgeCount = (db.prepare('SELECT count(*) AS c FROM edges').get() as { c: number }).c;
      const lastUpdated = (
        db.prepare('SELECT max(updated_at) AS t FROM evidence_docs').get() as { t: string | null }
      ).t;

      return {
        backend: 'sqlite',
        healthy: true,
        docs_count: docCount,
        edges_count: edgeCount,
        last_rebuild_at: lastUpdated,
      };
    } catch {
      return { backend: 'sqlite', healthy: false, reason: 'query_error' };
    }
  });
};
