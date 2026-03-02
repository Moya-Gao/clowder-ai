import type {
  AcquireBacklogLeaseInput,
  BacklogItem,
  BacklogLease,
  CreateBacklogItemInput,
  DecideBacklogClaimInput,
  DispatchBacklogItemInput,
  HeartbeatBacklogLeaseInput,
  ReclaimBacklogLeaseInput,
  RefreshBacklogItemInput,
  ReleaseBacklogLeaseInput,
  SuggestBacklogClaimInput,
  ThreadPhase,
} from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import { generateSortableId } from '../ports/MessageStore.js';
import type { IBacklogStore } from '../ports/BacklogStore.js';
import { BacklogTransitionError } from '../ports/BacklogStore.js';
import { BacklogKeys } from '../redis-keys/backlog-keys.js';
import { makeCatActor, makeCreatorActor, makeUserActor } from '../shared/backlog-audit-actors.js';

const DEFAULT_TTL = 90 * 24 * 60 * 60; // 90 days

export class RedisBacklogStore implements IBacklogStore {
  private readonly redis: RedisClient;
  private readonly ttlSeconds: number | null;

  constructor(redis: RedisClient, options?: { ttlSeconds?: number }) {
    this.redis = redis;
    const ttl = options?.ttlSeconds;
    if (ttl === undefined) {
      this.ttlSeconds = DEFAULT_TTL;
    } else if (!Number.isFinite(ttl)) {
      this.ttlSeconds = DEFAULT_TTL;
    } else if (ttl <= 0) {
      this.ttlSeconds = null;
    } else {
      this.ttlSeconds = Math.floor(ttl);
    }
  }

  async create(input: CreateBacklogItemInput): Promise<BacklogItem> {
    const now = Date.now();
    const item: BacklogItem = {
      id: generateSortableId(now),
      userId: input.userId,
      title: input.title,
      summary: input.summary,
      priority: input.priority,
      tags: [...input.tags],
      status: 'open',
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      audit: [
        {
          id: generateSortableId(now + 1),
          action: 'created',
          actor: makeCreatorActor(input),
          timestamp: now,
          detail: input.title,
        },
      ],
    };

    await this.writeItem(item);
    const pipeline = this.redis.multi();
    pipeline.zadd(BacklogKeys.userList(item.userId), String(item.createdAt), item.id);
    if (this.ttlSeconds !== null) {
      pipeline.expire(BacklogKeys.userList(item.userId), this.ttlSeconds);
    }
    await pipeline.exec();
    return item;
  }

  async refreshMetadata(itemId: string, input: RefreshBacklogItemInput): Promise<BacklogItem | null> {
    const existing = await this.get(itemId);
    if (!existing) return null;

    const unchanged = existing.title === input.title
      && existing.summary === input.summary
      && existing.priority === input.priority
      && this.sameTags(existing.tags, input.tags);
    if (unchanged) return existing;

    const now = Date.now();
    const updated: BacklogItem = {
      ...existing,
      title: input.title,
      summary: input.summary,
      priority: input.priority,
      tags: [...input.tags],
      updatedAt: now,
      audit: [
        ...existing.audit,
        {
          id: generateSortableId(now + 1),
          action: 'refreshed',
          actor: makeUserActor(input.refreshedBy),
          timestamp: now,
          detail: 'docs-backlog-sync',
        },
      ],
    };
    await this.writeItem(updated);
    return updated;
  }

  async get(itemId: string, userId?: string): Promise<BacklogItem | null> {
    const data = await this.redis.hgetall(BacklogKeys.detail(itemId));
    if (!data || !data['id']) return null;
    const item = this.hydrateItem(data);
    if (userId && item.userId !== userId) return null;
    return item;
  }

  async listByUser(userId: string): Promise<BacklogItem[]> {
    const ids = await this.redis.zrevrange(BacklogKeys.userList(userId), 0, -1);
    if (ids.length === 0) return [];

    const pipeline = this.redis.multi();
    for (const id of ids) {
      pipeline.hgetall(BacklogKeys.detail(id));
    }
    const rows = await pipeline.exec();
    if (!rows) return [];

    const result: BacklogItem[] = [];
    for (const [err, data] of rows) {
      if (err || !data || typeof data !== 'object') continue;
      const row = data as Record<string, string>;
      if (!row['id']) continue;
      result.push(this.hydrateItem(row));
    }
    return result;
  }

