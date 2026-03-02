/**
 * Callback API Routes — MCP 回传端点
 * 安全: 每个请求都需要 invocationId + callbackToken 验证。
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createCatId, catRegistry } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import type { InvocationRegistry } from '../domains/cats/services/agents/invocation/InvocationRegistry.js';
import type { IMessageStore } from '../domains/cats/services/stores/ports/MessageStore.js';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { ITaskStore } from '../domains/cats/services/stores/ports/TaskStore.js';
import type { IInvocationRecordStore } from '../domains/cats/services/stores/ports/InvocationRecordStore.js';
import type { IHindsightClient } from '../domains/cats/services/orchestration/HindsightClient.js';
import type { DeliveryCursorStore } from '../domains/cats/services/stores/ports/DeliveryCursorStore.js';
import type { AgentRouter } from '../domains/cats/services/index.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';
import type { InvocationTracker } from '../domains/cats/services/agents/invocation/InvocationTracker.js';
import type { IPrTrackingStore } from '../infrastructure/email/PrTrackingStore.js';
import type { P0Freshness } from '../domains/cats/services/hindsight-import/p0-watermark.js';
import { parseA2AMentions } from '../domains/cats/services/agents/routing/a2a-mentions.js';
import type { RichBlock } from '@cat-cafe/shared';
import { normalizeRichBlock } from '@cat-cafe/shared';
import { extractRichFromText } from '../domains/cats/services/agents/routing/rich-block-extract.js';
import { getRichBlockBuffer } from '../domains/cats/services/agents/invocation/RichBlockBuffer.js';
import { getVoiceBlockSynthesizer } from '../domains/cats/services/tts/VoiceBlockSynthesizer.js';
import { canViewMessage } from '../domains/cats/services/stores/visibility.js';
import { callbackAuthSchema } from './callback-auth-schema.js';
import { registerCallbackMemoryRoutes } from './callback-memory-routes.js';
import { registerCallbackTaskRoutes } from './callback-task-routes.js';
import { enqueueA2ATargets } from './callback-a2a-trigger.js';
import { EXPIRED_CREDENTIALS_ERROR } from './callback-errors.js';

export interface CallbackRoutesOptions {
  registry: InvocationRegistry;
  messageStore: IMessageStore;
  socketManager: SocketManager;
  taskStore?: ITaskStore;
  /** For thinking mode filtering in thread-context */
  threadStore?: IThreadStore;
  hindsightClient?: IHindsightClient;
  sharedBank?: string;
  freshnessProvider?: () => Promise<P0Freshness>;
  reimportTriggerProvider?: (freshness: P0Freshness) => Promise<{
    status: 'triggered' | 'cooldown' | 'skipped' | 'disabled' | 'failed';
    reason?: string;
    nextAllowedAt?: string;
  }>;
  /** For post_message @mention → invocation triggering */
  router?: AgentRouter;
  invocationRecordStore?: IInvocationRecordStore;
  invocationTracker?: InvocationTracker;
  /** For mention ack cursor tracking (#77) */
  deliveryCursorStore?: DeliveryCursorStore;
  /** TD091: PR tracking registration via MCP callback */
  prTrackingStore?: IPrTrackingStore;
}

const postMessageSchema = callbackAuthSchema.extend({
  content: z.string().min(1).max(50000),
  replyTo: z.string().optional(),
  clientMessageId: z.string().min(1).max(200).optional(),
});

const threadContextQuerySchema = callbackAuthSchema.extend({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  threadId: z.string().min(1).optional(), // F-Swarm-6: optional cross-thread read
  catId: z.string().min(1).optional(),
  keyword: z.string().min(1).optional(),
});

const listThreadsQuerySchema = callbackAuthSchema.extend({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  activeSince: z.coerce.number().int().min(0).optional(),
});

const pendingMentionsQuerySchema = callbackAuthSchema.extend({
  // Accept both scalar and repeated query params (Fastify may surface string[]).
  includeAcked: z.union([z.string(), z.array(z.string())]).optional(),
});

const ackMentionsSchema = callbackAuthSchema.extend({
  upToMessageId: z.string().min(1),
});

