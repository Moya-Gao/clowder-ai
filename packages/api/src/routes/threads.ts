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
import { catIdSchema } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import type { IThreadStore, ThreadRoutingPolicyV1 } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { IMessageStore } from '../domains/cats/services/stores/ports/MessageStore.js';
import type { ITaskStore } from '../domains/cats/services/stores/ports/TaskStore.js';
import type { IMemoryStore } from '../domains/cats/services/stores/ports/MemoryStore.js';
import type { IThreadReadStateStore } from '../domains/cats/services/stores/ports/ThreadReadStateStore.js';
import type { DeliveryCursorStore } from '../domains/cats/services/stores/ports/DeliveryCursorStore.js';
import type { InvocationTracker } from '../domains/cats/services/agents/invocation/InvocationTracker.js';
import type { IDraftStore } from '../domains/cats/services/stores/ports/DraftStore.js';
import type { TaskProgressStore } from '../domains/cats/services/agents/invocation/TaskProgressStore.js';
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
  /** #80: cascade delete streaming drafts */
  draftStore?: IDraftStore;
  /** F045: per-cat task progress snapshot store (Redis-backed when available) */
  taskProgressStore?: TaskProgressStore;
  /** F069: per-user/per-thread read state for unread badge persistence */
  readStateStore?: IThreadReadStateStore;
}

const createThreadSchema = z.object({
  /** Legacy fallback only; preferred identity source is X-Cat-Cafe-User header. */
  userId: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200).optional(),
  projectPath: z.string().min(1).max(500).optional(),
  /** F32-b Phase 2: Thread-level cat preference (validated against catRegistry) */
  preferredCats: z.array(catIdSchema()).max(10).optional(),
});

const listThreadsSchema = z.object({
  projectPath: z.string().min(1).max(500).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  backlogItemIds: z.string().trim().min(1).max(4000).optional(),
  hasBacklogItemId: z.union([z.boolean(), z.string().trim().min(1).max(8)]).optional(),
  /** F058 Phase G: comma-separated feature IDs to match against thread titles (e.g. "f058,f042") */
  featureIds: z.string().trim().min(1).max(2000).optional(),
});

function parseOptionalBooleanQuery(value: string | boolean | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

const threadRoutingRuleSchema = z.object({
  avoidCats: z.array(catIdSchema()).max(10).optional(),
  preferCats: z.array(catIdSchema()).max(10).optional(),
  reason: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/, 'reason must be single-line').optional(),
  expiresAt: z.number().int().positive().optional(),
}).strict();

const threadRoutingPolicySchema = z.object({
  v: z.literal(1),
  scopes: z.object({
    review: threadRoutingRuleSchema.optional(),
    architecture: threadRoutingRuleSchema.optional(),
  }).partial().optional(),
}).strict();

const updateThreadSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  favorited: z.boolean().optional(),
  thinkingMode: z.enum(['debug', 'play']).optional(),
  /** F32-b Phase 2: Update thread-level cat preference. Empty array clears. */
  preferredCats: z.array(catIdSchema()).max(10).optional(),
  /** F042: Thread-level routing policy by intent/scope. null clears. */
  routingPolicy: threadRoutingPolicySchema.nullable().optional(),
}).refine((data) => data.title !== undefined || data.pinned !== undefined || data.favorited !== undefined || data.thinkingMode !== undefined || data.preferredCats !== undefined || data.routingPolicy !== undefined, {
  message: 'At least one field must be provided',
});

