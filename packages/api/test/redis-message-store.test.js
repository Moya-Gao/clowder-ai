/**
 * RedisMessageStore tests
 * 有 Redis → 测全量；无 Redis → skip
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRedisIsolationOrThrow,
  cleanupPrefixedRedisKeys,
} from './helpers/redis-test-helpers.js';

const REDIS_URL = process.env['REDIS_URL'];

describe('RedisMessageStore', { skip: !REDIS_URL ? 'REDIS_URL not set' : false }, () => {
  let RedisMessageStore;
  let createRedisClient;
  let redis;
  let store;
  let connected = false;

  before(async () => {
    assertRedisIsolationOrThrow(REDIS_URL, 'RedisMessageStore');

    const storeModule = await import('../dist/domains/cats/services/RedisMessageStore.js');
    RedisMessageStore = storeModule.RedisMessageStore;
    const redisModule = await import('@cat-cafe/shared/utils');
    createRedisClient = redisModule.createRedisClient;

    redis = createRedisClient({ url: REDIS_URL });
    // Connectivity check: skip all tests if Redis is unreachable
    try {
      await redis.ping();
      connected = true;
    } catch {
      console.warn('[redis-message-store.test] Redis unreachable, skipping tests');
      await redis.quit().catch(() => {});
      return;
    }
    store = new RedisMessageStore(redis, { ttlSeconds: 60 });
  });

  after(async () => {
    if (redis && connected) {
      await cleanupPrefixedRedisKeys(redis, ['msg:*']);
      await redis.quit();
    }
  });

  beforeEach(async (t) => {
    if (!connected) return t.skip('Redis not connected');
    await cleanupPrefixedRedisKeys(redis, ['msg:*']);
  });

  it('append() stores message and returns with id', async () => {
    const msg = await store.append({
      userId: 'user1',
      catId: null,
      content: 'hello',
      mentions: ['opus'],
      timestamp: Date.now(),
    });
    assert.ok(msg.id);
    assert.equal(msg.content, 'hello');
    assert.equal(msg.userId, 'user1');
  });

  it('getRecent() returns messages in chronological order', async () => {
    const now = Date.now();
    await store.append({ userId: 'u', catId: null, content: 'first', mentions: [], timestamp: now });
    await store.append({ userId: 'u', catId: 'opus', content: 'second', mentions: [], timestamp: now + 1 });
    await store.append({ userId: 'u', catId: null, content: 'third', mentions: [], timestamp: now + 2 });

    const recent = await store.getRecent(10);
    assert.equal(recent.length, 3);
    assert.equal(recent[0].content, 'first');
    assert.equal(recent[2].content, 'third');
  });

  it('getRecent() filters by userId', async () => {
    const now = Date.now();
    await store.append({ userId: 'alice', catId: null, content: 'alice msg', mentions: [], timestamp: now });
    await store.append({ userId: 'bob', catId: null, content: 'bob msg', mentions: [], timestamp: now + 1 });

    const aliceOnly = await store.getRecent(10, 'alice');
    assert.equal(aliceOnly.length, 1);
    assert.equal(aliceOnly[0].content, 'alice msg');
  });

  it('getMentionsFor() returns messages mentioning a specific cat', async () => {
    const now = Date.now();
    await store.append({ userId: 'u', catId: null, content: 'hi opus', mentions: ['opus'], timestamp: now });
    await store.append({ userId: 'u', catId: null, content: 'hi codex', mentions: ['codex'], timestamp: now + 1 });
    await store.append({ userId: 'u', catId: null, content: 'hi both', mentions: ['opus', 'codex'], timestamp: now + 2 });

    const opusMentions = await store.getMentionsFor('opus');
    assert.equal(opusMentions.length, 2);
    assert.equal(opusMentions[0].content, 'hi opus');
    assert.equal(opusMentions[1].content, 'hi both');
  });

  it('getMentionsFor() filters by threadId (#75)', async () => {
    const now = Date.now();
    await store.append({ userId: 'u', catId: null, content: '@opus in tA', mentions: ['opus'], timestamp: now, threadId: 'thread-A' });
    await store.append({ userId: 'u', catId: null, content: '@opus in tB', mentions: ['opus'], timestamp: now + 1, threadId: 'thread-B' });
    await store.append({ userId: 'u', catId: null, content: '@opus in tA again', mentions: ['opus'], timestamp: now + 2, threadId: 'thread-A' });

    const threadA = await store.getMentionsFor('opus', 10, undefined, 'thread-A');
    assert.equal(threadA.length, 2);
    assert.equal(threadA[0].content, '@opus in tA');
    assert.equal(threadA[1].content, '@opus in tA again');

    // Without threadId returns all
    const all = await store.getMentionsFor('opus', 10);
    assert.equal(all.length, 3);
  });

  it('getBefore() returns messages before timestamp', async () => {
    const base = Date.now();
    await store.append({ userId: 'u', catId: null, content: 'old', mentions: [], timestamp: base });
    await store.append({ userId: 'u', catId: null, content: 'mid', mentions: [], timestamp: base + 100 });
    await store.append({ userId: 'u', catId: null, content: 'new', mentions: [], timestamp: base + 200 });

    const before = await store.getBefore(base + 200, 10);
    assert.equal(before.length, 2);
    assert.equal(before[0].content, 'old');
    assert.equal(before[1].content, 'mid');
  });

  it('getBefore() respects limit', async () => {
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await store.append({ userId: 'u', catId: null, content: `msg${i}`, mentions: [], timestamp: base + i });
    }

    const before = await store.getBefore(base + 5, 2);
    assert.equal(before.length, 2);
    // Should get the 2 most recent before the cursor
    assert.equal(before[0].content, 'msg3');
    assert.equal(before[1].content, 'msg4');
  });

  it('message TTL is set', async () => {
    const msg = await store.append({
      userId: 'u',
      catId: null,
      content: 'ttl test',
      mentions: [],
      timestamp: Date.now(),
    });
    const ttl = await redis.ttl(`msg:${msg.id}`);
    assert.ok(ttl > 0, `Expected positive TTL, got ${ttl}`);
    assert.ok(ttl <= 60, `Expected TTL <= 60, got ${ttl}`);
  });
});
