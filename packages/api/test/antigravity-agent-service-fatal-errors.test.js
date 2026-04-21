import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AntigravityAgentService } from '../dist/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.js';
import { collect, createMockBridge } from './antigravity-agent-service-test-helpers.js';

describe('AntigravityAgentService (Bridge) — fatal errors', () => {
  test('model_capacity retries on a fresh cascade and recovers without surfacing a final error', async () => {
    const bridge = createMockBridge();
    let sessionIndex = 0;
    bridge.getOrCreateSession = async () => ['cascade-1', 'cascade-2'][sessionIndex++];
    bridge.pollForSteps = async function* (cascadeId) {
      if (cascadeId === 'cascade-1') {
        yield {
          steps: [
            {
              type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
              status: 'FINISHED',
              errorMessage: {
                error: {
                  userErrorMessage:
                    'Our servers are experiencing high traffic right now, please try again in a minute.',
                },
              },
            },
          ],
          cursor: {
            baselineStepCount: 0,
            lastDeliveredStepCount: 1,
            terminalSeen: true,
            lastActivityAt: Date.now(),
          },
        };
        return;
      }

      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { response: 'Here is the recovered answer.' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };

    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      modelCapacityRetryDelaysMs: [0],
    });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text').map((m) => m.content);
    assert.deepEqual(texts, ['Here is the recovered answer.']);
    const warnings = messages.filter((m) => m.type === 'provider_signal');
    assert.equal(warnings.length, 1, 'should yield one retry warning');
    assert.match(warnings[0].content, /自动重试/);
    const capacityErrors = messages.filter((m) => m.type === 'error' && m.errorCode === 'model_capacity');
    assert.equal(capacityErrors.length, 0, 'capacity error should stay hidden when retry succeeds');
    assert.equal(bridge.resetSession.mock.callCount(), 1, 'should reset the poisoned cascade before retry');
    assert.equal(bridge.sendMessage.mock.callCount(), 2, 'should resend the prompt after capacity retry');
  });

  test('quota-style model_capacity wording retries on a fresh cascade and preserves callback fallback prompt', async () => {
    const bridge = createMockBridge();
    let sessionIndex = 0;
    bridge.getOrCreateSession = async () => ['cascade-1', 'cascade-2'][sessionIndex++];
    bridge.pollForSteps = async function* (cascadeId) {
      if (cascadeId === 'cascade-1') {
        yield {
          steps: [
            {
              type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
              status: 'FINISHED',
              errorMessage: {
                error: {
                  userErrorMessage: 'You have exhausted your capacity on this model. Your quota will reset after 0s.',
                },
              },
            },
          ],
          cursor: {
            baselineStepCount: 0,
            lastDeliveredStepCount: 1,
            terminalSeen: true,
            lastActivityAt: Date.now(),
          },
        };
        return;
      }

      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { response: 'Recovered after quota-style retry.' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };

    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      modelCapacityRetryDelaysMs: [0],
    });
    const messages = await collect(
      service.invoke('Read the latest thread context', {
        callbackEnv: {
          CAT_CAFE_API_URL: 'http://127.0.0.1:3002',
          CAT_CAFE_INVOCATION_ID: 'inv-123',
          CAT_CAFE_CALLBACK_TOKEN: 'tok-456',
        },
        auditContext: { threadId: 'thread-f061-capacity', invocationId: 'inv-123', userId: 'u1', catId: 'antigravity' },
      }),
    );

    const texts = messages.filter((m) => m.type === 'text').map((m) => m.content);
    assert.deepEqual(texts, ['Recovered after quota-style retry.']);
    assert.equal(bridge.resetSession.mock.callCount(), 1, 'should reset once for quota-style capacity retry');
    assert.equal(bridge.sendMessage.mock.callCount(), 2, 'should resend prompt after quota-style capacity retry');
    const resentPrompt = bridge.sendMessage.mock.calls[1].arguments[1];
    assert.match(resentPrompt, /Cat Cafe callback fallback/, 'retry prompt must preserve callback fallback');
    assert.match(resentPrompt, /thread-context\?invocationId=inv-123&callbackToken=tok-456/);
    assert.match(resentPrompt, /post-message/, 'retry prompt must preserve reply path');
    const capacityErrors = messages.filter((m) => m.type === 'error' && m.errorCode === 'model_capacity');
    assert.equal(capacityErrors.length, 0, 'capacity error should stay hidden when retry succeeds');
  });

  test('capacity retry fails fast on unsupported waiting tool step instead of hanging for stall timeout', async () => {
    const bridge = createMockBridge();
    bridge.nativeExecuteAndPush = async (step) => {
      if (step.metadata?.toolCall?.name === 'grep_search') return 'no_executor';
      return false;
    };
    let sessionIndex = 0;
    bridge.getOrCreateSession = async () => ['cascade-1', 'cascade-2'][sessionIndex++];
    bridge.pollForSteps = async function* (cascadeId) {
      if (cascadeId === 'cascade-1') {
        yield {
          steps: [
            {
              type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
              status: 'FINISHED',
              errorMessage: {
                error: {
                  userErrorMessage:
                    'Our servers are experiencing high traffic right now, please try again in a minute.',
                },
              },
            },
          ],
          cursor: {
            baselineStepCount: 0,
            lastDeliveredStepCount: 1,
            terminalSeen: true,
            lastActivityAt: Date.now(),
          },
        };
        return;
      }

      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_GREP_SEARCH',
            status: 'CORTEX_STEP_STATUS_WAITING',
            metadata: {
              toolCall: {
                id: 'tool-1',
                name: 'grep_search',
                argumentsJson: JSON.stringify({ Pattern: 'foo', Path: 'src' }),
              },
            },
          },
        ],
        cursor: {
          baselineStepCount: 0,
          lastDeliveredStepCount: 1,
          terminalSeen: false,
          lastActivityAt: Date.now(),
        },
      };
      throw new Error('Antigravity stall: no activity for 20ms (steps=1, status=CASCADE_RUN_STATUS_RUNNING)');
    };

    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      modelCapacityRetryDelaysMs: [0],
      pollTimeoutMs: 20,
    });
    const messages = await collect(service.invoke('hello'));

    const retryWarnings = messages.filter((m) => m.type === 'provider_signal');
    assert.equal(retryWarnings.length, 1, 'should still emit the first retry warning');
    const unsupported = messages.find((m) => m.type === 'error' && m.errorCode === 'unsupported_waiting_tool');
    assert.ok(unsupported, 'unsupported waiting tool should surface as explicit fatal error');
    assert.match(unsupported.error, /grep_search/i);
    assert.equal(
      messages.some((m) => m.type === 'error' && /^Antigravity stall:/i.test(m.error ?? '')),
      false,
      'should fail before the later stall timeout path fires',
    );
    assert.equal(
      messages.some((m) => m.type === 'error' && m.errorCode === 'empty_response'),
      false,
      'unsupported waiting tool should be the single terminal error',
    );
    assert.equal(bridge.resetSession.mock.callCount(), 1, 'should still reset once for the capacity retry');
  });

  test('upstream_error does NOT abort poll — model self-corrects in next batch', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
            status: 'FINISHED',
            errorMessage: { error: { userErrorMessage: 'The model produced an invalid tool call.' } },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { response: 'Here is the corrected answer.' },
          },
        ],
        cursor: { baselineStepCount: 1, lastDeliveredStepCount: 2, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      modelCapacityRetryDelaysMs: [],
    });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text');
    assert.equal(texts.length, 1, 'self-corrected text must be yielded after upstream_error');
    assert.equal(texts[0].content, 'Here is the corrected answer.');
    const errors = messages.filter((m) => m.type === 'error');
    assert.ok(
      errors.some((e) => e.errorCode === 'upstream_error'),
      'upstream_error still emitted',
    );
  });

  test('model_capacity still triggers early abort — no ghost text', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
            status: 'FINISHED',
            errorMessage: {
              error: {
                userErrorMessage: 'Our servers are experiencing high traffic right now, please try again in a minute.',
              },
            },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { response: 'ghost text after capacity error' },
          },
        ],
        cursor: { baselineStepCount: 1, lastDeliveredStepCount: 2, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      modelCapacityRetryDelaysMs: [],
    });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text');
    assert.equal(texts.length, 0, 'ghost text after model_capacity should NOT be yielded');
    const errors = messages.filter((m) => m.type === 'error');
    assert.ok(
      errors.some((e) => e.errorCode === 'model_capacity'),
      'must have model_capacity',
    );
  });

  test('model_capacity aborts even when upstream_error co-occurs in same batch', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
            status: 'FINISHED',
            errorMessage: {
              error: {
                userErrorMessage: 'Our servers are experiencing high traffic right now, please try again in a minute.',
              },
            },
          },
          {
            type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
            status: 'FINISHED',
            errorMessage: { error: { userErrorMessage: 'The model produced an invalid tool call.' } },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 2, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { response: 'ghost text after mixed errors' },
          },
        ],
        cursor: { baselineStepCount: 2, lastDeliveredStepCount: 3, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      modelCapacityRetryDelaysMs: [],
    });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text');
    assert.equal(texts.length, 0, 'model_capacity must abort even with co-occurring upstream_error');
    const errors = messages.filter((m) => m.type === 'error');
    assert.ok(
      errors.some((e) => e.errorCode === 'model_capacity'),
      'model_capacity error must be emitted',
    );
  });

  test('stream_error before any text is buffered and later recovery text still arrives', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { stopReason: 'STOP_REASON_CLIENT_STREAM_ERROR' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { response: 'ghost text after stream error' },
          },
        ],
        cursor: { baselineStepCount: 1, lastDeliveredStepCount: 2, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      modelCapacityRetryDelaysMs: [],
    });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text').map((m) => m.content);
    assert.deepEqual(texts, ['ghost text after stream error']);
    const errors = messages.filter((m) => m.type === 'error');
    assert.equal(
      errors.some((e) => e.errorCode === 'stream_error'),
      false,
      'buffered no-text stream_error stays hidden if recovery text arrives',
    );
  });

  test('buffered no-text stream_error expires when no recovery text arrives before grace deadline', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_DONE',
            plannerResponse: { stopReason: 'STOP_REASON_CLIENT_STREAM_ERROR' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: false, lastActivityAt: Date.now() },
      };
      await new Promise((resolve) => setTimeout(resolve, 50));
    };
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      streamErrorGraceWindowMs: 10,
    });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text').map((m) => m.content);
    assert.deepEqual(texts, []);
    const streamErrors = messages.filter((m) => m.type === 'error' && m.errorCode === 'stream_error');
    assert.equal(streamErrors.length, 1, 'stream_error should surface after no-text grace expires');
  });

  test('stream_error after partial text is buffered and later recovery text still arrives', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_GENERATING',
            plannerResponse: { modifiedResponse: '好的，我来换个方式——' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_DONE',
            plannerResponse: { stopReason: 'STOP_REASON_CLIENT_STREAM_ERROR' },
          },
        ],
        cursor: { baselineStepCount: 1, lastDeliveredStepCount: 2, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_DONE',
            plannerResponse: { response: '我继续把结果说完。' },
          },
        ],
        cursor: { baselineStepCount: 2, lastDeliveredStepCount: 3, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'claude-opus-4-6', bridge });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text').map((m) => m.content);
    assert.deepEqual(
      texts,
      ['好的，我来换个方式——', '我继续把结果说完。'],
      'stream_error after partial text should not truncate later recovery text',
    );
    const errors = messages.filter((m) => m.type === 'error');
    assert.equal(
      errors.some((e) => e.errorCode === 'stream_error'),
      false,
      'buffered stream_error stays hidden',
    );
  });

  test('buffered stream_error is dropped when upstream_error arrives later', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_GENERATING',
            plannerResponse: { modifiedResponse: '好的，我来换个方式——' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_DONE',
            plannerResponse: { stopReason: 'STOP_REASON_CLIENT_STREAM_ERROR' },
          },
        ],
        cursor: { baselineStepCount: 1, lastDeliveredStepCount: 2, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
            status: 'FINISHED',
            errorMessage: { error: { userErrorMessage: 'The model produced an invalid tool call.' } },
          },
        ],
        cursor: { baselineStepCount: 2, lastDeliveredStepCount: 3, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('hello'));

    const streamErrors = messages.filter((m) => m.type === 'error' && m.errorCode === 'stream_error');
    const upstreamErrors = messages.filter((m) => m.type === 'error' && m.errorCode === 'upstream_error');
    assert.equal(streamErrors.length, 0, 'buffered stream_error should be dropped when upstream_error arrives');
    assert.equal(upstreamErrors.length, 1, 'upstream_error should be surfaced');
  });

  test('buffered stream_error is dropped when model_capacity arrives later', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_GENERATING',
            plannerResponse: { modifiedResponse: '好的，我来换个方式——' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_DONE',
            plannerResponse: { stopReason: 'STOP_REASON_CLIENT_STREAM_ERROR' },
          },
        ],
        cursor: { baselineStepCount: 1, lastDeliveredStepCount: 2, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
            status: 'FINISHED',
            errorMessage: {
              error: {
                userErrorMessage: 'Our servers are experiencing high traffic right now, please try again in a minute.',
              },
            },
          },
        ],
        cursor: { baselineStepCount: 2, lastDeliveredStepCount: 3, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('hello'));

    const streamErrors = messages.filter((m) => m.type === 'error' && m.errorCode === 'stream_error');
    const capacityErrors = messages.filter((m) => m.type === 'error' && m.errorCode === 'model_capacity');
    const texts = messages.filter((m) => m.type === 'text').map((m) => m.content);
    assert.deepEqual(texts, ['好的，我来换个方式——']);
    assert.equal(streamErrors.length, 0, 'buffered stream_error should be dropped when model_capacity arrives');
    assert.equal(capacityErrors.length, 1, 'model_capacity should be surfaced');
  });

  test('buffered stream_error expires when no recovery text arrives before grace deadline', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_GENERATING',
            plannerResponse: { modifiedResponse: '好的，我来换个方式——' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_DONE',
            plannerResponse: { stopReason: 'STOP_REASON_CLIENT_STREAM_ERROR' },
          },
        ],
        cursor: { baselineStepCount: 1, lastDeliveredStepCount: 2, terminalSeen: false, lastActivityAt: Date.now() },
      };
      await new Promise((resolve) => setTimeout(resolve, 50));
    };
    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      streamErrorGraceWindowMs: 10,
    });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text').map((m) => m.content);
    assert.deepEqual(texts, ['好的，我来换个方式——']);
    const streamErrors = messages.filter((m) => m.type === 'error' && m.errorCode === 'stream_error');
    assert.equal(streamErrors.length, 1, 'stream_error should surface after grace expires');
  });

  test('does NOT emit empty_response when fatalSeen', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
            status: 'FINISHED',
            errorMessage: { error: { modelErrorMessage: 'INVALID_ARGUMENT (code 400)' } },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('hello'));

    const emptyErrs = messages.filter((m) => m.type === 'error' && m.errorCode === 'empty_response');
    assert.equal(emptyErrs.length, 0, 'should NOT add empty_response when fatal already reported');
  });

  test('tool_error does NOT trigger early abort', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_TOOL_RESULT',
            status: 'FINISHED',
            toolResult: { toolName: 'image_gen', success: false, error: 'quota exceeded' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 1, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { response: 'Sorry, image generation failed.' },
          },
        ],
        cursor: { baselineStepCount: 1, lastDeliveredStepCount: 2, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text');
    assert.equal(texts.length, 1, 'text after tool_error should still be yielded');
  });

  test('P1: approval_pending must not add toolCallId to handledToolCallIds — step must be re-tried in next batch', async () => {
    const bridge = createMockBridge();
    const toolCallId = 'toolu_approval_1';
    let waitingStepCallCount = 0;
    bridge.nativeExecuteAndPush = async (step) => {
      if (step.metadata?.toolCall?.id === toolCallId) {
        waitingStepCallCount++;
        if (waitingStepCallCount === 1) return 'approval_pending';
        return true;
      }
      return false;
    };
    const waitingStep = {
      type: 'CORTEX_STEP_TYPE_RUN_COMMAND',
      status: 'CORTEX_STEP_STATUS_WAITING',
      metadata: {
        toolCall: {
          id: toolCallId,
          name: 'run_command',
          argumentsJson: JSON.stringify({ CommandLine: 'echo hi', Cwd: '/tmp', SafeToAutoRun: false }),
        },
      },
    };
    bridge.pollForSteps = async function* () {
      // Batch 1: approval-pending (awaitingUserInput: false so step is processed by nativeExecuteAndPush loop)
      yield {
        steps: [waitingStep],
        cursor: {
          baselineStepCount: 0,
          lastDeliveredStepCount: 0,
          terminalSeen: false,
          lastActivityAt: Date.now(),
          awaitingUserInput: false,
        },
      };
      // Batch 2: same step re-presented after approval + final response
      yield {
        steps: [
          waitingStep,
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'CORTEX_STEP_STATUS_DONE',
            plannerResponse: { response: 'all done' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 2, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };

    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('test'));

    assert.equal(
      waitingStepCallCount,
      2,
      'approval_pending must not add toolCallId to handledToolCallIds — step must be re-tried in next batch',
    );
    const text = messages.find((m) => m.type === 'text');
    assert.ok(text, 'text response must be yielded after re-processed step');
  });

  test('P1: false from nativeExecuteAndPush (kill-switch / no-registry) must NOT trigger unsupported_waiting_tool', async () => {
    const bridge = createMockBridge();
    bridge.nativeExecuteAndPush = async () => false;
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_RUN_COMMAND',
            status: 'CORTEX_STEP_STATUS_WAITING',
            metadata: {
              toolCall: {
                id: 'toolu_ks',
                name: 'run_command',
                argumentsJson: JSON.stringify({ CommandLine: 'echo hi', Cwd: '/tmp', SafeToAutoRun: true }),
              },
              sourceTrajectoryStepInfo: { trajectoryId: 't1', stepIndex: 0, cascadeId: 'c1' },
            },
          },
        ],
        cursor: {
          baselineStepCount: 0,
          lastDeliveredStepCount: 1,
          terminalSeen: false,
          lastActivityAt: Date.now(),
        },
      };
      throw new Error('Antigravity stall: no activity for 20ms (steps=1, status=CASCADE_RUN_STATUS_RUNNING)');
    };

    const service = new AntigravityAgentService({
      catId: 'antigravity',
      model: 'gemini-3.1-pro',
      bridge,
      pollTimeoutMs: 20,
    });
    const messages = await collect(service.invoke('hello'));

    const unsupported = messages.find((m) => m.type === 'error' && m.errorCode === 'unsupported_waiting_tool');
    assert.equal(
      unsupported,
      undefined,
      'false from nativeExecuteAndPush (kill-switch / no-registry disabled) must NOT trigger unsupported_waiting_tool',
    );
  });
});
