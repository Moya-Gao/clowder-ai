/**
 * Messages API Routes
 * POST /api/messages - 发送消息 (JSON or multipart with images)
 * GET /api/messages - 获取历史消息
 *
 * IMPORTANT: threadId 约束
 * 生产代码应显式包含 threadId（sendMessageSchema 字段 threadId）。
 * 兼容行为：未传 threadId 时会降级到 'default' thread（历史行为）。
 * 跨线程鉴权、InvocationTracker、消息存储都依赖正确的 threadId。
 * 前端应先确保 thread 存在（POST /api/threads）再发消息。
 *
 * ADR-008 S1: 消息写入与猫调用执行解耦。
 * POST 流程: 原子创建 InvocationRecord → 写入用户消息 → 回填 → reply 202 → background 执行
 */

import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import type { CatId, MessageContent } from '@cat-cafe/shared';
import { getDefaultCatId } from '../config/cat-config-loader.js';
import type { AgentRouter } from '../domains/cats/services/index.js';
import type { InvocationRegistry } from '../domains/cats/services/agents/invocation/InvocationRegistry.js';
import type { IMessageStore } from '../domains/cats/services/stores/ports/MessageStore.js';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { IInvocationRecordStore } from '../domains/cats/services/stores/ports/InvocationRecordStore.js';
import type { PersistenceContext } from '../domains/cats/services/agents/routing/route-helpers.js';
import { mergeTokenUsage, type TokenUsage } from '../domains/cats/services/types.js';
import type { DeliveryCursorStore } from '../domains/cats/services/stores/ports/DeliveryCursorStore.js';
import type { SessionStore } from '@cat-cafe/shared/utils';
import type { SocketManager } from '../infrastructure/websocket/index.js';
import type { InvocationTracker } from '../domains/cats/services/agents/invocation/InvocationTracker.js';
import type { AutoSummarizer } from '../domains/cats/services/orchestration/AutoSummarizer.js';
import type { ISummaryStore } from '../domains/cats/services/stores/ports/SummaryStore.js';
import type { IDraftStore } from '../domains/cats/services/stores/ports/DraftStore.js';
import type { IModeStore } from '../domains/cats/services/stores/ports/ModeStore.js';
import type { ModeOrchestrator } from '../domains/cats/services/orchestration/ModeOrchestrator.js';
import { parseMultipart } from './parse-multipart.js';
import { sendMessageSchema } from './messages.schema.js';
import { resolveUserId } from '../utils/request-identity.js';
import { getPushNotificationService } from '../domains/cats/services/push/PushNotificationService.js';

/**
 * Dependencies injected via Fastify plugin options.
 * socketManager is injected to avoid circular import from index.ts.
 */
export interface MessagesRoutesOptions {
  registry: InvocationRegistry;
  messageStore: IMessageStore;
  socketManager: SocketManager;
  router: AgentRouter;
  sessionStore?: SessionStore;
  deliveryCursorStore?: DeliveryCursorStore;
  threadStore?: IThreadStore;
  uploadDir?: string;
  invocationTracker?: InvocationTracker;
  invocationRecordStore?: IInvocationRecordStore;
  autoSummarizer?: AutoSummarizer;
  summaryStore?: ISummaryStore;
  modeStore?: IModeStore;
  modeOrchestrator?: ModeOrchestrator;
  /** #80: Streaming draft store for F5 recovery */
  draftStore?: IDraftStore;
}

const getMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10000).default(50),
  /** Cursor: "timestamp:id" or legacy plain timestamp */
  before: z.string().optional(),
  threadId: z.string().min(1).max(100).optional(),
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;


