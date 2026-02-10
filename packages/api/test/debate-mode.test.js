/**
 * DebateMode Tests (F11 Step 4)
 *
 * - Each round: catA → catB (routeSerial, maxA2ADepth: 0)
 * - Auto-ends after config.rounds
 * - State machine: currentRound + nextSpeaker
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModeStore, createInitialState } from '../dist/domains/cats/services/ModeStore.js';
import { DebateMode } from '../dist/domains/cats/services/modes/DebateMode.js';
import { ModeOrchestrator } from '../dist/domains/cats/services/ModeOrchestrator.js';

describe('DebateMode', () => {
  describe('getNextState', () => {
    it('increments round and alternates speaker', () => {
      const handler = new DebateMode();
      const config = { topic: 'test', catA: 'opus', catB: 'codex', rounds: 3 };
      const state = { currentRound: 1, nextSpeaker: 'catA' };
      const next = handler.getNextState(config, state);
      assert.equal(next.currentRound, 2);
      assert.equal(next.nextSpeaker, 'catB');
    });

    it('alternates speaker back', () => {
      const handler = new DebateMode();
      const config = { topic: 'test', catA: 'opus', catB: 'codex', rounds: 3 };
      const state = { currentRound: 2, nextSpeaker: 'catB' };
      const next = handler.getNextState(config, state);
      assert.equal(next.currentRound, 3);
      assert.equal(next.nextSpeaker, 'catA');
    });

    it('defaults to 3 rounds when config.rounds is undefined', () => {
      const handler = new DebateMode();
      const config = { topic: 'test', catA: 'opus', catB: 'codex' };
      const state = { currentRound: 3, nextSpeaker: 'catA' };
      const next = handler.getNextState(config, state);
      assert.equal(next.currentRound, 4);
    });
  });

  describe('execute auto-end', () => {
    it('yields system_info when debate exceeds max rounds', async () => {
      const handler = new DebateMode();
      const config = { topic: 'Redis vs 内存', catA: 'opus', catB: 'codex', rounds: 2 };
      const state = { currentRound: 3, nextSpeaker: 'catA' }; // > rounds

      const ctx = {
        strategyDeps: {},
        message: '继续辩论',
        userId: 'user-1',
        threadId: 'thread-1',
        userMessageId: 'msg-1',
        routeOptions: {},
      };

      const messages = [];
      for await (const msg of handler.execute(ctx, config, state)) {
        messages.push(msg);
      }

      assert.equal(messages.length, 1);
      assert.equal(messages[0].type, 'system_info');
      assert.ok(messages[0].content.includes('辩论已结束'));
      assert.ok(messages[0].content.includes('2 轮'));
    });
  });
});

describe('ModeOrchestrator with DebateMode', () => {
  it('debate handler is registered and dispatches', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    // Start debate in a state that will auto-end (round > max)
    modeStore.startMode(
      'thread-d1',
      'debate',
      { topic: '测试辩论', catA: 'opus', catB: 'codex', rounds: 1 },
      'user-1',
      { currentRound: 2, nextSpeaker: 'catA' }, // Already past max
    );

    const ctx = {
      strategyDeps: {},
      message: '测试',
      userId: 'user-1',
      threadId: 'thread-d1',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    // Should get the auto-end system message
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'system_info');
    assert.ok(messages[0].content.includes('辩论已结束'));

    // P1-2 fix: mode should be ended (endMode called by orchestrator)
    const mode = modeStore.getMode('thread-d1');
    assert.equal(mode, null, 'Mode should be null after auto-end');

    // History should contain the ended record
    const history = modeStore.getModeHistory('thread-d1');
    assert.ok(history.length > 0);
    assert.ok(history[history.length - 1].endedAt);
  });

  it('createInitialState for debate has correct defaults', () => {
    const state = createInitialState('debate');
    assert.equal(state.currentRound, 1);
    assert.equal(state.nextSpeaker, 'catA');
  });
});
