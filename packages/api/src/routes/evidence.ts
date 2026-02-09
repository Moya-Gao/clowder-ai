/**
 * Evidence Search Route
 * GET /api/evidence/search — search project knowledge via Hindsight Recall
 * Degrades to local docs/ grep when Hindsight is unavailable.
 *
 * Phase 5.0: Evidence-first search.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { HindsightError } from '../domains/cats/services/HindsightClient.js';
import type { IHindsightClient, HindsightMemory } from '../domains/cats/services/HindsightClient.js';

/** Accepted query parameters */
const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  budget: z.enum(['low', 'mid', 'high']).default('mid'),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  tagsMatch: z.enum(['any', 'all', 'any_strict', 'all_strict']).default('all_strict'),
});

export type EvidenceSourceType = 'decision' | 'phase' | 'discussion' | 'commit';
export type EvidenceConfidence = 'high' | 'mid' | 'low';

export interface EvidenceResult {
  title: string;
  anchor: string;
  snippet: string;
  confidence: EvidenceConfidence;
  sourceType: EvidenceSourceType;
}

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

function normalizeTags(input: string | string[] | undefined): string[] {
  const rawValues = input == null ? ['project:cat-cafe'] : (Array.isArray(input) ? input : [input]);
  const tags = rawValues
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return tags.length > 0 ? tags : ['project:cat-cafe'];
}

function shouldDegradeToDocs(err: unknown): boolean {
  if (err instanceof HindsightError) {
    if (err.code === 'CONNECTION_FAILED' || err.code === 'TIMEOUT') return true;
    if (err.statusCode != null && err.statusCode >= 500) return true;
    return false;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('network') ||
      msg.includes('fetch failed')
    );
  }

  return false;
}

/** Map a file path to a source type */
function classifySource(path: string): EvidenceSourceType {
  if (path.includes('decisions')) return 'decision';
  if (path.includes('phases')) return 'phase';
  if (path.includes('discussions')) return 'discussion';
  return 'commit';
}

/** Convert Hindsight memory to EvidenceResult */
function memoryToResult(mem: HindsightMemory): EvidenceResult {
  const anchor = mem.metadata?.['anchor'] ?? '';
  return {
    title: mem.content.slice(0, 120),
    anchor,
    snippet: mem.content.slice(0, 300),
    confidence: (mem.score ?? 0) > 0.8 ? 'high' : (mem.score ?? 0) > 0.5 ? 'mid' : 'low',
    sourceType: classifySource(anchor),
  };
}

/** Degraded search: grep docs/ for matching files */
async function searchDocs(docsRoot: string, query: string, limit: number): Promise<EvidenceResult[]> {
  const results: EvidenceResult[] = [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return results;

  const dirs = ['decisions', 'phases', 'discussions'];
  for (const dir of dirs) {
    let files: string[];
    try {
      files = await readdir(join(docsRoot, dir));
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      if (results.length >= limit) break;

      const fullPath = join(docsRoot, dir, file);
      let content: string;
      try {
        content = await readFile(fullPath, 'utf-8');
      } catch {
        continue;
      }

      const lower = content.toLowerCase();
      const matched = terms.some((t) => lower.includes(t));
      if (!matched) continue;

      const relPath = `docs/${dir}/${file}`;
      const firstLine = content.split('\n').find((l) => l.trim().startsWith('#'))?.replace(/^#+\s*/, '') ?? file;
      const snippet = content.slice(0, 300);

      results.push({
        title: firstLine,
        anchor: relPath,
        snippet,
        confidence: 'low',
        sourceType: classifySource(relative('', relPath)),
      });
    }

    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}

/**
 * Validate anchors: downgrade confidence to 'low' if a docs/ file is missing.
 * Does not remove results — just reduces trust signal.
 */
async function validateAnchors(results: EvidenceResult[], docsRoot: string): Promise<EvidenceResult[]> {
  return Promise.all(
    results.map(async (r) => {
      if (!r.anchor.startsWith('docs/')) return r;
      const filePath = join(docsRoot, r.anchor.slice('docs/'.length));
      try {
        await access(filePath);
        return r;
      } catch {
        return { ...r, confidence: 'low' as EvidenceConfidence };
      }
    })
  );
}

export const evidenceRoutes: FastifyPluginAsync<EvidenceRoutesOptions> = async (app, opts) => {
  app.get('/api/evidence/search', async (request, reply) => {
    const parseResult = searchSchema.safeParse(request.query);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid query parameters', details: parseResult.error.issues };
    }

    const { q, limit, budget, tags, tagsMatch } = parseResult.data;
    const resolvedTags = normalizeTags(tags);

    // Try Hindsight first
    try {
      const memories = await opts.hindsightClient.recall(opts.sharedBank, q, {
        limit,
        budget,
        tags: resolvedTags,
        tagsMatch,
      });

      const docsRoot = opts.docsRoot ?? join(process.cwd(), 'docs');
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

      // Hindsight unavailable — fallback to local docs search
      const docsRoot = opts.docsRoot ?? join(process.cwd(), 'docs');
      const rawResults = await searchDocs(docsRoot, q, limit);
      const results = await validateAnchors(rawResults, docsRoot);

      return {
        results,
        degraded: true,
        degradeReason: 'hindsight_unavailable_fallback_docs_search',
      } satisfies EvidenceSearchResponse;
    }
  });
};
