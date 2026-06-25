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
