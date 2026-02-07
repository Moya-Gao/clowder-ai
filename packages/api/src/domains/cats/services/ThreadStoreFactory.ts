/**
 * Thread Store Factory
 * REDIS_URL 有值 → RedisThreadStore
 * 无 → ThreadStore (内存)
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import { ThreadStore } from './ThreadStore.js';
import type { IThreadStore } from './ThreadStore.js';
import { RedisThreadStore } from './RedisThreadStore.js';

export function createThreadStore(redis?: RedisClient): IThreadStore {
  if (redis) {
    return new RedisThreadStore(redis);
  }
  return new ThreadStore();
}
