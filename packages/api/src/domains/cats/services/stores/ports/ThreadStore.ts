/**
 * Thread Store
 * 对话管理：创建、查询、参与者追踪
 *
 * 内存实现，Map-based + LRU 淘汰。
 * Phase 3.3 可扩展 Redis 版本。
 */

import { generateThreadId } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import type { ThreadPhase } from '@cat-cafe/shared';

/** Default thread ID for the lobby (backwards-compatible single-thread mode) */
export const DEFAULT_THREAD_ID = 'default';

/**
 * F032 Phase C: Participant activity data for reviewer matching.
 */
export interface ThreadParticipantActivity {
  catId: CatId;
  /** Unix timestamp of last message from this cat in the thread */
  lastMessageAt: number;
  /** Total message count from this cat in the thread */
  messageCount: number;
}

/**
 * F042 Routing Policy (v1)
 * Thread-scoped routing preferences by "intent/scope".
 *
 * NOTE: This is NOT global availability.
 * - Global roster `available=false` = technically unavailable/offline.
 * - Thread routingPolicy = temporary preferences (budget, focus, etc.).
 */
export type ThreadRoutingScope = 'review' | 'architecture';

export interface ThreadRoutingRule {
  /** Prefer placing these cats first (may be injected if missing). */
  preferCats?: CatId[];
  /** Avoid routing to these cats unless explicitly @mentioned. */
  avoidCats?: CatId[];
  /** Human-readable reason (e.g. "budget"). */
  reason?: string;
  /** Optional expiry (epoch ms). When expired, rule is ignored. */
  expiresAt?: number;
}

export interface ThreadRoutingPolicyV1 {
  v: 1;
  scopes?: Partial<Record<ThreadRoutingScope, ThreadRoutingRule>>;
}

/**
 * A conversation thread
 */
export interface Thread {
  id: string;
  projectPath: string;
  title: string | null;
  createdBy: string;
  participants: CatId[];
  lastActiveAt: number;
  createdAt: number;
  pinned?: boolean;
  pinnedAt?: number | null;
  favorited?: boolean;
  favoritedAt?: number | null;
  /** Thinking visibility mode: play = cats can't see each other's thinking, debug = cats share thinking. Default: debug */
  thinkingMode?: 'debug' | 'play';
  /** F32-b Phase 2: Thread-level cat preference. When set, messages without @mention route to these cats instead of participants/default. */
  preferredCats?: CatId[];
  /** F049: workflow phase for dispatch/intent guidance */
  phase?: ThreadPhase;
  /** F042: Thread-scoped routing policy (by intent/scope). */
  routingPolicy?: ThreadRoutingPolicyV1;
}

/**
 * Common interface for thread stores (in-memory and future Redis).
 */
export interface IThreadStore {
  create(userId: string, title?: string, projectPath?: string): Thread | Promise<Thread>;
  get(threadId: string): Thread | null | Promise<Thread | null>;
  list(userId: string): Thread[] | Promise<Thread[]>;
  listByProject(userId: string, projectPath: string): Thread[] | Promise<Thread[]>;
  addParticipants(threadId: string, catIds: CatId[]): void | Promise<void>;
  getParticipants(threadId: string): CatId[] | Promise<CatId[]>;
  /** F032 Phase C: Get participants sorted by activity (lastMessageAt desc) */
  getParticipantsWithActivity(threadId: string): ThreadParticipantActivity[] | Promise<ThreadParticipantActivity[]>;
  /** F032 P1-2 fix: Update participant activity on every message (not just join) */
  updateParticipantActivity(threadId: string, catId: CatId): void | Promise<void>;
  updateTitle(threadId: string, title: string): void | Promise<void>;
  updatePin(threadId: string, pinned: boolean): void | Promise<void>;
  updateFavorite(threadId: string, favorited: boolean): void | Promise<void>;
  updateThinkingMode(threadId: string, mode: 'debug' | 'play'): void | Promise<void>;
  updatePreferredCats(threadId: string, catIds: CatId[]): void | Promise<void>;
  updatePhase(threadId: string, phase: ThreadPhase): void | Promise<void>;
  /** F042: Set or clear thread routing policy. `null` clears. */
  updateRoutingPolicy(threadId: string, policy: ThreadRoutingPolicyV1 | null): void | Promise<void>;
  updateLastActive(threadId: string): void | Promise<void>;
  delete(threadId: string): boolean | Promise<boolean>;
}

