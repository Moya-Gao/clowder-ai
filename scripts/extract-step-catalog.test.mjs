import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

function runExtractor(logLines) {
  const input = logLines.map((l) => JSON.stringify(l)).join('\n');
  const out = execFileSync('node', ['scripts/extract-step-catalog.mjs'], { input, encoding: 'utf8' });
  return JSON.parse(out);
}

test('extracts steps from GetCascadeTrajectory (payload.trajectory.steps)', () => {
  const result = runExtractor([
    {
      level: 30,
      module: 'antigravity-trace',
      msg: 'rpc raw response',
      method: 'GetCascadeTrajectory',
      raw: JSON.stringify({
        status: 'CASCADE_RUN_STATUS_IDLE',
        numTotalSteps: 1,
        trajectory: {
          steps: [{ type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', status: 'DONE', plannerResponse: { response: 'hi' } }],
        },
      }),
    },
  ]);
  assert.equal(result.summary.stepsExtracted, 1);
  assert.ok(result.stepTypes['CORTEX_STEP_TYPE_PLANNER_RESPONSE']);
});

test('extracts steps from GetCascadeTrajectorySteps (payload.steps)', () => {
  const result = runExtractor([
    {
      level: 30,
      module: 'antigravity-trace',
      msg: 'rpc raw response',
      method: 'GetCascadeTrajectorySteps',
      raw: JSON.stringify({
        steps: [
          { type: 'CORTEX_STEP_TYPE_TOOL_CALL', status: 'DONE', toolCall: { toolName: 'grep' } },
          { type: 'CORTEX_STEP_TYPE_TOOL_RESULT', status: 'DONE', toolResult: { success: true } },
        ],
      }),
    },
  ]);
  assert.equal(result.summary.stepsExtracted, 2);
  assert.ok(result.stepTypes['CORTEX_STEP_TYPE_TOOL_CALL']);
  assert.ok(result.stepTypes['CORTEX_STEP_TYPE_TOOL_RESULT']);
});

test('merges catalog across both RPC shapes', () => {
  const result = runExtractor([
    {
      level: 30,
      module: 'antigravity-trace',
      msg: 'rpc raw response',
      method: 'GetCascadeTrajectory',
      raw: JSON.stringify({ trajectory: { steps: [{ type: 'TYPE_A', status: 'S1' }] } }),
    },
    {
      level: 30,
      module: 'antigravity-trace',
      msg: 'rpc raw response',
      method: 'GetCascadeTrajectorySteps',
      raw: JSON.stringify({
        steps: [
          { type: 'TYPE_A', status: 'S2' },
          { type: 'TYPE_B', status: 'S1' },
        ],
      }),
    },
  ]);
  assert.equal(result.summary.stepsExtracted, 3);
  assert.equal(result.summary.uniqueStepTypes, 2);
  assert.deepStrictEqual(result.stepTypes['TYPE_A'].statuses.sort(), ['S1', 'S2']);
  assert.equal(result.stepTypes['TYPE_A'].count, 2);
  assert.ok(result.stepTypes['TYPE_B']);
});
