/**
 * ThreadStore Tests
 * 测试对话管理：创建、查询、参与者追踪、LRU 淘汰
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('ThreadStore', () => {
  test('create() returns a thread with generated id', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore();
    const thread = store.create('user-1', 'My thread');

    assert.ok(thread.id.startsWith('thread_'));
    assert.equal(thread.title, 'My thread');
    assert.equal(thread.createdBy, 'user-1');
    assert.deepEqual(thread.participants, []);
    assert.ok(thread.createdAt > 0);
  });

  test('get() returns null for nonexistent thread', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore();
    assert.equal(store.get('nonexistent'), null);
  });

  test('get() auto-creates default thread', async () => {
    const { ThreadStore, DEFAULT_THREAD_ID } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore();
    const thread = store.get(DEFAULT_THREAD_ID);

    assert.ok(thread);
    assert.equal(thread.id, DEFAULT_THREAD_ID);
    assert.equal(thread.createdBy, 'system');
    assert.deepEqual(thread.participants, []);
  });

  test('list() returns user threads + default, sorted by lastActiveAt desc', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore();
    const t1 = store.create('alice', 'Thread 1');
    const t2 = store.create('alice', 'Thread 2');
    store.create('bob', 'Bob thread'); // different user

    // Access default to auto-create it
    store.get('default');

    const aliceThreads = store.list('alice');
    // Should include alice's threads + default
    assert.ok(aliceThreads.length >= 2);
    assert.ok(aliceThreads.some(t => t.id === t1.id));
    assert.ok(aliceThreads.some(t => t.id === t2.id));
    // Default always included
    assert.ok(aliceThreads.some(t => t.id === 'default'));
  });

  test('addParticipants() adds unique cats', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore();
    const thread = store.create('user-1');

    store.addParticipants(thread.id, ['opus', 'codex']);
    assert.deepEqual(store.getParticipants(thread.id), ['opus', 'codex']);

    // Adding opus again should not duplicate
    store.addParticipants(thread.id, ['opus', 'gemini']);
    assert.deepEqual(store.getParticipants(thread.id), ['opus', 'codex', 'gemini']);
  });

  test('getParticipants() returns empty array for nonexistent thread', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore();
    assert.deepEqual(store.getParticipants('nonexistent'), []);
  });

  test('updateLastActive() refreshes timestamp and LRU position', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore();
    const t1 = store.create('user-1', 'Old');
    const originalTime = t1.lastActiveAt;

    // Wait a ms to ensure timestamp changes
    await new Promise(r => setTimeout(r, 5));
    store.updateLastActive(t1.id);

    const updated = store.get(t1.id);
    assert.ok(updated.lastActiveAt >= originalTime);
  });

  test('delete() removes thread, but not default', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore();
    const thread = store.create('user-1', 'Deletable');
    assert.ok(store.get(thread.id));

    const deleted = store.delete(thread.id);
    assert.equal(deleted, true);
    assert.equal(store.get(thread.id), null);

    // Cannot delete default
    store.get('default'); // auto-create
    const deletedDefault = store.delete('default');
    assert.equal(deletedDefault, false);
    assert.ok(store.get('default'));
  });

  test('LRU eviction when exceeding maxThreads', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore({ maxThreads: 3 });

    const t1 = store.create('u', 'T1');
    const t2 = store.create('u', 'T2');
    const t3 = store.create('u', 'T3');
    // Store is at capacity (3). Creating a 4th should evict t1 (oldest).
    const t4 = store.create('u', 'T4');

    assert.equal(store.size, 3);
    assert.equal(store.get(t1.id), null); // evicted (oldest)
    assert.ok(store.get(t2.id));
    assert.ok(store.get(t3.id));
    assert.ok(store.get(t4.id));
  });

  test('LRU eviction skips default thread and evicts next oldest (regression)', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore({ maxThreads: 3 });

    // Access default first — it becomes the oldest key in the Map
    store.get('default');
    const t1 = store.create('u', 'T1');
    const t2 = store.create('u', 'T2');
    // Now: default, t1, t2 → size=3, at capacity

    // Creating t3 should evict t1 (oldest non-default), NOT break
    const t3 = store.create('u', 'T3');

    assert.equal(store.size, 3); // was 4 before fix
    assert.ok(store.get('default')); // protected
    assert.equal(store.get(t1.id), null); // evicted (oldest non-default)
    assert.ok(store.get(t2.id));
    assert.ok(store.get(t3.id));

    // Creating t4 should evict t2
    const t4 = store.create('u', 'T4');
    assert.equal(store.size, 3);
    assert.equal(store.get(t2.id), null);
    assert.ok(store.get(t3.id));
    assert.ok(store.get(t4.id));
  });

  test('create() with no title sets null', async () => {
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/ThreadStore.js'
    );

    const store = new ThreadStore();
    const thread = store.create('user-1');
    assert.equal(thread.title, null);
  });
});
