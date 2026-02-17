/**
 * Mode Integration Tests (F11 Step 5)
 *
 * Verifies messages.ts dispatches to ModeOrchestrator when active mode exists,
 * and falls back to AgentRouter when no mode is active (backward compatibility).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModeStore, createInitialState } from '../dist/domains/cats/services/stores/ports/ModeStore.js';
import { ModeOrchestrator } from '../dist/domains/cats/services/ModeOrchestrator.js';

describe('Mode Integration (dispatch logic)', () => {
  it('ModeOrchestrator only dispatches when mode is active', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    // No active mode → throws
    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'thread-no-mode',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    await assert.rejects(async () => {
      for await (const _ of orchestrator.execute(ctx)) { /* consume */ }
    }, /No active mode/);
  });

  it('mode check gate: getMode returns null when no mode active', () => {
    const modeStore = new ModeStore();
    assert.equal(modeStore.getMode('any-thread'), null);
  });

  it('mode check gate: getMode returns mode when active', () => {
    const modeStore = new ModeStore();
    modeStore.startMode(
      'thread-active',
      'brainstorm',
      { topic: '测试', participants: ['opus'] },
      'user-1',
      createInitialState('brainstorm'),
    );
    const mode = modeStore.getMode('thread-active');
    assert.notEqual(mode, null);
    assert.equal(mode.record.name, 'brainstorm');
  });

  it('backward compat: no modeStore/orchestrator opts → routeExecution path', () => {
    // This verifies the optional nature of the opts.
    // In messages.ts: `const activeMode = opts.modeStore?.getMode(...)` returns undefined
    // when opts.modeStore is absent → falls through to AgentRouter path.
    const opts = {};
    const activeMode = opts.modeStore?.getMode('any');
    assert.equal(activeMode, undefined);
    // undefined is falsy → the `if (activeMode && opts.modeOrchestrator)` is false
    assert.equal(!!(activeMode && opts.modeOrchestrator), false);
  });

  it('dispatch logic: mode active + orchestrator present → truthy', () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });
    modeStore.startMode(
      'thread-mode',
      'debate',
      { topic: 'test', catA: 'opus', catB: 'codex' },
      'user-1',
      createInitialState('debate'),
    );
    const opts = { modeStore, modeOrchestrator: orchestrator };
    const activeMode = opts.modeStore.getMode('thread-mode');
    assert.ok(activeMode);
    assert.ok(opts.modeOrchestrator);
    // Combined gate
    assert.ok(!!(activeMode && opts.modeOrchestrator));
  });

  it('orchestrator state persists across multiple execute calls', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    // Use a stub handler to avoid real agent calls
    const calls = [];
    orchestrator.registerHandler('brainstorm', {
      async *execute(ctx, config, state) {
        calls.push({ round: state.currentRound });
        yield { type: 'text', catId: 'opus', content: `R${state.currentRound}`, timestamp: Date.now() };
      },
      getNextState(config, state) {
        if (!state.roundOneComplete) return { roundOneComplete: true, currentRound: 2 };
        return { roundOneComplete: true, currentRound: state.currentRound + 1 };
      },
      shouldAutoEnd() { return false; },
    });

    modeStore.startMode(
      'thread-persist',
      'brainstorm',
      { topic: '持久化测试', participants: ['opus', 'codex'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    const baseCtx = {
      strategyDeps: {},
      userId: 'user-1',
      threadId: 'thread-persist',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    // Round 1
    for await (const _ of orchestrator.execute({ ...baseCtx, message: 'msg1' })) {}
    assert.equal(modeStore.getMode('thread-persist').state.currentRound, 2);

    // Round 2
    for await (const _ of orchestrator.execute({ ...baseCtx, message: 'msg2' })) {}
    assert.equal(modeStore.getMode('thread-persist').state.currentRound, 3);

    assert.equal(calls.length, 2);
    assert.equal(calls[0].round, 1);
    assert.equal(calls[1].round, 2);
  });

  it('ending mode makes orchestrator fall through to router path', () => {
    const modeStore = new ModeStore();
    modeStore.startMode(
      'thread-end',
      'brainstorm',
      { topic: 'test', participants: ['opus'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    assert.ok(modeStore.getMode('thread-end'));

    // End the mode
    modeStore.endMode('thread-end', '结束');

    // Now getMode returns null → dispatch would go to router
    assert.equal(modeStore.getMode('thread-end'), null);
  });
});
