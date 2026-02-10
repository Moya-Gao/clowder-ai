/**
 * Audit Route
 * GET /api/audit/thread/:threadId — 返回指定 thread 的审计事件 + 日志路径
 * GET /api/audit/log-path — 返回当日审计日志绝对路径 (支持 VSCode 跳转)
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
      return {
        events,
        logPath: auditLog.getLogPath(),
      };
    }
  );

  app.get('/api/audit/log-path', async () => {
    const auditLog = getEventAuditLog();
    return {
      logPath: auditLog.getLogPath(),
    };
  });
}
