/**
 * Session Chain Routes
 * F24: API endpoints for session chain + context health data.
 *
 * GET   /api/threads/:threadId/sessions            - List sessions (optional catId filter)
 * GET   /api/sessions/:sessionId                   - Get single session record
 * PATCH /api/threads/:threadId/sessions/:catId/bind - Manual bind CLI session ID (#72)
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { type CatId, getAllCatIds } from '@cat-cafe/shared';
import { z } from 'zod';
import type { ISessionChainStore } from '../domains/cats/services/stores/ports/SessionChainStore.js';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import { resolveUserId } from '../utils/request-identity.js';
import { getEventAuditLog, AuditEventTypes } from '../domains/cats/services/orchestration/EventAuditLog.js';

const VALID_CAT_IDS = new Set<string>(getAllCatIds());

const bindSessionSchema = z.object({
  cliSessionId: z.string().min(1).max(500),
});

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

  // PATCH /api/threads/:threadId/sessions/:catId/bind — Manual bind (#72)
  // Allows 铲屎官 to bind a known-good CLI session ID to a cat's thread session.
  // If active session exists → update cliSessionId; otherwise → create new session.
  app.patch<{
    Params: { threadId: string; catId: string };
  }>('/api/threads/:threadId/sessions/:catId/bind', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

    const { threadId, catId } = request.params;

    // Validate catId
    if (!VALID_CAT_IDS.has(catId)) {
      reply.status(400);
      return { error: `Invalid catId: ${catId}. Must be one of: ${[...VALID_CAT_IDS].join(', ')}` };
    }

    // Validate body
    const parseResult = bindSessionSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { cliSessionId } = parseResult.data;

    // Verify thread exists + ownership
    const thread = await threadStore.get(threadId);
    if (!thread) {
      reply.status(404);
      return { error: 'Thread not found' };
    }
    if (thread.createdBy !== userId) {
      reply.status(403);
      return { error: 'Access denied' };
    }

    // Check for active session
    const active = await sessionChainStore.getActive(catId as CatId, threadId);

    let session;
    let mode: 'updated' | 'created';

    if (active) {
      // Update existing active session's cliSessionId
      const updated = await sessionChainStore.update(active.id, {
        cliSessionId,
        updatedAt: Date.now(),
      });
      if (!updated) {
        reply.status(409);
        return { error: 'Session was modified concurrently, please retry' };
      }
      session = updated;
      mode = 'updated';
    } else {
      // No active session → create new one
      session = await sessionChainStore.create({
        cliSessionId,
        threadId,
        catId: catId as CatId,
        userId,
      });
      mode = 'created';
    }

    // Audit trail (best-effort, fire-and-forget)
    getEventAuditLog().append({
      type: AuditEventTypes.SESSION_BIND,
      threadId,
      data: { catId, cliSessionId, mode, sessionId: session.id, userId },
    }).catch(() => { /* best-effort */ });

    return reply.send({ session, mode });
  });
}
