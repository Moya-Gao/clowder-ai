import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { catRegistry } from '@cat-cafe/shared';

function createMockService(catId, text = 'hello') {
  return {
    async *invoke(_prompt) {
      yield { type: 'text', catId, content: text, timestamp: Date.now() };
      yield { type: 'done', catId, timestamp: Date.now() };
    },
  };
}

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

function createSequentialCapturingService(catId, responses) {
  const calls = [];
  let index = 0;
  return {
    calls,
    async *invoke(prompt) {
      calls.push(prompt);
      const text = responses[index] ?? responses[responses.length - 1] ?? 'ok';
      index += 1;
      yield { type: 'text', catId, content: text, timestamp: Date.now() };
      yield { type: 'done', catId, timestamp: Date.now() };
    },
  };
}

function createMockDeps(services, threadStore = null) {
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
      threadStore,
      apiUrl: 'http://127.0.0.1:3002',
    },
    messageStore: {
      append: async () => ({
        id: `msg-${counter}`,
        userId: '',
        catId: null,
        content: '',
        mentions: [],
        timestamp: 0,
      }),
      getRecent: () => [],
      getMentionsFor: () => [],
      getBefore: () => [],
      getByThread: () => [],
      getByThreadAfter: () => [],
      getByThreadBefore: () => [],
    },
  };
}

