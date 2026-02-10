/**
 * BrainstormMode + ModeOrchestrator Tests (F11 Step 3 + review fixes)
 *
 * Round 1: routeParallel → independent thinking
 * Round 2+: routeSerial → serial discussion
 * ModeOrchestrator: dispatch + state update + auto-end + mode switch detection
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModeStore, createInitialState } from '../dist/domains/cats/services/ModeStore.js';
import { BrainstormMode } from '../dist/domains/cats/services/modes/BrainstormMode.js';
import { ModeOrchestrator } from '../dist/domains/cats/services/ModeOrchestrator.js';

// ── Stub handler that records calls ──

function createStubHandler() {
  const calls = [];
  return {
    async *execute(ctx, config, state) {
      calls.push({ method: 'execute', config, state, message: ctx.message });
      yield { type: 'text', catId: 'opus', content: `round ${state.currentRound} reply` };
    },
    getNextState(config, state) {
      calls.push({ method: 'getNextState', state });
      if (!state.roundOneComplete) {
        return { roundOneComplete: true, currentRound: 2 };
      }
      return { roundOneComplete: true, currentRound: state.currentRound + 1 };
    },
    shouldAutoEnd() { return false; },
    getCalls() { return calls; },
  };
}

describe('BrainstormMode', () => {
  it('getNextState: round 1 → marks roundOneComplete', () => {
    const handler = new BrainstormMode();
    const config = { topic: 'test', participants: ['opus', 'codex'] };
    const state = { roundOneComplete: false, currentRound: 1 };
    const next = handler.getNextState(config, state);
    assert.equal(next.roundOneComplete, true);
    assert.equal(next.currentRound, 2);
  });

  it('getNextState: round 2+ → increments currentRound', () => {
    const handler = new BrainstormMode();
    const config = { topic: 'test', participants: ['opus', 'codex'] };
    const state = { roundOneComplete: true, currentRound: 2 };
    const next = handler.getNextState(config, state);
    assert.equal(next.roundOneComplete, true);
    assert.equal(next.currentRound, 3);
  });

  it('getNextState: round 5 → increments to 6', () => {
    const handler = new BrainstormMode();
    const config = { topic: 'deep discussion', participants: ['opus'] };
    const state = { roundOneComplete: true, currentRound: 5 };
    const next = handler.getNextState(config, state);
    assert.equal(next.currentRound, 6);
  });

  it('shouldAutoEnd always returns false', () => {
    const handler = new BrainstormMode();
    assert.equal(handler.shouldAutoEnd({}, {}), false);
  });
});

describe('BrainstormMode per-cat prompt (P2-6)', () => {
  it('builds different prompts for each participant', async () => {
    const { buildBrainstormPrompt } = await import('../dist/domains/cats/services/modes/mode-prompts.js');
    const config = { topic: 'AI 安全', participants: ['opus', 'codex'] };
    const state = { roundOneComplete: true, currentRound: 2 };

    const promptOpus = buildBrainstormPrompt(config, state, 'opus');
    const promptCodex = buildBrainstormPrompt(config, state, 'codex');

    // Opus should see Codex as other participant
    assert.ok(promptOpus.includes('缅因猫'), 'opus prompt should list codex as other');
    // Codex should see Opus as other participant
    assert.ok(promptCodex.includes('布偶猫'), 'codex prompt should list opus as other');
    // They should be different
    assert.notEqual(promptOpus, promptCodex, 'prompts should differ per cat');
  });
});

describe('ModeOrchestrator', () => {
  it('dispatches to registered handler and updates state', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });
    const stubHandler = createStubHandler();
    orchestrator.registerHandler('brainstorm', stubHandler);

    modeStore.startMode(
      'thread-1',
      'brainstorm',
      { topic: 'API 设计', participants: ['opus', 'codex'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    const ctx = {
      strategyDeps: {},
      message: '我们来讨论 API 设计',
      userId: 'user-1',
      threadId: 'thread-1',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    assert.equal(messages.length, 1);
    assert.equal(messages[0].content, 'round 1 reply');

    const mode = modeStore.getMode('thread-1');
    assert.equal(mode.state.roundOneComplete, true);
    assert.equal(mode.state.currentRound, 2);

    const handlerCalls = stubHandler.getCalls();
    assert.equal(handlerCalls[0].method, 'execute');
    assert.equal(handlerCalls[1].method, 'getNextState');
  });

  it('advances state across multiple rounds', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });
    const stubHandler = createStubHandler();
    orchestrator.registerHandler('brainstorm', stubHandler);

    modeStore.startMode(
      'thread-2',
      'brainstorm',
      { topic: '测试多轮', participants: ['opus'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    const ctx = {
      strategyDeps: {},
      message: 'round test',
      userId: 'user-1',
      threadId: 'thread-2',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    // Round 1
    for await (const _ of orchestrator.execute(ctx)) { /* consume */ }
    let mode = modeStore.getMode('thread-2');
    assert.equal(mode.state.roundOneComplete, true);
    assert.equal(mode.state.currentRound, 2);

    // Round 2
    for await (const _ of orchestrator.execute(ctx)) { /* consume */ }
    mode = modeStore.getMode('thread-2');
    assert.equal(mode.state.currentRound, 3);

    // Round 3
    for await (const _ of orchestrator.execute(ctx)) { /* consume */ }
    mode = modeStore.getMode('thread-2');
    assert.equal(mode.state.currentRound, 4);
  });

  it('throws when no active mode', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'no-mode-thread',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    await assert.rejects(async () => {
      for await (const _ of orchestrator.execute(ctx)) { /* consume */ }
    }, /No active mode/);
  });

  it('detects cat-initiated mode switch from accumulated text chunks', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    // Real agents: text chunks carry content, done has no content
    const switchHandler = {
      async *execute() {
        yield { type: 'text', catId: 'opus', content: '我觉得我们应该辩论一下\n', timestamp: Date.now() };
        yield { type: 'text', catId: 'opus', content: '@mode:debate', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
      getNextState(_config, state) { return state; },
      shouldAutoEnd() { return false; },
    };
    orchestrator.registerHandler('brainstorm', switchHandler);

    modeStore.startMode(
      'thread-switch',
      'brainstorm',
      { topic: '切换测试', participants: ['opus', 'codex'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'thread-switch',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    // 2 text + done + system_info (mode switch proposal)
    assert.equal(messages.length, 4);
    assert.equal(messages[0].type, 'text');
    assert.equal(messages[1].type, 'text');
    assert.equal(messages[2].type, 'done');
    assert.equal(messages[3].type, 'system_info');
    assert.ok(messages[3].content.includes('debate'));
    assert.ok(messages[3].content.includes('切换'));
  });

  it('does not detect @mode: when text has no pattern', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    // Normal text without @mode: pattern
    const normalHandler = {
      async *execute() {
        yield { type: 'text', catId: 'opus', content: '普通总结没有模式切换', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
      getNextState(_config, state) { return state; },
      shouldAutoEnd() { return false; },
    };
    orchestrator.registerHandler('brainstorm', normalHandler);

    modeStore.startMode(
      'thread-normal',
      'brainstorm',
      { topic: '普通测试', participants: ['opus'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'thread-normal',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    // text + done only, no system_info
    assert.equal(messages.length, 2);
    assert.equal(messages[0].type, 'text');
    assert.equal(messages[1].type, 'done');
  });

  it('detects @mode:dev-loop (hyphenated mode name)', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    const switchHandler = {
      async *execute() {
        yield { type: 'text', catId: 'opus', content: '这个任务适合开发自闭环\n@mode:dev-loop', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
      getNextState(_config, state) { return state; },
      shouldAutoEnd() { return false; },
    };
    orchestrator.registerHandler('brainstorm', switchHandler);

    modeStore.startMode(
      'thread-hyphen',
      'brainstorm',
      { topic: '连字符测试', participants: ['opus'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'thread-hyphen',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    // text + done + system_info (mode switch proposal for dev-loop)
    assert.equal(messages.length, 3);
    const proposal = messages[2];
    assert.equal(proposal.type, 'system_info');
    assert.ok(proposal.content.includes('dev-loop'));
  });

  it('auto-ends debate mode when shouldAutoEnd returns true', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    // Debate with 1 round, start at round 2 (past max → auto-end after state update)
    modeStore.startMode(
      'thread-autoend',
      'debate',
      { topic: 'test', catA: 'opus', catB: 'codex', rounds: 1 },
      'user-1',
      { currentRound: 2, nextSpeaker: 'catA' }, // Past max → execute yields system_info
    );

    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'thread-autoend',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'system_info');

    // Mode should have been ended (P1-2 fix)
    const mode = modeStore.getMode('thread-autoend');
    assert.equal(mode, null, 'Mode should be null after auto-end');

    // History should show the ended record
    const history = modeStore.getModeHistory('thread-autoend');
    assert.ok(history.length > 0);
    assert.ok(history[history.length - 1].endedAt);
  });

  it('P2-4: mode switch proposal respects switchRequiresApproval=false', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    // Set auto-switch enabled
    const origEnv = process.env['MODE_SWITCH_REQUIRES_APPROVAL'];
    process.env['MODE_SWITCH_REQUIRES_APPROVAL'] = 'false';

    const switchHandler = {
      async *execute() {
        yield { type: 'text', catId: 'opus', content: '切换\n@mode:debate', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
      getNextState(_config, state) { return state; },
      shouldAutoEnd() { return false; },
    };
    orchestrator.registerHandler('brainstorm', switchHandler);

    modeStore.startMode(
      'thread-autoswitch',
      'brainstorm',
      { topic: '自动切换测试', participants: ['opus'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'thread-autoswitch',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    // Should emit structured auto-switch proposal instead of human-readable text
    const proposal = messages.find(m => m.type === 'system_info' && m.content.includes('mode_switch_proposal'));
    assert.ok(proposal, 'should emit structured mode_switch_proposal');
    const parsed = JSON.parse(proposal.content);
    assert.equal(parsed.proposedMode, 'debate');
    assert.equal(parsed.autoSwitch, true);

    // Restore env
    if (origEnv === undefined) {
      delete process.env['MODE_SWITCH_REQUIRES_APPROVAL'];
    } else {
      process.env['MODE_SWITCH_REQUIRES_APPROVAL'] = origEnv;
    }
  });

  it('P2-4: mode switch proposal shows human text when switchRequiresApproval=true (default)', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    // Ensure default (true)
    delete process.env['MODE_SWITCH_REQUIRES_APPROVAL'];

    const switchHandler = {
      async *execute() {
        yield { type: 'text', catId: 'opus', content: '切换\n@mode:debate', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
      getNextState(_config, state) { return state; },
      shouldAutoEnd() { return false; },
    };
    orchestrator.registerHandler('brainstorm', switchHandler);

    modeStore.startMode(
      'thread-manualswitch',
      'brainstorm',
      { topic: '手动切换测试', participants: ['opus'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'thread-manualswitch',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    // Should emit human-readable suggestion, NOT structured auto-switch
    const proposal = messages.find(m => m.type === 'system_info');
    assert.ok(proposal);
    assert.ok(proposal.content.includes('切换'), 'should contain human-readable switch instruction');
    assert.ok(!proposal.content.includes('mode_switch_proposal'), 'should NOT be structured auto-switch');
  });

  it('debate handler is auto-registered and can dispatch', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    modeStore.startMode(
      'thread-3',
      'debate',
      { topic: 'test', catA: 'opus', catB: 'codex', rounds: 1 },
      'user-1',
      { currentRound: 2, nextSpeaker: 'catA' },
    );

    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'thread-3',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'system_info');
  });
});
