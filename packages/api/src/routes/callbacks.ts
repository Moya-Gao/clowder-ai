/**
 * Callback API Routes — MCP 回传端点
 * 安全: 每个请求都需要 invocationId + callbackToken 验证。
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { InvocationRegistry } from '../domains/cats/services/InvocationRegistry.js';
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { ITaskStore } from '../domains/cats/services/TaskStore.js';
import type { IHindsightClient } from '../domains/cats/services/HindsightClient.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';
import { registerCallbackMemoryRoutes } from './callback-memory-routes.js';

export interface CallbackRoutesOptions {
  registry: InvocationRegistry;
  messageStore: IMessageStore;
  socketManager: SocketManager;
  taskStore?: ITaskStore;
  hindsightClient?: IHindsightClient;
  sharedBank?: string;
}

const postMessageSchema = z.object({
  invocationId: z.string().min(1),
  callbackToken: z.string().min(1),
  content: z.string().min(1).max(50000),
  replyTo: z.string().optional(),
  clientMessageId: z.string().min(1).max(200).optional(),
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
        return { error: 'Invalid or expired callback credentials' };
      }

      // At-least-once de-duplication: retries with same clientMessageId are treated as duplicate.
      if (clientMessageId) {
        const isFirstSeen = registry.claimClientMessageId(invocationId, clientMessageId);
        if (!isFirstSeen) {
          return { status: 'duplicate', replyTo, clientMessageId };
        }
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

      socketManager.broadcastAgentMessage({
        type: 'text',
        catId: record.catId,
        content,
        timestamp: Date.now(),
      }, record.threadId);

      return { status: 'ok', replyTo, ...(clientMessageId ? { clientMessageId } : {}) };
    });

    app.get('/api/callbacks/pending-mentions', async (request, reply) => {
      const parsed = authQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Missing invocationId or callbackToken' };
      }

      const { invocationId, callbackToken } = parsed.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      const mentions = await messageStore.getMentionsFor(record.catId, 20, record.userId);
      return {
        mentions: mentions.map((item) => ({
          id: item.id,
          from: item.catId ?? item.userId,
          message: item.content,
          timestamp: item.timestamp,
        })),
      };
    });

    app.get('/api/callbacks/thread-context', async (request, reply) => {
      const parsed = threadContextQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Missing invocationId or callbackToken' };
      }

      const { invocationId, callbackToken, limit } = parsed.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      const messages = record.threadId
        ? await messageStore.getByThread(record.threadId, limit ?? 20, record.userId)
        : await messageStore.getRecent(limit ?? 20, record.userId);

      return {
        messages: messages.map((item) => ({
          id: item.id,
          userId: item.userId,
          catId: item.catId,
          content: item.content,
          timestamp: item.timestamp,
        })),
      };
    });

    app.post('/api/callbacks/update-task', async (request, reply) => {
      if (!taskStore) {
        reply.status(501);
        return { error: 'Task store not configured' };
      }

      const parsed = updateTaskSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parsed.error.issues };
      }

      const { invocationId, callbackToken, taskId, status, why } = parsed.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      const existing = await taskStore.get(taskId);
      if (!existing) {
        reply.status(404);
        return { error: 'Task not found' };
      }
      if (existing.threadId !== record.threadId) {
        reply.status(403);
        return { error: 'Task belongs to a different thread' };
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

      socketManager.broadcastToRoom(`thread:${updated.threadId}`, 'task_updated', updated);
      return { status: 'ok', task: updated };
    });

    const memoryDeps: {
      registry: InvocationRegistry;
      hindsightClient?: IHindsightClient;
      sharedBank?: string;
    } = { registry };
    if (opts.hindsightClient) memoryDeps.hindsightClient = opts.hindsightClient;
    if (opts.sharedBank) memoryDeps.sharedBank = opts.sharedBank;
    await registerCallbackMemoryRoutes(app, memoryDeps);
  };
