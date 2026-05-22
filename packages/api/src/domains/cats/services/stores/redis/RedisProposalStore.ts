/**
 * Redis-backed F128 Proposal store.
 *
 * Data structures:
 * - Hash proposal:{proposalId} — proposal fields
 * - SortedSet proposals:user:{userId} — all proposals for user (score=createdAt)
 * - SortedSet proposals:pending:{userId} — pending-only ids (zrem on approve/reject)
 * - SortedSet proposals:thread:{threadId} — proposals proposed in a thread
 * - String dedup:propose:{userId}:{clientRequestId} → proposalId (short TTL)
 *
 * IMPORTANT: ioredis keyPrefix auto-prefixes ALL commands.
 */

import type { CatId, ProposalApproveOverrides, ProposalStatus, ThreadProposal } from '@cat-cafe/shared';
import { generateProposalId } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import type {
  ClaimForApprovalInput,
  CreateProposalInput,
  FinalizeApprovalInput,
  IProposalStore,
  RejectProposalInput,
} from '../ports/ProposalStore.js';
import { ProposalKeys } from '../redis-keys/proposal-keys.js';

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const DEFAULT_DEDUP_TTL_SECONDS = 10 * 60; // 10 minutes
const DEFAULT_LIST_LIMIT = 100;

/**
 * CAS Lua: atomically check current status matches expected → HSET fields + ZREM/ZADD pending index.
 * KEYS[1] = proposal:{id}, KEYS[2] = proposals:pending:{userId}
 * ARGV[1] = proposalId
 * ARGV[2] = expected status (e.g. "pending")
 * ARGV[3] = pending-index action: "zrem" | "zadd" | "noop"
 * ARGV[4] = score for zadd (createdAt), required when action="zadd"
 * ARGV[5..N] = HSET field/value pairs
 * Returns 1 on success, 0 if current status doesn't match expected.
 */
const CAS_TRANSITION_LUA = `
local current = redis.call('HGET', KEYS[1], 'status')
if current ~= ARGV[2] then
  return 0
end
local fields = {}
for i = 5, #ARGV do
  fields[#fields + 1] = ARGV[i]
end
if #fields > 0 then
  redis.call('HSET', KEYS[1], unpack(fields))
end
if ARGV[3] == 'zrem' then
  redis.call('ZREM', KEYS[2], ARGV[1])
elseif ARGV[3] == 'zadd' then
  redis.call('ZADD', KEYS[2], ARGV[4], ARGV[1])
end
return 1
`;

export class RedisProposalStore implements IProposalStore {
  private readonly redis: RedisClient;
  private readonly ttlSeconds: number | null;
  private readonly dedupTtlSeconds: number;

  constructor(redis: RedisClient, options?: { ttlSeconds?: number; dedupTtlSeconds?: number }) {
    this.redis = redis;
    const ttl = options?.ttlSeconds;
    if (ttl === undefined) this.ttlSeconds = DEFAULT_TTL_SECONDS;
    else if (!Number.isFinite(ttl) || ttl <= 0) this.ttlSeconds = null;
    else this.ttlSeconds = Math.floor(ttl);
    this.dedupTtlSeconds = options?.dedupTtlSeconds ?? DEFAULT_DEDUP_TTL_SECONDS;
  }

  async create(input: CreateProposalInput): Promise<ThreadProposal> {
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

    const key = ProposalKeys.detail(proposal.proposalId);
    const pipeline = this.redis.multi();
    pipeline.hset(key, ...this.serialize(proposal));
    if (this.ttlSeconds) pipeline.expire(key, this.ttlSeconds);
    pipeline.zadd(ProposalKeys.userList(proposal.createdBy), String(now), proposal.proposalId);
    pipeline.zadd(ProposalKeys.userPending(proposal.createdBy), String(now), proposal.proposalId);
    pipeline.zadd(ProposalKeys.threadList(proposal.sourceThreadId), String(now), proposal.proposalId);
    await pipeline.exec();
    return proposal;
  }

  async get(proposalId: string): Promise<ThreadProposal | null> {
    const data = await this.redis.hgetall(ProposalKeys.detail(proposalId));
    if (!data || !data.proposalId) return null;
    return this.hydrate(data);
  }

