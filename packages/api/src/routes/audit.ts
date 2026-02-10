/**
 * Audit Route
 * GET /api/audit/thread/:threadId — 返回指定 thread 的审计事件
 *
 * 安全: 不暴露服务器绝对路径。日志文件位置仅限服务端知道。
 */

import type { FastifyInstance } from 'fastify';
import { getEventAuditLog } from '../domains/cats/services/EventAuditLog.js';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { threadId: string } }>(
    '/api/audit/thread/:threadId',
    async (request) => {
      const { threadId } = request.params;
      const auditLog = getEventAuditLog();
      const events = await auditLog.readByThread(threadId, { days: 7 });
      return { events };
    }
  );
}
