/**
 * Bootcamp Callback Routes
 * POST /api/callbacks/update-bootcamp-state — update bootcamp phase + state
 * POST /api/callbacks/bootcamp-env-check — run env check and store results
 */

import { catIdSchema } from '@cat-cafe/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { InvocationRegistry } from '../domains/cats/services/agents/invocation/InvocationRegistry.js';
import { runEnvironmentCheck } from '../domains/cats/services/bootcamp/env-check.js';
import type { BootcampStateV1, IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import { callbackAuthSchema } from './callback-auth-schema.js';
import { EXPIRED_CREDENTIALS_ERROR } from './callback-errors.js';

const bootcampPhaseSchema = z.enum([
  'phase-0-select-cat',
  'phase-1-intro',
  'phase-2-env-check',
  'phase-3-config-help',
  'phase-3.5-advanced',
  'phase-4-task-select',
  'phase-5-kickoff',
  'phase-6-design',
  'phase-7-dev',
  'phase-8-review',
  'phase-9-complete',
  'phase-10-retro',
  'phase-11-farewell',
]);

const updateBootcampStateCallbackSchema = callbackAuthSchema.extend({
  threadId: z.string().min(1),
  phase: bootcampPhaseSchema.optional(),
  leadCat: catIdSchema().optional(),
  selectedTaskId: z.string().max(50).optional(),
  envCheck: z
    .record(
      z.object({
        ok: z.boolean(),
        version: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  advancedFeatures: z.record(z.enum(['available', 'unavailable', 'skipped'])).optional(),
  completedAt: z.number().optional(),
});

export function registerCallbackBootcampRoutes(
  app: FastifyInstance,
  deps: { registry: InvocationRegistry; threadStore: IThreadStore },
): void {
  const { registry, threadStore } = deps;

  app.post('/api/callbacks/update-bootcamp-state', async (request, reply) => {
    const parsed = updateBootcampStateCallbackSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }

    const { invocationId, callbackToken, threadId, ...updates } = parsed.data;
    const record = registry.verify(invocationId, callbackToken);
    if (!record) {
      reply.status(401);
      return EXPIRED_CREDENTIALS_ERROR;
    }

    // P2: Stale invocation guard — ignore if superseded by newer invocation
    if (!registry.isLatest(invocationId)) {
      return { status: 'stale_ignored' };
    }

    // P1: Cross-thread binding check — reject if invocation is bound to a different thread
    if (record.threadId !== threadId) {
      reply.status(403);
      return { error: 'Cross-thread write rejected' };
    }

    const thread = await threadStore.get(threadId);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }

    // Merge updates into existing bootcampState
    const existing = thread.bootcampState ?? {
      v: 1 as const,
      phase: 'phase-0-select-cat' as const,
      startedAt: Date.now(),
    };
    // Build merged state — spreads preserve existing fields, updates override
    const raw: Record<string, unknown> = { ...existing };
    if (updates.phase !== undefined) raw['phase'] = updates.phase;
    if (updates.leadCat !== undefined) raw['leadCat'] = updates.leadCat;
    if (updates.selectedTaskId !== undefined) raw['selectedTaskId'] = updates.selectedTaskId;
    if (updates.envCheck !== undefined) raw['envCheck'] = updates.envCheck;
    if (updates.advancedFeatures !== undefined) raw['advancedFeatures'] = updates.advancedFeatures;
    if (updates.completedAt !== undefined) raw['completedAt'] = updates.completedAt;

    await threadStore.updateBootcampState(threadId, raw as unknown as BootcampStateV1);
    const updated = await threadStore.get(threadId);
    return { bootcampState: updated?.bootcampState };
  });

  // POST /api/callbacks/bootcamp-env-check — run env check and auto-store results
  const envCheckCallbackSchema = callbackAuthSchema.extend({
    threadId: z.string().min(1),
  });

  app.post('/api/callbacks/bootcamp-env-check', async (request, reply) => {
    const parsed = envCheckCallbackSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }

    const { invocationId, callbackToken, threadId } = parsed.data;
    const record = registry.verify(invocationId, callbackToken);
    if (!record) {
      reply.status(401);
      return EXPIRED_CREDENTIALS_ERROR;
    }

    // P2: Stale invocation guard
    if (!registry.isLatest(invocationId)) {
      return { status: 'stale_ignored' };
    }

    // P1: Cross-thread binding check
    if (record.threadId !== threadId) {
      reply.status(403);
      return { error: 'Cross-thread write rejected' };
    }

    const thread = await threadStore.get(threadId);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }

    const results = await runEnvironmentCheck();

    // Auto-store env check results in bootcampState
    if (thread.bootcampState) {
      const updated = {
        ...thread.bootcampState,
        envCheck: {
          node: results.node,
          pnpm: results.pnpm,
          git: results.git,
          claudeCli: results.claudeCli,
          mcp: results.mcp,
          tts: { ok: results.tts.ok, note: results.tts.recommended },
          asr: results.asr,
          pencil: results.pencil,
        },
      } as unknown as BootcampStateV1;
      await threadStore.updateBootcampState(threadId, updated);
    }

    return results;
  });
}
