/**
 * F128 User-side proposal endpoints.
 *
 * POST /api/proposals/:proposalId/approve  — create thread + mark proposal approved
 * POST /api/proposals/:proposalId/reject   — mark proposal rejected
 * GET  /api/proposals/pending              — list user's pending proposals
 *
 * All routes require user auth via X-Cat-Cafe-User. The cat-side propose
 * route lives in callback-propose-thread-routes.ts.
 */

import type { CatId } from '@cat-cafe/shared';
import { catIdSchema } from '@cat-cafe/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IMessageStore } from '../domains/cats/services/stores/ports/MessageStore.js';
import type { IProposalStore } from '../domains/cats/services/stores/ports/ProposalStore.js';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';
import { resolveUserId } from '../utils/request-identity.js';

/**
 * Age threshold past which an `approving` claim is considered abandoned
 * (process crash / aborted request between claimForApproval and finalize/rollback).
 * Normal flow completes in well under a second; 30s leaves generous headroom.
 */
const STALE_APPROVING_MS = 30_000;

export interface ProposalRoutesOptions {
  proposalStore: IProposalStore;
  threadStore: IThreadStore;
  messageStore: IMessageStore;
  socketManager: SocketManager;
}

const approveBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    parentThreadId: z.string().min(1).optional(),
    preferredCats: z.array(catIdSchema()).max(10).optional(),
    initialMessage: z.string().max(4000).nullable().optional(),
  })
  .strict();

