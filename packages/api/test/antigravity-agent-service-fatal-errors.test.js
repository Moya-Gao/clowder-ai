import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AntigravityAgentService } from '../dist/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.js';
import { collect, createMockBridge } from './antigravity-agent-service-test-helpers.js';

describe('AntigravityAgentService (Bridge) — fatal errors', () => {
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
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
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
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
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
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text');
    assert.equal(texts.length, 0, 'model_capacity must abort even with co-occurring upstream_error');
    const errors = messages.filter((m) => m.type === 'error');
    assert.ok(
      errors.some((e) => e.errorCode === 'model_capacity'),
      'model_capacity error must be emitted',
    );
  });

  test('stream_error alone still triggers early abort', async () => {
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
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text');
    assert.equal(texts.length, 0, 'ghost text after stream_error should NOT be yielded');
    const errors = messages.filter((m) => m.type === 'error');
    assert.ok(
      errors.some((e) => e.errorCode === 'stream_error'),
      'must have stream_error',
    );
  });

  test('stream_error after partial text does NOT abort poll — later recovery text still arrives', async () => {
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
    assert.ok(
      errors.some((e) => e.errorCode === 'stream_error'),
      'stream_error should still be surfaced',
    );
  });

  test('stream_error does NOT abort when upstream_error co-occurs — stream_error is noise', async () => {
    const bridge = createMockBridge();
    bridge.pollForSteps = async function* () {
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
            status: 'FINISHED',
            errorMessage: { error: { userErrorMessage: 'The model produced an invalid tool call.' } },
          },
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { stopReason: 'STOP_REASON_CLIENT_STREAM_ERROR' },
          },
        ],
        cursor: { baselineStepCount: 0, lastDeliveredStepCount: 2, terminalSeen: false, lastActivityAt: Date.now() },
      };
      yield {
        steps: [
          {
            type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
            status: 'FINISHED',
            plannerResponse: { response: 'Self-corrected after mixed errors.' },
          },
        ],
        cursor: { baselineStepCount: 2, lastDeliveredStepCount: 3, terminalSeen: true, lastActivityAt: Date.now() },
      };
    };
    const service = new AntigravityAgentService({ catId: 'antigravity', model: 'gemini-3.1-pro', bridge });
    const messages = await collect(service.invoke('hello'));

    const texts = messages.filter((m) => m.type === 'text');
    assert.equal(texts.length, 1, 'self-corrected text must survive when stream_error is noise');
    assert.equal(texts[0].content, 'Self-corrected after mixed errors.');
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
});
