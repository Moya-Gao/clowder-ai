/**
 * F097: toCliEvents adapter — converts ToolEvent[] + stream content → CliEvent[]
 */
import { describe, expect, it } from 'vitest';
import type { ToolEvent } from '@/stores/chat-types';
import { toCliEvents } from '../cli-output/toCliEvents';

describe('toCliEvents', () => {
  it('converts toolEvents to CliEvent[]', () => {
    const tools: ToolEvent[] = [
      { id: 't1', type: 'tool_use', label: 'Read index.ts', timestamp: 1000 },
      { id: 't2', type: 'tool_result', label: 'Read index.ts', detail: 'ok', timestamp: 1001 },
    ];
    const result = toCliEvents(tools);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 't1', kind: 'tool_use', label: 'Read index.ts' });
    expect(result[1]).toMatchObject({ id: 't2', kind: 'tool_result', detail: 'ok' });
  });

  it('returns empty array when no tools', () => {
    expect(toCliEvents([])).toEqual([]);
    expect(toCliEvents(undefined)).toEqual([]);
  });

  it('deduplicates tool count (only tool_use events)', () => {
    const tools: ToolEvent[] = [
      { id: 't1', type: 'tool_use', label: 'Read foo.ts', timestamp: 1000 },
      { id: 't2', type: 'tool_result', label: 'Read foo.ts', detail: 'ok', timestamp: 1001 },
      { id: 't3', type: 'tool_use', label: 'Edit bar.ts', timestamp: 1002 },
      { id: 't4', type: 'tool_result', label: 'Edit bar.ts', detail: 'ok', timestamp: 1003 },
    ];
    const result = toCliEvents(tools);
    const toolUseCount = result.filter((e) => e.kind === 'tool_use').length;
    expect(toolUseCount).toBe(2);
    expect(result).toHaveLength(4);
  });
});
