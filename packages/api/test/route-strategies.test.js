/**
 * Route Strategies Tests
 * 验证 routeSerial / routeParallel 纯函数的基本行为 + A2A worklist
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Create a mock agent service that yields text + done
function createMockService(catId, text = 'hello') {
  return {
    async *invoke(_prompt) {
      yield { type: 'text', catId, content: text, timestamp: Date.now() };
      yield { type: 'done', catId, timestamp: Date.now() };
    },
  };
}

// Mock service that captures the prompt it receives
function createCapturingService(catId, text = 'hello') {
  const calls = [];
  return {
    calls,
    async *invoke(prompt) {
      calls.push(prompt);
      yield { type: 'text', catId, content: text, timestamp: Date.now() };
      yield { type: 'done', catId, timestamp: Date.now() };
    },
  };
}

function createMockDeps(services, appendCalls) {
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
      append: async (msg) => {
        if (appendCalls) appendCalls.push(msg);
        return { id: `msg-${counter}`, userId: '', catId: null, content: '', mentions: [], timestamp: 0 };
      },
      getRecent: () => [],
      getMentionsFor: () => [],
      getBefore: () => [],
      getByThread: () => [],
      getByThreadAfter: () => [],
      getByThreadBefore: () => [],
    },
  };
}

describe('routeSerial', () => {
  it('executes single cat and yields text + done', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({ opus: createMockService('opus', 'serial response') });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'test message', 'user1', 'thread1')) {
      messages.push(msg);
    }

    const textMsgs = messages.filter(m => m.type === 'text');
    const doneMsgs = messages.filter(m => m.type === 'done');
    assert.ok(textMsgs.length > 0, 'should have text messages');
    assert.ok(doneMsgs.length > 0, 'should have done message');
    assert.equal(textMsgs[0].content, 'serial response');
  });
});

describe('routeSerial A2A worklist', () => {
  it('extends worklist when cat response contains line-start @mention', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    // opus responds with a line-start mention of codex
    const deps = createMockDeps({
      opus: createMockService('opus', '我写好了代码\n@缅因猫 请 review 一下'),
      codex: createMockService('codex', 'LGTM, 代码没问题'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'write hello world', 'user1', 'thread1')) {
      messages.push(msg);
    }

    // Should have text from both cats (opus + codex via A2A)
    const opusText = messages.filter(m => m.type === 'text' && m.catId === 'opus');
    const codexText = messages.filter(m => m.type === 'text' && m.catId === 'codex');
    assert.ok(opusText.length > 0, 'opus should produce text');
    assert.ok(codexText.length > 0, 'codex should be invoked via A2A');
  });

  it('yields a2a_handoff event when A2A chain triggers', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({
      opus: createMockService('opus', '请看一下\n@缅因猫 帮忙检查'),
      codex: createMockService('codex', '已检查完毕'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'check code', 'user1', 'thread1')) {
      messages.push(msg);
    }

    const handoffs = messages.filter(m => m.type === 'a2a_handoff');
    assert.equal(handoffs.length, 1, 'should yield exactly one a2a_handoff');
    assert.equal(handoffs[0].catId, 'opus', 'handoff should be from opus');
    assert.ok(handoffs[0].content.includes('→'), 'handoff content should show arrow');
  });

  it('A2A cat receives previousResponses in prompt', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const codexService = createCapturingService('codex', '已审查');
    const deps = createMockDeps({
      opus: createMockService('opus', '代码完成\n@缅因猫 请review'),
      codex: codexService,
    });

    for await (const _ of routeSerial(deps, ['opus'], 'write code', 'user1', 'thread1')) {}

    assert.equal(codexService.calls.length, 1, 'codex should be called once');
    assert.ok(
      codexService.calls[0].includes('代码完成'),
      'codex prompt should include opus response content'
    );
  });

  it('isFinal is true only on the last done in the chain', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({
      opus: createMockService('opus', '好的\n@缅因猫 帮忙'),
      codex: createMockService('codex', '搞定了'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'help', 'user1', 'thread1')) {
      messages.push(msg);
    }

    const doneMsgs = messages.filter(m => m.type === 'done');
    assert.ok(doneMsgs.length >= 2, 'should have done from both cats');
    // First done (opus) should NOT be isFinal
    const opusDone = doneMsgs.find(m => m.catId === 'opus');
    assert.ok(!opusDone.isFinal, 'opus done should not be isFinal');
    // Last done (codex) should be isFinal
    const codexDone = doneMsgs.find(m => m.catId === 'codex');
    assert.ok(codexDone.isFinal, 'codex done (chain end) should be isFinal');
  });

  it('does not extend worklist beyond maxA2ADepth', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    // opus mentions codex, codex mentions gemini, gemini mentions opus
    // With maxA2ADepth=1, only first A2A hop should trigger
    const deps = createMockDeps({
      opus: createMockService('opus', '看看吧\n@缅因猫 帮忙'),
      codex: createMockService('codex', '需要设计\n@暹罗猫 帮忙设计'),
      gemini: createMockService('gemini', '设计好了'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'test', 'user1', 'thread1', { maxA2ADepth: 1 })) {
      messages.push(msg);
    }

    // Only opus + codex should produce text (depth=1 allows 1 hop)
    const catIds = [...new Set(messages.filter(m => m.type === 'text').map(m => m.catId))];
    assert.ok(catIds.includes('opus'), 'opus should have text');
    assert.ok(catIds.includes('codex'), 'codex should be invoked (1st hop)');
    assert.ok(!catIds.includes('gemini'), 'gemini should NOT be invoked (2nd hop blocked by depth=1)');
  });

  it('self-mention does not trigger A2A', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({
      opus: createMockService('opus', '我是布偶猫\n@布偶猫 说完了'),
      codex: createMockService('codex', 'should not be called'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'test', 'user1', 'thread1')) {
      messages.push(msg);
    }

    const handoffs = messages.filter(m => m.type === 'a2a_handoff');
    assert.equal(handoffs.length, 0, 'self-mention should not trigger A2A');
    const codexText = messages.filter(m => m.type === 'text' && m.catId === 'codex');
    assert.equal(codexText.length, 0, 'codex should not be invoked');
  });

  it('non-line-start @mention does not trigger A2A', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({
      opus: createMockService('opus', '之前缅因猫说的 @缅因猫 方案不错，我同意'),
      codex: createMockService('codex', 'should not be called'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'feedback', 'user1', 'thread1')) {
      messages.push(msg);
    }

    const handoffs = messages.filter(m => m.type === 'a2a_handoff');
    assert.equal(handoffs.length, 0, 'mid-line mention should not trigger A2A');
  });

  it('signal abort stops worklist chain', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const ac = new AbortController();
    const deps = createMockDeps({
      opus: {
        async *invoke() {
          yield { type: 'text', catId: 'opus', content: '开始\n@缅因猫 帮忙', timestamp: Date.now() };
          // Abort after opus produces text
          ac.abort();
          yield { type: 'done', catId: 'opus', timestamp: Date.now() };
        },
      },
      codex: createMockService('codex', 'should not run'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'test', 'user1', 'thread1', { signal: ac.signal })) {
      messages.push(msg);
    }

    // Codex should not be invoked because signal was aborted
    const codexText = messages.filter(m => m.type === 'text' && m.catId === 'codex');
    assert.equal(codexText.length, 0, 'codex should not be invoked after abort');
  });

  it('stores mentions correctly in messageStore.append', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const appendCalls = [];
    const deps = createMockDeps({
      opus: createMockService('opus', '写完了\n@缅因猫 帮review'),
      codex: createMockService('codex', '审查完毕'),
    }, appendCalls);

    for await (const _ of routeSerial(deps, ['opus'], 'code', 'user1', 'thread1')) {}

    // opus's stored message should have mentions: ['codex']
    const opusAppend = appendCalls.find(c => c.catId === 'opus');
    assert.ok(opusAppend, 'opus response should be stored');
    assert.deepEqual(opusAppend.mentions, ['codex'], 'opus mentions should include codex');

    // codex's stored message (no mention in response) → mentions: []
    const codexAppend = appendCalls.find(c => c.catId === 'codex');
    assert.ok(codexAppend, 'codex response should be stored');
    assert.deepEqual(codexAppend.mentions, [], 'codex mentions should be empty');
  });

  it('supports 2-hop A2A chain: user→A→B→A', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    let opusCallCount = 0;
    const deps = createMockDeps({
      opus: {
        async *invoke() {
          opusCallCount++;
          if (opusCallCount === 1) {
            yield { type: 'text', catId: 'opus', content: '写好了\n@缅因猫 review', timestamp: Date.now() };
          } else {
            yield { type: 'text', catId: 'opus', content: '已修复', timestamp: Date.now() };
          }
          yield { type: 'done', catId: 'opus', timestamp: Date.now() };
        },
      },
      codex: createMockService('codex', '有bug\n@布偶猫 请修复'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'implement feature', 'user1', 'thread1', { maxA2ADepth: 2 })) {
      messages.push(msg);
    }

    // Chain: opus → codex → opus (2 hops)
    const handoffs = messages.filter(m => m.type === 'a2a_handoff');
    assert.equal(handoffs.length, 2, 'should have 2 A2A handoffs');
    assert.equal(opusCallCount, 2, 'opus should be called twice');
  });

  it('incremental mode: falls back to explicit user message when current message is missing from incremental context', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const captureService = createCapturingService('opus', 'ack');

    const deps = createMockDeps({ opus: captureService });
    deps.deliveryCursorStore = {
      getCursor: async () => undefined,
      ackCursor: async () => {},
    };
    deps.messageStore.getByThreadAfter = async () => [
      {
        id: '0000000000000001-000001-aaaaaaaa',
        threadId: 'thread1',
        userId: 'user1',
        catId: null,
        content: 'older user message',
        mentions: [],
        timestamp: Date.now() - 1000,
      },
    ];

    for await (const _ of routeSerial(
      deps,
      ['opus'],
      'CURRENT USER MESSAGE',
      'user1',
      'thread1',
      { currentUserMessageId: 'missing-current-id' },
    )) {}

    assert.equal(captureService.calls.length, 1, 'opus should be called once');
    const prompt = captureService.calls[0];
    assert.ok(prompt.includes('older user message'), 'prompt should include incremental unseen history');
    assert.ok(prompt.includes('CURRENT USER MESSAGE'), 'prompt must include current user message explicitly when missing from unseen history');
  });

  it('sanitize should preserve normal markdown separator lines', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const appendCalls = [];
    const deps = createMockDeps({
      opus: createMockService('opus', '章节A\n---\n章节B'),
    }, appendCalls);

    for await (const _ of routeSerial(deps, ['opus'], 'markdown test', 'user1', 'thread1')) {}

    const saved = appendCalls.find((c) => c.catId === 'opus');
    assert.ok(saved, 'stored message should exist');
    assert.equal(saved.content, '章节A\n---\n章节B', 'sanitizer must not remove normal markdown separator lines');
  });
});

describe('routeSerial resilience', () => {
  it('yields done even when messageStore.append throws (Redis failure)', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');

    // Create deps with a failing messageStore
    let counter = 0;
    const deps = {
      services: { opus: createMockService('opus', '结果在这里') },
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
        append: async () => { throw new Error('Redis connection refused'); },
        getRecent: () => [],
        getMentionsFor: () => [],
        getBefore: () => [],
        getByThread: () => [],
        getByThreadAfter: () => [],
        getByThreadBefore: () => [],
      },
    };

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'test', 'user1', 'thread1')) {
      messages.push(msg);
    }

    // done MUST still be yielded despite append failure
    const doneMsgs = messages.filter(m => m.type === 'done');
    assert.ok(doneMsgs.length > 0, 'done must be yielded even when append throws');
    assert.ok(doneMsgs[0].isFinal, 'done should be isFinal');
  });
});

describe('routeParallel resilience', () => {
  it('yields done even when messageStore.append throws (Redis failure)', async () => {
    const { routeParallel } = await import('../dist/domains/cats/services/route-strategies.js');

    const deps = createMockDeps({
      opus: createMockService('opus', 'opus says'),
      codex: createMockService('codex', 'codex says'),
    });
    // Force append failure (simulates Redis outage)
    deps.messageStore.append = async () => { throw new Error('Redis connection refused'); };

    const messages = [];
    for await (const msg of routeParallel(deps, ['opus', 'codex'], 'test', 'user1', 'thread1')) {
      messages.push(msg);
    }

    const doneMsgs = messages.filter(m => m.type === 'done');
    assert.equal(doneMsgs.length, 2, 'should still yield done for both cats');
    assert.ok(doneMsgs.some(m => m.isFinal), 'one done should be isFinal');
  });
});

describe('routeSerial persistence context (P1-2)', () => {
  it('sets persistenceContext.failed when messageStore.append throws', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');

    const deps = createMockDeps({ opus: createMockService('opus', '结果') });
    deps.messageStore.append = async () => { throw new Error('Redis connection refused'); };

    const persistenceContext = { failed: false, errors: [] };
    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'test', 'user1', 'thread1', { persistenceContext })) {
      messages.push(msg);
    }

    assert.ok(persistenceContext.failed, 'persistenceContext.failed should be true');
    assert.ok(persistenceContext.errors.length > 0, 'should record error details');
    assert.equal(persistenceContext.errors[0].catId, 'opus');
    assert.ok(persistenceContext.errors[0].error.includes('Redis'), 'error should contain original message');

    // done MUST still be yielded despite append failure
    const doneMsgs = messages.filter(m => m.type === 'done');
    assert.ok(doneMsgs.length > 0, 'done must still be yielded');
  });

  it('does not set persistenceContext.failed on successful append', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({ opus: createMockService('opus', 'success') });

    const persistenceContext = { failed: false, errors: [] };
    for await (const _msg of routeSerial(deps, ['opus'], 'test', 'user1', 'thread1', { persistenceContext })) {
      // consume
    }

    assert.equal(persistenceContext.failed, false);
    assert.equal(persistenceContext.errors.length, 0);
  });
});

describe('routeParallel persistence context (P1-2)', () => {
  it('sets persistenceContext.failed when messageStore.append throws', async () => {
    const { routeParallel } = await import('../dist/domains/cats/services/route-strategies.js');

    const deps = createMockDeps({
      opus: createMockService('opus', 'opus says'),
      codex: createMockService('codex', 'codex says'),
    });
    deps.messageStore.append = async () => { throw new Error('Redis connection refused'); };

    const persistenceContext = { failed: false, errors: [] };
    const messages = [];
    for await (const msg of routeParallel(deps, ['opus', 'codex'], 'test', 'user1', 'thread1', { persistenceContext })) {
      messages.push(msg);
    }

    assert.ok(persistenceContext.failed, 'persistenceContext.failed should be true');
    assert.ok(persistenceContext.errors.length >= 2, 'should record errors for both cats');

    // done MUST still be yielded for both
    const doneMsgs = messages.filter(m => m.type === 'done');
    assert.equal(doneMsgs.length, 2);
  });

  it('does not set persistenceContext.failed on successful append', async () => {
    const { routeParallel } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({
      opus: createMockService('opus', 'opus says'),
      codex: createMockService('codex', 'codex says'),
    });

    const persistenceContext = { failed: false, errors: [] };
    for await (const _msg of routeParallel(deps, ['opus', 'codex'], 'test', 'user1', 'thread1', { persistenceContext })) {
      // consume
    }

    assert.equal(persistenceContext.failed, false);
    assert.equal(persistenceContext.errors.length, 0);
  });
});

describe('routeSerial per-cat budget', () => {
  it('uses history for context assembly when provided', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const captureService = createCapturingService('opus', 'response');
    const deps = createMockDeps({ opus: captureService });

    // Provide history in options
    const history = [
      { id: 'm1', threadId: 'thread1', userId: 'user1', catId: null, content: '之前说了什么', mentions: [], timestamp: Date.now() - 1000 },
      { id: 'm2', threadId: 'thread1', userId: 'user1', catId: 'opus', content: '我回复了', mentions: [], timestamp: Date.now() - 500 },
    ];

    for await (const _ of routeSerial(deps, ['opus'], 'new message', 'user1', 'thread1', { history })) {}

    // Check that prompt includes context from history
    assert.equal(captureService.calls.length, 1, 'opus should be called once');
    const prompt = captureService.calls[0];
    assert.ok(prompt.includes('对话历史'), 'prompt should include history header');
    assert.ok(prompt.includes('之前说了什么'), 'prompt should include history content');
  });

  it('falls back to legacy contextHistory when provided', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const captureService = createCapturingService('opus', 'response');
    const deps = createMockDeps({ opus: captureService });

    for await (const _ of routeSerial(deps, ['opus'], 'msg', 'user1', 'thread1', { contextHistory: '[对话历史] 测试上下文' })) {}

    const prompt = captureService.calls[0];
    assert.ok(prompt.includes('[对话历史] 测试上下文'), 'prompt should include legacy contextHistory');
  });
});

describe('routeParallel per-cat budget', () => {
  it('uses history for context assembly when provided', async () => {
    const { routeParallel } = await import('../dist/domains/cats/services/route-strategies.js');
    const opusService = createCapturingService('opus', 'opus says');
    const codexService = createCapturingService('codex', 'codex says');
    const deps = createMockDeps({ opus: opusService, codex: codexService });

    const history = [
      { id: 'm1', threadId: 'thread1', userId: 'user1', catId: null, content: '历史消息', mentions: [], timestamp: Date.now() - 1000 },
    ];

    for await (const _ of routeParallel(deps, ['opus', 'codex'], 'test', 'user1', 'thread1', { history })) {}

    // Both cats should receive history in their prompts
    assert.ok(opusService.calls[0].includes('对话历史'), 'opus prompt should include history');
    assert.ok(codexService.calls[0].includes('历史消息'), 'codex prompt should include history content');
  });
});

describe('routeSerial degradation notification', () => {
  it('yields system_info when history exceeds budget maxMessages', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({ opus: createMockService('opus', 'response') });

    // Generate 250 messages to exceed opus default maxMessages=200
    const history = Array.from({ length: 250 }, (_, i) => ({
      id: `m${i}`,
      threadId: 'thread1',
      userId: 'user1',
      catId: i % 2 === 0 ? null : 'opus',
      content: `message ${i}`,
      mentions: [],
      timestamp: Date.now() - (250 - i) * 1000,
    }));

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'test', 'user1', 'thread1', { history })) {
      messages.push(msg);
    }

    const sysInfos = messages.filter(m => m.type === 'system_info');
    assert.ok(sysInfos.length > 0, 'should yield degradation system_info');
    assert.ok(sysInfos[0].content.includes('截断'), 'degradation message should mention truncation');
  });

  it('does not yield system_info when history is within budget', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({ opus: createMockService('opus', 'response') });

    // 5 messages — well within opus maxMessages=200
    const history = Array.from({ length: 5 }, (_, i) => ({
      id: `m${i}`,
      threadId: 'thread1',
      userId: 'user1',
      catId: null,
      content: `message ${i}`,
      mentions: [],
      timestamp: Date.now() - (5 - i) * 1000,
    }));

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'test', 'user1', 'thread1', { history })) {
      messages.push(msg);
    }

    const sysInfos = messages.filter(m => m.type === 'system_info' && !m.content?.includes('invocation_metrics'));
    assert.equal(sysInfos.length, 0, 'should not yield degradation when within budget');
  });

  it('yields system_info when context is truncated by character budget (not count)', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({ opus: createMockService('opus', 'response') });

    // Count is within budget boundary (opus maxMessages=200), but content size should force char truncation.
    // 200 messages × ~1600 chars = ~320k > maxContextChars 300k
    const history = Array.from({ length: 200 }, (_, i) => ({
      id: `m${i}`,
      threadId: 'thread1',
      userId: 'user1',
      catId: null,
      content: `message ${i} ` + 'x'.repeat(1600),
      mentions: [],
      timestamp: Date.now() - (200 - i) * 1000,
    }));

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'test', 'user1', 'thread1', { history })) {
      messages.push(msg);
    }

    const sysInfos = messages.filter(m => m.type === 'system_info');
    assert.ok(sysInfos.length > 0, 'should yield degradation when char budget truncates context');
    assert.ok(sysInfos[0].content.includes('截断'), 'degradation message should mention truncation');
  });
});

describe('routeParallel degradation notification', () => {
  it('yields system_info for each degraded cat', async () => {
    const { routeParallel } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({
      opus: createMockService('opus', 'opus says'),
      codex: createMockService('codex', 'codex says'),
    });

    // 250 messages — exceeds both opus (200) and codex (200) limits
    const history = Array.from({ length: 250 }, (_, i) => ({
      id: `m${i}`,
      threadId: 'thread1',
      userId: 'user1',
      catId: null,
      content: `message ${i}`,
      mentions: [],
      timestamp: Date.now() - (250 - i) * 1000,
    }));

    const messages = [];
    for await (const msg of routeParallel(deps, ['opus', 'codex'], 'test', 'user1', 'thread1', { history })) {
      messages.push(msg);
    }

    const sysInfos = messages.filter(m => m.type === 'system_info');
    assert.ok(sysInfos.length >= 2, 'should yield degradation for both cats');
  });

  it('yields system_info when context is truncated by character budget in parallel mode', async () => {
    const { routeParallel } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({
      opus: createMockService('opus', 'opus says'),
      codex: createMockService('codex', 'codex says'),
    });

    // Count is within both cats' maxMessages (codex=200, opus=200), but content size should trigger char truncation.
    // 200 messages × ~2100 chars = ~420k > codex maxContextChars 400k
    const history = Array.from({ length: 200 }, (_, i) => ({
      id: `m${i}`,
      threadId: 'thread1',
      userId: 'user1',
      catId: null,
      content: `message ${i} ` + 'y'.repeat(2100),
      mentions: [],
      timestamp: Date.now() - (200 - i) * 1000,
    }));

    const messages = [];
    for await (const msg of routeParallel(deps, ['opus', 'codex'], 'test', 'user1', 'thread1', { history })) {
      messages.push(msg);
    }

    const sysInfos = messages.filter(m => m.type === 'system_info');
    assert.ok(sysInfos.length > 0, 'should yield at least one degradation system_info');
  });
});

describe('routeParallel A2A safety', () => {
  it('does not chain A2A even when mentions are detected', async () => {
    const { routeParallel } = await import('../dist/domains/cats/services/route-strategies.js');
    const appendCalls = [];
    const deps = createMockDeps({
      opus: createMockService('opus', '需要缅因猫帮忙\n@缅因猫 请看'),
      codex: createMockService('codex', '我来了'),
    }, appendCalls);

    const messages = [];
    for await (const msg of routeParallel(deps, ['opus', 'codex'], 'brainstorm', 'user1', 'thread1')) {
      messages.push(msg);
    }

    // Should not yield any a2a_handoff events
    const handoffs = messages.filter(m => m.type === 'a2a_handoff');
    assert.equal(handoffs.length, 0, 'parallel mode should never chain A2A');

    // But mentions should still be stored
    const opusAppend = appendCalls.find(c => c.catId === 'opus');
    assert.ok(opusAppend, 'opus response should be stored');
    assert.deepEqual(opusAppend.mentions, ['codex'], 'mentions should be detected and stored');
  });

  it('executes multiple cats independently and yields interleaved messages', async () => {
    const { routeParallel } = await import('../dist/domains/cats/services/route-strategies.js');
    const deps = createMockDeps({
      opus: createMockService('opus', 'opus says'),
      codex: createMockService('codex', 'codex says'),
    });

    const messages = [];
    for await (const msg of routeParallel(deps, ['opus', 'codex'], 'test', 'user1', 'thread1')) {
      messages.push(msg);
    }

    const doneMsgs = messages.filter(m => m.type === 'done');
    assert.equal(doneMsgs.length, 2, 'should have 2 done messages (one per cat)');

    // Last done should be marked isFinal
    const finalDone = doneMsgs.find(m => m.isFinal === true);
    assert.ok(finalDone, 'last done should be marked isFinal');

    // Both cats should have text
    const opusText = messages.filter(m => m.type === 'text' && m.catId === 'opus');
    const codexText = messages.filter(m => m.type === 'text' && m.catId === 'codex');
    assert.ok(opusText.length > 0, 'opus should have text');
    assert.ok(codexText.length > 0, 'codex should have text');
  });
});

// ── P1 Bug: CLI error + empty message persistence ──

/** Mock service that yields only error + done (simulates CLI exit code 1 with no text) */
function createErrorOnlyService(catId) {
  return {
    async *invoke() {
      yield { type: 'error', catId, error: 'CLI 异常退出 (code: 1, signal: none)', timestamp: Date.now() };
      yield { type: 'done', catId, timestamp: Date.now() };
    },
  };
}

