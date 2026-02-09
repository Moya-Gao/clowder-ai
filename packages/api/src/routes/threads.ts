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
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { ITaskStore } from '../domains/cats/services/TaskStore.js';
import type { IMemoryStore } from '../domains/cats/services/MemoryStore.js';
import { validateProjectPath } from '../utils/project-path.js';

export interface ThreadsRoutesOptions {
  threadStore: IThreadStore;
  /** Optional: cascade delete messages when thread is deleted */
  messageStore?: IMessageStore;
  /** Optional: cascade delete tasks when thread is deleted */
  taskStore?: ITaskStore;
  /** Optional: cascade delete memory when thread is deleted */
  memoryStore?: IMemoryStore;
}

const createThreadSchema = z.object({
  userId: z.string().min(1).max(100),
  title: z.string().min(1).max(200).optional(),
  projectPath: z.string().min(1).max(500).optional(),
});

const listThreadsSchema = z.object({
  userId: z.string().min(1).max(100).default('default-user'),
  projectPath: z.string().min(1).max(500).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

const updateThreadSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const threadsRoutes: FastifyPluginAsync<ThreadsRoutesOptions> =
  async (app, opts) => {
  const { threadStore, messageStore, taskStore, memoryStore } = opts;

  // POST /api/threads - 创建对话
  app.post('/api/threads', async (request, reply) => {
    const parseResult = createThreadSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { userId, title, projectPath } = parseResult.data;

    // Validate projectPath is a real directory under allowed roots
    if (projectPath && projectPath !== 'default') {
      const validated = await validateProjectPath(projectPath);
      if (!validated) {
        reply.status(400);
        return { error: 'Invalid projectPath: must be an existing directory under home' };
      }
      // Use canonicalized path (symlinks resolved)
      const thread = await threadStore.create(userId, title, validated);
      reply.status(201);
      return thread;
    }

    const thread = await threadStore.create(userId, title, projectPath);
    reply.status(201);
    return thread;
  });

  // GET /api/threads - 列出用户的对话
  app.get('/api/threads', async (request) => {
    const parseResult = listThreadsSchema.safeParse(request.query);
    if (!parseResult.success) {
      return { threads: [] };
    }

    const { userId, projectPath, q } = parseResult.data;
    const threads = projectPath
      ? await threadStore.listByProject(userId, projectPath)
      : await threadStore.list(userId);
    if (!q) return { threads };

    const needle = q.toLowerCase();
    const filtered = threads.filter((thread) => {
      const title = (thread.title ?? '').toLowerCase();
      const fallback = (thread.id === 'default' ? '大厅' : '未命名对话').toLowerCase();
      const project = (thread.projectPath ?? '').toLowerCase();
      return title.includes(needle) || fallback.includes(needle) || project.includes(needle);
    });

    return { threads: filtered };
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

    await threadStore.updateTitle(id, parseResult.data.title);

    const updated = await threadStore.get(id);
    if (!updated) {
      reply.status(404);
      return { error: 'Thread not found' };
    }

    return updated;
  });

  // DELETE /api/threads/:id - 删除对话 (with cascade delete)
  app.delete('/api/threads/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await threadStore.delete(id);
    if (!deleted) {
      reply.status(400);
      return { error: 'Cannot delete this thread' };
    }

    // Cascade delete associated data (best-effort, don't fail if stores unavailable)
    const cascadeResults = await Promise.allSettled([
      messageStore?.deleteByThread(id),
      taskStore?.deleteByThread(id),
      memoryStore?.deleteThread(id),
    ]);

    // Log any cascade failures but don't fail the request
    for (const result of cascadeResults) {
      if (result.status === 'rejected') {
        console.warn(`[threads] Cascade delete warning for ${id}:`, result.reason);
      }
    }

    reply.status(204);
    return;
  });
};
