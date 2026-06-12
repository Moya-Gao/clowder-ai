/**
 * Concierge API Routes (F229 PR-A1 + A3b)
 *
 * GET  /api/concierge/config   — 获取当前用户的前台猫配置（不存在则返回默认值）
 * PUT  /api/concierge/config   — 覆盖写入用户的前台猫配置（TTL=0 持久化）
 * POST /api/concierge/thread   — 懒创建/获取 per-user concierge thread，返回 threadId
 * POST /api/concierge/relay    — 投递 relay 消息到目标 thread (§1a RelayReceipt)
 * POST /api/concierge/confirm  — 更新确认卡状态 (§1b PendingConfirmation)
 * GET  /api/concierge/peek     — 获取目标消息的前后上下文 (concierge_peek)
 */

import { randomUUID } from 'node:crypto';
import { type CatId, catIdSchema } from '@cat-cafe/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isCatAvailable } from '../config/cat-config-loader.js';
import type { IMessageStore } from '../domains/cats/services/stores/ports/MessageStore.js';
import type { IConciergeConfigStore } from '../domains/concierge/ConciergeConfigStore.js';
import type { IConciergeConfirmationStore } from '../domains/concierge/ConciergeConfirmationStore.js';
import type { IConciergeRelayStore } from '../domains/concierge/ConciergeRelayStore.js';
import type { ConciergeThreadService } from '../domains/concierge/ConciergeThreadService.js';
import { createModuleLogger } from '../infrastructure/logger.js';
import { resolveStrictUserId, resolveUserId } from '../utils/request-identity.js';

const log = createModuleLogger('concierge-routes');

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
    /** PR-A3b: ball position persistence (INV-P3) */
    ballPosition: z.object({ x: z.number().finite(), y: z.number().finite() }).nullable(),
  })
  .partial()
  .strict();

/** Schema for POST /api/concierge/relay body (§1a + §1c INVs) */
const relaySchema = z.object({
  targetThreadId: z.string().min(1).max(100),
  targetCats: z.array(catIdSchema()).min(1),
  /** User's original text verbatim (INV-E1: must be non-empty) */
  originalText: z.string().min(1).max(100000),
  /** Source message ID in the concierge thread */
  sourceMessageId: z.string().min(1).max(100),
  /** Concierge thread ID (for routing credentials template) */
  conciergeThreadId: z.string().min(1).max(100),
});

/** Schema for POST /api/concierge/confirm body (§1b) */
const confirmSchema = z.object({
  confirmationId: z.string().min(1).max(100),
  status: z.enum(['confirmed', 'cancelled']),
});

/** Schema for GET /api/concierge/peek query (concierge_peek) */
const peekSchema = z.object({
  threadId: z.string().min(1).max(100),
  messageId: z.string().min(1).max(100),
  /** Number of messages before/after to show */
  windowSize: z.coerce.number().int().min(1).max(10).default(3),
});

interface ConciergeRoutesOptions {
  conciergeConfigStore: IConciergeConfigStore;
  conciergeThreadService: ConciergeThreadService;
  conciergeRelayStore: IConciergeRelayStore;
  conciergeConfirmationStore: IConciergeConfirmationStore;
  messageStore: IMessageStore;
}

