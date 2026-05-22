/**
 * F128 Proposal Store
 * Cats propose threads; users approve/reject. Proposal is the persistent
 * record across the propose-approve flow.
 */

import type { CatId, ProposalApproveOverrides, ThreadProposal } from '@cat-cafe/shared';
import { generateProposalId } from '@cat-cafe/shared';

export interface CreateProposalInput {
  sourceThreadId: string;
  sourceInvocationId: string;
  sourceCatId: CatId;
  title: string;
  reason: string;
  parentThreadId: string;
  preferredCats: CatId[];
  projectPath: string;
  initialMessage?: string;
  createdBy: string;
}

export interface ApproveProposalInput {
  proposalId: string;
  approvedBy: string;
  createdThreadId: string;
  overrides?: ProposalApproveOverrides;
}

export interface RejectProposalInput {
  proposalId: string;
  rejectedBy: string;
  rejectionReason?: string;
}

export interface IProposalStore {
  create(input: CreateProposalInput): ThreadProposal | Promise<ThreadProposal>;
  get(proposalId: string): ThreadProposal | null | Promise<ThreadProposal | null>;
  listByUser(userId: string, limit?: number): ThreadProposal[] | Promise<ThreadProposal[]>;
  listPending(userId: string, limit?: number): ThreadProposal[] | Promise<ThreadProposal[]>;
  listByThread(threadId: string, limit?: number): ThreadProposal[] | Promise<ThreadProposal[]>;
  markApproved(input: ApproveProposalInput): ThreadProposal | null | Promise<ThreadProposal | null>;
  markRejected(input: RejectProposalInput): ThreadProposal | null | Promise<ThreadProposal | null>;
  /** Idempotency: return cached proposalId for (userId, clientRequestId) if any. */
  getDedupProposalId(userId: string, clientRequestId: string): string | null | Promise<string | null>;
  /** Idempotency: record (userId, clientRequestId) → proposalId mapping with short TTL. */
  rememberDedup(userId: string, clientRequestId: string, proposalId: string): void | Promise<void>;
}

const DEFAULT_LIST_LIMIT = 100;

/**
 * In-memory implementation for tests and single-process dev.
 */
export class InMemoryProposalStore implements IProposalStore {
  private readonly proposals: Map<string, ThreadProposal> = new Map();
  private readonly dedupCache: Map<string, string> = new Map();

  create(input: CreateProposalInput): ThreadProposal {
    const now = Date.now();
    const proposal: ThreadProposal = {
      proposalId: generateProposalId(),
      status: 'pending',
      sourceThreadId: input.sourceThreadId,
      sourceInvocationId: input.sourceInvocationId,
      sourceCatId: input.sourceCatId,
      title: input.title,
      reason: input.reason,
      parentThreadId: input.parentThreadId,
      preferredCats: [...input.preferredCats],
      projectPath: input.projectPath,
      createdBy: input.createdBy,
      createdAt: now,
      ...(input.initialMessage ? { initialMessage: input.initialMessage } : {}),
    };
    this.proposals.set(proposal.proposalId, proposal);
    return cloneProposal(proposal);
  }

  get(proposalId: string): ThreadProposal | null {
    const found = this.proposals.get(proposalId);
    return found ? cloneProposal(found) : null;
  }

  listByUser(userId: string, limit: number = DEFAULT_LIST_LIMIT): ThreadProposal[] {
    return this.collect((p) => p.createdBy === userId, limit);
  }

  listPending(userId: string, limit: number = DEFAULT_LIST_LIMIT): ThreadProposal[] {
    return this.collect((p) => p.createdBy === userId && p.status === 'pending', limit);
  }

  listByThread(threadId: string, limit: number = DEFAULT_LIST_LIMIT): ThreadProposal[] {
    return this.collect((p) => p.sourceThreadId === threadId, limit);
  }

  markApproved(input: ApproveProposalInput): ThreadProposal | null {
    const proposal = this.proposals.get(input.proposalId);
    if (!proposal || proposal.status !== 'pending') return null;
    proposal.status = 'approved';
    proposal.approvedBy = input.approvedBy;
    proposal.approvedAt = Date.now();
    proposal.createdThreadId = input.createdThreadId;
    if (input.overrides?.title !== undefined) proposal.title = input.overrides.title;
    if (input.overrides?.parentThreadId !== undefined) {
      proposal.parentThreadId = input.overrides.parentThreadId;
    }
    if (input.overrides?.preferredCats !== undefined) {
      proposal.preferredCats = [...input.overrides.preferredCats];
    }
    if (input.overrides?.initialMessage === null) {
      delete proposal.initialMessage;
    } else if (typeof input.overrides?.initialMessage === 'string') {
      proposal.initialMessage = input.overrides.initialMessage;
    }
    return cloneProposal(proposal);
  }

  markRejected(input: RejectProposalInput): ThreadProposal | null {
    const proposal = this.proposals.get(input.proposalId);
    if (!proposal || proposal.status !== 'pending') return null;
    proposal.status = 'rejected';
    proposal.rejectedBy = input.rejectedBy;
    proposal.rejectedAt = Date.now();
    if (input.rejectionReason) proposal.rejectionReason = input.rejectionReason;
    return cloneProposal(proposal);
  }

  getDedupProposalId(userId: string, clientRequestId: string): string | null {
    return this.dedupCache.get(dedupKey(userId, clientRequestId)) ?? null;
  }

  rememberDedup(userId: string, clientRequestId: string, proposalId: string): void {
    this.dedupCache.set(dedupKey(userId, clientRequestId), proposalId);
  }

  private collect(predicate: (p: ThreadProposal) => boolean, limit: number): ThreadProposal[] {
    const result: ThreadProposal[] = [];
    for (const proposal of this.proposals.values()) {
      if (predicate(proposal)) result.push(cloneProposal(proposal));
    }
    result.sort((a, b) => b.createdAt - a.createdAt);
    return result.slice(0, Math.max(0, limit));
  }
}

function dedupKey(userId: string, clientRequestId: string): string {
  return `${userId}::${clientRequestId}`;
}

function cloneProposal(proposal: ThreadProposal): ThreadProposal {
  return {
    ...proposal,
    preferredCats: [...proposal.preferredCats],
  };
}
