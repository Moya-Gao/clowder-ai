import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { AntigravityAgentService } from '../dist/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.js';

async function collect(iterable) {
  const messages = [];
  for await (const msg of iterable) messages.push(msg);
  return messages;
}

/** Create a fake AntigravityBridge for testing */
function createMockBridge({
  steps = [
    {
      type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
      status: 'CORTEX_STEP_STATUS_DONE',
      plannerResponse: { response: 'Meow!' },
    },
  ],
  cascadeId = 'test-cascade-001',
  pollError = null,
} = {}) {
  return {
    ensureConnected: mock.fn(async () => ({ port: 1234, csrfToken: 'test', useTls: false })),
    startCascade: mock.fn(async () => cascadeId),
    sendMessage: mock.fn(async () => {}),
    getTrajectorySteps: mock.fn(async () => steps),
    getTrajectory: mock.fn(async () => ({ status: 'CASCADE_RUN_STATUS_IDLE', numTotalSteps: steps.length })),
    pollForResponse: pollError
      ? mock.fn(async () => {
          throw new Error(pollError);
        })
      : mock.fn(async () => steps),
    getOrCreateSession: mock.fn(async () => cascadeId),
    resolveModelId: mock.fn((name) => ({ 'gemini-3.1-pro': 1165, 'claude-opus-4-6': 1154 })[name]),
  };
}

describe('AntigravityAgentService (Bridge)', () => {
  test('yields session_init + text + done from successful response', async () => {
    const bridge = createMockBridge({
      steps: [
        {
          type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
          status: 'CORTEX_STEP_STATUS_DONE',
          plannerResponse: { response: 'Hello from Antigravity!' },
        },
      ],
    });
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('Say hello'));

    assert.equal(bridge.getOrCreateSession.mock.callCount(), 1);
    assert.equal(bridge.sendMessage.mock.callCount(), 1);
    assert.equal(bridge.pollForResponse.mock.callCount(), 1);

    // Message sequence: session_init → text → done
    assert.equal(messages.length, 3);
    assert.equal(messages[0].type, 'session_init');
    assert.equal(messages[0].sessionId, 'test-cascade-001');
    assert.equal(messages[1].type, 'text');
    assert.equal(messages[1].content, 'Hello from Antigravity!');
    assert.equal(messages[1].metadata.provider, 'antigravity');
    assert.equal(messages[2].type, 'done');
  });

  test('yields error + done when bridge poll fails', async () => {
    const bridge = createMockBridge({ pollError: 'timeout after 90000ms' });
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('test'));

    assert.equal(messages.length, 3); // session_init + error + done
    assert.equal(messages[1].type, 'error');
    assert.ok(messages[1].error.includes('timeout'));
    assert.equal(messages[2].type, 'done');
  });

  test('yields error when response has no text', async () => {
    const bridge = createMockBridge({
      steps: [{ type: 'CORTEX_STEP_TYPE_CHECKPOINT', status: 'CORTEX_STEP_STATUS_DONE' }],
    });
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('test'));

    const errorMsg = messages.find((m) => m.type === 'error');
    assert.ok(errorMsg, 'should yield error when no text in response');
    assert.equal(errorMsg.errorCode, 'empty_response');
  });

  test('modelVerified is true for known models', async () => {
    const bridge = createMockBridge();
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('test'));
    assert.equal(messages[1].metadata.modelVerified, true);
  });

  test('modelVerified is false for unknown models', async () => {
    const bridge = createMockBridge();
    bridge.resolveModelId = mock.fn(() => undefined);
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'unknown-model', bridge });
    const messages = await collect(service.invoke('test'));
    assert.equal(messages[1].metadata.modelVerified, false);
  });

  test('prepends systemPrompt to prompt', async () => {
    const bridge = createMockBridge();
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    await collect(service.invoke('Hello', { systemPrompt: 'You are a cat.' }));

    const sentPrompt = bridge.sendMessage.mock.calls[0].arguments[1];
    assert.ok(sentPrompt.startsWith('You are a cat.'));
    assert.ok(sentPrompt.includes('Hello'));
  });

  test('passes threadId from auditContext to session mapping', async () => {
    const bridge = createMockBridge();
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    await collect(
      service.invoke('test', {
        auditContext: { threadId: 'thread-xyz', invocationId: 'inv-1', userId: 'u1', catId: 'antigravity' },
      }),
    );

    assert.equal(bridge.getOrCreateSession.mock.calls[0].arguments[0], 'thread-xyz');
  });

  test('yields thinking as system_info', async () => {
    const bridge = createMockBridge({
      steps: [
        {
          type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
          status: 'CORTEX_STEP_STATUS_DONE',
          plannerResponse: { response: 'answer', thinking: 'Let me think...' },
        },
      ],
    });
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('test'));

    const thinkingMsg = messages.find((m) => m.type === 'system_info');
    assert.ok(thinkingMsg);
    assert.ok(thinkingMsg.content.includes('thinking'));
  });

  test('aborted signal prevents execution', async () => {
    const bridge = createMockBridge();
    const controller = new AbortController();
    controller.abort();
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('test', { signal: controller.signal }));

    assert.equal(bridge.sendMessage.mock.callCount(), 0);
    assert.equal(messages[0].type, 'error');
    assert.ok(messages[0].error.includes('Aborted'));
  });
});
