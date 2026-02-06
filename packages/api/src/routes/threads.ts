/**
 * Thread API Routes
 * POST   /api/threads     - 创建对话
 * GET    /api/threads      - 列出用户的对话
 * GET    /api/threads/:id  - 获取对话详情
 * PATCH  /api/threads/:id  - 更新标题
 * DELETE /api/threads/:id  - 删除对话
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IThreadStore } from '../domains/cats/services/ThreadStore.js';

export interface ThreadsRoutesOptions {
  threadStore: IThreadStore;
}

const createThreadSchema = z.object({
  userId: z.string().min(1).max(100),
  title: z.string().min(1).max(200).optional(),
});

const listThreadsSchema = z.object({
  userId: z.string().min(1).max(100).default('default-user'),
});

const updateThreadSchema = z.object({
  title: z.string().min(1).max(200),
});

export const threadsRoutes: FastifyPluginAsync<ThreadsRoutesOptions> =
  async (app, opts) => {
  const { threadStore } = opts;

  // POST /api/threads - 创建对话
  app.post('/api/threads', async (request, reply) => {
    const parseResult = createThreadSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { userId, title } = parseResult.data;
    const thread = await threadStore.create(userId, title);
    reply.status(201);
    return thread;
  });

  // GET /api/threads - 列出用户的对话
  app.get('/api/threads', async (request) => {
    const parseResult = listThreadsSchema.safeParse(request.query);
    if (!parseResult.success) {
      return { threads: [] };
    }

    const threads = await threadStore.list(parseResult.data.userId);
    return { threads };
  });

  // GET /api/threads/:id - 获取对话详情
  app.get('/api/threads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const thread = await threadStore.get(id);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }
    return thread;
  });

  // PATCH /api/threads/:id - 更新标题
  app.patch('/api/threads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateThreadSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const thread = await threadStore.get(id);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }

    // Mutate title (in-memory store uses reference)
    thread.title = parseResult.data.title;
    return thread;
  });

  // DELETE /api/threads/:id - 删除对话
  app.delete('/api/threads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await threadStore.delete(id);
    if (!deleted) {
      reply.status(400);
      return { error: 'Cannot delete this thread' };
    }
    reply.status(204);
    return;
  });
};
