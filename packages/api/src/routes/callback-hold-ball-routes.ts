/**
 * F167 Phase C1: Hold Ball Callback Routes
 * POST /api/callbacks/hold-ball — register ball hold + schedule wake-up via reminder template
 *
 * Semantic note (gpt52 review on PR #1289):
 * The hold counter is a ROLLING WINDOW counter, not a true "consecutive" counter.
 * A cat can hold up to MAX_HOLDS_PER_WINDOW times within HOLD_WINDOW_MS per
 * (threadId, catId); the window slides on each increment. State is process-local
 * (in-memory Map) — best-effort only. API restart or multi-instance deployments
 * will reset the counter. Durable enforcement would require sharing state with the
 * reminder scheduler; that is intentionally deferred.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { InvocationRegistry } from '../domains/cats/services/agents/invocation/InvocationRegistry.js';
import { createModuleLogger } from '../infrastructure/logger.js';
import type { DynamicTaskStore } from '../infrastructure/scheduler/DynamicTaskStore.js';
import type { TaskRunnerV2 } from '../infrastructure/scheduler/TaskRunnerV2.js';
import type { TaskTemplate } from '../infrastructure/scheduler/templates/types.js';
import { requireCallbackAuth } from './callback-auth-prehandler.js';
import { deriveCallbackActor } from './callback-scope-helpers.js';

const log = createModuleLogger('routes/callback-hold-ball');

export const MAX_HOLDS_PER_WINDOW = 3;
export const HOLD_WINDOW_MS = 3_600_000;

const holdCounts = new Map<string, { count: number; lastAt: number }>();

export function getHoldCount(threadId: string, catId: string, now: number = Date.now()): number {
  const key = `${threadId}:${catId}`;
  const entry = holdCounts.get(key);
  if (!entry) return 0;
  if (now - entry.lastAt > HOLD_WINDOW_MS) {
    holdCounts.delete(key);
    return 0;
  }
  return entry.count;
}

export function incrementHoldCount(threadId: string, catId: string, now: number = Date.now()): number {
  const key = `${threadId}:${catId}`;
  const entry = holdCounts.get(key);
  if (!entry || now - entry.lastAt > HOLD_WINDOW_MS) {
    holdCounts.set(key, { count: 1, lastAt: now });
    return 1;
  }
  entry.count++;
  entry.lastAt = now;
  return entry.count;
}

const holdBallSchema = z.object({
  reason: z.string().min(1).max(500),
  nextStep: z.string().min(1).max(500),
  wakeAfterMs: z.number().int().min(5_000).max(3_600_000),
});

export interface HoldBallRouteDeps {
  registry: InvocationRegistry;
  taskRunner: TaskRunnerV2;
  templateRegistry: { get(id: string): TaskTemplate | undefined };
  dynamicTaskStore: DynamicTaskStore;
}

export function registerCallbackHoldBallRoutes(app: FastifyInstance, deps: HoldBallRouteDeps): void {
  const { taskRunner, templateRegistry, dynamicTaskStore } = deps;

  app.post('/api/callbacks/hold-ball', async (request, reply) => {
    const record = requireCallbackAuth(request, reply);
    if (!record) return;
    const actor = deriveCallbackActor(record);

    const parsed = holdBallSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }

    const { reason, nextStep, wakeAfterMs } = parsed.data;
    const { threadId, catId, userId } = actor;
    const catIdStr = catId as string;

    const currentCount = getHoldCount(threadId, catIdStr);
    if (currentCount >= MAX_HOLDS_PER_WINDOW) {
      log.warn(
        { threadId, catId: catIdStr, currentCount, windowMs: HOLD_WINDOW_MS },
        'F167 C1: hold_ball rejected — maxHoldsPerWindow reached',
      );
      reply.status(429);
      return {
        error:
          `maxHoldsPerWindow (${MAX_HOLDS_PER_WINDOW} per ~1h window) reached. ` +
          'You MUST pass the ball now: @ another cat or @landy.',
        holdsInWindow: currentCount,
        maxHoldsPerWindow: MAX_HOLDS_PER_WINDOW,
        windowMs: HOLD_WINDOW_MS,
      };
    }

    const template = templateRegistry.get('reminder');
    if (!template) {
      log.error('F167 C1: reminder template not found');
      reply.status(500);
      return { error: 'Internal error: reminder template not found' };
    }

    const taskId = `hold-ball-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fireAt = Date.now() + wakeAfterMs;
    const wakeMessage =
      `持球唤醒：${reason}。球仍在你手上。现在执行：${nextStep}。` + '若条件仍未满足：再持一次或升级；禁止无限持球。';

    const taskParams = {
      trigger: { type: 'once' as const, fireAt },
      params: {
        message: wakeMessage,
        targetCatId: catIdStr,
        triggerUserId: userId,
      },
      deliveryThreadId: threadId as string | null,
    };

    const spec = template.createSpec(taskId, taskParams);

    dynamicTaskStore.insert({
      id: taskId,
      templateId: 'reminder',
      trigger: { type: 'once', fireAt },
      params: taskParams.params,
      display: {
        label: `持球唤醒 (${catIdStr})`,
        category: 'system',
        description: wakeMessage.slice(0, 100),
      },
      deliveryThreadId: threadId,
      enabled: true,
      createdBy: `hold-ball:${catIdStr}`,
      createdAt: new Date().toISOString(),
    });
    taskRunner.registerDynamic(spec, taskId);

    const newCount = incrementHoldCount(threadId, catIdStr);

    log.info(
      {
        threadId,
        catId: catIdStr,
        reason,
        nextStep,
        wakeAfterMs,
        taskId,
        holdsInWindow: newCount,
        windowMs: HOLD_WINDOW_MS,
      },
      'F167 C1: hold_ball registered — wake-up scheduled',
    );

    return {
      status: 'ok',
      held: true,
      taskId,
      holdsInWindow: newCount,
      maxHoldsPerWindow: MAX_HOLDS_PER_WINDOW,
      windowMs: HOLD_WINDOW_MS,
      wakeAt: new Date(fireAt).toISOString(),
    };
  });
}