/** F22: Rich block creation schema — validates shape + kind-specific fields (cloud Codex P1) */
const richChecklistItemSchema = z.object({ id: z.string(), text: z.string(), checked: z.boolean().optional() });
const richMediaItemSchema = z.object({ url: z.string(), alt: z.string().optional(), caption: z.string().optional() });
const richBlockSchema = z.discriminatedUnion('kind', [
  z.object({ id: z.string().min(1), kind: z.literal('card'), v: z.literal(1), title: z.string(), bodyMarkdown: z.string().optional(), tone: z.enum(['info', 'success', 'warning', 'danger']).optional(), fields: z.array(z.object({ label: z.string(), value: z.string() })).optional() }),
  z.object({ id: z.string().min(1), kind: z.literal('diff'), v: z.literal(1), filePath: z.string(), diff: z.string(), languageHint: z.string().optional() }),
  z.object({ id: z.string().min(1), kind: z.literal('checklist'), v: z.literal(1), title: z.string().optional(), items: z.array(richChecklistItemSchema).min(1) }),
  z.object({ id: z.string().min(1), kind: z.literal('media_gallery'), v: z.literal(1), title: z.string().optional(), items: z.array(richMediaItemSchema).min(1) }),
  z.object({ id: z.string().min(1), kind: z.literal('audio'), v: z.literal(1), url: z.string().optional().default(''), text: z.string().optional(), title: z.string().optional(), durationSec: z.number().optional(), mimeType: z.string().optional() }),
]);
const createRichBlockSchema = callbackAuthSchema.extend({
  block: richBlockSchema,
});

