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
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { ITaskStore } from '../domains/cats/services/TaskStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';

/**
 * Dependencies injected via Fastify plugin options
 */
export interface CallbackRoutesOptions {
  registry: InvocationRegistry;
  messageStore: IMessageStore;
  socketManager: SocketManager;
  taskStore?: ITaskStore;
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

const updateTaskSchema = z.object({
  invocationId: z.string().min(1),
  callbackToken: z.string().min(1),
  taskId: z.string().min(1),
  status: z.enum(['todo', 'doing', 'blocked', 'done']).optional(),
  why: z.string().max(1000).optional(),
});

export const callbacksRoutes: FastifyPluginAsync<CallbackRoutesOptions> =
  async (app, opts) => {
    const { registry, messageStore, socketManager, taskStore } = opts;

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

      // Store the message (scoped to the invocation's thread)
      await messageStore.append({
        userId: record.userId,
        catId: record.catId,
        content,
        mentions: [],
        timestamp: Date.now(),
        threadId: record.threadId,
      });

      // Broadcast via Socket.io (scoped to thread room)
      socketManager.broadcastAgentMessage({
        type: 'text',
        catId: record.catId,
        content,
        timestamp: Date.now(),
      }, record.threadId);

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

      const mentions = await messageStore.getMentionsFor(record.catId, 20, record.userId);
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

      // Scope to the invocation's thread (not user-level global)
      const messages = record.threadId
        ? await messageStore.getByThread(record.threadId, limit ?? 20, record.userId)
        : await messageStore.getRecent(limit ?? 20, record.userId);
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

    // POST /api/callbacks/update-task
    app.post('/api/callbacks/update-task', async (request, reply) => {
      if (!taskStore) {
        reply.status(501);
        return { error: 'Task store not configured' };
      }

      const parseResult = updateTaskSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parseResult.error.issues };
      }

      const { invocationId, callbackToken, taskId, status, why } = parseResult.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      // Verify the task exists and the cat owns it
      const existing = await taskStore.get(taskId);
      if (!existing) {
        reply.status(404);
        return { error: 'Task not found' };
      }

      if (existing.ownerCatId && existing.ownerCatId !== record.catId) {
        reply.status(403);
        return { error: 'Task is owned by another cat' };
      }

      const updateData: Record<string, unknown> = {};
      if (status) updateData['status'] = status;
      if (why) updateData['why'] = why;

      const updated = await taskStore.update(taskId, updateData);
      if (!updated) {
        reply.status(500);
        return { error: 'Failed to update task' };
      }

      socketManager.broadcastToRoom(
        `thread:${updated.threadId}`,
        'task_updated',
        updated,
      );

      return { status: 'ok', task: updated };
    });
  };
