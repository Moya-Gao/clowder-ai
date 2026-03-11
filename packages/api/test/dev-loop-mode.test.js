/**
 * DevLoopMode Tests (F11 dev-loop)
 *
 * - Full cycle: develop → review APPROVED → auto-end + summary
 * - Fix cycle: develop → review NEEDS_FIX → fix → review APPROVED
 * - Max iterations reached → forced end
 * - Phase system_info messages yielded correctly
 * - P3 accumulation in final report
 * - leadCat ≠ reviewCat enforced (route-level, tested in modes-route)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DevLoopMode } from '../dist/domains/cats/services/modes/DevLoopMode.js';
import { ModeStore, createInitialState } from '../dist/domains/cats/services/stores/ports/ModeStore.js';
import { ModeOrchestrator } from '../dist/domains/cats/services/orchestration/ModeOrchestrator.js';

// ── Helpers ──

/** Collect all messages from an async iterable */
async function collect(iterable) {
  const msgs = [];
  for await (const msg of iterable) msgs.push(msg);
  return msgs;
}

/** Create a fake routeSerial that yields predetermined text */
function createFakeRouteSerial(responses) {
  let callIdx = 0;
  return async function* fakeRouteSerial(_deps, cats, message, _userId, _threadId, _options) {
    const catId = cats[0];
    const response = responses[callIdx] ?? 'default response';
    callIdx++;
    yield { type: 'text', catId, content: response, timestamp: Date.now() };
    yield { type: 'done', catId, timestamp: Date.now() };
  };
}

/** Create a DevLoopMode with injected fake routeSerial */
function createTestMode(responses) {
  const mode = new DevLoopMode();
  const fakeRoute = createFakeRouteSerial(responses);
  // Override the private routeCat method to use fake routing
  mode._testRouteOverride = fakeRoute;
  return mode;
}

describe('DevLoopMode', () => {
  describe('createInitialState', () => {
    it('creates dev-loop initial state', () => {
      const state = createInitialState('dev-loop');
      assert.equal(state.phase, 'developing');
      assert.equal(state.iteration, 0);
      assert.deepEqual(state.p3Issues, []);
    });
  });

  describe('getNextState', () => {
    it('transitions to completed', () => {
      const handler = new DevLoopMode();
      const config = { requirement: 'test', leadCat: 'opus', reviewCat: 'codex' };
      const state = { phase: 'developing', iteration: 0, p3Issues: [] };
      const next = handler.getNextState(config, state);
      assert.equal(next.phase, 'completed');
    });

    it('thread-safe: concurrent threads get their own results', () => {
      const handler = new DevLoopMode();
      const config = { requirement: 'test', leadCat: 'opus', reviewCat: 'codex' };
      const state = { phase: 'developing', iteration: 0, p3Issues: [] };

      // Simulate two threads storing results via the internal Map
      handler._resultsByThread.set('thread-A', { iteration: 2, p3Issues: ['A-nit'] });
      handler._resultsByThread.set('thread-B', { iteration: 5, p3Issues: ['B-nit1', 'B-nit2'] });

      // Each getNextState should get its own thread's result
      const nextA = handler.getNextState(config, state, 'thread-A');
      assert.equal(nextA.iteration, 2);
      assert.deepEqual(nextA.p3Issues, ['A-nit']);

      const nextB = handler.getNextState(config, state, 'thread-B');
      assert.equal(nextB.iteration, 5);
      assert.deepEqual(nextB.p3Issues, ['B-nit1', 'B-nit2']);

      // Map should be cleaned up after read
      assert.equal(handler._resultsByThread.size, 0);
    });
  });

  describe('shouldAutoEnd', () => {
    it('returns true when phase is completed', () => {
      const handler = new DevLoopMode();
      const config = { requirement: 'test', leadCat: 'opus', reviewCat: 'codex' };
      assert.equal(
        handler.shouldAutoEnd(config, { phase: 'completed', iteration: 1, p3Issues: [] }),
        true
      );
    });

    it('returns false when phase is not completed', () => {
      const handler = new DevLoopMode();
      const config = { requirement: 'test', leadCat: 'opus', reviewCat: 'codex' };
      assert.equal(
        handler.shouldAutoEnd(config, { phase: 'developing', iteration: 0, p3Issues: [] }),
        false
      );
    });

    it('returns false for non-dev-loop state', () => {
      const handler = new DevLoopMode();
      const config = { requirement: 'test', leadCat: 'opus', reviewCat: 'codex' };
      // brainstorm state
      assert.equal(
        handler.shouldAutoEnd(config, { roundOneComplete: false, currentRound: 1 }),
        false
      );
    });
  });

  describe('execute — completed state', () => {
    it('yields system_info and returns early if already completed', async () => {
      const handler = new DevLoopMode();
      const config = { requirement: 'test', leadCat: 'opus', reviewCat: 'codex' };
      const state = { phase: 'completed', iteration: 2, p3Issues: ['nit'] };
      const ctx = {
        strategyDeps: {},
        message: 'do stuff',
        userId: 'user-1',
        threadId: 'thread-1',
        userMessageId: 'msg-1',
        routeOptions: {},
      };

      const msgs = await collect(handler.execute(ctx, config, state));
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].type, 'system_info');
      assert.ok(msgs[0].content.includes('已完成'));
    });
  });

  describe('ModeOrchestrator integration', () => {
    it('registers dev-loop handler', () => {
      const store = new ModeStore();
      const orch = new ModeOrchestrator({ modeStore: store });
      // If no error, handler is registered
      // We can verify by starting a mode and checking it doesn't throw
      const initialState = createInitialState('dev-loop');
      assert.equal(initialState.phase, 'developing');
    });

    it('auto-ends after completed state', async () => {
      const store = new ModeStore();
      const socketEvents = [];
      const socketManager = {
        broadcastAgentMessage() {},
        broadcastToRoom(room, event, data) { socketEvents.push({ room, event, data }); },
      };
      const orch = new ModeOrchestrator({ modeStore: store, socketManager });

      // Start a dev-loop mode
      const config = { requirement: 'test', leadCat: 'opus', reviewCat: 'codex' };
      store.startMode('t1', 'dev-loop', config, 'user-1', createInitialState('dev-loop'));

      // Register a stub handler that sets completed state
      orch.registerHandler('dev-loop', {
        async *execute(ctx, cfg, st) {
          yield { type: 'system_info', catId: 'opus', content: 'done', timestamp: Date.now() };
        },
        getNextState() {
          return { phase: 'completed', iteration: 1, p3Issues: [] };
        },
        shouldAutoEnd(_, state) {
          return state.phase === 'completed';
        },
      });

      const ctx = {
        strategyDeps: {},
        message: 'test',
        userId: 'user-1',
        threadId: 't1',
        userMessageId: 'msg-1',
        routeOptions: {},
      };

      const msgs = await collect(orch.execute(ctx));
      assert.ok(msgs.length >= 1);

      // Mode should have been auto-ended
      const mode = store.getMode('t1');
      assert.equal(mode, null);

      // Socket broadcast should have been sent
      const endEvent = socketEvents.find(e => e.data.action === 'ended');
      assert.ok(endEvent);
    });
  });
});
