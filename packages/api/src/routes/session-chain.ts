/**
 * Session Chain Routes
 * F24: API endpoints for session chain + context health data.
 *
 * GET /api/threads/:threadId/sessions       - List sessions (optional catId filter)
 * GET /api/sessions/:sessionId              - Get single session record
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { CatId } from '@cat-cafe/shared';
import type { ISessionChainStore } from '../domains/cats/services/SessionChainStore.js';

interface SessionChainRouteOptions extends FastifyPluginOptions {
  sessionChainStore: ISessionChainStore;
}

export async function sessionChainRoutes(
  app: FastifyInstance,
  opts: SessionChainRouteOptions,
): Promise<void> {
  const { sessionChainStore } = opts;

  app.get<{
    Params: { threadId: string };
    Querystring: { catId?: string };
  }>('/api/threads/:threadId/sessions', async (request, reply) => {
    const { threadId } = request.params;
    const { catId } = request.query;

    if (catId) {
      const sessions = await sessionChainStore.getChain(catId as CatId, threadId);
      return reply.send({ sessions });
    }

    const sessions = await sessionChainStore.getChainByThread(threadId);
    return reply.send({ sessions });
  });

  app.get<{
    Params: { sessionId: string };
  }>('/api/sessions/:sessionId', async (request, reply) => {
    const { sessionId } = request.params;
    const session = await sessionChainStore.get(sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return reply.send(session);
  });
}
