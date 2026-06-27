/**
 * F252 Phase A — Adapter Tool Pairing & Regression Tests
 *
 * Orphan/positional pairing, mixed event sequences, and cloud review regressions.
 * Core adapter tests (message types, tool names, id-based pairing) are in adapter.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { adaptTranscriptEvents } from '../adapter';
import type { RawTranscriptEvent } from '../types';

// ---------------------------------------------------------------------------
// Helpers (shared with adapter.test.ts)
// ---------------------------------------------------------------------------

function makeEvent(
  eventNo: number,
  t: number,
  event: Record<string, unknown>,
  overrides: Partial<RawTranscriptEvent> = {},
): RawTranscriptEvent {
  return {
    v: 1,
    t,
    threadId: 'thread-1',
    catId: 'opus',
    sessionId: 'session-1',
    cliSessionId: 'cli-1',
    eventNo,
    event,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Orphan tool pairing (no toolUseId — Codex command_execution)
// ---------------------------------------------------------------------------

describe('F252 adapter — orphan tool pairing (no toolUseId)', () => {
  it('pairs tool_use and tool_result without toolUseId via positional pairing', () => {
    const events = [
      makeEvent(1, 1000, {
        type: 'tool_use',
        toolName: 'command_execution',
        toolInput: { command: 'ls -la' },
      }),
      makeEvent(2, 2000, {
        type: 'tool_result',
        content: 'file1.ts\nfile2.ts',
      }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('tool_call');
    expect(result[0]?.toolName).toBe('command_execution');
    expect(result[0]?.toolResult).toBe('file1.ts\nfile2.ts');
    expect(result[0]?.toolIsError).toBe(false);
  });

  it('pairs multiple no-id tool events in positional order', () => {
    const events = [
      makeEvent(1, 1000, { type: 'tool_use', toolName: 'command_execution', toolInput: { command: 'pwd' } }),
      makeEvent(2, 1500, { type: 'tool_result', content: '/home/user' }),
      makeEvent(3, 2000, { type: 'tool_use', toolName: 'command_execution', toolInput: { command: 'whoami' } }),
      makeEvent(4, 2500, { type: 'tool_result', content: 'root' }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(2);
    expect(result[0]?.toolResult).toBe('/home/user');
    expect(result[1]?.toolResult).toBe('root');
  });

  it('does not cross-contaminate id-based and orphan pairing', () => {
    const events = [
      makeEvent(1, 1000, { type: 'tool_use', toolName: 'Read', input: '{}', toolUseId: 'tu-1' }),
      makeEvent(2, 1500, { type: 'tool_result', toolUseId: 'tu-1', content: 'id-matched result' }),
      makeEvent(3, 2000, { type: 'tool_use', toolName: 'command_execution', toolInput: { command: 'ls' } }),
      makeEvent(4, 2500, { type: 'tool_result', content: 'orphan result' }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(2);
    expect(result[0]?.toolResult).toBe('id-matched result');
    expect(result[1]?.toolResult).toBe('orphan result');
  });
});

// ---------------------------------------------------------------------------
// Mixed event sequence
// ---------------------------------------------------------------------------

describe('F252 adapter — mixed event sequence', () => {
  it('handles interleaved messages, tool calls, and system events', () => {
    const events = [
      makeEvent(1, 1000, { type: 'session_init' }),
      makeEvent(2, 1100, { type: 'user', content: 'Fix the bug' }),
      makeEvent(3, 1200, { type: 'assistant', content: 'Looking at the code...' }),
      makeEvent(4, 1300, { type: 'tool_use', toolName: 'Read', input: '{}', toolUseId: 'tu-1' }),
      makeEvent(5, 1800, { type: 'tool_result', toolUseId: 'tu-1', content: 'code here' }),
      makeEvent(6, 2000, { type: 'assistant', content: 'Found it!' }),
      makeEvent(7, 2100, { type: 'done' }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(6);
    expect(result.map((r) => r.type)).toEqual([
      'system', // session_init
      'message', // user
      'message', // assistant
      'tool_call', // tool_use + tool_result paired
      'message', // assistant
      'system', // done
    ]);
  });

  it('assigns monotonic indexes', () => {
    const events = [
      makeEvent(5, 1000, { type: 'user', content: 'Hi' }),
      makeEvent(10, 2000, { type: 'assistant', content: 'Hello' }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result[0]?.index).toBe(0);
    expect(result[1]?.index).toBe(1);
  });

  it('preserves catId and invocationId', () => {
    const events = [
      makeEvent(1, 1000, { type: 'assistant', content: 'Hi' }, { catId: 'codex', invocationId: 'inv-42' }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result[0]?.catId).toBe('codex');
    expect(result[0]?.invocationId).toBe('inv-42');
  });

  it('skips unknown event types gracefully', () => {
    const events = [
      makeEvent(1, 1000, { type: 'unknown_weird_type', data: 'something' }),
      makeEvent(2, 1100, { type: 'assistant', content: 'Normal message' }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBe('Normal message');
  });

  it('extracts content from content array (Claude API format)', () => {
    const events = [
      makeEvent(1, 1000, {
        type: 'assistant',
        content: [{ type: 'text', text: 'Complex content format' }],
      }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result[0]?.content).toBe('Complex content format');
  });
});

// ---------------------------------------------------------------------------
// Cloud R2: positional orphan pairing (file_change mis-pair)
// ---------------------------------------------------------------------------

describe('F252 adapter — positional orphan pairing (cloud R2)', () => {
  it('does not pair file_change (no result) with next command result', () => {
    const events = [
      makeEvent(1, 1000, {
        type: 'tool_use',
        toolName: 'file_change',
        toolInput: { status: 'completed', changes: [] },
      }),
      makeEvent(2, 2000, {
        type: 'tool_use',
        toolName: 'command_execution',
        toolInput: { command: 'npm test' },
      }),
      makeEvent(3, 3000, {
        type: 'tool_result',
        content: 'Tests passed',
      }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(2);
    expect(result[0]?.toolName).toBe('file_change');
    expect(result[0]?.toolResult).toBeUndefined();
    expect(result[1]?.toolName).toBe('command_execution');
    expect(result[1]?.toolResult).toBe('Tests passed');
  });

  it('pairs consecutive no-id tool_use events with their positionally adjacent results', () => {
    const events = [
      makeEvent(1, 1000, { type: 'tool_use', toolName: 'command_execution', toolInput: { command: 'pwd' } }),
      makeEvent(2, 1500, { type: 'tool_result', content: '/home/user' }),
      makeEvent(3, 2000, { type: 'tool_use', toolName: 'file_change', toolInput: { status: 'completed' } }),
      makeEvent(4, 3000, { type: 'tool_use', toolName: 'command_execution', toolInput: { command: 'ls' } }),
      makeEvent(5, 3500, { type: 'tool_result', content: 'file1.ts' }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(3);
    expect(result[0]?.toolResult).toBe('/home/user');
    expect(result[1]?.toolResult).toBeUndefined();
    expect(result[2]?.toolResult).toBe('file1.ts');
  });
});

// ---------------------------------------------------------------------------
// Cross-session orphan pairing isolation (P1 — AC-E2 thread replay)
// ---------------------------------------------------------------------------

describe('F252 adapter — cross-session orphan pairing (P1 fix)', () => {
  it('scopes no-id orphan pairing by sessionId — interleaved sessions do not mis-pair', () => {
    // Scenario: two sessions interleaved by timestamp after mergeSessionEvents
    // Session A: tool_use(Bash) at t=1000, then tool_result at t=2000
    // Session B: tool_use(Read) at t=1500 (between A's use and result)
    //            then tool_result at t=2500
    // Bug: single pendingEventNo → B's tool_use supersedes A's,
    //       A's result pairs with B's tool_use (wrong session)
    const events = [
      makeEvent(
        0,
        1000,
        { type: 'tool_use', toolName: 'Bash', toolInput: { command: 'echo a' } },
        { sessionId: 'session-a' },
      ),
      makeEvent(
        1,
        1500,
        { type: 'tool_use', toolName: 'Read', toolInput: { path: '/b.ts' } },
        { sessionId: 'session-b' },
      ),
      makeEvent(2, 2000, { type: 'tool_result', content: 'output-from-a' }, { sessionId: 'session-a' }),
      makeEvent(3, 2500, { type: 'tool_result', content: 'file-content-b' }, { sessionId: 'session-b' }),
    ];
    const result = adaptTranscriptEvents(events);

    const toolCalls = result.filter((e) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(2);

    // Session A's Bash should get session A's result
    expect(toolCalls[0]?.toolName).toBe('Bash');
    expect(toolCalls[0]?.toolResult).toBe('output-from-a');

    // Session B's Read should get session B's result
    expect(toolCalls[1]?.toolName).toBe('Read');
    expect(toolCalls[1]?.toolResult).toBe('file-content-b');
  });

  it('still pairs within same session when events are sequential', () => {
    // Single-session case should not regress
    const events = [
      makeEvent(0, 1000, { type: 'tool_use', toolName: 'Bash', toolInput: { command: 'pwd' } }),
      makeEvent(1, 2000, { type: 'tool_result', content: '/home' }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0]?.toolResult).toBe('/home');
  });
});

// ---------------------------------------------------------------------------
// Cross-session id-based pairing isolation (P1 — cloud R3)
// ---------------------------------------------------------------------------

describe('F252 adapter — cross-session id-based pairing (cloud R3 P1)', () => {
  it('scopes toolUseId pairing by sessionId — AGY run-command-N collisions do not mis-pair', () => {
    // Scenario: Two AGY sessions both generate toolUseId "run-command-0"
    // (AGY trajectory extractor produces `run-command-${idx}`, sequential per session).
    // Without session scoping, the second session's tool_result overwrites the first
    // in the flat Map, so session A's tool_use replays with session B's output.
    const events = [
      // Session A: run-command-0
      makeEvent(0, 1000, {
        type: 'tool_use', toolName: 'run_command', toolUseId: 'run-command-0',
        toolInput: { CommandLine: 'echo session-a' },
      }, { sessionId: 'session-a' }),
      makeEvent(1, 1500, {
        type: 'tool_result', toolUseId: 'run-command-0',
        content: 'session-a-output',
      }, { sessionId: 'session-a' }),
      // Session B: also run-command-0 (colliding ID!)
      makeEvent(2, 2000, {
        type: 'tool_use', toolName: 'run_command', toolUseId: 'run-command-0',
        toolInput: { CommandLine: 'echo session-b' },
      }, { sessionId: 'session-b' }),
      makeEvent(3, 2500, {
        type: 'tool_result', toolUseId: 'run-command-0',
        content: 'session-b-output',
      }, { sessionId: 'session-b' }),
    ];
    const result = adaptTranscriptEvents(events);

    const toolCalls = result.filter((e) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(2);

    // Session A's tool_use should pair with session A's tool_result
    expect(toolCalls[0]?.toolResult).toBe('session-a-output');
    // Session B's tool_use should pair with session B's tool_result
    expect(toolCalls[1]?.toolResult).toBe('session-b-output');
  });

  it('still pairs by toolUseId within same session (no regression)', () => {
    const events = [
      makeEvent(0, 1000, {
        type: 'tool_use', toolName: 'Read', toolUseId: 'toolu_abc',
        input: '{"path":"/a.ts"}',
      }),
      makeEvent(1, 2000, {
        type: 'tool_result', toolUseId: 'toolu_abc',
        content: 'file content',
      }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0]?.toolResult).toBe('file content');
  });

  it('handles three sessions with identical toolUseIds (run-command-0, run-command-1)', () => {
    const events = [
      // Session A: run-command-0, run-command-1
      makeEvent(0, 1000, { type: 'tool_use', toolName: 'run_command', toolUseId: 'run-command-0', toolInput: {} }, { sessionId: 'sa' }),
      makeEvent(1, 1100, { type: 'tool_result', toolUseId: 'run-command-0', content: 'a0' }, { sessionId: 'sa' }),
      makeEvent(2, 1200, { type: 'tool_use', toolName: 'run_command', toolUseId: 'run-command-1', toolInput: {} }, { sessionId: 'sa' }),
      makeEvent(3, 1300, { type: 'tool_result', toolUseId: 'run-command-1', content: 'a1' }, { sessionId: 'sa' }),
      // Session B: run-command-0, run-command-1
      makeEvent(4, 2000, { type: 'tool_use', toolName: 'run_command', toolUseId: 'run-command-0', toolInput: {} }, { sessionId: 'sb' }),
      makeEvent(5, 2100, { type: 'tool_result', toolUseId: 'run-command-0', content: 'b0' }, { sessionId: 'sb' }),
      makeEvent(6, 2200, { type: 'tool_use', toolName: 'run_command', toolUseId: 'run-command-1', toolInput: {} }, { sessionId: 'sb' }),
      makeEvent(7, 2300, { type: 'tool_result', toolUseId: 'run-command-1', content: 'b1' }, { sessionId: 'sb' }),
      // Session C: run-command-0
      makeEvent(8, 3000, { type: 'tool_use', toolName: 'run_command', toolUseId: 'run-command-0', toolInput: {} }, { sessionId: 'sc' }),
      makeEvent(9, 3100, { type: 'tool_result', toolUseId: 'run-command-0', content: 'c0' }, { sessionId: 'sc' }),
    ];
    const result = adaptTranscriptEvents(events);

    const toolCalls = result.filter((e) => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(5);
    expect(toolCalls.map((tc) => tc.toolResult)).toEqual(['a0', 'a1', 'b0', 'b1', 'c0']);
  });
});

// ---------------------------------------------------------------------------
// Cloud R1: system_info thinking events (P2-1)
// ---------------------------------------------------------------------------

describe('F252 adapter — system_info thinking events (cloud P2-1)', () => {
  it('extracts thinking from system_info with JSON { type: "thinking" } content', () => {
    const events = [
      makeEvent(1, 1000, {
        type: 'system_info',
        content: JSON.stringify({ type: 'thinking', catId: 'opus', text: 'Let me analyze...' }),
      }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'thinking',
      role: 'assistant',
      content: 'Let me analyze...',
    });
  });

  it('treats non-thinking system_info as system event', () => {
    const events = [
      makeEvent(1, 1000, {
        type: 'system_info',
        content: JSON.stringify({ type: 'rate_limit', message: 'throttled' }),
      }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'system', role: 'system' });
  });

  it('treats system_info with non-JSON content as system event', () => {
    const events = [makeEvent(1, 1000, { type: 'system_info', content: 'plain text info' })];
    const result = adaptTranscriptEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'system', role: 'system' });
  });
});

// ---------------------------------------------------------------------------
// Cloud R1: toolResultStatus error (P2-2)
// ---------------------------------------------------------------------------

describe('F252 adapter — toolResultStatus error detection (cloud P2-2)', () => {
  it('detects toolResultStatus="error" as tool error', () => {
    const events = [
      makeEvent(1, 1000, { type: 'tool_use', toolName: 'Bash', input: '{}', toolUseId: 'tu-1' }),
      makeEvent(2, 2000, {
        type: 'tool_result',
        toolUseId: 'tu-1',
        content: 'Error: command failed',
        toolResultStatus: 'error',
      }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result[0]?.toolIsError).toBe(true);
  });

  it('detects status="error" as tool error (legacy variant)', () => {
    const events = [
      makeEvent(1, 1000, { type: 'tool_use', toolName: 'Read', input: '{}', toolUseId: 'tu-1' }),
      makeEvent(2, 1500, {
        type: 'tool_result',
        toolUseId: 'tu-1',
        content: 'Not found',
        status: 'error',
      }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result[0]?.toolIsError).toBe(true);
  });

  it('treats toolResultStatus="ok" as non-error', () => {
    const events = [
      makeEvent(1, 1000, { type: 'tool_use', toolName: 'Bash', input: '{}', toolUseId: 'tu-1' }),
      makeEvent(2, 1500, {
        type: 'tool_result',
        toolUseId: 'tu-1',
        content: 'success output',
        toolResultStatus: 'ok',
      }),
    ];
    const result = adaptTranscriptEvents(events);

    expect(result[0]?.toolIsError).toBe(false);
  });
});
