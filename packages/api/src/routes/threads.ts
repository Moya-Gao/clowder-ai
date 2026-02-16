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
import type { DeliveryCursorStore } from '../domains/cats/services/DeliveryCursorStore.js';
import type { InvocationTracker } from '../domains/cats/services/InvocationTracker.js';
import { validateProjectPath } from '../utils/project-path.js';
import { resolveUserId } from '../utils/request-identity.js';

export interface ThreadsRoutesOptions {
  threadStore: IThreadStore;
  /** Optional: cascade delete messages when thread is deleted */
  messageStore?: IMessageStore;
  /** Optional: cascade delete tasks when thread is deleted */
  taskStore?: ITaskStore;
  /** Optional: cascade delete memory when thread is deleted */
  memoryStore?: IMemoryStore;
  /** Optional: cascade delete delivery cursors when thread is deleted */
  deliveryCursorStore?: DeliveryCursorStore;
  /** Optional: protect active invocations from thread deletion (#35) */
  invocationTracker?: InvocationTracker;
}

const createThreadSchema = z.object({
  /** Legacy fallback only; preferred identity source is X-Cat-Cafe-User header. */
  userId: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200).optional(),
  projectPath: z.string().min(1).max(500).optional(),
});

const listThreadsSchema = z.object({
  projectPath: z.string().min(1).max(500).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

const updateThreadSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  favorited: z.boolean().optional(),
}).refine((data) => data.title !== undefined || data.pinned !== undefined || data.favorited !== undefined, {
  message: 'At least one field must be provided',
});

export const threadsRoutes: FastifyPluginAsync<ThreadsRoutesOptions> =
  async (app, opts) => {
  const { threadStore, messageStore, taskStore, memoryStore, deliveryCursorStore } = opts;

  // POST /api/threads - 创建对话
  app.post('/api/threads', async (request, reply) => {
    const parseResult = createThreadSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { userId: legacyUserId, title, projectPath } = parseResult.data;
    const userId = resolveUserId(request, { fallbackUserId: legacyUserId });
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

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

    const { projectPath, q } = parseResult.data;
    const userId = resolveUserId(request, { defaultUserId: 'default-user' });
    if (!userId) return { threads: [] };

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

  // PATCH /api/threads/:id - 更新标题/置顶/收藏
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

    const { title, pinned, favorited } = parseResult.data;
    if (title !== undefined) await threadStore.updateTitle(id, title);
    if (pinned !== undefined) await threadStore.updatePin(id, pinned);
    if (favorited !== undefined) await threadStore.updateFavorite(id, favorited);

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

    // Protect active invocations from deletion (#35)
    // Atomic: guardDelete checks has() + marks "deleting" in one synchronous tick.
    // While guard is held, start() returns pre-aborted controller for this thread.
    const guard = opts.invocationTracker?.guardDelete(id);
    if (guard && !guard.acquired) {
      reply.status(409);
      return {
        error: '猫猫正在工作中',
        detail: '请等待猫猫完成当前任务后再删除对话',
        code: 'ACTIVE_INVOCATION',
      };
    }

    try {
      const thread = await threadStore.get(id);

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
        thread ? deliveryCursorStore?.deleteByThreadForUser(thread.createdBy, id) : undefined,
      ]);

      // Log any cascade failures but don't fail the request
      for (const result of cascadeResults) {
        if (result.status === 'rejected') {
          console.warn(`[threads] Cascade delete warning for ${id}:`, result.reason);
        }
      }

      reply.status(204);
      return;
    } finally {
      guard?.release();
    }
  });
};
