/**
 * Mode Routes
 * 模式生命周期 API: 启动/查询/结束模式
 *
 * POST   /api/threads/:threadId/mode         — 启动模式
 * GET    /api/threads/:threadId/mode         — 查询当前模式
 * DELETE /api/threads/:threadId/mode         — 结束当前模式
 * GET    /api/threads/:threadId/mode/history — 模式流转历史
 */

import type { BrainstormConfig, DebateConfig, DevLoopConfig, ModeConfig, ModeName } from '@cat-cafe/shared';
import { catIdSchema } from '@cat-cafe/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IModeStore } from '../domains/cats/services/stores/ports/ModeStore.js';
import { createInitialState } from '../domains/cats/services/stores/ports/ModeStore.js';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';

export interface ModesRoutesOptions {
  modeStore: IModeStore;
  threadStore: IThreadStore;
  socketManager: SocketManager;
}

const VALID_MODES: readonly ModeName[] = ['brainstorm', 'debate', 'dev-loop'] as const;

/** Zod refinement: string must be a registered cat ID (deferred to request time) */
const catIdString = catIdSchema();

const brainstormConfigSchema = z.object({
  topic: z.string().min(1).max(500),
  participants: z.array(catIdString).min(1).max(3),
  speakingOrder: z.array(catIdString).optional(),
});

const debateConfigSchema = z
  .object({
    topic: z.string().min(1).max(500),
    catA: catIdString,
    catB: catIdString,
    rounds: z.number().int().min(1).max(10).optional(),
  })
  .refine((data) => data.catA !== data.catB, { message: 'catA and catB must be different cats', path: ['catB'] });

const devLoopConfigSchema = z
  .object({
    requirement: z.string().min(1).max(2000),
    leadCat: catIdString,
    reviewCat: catIdString,
    maxIterations: z.number().int().min(1).max(10).optional(),
  })
  .refine((data) => data.leadCat !== data.reviewCat, {
    message: 'leadCat and reviewCat must be different cats',
    path: ['reviewCat'],
  });

const startModeSchema = z.object({
  name: z.enum(['brainstorm', 'debate', 'dev-loop']),
  config: z.record(z.unknown()),
});

const endModeSchema = z.object({
  outcome: z.string().max(2000).optional(),
});

/** Extract userId from request auth header (P2-5: never trust request body) */
function resolveUserId(request: { headers: Record<string, string | string[] | undefined> }): string {
  const header = request.headers['x-cat-cafe-user'];
  return (Array.isArray(header) ? header[0] : header) ?? 'anonymous';
}

export const modesRoutes: FastifyPluginAsync<ModesRoutesOptions> = async (app, opts) => {
  const { modeStore, threadStore, socketManager } = opts;

  // POST /api/threads/:threadId/mode — start a mode
  app.post<{ Params: { threadId: string } }>('/api/threads/:threadId/mode', async (request, reply) => {
    const { threadId } = request.params;
    const userId = resolveUserId(request);
    const thread = await threadStore.get(threadId);
    if (!thread) {
      reply.status(404);
      return { error: '对话不存在', code: 'THREAD_NOT_FOUND' };
    }
    if (thread.createdBy !== userId) {
      reply.status(403);
      return { error: '无权操作此对话的模式', code: 'FORBIDDEN' };
    }

    const parseResult = startModeSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request', details: parseResult.error.issues };
    }

    const { name, config: rawConfig } = parseResult.data;
    const triggeredBy = userId;

    // Validate mode-specific config (P2-4: catId validation via Zod refine)
    let validatedConfig: ModeConfig;
    if (name === 'brainstorm') {
      const r = brainstormConfigSchema.safeParse(rawConfig);
      if (!r.success) {
        reply.status(400);
        return { error: 'Invalid brainstorm config', details: r.error.issues };
      }
      validatedConfig = r.data as BrainstormConfig;
    } else if (name === 'debate') {
      const r = debateConfigSchema.safeParse(rawConfig);
      if (!r.success) {
        reply.status(400);
        return { error: 'Invalid debate config', details: r.error.issues };
      }
      validatedConfig = r.data as DebateConfig;
    } else {
      const r = devLoopConfigSchema.safeParse(rawConfig);
      if (!r.success) {
        reply.status(400);
        return { error: 'Invalid dev-loop config', details: r.error.issues };
      }
      validatedConfig = r.data as DevLoopConfig;
    }

    const initialState = createInitialState(name);
    const mode = await modeStore.startMode(threadId, name, validatedConfig, triggeredBy, initialState);

    socketManager.broadcastToRoom(`thread:${threadId}`, 'mode_changed', {
      threadId,
      mode,
      action: 'started',
    });

    reply.status(201);
    return mode;
  });

  // GET /api/threads/:threadId/mode — get current mode
  app.get<{ Params: { threadId: string } }>('/api/threads/:threadId/mode', async (request, reply) => {
    const { threadId } = request.params;
    const userId = resolveUserId(request);
    const thread = await threadStore.get(threadId);
    if (!thread) {
      reply.status(404);
      return { error: '对话不存在', code: 'THREAD_NOT_FOUND' };
    }
    if (thread.createdBy !== userId) {
      reply.status(403);
      return { error: '无权查看此对话的模式', code: 'FORBIDDEN' };
    }
    const mode = await modeStore.getMode(threadId);
    return { mode };
  });

  // DELETE /api/threads/:threadId/mode — end current mode
  app.delete<{ Params: { threadId: string } }>('/api/threads/:threadId/mode', async (request, reply) => {
    const { threadId } = request.params;
    const userId = resolveUserId(request);
    const thread = await threadStore.get(threadId);
    if (thread && thread.createdBy !== userId) {
      reply.status(403);
      return { error: '无权操作此对话的模式', code: 'FORBIDDEN' };
    }

    const body = endModeSchema.safeParse(request.body ?? {});
    const outcome = body.success ? body.data.outcome : undefined;

    const ended = await modeStore.endMode(threadId, outcome);
    if (!ended) {
      reply.status(404);
      return { error: '当前没有活跃模式', code: 'NO_ACTIVE_MODE' };
    }

    socketManager.broadcastToRoom(`thread:${threadId}`, 'mode_changed', {
      threadId,
      mode: null,
      action: 'ended',
    });

    return { ended };
  });

  // GET /api/threads/:threadId/mode/history — mode history
  app.get<{ Params: { threadId: string } }>('/api/threads/:threadId/mode/history', async (request, reply) => {
    const { threadId } = request.params;
    const userId = resolveUserId(request);
    const thread = await threadStore.get(threadId);
    if (!thread) {
      reply.status(404);
      return { error: '对话不存在', code: 'THREAD_NOT_FOUND' };
    }
    if (thread.createdBy !== userId) {
      reply.status(403);
      return { error: '无权查看此对话的模式历史', code: 'FORBIDDEN' };
    }
    const history = await modeStore.getModeHistory(threadId);
    return { history };
  });
};
