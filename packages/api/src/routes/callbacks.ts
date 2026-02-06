/**
 * Callback API Routes
 * MCP 回传工具的 HTTP 端点
 *
 * 这些端点由 MCP server（CLI 子进程内）通过 HTTP 调用，
 * 用于猫猫主动发言、获取上下文和感知 @ 提及。
 *
 * 安全: 每个请求都需要 invocationId + callbackToken 验证。
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { InvocationRegistry } from '../domains/cats/services/InvocationRegistry.js';
import type { MessageStore } from '../domains/cats/services/MessageStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';

/**
 * Dependencies injected via Fastify plugin options
 */
export interface CallbackRoutesOptions {
  registry: InvocationRegistry;
  messageStore: MessageStore;
  socketManager: SocketManager;
}

const postMessageSchema = z.object({
  invocationId: z.string().min(1),
  callbackToken: z.string().min(1),
  content: z.string().min(1).max(50000),
  replyTo: z.string().optional(),
});

const authQuerySchema = z.object({
  invocationId: z.string().min(1),
  callbackToken: z.string().min(1),
});

const threadContextQuerySchema = authQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const callbacksRoutes: FastifyPluginAsync<CallbackRoutesOptions> =
  async (app, opts) => {
    const { registry, messageStore, socketManager } = opts;

    // POST /api/callbacks/post-message
    app.post('/api/callbacks/post-message', async (request, reply) => {
      const parseResult = postMessageSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parseResult.error.issues };
      }

      const { invocationId, callbackToken, content, replyTo } = parseResult.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      // Store the message
      messageStore.append({
        userId: record.userId,
        catId: record.catId,
        content,
        mentions: [],
        timestamp: Date.now(),
      });

      // Broadcast via Socket.io
      socketManager.broadcastAgentMessage({
        type: 'text',
        catId: record.catId,
        content,
        timestamp: Date.now(),
      });

      return { status: 'ok', replyTo };
    });

    // GET /api/callbacks/pending-mentions
    app.get('/api/callbacks/pending-mentions', async (request, reply) => {
      const parseResult = authQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Missing invocationId or callbackToken' };
      }

      const { invocationId, callbackToken } = parseResult.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      const mentions = messageStore.getMentionsFor(record.catId, 20);
      return {
        mentions: mentions.map((m) => ({
          id: m.id,
          from: m.catId ?? m.userId,
          message: m.content,
          timestamp: m.timestamp,
        })),
      };
    });

    // GET /api/callbacks/thread-context
    app.get('/api/callbacks/thread-context', async (request, reply) => {
      const parseResult = threadContextQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Missing invocationId or callbackToken' };
      }

      const { invocationId, callbackToken, limit } = parseResult.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      const messages = messageStore.getRecent(limit ?? 20);
      return {
        messages: messages.map((m) => ({
          id: m.id,
          userId: m.userId,
          catId: m.catId,
          content: m.content,
          timestamp: m.timestamp,
        })),
      };
    });
  };
