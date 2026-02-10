/**
 * PendingRequest Store Factory
 * REDIS_URL 有值 → RedisPendingRequestStore
 * 无 → PendingRequestStore (内存)
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import { PendingRequestStore } from './PendingRequestStore.js';
import type { IPendingRequestStore } from './PendingRequestStore.js';
import { RedisPendingRequestStore } from './RedisPendingRequestStore.js';

export function createPendingRequestStore(redis?: RedisClient): IPendingRequestStore {
  if (redis) {
    return new RedisPendingRequestStore(redis);
  }
  return new PendingRequestStore();
}
