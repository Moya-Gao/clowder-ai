// @ts-check
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ConnectorInvokeTrigger } from '../dist/infrastructure/email/ConnectorInvokeTrigger.js';

import { InvocationQueue } from '../dist/domains/cats/services/agents/invocation/InvocationQueue.js';

// ─── Mocks ───────────────────────────────────────────────────────

function noopLog() {
  const noop = () => {};
  return /** @type {any} */ ({
    info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop,
    child: () => noopLog(),
  });
}

/**
 * Mock AgentRouter that yields a single done message.
 * @param {object} [opts]
 * @param {Error} [opts.throwError] - If set, routeExecution throws this error
 * @param {boolean} [opts.persistenceFail] - If set, simulates persistence failure
 */
function mockRouter(opts = {}) {
  const calls = /** @type {Array<{userId: string, message: string, threadId: string, userMessageId: string, targetCats: string[], intent: object}>} */ ([]);
  const ackCalls = /** @type {Array<{userId: string, threadId: string}>} */ ([]);

  return {
    calls,
    ackCalls,
    /** @type {any} */
    router: {
      async *routeExecution(userId, message, threadId, userMessageId, targetCats, intent, options) {
        calls.push({ userId, message, threadId, userMessageId, targetCats, intent });

        if (opts.throwError) throw opts.throwError;

        if (opts.persistenceFail && options?.persistenceContext) {
          options.persistenceContext.failed = true;
          options.persistenceContext.errors.push({ catId: targetCats[0], error: 'disk full' });
        }

        yield {
          type: 'text',
          catId: targetCats[0],
          content: 'Review noted. Working on it.',
          timestamp: Date.now(),
        };
        yield {
          type: 'done',
          catId: targetCats[0],
          content: '',
          timestamp: Date.now(),
          metadata: { usage: { inputTokens: 100, outputTokens: 50 } },
        };
      },
      async ackCollectedCursors(userId, threadId, _boundaries) {
        ackCalls.push({ userId, threadId });
      },
    },
  };
}

function mockSocketManager() {
  const broadcasts = /** @type {Array<{msg: any, threadId: string}>} */ ([]);
  const roomBroadcasts = /** @type {Array<{room: string, event: string, data: any}>} */ ([]);
  const userEmits = /** @type {Array<{userId: string, event: string, data: any}>} */ ([]);
  return {
    broadcasts,
    roomBroadcasts,
    userEmits,
    /** @type {any} */
    manager: {
      broadcastAgentMessage(msg, threadId) {
        broadcasts.push({ msg, threadId });
      },
      broadcastToRoom(room, event, data) {
        roomBroadcasts.push({ room, event, data });
      },
      emitToUser(userId, event, data) {
        userEmits.push({ userId, event, data });
      },
    },
  };
}

function mockInvocationRecordStore() {
  const creates = /** @type {any[]} */ ([]);
  const updates = /** @type {Array<{id: string, data: any}>} */ ([]);
  let createCounter = 0;

  return {
    creates,
    updates,
    /** @type {any} */
    store: {
      async create(input) {
        creates.push(input);
        createCounter++;
        return { outcome: 'created', invocationId: `inv-${createCounter}` };
      },
      async update(id, data) {
        updates.push({ id, data });
      },
    },
    /** Force next create to return duplicate */
    setDuplicate() {
      this.store.create = async (input) => {
        creates.push(input);
        return { outcome: 'duplicate', invocationId: 'inv-existing' };
      };
    },
  };
}

