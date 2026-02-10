/**
 * Audit Route
 * GET /api/audit/thread/:threadId — 返回指定 thread 的审计事件
 *
 * 安全:
 * - 不暴露服务器绝对路径
 * - 校验 userId 与 thread.createdBy 一致 (ownership guard)
 */

import type { FastifyPluginAsync } from 'fastify';
import { getEventAuditLog } from '../domains/cats/services/EventAuditLog.js';
import type { IThreadStore } from '../domains/cats/services/ThreadStore.js';

export interface AuditRoutesOptions {
  threadStore: IThreadStore;
}

export const auditRoutes: FastifyPluginAsync<AuditRoutesOptions> = async (app, opts) => {
  const { threadStore } = opts;

  app.get<{
    Params: { threadId: string };
    Querystring: { userId?: string };
  }>(
    '/api/audit/thread/:threadId',
    async (request, reply) => {
      const { threadId } = request.params;
      const userId = (request.query.userId ?? '').trim();

      if (!userId) {
        reply.status(400);
        return { error: 'userId query parameter is required' };
      }

      const thread = await threadStore.get(threadId);
      if (!thread) {
        reply.status(404);
        return { error: 'Thread not found' };
      }

      if (thread.createdBy !== userId) {
        reply.status(403);
        return { error: 'Access denied' };
      }

      const auditLog = getEventAuditLog();
      const events = await auditLog.readByThread(threadId, { days: 7 });
      return { events };
    }
  );
};
