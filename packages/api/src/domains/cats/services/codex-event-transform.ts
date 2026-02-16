import type { CatId } from '@cat-cafe/shared';
import type { AgentMessage } from './types.js';

/**
 * Mutable state for tracking Codex multi-turn text separation.
 * Each `item.completed` with `agent_message` is a complete turn;
 * without explicit separation, consecutive turns get concatenated
 * without paragraph breaks (unlike Claude's incremental deltas which
 * naturally include the model's own whitespace).
 */
export interface CodexStreamState {
  hadPriorTextTurn: boolean;
}

/**
 * Transform a raw Codex CLI NDJSON event into an AgentMessage.
 * Returns null to skip events we don't care about.
 *
 * When `state` is provided, consecutive agent_message text turns are
 * separated by `\n\n` to preserve paragraph breaks between turns.
 */
export function transformCodexEvent(
  event: unknown,
  catId: CatId,
  state?: CodexStreamState,
): AgentMessage | null {
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Record<string, unknown>;

  if (e['type'] === 'thread.started') {
    const threadId = e['thread_id'];
    if (typeof threadId !== 'string') return null;
    return {
      type: 'session_init',
      catId,
      sessionId: threadId,
      timestamp: Date.now(),
    };
  }

  if (e['type'] === 'item.started') {
    const item = e['item'] as Record<string, unknown> | undefined;
    if (item?.['type'] !== 'command_execution') return null;
    const command = item['command'];
    if (typeof command !== 'string') return null;
    return {
      type: 'tool_use',
      catId,
      toolName: 'command_execution',
      toolInput: { command },
      timestamp: Date.now(),
    };
  }

  if (e['type'] === 'error') {
    const message = e['message'];
    if (typeof message !== 'string') return null;
    const text = message.trim();
    if (!text.startsWith('Reconnecting...')) return null;
    return {
      type: 'system_info',
      catId,
      content: text,
      timestamp: Date.now(),
    };
  }

  if (e['type'] !== 'item.completed') {
    return null;
  }

  const item = e['item'] as Record<string, unknown> | undefined;
  if (item?.['type'] === 'agent_message' && typeof item['text'] === 'string') {
    const prefix = state?.hadPriorTextTurn ? '\n\n' : '';
    if (state) state.hadPriorTextTurn = true;
    return {
      type: 'text',
      catId,
      content: prefix + item['text'],
      timestamp: Date.now(),
    };
  }

  if (item?.['type'] === 'command_execution') {
    const command = typeof item['command'] === 'string' ? item['command'] : '';
    const status = typeof item['status'] === 'string' ? item['status'] : 'completed';
    const exitCode = typeof item['exit_code'] === 'number' ? item['exit_code'] : null;
    const output = typeof item['aggregated_output'] === 'string'
      ? item['aggregated_output']
      : '';

    const sections: string[] = [];
    if (command) sections.push(`command: ${command}`);
    sections.push(`status: ${status}`);
    if (exitCode !== null) sections.push(`exit_code: ${exitCode}`);
    const trimmedOutput = output.trimEnd();
    if (trimmedOutput) sections.push(trimmedOutput);

    return {
      type: 'tool_result',
      catId,
      content: sections.join('\n'),
      timestamp: Date.now(),
    };
  }

  if (item?.['type'] === 'file_change') {
    const changes = Array.isArray(item['changes']) ? item['changes'] : [];
    const status = typeof item['status'] === 'string' ? item['status'] : 'completed';
    return {
      type: 'tool_use',
      catId,
      toolName: 'file_change',
      toolInput: {
        status,
        changes: changes.length,
      },
      timestamp: Date.now(),
    };
  }

  return null;
}