  async listByUser(userId: string, limit: number = DEFAULT_LIST_LIMIT): Promise<ThreadProposal[]> {
    return this.loadFromIndex(ProposalKeys.userList(userId), limit);
  }

  async listPending(userId: string, limit: number = DEFAULT_LIST_LIMIT): Promise<ThreadProposal[]> {
    return this.loadFromIndex(ProposalKeys.userPending(userId), limit);
  }

  async listByThread(threadId: string, limit: number = DEFAULT_LIST_LIMIT): Promise<ThreadProposal[]> {
    return this.loadFromIndex(ProposalKeys.threadList(threadId), limit);
  }

  async claimForApproval(input: ClaimForApprovalInput): Promise<ThreadProposal | null> {
    const proposal = await this.get(input.proposalId);
    if (!proposal || proposal.status !== 'pending') return null;
    const ok = await this.casTransition(proposal.proposalId, proposal.createdBy, 'pending', 'zrem', '', [
      'status',
      'approving',
      'approvedBy',
      input.approvedBy,
    ]);
    if (!ok) return null;
    return { ...proposal, status: 'approving', approvedBy: input.approvedBy };
  }

  async finalizeApproval(input: FinalizeApprovalInput): Promise<ThreadProposal | null> {
    const proposal = await this.get(input.proposalId);
    if (!proposal || proposal.status !== 'approving') return null;
    const now = Date.now();
    const updated = applyFinalize(proposal, input, now);
    const pairs = this.finalizedFields(updated);
    const ok = await this.casTransition(updated.proposalId, updated.createdBy, 'approving', 'noop', '', pairs);
    return ok ? updated : null;
  }

  async rollbackClaim(proposalId: string): Promise<boolean> {
    const proposal = await this.get(proposalId);
    if (!proposal || proposal.status !== 'approving') return false;
    return this.casTransition(
      proposal.proposalId,
      proposal.createdBy,
      'approving',
      'zadd',
      String(proposal.createdAt),
      ['status', 'pending', 'approvedBy', ''],
    );
  }

  async markRejected(input: RejectProposalInput): Promise<ThreadProposal | null> {
    const proposal = await this.get(input.proposalId);
    if (!proposal || proposal.status !== 'pending') return null;
    const now = Date.now();
    const updated: ThreadProposal = {
      ...proposal,
      status: 'rejected',
      rejectedBy: input.rejectedBy,
      rejectedAt: now,
      ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
    };
    const pairs = ['status', 'rejected', 'rejectedBy', input.rejectedBy, 'rejectedAt', String(now)];
    if (input.rejectionReason) pairs.push('rejectionReason', input.rejectionReason);
    const ok = await this.casTransition(updated.proposalId, updated.createdBy, 'pending', 'zrem', '', pairs);
    return ok ? updated : null;
  }

  async getDedupProposalId(userId: string, clientRequestId: string): Promise<string | null> {
    return this.redis.get(ProposalKeys.dedup(userId, clientRequestId));
  }

  /** Atomic SET NX: returns the value actually stored (newly set or existing). */
  async reserveDedup(userId: string, clientRequestId: string, proposalId: string): Promise<string> {
    const key = ProposalKeys.dedup(userId, clientRequestId);
    const result = await this.redis.set(key, proposalId, 'EX', this.dedupTtlSeconds, 'NX');
    if (result === 'OK') return proposalId;
    const existing = await this.redis.get(key);
    return existing ?? proposalId;
  }

  private async casTransition(
    proposalId: string,
    userId: string,
    expectedStatus: ProposalStatus,
    pendingIndexAction: 'zrem' | 'zadd' | 'noop',
    zaddScore: string,
    fieldPairs: string[],
  ): Promise<boolean> {
    const result = (await this.redis.eval(
      CAS_TRANSITION_LUA,
      2,
      ProposalKeys.detail(proposalId),
      ProposalKeys.userPending(userId),
      proposalId,
      expectedStatus,
      pendingIndexAction,
      zaddScore,
      ...fieldPairs,
    )) as number;
    return result === 1;
  }

  private finalizedFields(updated: ThreadProposal): string[] {
    const fields: string[] = [
      'status',
      'approved',
      'approvedAt',
      String(updated.approvedAt ?? 0),
      'title',
      updated.title,
      'parentThreadId',
      updated.parentThreadId,
      'preferredCats',
      JSON.stringify(updated.preferredCats),
    ];
    if (updated.createdThreadId) fields.push('createdThreadId', updated.createdThreadId);
    if (updated.initialMessage !== undefined) {
      fields.push('initialMessage', updated.initialMessage);
    } else {
      fields.push('initialMessage', '');
    }
    return fields;
  }

