/**
 * Task Store Factory
 * Redis → RedisTaskStore, 无 → TaskStore (内存)
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import { TaskStore } from './TaskStore.js';
import type { ITaskStore } from './TaskStore.js';
import { RedisTaskStore } from './RedisTaskStore.js';

export function createTaskStore(redis?: RedisClient): ITaskStore {
  if (redis) {
    return new RedisTaskStore(redis);
  }
  return new TaskStore();
}
