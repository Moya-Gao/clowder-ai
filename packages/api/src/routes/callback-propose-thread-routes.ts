/**
 * F128 Cat-side propose-thread callback route.
 *
 * POST /api/callbacks/propose-thread
 *   Cat-auth. Creates a Proposal (status=pending); does NOT create a thread.
 *   Idempotent via clientRequestId.
 *
 * The companion approve/reject endpoints are user-authenticated and live in
 * proposal-routes.ts.
 */

import { catIdSchema } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { InvocationRegistry } from '../domains/cats/services/agents/invocation/InvocationRegistry.js';
import type { IProposalStore } from '../domains/cats/services/stores/ports/ProposalStore.js';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';
import { callbackAuthSchema } from './callback-auth-schema.js';
import { EXPIRED_CREDENTIALS_ERROR } from './callback-errors.js';

const proposeThreadCallbackSchema = callbackAuthSchema.extend({
  title: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1000),
  preferredCats: z.array(catIdSchema()).max(10).optional(),
  initialMessage: z.string().max(4000).optional(),
  parentThreadId: z.string().min(1).optional(),
  clientRequestId: z.string().min(1).max(200).optional(),
});

export interface ProposeThreadDeps {
  registry: InvocationRegistry;
  proposalStore: IProposalStore;
  threadStore: IThreadStore;
  socketManager: SocketManager;
}

export function registerCallbackProposeThreadRoutes(app: FastifyInstance, deps: ProposeThreadDeps): void {
  const { registry, proposalStore, threadStore, socketManager } = deps;

  app.post('/api/callbacks/propose-thread', async (request, reply) => {
    const parsed = proposeThreadCallbackSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }

    const { invocationId, callbackToken, title, reason, preferredCats, initialMessage, parentThreadId, clientRequestId } =
      parsed.data;
    const record = registry.verify(invocationId, callbackToken);
    if (!record) {
      reply.status(401);
      return EXPIRED_CREDENTIALS_ERROR;
    }

    if (!registry.isLatest(invocationId)) {
      return { status: 'stale_ignored' };
    }

    // Idempotency: same (userId, clientRequestId) → same proposalId.
    if (clientRequestId) {
      const cached = await proposalStore.getDedupProposalId(record.userId, clientRequestId);
      if (cached) {
        const proposal = await proposalStore.get(cached);
        if (proposal) {
          return { proposalId: proposal.proposalId, status: proposal.status, deduped: true };
        }
      }
    }

    // Resolve parent thread: explicit value (with ownership check) or source-thread fallback.
    const sourceThread = await threadStore.get(record.threadId);
    if (!sourceThread) {
      reply.status(404);
      return { error: 'Source thread not found' };
    }

    let resolvedParentThreadId = record.threadId;
    if (parentThreadId && parentThreadId !== record.threadId) {
      const parent = await threadStore.get(parentThreadId);
      if (!parent || parent.createdBy !== record.userId) {
        reply.status(403);
        return { error: 'parentThreadId does not belong to the current user' };
      }
      resolvedParentThreadId = parentThreadId;
    }

    const proposal = await proposalStore.create({
      sourceThreadId: record.threadId,
      sourceInvocationId: invocationId,
      sourceCatId: record.catId,
      title,
      reason,
      parentThreadId: resolvedParentThreadId,
      preferredCats: (preferredCats ?? []) as CatId[],
      projectPath: sourceThread.projectPath,
      createdBy: record.userId,
      ...(initialMessage ? { initialMessage } : {}),
    });

    if (clientRequestId) {
      await proposalStore.rememberDedup(record.userId, clientRequestId, proposal.proposalId);
    }

    socketManager.emitToUser(record.userId, 'proposal_created', { proposal });

    return { proposalId: proposal.proposalId, status: proposal.status };
  });
}
