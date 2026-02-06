/**
 * Messages API Routes
 * POST /api/messages - 发送消息
 * GET /api/messages - 获取历史消息
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createCatId } from '@cat-cafe/shared';
import {
  ClaudeAgentService,
  CodexAgentService,
  GeminiAgentService,
  AgentRouter,
} from '../domains/cats/services/index.js';
import type { InvocationRegistry } from '../domains/cats/services/InvocationRegistry.js';
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { SessionStore } from '@cat-cafe/shared/utils';
import type { SocketManager } from '../infrastructure/websocket/index.js';

/**
 * Dependencies injected via Fastify plugin options.
 * socketManager is injected to avoid circular import from index.ts.
 */
export interface MessagesRoutesOptions {
  registry: InvocationRegistry;
  messageStore: IMessageStore;
  socketManager: SocketManager;
  sessionStore?: SessionStore;
}

const getMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Cursor: "timestamp:id" or legacy plain timestamp */
  before: z.string().optional(),
  userId: z.string().min(1).max(100).default('default-user'),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  userId: z.string().min(1).max(100).default('default-user'),
  mentions: z.array(z.enum(['opus', 'codex', 'gemini'])).optional(),
});

export const messagesRoutes: FastifyPluginAsync<MessagesRoutesOptions> =
  async (app, opts) => {
  // Create agent router with all three services
  const router = new AgentRouter({
    claudeService: new ClaudeAgentService(),
    codexService: new CodexAgentService(),
    geminiService: new GeminiAgentService(),
    registry: opts.registry,
    messageStore: opts.messageStore,
    ...(opts.sessionStore ? { sessionStore: opts.sessionStore } : {}),
  });

  // POST /api/messages - 发送消息（WebSocket 广播）
  app.post('/api/messages', async (request, reply) => {
    // Validate request body
    const parseResult = sendMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }
    const body = parseResult.data;

    // Return immediately with processing status
    reply.send({ status: 'processing', timestamp: Date.now() });

    // Process in background and broadcast via WebSocket
    void (async () => {
      try {
        // Use router.route() to handle @ mentions and route to appropriate agents
        for await (const msg of router.route(body.userId, body.content)) {
          opts.socketManager.broadcastAgentMessage(msg);
        }
      } catch (err) {
        console.error('[messages] Background processing error:', err);
        opts.socketManager.broadcastAgentMessage({
          type: 'error',
          catId: createCatId('opus'),
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }
    })();
  });

  // GET /api/messages - 获取历史消息
  app.get('/api/messages', async (request) => {
    const parseResult = getMessagesSchema.safeParse(request.query);
    if (!parseResult.success) {
      return { messages: [], hasMore: false };
    }
    const { limit, before, userId } = parseResult.data;

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

    const messages = beforeTs != null
      ? await opts.messageStore.getBefore(beforeTs, limit + 1, userId, beforeId)
      : await opts.messageStore.getRecent(limit + 1, userId);

    // Fetch limit+1 to determine hasMore; drop oldest (first) probe item
    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(1) : messages;

    return {
      messages: page.map((m) => ({
        id: m.id,
        type: m.catId ? 'assistant' : 'user',
        catId: m.catId,
        content: m.content,
        timestamp: m.timestamp,
      })),
      hasMore,
    };
  });
};
