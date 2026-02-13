import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { collectConfigSnapshot } from '../config/ConfigRegistry.js';
import type { InvocationRegistry } from '../domains/cats/services/InvocationRegistry.js';
import type { IHindsightClient, HindsightMemory } from '../domains/cats/services/HindsightClient.js';
import { HindsightError } from '../domains/cats/services/HindsightClient.js';
import { callbackAuthSchema } from './callback-auth-schema.js';

interface CallbackMemoryRoutesDeps {
  registry: InvocationRegistry;
  hindsightClient?: IHindsightClient;
  sharedBank?: string;
}

const searchEvidenceQuerySchema = callbackAuthSchema.extend({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  budget: z.enum(['low', 'mid', 'high']).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  tagsMatch: z.enum(['any', 'all', 'any_strict', 'all_strict']).optional(),
});
const reflectSchema = callbackAuthSchema.extend({
  query: z.string().trim().min(1),
});
const retainMemorySchema = callbackAuthSchema.extend({
  content: z.string().trim().min(1).max(50000),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  metadata: z.record(z.string()).optional(),
});

type EvidenceSourceType = 'decision' | 'phase' | 'discussion' | 'commit';
type EvidenceConfidence = 'high' | 'mid' | 'low';

function normalizeTags(input: string | string[] | undefined, defaultOrigin: string): string[] {
  const defaults = ['project:cat-cafe', defaultOrigin];
  if (input == null) return defaults;

  const tags = (Array.isArray(input) ? input : [input])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (tags.length === 0) return defaults;

  // project:cat-cafe is always present (P0 governance constraint)
  if (!tags.includes('project:cat-cafe')) {
    tags.unshift('project:cat-cafe');
  }

  return tags;
}

function classifySource(path: string): EvidenceSourceType {
  if (path.includes('decisions')) return 'decision';
  if (path.includes('phases')) return 'phase';
  if (path.includes('discussions')) return 'discussion';
  return 'commit';
}

function memoryToResult(mem: HindsightMemory): { title: string; anchor: string; snippet: string; confidence: EvidenceConfidence; sourceType: EvidenceSourceType } {
  const anchor = mem.metadata?.['anchor'] ?? '';
  const score = mem.score ?? 0;
  return {
    title: mem.content.slice(0, 120),
    anchor,
    snippet: mem.content.slice(0, 300),
    confidence: score > 0.8 ? 'high' : score > 0.5 ? 'mid' : 'low',
    sourceType: classifySource(anchor),
  };
}

function shouldDegrade(err: unknown): boolean {
  if (err instanceof HindsightError) {
    if (err.code === 'CONNECTION_FAILED' || err.code === 'TIMEOUT' || err.code === 'RATE_LIMITED') return true;
    if (err.statusCode != null && (err.statusCode >= 500 || err.statusCode === 429)) return true;
    return false;
  }
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('econnrefused')
    || msg.includes('etimedout')
    || msg.includes('timeout')
    || msg.includes('aborted')
    || msg.includes('network')
    || msg.includes('fetch failed')
    || msg.includes('rate limit')
    || msg.includes('too many requests')
    || msg.includes('429');
}

export async function registerCallbackMemoryRoutes(app: FastifyInstance, deps: CallbackMemoryRoutesDeps): Promise<void> {
  const { registry, hindsightClient } = deps;
  const sharedBank = deps.sharedBank ?? 'cat-cafe-shared';

  app.get('/api/callbacks/search-evidence', async (request, reply) => {
    if (!hindsightClient) {
      reply.status(501);
      return { error: 'Hindsight client not configured' };
    }
    const parsed = searchEvidenceQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid query parameters', details: parsed.error.issues };
    }
    const { invocationId, callbackToken, q, limit, budget, tags, tagsMatch } = parsed.data;
    const recallDefaults = collectConfigSnapshot().hindsight.recallDefaults;
    const effectiveLimit = limit ?? recallDefaults.limit;
    const effectiveBudget = budget ?? recallDefaults.budget;
    const effectiveTagsMatch = tagsMatch ?? recallDefaults.tagsMatch;
    const record = registry.verify(invocationId, callbackToken);
    if (!record) {
      reply.status(401);
      return { error: 'Invalid or expired callback credentials' };
    }
    try {
      const memories = await hindsightClient.recall(sharedBank, q, {
        limit: effectiveLimit,
        budget: effectiveBudget,
        tags: normalizeTags(tags, 'origin:git'),
        tagsMatch: effectiveTagsMatch,
      });
      return { results: memories.map(memoryToResult), degraded: false };
    } catch (err) {
      if (shouldDegrade(err)) return { results: [], degraded: true, degradeReason: 'hindsight_unavailable' };
      reply.status(502);
      return { error: 'Evidence search unavailable', degraded: false };
    }
  });

  app.post('/api/callbacks/reflect', async (request, reply) => {
    if (!hindsightClient) {
      reply.status(501);
      return { error: 'Hindsight client not configured' };
    }
    const parsed = reflectSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }
    const { invocationId, callbackToken, query } = parsed.data;
    const dispositionMode = collectConfigSnapshot().hindsight.reflect.dispositionMode;
    const record = registry.verify(invocationId, callbackToken);
    if (!record) {
      reply.status(401);
      return { error: 'Invalid or expired callback credentials' };
    }
    try {
      const reflection = await hindsightClient.reflect(sharedBank, query);
      return { reflection, degraded: false, dispositionMode };
    } catch (err) {
      if (shouldDegrade(err)) {
        return { reflection: '', degraded: true, degradeReason: 'hindsight_unavailable', dispositionMode };
      }
      reply.status(502);
      return { error: 'Reflect unavailable', degraded: false };
    }
  });

  app.post('/api/callbacks/retain-memory', async (request, reply) => {
    if (!hindsightClient) {
      reply.status(501);
      return { error: 'Hindsight client not configured' };
    }
    const parsed = retainMemorySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }
    const { invocationId, callbackToken, content, tags, metadata } = parsed.data;
    const record = registry.verify(invocationId, callbackToken);
    if (!record) {
      reply.status(401);
      return { error: 'Invalid or expired callback credentials' };
    }
    const mergedMetadata: Record<string, string> = {
      source: 'callback',
      invocationId,
      userId: record.userId,
      catId: record.catId,
      threadId: record.threadId,
      ...(metadata ?? {}),
    };
    try {
      await hindsightClient.retain(sharedBank, [{
        content,
        tags: normalizeTags(tags, 'origin:callback'),
        metadata: mergedMetadata,
        timestamp: Date.now(),
      }]);
      return { status: 'ok' };
    } catch (err) {
      if (shouldDegrade(err)) return { status: 'degraded', degradeReason: 'hindsight_unavailable' };
      reply.status(502);
      return { error: 'Retain unavailable' };
    }
  });
}
