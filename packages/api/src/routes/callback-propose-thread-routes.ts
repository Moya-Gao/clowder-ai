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

import type { CatId, RichCardBlock, ThreadProposal } from '@cat-cafe/shared';
import { catIdSchema, generateProposalId } from '@cat-cafe/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { InvocationRegistry } from '../domains/cats/services/agents/invocation/InvocationRegistry.js';
import type { IMessageStore } from '../domains/cats/services/stores/ports/MessageStore.js';
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
  messageStore: IMessageStore;
  socketManager: SocketManager;
}

export function buildProposalCardBlock(proposal: ThreadProposal): RichCardBlock {
  const fields: Array<{ label: string; value: string }> = [
    { label: '父 Thread', value: proposal.parentThreadId },
    {
      label: '建议成员',
      value: proposal.preferredCats.length > 0 ? proposal.preferredCats.join(', ') : '（未指定）',
    },
  ];
  if (proposal.initialMessage) fields.push({ label: '首条消息', value: proposal.initialMessage });
  return {
    id: `proposal-${proposal.proposalId}`,
    kind: 'card',
    v: 1,
    title: `📥 提议新建 thread：${proposal.title}`,
    bodyMarkdown: proposal.reason,
    tone: 'info',
    fields,
    actions: [
      { label: '批准并创建', action: 'propose:approve', payload: { proposalId: proposal.proposalId } },
      { label: '驳回', action: 'propose:reject', payload: { proposalId: proposal.proposalId } },
    ],
  };
}

export function registerCallbackProposeThreadRoutes(app: FastifyInstance, deps: ProposeThreadDeps): void {
  const { registry, proposalStore, threadStore, messageStore, socketManager } = deps;

  app.post('/api/callbacks/propose-thread', async (request, reply) => {
    const parsed = proposeThreadCallbackSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parsed.error.issues };
    }

    const {
      invocationId,
      callbackToken,
      title,
      reason,
      preferredCats,
      initialMessage,
      parentThreadId,
      clientRequestId,
    } = parsed.data;
    const record = registry.verify(invocationId, callbackToken);
    if (!record) {
      reply.status(401);
      return EXPIRED_CREDENTIALS_ERROR;
    }

    if (!registry.isLatest(invocationId)) {
      return { status: 'stale_ignored' };
    }

    // Idempotency fast path: same (userId, clientRequestId) → return existing proposal.
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

    // P2: Reserve dedup BEFORE create. Pre-generate a candidate proposalId, then atomically
    // SET NX. The loser of a concurrent retry must NOT create anything (otherwise the pending
    // list grows by N for N concurrent retries even though they share one clientRequestId).
    let proposalId: string;
    let reservedDedup = false;
    if (clientRequestId) {
      const candidate = generateProposalId();
      const winningId = await proposalStore.reserveDedup(record.userId, clientRequestId, candidate);
      if (winningId !== candidate) {
        // Loser path. We can return a deduped success ONLY if the winner's proposal is real.
        // If the winner crashed between reserve and create, the dedup key points at nothing —
        // returning a phantom success would mislead the caller (they'd see no card / no proposal
        // to GET). Tell them to retry; once the winner's release_on_failure cleanup runs,
        // retries will reclaim the key and succeed.
        const canonical = await proposalStore.get(winningId);
        if (!canonical) {
          reply.status(503);
          reply.header('retry-after', '1');
          return {
            error: 'Proposal reservation in-flight by a concurrent request; retry shortly',
            status: 'retryable',
          };
        }
        return {
          proposalId: winningId,
          status: canonical.status,
          deduped: true,
        };
      }
      proposalId = candidate;
      reservedDedup = true;
    } else {
      proposalId = generateProposalId();
    }

    let proposal: ThreadProposal;
    try {
      proposal = await proposalStore.create({
        proposalId,
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
    } catch (err) {
      // Critical: if we reserved a dedup key but failed to create the proposal it points at,
      // release the reservation so the caller's retry can claim it. Without this, the key stays
      // a phantom pointer for the dedup TTL window.
      if (reservedDedup && clientRequestId) {
        try {
          await proposalStore.releaseDedup(record.userId, clientRequestId, proposalId);
        } catch {
          // best-effort cleanup; surface the original error
        }
      }
      throw err;
    }

    // Render the proposal as a card in the source thread so the user sees + acts on it.
    const cardBlock = buildProposalCardBlock(proposal);
    const stored = await messageStore.append({
      userId: record.userId,
      catId: record.catId,
      content: `提议新建 thread：${title}`,
      mentions: [],
      timestamp: Date.now(),
      threadId: record.threadId,
      extra: { rich: { v: 1 as const, blocks: [cardBlock] } },
    });
    socketManager.broadcastToRoom(`thread:${record.threadId}`, 'connector_message', {
      threadId: record.threadId,
      message: {
        id: stored.id,
        type: 'cat',
        catId: record.catId,
        content: stored.content,
        timestamp: stored.timestamp,
        extra: stored.extra,
      },
    });
    socketManager.emitToUser(record.userId, 'proposal_created', proposal);

    return { proposalId: proposal.proposalId, status: proposal.status, messageId: stored.id };
  });
}
