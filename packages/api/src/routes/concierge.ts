/**
 * Concierge API Routes (F229 PR-A1)
 *
 * GET  /api/concierge/config  — 获取当前用户的前台猫配置（不存在则返回默认值）
 * PUT  /api/concierge/config  — 覆盖写入用户的前台猫配置（TTL=0 持久化）
 * POST /api/concierge/thread  — 懒创建/获取 per-user concierge thread，返回 threadId
 */

import { type CatId, catIdSchema } from '@cat-cafe/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isCatAvailable } from '../config/cat-config-loader.js';
import type { IConciergeConfigStore } from '../domains/concierge/ConciergeConfigStore.js';
import type { ConciergeThreadService } from '../domains/concierge/ConciergeThreadService.js';
import { resolveStrictUserId, resolveUserId } from '../utils/request-identity.js';

/**
 * Partial schema for PUT /api/concierge/config.
 * All fields optional (partial update semantics — merged with existing config).
 * TTL=0 contract: validated values only ever reach the store.
 */
const patchConciergeConfigSchema = z
  .object({
    enabled: z.boolean(),
    skin: z.literal('yarn-ball'),
    // No newlines/CR allowed: both fields are interpolated verbatim into the concierge
    // system prompt. Embedded newlines would inject prompt directives (P1 prompt injection).
    displayName: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[^\n\r]+$/, 'displayName must not contain newlines'),
    personaTone: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^\n\r]+$/, 'personaTone must not contain newlines'),
    dutyCatProfileId: catIdSchema().refine((id) => isCatAvailable(id), {
      message: 'Duty cat is currently unavailable',
    }),
    proactivePolicy: z.enum(['ambient', 'quiet-badge']),
    muted: z.boolean(),
  })
  .partial()
  .strict();

interface ConciergeRoutesOptions {
  conciergeConfigStore: IConciergeConfigStore;
  conciergeThreadService: ConciergeThreadService;
}

export const conciergeRoutes: FastifyPluginAsync<ConciergeRoutesOptions> = async (app, opts) => {
  const { conciergeConfigStore, conciergeThreadService } = opts;

  // GET /api/concierge/config — 获取用户前台猫配置
  app.get('/api/concierge/config', async (request, reply) => {
    const userId = resolveUserId(request, { defaultUserId: 'default-user' });
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }
    const config = await conciergeConfigStore.get(userId);
    return { config };
  });

  // PUT /api/concierge/config — 覆盖写入用户前台猫配置（TTL=0 持久化，铁律 5 LL-048）
  app.put('/api/concierge/config', async (request, reply) => {
    // Mutations require strict identity: session cookie OR X-Cat-Cafe-User (non-browser).
    // Browser requests without a session return null → 401 (prevents overwriting TTL=0
    // config for 'default-user' via trusted-origin fallback).
    const userId = resolveStrictUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }
    // Schema-validated partial update — prevents bad values poisoning TTL=0 persistent config
    const parseResult = patchConciergeConfigSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid config fields', details: parseResult.error.flatten().fieldErrors };
    }
    const patch = parseResult.data;
    // Merge with existing config (partial update semantics)
    const existing = await conciergeConfigStore.get(userId);
    const updated = { ...existing, ...patch };
    await conciergeConfigStore.put(userId, updated);
    // P2 cloud fix: sync thread.preferredCats immediately so duty-cat change takes effect
    // on the next @mention-free message without requiring a /api/concierge/thread roundtrip.
    // Fail-open: getOrCreate self-heals on next call if this races or throws.
    if (updated.dutyCatProfileId) {
      try {
        await conciergeThreadService.syncPreferredCats(userId, updated.dutyCatProfileId as CatId);
      } catch {
        // best-effort — routing stale at worst until next getOrCreate
      }
    }
    return { config: updated };
  });

  // POST /api/concierge/thread — 懒创建/获取 per-user concierge thread
  app.post('/api/concierge/thread', async (request, reply) => {
    // Mutations require strict identity (same as PUT above).
    const userId = resolveStrictUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }
    const threadId = await conciergeThreadService.getOrCreate(userId);
    return { threadId };
  });
};
