/**
 * F167 L1: route-serial 消费 warnPingPong / blockPingPong
 *
 * streak=2+ → 下一只猫 prompt 注入"🏓 乒乓球"警告（pingPongWarning）。
 * streak=4 → route-serial 不 enqueue 下一棒 + emit a2a_pingpong_terminated system_info。
 *
 * 场景：opus ↔ codex 互相 @ 的 ping-pong 链。
 * - round 0: opus 跑（original）→ 出 @codex → enqueue codex (streak=1)
 * - round 1: codex 跑 → 出 @opus → enqueue opus (streak=2, warn)
 * - round 2: opus 跑（prompt 含 warn）→ 出 @codex → enqueue codex (streak=3, warn)
 * - round 3: codex 跑（prompt 含 warn）→ 出 @opus → streak=4 BLOCK, emit terminated, 不 enqueue
 * 共 4 次 invoke，opus 2 次、codex 2 次。
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { catRegistry } from '@cat-cafe/shared';

function createCapturingService(catId, text) {
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

/**
 * F167 Phase D: service that emits a substantive tool_use before its text.
 * Used to verify the breaker exempts real work (read/edit/write/task) from streak++.
 */
function createSubstantiveToolService(catId, text, toolName = 'Edit') {
  const calls = [];
  return {
    calls,
    async *invoke(prompt) {
      calls.push(prompt);
      yield {
        type: 'tool_use',
        catId,
        toolName,
        toolInput: {},
        id: `tool-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      };
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
      getById: () => null,
      getRecent: () => [],
      getMentionsFor: () => [],
      getBefore: () => [],
      getByThread: () => [],
      getByThreadAfter: () => [],
      getByThreadBefore: () => [],
    },
  };
}

async function loadRealRoster() {
  const { loadCatConfig, toAllCatConfigs } = await import('../dist/config/cat-config-loader.js');
  const runtimeConfigs = toAllCatConfigs(loadCatConfig());
  catRegistry.reset();
  for (const [id, config] of Object.entries(runtimeConfigs)) {
    catRegistry.register(id, config);
  }
}

describe('F167 L1: route-serial ping-pong circuit breaker', () => {
  test('streak=4 (opus↔codex × 4 rounds) → block enqueue + emit a2a_pingpong_terminated', async () => {
    const original = catRegistry.getAllConfigs();
    await loadRealRoster();
    try {
      const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
      const opusService = createCapturingService('opus', '看了\n@codex review 一下');
      const codexService = createCapturingService('codex', '看了\n@opus 确认一下');
      const deps = createMockDeps({ opus: opusService, codex: codexService });

      const events = [];
      for await (const msg of routeSerial(deps, ['opus'], 'ping-pong test', 'user1', 'thread-pp-block', {
        thinkingMode: 'play',
      })) {
        events.push(msg);
      }

      assert.strictEqual(opusService.calls.length, 2, 'opus should invoke 2 times (rounds 0, 2) before block');
      assert.strictEqual(codexService.calls.length, 2, 'codex should invoke 2 times (rounds 1, 3) before block');

      const terminated = events.find(
        (e) =>
          e.type === 'system_info' && typeof e.content === 'string' && e.content.includes('a2a_pingpong_terminated'),
      );
      assert.ok(terminated, 'must emit a2a_pingpong_terminated system_info on streak=4');
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(original)) {
        catRegistry.register(id, config);
      }
    }
  });

  test('streak >= 2 → next cat prompt contains ping-pong warning', async () => {
    const original = catRegistry.getAllConfigs();
    await loadRealRoster();
    try {
      const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
      const opusService = createCapturingService('opus', '看了\n@codex 确认一下');
      const codexService = createCapturingService('codex', '看了\n@opus 确认一下');
      const deps = createMockDeps({ opus: opusService, codex: codexService });

      for await (const _ of routeSerial(deps, ['opus'], 'warn test', 'user1', 'thread-pp-warn', {
        thinkingMode: 'play',
      })) {
      }

      // opus 第 2 次被 invoke 时（round 2），streakPair.count=2，prompt 应含警告
      assert.ok(opusService.calls.length >= 2, 'opus must be invoked at least twice');
      const secondOpusPrompt = JSON.stringify(opusService.calls[1]);
      assert.match(
        secondOpusPrompt,
        /乒乓球|连续.*轮|ping[- ]?pong/,
        'second opus prompt (after streak=2) must contain ping-pong warning text',
      );
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(original)) {
        catRegistry.register(id, config);
      }
    }
  });

  test('F167-D1: 4 rounds with substantive tool (Edit) every round → NO termination', async () => {
    const original = catRegistry.getAllConfigs();
    await loadRealRoster();
    try {
      const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
      // Each cat calls a substantive tool (Edit) before emitting its @mention.
      // Expected: breaker exempts every round → opus/codex each invoke 2+ times, no pingpong_terminated.
      const opusService = createSubstantiveToolService('opus', '修完\n@codex review 一下', 'Edit');
      const codexService = createSubstantiveToolService('codex', '补测试\n@opus 看看', 'Write');
      const deps = createMockDeps({ opus: opusService, codex: codexService });

      const events = [];
      for await (const msg of routeSerial(deps, ['opus'], 'substantive review test', 'user1', 'thread-pp-substantive', {
        thinkingMode: 'play',
      })) {
        events.push(msg);
      }

      const terminated = events.find(
        (e) =>
          e.type === 'system_info' && typeof e.content === 'string' && e.content.includes('a2a_pingpong_terminated'),
      );
      assert.ok(!terminated, 'substantive tool_use every round must exempt streak — no a2a_pingpong_terminated');
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(original)) {
        catRegistry.register(id, config);
      }
    }
  });

  test('F167-D1: 4 rounds with long text (>200 chars) every round → NO termination', async () => {
    const original = catRegistry.getAllConfigs();
    await loadRealRoster();
    try {
      const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
      // Output text must be > 200 chars (UTF-16 code units) to trigger the long-text exemption.
      const longTextOpus = `${'架构讨论'.repeat(60)}\n@codex 这段你怎么看？`; // ~240+ code units
      const longTextCodex = `${'架构回应'.repeat(60)}\n@opus 我的观点如上`;
      const opusService = createCapturingService('opus', longTextOpus);
      const codexService = createCapturingService('codex', longTextCodex);
      const deps = createMockDeps({ opus: opusService, codex: codexService });

      const events = [];
      for await (const msg of routeSerial(deps, ['opus'], 'long-text discussion test', 'user1', 'thread-pp-longtext', {
        thinkingMode: 'play',
      })) {
        events.push(msg);
      }

      const terminated = events.find(
        (e) =>
          e.type === 'system_info' && typeof e.content === 'string' && e.content.includes('a2a_pingpong_terminated'),
      );
      assert.ok(
        !terminated,
        'long-text discussion (>200 chars) every round must exempt streak — no a2a_pingpong_terminated',
      );
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(original)) {
        catRegistry.register(id, config);
      }
    }
  });

  test('no ping-pong (single handoff) → no warning, no termination', async () => {
    const original = catRegistry.getAllConfigs();
    await loadRealRoster();
    try {
      const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
      const opusService = createCapturingService('opus', '看过了\n@codex 帮忙 review');
      const codexService = createCapturingService('codex', '看过了，没问题');
      const deps = createMockDeps({ opus: opusService, codex: codexService });

      const events = [];
      for await (const msg of routeSerial(deps, ['opus'], 'single handoff', 'user1', 'thread-pp-single', {
        thinkingMode: 'play',
      })) {
        events.push(msg);
      }

      assert.strictEqual(opusService.calls.length, 1, 'opus invoked once (no ping back)');
      assert.strictEqual(codexService.calls.length, 1, 'codex invoked once');
      const terminated = events.find(
        (e) =>
          e.type === 'system_info' && typeof e.content === 'string' && e.content.includes('a2a_pingpong_terminated'),
      );
      assert.ok(!terminated, 'single handoff must not emit a2a_pingpong_terminated');
      const firstCodexPrompt = JSON.stringify(codexService.calls[0]);
      assert.doesNotMatch(
        firstCodexPrompt,
        /乒乓球|连续.*轮/,
        'codex first prompt (streak=1) must NOT contain warning',
      );
    } finally {
      catRegistry.reset();
      for (const [id, config] of Object.entries(original)) {
        catRegistry.register(id, config);
      }
    }
  });
});
