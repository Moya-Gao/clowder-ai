/**
 * B-6: Dismiss-rate tracker for guide offers.
 *
 * Tracks how many times each user has dismissed (cancelled) a specific
 * guide offer. The GuideOfferPolicy uses this count to suppress
 * re-offers after too many dismissals.
 *
 * Port interface + Redis implementation.
 */

import type { RedisClient } from '@cat-cafe/shared/utils';

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

export interface IGuideDismissTracker {
  /** Get dismiss counts for a user across all guides. */
  getDismissCounts(userId: string, guideIds: string[]): Promise<Record<string, number>>;
  /** Increment dismiss count for a specific user + guide pair. */
  incrementDismiss(userId: string, guideId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Redis Implementation
// ---------------------------------------------------------------------------

const DISMISS_KEY_PREFIX = 'cat-cafe:guide-dismiss:';
const DISMISS_TTL = 90 * 24 * 3600; // 90 days

function dismissKey(userId: string, guideId: string): string {
  return `${DISMISS_KEY_PREFIX}${userId}:${guideId}`;
}

export class RedisGuideDismissTracker implements IGuideDismissTracker {
  constructor(private readonly redis: RedisClient) {}

  async getDismissCounts(userId: string, guideIds: string[]): Promise<Record<string, number>> {
    if (guideIds.length === 0) return {};

    const keys = guideIds.map((id) => dismissKey(userId, id));
    const values = await this.redis.mget(...keys);

    const result: Record<string, number> = {};
    for (let i = 0; i < guideIds.length; i++) {
      const raw = values[i];
      if (raw) result[guideIds[i]] = Number.parseInt(raw, 10) || 0;
    }
    return result;
  }

  async incrementDismiss(userId: string, guideId: string): Promise<void> {
    const key = dismissKey(userId, guideId);
    await this.redis.incr(key);
    await this.redis.expire(key, DISMISS_TTL);
  }
}