describe('routeSerial: CLI error without text should not persist empty message (P1)', () => {
  it('does NOT call messageStore.append when cat yields error + done with no text', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const appendCalls = [];
    const deps = createMockDeps({
      codex: createErrorOnlyService('codex'),
    }, appendCalls);

    const messages = [];
    for await (const msg of routeSerial(deps, ['codex'], 'test', 'user1', 'thread1')) {
      messages.push(msg);
    }

    // Error should be yielded to frontend
    const errorMsgs = messages.filter(m => m.type === 'error');
    assert.ok(errorMsgs.length > 0, 'error message should be yielded to frontend');

    // Empty assistant message should NOT be persisted
    const catAppends = appendCalls.filter(c => c.catId === 'codex');
    assert.equal(catAppends.length, 0, 'should NOT persist empty assistant message when hadError && no text');

    // Done should still be yielded
    const doneMsgs = messages.filter(m => m.type === 'done');
    assert.ok(doneMsgs.length > 0, 'done should still be yielded');
  });

  it('still persists message normally when cat yields text + done (no error)', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const appendCalls = [];
    const deps = createMockDeps({
      codex: createMockService('codex', 'normal response'),
    }, appendCalls);

    for await (const _ of routeSerial(deps, ['codex'], 'test', 'user1', 'thread1')) {}

    const catAppends = appendCalls.filter(c => c.catId === 'codex');
    assert.equal(catAppends.length, 1, 'normal response should be persisted');
    assert.equal(catAppends[0].content, 'normal response');
  });

  it('still persists message when cat yields error + text + done (partial response)', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/route-strategies.js');
    const appendCalls = [];
    const deps = createMockDeps({
      codex: {
        async *invoke() {
          yield { type: 'text', catId: 'codex', content: 'partial output before error', timestamp: Date.now() };
          yield { type: 'error', catId: 'codex', error: 'timeout', timestamp: Date.now() };
          yield { type: 'done', catId: 'codex', timestamp: Date.now() };
        },
      },
    }, appendCalls);

    for await (const _ of routeSerial(deps, ['codex'], 'test', 'user1', 'thread1')) {}

    // Partial text should still be persisted (there was actual content)
    const catAppends = appendCalls.filter(c => c.catId === 'codex');
    assert.equal(catAppends.length, 1, 'partial response with text should still be persisted');
    assert.equal(catAppends[0].content, 'partial output before error');
  });
});