  async suggestClaim(itemId: string, input: SuggestBacklogClaimInput): Promise<BacklogItem | null> {
    const existing = await this.get(itemId);
    if (!existing) return null;
    if (existing.status !== 'open') {
      throw new BacklogTransitionError('Invalid backlog transition: only open items can be suggested');
    }

    const now = Date.now();
    const updated: BacklogItem = {
      ...existing,
      status: 'suggested',
      suggestion: {
        catId: input.catId,
        why: input.why,
        plan: input.plan,
        requestedPhase: input.requestedPhase,
        status: 'pending',
        suggestedAt: now,
      },
      updatedAt: now,
      audit: [
        ...existing.audit,
        {
          id: generateSortableId(now + 1),
          action: 'suggested',
          actor: makeCatActor(input.catId),
          timestamp: now,
          detail: input.plan,
        },
      ],
    };

    await this.writeItem(updated);
    return updated;
  }

  async decideClaim(itemId: string, input: DecideBacklogClaimInput): Promise<BacklogItem | null> {
    const existing = await this.get(itemId);
    if (!existing) return null;
    if (existing.status !== 'suggested' || !existing.suggestion || existing.suggestion.status !== 'pending') {
      throw new BacklogTransitionError('Invalid backlog transition: item is not waiting for decision');
    }

    const now = Date.now();
    if (input.decision === 'reject') {
      const rejectedSuggestionBase = {
        ...existing.suggestion,
        status: 'rejected' as const,
        decidedAt: now,
        decidedBy: input.decidedBy,
      };
      const rejectedSuggestion = input.note
        ? { ...rejectedSuggestionBase, note: input.note }
        : rejectedSuggestionBase;
      const rejectAuditBase = {
        id: generateSortableId(now + 1),
        action: 'rejected' as const,
        actor: makeUserActor(input.decidedBy),
        timestamp: now,
      };
      const rejectAudit = input.note
        ? { ...rejectAuditBase, detail: input.note }
        : rejectAuditBase;
      const updated: BacklogItem = {
        ...existing,
        status: 'open',
        suggestion: rejectedSuggestion,
        updatedAt: now,
        audit: [
          ...existing.audit,
          rejectAudit,
        ],
      };
      await this.writeItem(updated);
      return updated;
    }

    const approvedSuggestionBase = {
      ...existing.suggestion,
      status: 'approved' as const,
      decidedAt: now,
      decidedBy: input.decidedBy,
    };
    const approvedSuggestion = input.note
      ? { ...approvedSuggestionBase, note: input.note }
      : approvedSuggestionBase;
    const approveAuditBase = {
      id: generateSortableId(now + 1),
      action: 'approved' as const,
      actor: makeUserActor(input.decidedBy),
      timestamp: now,
    };
    const approveAudit = input.note
      ? { ...approveAuditBase, detail: input.note }
      : approveAuditBase;
    const updated: BacklogItem = {
      ...existing,
      status: 'approved',
      approvedAt: now,
      suggestion: approvedSuggestion,
      updatedAt: now,
      audit: [
        ...existing.audit,
        approveAudit,
      ],
    };
    await this.writeItem(updated);
    return updated;
  }

  async markDispatched(itemId: string, input: DispatchBacklogItemInput): Promise<BacklogItem | null> {
    const existing = await this.get(itemId);
    if (!existing) return null;
    if (existing.status === 'dispatched') {
      if (existing.dispatchedThreadId === input.threadId && existing.dispatchedThreadPhase === input.threadPhase) {
        return existing;
      }
      throw new BacklogTransitionError('Invalid backlog transition: item already dispatched to another thread');
    }
    if (existing.status !== 'approved') {
      throw new BacklogTransitionError('Invalid backlog transition: only approved items can be dispatched');
    }

    const now = Date.now();
    const updated: BacklogItem = {
      ...existing,
      status: 'dispatched',
      dispatchedThreadId: input.threadId,
      dispatchedThreadPhase: input.threadPhase,
      dispatchedAt: now,
      updatedAt: now,
      audit: [
        ...existing.audit,
        {
          id: generateSortableId(now + 1),
          action: 'dispatched',
          actor: makeUserActor(input.dispatchedBy),
          timestamp: now,
          detail: `${input.threadId}:${input.threadPhase}`,
        },
      ],
    };
    await this.writeItem(updated);
    return updated;
  }