function mockInvocationTracker() {
  const starts = /** @type {Array<{threadId: string}>} */ ([]);
  const completes = /** @type {Array<{threadId: string}>} */ ([]);
  let aborted = false;
  const activeThreads = new Set();

  return {
    starts,
    completes,
    setAborted(val) { aborted = val; },
    /** Mark a thread as having an active invocation (for queue tests) */
    setActive(threadId) { activeThreads.add(threadId); },
    clearActive(threadId) { activeThreads.delete(threadId); },
    /** @type {any} */
    tracker: {
      start(threadId, userId, targetCats) {
        starts.push({ threadId });
        const controller = { signal: { aborted } };
        return controller;
      },
      complete(threadId, controller) {
        completes.push({ threadId });
      },
      has(threadId) {
        return activeThreads.has(threadId);
      },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe('ConnectorInvokeTrigger', () => {
  /** @type {ReturnType<typeof mockRouter>} */
  let routerMock;
  /** @type {ReturnType<typeof mockSocketManager>} */
  let socketMock;
  /** @type {ReturnType<typeof mockInvocationRecordStore>} */
  let recordMock;
  /** @type {ReturnType<typeof mockInvocationTracker>} */
  let trackerMock;

  /** @type {InvocationQueue} */
  let queue;

  beforeEach(() => {
    routerMock = mockRouter();
    socketMock = mockSocketManager();
    recordMock = mockInvocationRecordStore();
    trackerMock = mockInvocationTracker();
    queue = new InvocationQueue();
  });

  function createTrigger(overrides = {}) {
    return new ConnectorInvokeTrigger({
      router: routerMock.router,
      socketManager: socketMock.manager,
      invocationRecordStore: recordMock.store,
      invocationTracker: trackerMock.tracker,
      invocationQueue: queue,
      log: noopLog(),
      ...overrides,
    });
  }

  /** Wait for background execution to complete */
  async function waitForTrigger() {
    // trigger() is fire-and-forget; give microtasks time to settle
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  it('creates InvocationRecord and calls routeExecution', async () => {
    const trigger = createTrigger();
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'Review msg', 'msg-1');
    await waitForTrigger();

    // InvocationRecord created
    assert.strictEqual(recordMock.creates.length, 1);
    assert.strictEqual(recordMock.creates[0].threadId, 'thread-1');
    assert.deepStrictEqual(recordMock.creates[0].targetCats, ['opus']);
    assert.strictEqual(recordMock.creates[0].idempotencyKey, 'connector-msg-1');

    // routeExecution called
    assert.strictEqual(routerMock.calls.length, 1);
    assert.strictEqual(routerMock.calls[0].userId, 'user-1');
    assert.strictEqual(routerMock.calls[0].message, 'Review msg');
    assert.strictEqual(routerMock.calls[0].threadId, 'thread-1');
    assert.strictEqual(routerMock.calls[0].userMessageId, 'msg-1');
    assert.deepStrictEqual(routerMock.calls[0].targetCats, ['opus']);
  });

  it('broadcasts agent messages to WebSocket room', async () => {
    const trigger = createTrigger();
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'Review msg', 'msg-1');
    await waitForTrigger();

    // Should have broadcast text + done messages
    const agentBroadcasts = socketMock.broadcasts.filter(b => b.threadId === 'thread-1');
    assert.ok(agentBroadcasts.length >= 2, `Expected at least 2 broadcasts, got ${agentBroadcasts.length}`);
    assert.strictEqual(agentBroadcasts[0].msg.type, 'text');
    assert.strictEqual(agentBroadcasts[1].msg.type, 'done');

    // Should have broadcast intent_mode
    const intentBroadcast = socketMock.roomBroadcasts.find(b => b.event === 'intent_mode');
    assert.ok(intentBroadcast, 'Should broadcast intent_mode');
    assert.strictEqual(intentBroadcast.data.mode, 'execute');
  });

  it('updates InvocationRecord through lifecycle: userMessageId → running → succeeded', async () => {
    const trigger = createTrigger();
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
    await waitForTrigger();

    // Check update sequence
    const updates = recordMock.updates;
    assert.ok(updates.length >= 3, `Expected at least 3 updates, got ${updates.length}`);

    // First update: backfill userMessageId
    assert.strictEqual(updates[0].data.userMessageId, 'msg-1');

    // Second update: status running
    assert.strictEqual(updates[1].data.status, 'running');

    // Last update: status succeeded
    const lastUpdate = updates[updates.length - 1];
    assert.strictEqual(lastUpdate.data.status, 'succeeded');
  });

  it('acks cursor boundaries on success', async () => {
    const trigger = createTrigger();
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
    await waitForTrigger();

    assert.strictEqual(routerMock.ackCalls.length, 1);
    assert.strictEqual(routerMock.ackCalls[0].userId, 'user-1');
    assert.strictEqual(routerMock.ackCalls[0].threadId, 'thread-1');
  });

  it('starts and completes InvocationTracker', async () => {
    const trigger = createTrigger();
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
    await waitForTrigger();

    assert.strictEqual(trackerMock.starts.length, 1);
    assert.strictEqual(trackerMock.completes.length, 1);
    assert.strictEqual(trackerMock.completes[0].threadId, 'thread-1');
  });

  it('skips duplicate invocations', async () => {
    recordMock.setDuplicate();
    const trigger = createTrigger();
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
    await waitForTrigger();

    // Should not call routeExecution
    assert.strictEqual(routerMock.calls.length, 0);
    // Should not start tracker
    assert.strictEqual(trackerMock.starts.length, 0);
  });

  it('cancels when thread is being deleted (aborted signal)', async () => {
    trackerMock.setAborted(true);
    const trigger = createTrigger();
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
    await waitForTrigger();

    // Should not call routeExecution
    assert.strictEqual(routerMock.calls.length, 0);

    // Should update status to canceled
    const cancelUpdate = recordMock.updates.find(u => u.data.status === 'canceled');
    assert.ok(cancelUpdate, 'Should set status to canceled');
  });

  it('handles routeExecution errors gracefully', async () => {
    routerMock = mockRouter({ throwError: new Error('CLI crashed') });
    const trigger = createTrigger({ router: routerMock.router });
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
    await waitForTrigger();

    // Should update status to failed
    const failUpdate = recordMock.updates.find(u => u.data.status === 'failed');
    assert.ok(failUpdate, 'Should set status to failed');
    assert.ok(failUpdate.data.error.includes('CLI crashed'));

    // Should broadcast error to WebSocket
    const errorBroadcast = socketMock.broadcasts.find(b => b.msg.type === 'error');
    assert.ok(errorBroadcast, 'Should broadcast error');

    // Should still complete tracker (finally block)
    assert.strictEqual(trackerMock.completes.length, 1);
  });

  it('marks failed on persistence failure', async () => {
    routerMock = mockRouter({ persistenceFail: true });
    const trigger = createTrigger({ router: routerMock.router });
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
    await waitForTrigger();

    const failUpdate = recordMock.updates.find(u => u.data.status === 'failed');
    assert.ok(failUpdate, 'Should set status to failed on persistence failure');
    assert.ok(failUpdate.data.error.includes('persistence failed'));

    // Should NOT ack cursors
    assert.strictEqual(routerMock.ackCalls.length, 0);
  });

  // ── 砚砚 R1 P1: pre-try errors must not leak unhandledRejection ──

  it('R1-P1 regression: create() throws → no unhandledRejection, no tracker leak', async () => {
    // Override create to throw
    recordMock.store.create = async () => { throw new Error('create boom'); };

    const trigger = createTrigger();
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
    await waitForTrigger();

    // Should NOT start tracker (create failed before start)
    assert.strictEqual(trackerMock.starts.length, 0);
    // Should NOT call routeExecution
    assert.strictEqual(routerMock.calls.length, 0);
    // No unhandledRejection = test process survives
  });

  it('R1-P1 regression: userMessageId backfill throws → tracker completes, status=failed', async () => {
    let updateCallCount = 0;
    recordMock.store.update = async (id, data) => {
      updateCallCount++;
      // First update is userMessageId backfill → throw
      if (updateCallCount === 1 && data.userMessageId) {
        throw new Error('backfill boom');
      }
      recordMock.updates.push({ id, data });
    };

    const trigger = createTrigger();
    trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
    await waitForTrigger();

    // Tracker must have been started AND completed (no leak)
    assert.strictEqual(trackerMock.starts.length, 1, 'tracker should start');
    assert.strictEqual(trackerMock.completes.length, 1, 'tracker must complete even on backfill error');

    // Should NOT call routeExecution (error happened before)
    assert.strictEqual(routerMock.calls.length, 0);
  });

  // ── F39 Phase C: Queue mode tests ──

  describe('queue mode (active invocation running)', () => {
    it('enqueues connector message when another cat is running', async () => {
      trackerMock.setActive('thread-1');
      const trigger = createTrigger();
      trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'Review msg', 'msg-1');
      await waitForTrigger();

      // Should NOT call routeExecution (queued instead)
      assert.strictEqual(routerMock.calls.length, 0);
      // Should NOT start tracker (no direct execution)
      assert.strictEqual(trackerMock.starts.length, 0);
      // Should NOT create InvocationRecord (no direct execution)
      assert.strictEqual(recordMock.creates.length, 0);

      // Queue should have the entry
      const entries = queue.list('thread-1', 'user-1');
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].content, 'Review msg');
      assert.strictEqual(entries[0].source, 'connector');
      assert.strictEqual(entries[0].messageId, 'msg-1');
      assert.deepStrictEqual(entries[0].targetCats, ['opus']);
    });

    it('emits queue_updated after enqueue', async () => {
      trackerMock.setActive('thread-1');
      const trigger = createTrigger();
      trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'Review msg', 'msg-1');
      await waitForTrigger();

      const queueUpdate = socketMock.userEmits.find(e => e.event === 'queue_updated');
      assert.ok(queueUpdate, 'Should emit queue_updated');
      assert.strictEqual(queueUpdate.userId, 'user-1');
      assert.strictEqual(queueUpdate.data.threadId, 'thread-1');
      assert.strictEqual(queueUpdate.data.action, 'enqueued');
      assert.ok(Array.isArray(queueUpdate.data.queue));
    });

    it('merges consecutive connector messages from same source', async () => {
      trackerMock.setActive('thread-1');
      const trigger = createTrigger();

      trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'First review', 'msg-1');
      await waitForTrigger();
      trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'Second review', 'msg-2');
      await waitForTrigger();

      const entries = queue.list('thread-1', 'user-1');
      assert.strictEqual(entries.length, 1, 'Should merge into one entry');
      assert.ok(entries[0].content.includes('First review'));
      assert.ok(entries[0].content.includes('Second review'));
      assert.strictEqual(entries[0].messageId, 'msg-1');
      assert.deepStrictEqual(entries[0].mergedMessageIds, ['msg-2']);
    });

    it('emits queue_full_warning when queue is full', async () => {
      trackerMock.setActive('thread-1');
      const trigger = createTrigger();

      // Fill the queue (5 entries = MAX_QUEUE_DEPTH)
      // Use different targetCats to prevent merge
      const cats = ['opus', 'codex', 'opus', 'codex', 'opus'];
      for (let i = 0; i < 5; i++) {
        trigger.trigger('thread-1', /** @type {any} */ (cats[i]), 'user-1', `msg ${i}`, `msg-${i}`);
        await waitForTrigger();
      }

      // 6th message should trigger full warning
      trigger.trigger('thread-1', /** @type {any} */ ('codex'), 'user-1', 'overflow msg', 'msg-overflow');
      await waitForTrigger();

      const fullWarning = socketMock.userEmits.find(e => e.event === 'queue_full_warning');
      assert.ok(fullWarning, 'Should emit queue_full_warning');
      assert.strictEqual(fullWarning.data.source, 'connector');

      // Should NOT have emitted queue_updated for the overflow
      const lastUpdate = socketMock.userEmits.filter(e => e.event === 'queue_updated');
      // 5 successful enqueues = 5 queue_updated events (but not 6)
      assert.strictEqual(lastUpdate.length, 5);
    });

    it('P1 fix: direct execution calls queueProcessor.onInvocationComplete on success', async () => {
      // Codex cloud review P1: connector direct execution doesn't notify QueueProcessor,
      // so queued follow-ups stall forever. This test verifies the fix.
      const qpCalls = /** @type {Array<{threadId: string, status: string}>} */ ([]);
      const mockQueueProcessor = /** @type {any} */ ({
        async onInvocationComplete(threadId, status) {
          qpCalls.push({ threadId, status });
        },
      });

      const trigger = createTrigger({ queueProcessor: mockQueueProcessor });
      trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
      await waitForTrigger();

      // Must have notified QueueProcessor with 'succeeded'
      assert.strictEqual(qpCalls.length, 1, 'Should call onInvocationComplete once');
      assert.strictEqual(qpCalls[0].threadId, 'thread-1');
      assert.strictEqual(qpCalls[0].status, 'succeeded');
    });

    it('P1 fix: direct execution calls queueProcessor.onInvocationComplete on failure', async () => {
      const qpCalls = /** @type {Array<{threadId: string, status: string}>} */ ([]);
      const mockQueueProcessor = /** @type {any} */ ({
        async onInvocationComplete(threadId, status) {
          qpCalls.push({ threadId, status });
        },
      });

      routerMock = mockRouter({ throwError: new Error('boom') });
      const trigger = createTrigger({ router: routerMock.router, queueProcessor: mockQueueProcessor });
      trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'msg', 'msg-1');
      await waitForTrigger();

      assert.strictEqual(qpCalls.length, 1, 'Should call onInvocationComplete once');
      assert.strictEqual(qpCalls[0].threadId, 'thread-1');
      assert.strictEqual(qpCalls[0].status, 'failed');
    });

    it('executes directly when no active invocation', async () => {
      // trackerMock.setActive NOT called → has() returns false
      const trigger = createTrigger();
      trigger.trigger('thread-1', /** @type {any} */ ('opus'), 'user-1', 'Review msg', 'msg-1');
      await waitForTrigger();

      // Should call routeExecution (direct execution)
      assert.strictEqual(routerMock.calls.length, 1);
      // Queue should be empty
      assert.strictEqual(queue.list('thread-1', 'user-1').length, 0);
    });
  });
});
