import type {
  AcquireBacklogLeaseInput,
  BacklogLease,
  BacklogItem,
  BacklogStatus,
  CreateBacklogItemInput,
  DecideBacklogClaimInput,
  DispatchBacklogItemInput,
  HeartbeatBacklogLeaseInput,
  ReclaimBacklogLeaseInput,
  RefreshBacklogItemInput,
  ReleaseBacklogLeaseInput,
  SuggestBacklogClaimInput,
} from '@cat-cafe/shared';
import { generateSortableId } from './MessageStore.js';
import { makeCatActor, makeCreatorActor, makeUserActor } from '../shared/backlog-audit-actors.js';

const MAX_BACKLOG_ITEMS = 1000;

const EVICTION_PRIORITY: Record<BacklogStatus, number> = {
  dispatched: 0,
  open: 1,
  suggested: 2,
  approved: 3,
};

export class BacklogTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BacklogTransitionError';
  }
}

export interface IBacklogStore {
  create(input: CreateBacklogItemInput): BacklogItem | Promise<BacklogItem>;
  refreshMetadata(itemId: string, input: RefreshBacklogItemInput): BacklogItem | null | Promise<BacklogItem | null>;
  get(itemId: string, userId?: string): BacklogItem | null | Promise<BacklogItem | null>;
  listByUser(userId: string): BacklogItem[] | Promise<BacklogItem[]>;
  suggestClaim(itemId: string, input: SuggestBacklogClaimInput): BacklogItem | null | Promise<BacklogItem | null>;
  decideClaim(itemId: string, input: DecideBacklogClaimInput): BacklogItem | null | Promise<BacklogItem | null>;
  markDispatched(itemId: string, input: DispatchBacklogItemInput): BacklogItem | null | Promise<BacklogItem | null>;
  acquireLease(itemId: string, input: AcquireBacklogLeaseInput): BacklogItem | null | Promise<BacklogItem | null>;
  heartbeatLease(itemId: string, input: HeartbeatBacklogLeaseInput): BacklogItem | null | Promise<BacklogItem | null>;
  releaseLease(itemId: string, input: ReleaseBacklogLeaseInput): BacklogItem | null | Promise<BacklogItem | null>;
  reclaimExpiredLease(itemId: string, input: ReclaimBacklogLeaseInput): BacklogItem | null | Promise<BacklogItem | null>;
}

export class BacklogStore implements IBacklogStore {
  private readonly items: Map<string, BacklogItem> = new Map();
  private readonly maxItems: number;

  constructor(options?: { maxItems?: number }) {
    this.maxItems = options?.maxItems ?? MAX_BACKLOG_ITEMS;
  }

  create(input: CreateBacklogItemInput): BacklogItem {
    this.evictIfNeeded();

    const now = Date.now();
    const id = generateSortableId(now);
    const item: BacklogItem = {
      id,
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
    this.items.set(id, item);
    return item;
  }

  refreshMetadata(itemId: string, input: RefreshBacklogItemInput): BacklogItem | null {
    const existing = this.items.get(itemId);
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
    this.items.set(itemId, updated);
    return updated;
  }

  get(itemId: string, userId?: string): BacklogItem | null {
    const item = this.items.get(itemId);
    if (!item) return null;
    if (userId && item.userId !== userId) return null;
    return item;
  }

  listByUser(userId: string): BacklogItem[] {
    const result: BacklogItem[] = [];
    for (const item of this.items.values()) {
      if (item.userId === userId) {
        result.push(item);
      }
    }
    result.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
    return result;
  }

  suggestClaim(itemId: string, input: SuggestBacklogClaimInput): BacklogItem | null {
    const existing = this.items.get(itemId);
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
    this.items.set(itemId, updated);
    return updated;
  }

  decideClaim(itemId: string, input: DecideBacklogClaimInput): BacklogItem | null {
    const existing = this.items.get(itemId);
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
      this.items.set(itemId, updated);
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
    this.items.set(itemId, updated);
    return updated;
  }

  markDispatched(itemId: string, input: DispatchBacklogItemInput): BacklogItem | null {
    const existing = this.items.get(itemId);
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
    this.items.set(itemId, updated);
    return updated;
  }

  acquireLease(itemId: string, input: AcquireBacklogLeaseInput): BacklogItem | null {
    const existing = this.items.get(itemId);
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
    this.items.set(itemId, updated);
    return updated;
  }

  heartbeatLease(itemId: string, input: HeartbeatBacklogLeaseInput): BacklogItem | null {
    const existing = this.items.get(itemId);
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
    this.items.set(itemId, updated);
    return updated;
  }

  releaseLease(itemId: string, input: ReleaseBacklogLeaseInput): BacklogItem | null {
    const existing = this.items.get(itemId);
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
    this.items.set(itemId, updated);
    return updated;
  }

  reclaimExpiredLease(itemId: string, input: ReclaimBacklogLeaseInput): BacklogItem | null {
    const existing = this.items.get(itemId);
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
    this.items.set(itemId, updated);
    return updated;
  }

  private evictIfNeeded(): void {
    if (this.items.size < this.maxItems) return;
    const sorted = [...this.items.values()].sort((a, b) => {
      const priorityDiff = EVICTION_PRIORITY[a.status] - EVICTION_PRIORITY[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
    });
    const target = sorted[0];
    if (target) this.items.delete(target.id);
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