const rejectBodySchema = z
  .object({
    rejectionReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

const proposalParamsSchema = z.object({
  proposalId: z.string().min(1).max(200),
});

export const proposalRoutes: FastifyPluginAsync<ProposalRoutesOptions> = async (app, opts) => {
  const { proposalStore, threadStore, messageStore, socketManager } = opts;

  app.post('/api/proposals/:proposalId/approve', async (request, reply) => {
    const paramsParse = proposalParamsSchema.safeParse(request.params);
    if (!paramsParse.success) {
      reply.status(400);
      return { error: 'Invalid proposalId' };
    }
    const bodyParse = approveBodySchema.safeParse(request.body ?? {});
    if (!bodyParse.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: bodyParse.error.issues };
    }
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

    const proposal = await proposalStore.get(paramsParse.data.proposalId);
    if (!proposal) {
      reply.status(404);
      return { error: 'Proposal not found' };
    }
    if (proposal.createdBy !== userId) {
      reply.status(403);
      return { error: 'Proposal does not belong to the current user' };
    }
    if (proposal.status === 'rejected') {
      reply.status(409);
      return { error: 'Proposal already rejected', status: proposal.status };
    }
    if (proposal.status === 'approved' && proposal.createdThreadId) {
      return {
        proposalId: proposal.proposalId,
        threadId: proposal.createdThreadId,
        status: proposal.status,
        deduped: true,
      };
    }
    if (proposal.status === 'approving') {
      // Stale-claim recovery: if the previous claim is older than the stale window, the
      // claimer almost certainly crashed (claim → finalize is a sub-second window in practice).
      // Force a rollback so the current request can re-claim. This prevents permanent stuck
      // state from process crashes between claimForApproval and finalize/rollback.
      const ageMs = proposal.claimedAt ? Date.now() - proposal.claimedAt : Number.POSITIVE_INFINITY;
      if (ageMs > STALE_APPROVING_MS) {
        await proposalStore.rollbackClaim(proposal.proposalId);
        // fall through — `claimForApproval` below will re-take the claim
      } else {
        reply.status(409);
        return { error: 'Proposal is being approved by another request; retry shortly', status: proposal.status };
      }
    }

    const overrides = bodyParse.data;
    const finalTitle = overrides.title ?? proposal.title;
    let finalParentThreadId = overrides.parentThreadId ?? proposal.parentThreadId;
    if (overrides.parentThreadId && overrides.parentThreadId !== proposal.parentThreadId) {
      const parent = await threadStore.get(overrides.parentThreadId);
      if (!parent || parent.createdBy !== userId) {
        reply.status(403);
        return { error: 'parentThreadId does not belong to the current user' };
      }
      finalParentThreadId = overrides.parentThreadId;
    }
    const finalPreferredCats = (overrides.preferredCats ?? proposal.preferredCats) as CatId[];
    const finalInitialMessage = resolveInitialMessage(proposal.initialMessage, overrides.initialMessage);

    // Atomic claim — guards against concurrent approve/reject leaving an orphan thread.
    const claimed = await proposalStore.claimForApproval({ proposalId: proposal.proposalId, approvedBy: userId });
    if (!claimed) {
      reply.status(409);
      return { error: 'Proposal status changed concurrently — retry approve' };
    }

    // Stage 1: create the thread. Only this step is allowed to rollback the claim,
    // because nothing user-visible has been committed yet.
    let thread;
    try {
      thread = await threadStore.create(userId, finalTitle, proposal.projectPath, finalParentThreadId, {
        createdFromProposalId: proposal.proposalId,
        sourceThreadId: proposal.sourceThreadId,
        approvedBy: userId,
        approvedAt: Date.now(),
      });
    } catch (err) {
      await proposalStore.rollbackClaim(proposal.proposalId);
      throw err;
    }

    // Stage 2: finalize the proposal NOW that a real threadId exists. After this point,
    // any side-effect failure is reported as a warning — the proposal must NOT roll back
    // (that would leave an orphan thread).
    const finalized = await proposalStore.finalizeApproval({
      proposalId: proposal.proposalId,
      createdThreadId: thread.id,
      overrides: {
        title: finalTitle,
        parentThreadId: finalParentThreadId,
        preferredCats: finalPreferredCats,
        initialMessage: finalInitialMessage === undefined ? null : finalInitialMessage,
      },
    });
    if (!finalized) {
      // Should not happen — we hold the approving claim. Surface as 500; thread is intentionally
      // kept (writing finalize is the only contract violation here, not the thread itself).
      reply.status(500);
      return { error: 'Proposal finalize failed unexpectedly after claim', threadId: thread.id };
    }

    // Stage 3: best-effort side effects. Failures become warnings, not 500s.
    const warnings: string[] = [];
    if (finalPreferredCats.length > 0) {
      try {
        await threadStore.updatePreferredCats(thread.id, finalPreferredCats);
      } catch (err) {
        warnings.push(`updatePreferredCats failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (finalInitialMessage) {
      try {
        await messageStore.append({
          userId,
          catId: null,
          content: finalInitialMessage,
          mentions: [],
          timestamp: Date.now(),
          threadId: thread.id,
        });
      } catch (err) {
        warnings.push(`initialMessage append failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const updatedThread = (await threadStore.get(thread.id)) ?? thread;
    socketManager.emitToUser(userId, 'thread_created', updatedThread);
    socketManager.emitToUser(userId, 'proposal_updated', finalized);

    return {
      proposalId: finalized.proposalId,
      threadId: thread.id,
      status: finalized.status,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  });

  app.post('/api/proposals/:proposalId/reject', async (request, reply) => {
    const paramsParse = proposalParamsSchema.safeParse(request.params);
    if (!paramsParse.success) {
      reply.status(400);
      return { error: 'Invalid proposalId' };
    }
    const bodyParse = rejectBodySchema.safeParse(request.body ?? {});
    if (!bodyParse.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: bodyParse.error.issues };
    }
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

    const proposal = await proposalStore.get(paramsParse.data.proposalId);
    if (!proposal) {
      reply.status(404);
      return { error: 'Proposal not found' };
    }
    if (proposal.createdBy !== userId) {
      reply.status(403);
      return { error: 'Proposal does not belong to the current user' };
    }
    if (proposal.status === 'approved') {
      reply.status(409);
      return { error: 'Proposal already approved', status: proposal.status };
    }
    if (proposal.status === 'approving') {
      // Same stale-claim recovery as approve handler.
      const ageMs = proposal.claimedAt ? Date.now() - proposal.claimedAt : Number.POSITIVE_INFINITY;
      if (ageMs > STALE_APPROVING_MS) {
        await proposalStore.rollbackClaim(proposal.proposalId);
        // fall through — `markRejected` below will see status=pending
      } else {
        reply.status(409);
        return {
          error: 'Proposal is being approved — wait for the in-flight approve to settle',
          status: proposal.status,
        };
      }
    }
    if (proposal.status === 'rejected') {
      return { proposalId: proposal.proposalId, status: proposal.status, deduped: true };
    }

    const marked = await proposalStore.markRejected({
      proposalId: proposal.proposalId,
      rejectedBy: userId,
      ...(bodyParse.data.rejectionReason ? { rejectionReason: bodyParse.data.rejectionReason } : {}),
    });
    if (!marked) {
      reply.status(409);
      return { error: 'Proposal status changed concurrently — retry reject' };
    }

    socketManager.emitToUser(userId, 'proposal_updated', marked);

    return { proposalId: marked.proposalId, status: marked.status };
  });

  app.get('/api/proposals/:proposalId', async (request, reply) => {
    const paramsParse = proposalParamsSchema.safeParse(request.params);
    if (!paramsParse.success) {
      reply.status(400);
      return { error: 'Invalid proposalId' };
    }
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }
    const proposal = await proposalStore.get(paramsParse.data.proposalId);
    if (!proposal) {
      reply.status(404);
      return { error: 'Proposal not found' };
    }
    if (proposal.createdBy !== userId) {
      reply.status(403);
      return { error: 'Proposal does not belong to the current user' };
    }
    return { proposal };
  });

  app.get('/api/proposals/pending', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }
    const proposals = await proposalStore.listPending(userId);
    return { proposals };
  });
};

function resolveInitialMessage(
  fromProposal: string | undefined,
  override: string | null | undefined,
): string | undefined {
  if (override === undefined) return fromProposal;
  if (override === null) return undefined;
  return override;
}
