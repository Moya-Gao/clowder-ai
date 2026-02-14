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
import type { IThreadStore } from '../domains/cats/services/ThreadStore.js';
import { resolveUserId } from '../utils/request-identity.js';

interface SessionChainRouteOptions extends FastifyPluginOptions {
  sessionChainStore: ISessionChainStore;
  threadStore: IThreadStore;
}

export async function sessionChainRoutes(
  app: FastifyInstance,
  opts: SessionChainRouteOptions,
): Promise<void> {
  const { sessionChainStore, threadStore } = opts;

  app.get<{
    Params: { threadId: string };
    Querystring: { catId?: string };
  }>('/api/threads/:threadId/sessions', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

    const { threadId } = request.params;
    const thread = await threadStore.get(threadId);
    if (!thread || thread.createdBy !== userId) {
      reply.status(403);
      return { error: 'Access denied' };
    }

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
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

    const { sessionId } = request.params;
    const session = await sessionChainStore.get(sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Verify thread ownership via session -> thread
    const thread = await threadStore.get(session.threadId);
    if (!thread || thread.createdBy !== userId) {
      reply.status(403);
      return { error: 'Access denied' };
    }

    return reply.send(session);
  });
}
