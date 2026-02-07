/**
 * Messages API Routes
 * POST /api/messages - 发送消息 (JSON or multipart with images)
 * GET /api/messages - 获取历史消息
 */

import type { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { createCatId } from '@cat-cafe/shared';
import type { MessageContent } from '@cat-cafe/shared';
import {
  ClaudeAgentService,
  CodexAgentService,
  GeminiAgentService,
  AgentRouter,
} from '../domains/cats/services/index.js';
import type { InvocationRegistry } from '../domains/cats/services/InvocationRegistry.js';
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { IThreadStore } from '../domains/cats/services/ThreadStore.js';
import type { SessionStore } from '@cat-cafe/shared/utils';
import type { SocketManager } from '../infrastructure/websocket/index.js';
import type { InvocationTracker } from '../domains/cats/services/InvocationTracker.js';
import { parseMultipart } from './parse-multipart.js';
import { sendMessageSchema } from './messages.schema.js';

/**
 * Dependencies injected via Fastify plugin options.
 * socketManager is injected to avoid circular import from index.ts.
 */
export interface MessagesRoutesOptions {
  registry: InvocationRegistry;
  messageStore: IMessageStore;
  socketManager: SocketManager;
  sessionStore?: SessionStore;
  threadStore?: IThreadStore;
  uploadDir?: string;
  invocationTracker?: InvocationTracker;
}

const getMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Cursor: "timestamp:id" or legacy plain timestamp */
  before: z.string().optional(),
  userId: z.string().min(1).max(100).default('default-user'),
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

  // Create agent router with all three services
  const router = new AgentRouter({
    claudeService: new ClaudeAgentService(),
    codexService: new CodexAgentService(),
    geminiService: new GeminiAgentService(),
    registry: opts.registry,
    messageStore: opts.messageStore,
    ...(opts.sessionStore ? { sessionStore: opts.sessionStore } : {}),
    ...(opts.threadStore ? { threadStore: opts.threadStore } : {}),
  });

  // POST /api/messages - 发送消息（WebSocket 广播）
  app.post('/api/messages', async (request, reply) => {
    let content: string;
    let userId: string;
    let threadId: string | undefined;
    let contentBlocks: MessageContent[] | undefined;

    if (request.isMultipart()) {
      // Parse multipart: text fields + image files
      const parsed = await parseMultipart(request, uploadDir);
      if ('error' in parsed) {
        reply.status(400);
        return { error: parsed.error };
      }
      ({ content, userId, threadId, contentBlocks } = parsed);
    } else {
      // JSON mode (backwards compatible)
      const parseResult = sendMessageSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parseResult.error.issues };
      }
      ({ content, userId, threadId } = parseResult.data);
    }

    // Default to 'default' thread for lobby (prevents global broadcast)
    const resolvedThreadId = threadId ?? 'default';

    // Ensure thread exists and auto-title on first message
    if (resolvedThreadId !== 'default' && opts.threadStore) {
      const thread = await opts.threadStore.get(resolvedThreadId);

      if (!thread) {
        // Thread doesn't exist — messages will be orphaned!
        // Frontend should always call POST /api/threads first.
        // TODO: Add createWithId() to ThreadStore for proper fix.
        console.warn(
          `[messages] Thread ${resolvedThreadId} not found. Messages will be orphaned. ` +
          `Frontend should call POST /api/threads before sending messages.`,
        );
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

    reply.send({ status: 'processing', timestamp: Date.now() });

    // Process in background and broadcast via WebSocket
    const controller = opts.invocationTracker?.start(resolvedThreadId, userId);
    void (async () => {
      try {
        // Pre-resolve intent so frontend can show IdeateHeader immediately
        const { targetCats, intent } = await router.resolveTargetsAndIntent(
          content, resolvedThreadId,
        );
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
          catId: createCatId('opus'),
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        }, resolvedThreadId);
      } finally {
        opts.invocationTracker?.complete(resolvedThreadId, controller);
      }
    })();
  });

  // GET /api/messages - 获取历史消息
  app.get('/api/messages', async (request) => {
    const parseResult = getMessagesSchema.safeParse(request.query);
    if (!parseResult.success) {
      return { messages: [], hasMore: false };
    }
    const { limit, before, userId, threadId } = parseResult.data;

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

    return {
      messages: page.map((m) => ({
        id: m.id,
        type: m.catId ? 'assistant' : 'user',
        catId: m.catId,
        content: m.content,
        ...(m.contentBlocks ? { contentBlocks: m.contentBlocks } : {}),
        ...(m.metadata ? { metadata: m.metadata } : {}),
        timestamp: m.timestamp,
      })),
      hasMore,
    };
  });
};