  async acquireLease(itemId: string, input: AcquireBacklogLeaseInput): Promise<BacklogItem | null> {
    const existing = await this.get(itemId);
    if (!existing) return null;
    if (existing.status !== 'dispatched') {
      throw new BacklogTransitionError('Invalid backlog transition: only dispatched items can acquire lease');
    }

    const now = Date.now();
    const currentLease = existing.lease;
    if (this.isLeaseActive(currentLease, now) && currentLease?.ownerCatId !== input.catId) {
      throw new BacklogTransitionError('Invalid backlog transition: active lease owned by another cat');
    }

    const nextLease: BacklogLease = {
      ownerCatId: input.catId,
      state: 'active',
      acquiredAt: now,
      heartbeatAt: now,
      expiresAt: now + this.normalizeLeaseTtl(input.ttlMs),
    };

    const updated: BacklogItem = {
      ...existing,
      lease: nextLease,
      updatedAt: now,
      audit: [
        ...existing.audit,
        {
          id: generateSortableId(now + 1),
          action: 'lease_acquired',
          actor: makeUserActor(input.actorId),
          timestamp: now,
          detail: `${input.catId}:${nextLease.expiresAt}`,
        },
      ],
    };
    await this.writeItem(updated);
    return updated;
  }

  async heartbeatLease(itemId: string, input: HeartbeatBacklogLeaseInput): Promise<BacklogItem | null> {
    const existing = await this.get(itemId);
    if (!existing) return null;
    if (existing.status !== 'dispatched') {
      throw new BacklogTransitionError('Invalid backlog transition: only dispatched items can heartbeat lease');
    }

    const now = Date.now();
    const lease = existing.lease;
    if (!lease || lease.state !== 'active') {
      throw new BacklogTransitionError('Invalid backlog transition: no active lease to heartbeat');
    }
    if (lease.ownerCatId !== input.catId) {
      throw new BacklogTransitionError('Invalid backlog transition: lease owned by another cat');
    }
    if (lease.expiresAt <= now) {
      throw new BacklogTransitionError('Invalid backlog transition: lease already expired');
    }

    const updated: BacklogItem = {
      ...existing,
      lease: {
        ...lease,
        heartbeatAt: now,
        expiresAt: now + this.normalizeLeaseTtl(input.ttlMs),
      },
      updatedAt: now,
      audit: [
        ...existing.audit,
        {
          id: generateSortableId(now + 1),
          action: 'lease_heartbeat',
          actor: makeUserActor(input.actorId),
          timestamp: now,
          detail: `${input.catId}`,
        },
      ],
    };
    await this.writeItem(updated);
    return updated;
  }

  async releaseLease(itemId: string, input: ReleaseBacklogLeaseInput): Promise<BacklogItem | null> {
    const existing = await this.get(itemId);
    if (!existing) return null;
    if (existing.status !== 'dispatched') {
      throw new BacklogTransitionError('Invalid backlog transition: only dispatched items can release lease');
    }

    const now = Date.now();
    const lease = existing.lease;
    if (!lease || lease.state !== 'active') {
      return existing;
    }
    if (input.catId && lease.ownerCatId !== input.catId) {
      throw new BacklogTransitionError('Invalid backlog transition: lease owned by another cat');
    }

    const updated: BacklogItem = {
      ...existing,
      lease: {
        ...lease,
        state: 'released',
        releasedAt: now,
        releasedBy: input.actorId,
      },
      updatedAt: now,
      audit: [
        ...existing.audit,
        {
          id: generateSortableId(now + 1),
          action: 'lease_released',
          actor: makeUserActor(input.actorId),
          timestamp: now,
          detail: `${lease.ownerCatId}`,
        },
      ],
    };
    await this.writeItem(updated);
    return updated;
  }

  async reclaimExpiredLease(itemId: string, input: ReclaimBacklogLeaseInput): Promise<BacklogItem | null> {
    const existing = await this.get(itemId);
    if (!existing) return null;
    if (existing.status !== 'dispatched') {
      throw new BacklogTransitionError('Invalid backlog transition: only dispatched items can reclaim lease');
    }

    const now = Date.now();
    const lease = existing.lease;
    if (!lease || lease.state !== 'active') {
      return existing;
    }
    if (lease.expiresAt > now) {
      throw new BacklogTransitionError('Invalid backlog transition: lease not expired yet');
    }

    const updated: BacklogItem = {
      ...existing,
      lease: {
        ...lease,
        state: 'reclaimed',
        reclaimedAt: now,
        reclaimedBy: input.actorId,
      },
      updatedAt: now,
      audit: [
        ...existing.audit,
        {
          id: generateSortableId(now + 1),
          action: 'lease_reclaimed',
          actor: makeUserActor(input.actorId),
          timestamp: now,
          detail: `${lease.ownerCatId}`,
        },
      ],
    };
    await this.writeItem(updated);
    return updated;
  }

