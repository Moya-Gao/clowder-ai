import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { AntigravityAgentService } from '../dist/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.js';
import { AntigravityBridge } from '../dist/domains/cats/services/agents/providers/antigravity/AntigravityBridge.js';

function createBridge() {
  return new AntigravityBridge({ port: 1234, csrfToken: 'test', useTls: false });
}

async function collect(iterable) {
  const messages = [];
  for await (const msg of iterable) messages.push(msg);
  return messages;
}

function createMockServiceBridge({ resolveOutstandingSteps } = {}) {
  return {
    ensureConnected: mock.fn(async () => ({ port: 1234, csrfToken: 'test', useTls: false })),
    startCascade: mock.fn(async () => 'test-cascade-001'),
    sendMessage: mock.fn(async () => 0),
    getTrajectorySteps: mock.fn(async () => []),
    getTrajectory: mock.fn(async () => ({ status: 'CASCADE_RUN_STATUS_IDLE', numTotalSteps: 0 })),
    pollForSteps: mock.fn(async function* () {
      yield {
        steps: [],
        cursor: {
          baselineStepCount: 0,
          lastDeliveredStepCount: 0,
          terminalSeen: false,
          lastActivityAt: Date.now(),
          awaitingUserInput: true,
        },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'DONE',
            plannerResponse: { response: 'browser approved' },
          },
        ],
        cursor: {
          baselineStepCount: 0,
          lastDeliveredStepCount: 1,
          terminalSeen: true,
          lastActivityAt: Date.now(),
        },
      };
    }),
    getOrCreateSession: mock.fn(async () => 'test-cascade-001'),
    resolveModelId: mock.fn(() => 'MODEL_PLACEHOLDER_M26'),
    resolveOutstandingSteps: resolveOutstandingSteps ?? mock.fn(async () => {}),
  };
}

