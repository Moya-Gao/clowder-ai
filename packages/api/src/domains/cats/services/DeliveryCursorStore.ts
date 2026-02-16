/**
 * Delivery Cursor Store
 *
 * Tracks per-user/per-cat/per-thread last delivered message ID.
 * IDs are lexicographically sortable (timestamp+seq prefix), so monotonic
 * progression can be enforced with string comparison.
 */

import { createCatId } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import type { SessionStore } from '@cat-cafe/shared/utils';

const MAX_CURSORS = 5000;
const ALL_CATS: readonly CatId[] = [
  createCatId('opus'),
  createCatId('codex'),
  createCatId('gemini'),
];

function cursorKey(userId: string, catId: CatId, threadId: string): string {
  return `${userId}:${catId}:${threadId}`;
}

export class DeliveryCursorStore {
  private readonly sessionStore: SessionStore | null;
  private readonly cursors: Map<string, string> = new Map();
  /** Mention-ack cursors — separate namespace from delivery cursors (#77) */
  private readonly mentionAckCursors: Map<string, string> = new Map();

  constructor(sessionStore?: SessionStore) {
    this.sessionStore = sessionStore ?? null;
  }

  async getCursor(userId: string, catId: CatId, threadId: string): Promise<string | undefined> {
    if (this.sessionStore) {
      try {
        const value = await this.sessionStore.getDeliveryCursor(userId, catId, threadId);
        return value ?? undefined;
      } catch (err) {
        console.warn('[DeliveryCursorStore] getDeliveryCursor failed, fallback to in-memory cursor:', err);
      }
    }
    return this.cursors.get(cursorKey(userId, catId, threadId));
  }

  /**
   * Monotonic ack: cursor only moves forward.
   */
  async ackCursor(userId: string, catId: CatId, threadId: string, deliveredToId: string): Promise<void> {
    const current = await this.getCursor(userId, catId, threadId);
    if (current && deliveredToId <= current) {
      return;
    }

    if (this.sessionStore) {
      try {
        await this.sessionStore.setDeliveryCursor(userId, catId, threadId, deliveredToId);
        return;
      } catch (err) {
        console.warn('[DeliveryCursorStore] setDeliveryCursor failed, fallback to in-memory cursor:', err);
      }
    }

    const key = cursorKey(userId, catId, threadId);

    if (this.cursors.has(key)) {
      this.cursors.delete(key);
    }

    while (this.cursors.size >= MAX_CURSORS) {
      const oldest = this.cursors.keys().next().value;
      if (oldest !== undefined) {
        this.cursors.delete(oldest);
      }
    }

    this.cursors.set(key, deliveredToId);
  }

  // ---- Mention Ack Cursor (#77) ----

  /**
   * Get the last acknowledged mention message ID for a cat in a thread.
   * Returns undefined if no ack cursor exists (= all mentions are pending).
   */
  async getMentionAckCursor(userId: string, catId: CatId, threadId: string): Promise<string | undefined> {
    if (this.sessionStore) {
      try {
        const value = await this.sessionStore.getMentionAckCursor(userId, catId, threadId);
        return value ?? undefined;
      } catch (err) {
        console.warn('[DeliveryCursorStore] getMentionAckCursor failed, fallback to in-memory:', err);
      }
    }
    return this.mentionAckCursors.get(cursorKey(userId, catId, threadId));
  }

  /**
   * Acknowledge mentions up to a message ID (monotonic forward only).
   * If messageId <= current cursor, this is a noop (idempotent).
   */
  async ackMentionCursor(userId: string, catId: CatId, threadId: string, messageId: string): Promise<void> {
    const current = await this.getMentionAckCursor(userId, catId, threadId);
    if (current && messageId <= current) {
      return; // Monotonic: noop for backwards/same ack
    }

    if (this.sessionStore) {
      try {
        await this.sessionStore.setMentionAckCursor(userId, catId, threadId, messageId);
        return;
      } catch (err) {
        console.warn('[DeliveryCursorStore] setMentionAckCursor failed, fallback to in-memory:', err);
      }
    }

    const key = cursorKey(userId, catId, threadId);
    if (this.mentionAckCursors.has(key)) {
      this.mentionAckCursors.delete(key);
    }
    while (this.mentionAckCursors.size >= MAX_CURSORS) {
      const oldest = this.mentionAckCursors.keys().next().value;
      if (oldest !== undefined) {
        this.mentionAckCursors.delete(oldest);
      }
    }
    this.mentionAckCursors.set(key, messageId);
  }

  // ---- Cleanup ----

  /**
   * Cleanup all per-cat delivery + mention-ack cursors for one user's thread.
   * Called during thread cascade delete to avoid stale cursor accumulation.
   */
  async deleteByThreadForUser(userId: string, threadId: string): Promise<number> {
    let deleted = 0;

    if (this.sessionStore) {
      for (const catId of ALL_CATS) {
        try {
          deleted += await this.sessionStore.deleteDeliveryCursor(userId, catId, threadId);
        } catch (err) {
          console.warn('[DeliveryCursorStore] deleteDeliveryCursor failed, continue cleanup in-memory:', err);
        }
        try {
          deleted += await this.sessionStore.deleteMentionAckCursor(userId, catId, threadId);
        } catch (err) {
          console.warn('[DeliveryCursorStore] deleteMentionAckCursor failed, continue cleanup in-memory:', err);
        }
      }
    }

    const suffix = `:${threadId}`;
    const prefix = `${userId}:`;
    for (const key of this.cursors.keys()) {
      if (key.startsWith(prefix) && key.endsWith(suffix)) {
        this.cursors.delete(key);
        deleted++;
      }
    }
    for (const key of this.mentionAckCursors.keys()) {
      if (key.startsWith(prefix) && key.endsWith(suffix)) {
        this.mentionAckCursors.delete(key);
        deleted++;
      }
    }

    return deleted;
  }
}
