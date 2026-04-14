import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  classifyStep,
  transformTrajectorySteps,
} from '../dist/domains/cats/services/agents/providers/antigravity/antigravity-event-transformer.js';

const catId = 'antigravity';
const metadata = { provider: 'antigravity', model: 'gemini-3.1-pro' };

// ── P2: MCP_TOOL / CHECKPOINT / EPHEMERAL_MESSAGE mapping ─────────

describe('classifyStep: MCP_TOOL / CHECKPOINT / EPHEMERAL_MESSAGE', () => {
  test('MCP_TOOL → tool_pending', () => {
    const step = {
      type: 'CORTEX_STEP_TYPE_MCP_TOOL',
      status: 'IN_PROGRESS',
      toolCall: { toolName: 'read_file', input: '{"path":"src/index.ts"}' },
    };
    assert.equal(classifyStep(step), 'tool_pending');
  });

  test('MCP_TOOL with failed toolResult → tool_error', () => {
    const step = {
      type: 'CORTEX_STEP_TYPE_MCP_TOOL',
      status: 'FINISHED',
      toolResult: { toolName: 'write_file', success: false, error: 'permission denied' },
    };
    assert.equal(classifyStep(step), 'tool_error');
  });

  test('CHECKPOINT → checkpoint (silently skipped)', () => {
    const step = { type: 'CORTEX_STEP_TYPE_CHECKPOINT', status: 'CORTEX_STEP_STATUS_DONE' };
    assert.equal(classifyStep(step), 'checkpoint');
  });

  test('EPHEMERAL_MESSAGE → checkpoint (silently skipped)', () => {
    const step = { type: 'CORTEX_STEP_TYPE_EPHEMERAL_MESSAGE', status: 'IN_PROGRESS' };
    assert.equal(classifyStep(step), 'checkpoint');
  });
});

describe('transformer: MCP_TOOL', () => {
  test('MCP_TOOL with toolCall emits tool_use', () => {
    const steps = [
      {
        type: 'CORTEX_STEP_TYPE_MCP_TOOL',
        status: 'IN_PROGRESS',
        toolCall: { toolName: 'read_file', input: '{"path":"src/index.ts"}' },
      },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    const toolMsg = msgs.find((m) => m.type === 'tool_use');
    assert.ok(toolMsg, 'should emit tool_use for MCP_TOOL');
    assert.equal(toolMsg.toolName, 'read_file');
  });

  test('MCP_TOOL with toolResult emits tool_result', () => {
    const steps = [
      {
        type: 'CORTEX_STEP_TYPE_MCP_TOOL',
        status: 'FINISHED',
        toolResult: { toolName: 'read_file', success: true, output: 'file contents here' },
      },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    const resultMsg = msgs.find((m) => m.type === 'tool_result');
    assert.ok(resultMsg, 'should emit tool_result for MCP_TOOL');
    assert.equal(resultMsg.content, 'file contents here');
  });

  test('MCP_TOOL failure emits error', () => {
    const steps = [
      {
        type: 'CORTEX_STEP_TYPE_MCP_TOOL',
        status: 'FINISHED',
        toolResult: { toolName: 'write_file', success: false, error: 'permission denied' },
      },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    const errMsg = msgs.find((m) => m.type === 'error');
    assert.ok(errMsg, 'should emit error for failed MCP_TOOL');
    assert.match(errMsg.error, /write_file.*permission denied/);
  });
});

describe('transformer: CHECKPOINT and EPHEMERAL_MESSAGE', () => {
  test('CHECKPOINT emits no messages', () => {
    const steps = [{ type: 'CORTEX_STEP_TYPE_CHECKPOINT', status: 'CORTEX_STEP_STATUS_DONE' }];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    assert.equal(msgs.length, 0, 'checkpoint should produce no output');
  });

  test('EPHEMERAL_MESSAGE emits no messages', () => {
    const steps = [{ type: 'CORTEX_STEP_TYPE_EPHEMERAL_MESSAGE', status: 'IN_PROGRESS' }];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    assert.equal(msgs.length, 0, 'ephemeral message should produce no output');
  });

  test('CHECKPOINT mixed with real output does not leak JSON', () => {
    const steps = [
      { type: 'CORTEX_STEP_TYPE_CHECKPOINT', status: 'CORTEX_STEP_STATUS_DONE' },
      {
        type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE',
        status: 'CORTEX_STEP_STATUS_DONE',
        plannerResponse: { response: 'Hello!' },
      },
      { type: 'CORTEX_STEP_TYPE_EPHEMERAL_MESSAGE', status: 'IN_PROGRESS' },
    ];
    const msgs = transformTrajectorySteps(steps, catId, metadata);
    const textMsgs = msgs.filter((m) => m.type === 'text');
    assert.equal(textMsgs.length, 1);
    assert.equal(textMsgs[0].content, 'Hello!');
    const unknowns = msgs.filter((m) => {
      if (m.type !== 'system_info') return false;
      const c = JSON.parse(m.content);
      return c.type === 'unknown_activity';
    });
    assert.equal(unknowns.length, 0, 'no unknown_activity should leak');
  });
});
