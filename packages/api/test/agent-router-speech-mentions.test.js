import test from 'node:test';
import assert from 'node:assert/strict';

function createNoopService(catId) {
  return {
    invoke: async function* () {
      yield { type: 'done', catId, timestamp: Date.now() };
    },
  };
}

function createNoopRegistry() {
  return {
    create: () => ({ invocationId: 'inv-1', callbackToken: 'cb-1' }),
    update: () => {},
    get: () => null,
  };
}

function createNoopMessageStore() {
  return {
    append: () => ({}),
    getRecent: () => [],
    getMentionsFor: () => [],
    getByThreadBefore: () => [],
    getByThreadAfter: () => [],
    getById: () => null,
    softDelete: () => null,
    restore: () => null,
  };
}

test('resolveTargetsAndIntent supports speech-style "at + nickname" mentions', async () => {
  const { AgentRouter } = await import('../dist/domains/cats/services/AgentRouter.js');
  const router = new AgentRouter({
    claudeService: createNoopService('opus'),
    codexService: createNoopService('codex'),
    geminiService: createNoopService('gemini'),
    registry: createNoopRegistry(),
    messageStore: createNoopMessageStore(),
  });

  const result = await router.resolveTargetsAndIntent('at咱的砚砚 和 at 宪宪 你们出来了', 'thread-voice');
  assert.deepEqual(result.targetCats, ['codex', 'opus']);
});
