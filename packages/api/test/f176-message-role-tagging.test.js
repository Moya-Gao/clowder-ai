// F176 Phase 1: backend tags stream text with messageRole: 'final'.
// This test locks the contract that native-CLI provider's final assistant
// response is semantically classified as `final`, distinct from real CLI
// stdout noise. Frontend (Phase 2) routes by messageRole, not just origin.

import assert from 'node:assert/strict';
import { test } from 'node:test';

const { routeSerial } = await import('../dist/domains/cats/services/agents/routing/route-serial.js');
const { routeParallel } = await import('../dist/domains/cats/services/agents/routing/route-parallel.js');

function createMockDeps(services) {
  let counter = 0;
  return {
    services,
    invocationDeps: {
      registry: {
        create: () => ({ invocationId: `inv-${++counter}`, callbackToken: `tok-${counter}` }),
        verify: async () => ({ ok: false, reason: 'unknown_invocation' }),
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

test('routeSerial tags stream text with messageRole=final (F176 Phase 1)', async () => {
  const opusService = {
    async *invoke() {
      yield {
        type: 'text',
        catId: 'opus',
        content: '这是布偶猫的最终回复',
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: 'opus', timestamp: Date.now() };
    },
  };

  const deps = createMockDeps({ opus: opusService });
  const yielded = [];
  for await (const ev of routeSerial(deps, ['opus'], '问题', 'user-1', 'thread-1', {
    currentUserMessageId: '0000000000000001-000001-aaaaaaaa',
    thinkingMode: 'play',
  })) {
    yielded.push(ev);
  }

  const textEvents = yielded.filter((ev) => ev.type === 'text' && ev.catId === 'opus');
  assert.ok(textEvents.length > 0, 'expected at least one text event from opus');
  for (const ev of textEvents) {
    assert.equal(
      ev.messageRole,
      'final',
      `text event should be tagged messageRole=final (F176), got ${JSON.stringify(ev.messageRole)}`,
    );
    // Backwards-compat: origin still set to 'stream' so legacy consumers unaffected.
    assert.equal(ev.origin, 'stream', 'origin should still be stream for backwards-compat');
  }
});

test('routeSerial does NOT tag non-text events with messageRole (Phase 1 scope)', async () => {
  const opusService = {
    async *invoke() {
      yield {
        type: 'text',
        catId: 'opus',
        content: 'reply',
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: 'opus', timestamp: Date.now() };
    },
  };

  const deps = createMockDeps({ opus: opusService });
  const yielded = [];
  for await (const ev of routeSerial(deps, ['opus'], '问题', 'user-1', 'thread-1', {
    currentUserMessageId: '0000000000000001-000001-aaaaaaaa',
    thinkingMode: 'play',
  })) {
    yielded.push(ev);
  }

  const nonTextEvents = yielded.filter((ev) => ev.type !== 'text');
  for (const ev of nonTextEvents) {
    assert.equal(ev.messageRole, undefined, `non-text event (type=${ev.type}) should not have messageRole in Phase 1`);
  }
});

test('routeParallel tags stream text with messageRole=final (F176 Phase 1)', async () => {
  const opusService = {
    async *invoke() {
      yield {
        type: 'text',
        catId: 'opus',
        content: '布偶猫并行回复',
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: 'opus', timestamp: Date.now() };
    },
  };
  const codexService = {
    async *invoke() {
      yield {
        type: 'text',
        catId: 'codex',
        content: '缅因猫并行回复',
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: 'codex', timestamp: Date.now() };
    },
  };

  const deps = createMockDeps({ opus: opusService, codex: codexService });
  const yielded = [];
  for await (const ev of routeParallel(deps, ['opus', 'codex'], '并行问题', 'user-1', 'thread-1', {
    currentUserMessageId: '0000000000000001-000001-aaaaaaaa',
    thinkingMode: 'play',
  })) {
    yielded.push(ev);
  }

  const textEvents = yielded.filter((ev) => ev.type === 'text');
  assert.ok(textEvents.length >= 2, 'expected at least one text event per parallel cat');
  for (const ev of textEvents) {
    assert.equal(
      ev.messageRole,
      'final',
      `parallel text event should be tagged messageRole=final (F176), got ${JSON.stringify(ev.messageRole)}`,
    );
    // Note: routeParallel yield path does NOT set origin (only persistence does).
    // Frontend socket handler defaults origin='stream' for streaming events.
  }
});