  private async loadFromIndex(indexKey: string, limit: number): Promise<ThreadProposal[]> {
    const ids = await this.redis.zrevrange(indexKey, 0, Math.max(0, limit - 1));
    if (ids.length === 0) return [];
    const pipeline = this.redis.pipeline();
    for (const id of ids) pipeline.hgetall(ProposalKeys.detail(id));
    const results = await pipeline.exec();
    if (!results) return [];
    const records: ThreadProposal[] = [];
    for (const [err, data] of results) {
      if (err || !data || typeof data !== 'object') continue;
      const d = data as Record<string, string>;
      if (!d.proposalId) continue;
      records.push(this.hydrate(d));
    }
    return records;
  }

  private serialize(proposal: ThreadProposal): string[] {
    const fields: string[] = [
      'proposalId',
      proposal.proposalId,
      'status',
      proposal.status,
      'sourceThreadId',
      proposal.sourceThreadId,
      'sourceInvocationId',
      proposal.sourceInvocationId,
      'sourceCatId',
      proposal.sourceCatId,
      'title',
      proposal.title,
      'reason',
      proposal.reason,
      'parentThreadId',
      proposal.parentThreadId,
      'preferredCats',
      JSON.stringify(proposal.preferredCats),
      'projectPath',
      proposal.projectPath,
      'createdBy',
      proposal.createdBy,
      'createdAt',
      String(proposal.createdAt),
    ];
    if (proposal.initialMessage) fields.push('initialMessage', proposal.initialMessage);
    return fields;
  }

  private hydrate(data: Record<string, string>): ThreadProposal {
    const preferredCats = parseCatArray(data.preferredCats);
    const initialMessage = data.initialMessage && data.initialMessage.length > 0 ? data.initialMessage : undefined;
    const proposal: ThreadProposal = {
      proposalId: data.proposalId!,
      status: (data.status ?? 'pending') as ProposalStatus,
      sourceThreadId: data.sourceThreadId!,
      sourceInvocationId: data.sourceInvocationId!,
      sourceCatId: data.sourceCatId! as CatId,
      title: data.title!,
      reason: data.reason!,
      parentThreadId: data.parentThreadId!,
      preferredCats,
      projectPath: data.projectPath!,
      createdBy: data.createdBy!,
      createdAt: parseInt(data.createdAt!, 10),
    };
    if (initialMessage) proposal.initialMessage = initialMessage;
    if (data.approvedBy) proposal.approvedBy = data.approvedBy;
    if (data.approvedAt) proposal.approvedAt = parseInt(data.approvedAt, 10);
    if (data.createdThreadId) proposal.createdThreadId = data.createdThreadId;
    if (data.rejectedBy) proposal.rejectedBy = data.rejectedBy;
    if (data.rejectedAt) proposal.rejectedAt = parseInt(data.rejectedAt, 10);
    if (data.rejectionReason) proposal.rejectionReason = data.rejectionReason;
    return proposal;
  }
}

function applyFinalize(proposal: ThreadProposal, input: FinalizeApprovalInput, now: number): ThreadProposal {
  const updated: ThreadProposal = {
    ...proposal,
    status: 'approved',
    approvedAt: now,
    createdThreadId: input.createdThreadId,
  };
  applyOverrides(updated, input.overrides);
  return updated;
}

function applyOverrides(proposal: ThreadProposal, overrides: ProposalApproveOverrides | undefined): void {
  if (!overrides) return;
  if (overrides.title !== undefined) proposal.title = overrides.title;
  if (overrides.parentThreadId !== undefined) proposal.parentThreadId = overrides.parentThreadId;
  if (overrides.preferredCats !== undefined) proposal.preferredCats = [...overrides.preferredCats];
  if (overrides.initialMessage === null) delete proposal.initialMessage;
  else if (typeof overrides.initialMessage === 'string') proposal.initialMessage = overrides.initialMessage;
}

function parseCatArray(raw: string | undefined): CatId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry as CatId);
  } catch {
    return [];
  }
}
