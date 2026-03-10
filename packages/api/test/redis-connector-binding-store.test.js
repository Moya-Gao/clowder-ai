import './helpers/setup-cat-registry.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	assertRedisIsolationOrThrow,
	cleanupPrefixedRedisKeys,
} from './helpers/redis-test-helpers.js';

const REDIS_URL = process.env['REDIS_URL'];

describe('RedisConnectorThreadBindingStore', { skip: !REDIS_URL ? 'REDIS_URL not set' : false }, () => {
	let RedisConnectorThreadBindingStore;
	let createRedisClient;
	let redis;
	let store;
	let connected = false;

	before(async () => {
		assertRedisIsolationOrThrow(REDIS_URL, 'RedisConnectorThreadBindingStore');

		const storeModule = await import(
			'../dist/infrastructure/connectors/RedisConnectorThreadBindingStore.js'
		);
		RedisConnectorThreadBindingStore = storeModule.RedisConnectorThreadBindingStore;
		const redisModule = await import('@cat-cafe/shared/utils');
		createRedisClient = redisModule.createRedisClient;

		redis = createRedisClient({ url: REDIS_URL });
		try {
			await redis.ping();
			connected = true;
		} catch {
			console.warn('[redis-connector-binding-store.test] Redis unreachable, skipping tests');
			await redis.quit().catch(() => {});
			return;
		}
		store = new RedisConnectorThreadBindingStore(redis);
	});

	after(async () => {
		if (redis && connected) {
			await cleanupPrefixedRedisKeys(redis, ['connector-binding:*', 'connector-binding-rev:*']);
			await redis.quit();
		}
	});

	beforeEach(async (t) => {
		if (!connected) {
			t.skip('Redis not connected');
			return;
		}
		// Clean connector binding keys before each test
		await cleanupPrefixedRedisKeys(redis, ['connector-binding:*', 'connector-binding-rev:*']);
	});

	it('bind creates and retrieves a binding', async () => {
		const binding = await store.bind('feishu', 'oc_chat_123', 'thread-abc', 'user-1');
		assert.equal(binding.connectorId, 'feishu');
		assert.equal(binding.externalChatId, 'oc_chat_123');
		assert.equal(binding.threadId, 'thread-abc');
		assert.equal(binding.userId, 'user-1');
		assert.equal(typeof binding.createdAt, 'number');
	});

	it('getByExternal returns the bound thread', async () => {
		await store.bind('feishu', 'oc_chat_123', 'thread-abc', 'user-1');
		const result = await store.getByExternal('feishu', 'oc_chat_123');
		assert.notEqual(result, null);
		assert.equal(result.threadId, 'thread-abc');
	});

	it('getByExternal returns null for unknown binding', async () => {
		const result = await store.getByExternal('feishu', 'nonexistent');
		assert.equal(result, null);
	});

	it('getByThread returns all bindings for a thread', async () => {
		await store.bind('feishu', 'oc_chat_1', 'thread-abc', 'user-1');
		await store.bind('telegram', 'tg_456', 'thread-abc', 'user-1');
		await store.bind('feishu', 'oc_chat_2', 'thread-def', 'user-1');

		const results = await store.getByThread('thread-abc');
		assert.equal(results.length, 2);
		const connectors = results.map((r) => r.connectorId).sort();
		assert.deepEqual(connectors, ['feishu', 'telegram']);
	});

	it('getByThread returns empty array for unknown thread', async () => {
		const results = await store.getByThread('nonexistent');
		assert.deepEqual(results, []);
	});

	it('remove deletes a binding', async () => {
		await store.bind('feishu', 'oc_chat_123', 'thread-abc', 'user-1');
		const removed = await store.remove('feishu', 'oc_chat_123');
		assert.equal(removed, true);

		const result = await store.getByExternal('feishu', 'oc_chat_123');
		assert.equal(result, null);
	});

	it('remove returns false for nonexistent binding', async () => {
		const removed = await store.remove('feishu', 'nonexistent');
		assert.equal(removed, false);
	});

	it('bind overwrites existing binding for same connector+chat', async () => {
		await store.bind('feishu', 'oc_chat_123', 'thread-abc', 'user-1');
		await store.bind('feishu', 'oc_chat_123', 'thread-def', 'user-1');

		const result = await store.getByExternal('feishu', 'oc_chat_123');
		assert.equal(result.threadId, 'thread-def');

		// Old thread should no longer have this binding
		const oldBindings = await store.getByThread('thread-abc');
		assert.equal(oldBindings.length, 0);
	});

	it('concurrent bind on same chat does not pollute reverse index', async () => {
		// Simulate two concurrent bind() calls on the same feishu chat
		// targeting different threads. After both settle, reverse index
		// must be consistent: only the winner's thread should list this binding.
		await Promise.all([
			store.bind('feishu', 'oc_race', 'thread-A', 'user-1'),
			store.bind('feishu', 'oc_race', 'thread-B', 'user-1'),
		]);

		// One of them won — the hash determines the final state
		const final = await store.getByExternal('feishu', 'oc_race');
		assert.notEqual(final, null);
		const winnerThread = final.threadId;
		const loserThread = winnerThread === 'thread-A' ? 'thread-B' : 'thread-A';

		// Winner's reverse index must contain the binding
		const winnerBindings = await store.getByThread(winnerThread);
		assert.equal(winnerBindings.length, 1);
		assert.equal(winnerBindings[0].threadId, winnerThread);

		// Loser's reverse index must NOT contain stale entries
		const loserBindings = await store.getByThread(loserThread);
		// With defensive getByThread, stale entries should be filtered out
		const realLoserBindings = loserBindings.filter((b) => b.threadId === loserThread);
		assert.equal(realLoserBindings.length, 0, 'loser thread should have no bindings pointing to it');
	});

	it('getByThread filters out stale reverse index entries', async () => {
		// Manually create a stale reverse index entry to test defensive validation
		await store.bind('feishu', 'oc_stale', 'thread-old', 'user-1');
		// Rebind to new thread
		await store.bind('feishu', 'oc_stale', 'thread-new', 'user-1');

		// Query old thread — should return empty (no stale cross-references)
		const oldBindings = await store.getByThread('thread-old');
		assert.equal(oldBindings.length, 0);
	});

	it('data survives reconnection (persistence check)', async () => {
		await store.bind('feishu', 'oc_chat_persist', 'thread-persist', 'user-1');

		// Create a new store instance (simulates restart)
		const store2 = new RedisConnectorThreadBindingStore(redis);
		const result = await store2.getByExternal('feishu', 'oc_chat_persist');
		assert.notEqual(result, null);
		assert.equal(result.threadId, 'thread-persist');
	});
});