describe('F046 B5 runtime regression scenarios', () => {
  it('debug mode: downstream cat can see upstream response text', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const codexService = createCapturingService('codex', '已审查');
    const deps = createMockDeps({
      opus: createMockService('opus', '代码完成\n@缅因猫 请review'),
      codex: codexService,
    });

    for await (const _ of routeSerial(deps, ['opus'], 'write code', 'user1', 'thread1', { thinkingMode: 'debug' })) {}

    assert.equal(codexService.calls.length, 1, 'codex should be called once');
    assert.ok(codexService.calls[0].includes('代码完成'), 'debug mode should include upstream response text');
  });

  it('play mode: downstream cat cannot see upstream response text', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const codexService = createCapturingService('codex', '已审查');
    const deps = createMockDeps({
      opus: createMockService('opus', '代码完成\n@缅因猫 请review'),
      codex: codexService,
    });

    for await (const _ of routeSerial(deps, ['opus'], 'write code', 'user1', 'thread1', { thinkingMode: 'play' })) {}

    assert.equal(codexService.calls.length, 1, 'codex should be called once');
    assert.ok(!codexService.calls[0].includes('代码完成'), 'play mode should isolate upstream response text');
  });

  it('same-family review chain no longer injects invalid identity marker in debug mode', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const { loadCatConfig, toAllCatConfigs } = await import('../dist/config/cat-config-loader.js');

    const originalConfigs = catRegistry.getAllConfigs();
    catRegistry.reset();
    try {
      const runtimeConfigs = toAllCatConfigs(loadCatConfig());
      for (const [id, config] of Object.entries(runtimeConfigs)) {
        catRegistry.register(id, config);
      }

      const opusService = createCapturingService('opus', '收到，继续处理');
      const deps = createMockDeps({
        codex: createMockService('codex', '代码完成\n@gpt52 请 review'),
        gpt52: createMockService('gpt52', '我看过了，先给结论\n@opus 请继续'),
        opus: opusService,
      });

      for await (const _ of routeSerial(
        deps,
        ['codex'],
        'debug review chain',
        'user1',
        'thread1',
        { thinkingMode: 'debug' },
      )) {}

      assert.equal(opusService.calls.length, 1, 'downstream opus should be called once');
      assert.ok(
        opusService.calls[0].includes('我看过了，先给结论'),
        'downstream prompt should still include upstream review text in debug mode',
      );
      assert.ok(
        !opusService.calls[0].includes('⚠️ Review 无效：同族 reviewer identity check 未通过'),
        'downstream prompt should not contain deprecated identity invalid marker',
      );
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(originalConfigs)) {
        catRegistry.register(id, config);
      }
    }
  });

  it('D1 no-action mention: should not route', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const deps = createMockDeps({
      opus: createMockService('opus', '@缅因猫 收到，我在等'),
      codex: createMockService('codex', 'should not run'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'status', 'user1', 'thread1', { thinkingMode: 'debug' })) {
      messages.push(msg);
    }

    const handoffs = messages.filter((m) => m.type === 'a2a_handoff');
    const codexText = messages.filter((m) => m.type === 'text' && m.catId === 'codex');
    assert.equal(handoffs.length, 0, 'no-action mention should not trigger handoff');
    assert.equal(codexText.length, 0, 'no-action mention should not invoke codex');
  });

  it('D1 actionable mention in same paragraph: should route', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const deps = createMockDeps({
      opus: createMockService('opus', '@缅因猫 请 review 这个改动'),
      codex: createMockService('codex', '收到，开始 review'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'review request', 'user1', 'thread1', { thinkingMode: 'debug' })) {
      messages.push(msg);
    }

    const handoffs = messages.filter((m) => m.type === 'a2a_handoff');
    const codexText = messages.filter((m) => m.type === 'text' && m.catId === 'codex');
    assert.equal(handoffs.length, 1, 'actionable mention should trigger handoff');
    assert.ok(codexText.length > 0, 'actionable mention should invoke codex');
  });

  it('D1 CJK actionable mention: should route', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const deps = createMockDeps({
      opus: createMockService('opus', '@缅因猫 请确认这个变更'),
      codex: createMockService('codex', '已确认'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'confirm', 'user1', 'thread1', { thinkingMode: 'debug' })) {
      messages.push(msg);
    }

    const codexText = messages.filter((m) => m.type === 'text' && m.catId === 'codex');
    assert.ok(codexText.length > 0, 'CJK actionable mention should invoke codex');
  });

  it('D1 token-boundary: "prefix" should not match action token "fix"', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const deps = createMockDeps({
      opus: createMockService('opus', '@缅因猫 prefix issue'),
      codex: createMockService('codex', 'should not run'),
    });

    const messages = [];
    for await (const msg of routeSerial(deps, ['opus'], 'boundary', 'user1', 'thread1', { thinkingMode: 'debug' })) {
      messages.push(msg);
    }

    const codexText = messages.filter((m) => m.type === 'text' && m.catId === 'codex');
    assert.equal(codexText.length, 0, 'substring token should not trigger routing');
  });

  it('D2 metadata is handle-free in invocation context', async () => {
    const { buildInvocationContext } = await import('../dist/domains/cats/services/context/SystemPromptBuilder.js');
    const ctx = buildInvocationContext({
      catId: 'codex',
      mode: 'serial',
      chainIndex: 1,
      chainTotal: 2,
      teammates: ['opus'],
      mcpAvailable: false,
      directMessageFrom: 'opus',
      activeParticipants: [{ catId: 'opus', lastMessageAt: 1710000000000, messageCount: 3 }],
    });

    assert.match(ctx, /^Direct message from 布偶猫\(opus\)/m);
    assert.match(ctx, /最近活跃：布偶猫\(opus\)/);
    assert.ok(!ctx.includes('Direct message from @opus'), 'metadata should not use @handle');
    assert.ok(!ctx.includes('最近活跃：@opus'), 'activity should not use @handle');
  });

  it('D3 one-shot feedback: injects no_action suppression once and then clears', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    const threadStore = new ThreadStore();
    const thread = threadStore.create('user1', 'D3 no_action');
    const codexService = createSequentialCapturingService('codex', [
      '@布偶猫',
      '收到，改成可执行请求',
      '第三次调用',
    ]);
    const deps = createMockDeps({ codex: codexService }, threadStore);

    for await (const _ of routeSerial(deps, ['codex'], 'first', 'user1', thread.id, { thinkingMode: 'debug' })) {}
    for await (const _ of routeSerial(deps, ['codex'], 'second', 'user1', thread.id, { thinkingMode: 'debug' })) {}
    for await (const _ of routeSerial(deps, ['codex'], 'third', 'user1', thread.id, { thinkingMode: 'debug' })) {}

    assert.equal(codexService.calls.length, 3, 'codex should be called across three invocations');
    assert.match(
      codexService.calls[1],
      /Routing feedback\(one-shot\): .*reason=no_action/,
      'second invocation should include one-shot no_action feedback',
    );
    assert.ok(
      !codexService.calls[2].includes('Routing feedback(one-shot):'),
      'third invocation should not repeat one-shot feedback',
    );
  });

  it('D3 feedback records cross_paragraph reason', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    const threadStore = new ThreadStore();
    const thread = threadStore.create('user1', 'D3 cross_paragraph');
    const codexService = createSequentialCapturingService('codex', [
      '@布偶猫\n\n请 review 这个改动',
      '收到',
    ]);
    const deps = createMockDeps({ codex: codexService }, threadStore);

    for await (const _ of routeSerial(deps, ['codex'], 'first', 'user1', thread.id, { thinkingMode: 'debug' })) {}
    for await (const _ of routeSerial(deps, ['codex'], 'second', 'user1', thread.id, { thinkingMode: 'debug' })) {}

    assert.equal(codexService.calls.length, 2, 'codex should be called twice');
    assert.match(
      codexService.calls[1],
      /Routing feedback\(one-shot\): .*reason=cross_paragraph/,
      'second invocation should include cross_paragraph feedback reason',
    );
  });

  it('D3 clears stale suppression when later mention for same target is actionable', async () => {
    const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    const threadStore = new ThreadStore();
    const thread = threadStore.create('user1', 'D3 suppression clear');

    const opusService = createSequentialCapturingService('opus', [
      '@缅因猫\n\n@缅因猫 请 review 这个改动',
      '第二次无 mention',
    ]);
    const codexService = createCapturingService('codex', '收到');
    const deps = createMockDeps({ opus: opusService, codex: codexService }, threadStore);

    for await (const _ of routeSerial(deps, ['opus'], 'first', 'user1', thread.id, { thinkingMode: 'debug' })) {}
    for await (const _ of routeSerial(deps, ['opus'], 'second', 'user1', thread.id, { thinkingMode: 'debug' })) {}

    assert.equal(opusService.calls.length, 2, 'opus should be called twice');
    assert.equal(codexService.calls.length, 1, 'codex should be invoked once by actionable mention');
    assert.ok(
      !opusService.calls[1].includes('Routing feedback(one-shot):'),
      'second invocation should not receive stale suppression feedback',
    );
  });
});
