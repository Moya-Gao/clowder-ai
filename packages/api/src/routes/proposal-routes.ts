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

    const thread = await threadStore.create(userId, finalTitle, proposal.projectPath, finalParentThreadId);
    if (finalPreferredCats.length > 0) {
      await threadStore.updatePreferredCats(thread.id, finalPreferredCats);
    }

    const marked = await proposalStore.markApproved({
      proposalId: proposal.proposalId,
      approvedBy: userId,
      createdThreadId: thread.id,
      overrides: {
        title: finalTitle,
        parentThreadId: finalParentThreadId,
        preferredCats: finalPreferredCats,
        initialMessage: finalInitialMessage === undefined ? null : finalInitialMessage,
      },
    });
    if (!marked) {
      reply.status(409);
      return { error: 'Proposal status changed concurrently — retry approve' };
    }

    if (finalInitialMessage) {
      await messageStore.append({
        threadId: thread.id,
        sender: 'user',
        senderId: userId,
        content: { type: 'text', text: finalInitialMessage },
      });
    }

    const updatedThread = (await threadStore.get(thread.id)) ?? thread;
    socketManager.emitToUser(userId, 'thread_created', { thread: updatedThread });
    socketManager.emitToUser(userId, 'proposal_updated', { proposal: marked });

    return {
      proposalId: marked.proposalId,
      threadId: thread.id,
      status: marked.status,
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

    socketManager.emitToUser(userId, 'proposal_updated', { proposal: marked });

    return { proposalId: marked.proposalId, status: marked.status };
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
