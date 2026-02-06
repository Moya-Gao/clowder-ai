/**
 * Message Store Factory
 * REDIS_URL 有值 → RedisMessageStore
 * 无 → MessageStore (内存，现有行为不变)
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import { MessageStore } from './MessageStore.js';
import { RedisMessageStore } from './RedisMessageStore.js';

export type AnyMessageStore = MessageStore | RedisMessageStore;

export function createMessageStore(
  redis?: RedisClient
): AnyMessageStore {
  if (redis) {
    return new RedisMessageStore(redis);
  }
  return new MessageStore();
}
