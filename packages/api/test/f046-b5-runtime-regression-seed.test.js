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

describe('F046 B5 runtime regression seed', () => {
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

  it('invalid same-family review marker is propagated to downstream cat in debug mode', async () => {
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
        opusService.calls[0].includes('⚠️ Review 无效：同族 reviewer identity check 未通过'),
        'downstream prompt should include invalid review marker',
      );
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(originalConfigs)) {
        catRegistry.register(id, config);
      }
    }
  });
});
