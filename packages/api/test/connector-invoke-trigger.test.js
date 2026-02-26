// @ts-check
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ConnectorInvokeTrigger } from '../dist/infrastructure/email/ConnectorInvokeTrigger.js';

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
  return {
    broadcasts,
    roomBroadcasts,
    /** @type {any} */
    manager: {
      broadcastAgentMessage(msg, threadId) {
        broadcasts.push({ msg, threadId });
      },
      broadcastToRoom(room, event, data) {
        roomBroadcasts.push({ room, event, data });
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

  return {
    starts,
    completes,
    setAborted(val) { aborted = val; },
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

  beforeEach(() => {
    routerMock = mockRouter();
    socketMock = mockSocketManager();
    recordMock = mockInvocationRecordStore();
    trackerMock = mockInvocationTracker();
  });

  function createTrigger(overrides = {}) {
    return new ConnectorInvokeTrigger({
      router: routerMock.router,
      socketManager: socketMock.manager,
      invocationRecordStore: recordMock.store,
      invocationTracker: trackerMock.tracker,
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
});
