import type { CatId } from './ids.js';

export type BacklogPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type BacklogStatus = 'open' | 'suggested' | 'approved' | 'dispatched';
export type ThreadPhase = 'coding' | 'research' | 'brainstorm';
export type BacklogSuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface BacklogClaimSuggestion {
  readonly catId: CatId;
  readonly why: string;
  readonly plan: string;
  readonly requestedPhase: ThreadPhase;
  readonly status: BacklogSuggestionStatus;
  readonly suggestedAt: number;
  readonly decidedAt?: number;
  readonly decidedBy?: string;
  readonly note?: string;
}

export type BacklogAuditAction =
  | 'created'
  | 'suggested'
  | 'approved'
  | 'rejected'
  | 'dispatched';

export interface BacklogAuditActor {
  readonly kind: 'cat' | 'user';
  readonly id: string;
}

export interface BacklogAuditEntry {
  readonly id: string;
  readonly action: BacklogAuditAction;
  readonly actor: BacklogAuditActor;
  readonly timestamp: number;
  readonly detail?: string;
}

export interface BacklogItem {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly summary: string;
  readonly priority: BacklogPriority;
  readonly tags: readonly string[];
  readonly status: BacklogStatus;
  readonly createdBy: CatId | 'user';
  readonly suggestion?: BacklogClaimSuggestion;
  readonly dispatchedThreadId?: string;
  readonly dispatchedThreadPhase?: ThreadPhase;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly approvedAt?: number;
  readonly dispatchedAt?: number;
  readonly audit: readonly BacklogAuditEntry[];
}

export interface CreateBacklogItemInput {
  readonly userId: string;
  readonly title: string;
  readonly summary: string;
  readonly priority: BacklogPriority;
  readonly tags: readonly string[];
  readonly createdBy: CatId | 'user';
}

export interface SuggestBacklogClaimInput {
  readonly catId: CatId;
  readonly why: string;
  readonly plan: string;
  readonly requestedPhase: ThreadPhase;
}

export interface DecideBacklogClaimInput {
  readonly decision: 'approve' | 'reject';
  readonly decidedBy: string;
  readonly note?: string;
}

export interface DispatchBacklogItemInput {
  readonly threadId: string;
  readonly threadPhase: ThreadPhase;
  readonly dispatchedBy: string;
}
