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

// ── Mock deps for routeSerial-based tests ──

function createMockDeps(services) {
  let counter = 0;
  return {
    services,
    invocationDeps: {
      registry: {
        create: () => ({ invocationId: `inv-${++counter}`, callbackToken: `tok-${counter}` }),
        verify: () => null,
      },
      sessionManager: {
        getOrCreate: async () => ({}),
        resolveWorkingDirectory: () => '/tmp/test',
      },
      threadStore: null,
      apiUrl: 'http://127.0.0.1:3002',
    },
    messageStore: {
      append: async () => ({ id: `msg-${counter}`, userId: '', catId: null, content: '', mentions: [], timestamp: 0 }),
    },
  };
}

describe('BrainstormMode @铲屎官 mid-chain break (P2-7)', () => {
  it('stops serial chain when a cat mentions @铲屎官', async () => {
    const { BrainstormMode } = await import('../dist/domains/cats/services/modes/BrainstormMode.js');
    const handler = new BrainstormMode();

    const invokedCats = [];
    function createTrackingService(catId, text) {
      return {
        async *invoke() {
          invokedCats.push(catId);
          yield { type: 'text', catId, content: text, timestamp: Date.now() };
          yield { type: 'done', catId, timestamp: Date.now() };
        },
      };
    }

    const deps = createMockDeps({
      opus: createTrackingService('opus', '我觉得需要铲屎官的意见。@铲屎官 你怎么看？'),
      codex: createTrackingService('codex', '我同意 opus 的观点'),
    });

    const config = { topic: '暂停测试', participants: ['opus', 'codex'] };
    const state = { roundOneComplete: true, currentRound: 2 };

    const ctx = {
      strategyDeps: deps,
      message: '继续讨论',
      userId: 'user-1',
      threadId: 'thread-pause-test',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of handler.execute(ctx, config, state)) {
      messages.push(msg);
    }

    // Cat A (opus) was invoked
    assert.ok(invokedCats.includes('opus'), 'opus should have been invoked');
    // Cat B (codex) was NOT invoked — mid-chain break
    assert.ok(!invokedCats.includes('codex'), 'codex should NOT execute after @铲屎官 break');

    // Opus was invoked, codex was not (mid-chain break)
    const opusText = messages.filter(m => m.type === 'text' && m.catId === 'opus');
    const codexText = messages.filter(m => m.type === 'text' && m.catId === 'codex');
    assert.ok(opusText.length > 0, 'opus text present');
    assert.equal(codexText.length, 0, 'codex text absent — mid-chain break');

    // Pause notification exists with expected content
    const pauseMsg = messages.find(m => m.type === 'system_info' && m.content?.includes('铲屎官'));
    assert.ok(pauseMsg, 'should have pause notification mentioning 铲屎官');
  });

  it('getNextState preserves round + remainingSpeakers after @铲屎官 break', async () => {
    const { BrainstormMode } = await import('../dist/domains/cats/services/modes/BrainstormMode.js');
    const handler = new BrainstormMode();

    const invokedCats = [];
    function createTrackingService(catId, text) {
      return {
        async *invoke() {
          invokedCats.push(catId);
          yield { type: 'text', catId, content: text, timestamp: Date.now() };
          yield { type: 'done', catId, timestamp: Date.now() };
        },
      };
    }

    const deps = createMockDeps({
      opus: createTrackingService('opus', '@铲屎官 请决定方向'),
      codex: createTrackingService('codex', '等铲屎官'),
      gemini: createTrackingService('gemini', '我也等'),
    });

    const config = { topic: '三猫暂停', participants: ['opus', 'codex', 'gemini'] };
    const state = { roundOneComplete: true, currentRound: 2 };
    const threadId = 'thread-round-preserve';

    const ctx = {
      strategyDeps: deps,
      message: '讨论',
      userId: 'user-1',
      threadId,
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    // Execute — opus @铲屎官 → break
    for await (const _msg of handler.execute(ctx, config, state)) { /* consume */ }

    assert.ok(invokedCats.includes('opus'), 'opus invoked');
    assert.ok(!invokedCats.includes('codex'), 'codex NOT invoked');
    assert.ok(!invokedCats.includes('gemini'), 'gemini NOT invoked');

    // getNextState should preserve round 2 with remaining speakers
    const nextState = handler.getNextState(config, state, threadId);
    assert.equal(nextState.currentRound, 2, 'round stays at 2 (not incremented)');
    assert.equal(nextState.pausedForUser, true, 'marked as paused');
    assert.deepEqual(nextState.remainingSpeakers, ['codex', 'gemini'], 'remaining speakers');

    // --- Resume: user responds, execute with paused state ---
    invokedCats.length = 0; // reset
    const ctx2 = { ...ctx, message: '铲屎官说选方案 B', threadId };

    for await (const _msg of handler.execute(ctx2, config, nextState)) { /* consume */ }

    // Now codex + gemini should be invoked, opus should NOT
    assert.ok(!invokedCats.includes('opus'), 'opus NOT re-invoked on resume');
    assert.ok(invokedCats.includes('codex'), 'codex invoked on resume');
    assert.ok(invokedCats.includes('gemini'), 'gemini invoked on resume');

    // After resume completes normally, getNextState should advance to round 3
    const finalState = handler.getNextState(config, nextState, threadId);
    assert.equal(finalState.currentRound, 3, 'advances to round 3 after resume');
    assert.equal(finalState.pausedForUser, undefined, 'pause cleared');
    assert.equal(finalState.remainingSpeakers, undefined, 'remaining cleared');
  });

  it('continues serial chain when no cat mentions @铲屎官', async () => {
    const { BrainstormMode } = await import('../dist/domains/cats/services/modes/BrainstormMode.js');
    const handler = new BrainstormMode();

    const invokedCats = [];
    function createTrackingService(catId, text) {
      return {
        async *invoke() {
          invokedCats.push(catId);
          yield { type: 'text', catId, content: text, timestamp: Date.now() };
          yield { type: 'done', catId, timestamp: Date.now() };
        },
      };
    }

    const deps = createMockDeps({
      opus: createTrackingService('opus', '我觉得方案 A 更好'),
      codex: createTrackingService('codex', '我同意，方案 A 没问题'),
    });

    const config = { topic: '正常讨论', participants: ['opus', 'codex'] };
    const state = { roundOneComplete: true, currentRound: 2 };

    const ctx = {
      strategyDeps: deps,
      message: '继续讨论',
      userId: 'user-1',
      threadId: 'thread-normal-test',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of handler.execute(ctx, config, state)) {
      messages.push(msg);
    }

    // Both cats were invoked (no break)
    assert.ok(invokedCats.includes('opus'), 'opus should have been invoked');
    assert.ok(invokedCats.includes('codex'), 'codex should have been invoked');

    // No @铲屎官 pause notification (pipeline may emit other system_info)
    const pauseMsg = messages.find(m => m.type === 'system_info' && m.content?.includes('铲屎官'));
    assert.equal(pauseMsg, undefined, 'no @铲屎官 pause notification');
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

    // 2 text + done + system_info (structured mode_switch_proposal)
    assert.equal(messages.length, 4);
    assert.equal(messages[0].type, 'text');
    assert.equal(messages[1].type, 'text');
    assert.equal(messages[2].type, 'done');
    assert.equal(messages[3].type, 'system_info');
    const parsed = JSON.parse(messages[3].content);
    assert.equal(parsed.type, 'mode_switch_proposal');
    assert.equal(parsed.proposedMode, 'debate');
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

  it('P2-4: auto-switch actually switches mode when switchRequiresApproval=false and config derivable', async () => {
    const modeStore = new ModeStore();
    // Track socket broadcasts
    const broadcasts = [];
    const mockSocket = {
      broadcastToRoom: (room, event, data) => broadcasts.push({ room, event, data }),
    };
    const orchestrator = new ModeOrchestrator({ modeStore, socketManager: mockSocket });

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
      { topic: '自动切换测试', participants: ['opus', 'codex'] },
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

    // Should emit "已自动切换" confirmation
    const switchMsg = messages.find(m => m.type === 'system_info' && m.content.includes('已自动切换'));
    assert.ok(switchMsg, 'should confirm auto-switch');
    assert.ok(switchMsg.content.includes('debate'), 'should mention debate mode');

    // Mode should now be debate (not brainstorm, not null)
    const mode = modeStore.getMode('thread-autoswitch');
    assert.ok(mode, 'mode should exist after auto-switch');
    assert.equal(mode.record.name, 'debate', 'should be debate mode now');
    assert.equal(mode.record.config.topic, '自动切换测试', 'topic preserved');
    assert.equal(mode.record.config.catA, 'opus', 'catA derived from participants[0]');
    assert.equal(mode.record.config.catB, 'codex', 'catB derived from participants[1]');

    // Previous brainstorm should be in history
    const history = modeStore.getModeHistory('thread-autoswitch');
    assert.ok(history.some(r => r.name === 'brainstorm' && r.endedAt), 'brainstorm ended in history');

    // P2-3: broadcast uses action:'started' with full mode object (frontend contract)
    const startedBroadcast = broadcasts.find(b => b.event === 'mode_changed' && b.data.action === 'started');
    assert.ok(startedBroadcast, 'should broadcast action:started');
    assert.ok(startedBroadcast.data.mode, 'should include full mode object');
    assert.equal(startedBroadcast.data.mode.record.name, 'debate', 'broadcast mode is debate');

    if (origEnv === undefined) {
      delete process.env['MODE_SWITCH_REQUIRES_APPROVAL'];
    } else {
      process.env['MODE_SWITCH_REQUIRES_APPROVAL'] = origEnv;
    }
  });

  it('P2-4: auto-switch falls back to suggestion when config not derivable', async () => {
    const modeStore = new ModeStore();
    const orchestrator = new ModeOrchestrator({ modeStore });

    const origEnv = process.env['MODE_SWITCH_REQUIRES_APPROVAL'];
    process.env['MODE_SWITCH_REQUIRES_APPROVAL'] = 'false';

    // brainstorm → dev-loop: can't auto-derive (needs requirement)
    const switchHandler = {
      async *execute() {
        yield { type: 'text', catId: 'opus', content: '适合开发自闭环\n@mode:dev-loop', timestamp: Date.now() };
        yield { type: 'done', catId: 'opus', timestamp: Date.now() };
      },
      getNextState(_config, state) { return state; },
      shouldAutoEnd() { return false; },
    };
    orchestrator.registerHandler('brainstorm', switchHandler);

    modeStore.startMode(
      'thread-noauto',
      'brainstorm',
      { topic: '无法自动切换', participants: ['opus', 'codex'] },
      'user-1',
      createInitialState('brainstorm'),
    );

    const ctx = {
      strategyDeps: {},
      message: 'test',
      userId: 'user-1',
      threadId: 'thread-noauto',
      userMessageId: 'msg-1',
      routeOptions: {},
    };

    const messages = [];
    for await (const msg of orchestrator.execute(ctx)) {
      messages.push(msg);
    }

    // Should emit fallback suggestion (not auto-switch)
    const fallback = messages.find(m => m.type === 'system_info' && m.content.includes('无法自动推导'));
    assert.ok(fallback, 'should emit fallback suggestion');
    assert.ok(fallback.content.includes('dev-loop'), 'mentions dev-loop');
    assert.ok(fallback.content.includes('/mode'), 'suggests manual switch');

    // Mode should still be brainstorm (not switched)
    const mode = modeStore.getMode('thread-noauto');
    assert.ok(mode, 'mode should still exist');
    assert.equal(mode.record.name, 'brainstorm', 'still brainstorm — no auto-switch');

    if (origEnv === undefined) {
      delete process.env['MODE_SWITCH_REQUIRES_APPROVAL'];
    } else {
      process.env['MODE_SWITCH_REQUIRES_APPROVAL'] = origEnv;
    }
  });

  it('P2-4: switchRequiresApproval=true emits structured mode_switch_proposal', async () => {
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

    // Should emit structured proposal with autoSwitch: false
    const proposal = messages.find(m => m.type === 'system_info');
    assert.ok(proposal);
    const parsed = JSON.parse(proposal.content);
    assert.equal(parsed.type, 'mode_switch_proposal', 'structured proposal type');
    assert.equal(parsed.proposedMode, 'debate', 'proposed mode is debate');
    assert.equal(parsed.autoSwitch, false, 'autoSwitch is false (needs confirmation)');
    assert.equal(parsed.command, '/mode debate', 'includes command hint');

    // Mode should NOT have switched (still brainstorm)
    const mode = modeStore.getMode('thread-manualswitch');
    assert.ok(mode, 'mode still active');
    assert.equal(mode.record.name, 'brainstorm', 'still brainstorm — requires user confirmation');
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
