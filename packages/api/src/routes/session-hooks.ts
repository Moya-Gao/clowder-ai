/**
 * Session Hooks Routes — F24 Session Blindness Fix
 * API endpoints called by Claude Code CLI hooks during context compaction.
 *
 * POST /api/sessions/seal          — Hook-triggered seal (PreCompact calls this)
 * GET  /api/sessions/latest-digest — Get latest sealed session digest (SessionStart calls this)
 *
 * Both endpoints use `cliSessionId` (Claude Code's session_id) to look up the
 * corresponding Cat Cafe SessionRecord via `getByCliSessionId()`.
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import type { ISessionChainStore } from '../domains/cats/services/stores/ports/SessionChainStore.js';
import type { ISessionSealer } from '../domains/cats/services/session/SessionSealer.js';
import type { TranscriptReader } from '../domains/cats/services/session/TranscriptReader.js';

const sealSchema = z.object({
  cliSessionId: z.string().min(1).max(500),
  reason: z.string().min(1).max(200),
});

interface SessionHooksRouteOptions extends FastifyPluginOptions {
  sessionChainStore: ISessionChainStore;
  sessionSealer: ISessionSealer;
  transcriptReader: TranscriptReader;
  /** Shared secret for hook authentication. If set, X-Cat-Cafe-Hook-Token header is required. */
  hookToken?: string;
}

export async function sessionHooksRoutes(
  app: FastifyInstance,
  opts: SessionHooksRouteOptions,
): Promise<void> {
  const { sessionChainStore, sessionSealer, transcriptReader, hookToken } = opts;

  // Hook authentication guard — fail-closed: always requires valid token
  app.addHook('onRequest', async (request, reply) => {
    if (!hookToken) {
      reply.status(503);
      reply.send({ error: 'Hook authentication not configured (set CAT_CAFE_HOOK_TOKEN)' });
      return;
    }
    const provided = request.headers['x-cat-cafe-hook-token'];
    if (provided !== hookToken) {
      reply.status(401);
      reply.send({ error: 'Invalid or missing hook token' });
    }
  });

  // POST /api/sessions/seal — Hook-triggered session seal
  // Called by f24-pre-compact.sh before Claude Code context compression.
  app.post('/api/sessions/seal', async (request, reply) => {
    const parseResult = sealSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { cliSessionId, reason } = parseResult.data;

    // Look up Cat Cafe session by CLI session ID
    const record = await sessionChainStore.getByCliSessionId(cliSessionId);
    if (!record) {
      reply.status(404);
      return { error: 'No session found for this CLI session ID' };
    }

    if (record.status !== 'active') {
      reply.status(409);
      return {
        error: `Session already ${record.status}`,
        sessionId: record.id,
        status: record.status,
      };
    }

    // Fast path: CAS active → sealing
    const sealResult = await sessionSealer.requestSeal({
      sessionId: record.id,
      reason,
    });

    if (!sealResult.accepted) {
      reply.status(409);
      return {
        error: 'Seal request not accepted (race condition)',
        sessionId: record.id,
        status: sealResult.status,
      };
    }

    // Slow path: async transcript flush (fire-and-forget)
    sessionSealer.finalize({ sessionId: record.id }).catch(() => {
      /* best-effort: finalize failure logged internally */
    });

    return reply.send({
      sessionId: record.id,
      threadId: record.threadId,
      catId: record.catId,
      status: 'sealing',
    });
  });

  // GET /api/sessions/latest-digest — Get the latest sealed session's digest
  // Called by f24-post-compact-bootstrap.sh to inject context after compression.
  app.get<{
    Querystring: { cliSessionId?: string };
  }>('/api/sessions/latest-digest', async (request, reply) => {
    const { cliSessionId } = request.query;
    if (!cliSessionId) {
      reply.status(400);
      return { error: 'cliSessionId query parameter required' };
    }

    // Look up the session record to find catId + threadId
    const record = await sessionChainStore.getByCliSessionId(cliSessionId);
    if (!record) {
      reply.status(404);
      return { error: 'No session found for this CLI session ID' };
    }

    // Get the full chain for this cat+thread, find the latest sealed session
    const chain = await sessionChainStore.getChain(record.catId, record.threadId);
    const sealedSessions = chain
      .filter(s => s.status === 'sealed' && s.sealedAt != null)
      .sort((a, b) => (b.sealedAt ?? 0) - (a.sealedAt ?? 0));

    if (sealedSessions.length === 0) {
      reply.status(404);
      return { error: 'No sealed sessions found' };
    }

    const latest = sealedSessions[0]!;

    // Read extractive digest
    const digest = await transcriptReader.readDigest(
      latest.id, latest.threadId, latest.catId,
    );
    if (!digest) {
      reply.status(404);
      return { error: 'Digest not found for latest sealed session' };
    }

    return reply.send({
      sessionId: latest.id,
      seq: latest.seq,
      catId: latest.catId,
      threadId: latest.threadId,
      sealedAt: latest.sealedAt,
      digest,
    });
  });
}
