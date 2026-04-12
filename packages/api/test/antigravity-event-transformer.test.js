import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { transformTrajectorySteps } from '../dist/domains/cats/services/agents/providers/antigravity/antigravity-event-transformer.js';

const catId = 'antigravity';
const metadata = { provider: 'antigravity', model: 'gemini-3.1-pro' };

describe('transformTrajectorySteps', () => {
  test('extracts text from PLANNER_RESPONSE', () => {
    const steps = [
      { type: 'CORTEX_STEP_TYPE_USER_INPUT', status: 'CORTEX_STEP_STATUS_DONE' },
      {
        type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
        status: 'CORTEX_STEP_STATUS_DONE',
        plannerResponse: { response: 'meow from bengal' },
      },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].type, 'text');
    assert.equal(msgs[0].content, 'meow from bengal');
    assert.equal(msgs[0].catId, catId);
  });

  test('prefers modifiedResponse over response', () => {
    const steps = [
      {
        type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
        status: 'CORTEX_STEP_STATUS_DONE',
        plannerResponse: { response: 'original', modifiedResponse: 'modified' },
      },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    assert.equal(msgs[0].content, 'modified');
  });

  test('emits thinking as system_info before text', () => {
    const steps = [
      {
        type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
        status: 'CORTEX_STEP_STATUS_DONE',
        plannerResponse: { response: 'hello', thinking: 'I should say hello' },
      },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].type, 'system_info');
    assert.ok(msgs[0].content.includes('thinking'));
    assert.equal(msgs[1].type, 'text');
    assert.equal(msgs[1].content, 'hello');
  });

  test('emits error from ERROR_MESSAGE step', () => {
    const steps = [
      {
        type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
        status: 'CORTEX_STEP_STATUS_DONE',
        errorMessage: { error: { userErrorMessage: 'Agent execution terminated' } },
      },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].type, 'error');
    assert.ok(msgs[0].error.includes('terminated'));
  });

  test('emits stream_error when stopReason is CLIENT_STREAM_ERROR and no text', () => {
    const steps = [
      {
        type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
        status: 'CORTEX_STEP_STATUS_DONE',
        plannerResponse: { stopReason: 'STOP_REASON_CLIENT_STREAM_ERROR' },
      },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].type, 'error');
    assert.equal(msgs[0].errorCode, 'stream_error');
  });

  test('returns empty array for steps without response or error', () => {
    const steps = [
      { type: 'CORTEX_STEP_TYPE_USER_INPUT', status: 'CORTEX_STEP_STATUS_DONE' },
      { type: 'CORTEX_STEP_TYPE_CONVERSATION_HISTORY', status: 'CORTEX_STEP_STATUS_DONE' },
      { type: 'CORTEX_STEP_TYPE_CHECKPOINT', status: 'CORTEX_STEP_STATUS_DONE' },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    assert.equal(msgs.length, 0);
  });

  test('handles combined PLANNER_RESPONSE + ERROR_MESSAGE', () => {
    const steps = [
      {
        type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
        status: 'CORTEX_STEP_STATUS_DONE',
        plannerResponse: { stopReason: 'STOP_REASON_CLIENT_STREAM_ERROR' },
      },
      {
        type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
        status: 'CORTEX_STEP_STATUS_DONE',
        errorMessage: { error: { modelErrorMessage: 'INVALID_ARGUMENT (code 400)' } },
      },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].type, 'error');
    assert.equal(msgs[0].errorCode, 'stream_error');
    assert.equal(msgs[1].type, 'error');
    assert.ok(msgs[1].error.includes('INVALID_ARGUMENT'));
  });
});
