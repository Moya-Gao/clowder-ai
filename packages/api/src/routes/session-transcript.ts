/**
 * Session Transcript Routes — F24 Phase D
 * API endpoints for reading sealed session transcripts.
 *
 * GET  /api/sessions/:sessionId/events      — Paginated events
 * GET  /api/sessions/:sessionId/digest       — Extractive digest
 * GET  /api/threads/:threadId/sessions/search — Full-text search
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { ISessionChainStore } from '../domains/cats/services/SessionChainStore.js';
import type { IThreadStore } from '../domains/cats/services/ThreadStore.js';
import type { TranscriptReader } from '../domains/cats/services/TranscriptReader.js';
import { resolveUserId } from '../utils/request-identity.js';

interface SessionTranscriptRouteOptions extends FastifyPluginOptions {
  sessionChainStore: ISessionChainStore;
  threadStore: IThreadStore;
  transcriptReader: TranscriptReader;
}

/** Strict integer parse: only pure decimal digit strings (no whitespace, no partial) */
function strictParseInt(s: string): number {
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

const searchSchema = z.object({
  q: z.string().min(1).max(500),
  cats: z.string().optional(),
  sessionIds: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  scope: z.enum(['digests', 'transcripts', 'both']).optional(),
});

export async function sessionTranscriptRoutes(
  app: FastifyInstance,
  opts: SessionTranscriptRouteOptions,
): Promise<void> {
  const { sessionChainStore, threadStore, transcriptReader } = opts;

  // GET /api/sessions/:sessionId/events — Paginated event read
  app.get<{
    Params: { sessionId: string };
    Querystring: { cursor?: string; limit?: string };
  }>('/api/sessions/:sessionId/events', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const { sessionId } = request.params;
    const session = await sessionChainStore.get(sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Verify thread ownership
    const thread = await threadStore.get(session.threadId);
    if (!thread || thread.createdBy !== userId) {
      reply.status(403);
      return { error: 'Access denied' };
    }

    const cursorParam = request.query.cursor;
    const cursorNum = cursorParam ? strictParseInt(cursorParam) : undefined;
    if (cursorNum != null && (Number.isNaN(cursorNum) || cursorNum < 0)) {
      reply.status(400);
      return { error: 'Invalid cursor: must be a non-negative integer' };
    }
    const cursor = cursorNum != null ? { eventNo: cursorNum } : undefined;

    const limitParam = request.query.limit;
    const limitNum = limitParam ? strictParseInt(limitParam) : undefined;
    if (limitNum != null && (Number.isNaN(limitNum) || limitNum < 1)) {
      reply.status(400);
      return { error: 'Invalid limit: must be a positive integer' };
    }
    const limit = limitNum != null ? Math.min(limitNum, 200) : 50;

    const result = await transcriptReader.readEvents(
      sessionId, session.threadId, session.catId, cursor, limit,
    );

    return reply.send(result);
  });

  // GET /api/sessions/:sessionId/digest — Extractive digest
  app.get<{
    Params: { sessionId: string };
  }>('/api/sessions/:sessionId/digest', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const { sessionId } = request.params;
    const session = await sessionChainStore.get(sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    const thread = await threadStore.get(session.threadId);
    if (!thread || thread.createdBy !== userId) {
      reply.status(403);
      return { error: 'Access denied' };
    }

    const digest = await transcriptReader.readDigest(
      sessionId, session.threadId, session.catId,
    );
    if (!digest) {
      return reply.status(404).send({ error: 'Digest not found' });
    }

    return reply.send(digest);
  });

  // GET /api/threads/:threadId/sessions/search — Full-text search
  app.get<{
    Params: { threadId: string };
    Querystring: Record<string, string>;
  }>('/api/threads/:threadId/sessions/search', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required' };
    }

    const { threadId } = request.params;
    const thread = await threadStore.get(threadId);
    if (!thread || thread.createdBy !== userId) {
      reply.status(403);
      return { error: 'Access denied' };
    }

    const parseResult = searchSchema.safeParse(request.query);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid query', details: parseResult.error.issues };
    }

    const { q, cats, sessionIds, limit, scope } = parseResult.data;

    const catsArr = cats?.split(',').filter(Boolean);
    const sessionIdsArr = sessionIds?.split(',').filter(Boolean);

    const hits = await transcriptReader.search(threadId, q, {
      ...(catsArr ? { cats: catsArr } : {}),
      ...(sessionIdsArr ? { sessionIds: sessionIdsArr } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(scope ? { scope } : {}),
    });

    return reply.send({ hits });
  });
}
