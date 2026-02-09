/**
 * Invocations API Routes
 * GET  /api/invocations/:id       — 查询 InvocationRecord 状态
 * POST /api/invocations/:id/retry — 重试 failed/queued invocation
 *
 * ADR-008 S1: InvocationRecord 查询 + 重试端点
 */

import type { FastifyPluginAsync } from 'fastify';
import type { IInvocationRecordStore } from '../domains/cats/services/InvocationRecordStore.js';

export interface InvocationsRoutesOptions {
  invocationRecordStore: IInvocationRecordStore;
}

export const invocationsRoutes: FastifyPluginAsync<InvocationsRoutesOptions> =
  async (app, opts) => {

  // GET /api/invocations/:id — query InvocationRecord state
  app.get<{ Params: { id: string } }>('/api/invocations/:id', async (request, reply) => {
    const { id } = request.params;
    const record = await opts.invocationRecordStore.get(id);

    if (!record) {
      reply.status(404);
      return { error: 'Invocation not found', code: 'INVOCATION_NOT_FOUND' };
    }

    return {
      id: record.id,
      threadId: record.threadId,
      userId: record.userId,
      userMessageId: record.userMessageId,
      targetCats: record.targetCats,
      intent: record.intent,
      status: record.status,
      ...(record.error ? { error: record.error } : {}),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  });

  // POST /api/invocations/:id/retry — retry failed/queued invocation
  app.post<{ Params: { id: string } }>('/api/invocations/:id/retry', async (request, reply) => {
    const { id } = request.params;
    const record = await opts.invocationRecordStore.get(id);

    if (!record) {
      reply.status(404);
      return { error: 'Invocation not found', code: 'INVOCATION_NOT_FOUND' };
    }

    // Only failed and queued are retryable
    if (record.status !== 'failed' && record.status !== 'queued') {
      reply.status(409);
      return {
        error: `Cannot retry invocation with status '${record.status}'`,
        code: 'INVOCATION_NOT_RETRYABLE',
        currentStatus: record.status,
      };
    }

    // Reset to queued for re-execution (actual execution will be wired in S2+)
    await opts.invocationRecordStore.update(id, { status: 'queued' });

    return {
      status: 'queued',
      invocationId: id,
      message: 'Invocation queued for retry',
    };
  });
};
