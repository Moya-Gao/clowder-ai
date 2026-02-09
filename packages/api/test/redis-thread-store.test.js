/**
 * RedisThreadStore tests
 * 有 Redis → 测全量；无 Redis → skip
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRedisIsolationOrThrow,
  cleanupPrefixedRedisKeys,
} from './helpers/redis-test-helpers.js';

const REDIS_URL = process.env['REDIS_URL'];

describe('RedisThreadStore', { skip: !REDIS_URL ? 'REDIS_URL not set' : false }, () => {
  let RedisThreadStore;
  let createRedisClient;
  let redis;
  let store;
  let connected = false;

  before(async () => {
    assertRedisIsolationOrThrow(REDIS_URL, 'RedisThreadStore');

    const storeModule = await import('../dist/domains/cats/services/RedisThreadStore.js');
    RedisThreadStore = storeModule.RedisThreadStore;
    const redisModule = await import('@cat-cafe/shared/utils');
    createRedisClient = redisModule.createRedisClient;

    redis = createRedisClient({ url: REDIS_URL });
    try {
      await redis.ping();
      connected = true;
    } catch {
      console.warn('[redis-thread-store.test] Redis unreachable, skipping tests');
      await redis.quit().catch(() => {});
      return;
    }
    store = new RedisThreadStore(redis, { ttlSeconds: 60 });
  });

  after(async () => {
    if (redis && connected) {
      await cleanupPrefixedRedisKeys(redis, ['thread:*', 'threads:*']);
      await redis.quit();
    }
  });

  beforeEach(async (t) => {
    if (!connected) return t.skip('Redis not connected');
    await cleanupPrefixedRedisKeys(redis, ['thread:*', 'threads:*']);
  });

  it('create() stores thread and returns it', async () => {
    const thread = await store.create('user1', 'Test Thread', '/home/user/project');
    assert.ok(thread.id);
    assert.equal(thread.title, 'Test Thread');
    assert.equal(thread.createdBy, 'user1');
    assert.equal(thread.projectPath, '/home/user/project');
    assert.deepEqual(thread.participants, []);
  });

  it('get() returns stored thread', async () => {
    const created = await store.create('user1', 'My Thread');
    const fetched = await store.get(created.id);
    assert.ok(fetched);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.title, 'My Thread');
    assert.equal(fetched.createdBy, 'user1');
  });

  it('get("default") auto-creates default thread', async () => {
    const thread = await store.get('default');
    assert.ok(thread);
    assert.equal(thread.id, 'default');
    assert.equal(thread.createdBy, 'system');
  });

  it('get() returns null for nonexistent thread', async () => {
    const result = await store.get('nonexistent-id');
    assert.equal(result, null);
  });

  it('addParticipants() stores and getParticipants() retrieves', async () => {
    const thread = await store.create('user1', 'Chat');
    await store.addParticipants(thread.id, ['opus', 'codex']);
    const participants = await store.getParticipants(thread.id);
    assert.ok(participants.includes('opus'));
    assert.ok(participants.includes('codex'));
    assert.equal(participants.length, 2);
  });

  it('addParticipants() deduplicates', async () => {
    const thread = await store.create('user1', 'Chat');
    await store.addParticipants(thread.id, ['opus']);
    await store.addParticipants(thread.id, ['opus', 'codex']);
    const participants = await store.getParticipants(thread.id);
    assert.equal(participants.length, 2);
  });

  it('list() returns user threads sorted by lastActiveAt', async () => {
    const t1 = await store.create('user1', 'First');
    // Small delay for ordering
    await new Promise(r => setTimeout(r, 10));
    const t2 = await store.create('user1', 'Second');

    const threads = await store.list('user1');
    // Most recent first
    assert.ok(threads.length >= 2);
    const ids = threads.map(t => t.id);
    assert.ok(ids.indexOf(t2.id) < ids.indexOf(t1.id));
  });

  it('updateTitle() updates the title', async () => {
    const thread = await store.create('user1', 'Old Title');
    await store.updateTitle(thread.id, 'New Title');
    const updated = await store.get(thread.id);
    assert.equal(updated.title, 'New Title');
  });

  it('delete() removes thread', async () => {
    const thread = await store.create('user1', 'To Delete');
    const result = await store.delete(thread.id);
    assert.equal(result, true);
    const fetched = await store.get(thread.id);
    assert.equal(fetched, null);
  });

  it('delete() cannot remove default thread', async () => {
    await store.get('default'); // ensure it exists
    const result = await store.delete('default');
    assert.equal(result, false);
  });
});

describe('ThreadStoreFactory', () => {
  it('returns ThreadStore when no redis', async () => {
    const { createThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStoreFactory.js'
    );
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );
    const store = createThreadStore();
    assert.ok(store instanceof ThreadStore);
  });

  it('returns RedisThreadStore when redis provided', {
    skip: !REDIS_URL ? 'REDIS_URL not set' : false,
  }, async () => {
    assertRedisIsolationOrThrow(REDIS_URL, 'ThreadStoreFactory');

    const { createThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStoreFactory.js'
    );
    const { RedisThreadStore } = await import(
      '../dist/domains/cats/services/RedisThreadStore.js'
    );
    const { createRedisClient } = await import('@cat-cafe/shared/utils');
    const redis = createRedisClient({ url: REDIS_URL });
    try {
      const store = createThreadStore(redis);
      assert.ok(store instanceof RedisThreadStore);
    } finally {
      await redis.quit().catch(() => {});
    }
  });
});
