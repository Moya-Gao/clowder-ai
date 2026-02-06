/**
 * Session Manager
 * 管理 user+cat session ID 的存取。
 *
 * Redis SessionStore 可用时走 Redis，否则降级到内存 Map (LRU)。
 */

import type { CatId } from '@cat-cafe/shared';
import type { SessionStore } from '@cat-cafe/shared/utils';

/** Maximum number of sessions to keep in memory (fallback mode only) */
const MAX_SESSIONS = 1000;

export class SessionManager {
  private readonly sessionStore: SessionStore | null;
  /** In-memory fallback when no Redis SessionStore is provided */
  private readonly sessions: Map<string, string> = new Map();

  constructor(sessionStore?: SessionStore) {
    this.sessionStore = sessionStore ?? null;
  }

  /**
   * Store session ID for user + cat combination.
   * Uses Redis SessionStore when available, falls back to in-memory Map.
   */
  async store(userId: string, catId: CatId, sessionId: string): Promise<void> {
    if (this.sessionStore) {
      await this.sessionStore.setSessionId(userId, catId, sessionId);
      return;
    }

    const key = `${userId}:${catId}`;

    // Delete first so it moves to the end (most recent) on re-insert
    if (this.sessions.has(key)) {
      this.sessions.delete(key);
    }

    // Evict oldest entries if at capacity
    while (this.sessions.size >= MAX_SESSIONS) {
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey !== undefined) {
        this.sessions.delete(oldestKey);
      }
    }

    this.sessions.set(key, sessionId);
  }

  /**
   * Get stored session ID for user + cat combination.
   * Uses Redis SessionStore when available, falls back to in-memory Map.
   */
  async get(userId: string, catId: CatId): Promise<string | undefined> {
    if (this.sessionStore) {
      const result = await this.sessionStore.getSessionId(userId, catId);
      return result ?? undefined;
    }

    return this.sessions.get(`${userId}:${catId}`);
  }
}
