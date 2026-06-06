// @ts-check
/**
 * F128 RedisProposalStore.finalizeApproval — projectPath audit sync (Redis-backed).
 *
 * Pins the Redis-only contract the in-memory store cannot surface
 * (feedback_inmemory_store_tests_miss_redis_behavior): an approve-time projectPath override
 * must be HSET during finalize, so a FRESH get() — re-hydrated from the hash — returns the
 * re-homed ownership, not the create-time value. The in-memory store mutates the record in
 * place and would pass even if finalizedFields forgot to write projectPath; only a real
 * round-trip through Redis catches a missing HSET.
 *
 * 有 Redis → 测全量；无 Redis → skip
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertRedisIsolationOrThrow,
  cleanupPrefixedRedisKeys,
  redisIsolationSkipReason,
} from './helpers/redis-test-helpers.js';

const REDIS_URL = process.env.REDIS_URL;

describe(
  'RedisProposalStore.finalizeApproval — projectPath audit sync (F128)',
  {
    skip: redisIsolationSkipReason(REDIS_URL),
  },
  () => {
    let RedisProposalStore;
    let redis;
    let store;
    let connected = false;

    function baseInput(overrides = {}) {
      return {
        sourceThreadId: 'thread_src',
        sourceInvocationId: 'inv_1',
        sourceCatId: 'opus',
        title: 'rehome',
        reason: 'F128 projectPath finalize',
        parentThreadId: 'thread_src',
        preferredCats: [],
        projectPath: '/projects/orig',
        createdBy: 'alice',
        ...overrides,
      };
    }

    const PREFIXES = ['proposal:*', 'proposals:*', 'dedup:propose:*'];

    before(async () => {
      assertRedisIsolationOrThrow(REDIS_URL, 'RedisProposalStore');
      const storeModule = await import('../dist/domains/cats/services/stores/redis/RedisProposalStore.js');
      RedisProposalStore = storeModule.RedisProposalStore;
      const { createRedisClient } = await import('@cat-cafe/shared/utils');
      redis = createRedisClient({ url: REDIS_URL });
      try {
        await redis.ping();
        connected = true;
      } catch {
        await redis.quit().catch(() => {});
        return;
      }
      store = new RedisProposalStore(redis);
    });

    after(async () => {
      if (redis && connected) {
        await cleanupPrefixedRedisKeys(redis, PREFIXES);
        await redis.quit();
      }
    });

    beforeEach(async (t) => {
      if (!connected) return t.skip('Redis not connected');
      await cleanupPrefixedRedisKeys(redis, PREFIXES);
    });

    it('override.projectPath is persisted on finalize → fresh get() hydrates the re-homed path', async () => {
      const created = await store.create(baseInput());
      assert.equal(created.projectPath, '/projects/orig');

      const claimed = await store.claimForApproval({ proposalId: created.proposalId, approvedBy: 'alice' });
      assert.ok(claimed, 'claim pending → approving should succeed');

      const finalized = await store.finalizeApproval({
        proposalId: created.proposalId,
        createdThreadId: 'thread_child',
        overrides: { projectPath: '/projects/rehomed' },
      });
      assert.ok(finalized, 'finalize should succeed');
      assert.equal(finalized.projectPath, '/projects/rehomed', 'returned snapshot reflects the override');

      // The faithful check: re-hydrate from Redis. Without finalizedFields persisting
      // projectPath this returns the stale '/projects/orig'.
      const fresh = await store.get(created.proposalId);
      assert.ok(fresh);
      assert.equal(fresh.projectPath, '/projects/rehomed', 'persisted hash must carry the re-homed ownership');
      assert.equal(fresh.status, 'approved');
    });

    it('finalize without a projectPath override keeps the create-time ownership (idempotent)', async () => {
      const created = await store.create(baseInput({ projectPath: '/projects/keep' }));
      await store.claimForApproval({ proposalId: created.proposalId, approvedBy: 'alice' });

      await store.finalizeApproval({
        proposalId: created.proposalId,
        createdThreadId: 'thread_child2',
        overrides: { title: 'edited title' },
      });

      const fresh = await store.get(created.proposalId);
      assert.ok(fresh);
      assert.equal(fresh.projectPath, '/projects/keep', 'no override → projectPath unchanged');
      assert.equal(fresh.title, 'edited title', 'other overrides still apply');
    });
  },
);
