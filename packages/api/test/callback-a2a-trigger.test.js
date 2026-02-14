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

  test('skips callback A2A when thread already has active invocation (no preemption)', async () => {
    const { triggerA2AInvocation } = await import(
      '../dist/routes/callback-a2a-trigger.js'
    );

    let createCalled = 0;
    let routeCalled = 0;
    const broadcasts = [];

    const mockInvocationRecordStore = {
      create() {
        createCalled++;
        return { outcome: 'created', invocationId: 'inv-1' };
      },
      update() {
        throw new Error('update should not be called when skipping');
      },
    };

    const mockInvocationTracker = {
      has() { return true; },
      start() { throw new Error('start should not be called when thread is busy'); },
      complete() {},
    };

    const mockRouter = {
      async *routeExecution() {
        routeCalled++;
        yield { type: 'done', catId: 'codex', isFinal: true, timestamp: Date.now() };
      },
    };

    const mockSocketManager = {
      broadcastAgentMessage(msg, threadId) { broadcasts.push({ msg, threadId }); },
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

    assert.equal(createCalled, 0, 'should skip creating InvocationRecord when thread is busy');
    assert.equal(routeCalled, 0, 'should not execute router route when thread is busy');
    assert.equal(broadcasts.length, 1, 'should emit one system_info message to explain skip');
    assert.equal(broadcasts[0].threadId, 'busy-thread');
    assert.equal(broadcasts[0].msg.type, 'system_info');
    assert.match(String(broadcasts[0].msg.content), /跳过|稍后/);
  });
});