  private async writeItem(item: BacklogItem): Promise<void> {
    const key = BacklogKeys.detail(item.id);
    const pipeline = this.redis.multi();
    pipeline.hset(key, this.serializeItem(item));
    if (this.ttlSeconds !== null) {
      pipeline.expire(key, this.ttlSeconds);
      pipeline.expire(BacklogKeys.userList(item.userId), this.ttlSeconds);
    }
    await pipeline.exec();
  }

  private serializeItem(item: BacklogItem): Record<string, string> {
    const result: Record<string, string> = {
      id: item.id,
      userId: item.userId,
      title: item.title,
      summary: item.summary,
      priority: item.priority,
      status: item.status,
      createdBy: item.createdBy,
      tags: JSON.stringify(item.tags),
      audit: JSON.stringify(item.audit),
      createdAt: String(item.createdAt),
      updatedAt: String(item.updatedAt),
    };
    if (item.suggestion) result['suggestion'] = JSON.stringify(item.suggestion);
    if (item.lease) result['lease'] = JSON.stringify(item.lease);
    if (item.approvedAt) result['approvedAt'] = String(item.approvedAt);
    if (item.dispatchedAt) result['dispatchedAt'] = String(item.dispatchedAt);
    if (item.dispatchedThreadId) result['dispatchedThreadId'] = item.dispatchedThreadId;
    if (item.dispatchedThreadPhase) result['dispatchedThreadPhase'] = item.dispatchedThreadPhase;
    return result;
  }

  private hydrateItem(data: Record<string, string>): BacklogItem {
    const suggestion = data['suggestion']
      ? this.parseJson(data['suggestion'], null as BacklogItem['suggestion'] | null)
      : null;
    const lease = data['lease']
      ? this.parseJson(data['lease'], null as BacklogLease | null)
      : null;
    const approvedAt = data['approvedAt'] ? Number.parseInt(data['approvedAt'], 10) : null;
    const dispatchedAt = data['dispatchedAt'] ? Number.parseInt(data['dispatchedAt'], 10) : null;
    return {
      id: data['id'] ?? '',
      userId: data['userId'] ?? '',
      title: data['title'] ?? '',
      summary: data['summary'] ?? '',
      priority: (data['priority'] ?? 'p2') as BacklogItem['priority'],
      status: (data['status'] ?? 'open') as BacklogItem['status'],
      createdBy: (data['createdBy'] ?? 'user') as BacklogItem['createdBy'],
      tags: this.parseJson(data['tags'], []),
      createdAt: Number.parseInt(data['createdAt'] ?? '0', 10),
      updatedAt: Number.parseInt(data['updatedAt'] ?? '0', 10),
      audit: this.parseJson(data['audit'], []),
      ...(suggestion ? { suggestion } : {}),
      ...(lease ? { lease } : {}),
      ...(data['dispatchedThreadId'] ? { dispatchedThreadId: data['dispatchedThreadId'] } : {}),
      ...(data['dispatchedThreadPhase']
        ? { dispatchedThreadPhase: data['dispatchedThreadPhase'] as ThreadPhase }
        : {}),
      ...(approvedAt ? { approvedAt } : {}),
      ...(dispatchedAt ? { dispatchedAt } : {}),
    };
  }

  private parseJson<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private sameTags(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) return false;
    const leftSorted = [...left].sort();
    const rightSorted = [...right].sort();
    for (let index = 0; index < leftSorted.length; index += 1) {
      if (leftSorted[index] !== rightSorted[index]) return false;
    }
    return true;
  }

  private normalizeLeaseTtl(ttlMs: number): number {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return 60_000;
    return Math.floor(ttlMs);
  }

  private isLeaseActive(lease: BacklogLease | undefined, now: number): boolean {
    return Boolean(lease && lease.state === 'active' && lease.expiresAt > now);
  }
}