export const callbacksRoutes: FastifyPluginAsync<CallbackRoutesOptions> =
  async (app, opts) => {
    const { registry, messageStore, socketManager, taskStore, threadStore, router,
      invocationRecordStore, invocationTracker, deliveryCursorStore, prTrackingStore } = opts;

    app.post('/api/callbacks/post-message', async (request, reply) => {
      const parsed = postMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parsed.error.issues };
      }

      const { invocationId, callbackToken, content, replyTo, clientMessageId } = parsed.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return EXPIRED_CREDENTIALS_ERROR;
      }

      // Stale callback guard (cloud Codex P1 + 缅因猫 R3): reject callbacks from
      // preempted invocations. A newer invocation for the same thread+cat supersedes.
      // Return 200 + stale_ignored to avoid retry storms from the dying CLI process.
      if (!registry.isLatest(invocationId)) {
        return { status: 'stale_ignored', replyTo, ...(clientMessageId ? { clientMessageId } : {}) };
      }

      // At-least-once de-duplication: retries with same clientMessageId are treated as duplicate.
      if (clientMessageId) {
        const isFirstSeen = registry.claimClientMessageId(invocationId, clientMessageId);
        if (!isFirstSeen) {
          return { status: 'duplicate', replyTo, clientMessageId };
        }
      }

      // #83: Extract cc_rich blocks from post_message content (Route B for callback path)
      const { cleanText: storedContent, blocks: extractedBlocks } = extractRichFromText(content);

      // F34-b: Resolve voice blocks (audio with text, no url) before storing
      const synthesizer = getVoiceBlockSynthesizer();
      let richBlocks = extractedBlocks;
      if (synthesizer && extractedBlocks.some((b) => b.kind === 'audio' && 'text' in b)) {
        try {
          richBlocks = await synthesizer.resolveVoiceBlocks(extractedBlocks, record.catId as string);
        } catch (err) {
          app.log.error({ err }, '[callbacks/post-message] Voice block synthesis failed');
        }
      }

      // Parse line-start @mentions (A2A rule: only line-start, strip code blocks, single target)
      // Uses parseA2AMentions instead of resolveTargetsAndIntent to avoid
      // participants/default-opus fallback triggering on non-@ messages (P1-1)
      // and inline @mentions triggering invocations (P1-2).
      const senderCatId = createCatId(record.catId);
      const targetCats = parseA2AMentions(storedContent, senderCatId);
      const mentions: CatId[] = [...targetCats];

      // Store the message (scoped to the invocation's thread)
      const storedMsg = await messageStore.append({
        userId: record.userId,
        catId: record.catId,
        content: storedContent,
        mentions,
        origin: 'callback',
        timestamp: Date.now(),
        threadId: record.threadId,
        ...(richBlocks.length > 0 ? { extra: { rich: { v: 1 as const, blocks: richBlocks } } } : {}),
      });

      socketManager.broadcastAgentMessage({
        type: 'text',
        catId: record.catId,
        content: storedContent,
        origin: 'callback',
        messageId: storedMsg.id,
        timestamp: Date.now(),
      }, record.threadId);

      // #83: Broadcast each extracted rich block as SSE event for live rendering
      // P2 cloud-review: include messageId for frontend correlation
      for (const block of richBlocks) {
        socketManager.broadcastAgentMessage({
          type: 'system_info' as const,
          catId: record.catId,
          content: JSON.stringify({ type: 'rich_block', block, messageId: storedMsg.id }),
          timestamp: Date.now(),
        }, record.threadId);
      }

      // F27: Enqueue @mentioned cats into parent worklist (unified A2A path)
      if (targetCats.length > 0 && router && invocationRecordStore && record.threadId) {
        await enqueueA2ATargets(
          { router, invocationRecordStore, socketManager,
            ...(invocationTracker ? { invocationTracker } : {}),
            ...(deliveryCursorStore ? { deliveryCursorStore } : {}),
            log: app.log },
          { targetCats, content: storedContent, userId: record.userId,
            threadId: record.threadId, triggerMessage: storedMsg,
            callerCatId: senderCatId },
        );
      }

      return { status: 'ok', replyTo, ...(clientMessageId ? { clientMessageId } : {}) };
    });

    app.get('/api/callbacks/pending-mentions', async (request, reply) => {
      const parsed = pendingMentionsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Missing invocationId or callbackToken' };
      }

      const { invocationId, callbackToken, includeAcked } = parsed.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return EXPIRED_CREDENTIALS_ERROR;
      }

      const includeAckedValues = Array.isArray(includeAcked) ? includeAcked : (includeAcked ? [includeAcked] : []);
      const shouldIncludeAcked = includeAckedValues.some((v) => v === '1' || v.toLowerCase() === 'true');

      // #77: Use mention ack cursor to filter already-processed mentions
      const catId = createCatId(record.catId);
      const lastAckId = deliveryCursorStore
        ? await deliveryCursorStore.getMentionAckCursor(record.userId, catId, record.threadId)
        : undefined;

      const rawMentions = shouldIncludeAcked
        ? await messageStore.getRecentMentionsFor(record.catId, 20, record.userId, record.threadId)
        : await messageStore.getMentionsFor(record.catId, 20, record.userId, record.threadId, lastAckId);
      // F35: Filter out whispers not intended for this cat
      const mentionViewer = { type: 'cat' as const, catId };
      const mentions = rawMentions.filter((m) => canViewMessage(m, mentionViewer));
      return {
        mentions: mentions.map((item) => ({
          id: item.id,
          from: item.catId ?? item.userId,
          message: item.content,
          timestamp: item.timestamp,
          ...(shouldIncludeAcked ? { acked: Boolean(lastAckId && item.id <= lastAckId) } : {}),
        })),
      };
    });

    // #77: POST /api/callbacks/ack-mentions — explicit ack with 4-way validation
    app.post('/api/callbacks/ack-mentions', async (request, reply) => {
      const parsed = ackMentionsSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parsed.error.issues };
      }

      const { invocationId, callbackToken, upToMessageId } = parsed.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return EXPIRED_CREDENTIALS_ERROR;
      }

      if (!deliveryCursorStore) {
        reply.status(501);
        return { error: 'Mention ack not available (no cursor store)' };
      }

      const catId = createCatId(record.catId);

      // Validation 1: existence
      const targetMsg = await messageStore.getById(upToMessageId);
      if (!targetMsg) {
        reply.status(400);
        return { error: 'upToMessageId does not exist' };
      }

      // Validation 2: ownership (userId + threadId + mentions catId)
      if (targetMsg.userId !== record.userId) {
        reply.status(400);
        return { error: 'upToMessageId does not belong to current user session' };
      }
      if (targetMsg.threadId !== record.threadId) {
        reply.status(400);
        return { error: 'upToMessageId does not belong to current thread' };
      }
      if (!targetMsg.mentions.includes(catId)) {
        reply.status(400);
        return { error: 'upToMessageId does not mention current cat' };
      }

      // Validation 3: monotonic (noop if backwards)
      const currentCursor = await deliveryCursorStore.getMentionAckCursor(
        record.userId, catId, record.threadId
      );
      if (currentCursor && upToMessageId <= currentCursor) {
        return { status: 'noop', reason: 'already acknowledged' };
      }

      // Validation 4: window — upToMessageId must be within current pending window
      const pendingWindow = await messageStore.getMentionsFor(
        record.catId, 20, record.userId, record.threadId, currentCursor
      );
      if (pendingWindow.length > 0) {
        const windowLastId = pendingWindow[pendingWindow.length - 1]!.id;
        if (upToMessageId > windowLastId) {
          reply.status(400);
          return {
            error: 'upToMessageId exceeds current pending window, ack only within fetched batch',
            windowLastId,
          };
        }
      }

      await deliveryCursorStore.ackMentionCursor(record.userId, catId, record.threadId, upToMessageId);
      return { status: 'ok', ackedUpTo: upToMessageId };
    });

    app.get('/api/callbacks/thread-context', async (request, reply) => {
      const parsed = threadContextQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Missing invocationId or callbackToken' };
      }

      const {
        invocationId,
        callbackToken,
        limit,
        threadId: overrideThreadId,
        catId: filterCatId,
        keyword,
      } = parsed.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return EXPIRED_CREDENTIALS_ERROR;
      }

      if (filterCatId && filterCatId !== 'user' && !catRegistry.has(filterCatId)) {
        reply.status(400);
        return { error: `Unknown catId filter: ${filterCatId}` };
      }

      // F-Swarm-6: allow reading a different thread's context
      const effectiveThreadId = overrideThreadId ?? record.threadId;
      const normalizedKeyword = keyword?.toLowerCase();

      const requestedLimit = limit ?? 20;
      let needsPlayFilter = false;
      if (effectiveThreadId && threadStore) {
        const thread = await threadStore.get(effectiveThreadId);
        needsPlayFilter = !!thread && (thread.thinkingMode ?? 'debug') === 'play';
      }

      let filtered: Awaited<ReturnType<typeof messageStore.getByThread>>;

      // F35: Viewer for whisper filtering.
      // Debug mode: cats see everything (like 铲屎官) — full transparency for debugging.
      // Play mode: cats only see whispers addressed to them — game privacy.
      const viewer = needsPlayFilter
        ? { type: 'cat' as const, catId: createCatId(record.catId) }
        : { type: 'user' as const };
      const matchesExtraFilters = (item: Awaited<ReturnType<typeof messageStore.getByThread>>[number]): boolean => {
        if (filterCatId) {
          if (filterCatId === 'user') {
            if (item.catId !== null) return false;
          } else if (item.catId !== filterCatId) {
            return false;
          }
        }
        if (normalizedKeyword && !item.content.toLowerCase().includes(normalizedKeyword)) {
          return false;
        }
        return true;
      };

      if (!needsPlayFilter) {
        // Normal mode: paginate backwards collecting visible messages until we
        // have enough or data is exhausted. This ensures whisper filtering
        // doesn't silently shrink the result set.
        const visible: Awaited<ReturnType<typeof messageStore.getByThread>> = [];
        const pageSize = Math.max(requestedLimit * 2, 50);
        let cursorTimestamp = Number.MAX_SAFE_INTEGER;
        let cursorId: string | undefined;

        while (visible.length < requestedLimit) {
          const batch = effectiveThreadId
            ? await messageStore.getByThreadBefore(effectiveThreadId, cursorTimestamp, pageSize, cursorId, record.userId)
            : await messageStore.getBefore(cursorTimestamp, pageSize, record.userId, cursorId);

          if (batch.length === 0) break;

          for (const item of batch) {
            if (!canViewMessage(item, viewer)) continue;
            if (!matchesExtraFilters(item)) continue;
            visible.push(item);
          }

          const oldest = batch[0]!;
          cursorTimestamp = oldest.timestamp;
          cursorId = oldest.id;
        }

        visible.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
        filtered = visible.slice(-requestedLimit);
      } else {
        // Play mode: paginate backwards collecting visible messages until we have enough
        // or data is exhausted. No fixed page cap — correctness over latency.
        const visible: Awaited<ReturnType<typeof messageStore.getByThread>> = [];
        const pageSize = Math.max(requestedLimit * 2, 50); // fetch in chunks, min 50
        let cursorTimestamp = Number.MAX_SAFE_INTEGER;
        let cursorId: string | undefined;

        while (visible.length < requestedLimit) {
          const batch = effectiveThreadId
            ? await messageStore.getByThreadBefore(effectiveThreadId, cursorTimestamp, pageSize, cursorId, record.userId)
            : await messageStore.getBefore(cursorTimestamp, pageSize, record.userId, cursorId);

          if (batch.length === 0) break; // no more messages

          for (const item of batch) {
            // F35: Skip whispers not intended for this cat
            if (!canViewMessage(item, viewer)) continue;
            // Visible in play mode: user messages, own cat's messages,
            // or other cats' messages that are NOT explicitly stream.
            // Legacy messages (no origin) are treated as visible for backward
            // compatibility — all new writes are tagged, so untagged = legacy callback.
            const isOtherCat = item.catId && item.catId !== record.catId;
            if (!isOtherCat || item.origin !== 'stream') {
              if (!matchesExtraFilters(item)) continue;
              visible.push(item);
            }
          }

          // Move cursor to oldest message in batch (batch is ascending, first is oldest)
          const oldest = batch[0]!;
          cursorTimestamp = oldest.timestamp;
          cursorId = oldest.id;
        }

        // visible is accumulated in reverse-chronological page order but each page is ascending.
        // Re-sort ascending and take newest requestedLimit.
        visible.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
        filtered = visible.slice(-requestedLimit);
      }

      return {
        // TD091: echo threadId so cats know which thread they're in
        threadId: effectiveThreadId,
        messages: filtered.map((item) => ({
          id: item.id,
          userId: item.userId,
          catId: item.catId,
          content: item.content,
          ...(item.contentBlocks ? { contentBlocks: item.contentBlocks } : {}),
          timestamp: item.timestamp,
        })),
      };
    });

    app.get('/api/callbacks/list-threads', async (request, reply) => {
      const parsed = listThreadsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid request query', details: parsed.error.issues };
      }

      const { invocationId, callbackToken, limit, activeSince } = parsed.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return EXPIRED_CREDENTIALS_ERROR;
      }

      if (!threadStore) {
        reply.status(503);
        return { error: 'Thread store not configured' };
      }

      const requestedLimit = limit ?? 20;
      let threads = await threadStore.list(record.userId);
      if (activeSince !== undefined) {
        threads = threads.filter((thread) => thread.lastActiveAt >= activeSince);
      }

      threads.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
      const summaries = threads.slice(0, requestedLimit).map((thread) => ({
        threadId: thread.id,
        ...(thread.title ? { title: thread.title } : {}),
        lastActiveAt: thread.lastActiveAt,
        messageCount: null,
        participants: thread.participants,
      }));

      return { threads: summaries };
    });

    // TD091: PR tracking registration via MCP callback
    // Cats call this after `gh pr create` to register the PR for Layer 1 routing.
    // Server resolves threadId from invocation record — cat doesn't need to know it.
    const registerPrTrackingSchema = callbackAuthSchema.extend({
      repoFullName: z.string().min(1).regex(/^[^/]+\/[^/]+$/, 'Must be owner/repo format'),
      prNumber: z.number().int().positive(),
      catId: z.string().min(1),
    });

    app.post('/api/callbacks/register-pr-tracking', async (request, reply) => {
      if (!prTrackingStore) {
        reply.status(503);
        return { error: 'PR tracking not configured' };
      }

      const parsed = registerPrTrackingSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parsed.error.issues };
      }

      const { invocationId, callbackToken, repoFullName, prNumber, catId } = parsed.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return EXPIRED_CREDENTIALS_ERROR;
      }

      if (!catRegistry.has(catId)) {
        reply.status(400);
        return { error: `Unknown catId: ${catId}` };
      }

      // Cloud Codex P1-2: ownership protection — reject cross-user overwrites
      const existing = await prTrackingStore.get(repoFullName, prNumber);
      if (existing && existing.userId !== record.userId) {
        reply.status(409);
        return { error: `PR ${repoFullName}#${prNumber} already registered by another user` };
      }

      const entry = await prTrackingStore.register({
        repoFullName,
        prNumber,
        catId,
        threadId: record.threadId,
        userId: record.userId,
      });

      return { status: 'ok', threadId: record.threadId, entry };
    });

    // F22: Rich block creation via MCP callback
    app.post('/api/callbacks/create-rich-block', async (request, reply) => {
      // #85 M2b: normalize block before Zod parse (type→kind, auto v:1)
      const rawBody = request.body as Record<string, unknown>;
      if (rawBody && typeof rawBody === 'object' && rawBody['block']) {
        normalizeRichBlock(rawBody['block']);
      }

      const parsed = createRichBlockSchema.safeParse(rawBody);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parsed.error.issues };
      }

      const { invocationId, callbackToken, block } = parsed.data;

      // F34-b P2: audio blocks must have at least url or text (R10: trim whitespace)
      if (block.kind === 'audio' && !block.url?.trim() && !block.text?.trim()) {
        reply.status(400);
        return { error: 'audio block requires url or text' };
      }

      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return EXPIRED_CREDENTIALS_ERROR;
      }

      if (!registry.isLatest(invocationId)) {
        return { status: 'stale_ignored' };
      }

      // F34-b: Resolve voice blocks (audio with text, no url) before buffering
      let resolvedBlock: RichBlock = block as unknown as RichBlock;
      const synthesizer = getVoiceBlockSynthesizer();
      if (synthesizer && block.kind === 'audio' && 'text' in block) {
        const resolved = await synthesizer.resolveVoiceBlocks(
          [block as unknown as RichBlock],
          record.catId as string,
        );
        if (resolved.length > 0) resolvedBlock = resolved[0]!;
      }

      // Buffer the block — consumed at append time in route-serial/route-parallel
      const isNew = getRichBlockBuffer().add(record.threadId, record.catId as string, resolvedBlock, invocationId);

      // Only broadcast new blocks (dedup retries at server to prevent frontend duplicates)
      if (isNew) {
        socketManager.broadcastAgentMessage({
          type: 'system_info' as const,
          catId: record.catId,
          content: JSON.stringify({ type: 'rich_block', block: resolvedBlock }),
          timestamp: Date.now(),
        }, record.threadId);
      }

      return { status: 'ok' };
    });

    if (taskStore) {
      registerCallbackTaskRoutes(app, { registry, taskStore, socketManager });
    }

    const memoryDeps: {
      registry: InvocationRegistry;
      hindsightClient?: IHindsightClient;
      sharedBank?: string;
      freshnessProvider?: () => Promise<P0Freshness>;
      reimportTriggerProvider?: (freshness: P0Freshness) => Promise<{
        status: 'triggered' | 'cooldown' | 'skipped' | 'disabled' | 'failed';
        reason?: string;
        nextAllowedAt?: string;
      }>;
    } = { registry };
    if (opts.hindsightClient) memoryDeps.hindsightClient = opts.hindsightClient;
    if (opts.sharedBank) memoryDeps.sharedBank = opts.sharedBank;
    if (opts.freshnessProvider) memoryDeps.freshnessProvider = opts.freshnessProvider;
    if (opts.reimportTriggerProvider) memoryDeps.reimportTriggerProvider = opts.reimportTriggerProvider;
    await registerCallbackMemoryRoutes(app, memoryDeps);
  };
