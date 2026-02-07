/**
 * Memory API Routes
 * POST /api/memory - Write memory entry
 * GET /api/memory - Read memory entry or list all
 * DELETE /api/memory - Delete memory entry
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createCatId } from '@cat-cafe/shared';
import type { IMemoryStore } from '../domains/cats/services/MemoryStore.js';

export interface MemoryRoutesOptions {
  memoryStore: IMemoryStore;
}

const writeSchema = z.object({
  threadId: z.string().min(1).max(100),
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(10000),
  updatedBy: z.union([
    z.enum(['opus', 'codex', 'gemini']),
    z.literal('user'),
  ]),
});

const readSchema = z.object({
  threadId: z.string().min(1).max(100),
  key: z.string().min(1).max(100).optional(),
});

const deleteSchema = z.object({
  threadId: z.string().min(1).max(100),
  key: z.string().min(1).max(100),
});

export const memoryRoutes: FastifyPluginAsync<MemoryRoutesOptions> = async (app, opts) => {
  // POST /api/memory — write entry
  app.post('/api/memory', async (request, reply) => {
    const parseResult = writeSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { threadId, key, value, updatedBy } = parseResult.data;
    const resolvedUpdatedBy = updatedBy === 'user' ? 'user' as const : createCatId(updatedBy);
    const entry = await opts.memoryStore.set({ threadId, key, value, updatedBy: resolvedUpdatedBy });

    reply.status(201);
    return entry;
  });

  // GET /api/memory — read single key or list all
  app.get('/api/memory', async (request, reply) => {
    const parseResult = readSchema.safeParse(request.query);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid query parameters', details: parseResult.error.issues };
    }

    const { threadId, key } = parseResult.data;

    if (key) {
      // Single key lookup
      const entry = await opts.memoryStore.get(threadId, key);
      if (!entry) {
        reply.status(404);
        return { error: 'Memory entry not found' };
      }
      return entry;
    }

    // List all keys for thread
    const entries = await opts.memoryStore.list(threadId);
    return { entries };
  });

  // DELETE /api/memory — delete single key
  app.delete('/api/memory', async (request, reply) => {
    const parseResult = deleteSchema.safeParse(request.query);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid query parameters', details: parseResult.error.issues };
    }

    const { threadId, key } = parseResult.data;
    const deleted = await opts.memoryStore.delete(threadId, key);

    if (!deleted) {
      reply.status(404);
      return { error: 'Memory entry not found' };
    }

    reply.status(204);
    return;
  });
};
