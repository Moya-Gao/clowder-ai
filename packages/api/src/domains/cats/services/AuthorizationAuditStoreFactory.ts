/**
 * AuthorizationAudit Store Factory
 * REDIS_URL 有值 → RedisAuthorizationAuditStore
 * 无 → AuthorizationAuditStore (内存)
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import { AuthorizationAuditStore } from './AuthorizationAuditStore.js';
import type { IAuthorizationAuditStore } from './AuthorizationAuditStore.js';
import { RedisAuthorizationAuditStore } from './RedisAuthorizationAuditStore.js';

export function createAuthorizationAuditStore(redis?: RedisClient): IAuthorizationAuditStore {
  if (redis) {
    return new RedisAuthorizationAuditStore(redis);
  }
  return new AuthorizationAuditStore();
}
