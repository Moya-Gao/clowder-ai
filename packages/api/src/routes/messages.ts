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
import { getSocketManager } from '../index.js';

/**
 * Dependencies injected via Fastify plugin options
 */
export interface MessagesRoutesOptions {
  registry: InvocationRegistry;
  messageStore: IMessageStore;
  sessionStore?: SessionStore;
}

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

    const socketManager = getSocketManager();

    // Return immediately with processing status
    reply.send({ status: 'processing', timestamp: Date.now() });

    // Process in background and broadcast via WebSocket
    void (async () => {
      try {
        // Use router.route() to handle @ mentions and route to appropriate agents
        for await (const msg of router.route(body.userId, body.content)) {
          socketManager.broadcastAgentMessage(msg);
        }
      } catch (err) {
        console.error('[messages] Background processing error:', err);
        socketManager.broadcastAgentMessage({
          type: 'error',
          catId: createCatId('opus'),
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }
    })();
  });

  // GET /api/messages - 获取历史消息（placeholder）
  app.get('/api/messages', async () => {
    // TODO: Implement message history from file/redis
    return { messages: [], total: 0 };
  });
};
