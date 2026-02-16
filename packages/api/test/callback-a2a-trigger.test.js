/**
 * Unit tests for callback-a2a-trigger.ts
 *
 * P2-1 regression: deleting race → InvocationRecord marked canceled
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('triggerA2AInvocation', () => {
  test('marks InvocationRecord as canceled when thread is deleting (P2-1)', async () => {
    const { triggerA2AInvocation } = await import(
      '../dist/routes/callback-a2a-trigger.js'
    );

    const updates = [];
    const mockInvocationRecordStore = {
      create() {
        return { outcome: 'created', invocationId: 'inv-1' };
      },
      update(id, data) {
        updates.push({ id, ...data });
        return { id, ...data };
      },
    };

    // Simulate aborted signal (thread is deleting)
    const abortController = new AbortController();
    abortController.abort();

    const mockInvocationTracker = {
      has() { return false; },
      start() { return abortController; },
      complete() {},
    };

    const mockRouter = {
      async *routeExecution() {
        throw new Error('should not be called');
      },
    };

    const mockSocketManager = {
      broadcastAgentMessage() {},
      broadcastToRoom() {},
    };

    const mockLog = {
      error() {},
      warn() {},
      info() {},
    };

    await triggerA2AInvocation(
      {
        router: mockRouter,
        invocationRecordStore: mockInvocationRecordStore,
        socketManager: mockSocketManager,
        invocationTracker: mockInvocationTracker,
        log: mockLog,
      },
      {
        targetCats: ['codex'],
        content: '@缅因猫\nreview please',
        userId: 'user-1',
        threadId: 't-deleting',
        triggerMessage: { id: 'msg-1', threadId: 't-deleting', userId: 'user-1',
          catId: 'opus', content: 'test', mentions: [], timestamp: Date.now() },
      },
    );

    // Should have update calls: one for canceled status
    const cancelUpdate = updates.find((u) => u.status === 'canceled');
    assert.ok(cancelUpdate, 'InvocationRecord must be marked as canceled on deleting race');
    assert.equal(cancelUpdate.id, 'inv-1');
  });

  test('does not trigger invocation for duplicate idempotency key', async () => {
    const { triggerA2AInvocation } = await import(
      '../dist/routes/callback-a2a-trigger.js'
    );

    const updates = [];
    const mockInvocationRecordStore = {
      create() {
        return { outcome: 'duplicate', invocationId: 'inv-existing' };
      },
      update(id, data) {
        updates.push({ id, ...data });
        return { id, ...data };
      },
    };

    const mockRouter = {
      async *routeExecution() {
        throw new Error('should not be called');
      },
    };

    const mockSocketManager = {
      broadcastAgentMessage() {},
      broadcastToRoom() {},
    };

    const mockLog = { error() {}, warn() {}, info() {} };

    await triggerA2AInvocation(
      {
        router: mockRouter,
        invocationRecordStore: mockInvocationRecordStore,
        socketManager: mockSocketManager,
        log: mockLog,
      },
      {
        targetCats: ['codex'],
        content: '@缅因猫\nreview',
        userId: 'user-1',
        threadId: 't1',
        triggerMessage: { id: 'msg-1', threadId: 't1', userId: 'user-1',
          catId: 'opus', content: 'test', mentions: [], timestamp: Date.now() },
      },
    );

    assert.equal(updates.length, 0, 'No updates on duplicate');
  });

  test('A2A with active parent does NOT call tracker.start (preserving old test structure)', async () => {
    const { triggerA2AInvocation } = await import(
      '../dist/routes/callback-a2a-trigger.js'
    );

    let startCalled = 0;
    let routeCalled = 0;

    const mockInvocationRecordStore = {
      create() { return { outcome: 'created', invocationId: 'inv-1' }; },
      update() {},
    };

    const mockInvocationTracker = {
      has() { return true; },
      start() { startCalled++; return new AbortController(); },
      complete() {},
    };

    const mockRouter = {
      async *routeExecution() {
        routeCalled++;
        yield { type: 'done', catId: 'codex', isFinal: true, timestamp: Date.now() };
      },
    };

    const mockSocketManager = {
      broadcastAgentMessage() {},
      broadcastToRoom() {},
    };

    const mockLog = { error() {}, warn() {}, info() {} };

    await triggerA2AInvocation(
      {
        router: mockRouter,
        invocationRecordStore: mockInvocationRecordStore,
        socketManager: mockSocketManager,
        invocationTracker: mockInvocationTracker,
        log: mockLog,
      },
      {
        targetCats: ['codex'],
        content: '@缅因猫\nreview please',
        userId: 'user-1',
        threadId: 'busy-thread',
        triggerMessage: { id: 'msg-1', threadId: 'busy-thread', userId: 'user-1',
          catId: 'opus', content: 'test', mentions: [], timestamp: Date.now() },
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    // With fix: A2A chain proceeds, but tracker.start() is NOT called
    assert.equal(startCalled, 0, 'tracker.start must not be called when parent is active');
    assert.equal(routeCalled, 1, 'routeExecution must be called for A2A chain');
  });

  test('skips redundant A2A when target cat is already in active parent target set', async () => {
    const { triggerA2AInvocation } = await import(
      '../dist/routes/callback-a2a-trigger.js'
    );

    let createCalled = 0;
    let routeCalled = 0;

    const mockInvocationRecordStore = {
      create() {
        createCalled++;
        return { outcome: 'created', invocationId: 'inv-dup' };
      },
      update() {},
    };

    const mockInvocationTracker = {
      has() { return true; },
      getCatIds() { return ['opus', 'codex', 'gemini']; },
      start() { return new AbortController(); },
      complete() {},
    };

    const mockRouter = {
      async *routeExecution() {
        routeCalled++;
        yield { type: 'done', catId: 'codex', isFinal: true, timestamp: Date.now() };
      },
    };

    const mockSocketManager = {
      broadcastAgentMessage() {},
      broadcastToRoom() {},
    };

    const mockLog = { error() {}, warn() {}, info() {} };

    await triggerA2AInvocation(
      {
        router: mockRouter,
        invocationRecordStore: mockInvocationRecordStore,
        socketManager: mockSocketManager,
        invocationTracker: mockInvocationTracker,
        log: mockLog,
      },
      {
        targetCats: ['codex'],
        content: '@缅因猫\nalready covered by parent',
        userId: 'user-1',
        threadId: 'active-thread',
        triggerMessage: { id: 'msg-covered', threadId: 'active-thread', userId: 'user-1',
          catId: 'opus', content: 'test', mentions: [], timestamp: Date.now() },
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(createCalled, 0, 'redundant A2A should not create InvocationRecord');
    assert.equal(routeCalled, 0, 'redundant A2A should not execute routeExecution');
  });

  test('A2A chain proceeds when parent invocation is active (no tracker.start)', async () => {
    const { triggerA2AInvocation } = await import(
      '../dist/routes/callback-a2a-trigger.js'
    );

    let startCalled = 0;
    let routeCalled = 0;
    const updates = [];
    const roomEvents = [];

    const mockInvocationRecordStore = {
      create() {
        return { outcome: 'created', invocationId: 'inv-child' };
      },
      update(id, data) {
        updates.push({ id, ...data });
        return { id, ...data };
      },
    };

    const mockInvocationTracker = {
      has() { return true; }, // parent invocation is active
      start() { startCalled++; return new AbortController(); },
      complete() {},
    };

    const mockRouter = {
      async *routeExecution() {
        routeCalled++;
        yield { type: 'done', catId: 'codex', isFinal: true, timestamp: Date.now() };
      },
    };

    const mockSocketManager = {
      broadcastAgentMessage() {},
      broadcastToRoom(room, event, payload) { roomEvents.push({ room, event, payload }); },
    };

    const mockLog = { error() {}, warn() {}, info() {} };

    await triggerA2AInvocation(
      {
        router: mockRouter,
        invocationRecordStore: mockInvocationRecordStore,
        socketManager: mockSocketManager,
        invocationTracker: mockInvocationTracker,
        log: mockLog,
      },
      {
        targetCats: ['codex'],
        content: '@缅因猫\nplease review this',
        userId: 'user-1',
        threadId: 'active-thread',
        triggerMessage: { id: 'msg-chain', threadId: 'active-thread', userId: 'user-1',
          catId: 'opus', content: 'test', mentions: [], timestamp: Date.now() },
      },
    );

    // Wait for fire-and-forget background task
    await new Promise((resolve) => setTimeout(resolve, 20));

    // KEY ASSERTIONS:
    // 1. routeExecution SHOULD be called (A2A chain proceeds)
    assert.equal(routeCalled, 1, 'A2A chain must proceed even when parent invocation is active');
    // 2. invocationTracker.start() should NOT be called (don't abort parent)
    assert.equal(startCalled, 0, 'tracker.start() must not be called to avoid aborting parent invocation');
    // 3. intent_mode should be broadcast (so frontend shows loading state)
    assert.ok(roomEvents.some(e => e.event === 'intent_mode'), 'intent_mode must be broadcast for A2A chain');
    // 4. InvocationRecord should be marked succeeded (not canceled)
    assert.ok(updates.some(u => u.status === 'succeeded'), 'child invocation must succeed, not be canceled');
  });

  test('broadcasts terminal error + done when routeExecution throws (release loading lock)', async () => {
    const { triggerA2AInvocation } = await import(
      '../dist/routes/callback-a2a-trigger.js'
    );

    const updates = [];
    const roomEvents = [];
    const agentBroadcasts = [];
    const mockInvocationRecordStore = {
      create() {
        return { outcome: 'created', invocationId: 'inv-err' };
      },
      update(id, data) {
        updates.push({ id, ...data });
        return { id, ...data };
      },
    };

    const mockInvocationTracker = {
      has() { return false; },
      start() { return new AbortController(); },
      complete() {},
    };

    const mockRouter = {
      async *routeExecution() {
        throw new Error('route failed before done');
      },
    };

    const mockSocketManager = {
      broadcastAgentMessage(msg, threadId) { agentBroadcasts.push({ msg, threadId }); },
      broadcastToRoom(room, event, payload) { roomEvents.push({ room, event, payload }); },
    };

    const mockLog = { error() {}, warn() {}, info() {} };

    await triggerA2AInvocation(
      {
        router: mockRouter,
        invocationRecordStore: mockInvocationRecordStore,
        socketManager: mockSocketManager,
        invocationTracker: mockInvocationTracker,
        log: mockLog,
      },
      {
        targetCats: ['codex'],
        content: '@缅因猫\nplease review',
        userId: 'user-1',
        threadId: 'thread-err',
        triggerMessage: { id: 'msg-err', threadId: 'thread-err', userId: 'user-1',
          catId: 'opus', content: 'test', mentions: [], timestamp: Date.now() },
      },
    );

    // triggerA2AInvocation is fire-and-forget; wait for background task to flush.
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(roomEvents.length, 1, 'should emit intent_mode once execution starts');
    assert.equal(roomEvents[0].event, 'intent_mode');
    assert.equal(agentBroadcasts.some((b) => b.msg.type === 'error'), true, 'should broadcast error on execution failure');
    assert.equal(
      agentBroadcasts.some((b) => b.msg.type === 'done' && b.msg.isFinal === true),
      true,
      'should broadcast terminal done(isFinal) to release loading lock',
    );
    assert.equal(updates.some((u) => u.status === 'failed'), true, 'failed status should be persisted');
  });
});