export const threadsRoutes: FastifyPluginAsync<ThreadsRoutesOptions> =
  async (app, opts) => {
  const { threadStore, messageStore, taskStore, memoryStore, deliveryCursorStore, taskProgressStore } = opts;

  // POST /api/threads - 创建对话
  app.post('/api/threads', async (request, reply) => {
    const parseResult = createThreadSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { userId: legacyUserId, title, projectPath, preferredCats } = parseResult.data;
    const userId = resolveUserId(request, { fallbackUserId: legacyUserId });
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

    // Validate projectPath is a real directory under allowed roots
    let thread;
    if (projectPath && projectPath !== 'default') {
      const validated = await validateProjectPath(projectPath);
      if (!validated) {
        reply.status(400);
        return { error: 'Invalid projectPath: must be an existing directory under home' };
      }
      thread = await threadStore.create(userId, title, validated);
    } else {
      thread = await threadStore.create(userId, title, projectPath);
    }

    // F32-b Phase 2: Set preferred cats if provided at creation time
    if (preferredCats && preferredCats.length > 0) {
      await threadStore.updatePreferredCats(thread.id, preferredCats as CatId[]);
      thread = await threadStore.get(thread.id) ?? thread;
    }

    reply.status(201);
    return thread;
  });

  // GET /api/threads - 列出用户的对话
  app.get('/api/threads', async (request, reply) => {
    const parseResult = listThreadsSchema.safeParse(request.query);
    if (!parseResult.success) {
      return { threads: [] };
    }

    const { projectPath, q, backlogItemIds, hasBacklogItemId: hasBacklogItemIdRaw, featureIds } = parseResult.data;
    const hasBacklogItemId = parseOptionalBooleanQuery(hasBacklogItemIdRaw);
    const userId = resolveUserId(request, { defaultUserId: 'default-user' });
    if (!userId) return { threads: [] };

    let threads = projectPath
      ? await threadStore.listByProject(userId, projectPath)
      : await threadStore.list(userId);

    // F058 Phase G: Match threads by feature IDs in titles
    if (featureIds) {
      const ids = featureIds.split(',').map((id) => id.trim().toLowerCase()).filter((id) => /^f\d{2,4}$/i.test(id));
      if (ids.length > 50) {
        reply.status(400);
        return { error: 'Too many featureIds (max 50)' };
      }
      if (ids.length > 0) {
        // Build variant set: "f063" also matches "f63" (no leading zeros) and vice versa
        const variantsByCanonical = new Map<string, string[]>();
        for (const fid of ids) {
          const digits = fid.slice(1);
          const noLeadingZeros = `f${Number.parseInt(digits, 10)}`;
          const variants = new Set([fid, noLeadingZeros]);
          variantsByCanonical.set(fid.toUpperCase(), [...variants]);
        }
        const threadsByFeature: Record<string, Array<{ id: string; title: string | null; lastActiveAt: number; participants: CatId[] }>> = {};
        for (const thread of threads) {
          const title = (thread.title ?? '').toLowerCase();
          for (const [canonical, variants] of variantsByCanonical) {
            if (variants.some((v) => title.includes(v))) {
              const arr = threadsByFeature[canonical] ?? [];
              arr.push({ id: thread.id, title: thread.title, lastActiveAt: thread.lastActiveAt, participants: thread.participants });
              threadsByFeature[canonical] = arr;
            }
          }
        }
        return { threadsByFeature };
      }
    }

    const requestedBacklogIds = backlogItemIds
      ? new Set(backlogItemIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0))
      : null;

    if (requestedBacklogIds && requestedBacklogIds.size > 50) {
      reply.status(400);
      return { error: 'Too many backlogItemIds (max 50)' };
    }

    if (requestedBacklogIds && requestedBacklogIds.size > 0) {
      threads = threads.filter((thread) => {
        const linkedBacklogId = thread.backlogItemId;
        return !!linkedBacklogId && requestedBacklogIds.has(linkedBacklogId);
      });
    } else if (hasBacklogItemId === true) {
      threads = threads.filter((thread) => !!thread.backlogItemId);
    }

    if (q) {
      const needle = q.toLowerCase();
      threads = threads.filter((thread) => {
        const title = (thread.title ?? '').toLowerCase();
        const fallback = (thread.id === 'default' ? '大厅' : '未命名对话').toLowerCase();
        const project = (thread.projectPath ?? '').toLowerCase();
        return title.includes(needle) || fallback.includes(needle) || project.includes(needle) || thread.id === q;
      });
    }

    // F069: Hydrate unread summaries from read state store
    if (opts.readStateStore && messageStore && threads.length > 0) {
      const summaries = await opts.readStateStore.getUnreadSummaries(
        userId, threads.map((t) => t.id), messageStore,
      );
      const summaryMap = new Map(summaries.map((s) => [s.threadId, s]));
      return {
        threads: threads.map((t) => {
          const s = summaryMap.get(t.id);
          return { ...t, unreadCount: s?.unreadCount ?? 0, hasUserMention: s?.hasUserMention ?? false };
        }),
      };
    }

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

    const { title, pinned, favorited, thinkingMode, preferredCats, routingPolicy } = parseResult.data;
    if (title !== undefined) await threadStore.updateTitle(id, title);
    if (pinned !== undefined) await threadStore.updatePin(id, pinned);
    if (favorited !== undefined) await threadStore.updateFavorite(id, favorited);
    if (thinkingMode !== undefined) await threadStore.updateThinkingMode(id, thinkingMode);
    if (preferredCats !== undefined) await threadStore.updatePreferredCats(id, preferredCats as CatId[]);
    if (routingPolicy !== undefined) {
      await threadStore.updateRoutingPolicy(id, routingPolicy as ThreadRoutingPolicyV1 | null);
    }

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
        taskProgressStore?.deleteThread(id),
        thread ? deliveryCursorStore?.deleteByThreadForUser(thread.createdBy, id) : undefined,
        // #80: Clean up any streaming drafts for this thread
        thread && opts.draftStore ? opts.draftStore.deleteByThread(thread.createdBy, id) : undefined,
        // F069: Clean up read state cursors for this thread
        opts.readStateStore?.deleteByThread(id),
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

  // F045: GET /api/threads/:threadId/task-progress — task progress snapshot for page refresh persistence
  app.get<{ Params: { threadId: string } }>('/api/threads/:threadId/task-progress', async (request, reply) => {
    const userId = resolveUserId(request, {});
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const { threadId } = request.params;
    const thread = await threadStore.get(threadId);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }

    if (thread.createdBy !== userId && thread.createdBy !== 'system') {
      reply.status(403);
      return { error: 'Access denied' };
    }

    const snapshot = taskProgressStore
      ? await taskProgressStore.getThreadSnapshots(threadId)
      : {};
    return { threadId, taskProgress: snapshot };
  });

  // F35: PATCH /api/threads/:id/reveal — reveal all whispers in a thread
  app.patch<{ Params: { id: string } }>('/api/threads/:id/reveal', async (request, reply) => {
    const userId = resolveUserId(request, {});
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const { id } = request.params;
    const thread = await threadStore.get(id);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }

    // Default thread is system-owned; allow any authenticated user to reveal.
    if (thread.createdBy !== userId && thread.createdBy !== 'system') {
      reply.status(403);
      return { error: 'Only the thread owner can reveal whispers' };
    }

    if (!messageStore) {
      reply.status(501);
      return { error: 'Message store not available' };
    }

    const revealed = await messageStore.revealWhispers(id, userId);
    return { revealed };
  });

  // F072: POST /api/threads/read/mark-all — mark all threads as read
  app.post('/api/threads/read/mark-all', async (request, reply) => {
    const userId = resolveUserId(request, {});
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    if (!opts.readStateStore || !messageStore) {
      reply.status(501);
      return { error: 'Read state store or message store not available' };
    }

    const threads = await threadStore.list(userId);
    let advancedCount = 0;

    for (const thread of threads) {
      const messages = await messageStore.getByThread(thread.id);
      if (messages.length === 0) continue;
      const latestId = messages[messages.length - 1]!.id;
      const advanced = await opts.readStateStore.ack(userId, thread.id, latestId);
      if (advanced) advancedCount++;
    }

    return { advancedCount, totalThreads: threads.length };
  });

  // F069: PATCH /api/threads/:id/read — mark thread as read up to messageId
  const readAckSchema = z.object({
    upToMessageId: z.string().min(1).max(100),
  });

  app.patch<{ Params: { id: string } }>('/api/threads/:id/read', async (request, reply) => {
    const userId = resolveUserId(request, {});
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    if (!opts.readStateStore) {
      reply.status(501);
      return { error: 'Read state store not available' };
    }

    const { id } = request.params;
    const thread = await threadStore.get(id);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }

    const parseResult = readAckSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    // P1-3: Validate upToMessageId belongs to this thread
    if (messageStore) {
      const msg = await messageStore.getById(parseResult.data.upToMessageId);
      if (!msg || msg.threadId !== id) {
        reply.status(400);
        return { error: 'upToMessageId does not belong to this thread' };
      }
    }

    const advanced = await opts.readStateStore.ack(userId, id, parseResult.data.upToMessageId);
    return { advanced };
  });
};
