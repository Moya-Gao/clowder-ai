/**
 * Route Strategies Tests
 * 验证 routeSerial / routeParallel 纯函数的基本行为
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Create a mock agent service that yields text + done
function createMockService(catId, text = 'hello') {
  return {
    async *invoke(prompt) {
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
      append: async () => ({ id: 'msg-1', userId: '', catId: null, content: '', mentions: [], timestamp: 0 }),
      getRecent: () => [],
      getMentionsFor: () => [],
      getBefore: () => [],
      getByThread: () => [],
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

describe('routeParallel', () => {
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
