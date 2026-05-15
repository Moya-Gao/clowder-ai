import type Database from 'better-sqlite3';
import type { FastifyPluginAsync } from 'fastify';
import { freezeF200Flags } from '../domains/memory/f200-types.js';
import { RecallMetricsComputer } from '../domains/memory/RecallMetricsComputer.js';
import { resolveHeaderUserId } from '../utils/request-identity.js';

export interface RecallMetricsRoutesOptions {
  evidenceDb: Database.Database;
}

interface CacheEntry {
  key: string;
  data: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 20;

export function clearRecallMetricsCache(): void {
  cache.clear();
}

export const recallMetricsRoutes: FastifyPluginAsync<RecallMetricsRoutesOptions> = async (app, opts) => {
  const computer = new RecallMetricsComputer(opts.evidenceDb);

  app.get<{
    Querystring: { days?: string; catId?: string; toolName?: string; refresh?: string };
  }>('/api/recall/metrics', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

    const days = Math.min(Math.max(1, parseInt(request.query.days ?? '30', 10) || 30), 90);
    const catId = request.query.catId || undefined;
    const toolName = request.query.toolName || undefined;
    const forceRefresh = request.query.refresh === '1';
    const cacheKey = `recall:${days}:${catId ?? ''}:${toolName ?? ''}`;

    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.data;
    }

    const report = computer.computeMetrics({ days, catId, toolName });

    if (cache.size >= MAX_CACHE) {
      const oldestKey = cache.keys().next().value as string;
      cache.delete(oldestKey);
    }
    cache.set(cacheKey, { key: cacheKey, data: report, expiresAt: Date.now() + CACHE_TTL_MS });
    return report;
  });

  app.get<{
    Querystring: { limit?: string; dormancyThreshold?: string; refresh?: string };
  }>('/api/recall/anchors', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

    const forceRefresh = request.query.refresh === '1';
    if (forceRefresh) computer.refreshAnchorMetrics();

    const limit = Math.min(Math.max(1, parseInt(request.query.limit ?? '20', 10) || 20), 100);
    const threshold = parseInt(request.query.dormancyThreshold ?? '0', 10);

    if (threshold > 0) {
      return { anchors: computer.getDormantAnchors(threshold, limit) };
    }
    return { anchors: computer.getPopularAnchors(limit) };
  });

  app.get('/api/recall/flags', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });
    return { f200: freezeF200Flags() };
  });

  app.post('/api/recall/anchors/refresh', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

    computer.refreshAnchorMetrics();
    return { status: 'ok' };
  });
};