export const messagesRoutes: FastifyPluginAsync<MessagesRoutesOptions> =
  async (app, opts) => {
  const uploadDir = opts.uploadDir ?? process.env['UPLOAD_DIR'] ?? './uploads';

  // Register multipart parser for image uploads
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  });

  // Shared AgentRouter injected via opts (created in index.ts)
  const router = opts.router;

  // POST /api/messages - 发送消息（WebSocket 广播）
  app.post('/api/messages', async (request, reply) => {
    let content: string;
    let legacyUserId: string | undefined;
    let threadId: string | undefined;
    let contentBlocks: MessageContent[] | undefined;
    let idempotencyKey: string | undefined;
    // F35: Whisper fields
    let whisperVisibility: 'whisper' | undefined;
    let whisperRecipients: readonly CatId[] | undefined;

    if (request.isMultipart()) {
      // Parse multipart: text fields + image files
      const parsed = await parseMultipart(request, uploadDir);
      if ('error' in parsed) {
        reply.status(400);
        return { error: parsed.error };
      }
      ({ content, userId: legacyUserId, threadId, contentBlocks } = parsed);
      if ('idempotencyKey' in parsed && parsed.idempotencyKey) {
        idempotencyKey = parsed.idempotencyKey;
      }
      // F35: Extract whisper fields from multipart
      if (parsed.visibility === 'whisper' && parsed.whisperTo) {
        whisperVisibility = 'whisper';
        whisperRecipients = parsed.whisperTo as CatId[];
      }
    } else {
      // JSON mode (backwards compatible)
      const parseResult = sendMessageSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parseResult.error.issues };
      }
      ({ content, userId: legacyUserId, threadId, idempotencyKey } = parseResult.data);
      // F35: Extract whisper fields from parsed body
      if (parseResult.data.visibility === 'whisper') {
        whisperVisibility = 'whisper';
        whisperRecipients = parseResult.data.whisperTo as CatId[] | undefined;
      }
    }

    const userId = resolveUserId(request, {
      fallbackUserId: legacyUserId,
      defaultUserId: 'default-user',
    });
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

    // Default to 'default' thread for lobby (prevents global broadcast)
    const resolvedThreadId = threadId ?? 'default';

    // Ensure thread exists and auto-title on first message
    if (resolvedThreadId !== 'default' && opts.threadStore) {
      const thread = await opts.threadStore.get(resolvedThreadId);

      if (!thread) {
        // Thread doesn't exist — reject to prevent orphaned messages (#21)
        reply.status(400);
        return {
          error: '对话不存在',
          detail: '请先创建对话后再发送消息。如果对话已被删除，请新建一个。',
          code: 'THREAD_NOT_FOUND',
        };
      } else if (thread.title === null) {
        // Auto-title existing untitled thread
        const autoTitle = content.length > 30
          ? content.slice(0, 30) + '...'
          : content;
        await opts.threadStore.updateTitle(resolvedThreadId, autoTitle);
        opts.socketManager.broadcastToRoom(
          `thread:${resolvedThreadId}`,
          'thread_updated',
          { threadId: resolvedThreadId, title: autoTitle },
        );
      }
    }

    // Delete guard check (read-only, no side effects — safe before idempotency check)
    if (opts.invocationTracker?.isDeleting(resolvedThreadId)) {
      reply.status(409);
      return {
        error: '对话正在删除中',
        detail: '请稍后重试，或新建一个对话继续',
        code: 'THREAD_DELETING',
      };
    }

    // ADR-008 S1: Pre-resolve targets + intent, persisting @mentions as participants
    const { targetCats: resolvedTargetCats, intent } = await router.resolveTargetsAndIntent(
      content, resolvedThreadId, { persist: true },
    );
    // F35: When sending a whisper, override routing targets to only whisperTo recipients.
    // This prevents non-recipient cats from being invoked and seeing whisper content.
    const targetCats = (whisperVisibility === 'whisper' && whisperRecipients?.length)
      ? [...new Set(whisperRecipients)]
      : [...resolvedTargetCats];

    // Server-generated idempotency key if client didn't provide one
    const resolvedIdempotencyKey = idempotencyKey ?? randomUUID();

    // ① Atomic create InvocationRecord (Lua in Redis, sync Map in memory)
    if (opts.invocationRecordStore) {
      const createResult = await opts.invocationRecordStore.create({
        threadId: resolvedThreadId,
        userId,
        targetCats,
        intent: intent.intent,
        idempotencyKey: resolvedIdempotencyKey,
      });

      if (createResult.outcome === 'duplicate') {
        // Deduplicated — no start(), no abort, just return existing ID
        reply.status(200);
        return { status: 'duplicate', invocationId: createResult.invocationId };
      }

      // Not duplicate → safe to start() (may abort prior invocation for this thread)
      const controller = opts.invocationTracker?.start(resolvedThreadId, userId, targetCats);

      // Race: thread entered deleting between isDeleting() and start()
      if (controller?.signal.aborted) {
        await opts.invocationRecordStore.update(createResult.invocationId, {
          status: 'canceled',
        });
        reply.status(409);
        return {
          error: '对话正在删除中',
          detail: '请稍后重试，或新建一个对话继续',
          code: 'THREAD_DELETING',
        };
      }

      // ② Write user message (decoupled from cat execution)
      const storedUserMessage = await opts.messageStore.append({
        userId,
        catId: null,
        content,
        mentions: targetCats,
        timestamp: Date.now(),
        threadId: resolvedThreadId,
        ...(contentBlocks ? { contentBlocks } : {}),
        ...(whisperVisibility && whisperRecipients ? { visibility: whisperVisibility, whisperTo: whisperRecipients } : {}),
      });

      // ③ Backfill InvocationRecord.userMessageId
      await opts.invocationRecordStore.update(createResult.invocationId, {
        userMessageId: storedUserMessage.id,
      });

      // ④ Reply with invocationId
      reply.send({
        status: 'processing',
        invocationId: createResult.invocationId,
        timestamp: Date.now(),
      });

      // ⑤ Background: execute cat invocation via routeExecution
      void (async () => {
        const HEARTBEAT_INTERVAL_MS = 30_000;
        const heartbeatInterval = setInterval(() => {
          opts.socketManager.broadcastToRoom(
            `thread:${resolvedThreadId}`,
            'heartbeat',
            { threadId: resolvedThreadId, timestamp: Date.now() },
          );
        }, HEARTBEAT_INTERVAL_MS);

        try {
          await opts.invocationRecordStore!.update(createResult.invocationId, {
            status: 'running',
          });

          opts.socketManager.broadcastToRoom(
            `thread:${resolvedThreadId}`,
            'intent_mode',
            { threadId: resolvedThreadId, mode: intent.intent, targetCats },
          );

          // ADR-008 S3: collect cursor boundaries; ack only after succeeded
          const cursorBoundaries = new Map<string, string>();
          // P1-2: track persistence failures across generator boundary
          const persistenceContext: PersistenceContext = { failed: false, errors: [] };
          // F8: collect per-cat token usage from done events
          const collectedUsage = new Map<string, TokenUsage>();

          // F11: active mode → ModeOrchestrator, otherwise → AgentRouter
          // F35: Whisper messages bypass mode orchestrator — mode uses its own
          // participants which would leak whisper content to non-recipients.
          const activeMode = whisperVisibility !== 'whisper'
            ? await opts.modeStore?.getMode(resolvedThreadId)
            : undefined;
          if (activeMode && opts.modeOrchestrator) {
            for await (const msg of opts.modeOrchestrator.execute({
              strategyDeps: router.getStrategyDeps(),
              message: content,
              userId,
              threadId: resolvedThreadId,
              userMessageId: storedUserMessage.id,
              routeOptions: {
                ...(contentBlocks ? { contentBlocks } : {}),
                uploadDir,
                ...(controller?.signal ? { signal: controller.signal } : {}),
                cursorBoundaries,
                persistenceContext,
              },
            })) {
              if (msg.type === 'done' && msg.catId && msg.metadata?.usage) {
                collectedUsage.set(msg.catId, mergeTokenUsage(collectedUsage.get(msg.catId), msg.metadata.usage));
              }
              opts.socketManager.broadcastAgentMessage(msg, resolvedThreadId);
            }
          } else {
            for await (const msg of router.routeExecution(
              userId, content, resolvedThreadId, storedUserMessage.id,
              targetCats, intent,
              {
                ...(contentBlocks ? { contentBlocks } : {}),
                uploadDir,
                ...(controller?.signal ? { signal: controller.signal } : {}),
                cursorBoundaries,
                persistenceContext,
              },
            )) {
              if (msg.type === 'done' && msg.catId && msg.metadata?.usage) {
                collectedUsage.set(msg.catId, mergeTokenUsage(collectedUsage.get(msg.catId), msg.metadata.usage));
              }
              opts.socketManager.broadcastAgentMessage(msg, resolvedThreadId);
            }
          }

          // P1-2: mark failed if any message persistence failed
          if (persistenceContext.failed) {
            const errorDetail = persistenceContext.errors
              .map(e => `${e.catId}: ${e.error}`)
              .join('; ');
            await opts.invocationRecordStore!.update(createResult.invocationId, {
              status: 'failed',
              error: `Message delivered but persistence failed: ${errorDetail}`,
            });
            opts.socketManager.broadcastAgentMessage({
              type: 'error',
              catId: getDefaultCatId(),
              error: '消息已发送但未能保存，刷新后可能丢失。可点击重试。',
              timestamp: Date.now(),
            }, resolvedThreadId);

            const pushSvcErr = getPushNotificationService();
            if (pushSvcErr) {
              pushSvcErr.notifyUser(userId, {
                title: '猫猫消息保存失败',
                body: '消息已发送但未能保存，请检查',
                tag: `cat-error-${resolvedThreadId}`,
                data: { threadId: resolvedThreadId, url: `/?thread=${resolvedThreadId}` },
              }).catch(() => {});
            }
          } else {
            // ADR-008 S3: ack cursors before marking succeeded so that if ack
            // throws, the catch block sees running→failed (valid transition).
            await router.ackCollectedCursors(userId, resolvedThreadId, cursorBoundaries);

            await opts.invocationRecordStore!.update(createResult.invocationId, {
              status: 'succeeded',
              ...(collectedUsage.size > 0 ? {
                usageByCat: Object.fromEntries(collectedUsage),
              } : {}),
            });

            // Push notification: cat(s) finished responding
            const pushSvc = getPushNotificationService();
            if (pushSvc) {
              const catNames = targetCats.join(', ');
              pushSvc.notifyUser(userId, {
                title: `${catNames} 回复了`,
                body: content.slice(0, 80),
                icon: targetCats.length === 1 ? `/avatars/${targetCats[0]}.png` : '/icons/icon-192x192.png',
                tag: `cat-reply-${resolvedThreadId}`,
                data: { threadId: resolvedThreadId, url: `/?thread=${resolvedThreadId}` },
              }).catch(() => { /* best-effort */ });
            }

            // Fire-and-forget: auto-summarize if threshold met (only on success)
            if (opts.autoSummarizer) {
              opts.autoSummarizer.maybeSummarize(resolvedThreadId).then((summary) => {
                if (summary) {
                  opts.socketManager.broadcastToRoom(
                    `thread:${resolvedThreadId}`,
                    'thread_summary',
                    summary,
                  );
                }
              }).catch(() => { /* ignore */ });
            }
          }
        } catch (err) {
          console.error('[messages] Background processing error:', err);
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          await opts.invocationRecordStore!.update(createResult.invocationId, {
            status: 'failed',
            error: errorMsg,
          });
          opts.socketManager.broadcastAgentMessage({
            type: 'error',
            catId: getDefaultCatId(),
            error: errorMsg,
            isFinal: true,
            timestamp: Date.now(),
          }, resolvedThreadId);

          const pushSvcCatch = getPushNotificationService();
          if (pushSvcCatch) {
            pushSvcCatch.notifyUser(userId, {
              title: '猫猫出错了',
              body: errorMsg.slice(0, 100),
              tag: `cat-error-${resolvedThreadId}`,
              data: { threadId: resolvedThreadId, url: `/?thread=${resolvedThreadId}` },
            }).catch(() => {});
          }
        } finally {
          clearInterval(heartbeatInterval);
          opts.invocationTracker?.complete(resolvedThreadId, controller);
        }
      })();
    } else {
      // Fallback: no invocationRecordStore (legacy path, uses route())
      const controller = opts.invocationTracker?.start(resolvedThreadId, userId, targetCats);
      if (controller?.signal.aborted) {
        reply.status(409);
        return {
          error: '对话正在删除中',
          detail: '请稍后重试，或新建一个对话继续',
          code: 'THREAD_DELETING',
        };
      }

      reply.send({ status: 'processing', timestamp: Date.now() });

      void (async () => {
        const HEARTBEAT_INTERVAL_MS = 30_000;
        const heartbeatInterval = setInterval(() => {
          opts.socketManager.broadcastToRoom(
            `thread:${resolvedThreadId}`,
            'heartbeat',
            { threadId: resolvedThreadId, timestamp: Date.now() },
          );
        }, HEARTBEAT_INTERVAL_MS);

        try {
          opts.socketManager.broadcastToRoom(
            `thread:${resolvedThreadId}`,
            'intent_mode',
            { threadId: resolvedThreadId, mode: intent.intent, targetCats },
          );

          for await (const msg of router.route(userId, content, resolvedThreadId, contentBlocks, uploadDir, controller?.signal)) {
            opts.socketManager.broadcastAgentMessage(msg, resolvedThreadId);
          }
        } catch (err) {
          console.error('[messages] Background processing error:', err);
          opts.socketManager.broadcastAgentMessage({
            type: 'error',
            catId: getDefaultCatId(),
            error: err instanceof Error ? err.message : 'Unknown error',
            isFinal: true,
            timestamp: Date.now(),
          }, resolvedThreadId);
        } finally {
          clearInterval(heartbeatInterval);
          opts.invocationTracker?.complete(resolvedThreadId, controller);
        }
      })();
    }
  });

  // GET /api/messages - 获取历史消息
  app.get('/api/messages', async (request) => {
    const parseResult = getMessagesSchema.safeParse(request.query);
    if (!parseResult.success) {
      return { messages: [], hasMore: false };
    }
    const { limit, before, threadId } = parseResult.data;
    const userId = resolveUserId(request, { defaultUserId: 'default-user' });
    if (!userId) {
      return { messages: [], hasMore: false };
    }

    // Parse composite cursor "timestamp:id" or legacy plain timestamp
    let beforeTs: number | undefined;
    let beforeId: string | undefined;
    if (before) {
      const colonIdx = before.indexOf(':');
      if (colonIdx > 0) {
        beforeTs = parseInt(before.slice(0, colonIdx), 10);
        beforeId = before.slice(colonIdx + 1);
      } else {
        beforeTs = parseInt(before, 10);
      }
      if (!Number.isFinite(beforeTs!)) {
        return { messages: [], hasMore: false };
      }
    }

    // Always thread-scoped — default to 'default' thread for lobby
    const resolvedThreadId = threadId ?? 'default';
    const messages = beforeTs != null
      ? await opts.messageStore.getByThreadBefore(resolvedThreadId, beforeTs, limit + 1, beforeId, userId)
      : await opts.messageStore.getByThread(resolvedThreadId, limit + 1, userId);

    // Fetch limit+1 to determine hasMore; drop oldest (first) probe item
    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(1) : messages;

    // Map chat messages (union type allows summary items to be pushed later)
    type TimelineItem = {
      id: string;
      type: 'user' | 'assistant' | 'summary';
      catId: string | null;
      content: string;
      timestamp: number;
      summary?: { id: string; topic: string; conclusions: string[]; openQuestions: string[]; createdBy: string };
      [key: string]: unknown;
    };
    const chatItems: TimelineItem[] = page.map((m) => ({
      id: m.id,
      type: (m.catId ? 'assistant' : 'user') as 'user' | 'assistant',
      catId: m.catId,
      content: m.content,
      ...(m.contentBlocks ? { contentBlocks: m.contentBlocks } : {}),
      ...(m.toolEvents ? { toolEvents: m.toolEvents } : {}),
      ...(m.metadata ? { metadata: m.metadata } : {}),
      ...(m.origin ? { origin: m.origin } : {}),
      ...(m.extra?.rich ? { extra: { rich: m.extra.rich } } : {}),
      ...(m.visibility ? { visibility: m.visibility } : {}),
      ...(m.whisperTo ? { whisperTo: m.whisperTo } : {}),
      ...(m.revealedAt ? { revealedAt: m.revealedAt } : {}),
      timestamp: m.timestamp,
    }));

    // #80: Merge active streaming drafts (first page only — no before cursor)
    if (!before && opts.draftStore) {
      const drafts = await opts.draftStore.getByThread(userId, resolvedThreadId);
      // #80 fix-B diagnostic: trace draft merge for F5 recovery verification
      if (drafts.length > 0) {
        request.log.info({ threadId: resolvedThreadId, draftCount: drafts.length, draftIds: drafts.map(d => d.invocationId) }, '#80 draft merge: found active drafts');
        // P1-2 dedup: filter out drafts whose invocationId matches a formal message.
        // Build invocationId set from current page first (fast path).
        const formalInvocationIds = new Set(
          page
            .map(m => m.extra?.stream?.invocationId)
            .filter((id): id is string => !!id)
        );
        let activeDrafts = drafts.filter(d => !formalInvocationIds.has(d.invocationId));
        // Cloud R4 P2: if drafts survive page-level dedup, widen the check to cover
        // formal messages pushed off the first page (race window: TTL > page depth).
        // Cloud R5 P2: wider window must always exceed page limit (limit max=200 → worst case 800).
        if (activeDrafts.length > 0 && page.length >= limit) {
          const widerLimit = Math.max(200, limit * 4);
          const wider = await opts.messageStore.getByThread(resolvedThreadId, widerLimit, userId);
          for (const m of wider) {
            const invId = m.extra?.stream?.invocationId;
            if (invId) formalInvocationIds.add(invId);
          }
          activeDrafts = activeDrafts.filter(d => !formalInvocationIds.has(d.invocationId));
        }
        // P2: stable sort by updatedAt for parallel multi-cat drafts
        activeDrafts.sort((a, b) => a.updatedAt - b.updatedAt);
        if (activeDrafts.length > 0) {
          request.log.info({ threadId: resolvedThreadId, mergedCount: activeDrafts.length, cats: activeDrafts.map(d => d.catId) }, '#80 draft merge: merging drafts into response');
        }
        for (const d of activeDrafts) {
          chatItems.push({
            id: `draft-${d.invocationId}`,
            type: 'assistant',
            catId: d.catId as string | null,
            content: d.content,
            timestamp: d.updatedAt,
            isDraft: true,
            ...(d.toolEvents ? { toolEvents: d.toolEvents } : {}),
          });
        }
      }
    }

    // P1-B fix: merge summaries into history timeline
    // First page (no cursor): include summaries >= oldest message (no max cap,
    //   so summaries created *after* the newest message are still included).
    // Pagination (before cursor): include summaries >= oldest message AND < beforeTs.
    if (opts.summaryStore) {
      const summaries = await opts.summaryStore.listByThread(resolvedThreadId);
      const minTs = page.length > 0 ? page[0]!.timestamp : null;
      for (const s of summaries) {
        if (minTs !== null && s.createdAt < minTs) continue;
        if (beforeTs != null && s.createdAt >= beforeTs) continue;
        chatItems.push({
          id: `summary-${s.id}`,
          type: 'summary',
          catId: null,
          content: s.topic,
          timestamp: s.createdAt,
          summary: { id: s.id, topic: s.topic, conclusions: [...s.conclusions], openQuestions: [...s.openQuestions], createdBy: s.createdBy },
        });
      }
      chatItems.sort((a, b) => a.timestamp - b.timestamp);
    }

    return {
      messages: chatItems,
      hasMore,
    };
  });
};
