/**
 * RedisInvocationRecordStore tests
 * 有 Redis → 测全量；无 Redis → skip
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const REDIS_URL = process.env['REDIS_URL'];

describe('RedisInvocationRecordStore', { skip: !REDIS_URL ? 'REDIS_URL not set' : false }, () => {
  let RedisInvocationRecordStore;
  let createRedisClient;
  let redis;
  let store;
  let connected = false;

  before(async () => {
    const storeModule = await import('../dist/domains/cats/services/RedisInvocationRecordStore.js');
    RedisInvocationRecordStore = storeModule.RedisInvocationRecordStore;
    const redisModule = await import('@cat-cafe/shared/utils');
    createRedisClient = redisModule.createRedisClient;

    redis = createRedisClient({ url: REDIS_URL });
    try {
      await redis.ping();
      connected = true;
    } catch {
      console.warn('[redis-invocation-record-store.test] Redis unreachable, skipping tests');
      await redis.quit().catch(() => {});
      return;
    }
    store = new RedisInvocationRecordStore(redis);
  });

  after(async () => {
    if (redis && connected) {
      // Clean up test keys (bare keys — ioredis auto-prefixes)
      const keys = await redis.keys('invoc:*');
      const idempKeys = await redis.keys('idemp:*');
      const allKeys = [...keys, ...idempKeys];
      if (allKeys.length > 0) {
        await redis.del(...allKeys);
      }
      await redis.quit();
    }
  });

  beforeEach(async (t) => {
    if (!connected) return t.skip('Redis not connected');
    // Clean up before each test (bare keys — ioredis auto-prefixes)
    const keys = await redis.keys('invoc:*');
    const idempKeys = await redis.keys('idemp:*');
    const allKeys = [...keys, ...idempKeys];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
  });

  it('create() returns created outcome', async () => {
    const result = await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'redis-key-1',
    });

    assert.equal(result.outcome, 'created');
    assert.ok(result.invocationId.length > 0);
  });

  it('create() record has correct initial state', async () => {
    const { invocationId } = await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus', 'codex'],
      intent: 'ideate',
      idempotencyKey: 'redis-key-2',
    });

    const record = await store.get(invocationId);
    assert.ok(record);
    assert.equal(record.status, 'queued');
    assert.equal(record.userMessageId, null);
    assert.equal(record.threadId, 'thread-1');
    assert.equal(record.userId, 'user-1');
    assert.deepEqual(record.targetCats, ['opus', 'codex']);
    assert.equal(record.intent, 'ideate');
    assert.equal(record.idempotencyKey, 'redis-key-2');
    assert.equal(record.error, undefined);
  });

  it('Lua atomic dedup returns duplicate on same key', async () => {
    const first = await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'dup-key',
    });
    assert.equal(first.outcome, 'created');

    const second = await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'dup-key',
    });
    assert.equal(second.outcome, 'duplicate');
    assert.equal(second.invocationId, first.invocationId);
  });

  it('different threadId with same key does not dedup', async () => {
    const first = await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'same-key',
    });
    const second = await store.create({
      threadId: 'thread-2',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'same-key',
    });

    assert.equal(first.outcome, 'created');
    assert.equal(second.outcome, 'created');
    assert.notEqual(first.invocationId, second.invocationId);
  });

  it('get() returns null for non-existent id', async () => {
    const result = await store.get('non-existent-id');
    assert.equal(result, null);
  });

  it('update() changes status', async () => {
    const { invocationId } = await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'upd-key',
    });

    const updated = await store.update(invocationId, { status: 'running' });
    assert.equal(updated.status, 'running');
  });

  it('update() backfills userMessageId', async () => {
    const { invocationId } = await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'backfill-key',
    });

    const before = await store.get(invocationId);
    assert.equal(before.userMessageId, null);

    await store.update(invocationId, { userMessageId: 'msg-456' });
    const after = await store.get(invocationId);
    assert.equal(after.userMessageId, 'msg-456');
  });

  it('update() sets error on failed status', async () => {
    const { invocationId } = await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'err-key',
    });

    await store.update(invocationId, { status: 'failed', error: 'CLI ENOENT' });
    const record = await store.get(invocationId);
    assert.equal(record.status, 'failed');
    assert.equal(record.error, 'CLI ENOENT');
  });

  it('update() returns null for non-existent id', async () => {
    const result = await store.update('non-existent', { status: 'running' });
    assert.equal(result, null);
  });

  it('getByIdempotencyKey() finds record', async () => {
    const { invocationId } = await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'lookup-key',
    });

    const found = await store.getByIdempotencyKey('thread-1', 'user-1', 'lookup-key');
    assert.ok(found);
    assert.equal(found.id, invocationId);
  });

  it('getByIdempotencyKey() returns null for wrong scope', async () => {
    await store.create({
      threadId: 'thread-1',
      userId: 'user-1',
      targetCats: ['opus'],
      intent: 'execute',
      idempotencyKey: 'scoped-key',
    });

    const r1 = await store.getByIdempotencyKey('thread-2', 'user-1', 'scoped-key');
    assert.equal(r1, null);
    const r2 = await store.getByIdempotencyKey('thread-1', 'user-2', 'scoped-key');
    assert.equal(r2, null);
  });
});