const MAX_THREADS = 100;

/**
 * In-memory thread store with LRU eviction.
 */
export class ThreadStore implements IThreadStore {
  private threads: Map<string, Thread> = new Map();
  /** F032 Phase C: Track participant activity per thread. Key: `${threadId}:${catId}` */
  private participantActivity: Map<string, { lastMessageAt: number; messageCount: number }> = new Map();
  private readonly maxThreads: number;

  constructor(options?: { maxThreads?: number }) {
    this.maxThreads = options?.maxThreads ?? MAX_THREADS;
  }

  /** F032 Phase C: Generate activity key */
  private activityKey(threadId: string, catId: CatId): string {
    return `${threadId}:${catId}`;
  }

  create(userId: string, title?: string, projectPath?: string): Thread {
    this.evictIfNeeded();

    const thread: Thread = {
      id: generateThreadId(),
      projectPath: projectPath ?? 'default',
      title: title ?? null,
      createdBy: userId,
      participants: [],
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
    };

    this.threads.set(thread.id, thread);
    return thread;
  }

  get(threadId: string): Thread | null {
    // Auto-create default thread on first access
    if (threadId === DEFAULT_THREAD_ID && !this.threads.has(DEFAULT_THREAD_ID)) {
      const defaultThread: Thread = {
        id: DEFAULT_THREAD_ID,
        projectPath: 'default',
        title: null,
        createdBy: 'system',
        participants: [],
        lastActiveAt: Date.now(),
        createdAt: Date.now(),
      };
      this.threads.set(DEFAULT_THREAD_ID, defaultThread);
    }

    return this.threads.get(threadId) ?? null;
  }

  list(userId: string): Thread[] {
    const result: Thread[] = [];
    for (const thread of this.threads.values()) {
      if (thread.createdBy === userId || thread.id === DEFAULT_THREAD_ID) {
        result.push(thread);
      }
    }
    // Sort by lastActiveAt descending (most recent first)
    result.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    return result;
  }

  listByProject(userId: string, projectPath: string): Thread[] {
    return this.list(userId).filter((t) => t.projectPath === projectPath);
  }

  addParticipants(threadId: string, catIds: CatId[]): void {
    const thread = this.get(threadId);
    if (!thread) return;

    // Cloud Codex P1 fix: Only add to participants list, do NOT update activity.
    // Activity should only be updated via updateParticipantActivity() after successful message append.
    for (const catId of catIds) {
      if (!thread.participants.includes(catId)) {
        thread.participants.push(catId);
      }
    }
  }

  getParticipants(threadId: string): CatId[] {
    const thread = this.get(threadId);
    return thread?.participants ?? [];
  }

  /** F032 Phase C: Get participants with activity, sorted by lastMessageAt descending */
  getParticipantsWithActivity(threadId: string): ThreadParticipantActivity[] {
    const participants = this.getParticipants(threadId);
    const result: ThreadParticipantActivity[] = participants.map((catId) => {
      const key = this.activityKey(threadId, catId);
      const activity = this.participantActivity.get(key);
      return {
        catId,
        lastMessageAt: activity?.lastMessageAt ?? 0,
        messageCount: activity?.messageCount ?? 0,
      };
    });
    // Sort by lastMessageAt descending (most recent first)
    result.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return result;
  }

