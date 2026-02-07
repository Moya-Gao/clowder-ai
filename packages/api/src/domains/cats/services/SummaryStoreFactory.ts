/**
 * Summary Store Factory
 * Redis → RedisSummaryStore, 无 → SummaryStore (内存)
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import { SummaryStore } from './SummaryStore.js';
import type { ISummaryStore } from './SummaryStore.js';
import { RedisSummaryStore } from './RedisSummaryStore.js';

export function createSummaryStore(redis?: RedisClient): ISummaryStore {
  if (redis) {
    return new RedisSummaryStore(redis);
  }
  return new SummaryStore();
}