describe('Antigravity waiting approval', () => {
  test('pollForSteps yields awaiting-user-input state instead of throwing stall', async () => {
    const bridge = createBridge();
    mock.method(bridge, 'getTrajectory', async () => ({
      status: 'CASCADE_RUN_STATUS_RUNNING',
      numTotalSteps: 0,
      awaitingUserInput: true,
    }));

    const ac = new AbortController();
    const iter = bridge.pollForSteps('cascade-1', 0, 100, 20, ac.signal)[Symbol.asyncIterator]();

    const first = await iter.next();
    assert.equal(first.done, false);
    assert.equal(first.value.steps.length, 0);
    assert.equal(first.value.cursor.awaitingUserInput, true);

    ac.abort();
    await assert.rejects(async () => {
      await iter.next();
    }, /abort/i);
  });

  test('service auto-approves via resolveOutstandingSteps when autoApprove=true (default)', async () => {
    const resolveOutstandingSteps = mock.fn(async () => {});
    const bridge = createMockServiceBridge({ resolveOutstandingSteps });
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'claude-opus-4-6', bridge });

    const messages = await collect(service.invoke('open browser'));

    assert.equal(resolveOutstandingSteps.mock.calls.length, 1, 'resolveOutstandingSteps should be called once');
    assert.equal(resolveOutstandingSteps.mock.calls[0].arguments[0], 'test-cascade-001');

    const waiting = messages.find((msg) => msg.type === 'liveness_signal');
    assert.equal(waiting, undefined, 'should NOT emit liveness_signal when auto-approve succeeds');

    const texts = messages.filter((msg) => msg.type === 'text');
    assert.equal(texts.length, 1);
    assert.equal(texts[0].content, 'browser approved');
  });

  test('service falls back to liveness_signal when auto-approve fails', async () => {
    const resolveOutstandingSteps = mock.fn(async () => {
      throw new Error('ResolveOutstandingSteps: 400 — invalid');
    });
    const bridge = createMockServiceBridge({ resolveOutstandingSteps });
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'claude-opus-4-6', bridge });

    const messages = await collect(service.invoke('open browser'));

    assert.equal(resolveOutstandingSteps.mock.calls.length, 1, 'should attempt auto-approve');

    const waiting = messages.find((msg) => msg.type === 'liveness_signal');
    assert.ok(waiting, 'should fall back to liveness_signal on failure');
    const parsed = JSON.parse(waiting.content);
    assert.match(parsed.message, /等待权限批准/);
  });

  test('service emits liveness_signal when resolve succeeds but awaitingUserInput persists', async () => {
    const resolveOutstandingSteps = mock.fn(async () => {});
    const bridge = {
      ...createMockServiceBridge({ resolveOutstandingSteps }),
      pollForSteps: mock.fn(async function* () {
        // 1st batch: awaitingUserInput — service should try auto-approve
        yield {
          steps: [],
          cursor: {
            baselineStepCount: 0,
            lastDeliveredStepCount: 0,
            terminalSeen: false,
            lastActivityAt: Date.now(),
            awaitingUserInput: true,
          },
        };
        // 2nd batch: STILL awaitingUserInput — resolve was a no-op
        yield {
          steps: [],
          cursor: {
            baselineStepCount: 0,
            lastDeliveredStepCount: 0,
            terminalSeen: false,
            lastActivityAt: Date.now(),
            awaitingUserInput: true,
          },
        };
        // 3rd batch: finally resolved
        yield {
          steps: [{ type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', status: 'DONE', plannerResponse: { response: 'done' } }],
          cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: true, lastActivityAt: Date.now() },
        };
      }),
    };
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'claude-opus-4-6', bridge });

    const messages = await collect(service.invoke('open browser'));

    // Should only attempt resolve ONCE, not retry on second awaitingUserInput
    assert.equal(resolveOutstandingSteps.mock.calls.length, 1, 'should attempt resolve only once');

    // Must emit liveness_signal on the second awaitingUserInput (resolve didn't work)
    const waiting = messages.filter((msg) => msg.type === 'liveness_signal');
    assert.ok(waiting.length >= 1, 'must emit liveness_signal when resolve did not clear awaitingUserInput');
  });

  test('env var ANTIGRAVITY_AUTO_APPROVE=false disables auto-approve', async () => {
    const original = process.env['ANTIGRAVITY_AUTO_APPROVE'];
    try {
      process.env['ANTIGRAVITY_AUTO_APPROVE'] = 'false';
      const resolveOutstandingSteps = mock.fn(async () => {});
      const bridge = createMockServiceBridge({ resolveOutstandingSteps });
      // No explicit autoApprove option — should read from env
      const service = new AntigravityAgentService({ catId: 'antigravity', model: 'claude-opus-4-6', bridge });

      const messages = await collect(service.invoke('open browser'));

      assert.equal(resolveOutstandingSteps.mock.calls.length, 0, 'should NOT call resolve when env disables it');
      const waiting = messages.find((msg) => msg.type === 'liveness_signal');
      assert.ok(waiting, 'should emit liveness_signal');
    } finally {
      if (original === undefined) delete process.env['ANTIGRAVITY_AUTO_APPROVE'];
      else process.env['ANTIGRAVITY_AUTO_APPROVE'] = original;
    }
  });

  test('service emits liveness_signal when autoApprove=false', async () => {
    const resolveOutstandingSteps = mock.fn(async () => {});
    const bridge = createMockServiceBridge({ resolveOutstandingSteps });
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'claude-opus-4-6',
      bridge,
      autoApprove: false,
    });

    const messages = await collect(service.invoke('open browser'));

    assert.equal(resolveOutstandingSteps.mock.calls.length, 0, 'should NOT call resolveOutstandingSteps');

    const waiting = messages.find((msg) => msg.type === 'liveness_signal');
    assert.ok(waiting, 'should emit liveness_signal when auto-approve disabled');
    const parsed = JSON.parse(waiting.content);
    assert.equal(parsed.type, 'info');
    assert.match(parsed.message, /等待权限批准/);
  });
});