export const conciergeRoutes: FastifyPluginAsync<ConciergeRoutesOptions> = async (app, opts) => {
  const {
    conciergeConfigStore,
    conciergeThreadService,
    conciergeRelayStore,
    conciergeConfirmationStore,
    messageStore,
  } = opts;

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

  // POST /api/concierge/relay — 投递 relay 消息到目标 thread (§1a RelayReceipt + §1c EscalationContext)
  //
  // INV R1: 先落记录再投递（store.write 先于 cross_post dispatch）
  // INV R2: dispatch_failed 手动重试（不自动重试）
  // INV R3: 同一 receipt 重试用同一 clientMessageId（幂等）
  // INV-E1: originalText 非空且 sourceMessageId 存在（schema 硬校验）
  // INV-E2: 投递内容 = 原文段 + anchor + routing credentials 模板（机器拼接）
  app.post('/api/concierge/relay', async (request, reply) => {
    const userId = resolveStrictUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const parseResult = relaySchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid relay payload', details: parseResult.error.flatten().fieldErrors };
    }
    const { targetThreadId, targetCats, originalText, sourceMessageId, conciergeThreadId } = parseResult.data;

    // Check for existing receipt for retry (INV R3: reuse clientMessageId)
    const receiptId = randomUUID();
    // Cloud P1 fix: idempotencyKey must be a valid UUID (messages.schema.ts:22).
    // `relay-${receiptId}` fails z.string().uuid() → every dispatch would 400.
    // Use receiptId directly — it's already a UUID from randomUUID().
    const clientMessageId = receiptId;
    const now = Date.now();

    const receipt = {
      id: receiptId,
      userId,
      conciergeThreadId,
      targetThreadId,
      targetCats,
      originalText,
      sourceMessageId,
      clientMessageId,
      status: 'confirmed' as const,
      createdAt: now,
      updatedAt: now,
    };

    // R1: 先落记录再投递 — crash window 内可恢复
    await conciergeRelayStore.create(receipt);

    try {
      // R3: use receipt's clientMessageId for idempotent dispatch
      // INV-E2: relay content = user original text + routing credentials template
      const relayContent = buildRelayContent(originalText, conciergeThreadId, targetCats);

      // Dispatch via internal POST /api/messages (reuses full routing pipeline)
      const injectResult = await app.inject({
        method: 'POST',
        url: '/api/messages',
        payload: {
          content: relayContent,
          threadId: targetThreadId,
          mentions: targetCats,
          deliveryMode: 'immediate',
          idempotencyKey: clientMessageId,
        },
        headers: {
          'x-cat-cafe-user': userId,
          'content-type': 'application/json',
        },
      });

      if (injectResult.statusCode >= 400) {
        log.warn(
          { receiptId, targetThreadId, statusCode: injectResult.statusCode, body: injectResult.body },
          'Relay dispatch failed',
        );
        await conciergeRelayStore.updateStatus(receiptId, 'dispatch_failed');
        reply.status(502);
        return { error: 'Relay dispatch failed', receiptId, status: 'dispatch_failed' };
      }

      // Dispatch succeeded
      await conciergeRelayStore.updateStatus(receiptId, 'dispatched');
      log.info({ receiptId, targetThreadId, targetCats }, 'Relay dispatched successfully');

      return { receiptId, status: 'dispatched' };
    } catch (err) {
      log.error({ err, receiptId }, 'Relay dispatch threw');
      await conciergeRelayStore.updateStatus(receiptId, 'dispatch_failed');
      reply.status(502);
      return { error: 'Relay dispatch failed', receiptId, status: 'dispatch_failed' };
    }
  });

  // POST /api/concierge/relay/:receiptId/retry — 手动重试失败的 relay (INV R2)
  app.post<{ Params: { receiptId: string } }>('/api/concierge/relay/:receiptId/retry', async (request, reply) => {
    const userId = resolveStrictUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const { receiptId } = request.params;
    const receipt = await conciergeRelayStore.get(receiptId);
    if (!receipt || receipt.userId !== userId) {
      reply.status(404);
      return { error: 'Receipt not found' };
    }
    if (receipt.status !== 'dispatch_failed') {
      reply.status(409);
      return { error: `Cannot retry receipt in status: ${receipt.status}` };
    }

    // R3: reuse original clientMessageId for idempotency
    await conciergeRelayStore.updateStatus(receiptId, 'confirmed');

    try {
      const relayContent = buildRelayContent(receipt.originalText, receipt.conciergeThreadId, receipt.targetCats);
      const injectResult = await app.inject({
        method: 'POST',
        url: '/api/messages',
        payload: {
          content: relayContent,
          threadId: receipt.targetThreadId,
          mentions: receipt.targetCats,
          deliveryMode: 'immediate',
          idempotencyKey: receipt.clientMessageId,
        },
        headers: {
          'x-cat-cafe-user': userId,
          'content-type': 'application/json',
        },
      });

      if (injectResult.statusCode >= 400) {
        await conciergeRelayStore.updateStatus(receiptId, 'dispatch_failed');
        reply.status(502);
        return { error: 'Retry dispatch failed', receiptId, status: 'dispatch_failed' };
      }

      await conciergeRelayStore.updateStatus(receiptId, 'dispatched');
      return { receiptId, status: 'dispatched' };
    } catch (err) {
      log.error({ err, receiptId }, 'Retry dispatch threw');
      await conciergeRelayStore.updateStatus(receiptId, 'dispatch_failed');
      reply.status(502);
      return { error: 'Retry dispatch failed', receiptId, status: 'dispatch_failed' };
    }
  });

  // POST /api/concierge/confirm — 更新确认卡状态 (§1b)
  app.post('/api/concierge/confirm', async (request, reply) => {
    const userId = resolveStrictUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const parseResult = confirmSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid confirm payload', details: parseResult.error.flatten().fieldErrors };
    }
    const { confirmationId, status } = parseResult.data;

    const confirmation = await conciergeConfirmationStore.get(confirmationId);
    if (!confirmation || confirmation.userId !== userId) {
      reply.status(404);
      return { error: 'Confirmation not found' };
    }
    // C1: only 'rendered' → 'confirmed' | 'cancelled' is valid
    if (confirmation.status !== 'rendered') {
      reply.status(409);
      return { error: `Cannot update confirmation in status: ${confirmation.status}` };
    }

    await conciergeConfirmationStore.updateStatus(confirmationId, status);
    return { confirmationId, status };
  });

  // GET /api/concierge/peek — 获取目标消息的前后上下文 (concierge_peek)
  app.get('/api/concierge/peek', async (request, reply) => {
    const userId = resolveUserId(request, { defaultUserId: 'default-user' });
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const parseResult = peekSchema.safeParse(request.query);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid peek query', details: parseResult.error.flatten().fieldErrors };
    }
    const { threadId, messageId, windowSize } = parseResult.data;

    // Fetch messages around the target (scoped to requesting user — cloud review P1)
    const allMessages = await messageStore.getByThread(threadId, 200, userId);
    let targetIdx = allMessages.findIndex((m) => m.id === messageId);

    // Cloud R2-P2 + R3-P1 + R4-P1 fix: if target is beyond the 200-message window,
    // verify the user actually owns messages in this thread before falling back to
    // unscoped getById. getByThread includes isSystemUserMessage results (system/
    // scheduler messages visible to all), so allMessages.length > 0 alone does NOT
    // prove user ownership — a non-owning user could bypass via system-message presence.
    // Defense: require at least one message with matching userId (not just system msgs).
    if (targetIdx === -1) {
      const userOwnsThread = allMessages.some((m) => m.userId === userId);
      if (!userOwnsThread) {
        // User has no owned messages in this thread — block access.
        reply.status(404);
        return { error: 'Target message not found in thread' };
      }
      const targetMsg = await messageStore.getById(messageId);
      if (!targetMsg || targetMsg.threadId !== threadId) {
        reply.status(404);
        return { error: 'Target message not found in thread' };
      }
      // Target exists but is outside the recent window — return it as sole context
      return {
        window: [
          {
            id: targetMsg.id,
            content: targetMsg.content,
            catId: targetMsg.catId,
            userId: targetMsg.userId,
            timestamp: targetMsg.timestamp,
            isTarget: true,
          },
        ],
      };
    }

    const startIdx = Math.max(0, targetIdx - windowSize);
    const endIdx = Math.min(allMessages.length, targetIdx + windowSize + 1);
    const window = allMessages.slice(startIdx, endIdx).map((m) => ({
      id: m.id,
      content: m.content,
      catId: m.catId,
      userId: m.userId,
      timestamp: m.timestamp,
      isTarget: m.id === messageId,
    }));

    return { threadId, messageId, window };
  });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build relay content (INV-E2): original text + anchor list + routing credentials template.
 * Machine-assembled, model only produces anchor selection.
 */
function buildRelayContent(originalText: string, conciergeThreadId: string, targetCats: string[]): string {
  const targetHandles = targetCats.map((c) => `@${c}`).join(' ');
  // R-review P1 fix (R2): neutralize line-start @mentions in user text.
  // The a2a-mentions router strips markdown prefixes (> , - , * , 1. ) before
  // checking startsWith('@') — so `> @codex` still routes after prefix strip.
  // Fix: insert ZWNJ (‌) between `> ` and the line content. After the
  // router strips `> `, it sees `‌@codex` which does NOT startsWith('@'),
  // so routing is skipped. ZWNJ is zero-width — display is identical.
  const ZWNJ = '‌';
  const quotedText = originalText
    .split('\n')
    .map((line) => `> ${ZWNJ}${line}`)
    .join('\n');
  return [
    `${targetHandles}`,
    '',
    '---',
    '**前台猫转达的消息：**',
    '',
    quotedText,
    '',
    '---',
    `*完成后请回复到前台 thread (cross_post threadId: ${conciergeThreadId})*`,
  ].join('\n');
}
