/**
 * Delivery Cursor Store
 *
 * Tracks per-user/per-cat/per-thread last delivered message ID.
 * IDs are lexicographically sortable (timestamp+seq prefix), so monotonic
 * progression can be enforced with string comparison.
 */

import type { CatId } from '@cat-cafe/shared';
import type { SessionStore } from '@cat-cafe/shared/utils';

const MAX_CURSORS = 5000;

function cursorKey(userId: string, catId: CatId, threadId: string): string {
  return `${userId}:${catId}:${threadId}`;
}

export class DeliveryCursorStore {
  private readonly sessionStore: SessionStore | null;
  private readonly cursors: Map<string, string> = new Map();

  constructor(sessionStore?: SessionStore) {
    this.sessionStore = sessionStore ?? null;
  }

  async getCursor(userId: string, catId: CatId, threadId: string): Promise<string | undefined> {
    const cursorStore = this.sessionStore as (SessionStore & {
      getDeliveryCursor?: (userId: string, catId: string, threadId: string) => Promise<string | null>;
    }) | null;
    if (cursorStore?.getDeliveryCursor) {
      const value = await cursorStore.getDeliveryCursor(userId, catId, threadId);
      return value ?? undefined;
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

    const cursorStore = this.sessionStore as (SessionStore & {
      setDeliveryCursor?: (
        userId: string,
        catId: string,
        threadId: string,
        messageId: string,
      ) => Promise<void>;
    }) | null;
    if (cursorStore?.setDeliveryCursor) {
      await cursorStore.setDeliveryCursor(userId, catId, threadId, deliveredToId);
      return;
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
}