  /** F032 P1-2 fix: Update participant activity on every message */
  updateParticipantActivity(threadId: string, catId: CatId): void {
    const thread = this.get(threadId);
    if (!thread) return;

    // Ensure cat is in participants list
    if (!thread.participants.includes(catId)) {
      thread.participants.push(catId);
    }

    // Update activity timestamp and increment count
    const key = this.activityKey(threadId, catId);
    const existing = this.participantActivity.get(key);
    this.participantActivity.set(key, {
      lastMessageAt: Date.now(),
      messageCount: (existing?.messageCount ?? 0) + 1,
    });
  }

  updateTitle(threadId: string, title: string): void {
    const thread = this.get(threadId);
    if (thread) thread.title = title;
  }

  updatePin(threadId: string, pinned: boolean): void {
    const thread = this.get(threadId);
    if (thread) {
      thread.pinned = pinned;
      thread.pinnedAt = pinned ? Date.now() : null;
    }
  }

  updateFavorite(threadId: string, favorited: boolean): void {
    const thread = this.get(threadId);
    if (thread) {
      thread.favorited = favorited;
      thread.favoritedAt = favorited ? Date.now() : null;
    }
  }

  updateThinkingMode(threadId: string, mode: 'debug' | 'play'): void {
    const thread = this.get(threadId);
    if (thread) thread.thinkingMode = mode;
  }

  updatePreferredCats(threadId: string, catIds: CatId[]): void {
    const thread = this.get(threadId);
    if (!thread) return;
    // R5 fix: dedupe at write time to prevent duplicate invocations
    const unique = [...new Set(catIds)];
    if (unique.length > 0) {
      thread.preferredCats = unique;
    } else {
      delete thread.preferredCats;
    }
  }

  updatePhase(threadId: string, phase: ThreadPhase): void {
    const thread = this.get(threadId);
    if (thread) thread.phase = phase;
  }

  updateRoutingPolicy(threadId: string, policy: ThreadRoutingPolicyV1 | null): void {
    const thread = this.get(threadId);
    if (!thread) return;

    // Normalize: null or empty scopes clears policy.
    const scopes = policy?.scopes;
    const hasScopes = scopes && Object.keys(scopes).length > 0;
    if (!policy || policy.v !== 1 || !hasScopes) {
      delete thread.routingPolicy;
      return;
    }

    thread.routingPolicy = policy;
  }

  updateLastActive(threadId: string): void {
    const thread = this.get(threadId);
    if (thread) {
      thread.lastActiveAt = Date.now();
      // Move to end of Map for LRU (delete + re-insert)
      this.threads.delete(threadId);
      this.threads.set(threadId, thread);
    }
  }

  delete(threadId: string): boolean {
    if (threadId === DEFAULT_THREAD_ID) return false; // Cannot delete default
    // Cloud Codex R3 P2 fix: Clean up activity entries to prevent memory leak
    this.clearActivityForThread(threadId);
    return this.threads.delete(threadId);
  }

  /** Cloud Codex R3 P2 fix: Remove all activity entries for a thread */
  private clearActivityForThread(threadId: string): void {
    const prefix = `${threadId}:`;
    for (const key of this.participantActivity.keys()) {
      if (key.startsWith(prefix)) {
        this.participantActivity.delete(key);
      }
    }
  }

  /** Current thread count (for testing) */
  get size(): number {
    return this.threads.size;
  }

  private evictIfNeeded(): void {
    while (this.threads.size >= this.maxThreads) {
      // Find the oldest non-default key (Map preserves insertion order)
      let evicted = false;
      for (const key of this.threads.keys()) {
        if (key !== DEFAULT_THREAD_ID) {
          // Cloud Codex R3 P2 fix: Clean up activity before evicting
          this.clearActivityForThread(key);
          this.threads.delete(key);
          evicted = true;
          break;
        }
      }
      // Only default thread left — cannot evict further
      if (!evicted) break;
    }
  }
}
