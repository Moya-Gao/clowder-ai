/**
 * Evidence Search Route
 * GET /api/evidence/search — search project knowledge via Hindsight Recall
 * Degrades to local docs/ grep when Hindsight is unavailable.
 *
 * Phase 5.0: Evidence-first search.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { join } from 'node:path';
import { collectConfigSnapshot } from '../config/ConfigRegistry.js';
import type { IHindsightClient } from '../domains/cats/services/HindsightClient.js';
import {
  memoryToResult,
  normalizeTags,
  searchDocs,
  shouldDegradeToDocs,
  validateAnchors,
} from './evidence-helpers.js';
import type { EvidenceResult } from './evidence-helpers.js';

/** Accepted query parameters */
const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  budget: z.enum(['low', 'mid', 'high']).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  tagsMatch: z.enum(['any', 'all', 'any_strict', 'all_strict']).optional(),
});

export type { EvidenceConfidence, EvidenceSourceType } from './evidence-helpers.js';

export interface EvidenceSearchResponse {
  results: EvidenceResult[];
  degraded: boolean;
  degradeReason?: string;
}

export interface EvidenceRoutesOptions {
  hindsightClient: IHindsightClient;
  sharedBank: string;
  docsRoot?: string;
}

export const evidenceRoutes: FastifyPluginAsync<EvidenceRoutesOptions> = async (app, opts) => {
  app.get('/api/evidence/search', async (request, reply) => {
    const parseResult = searchSchema.safeParse(request.query);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid query parameters', details: parseResult.error.issues };
    }

    const { q, limit, budget, tags, tagsMatch } = parseResult.data;
    const recallDefaults = collectConfigSnapshot().hindsight.recallDefaults;
    const effectiveLimit = limit ?? recallDefaults.limit;
    const effectiveBudget = budget ?? recallDefaults.budget;
    const effectiveTagsMatch = tagsMatch ?? recallDefaults.tagsMatch;
    const resolvedTags = normalizeTags(tags);
    const docsRoot = opts.docsRoot ?? join(process.cwd(), 'docs');

    try {
      const memories = await opts.hindsightClient.recall(opts.sharedBank, q, {
        limit: effectiveLimit,
        budget: effectiveBudget,
        tags: resolvedTags,
        tagsMatch: effectiveTagsMatch,
      });
      const results = await validateAnchors(memories.map(memoryToResult), docsRoot);
      return { results, degraded: false } satisfies EvidenceSearchResponse;
    } catch (err) {
      if (!shouldDegradeToDocs(err)) {
        reply.status(502);
        return {
          error: 'Evidence search unavailable',
          degraded: false,
        };
      }

      const rawResults = await searchDocs(docsRoot, q, effectiveLimit);
      const results = await validateAnchors(rawResults, docsRoot);
      return {
        results,
        degraded: true,
        degradeReason: 'hindsight_unavailable_fallback_docs_search',
      } satisfies EvidenceSearchResponse;
    }
  });
};
