/**
 * Callback API Routes — MCP 回传端点
 * 安全: 每个请求都需要 invocationId + callbackToken 验证。
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { InvocationRegistry } from '../domains/cats/services/InvocationRegistry.js';
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { ITaskStore } from '../domains/cats/services/TaskStore.js';
import type { IHindsightClient, HindsightMemory } from '../domains/cats/services/HindsightClient.js';
import { HindsightError } from '../domains/cats/services/HindsightClient.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';

/**
 * Dependencies injected via Fastify plugin options
 */
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

const searchEvidenceQuerySchema = authQuerySchema.extend({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  budget: z.enum(['low', 'mid', 'high']).default('mid'),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  tagsMatch: z.enum(['any', 'all', 'any_strict', 'all_strict']).default('all_strict'),
});

const reflectSchema = z.object({
  invocationId: z.string().min(1),
  callbackToken: z.string().min(1),
  query: z.string().trim().min(1),
});

const retainMemorySchema = z.object({
  invocationId: z.string().min(1),
  callbackToken: z.string().min(1),
  content: z.string().trim().min(1).max(50000),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  metadata: z.record(z.string()).optional(),
});

function normalizeTags(input: string | string[] | undefined): string[] {
  const rawValues = input == null ? ['project:cat-cafe'] : (Array.isArray(input) ? input : [input]);
  const tags = rawValues
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return tags.length > 0 ? tags : ['project:cat-cafe'];
}

type EvidenceSourceType = 'decision' | 'phase' | 'discussion' | 'commit';
type EvidenceConfidence = 'high' | 'mid' | 'low';

function classifySource(path: string): EvidenceSourceType {
  if (path.includes('decisions')) return 'decision';
  if (path.includes('phases')) return 'phase';
  if (path.includes('discussions')) return 'discussion';
  return 'commit';
}

function memoryToResult(mem: HindsightMemory): {
  title: string;
  anchor: string;
  snippet: string;
  confidence: EvidenceConfidence;
  sourceType: EvidenceSourceType;
} {
  const anchor = mem.metadata?.['anchor'] ?? '';
  return {
    title: mem.content.slice(0, 120),
    anchor,
    snippet: mem.content.slice(0, 300),
    confidence: (mem.score ?? 0) > 0.8 ? 'high' : (mem.score ?? 0) > 0.5 ? 'mid' : 'low',
    sourceType: classifySource(anchor),
  };
}

function shouldDegrade(err: unknown): boolean {
  if (err instanceof HindsightError) {
    if (err.code === 'CONNECTION_FAILED' || err.code === 'TIMEOUT') return true;
    if (err.statusCode != null && err.statusCode >= 500) return true;
    return false;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('network') ||
      msg.includes('fetch failed')
    );
  }

  return false;
}

export const callbacksRoutes: FastifyPluginAsync<CallbackRoutesOptions> =
  async (app, opts) => {
    const { registry, messageStore, socketManager, taskStore, hindsightClient } = opts;
    const sharedBank = opts.sharedBank ?? 'cat-cafe-shared';

    // POST /api/callbacks/post-message
    app.post('/api/callbacks/post-message', async (request, reply) => {
      const parseResult = postMessageSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parseResult.error.issues };
      }

      const { invocationId, callbackToken, content, replyTo, clientMessageId } = parseResult.data;
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

      // Broadcast via Socket.io (scoped to thread room)
      socketManager.broadcastAgentMessage({
        type: 'text',
        catId: record.catId,
        content,
        timestamp: Date.now(),
      }, record.threadId);

      return { status: 'ok', replyTo, ...(clientMessageId ? { clientMessageId } : {}) };
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

      // Verify the task exists, belongs to same thread, and the cat owns it
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

      socketManager.broadcastToRoom(
        `thread:${updated.threadId}`,
        'task_updated',
        updated,
      );

      return { status: 'ok', task: updated };
    });

    // GET /api/callbacks/search-evidence
    app.get('/api/callbacks/search-evidence', async (request, reply) => {
      if (!hindsightClient) {
        reply.status(501);
        return { error: 'Hindsight client not configured' };
      }

      const parseResult = searchEvidenceQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid query parameters', details: parseResult.error.issues };
      }

      const { invocationId, callbackToken, q, limit, budget, tags, tagsMatch } = parseResult.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      const resolvedTags = normalizeTags(tags);
      try {
        const memories = await hindsightClient.recall(sharedBank, q, {
          limit,
          budget,
          tags: resolvedTags,
          tagsMatch,
        });
        return { results: memories.map(memoryToResult), degraded: false };
      } catch (err) {
        if (shouldDegrade(err)) {
          return { results: [], degraded: true, degradeReason: 'hindsight_unavailable' };
        }
        reply.status(502);
        return { error: 'Evidence search unavailable', degraded: false };
      }
    });

    // POST /api/callbacks/reflect
    app.post('/api/callbacks/reflect', async (request, reply) => {
      if (!hindsightClient) {
        reply.status(501);
        return { error: 'Hindsight client not configured' };
      }

      const parseResult = reflectSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parseResult.error.issues };
      }

      const { invocationId, callbackToken, query } = parseResult.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      try {
        const reflection = await hindsightClient.reflect(sharedBank, query);
        return { reflection, degraded: false };
      } catch (err) {
        if (shouldDegrade(err)) {
          return { reflection: '', degraded: true, degradeReason: 'hindsight_unavailable' };
        }
        reply.status(502);
        return { error: 'Reflect unavailable', degraded: false };
      }
    });

    // POST /api/callbacks/retain-memory
    app.post('/api/callbacks/retain-memory', async (request, reply) => {
      if (!hindsightClient) {
        reply.status(501);
        return { error: 'Hindsight client not configured' };
      }

      const parseResult = retainMemorySchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parseResult.error.issues };
      }

      const { invocationId, callbackToken, content, tags, metadata } = parseResult.data;
      const record = registry.verify(invocationId, callbackToken);
      if (!record) {
        reply.status(401);
        return { error: 'Invalid or expired callback credentials' };
      }

      const mergedMetadata: Record<string, string> = {
        source: 'callback',
        invocationId,
        userId: record.userId,
        catId: record.catId,
        threadId: record.threadId,
        ...(metadata ?? {}),
      };
      const resolvedTags = normalizeTags(tags);

      try {
        await hindsightClient.retain(sharedBank, [
          {
            content,
            tags: resolvedTags,
            metadata: mergedMetadata,
            timestamp: Date.now(),
          },
        ]);
        return { status: 'ok' };
      } catch (err) {
        if (shouldDegrade(err)) {
          return { status: 'degraded', degradeReason: 'hindsight_unavailable' };
        }
        reply.status(502);
        return { error: 'Retain unavailable' };
      }
    });
  };
