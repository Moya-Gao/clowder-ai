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
});
