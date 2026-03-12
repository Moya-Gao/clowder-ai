/**
 * Callback Bootcamp State Tests
 * POST /api/callbacks/update-bootcamp-state
 *
 * Uses lightweight Fastify injection (no real HTTP server).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import './helpers/setup-cat-registry.js';

describe('Callback Bootcamp State', () => {
  let registry;
  let threadStore;
  let messageStore;
  let socketManager;

  beforeEach(async () => {
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { ThreadStore } = await import(
      '../dist/domains/cats/services/stores/ports/ThreadStore.js'
    );
    const { MessageStore } = await import(
      '../dist/domains/cats/services/stores/ports/MessageStore.js'
    );

    registry = new InvocationRegistry();
    threadStore = new ThreadStore();
    messageStore = new MessageStore();
    socketManager = {
      broadcastAgentMessage() {},
      getMessages() { return []; },
    };
  });

  async function createApp() {
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    const app = Fastify();
    await app.register(callbacksRoutes, {
      registry,
      messageStore,
      socketManager,
      threadStore,
      sharedBank: 'cat-cafe-shared',
    });
    return app;
  }

  test('returns 401 without valid credentials', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId: 'fake-id',
        callbackToken: 'fake-token',
        threadId: 'thread-1',
        phase: 'phase-1-intro',
      },
    });

    assert.equal(response.statusCode, 401);
  });

  test('updates phase and leadCat', async () => {
    const app = await createApp();

    // Create a thread with initial bootcamp state
    const thread = await threadStore.create('user-1', '🎓 训练营');
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', thread.id);
    await threadStore.updateBootcampState(thread.id, {
      v: 1,
      phase: 'phase-0-select-cat',
      startedAt: 1000,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: thread.id,
        phase: 'phase-1-intro',
        leadCat: 'opus',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.bootcampState.phase, 'phase-1-intro');
    assert.equal(body.bootcampState.leadCat, 'opus');
    assert.equal(body.bootcampState.startedAt, 1000); // preserved
  });

  test('preserves existing fields on partial update', async () => {
    const app = await createApp();

    const thread = await threadStore.create('user-1', '🎓 训练营');
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', thread.id);
    await threadStore.updateBootcampState(thread.id, {
      v: 1,
      phase: 'phase-1-intro',
      leadCat: 'opus',
      startedAt: 1000,
    });

    // Only update phase, leadCat should be preserved
    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: thread.id,
        phase: 'phase-4-task-select',
        selectedTaskId: 'Q3',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.bootcampState.phase, 'phase-4-task-select');
    assert.equal(body.bootcampState.leadCat, 'opus'); // preserved
    assert.equal(body.bootcampState.selectedTaskId, 'Q3');
    assert.equal(body.bootcampState.startedAt, 1000); // preserved
  });

  test('returns 404 for non-existent thread', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', 'nonexistent');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: 'nonexistent',
        phase: 'phase-1-intro',
      },
    });

    assert.equal(response.statusCode, 404);
  });

  test('returns 400 for invalid phase', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    const thread = await threadStore.create('user-1', '🎓 训练营');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: thread.id,
        phase: 'phase-99-invalid',
      },
    });

    assert.equal(response.statusCode, 400);
  });

  test('P1: rejects cross-thread write (invocation bound to thread A, writing thread B)', async () => {
    const app = await createApp();
    const threadA = await threadStore.create('user-1', 'Thread A');
    const threadB = await threadStore.create('user-1', 'Thread B');
    await threadStore.updateBootcampState(threadB.id, {
      v: 1,
      phase: 'phase-0-select-cat',
      startedAt: 1000,
    });

    // Invocation is bound to thread A
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', threadA.id);

    // Try to write to thread B — should be rejected
    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: threadB.id,
        phase: 'phase-11-farewell',
      },
    });

    assert.equal(response.statusCode, 403);

    // Verify thread B state was NOT modified
    const threadBAfter = await threadStore.get(threadB.id);
    assert.equal(threadBAfter.bootcampState.phase, 'phase-0-select-cat');
  });

  test('P1: rejects default-thread invocation writing another thread', async () => {
    const app = await createApp();
    const threadB = await threadStore.create('user-1', 'Thread B');
    await threadStore.updateBootcampState(threadB.id, {
      v: 1,
      phase: 'phase-0-select-cat',
      startedAt: 1000,
    });

    // Invocation with default thread (no threadId passed)
    const { invocationId, callbackToken } = registry.create('user-1', 'opus');

    // Try to write thread B — should be rejected
    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: threadB.id,
        phase: 'phase-11-farewell',
      },
    });

    assert.equal(response.statusCode, 403);
    const after = await threadStore.get(threadB.id);
    assert.equal(after.bootcampState.phase, 'phase-0-select-cat');
  });

  test('P2: ignores stale invocation (superseded by newer invocation)', async () => {
    const app = await createApp();
    const thread = await threadStore.create('user-1', '🎓 训练营');
    await threadStore.updateBootcampState(thread.id, {
      v: 1,
      phase: 'phase-0-select-cat',
      startedAt: 1000,
    });

    // First invocation (will become stale)
    const old = registry.create('user-1', 'opus', thread.id);
    // Second invocation supersedes the first
    registry.create('user-1', 'opus', thread.id);

    // Old invocation tries to write — should be ignored
    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId: old.invocationId,
        callbackToken: old.callbackToken,
        threadId: thread.id,
        phase: 'phase-11-farewell',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'stale_ignored');

    // Verify state was NOT modified
    const after = await threadStore.get(thread.id);
    assert.equal(after.bootcampState.phase, 'phase-0-select-cat');
  });

  test('auto-pins thread when advancing to phase-11-farewell', async () => {
    const app = await createApp();
    const thread = await threadStore.create('user-1', '🎓 训练营');
    const { invocationId, callbackToken } = registry.create('user-1', 'opus', thread.id);
    await threadStore.updateBootcampState(thread.id, {
      v: 1,
      phase: 'phase-10-retro',
      leadCat: 'opus',
      startedAt: 1000,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-bootcamp-state',
      payload: {
        invocationId,
        callbackToken,
        threadId: thread.id,
        phase: 'phase-11-farewell',
        completedAt: Date.now(),
      },
    });

    assert.equal(response.statusCode, 200);
    const after = await threadStore.get(thread.id);
    assert.equal(after.bootcampState.phase, 'phase-11-farewell');
    assert.equal(after.pinned, true, 'Thread should be auto-pinned on farewell');
  });
});
