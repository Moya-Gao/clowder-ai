/**
 * Thread Store
 * 对话管理：创建、查询、参与者追踪
 *
 * 内存实现，Map-based + LRU 淘汰。
 * Phase 3.3 可扩展 Redis 版本。
 */

import { generateThreadId } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';

/** Default thread ID for the lobby (backwards-compatible single-thread mode) */
export const DEFAULT_THREAD_ID = 'default';

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
  updateTitle(threadId: string, title: string): void | Promise<void>;
  updateLastActive(threadId: string): void | Promise<void>;
  delete(threadId: string): boolean | Promise<boolean>;
}

const MAX_THREADS = 100;

/**
 * In-memory thread store with LRU eviction.
 */
export class ThreadStore implements IThreadStore {
  private threads: Map<string, Thread> = new Map();
  private readonly maxThreads: number;

  constructor(options?: { maxThreads?: number }) {
    this.maxThreads = options?.maxThreads ?? MAX_THREADS;
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

  updateTitle(threadId: string, title: string): void {
    const thread = this.get(threadId);
    if (thread) thread.title = title;
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
    return this.threads.delete(threadId);
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
