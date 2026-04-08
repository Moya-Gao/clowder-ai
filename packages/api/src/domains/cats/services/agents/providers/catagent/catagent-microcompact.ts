/**
 * CatAgent MicroCompact — F152: Thin Agent Runtime
 *
 * Lightweight context compression inspired by Claude Code's microcompact.
 * Strips old tool results from message history to control token growth.
 *
 * Strategy: keep the last N turns of tool results intact, replace older ones
 * with a short summary marker. System prompt is rebuilt per turn (not in messages).
 */

import type Anthropic from '@anthropic-ai/sdk';

type MessageParam = Anthropic.Messages.MessageParam;
type ContentBlockParam = Anthropic.Messages.ContentBlockParam;
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

/** How many recent turns of tool results to keep intact */
const KEEP_RECENT_TURNS = 3;
/** Max characters for a tool result before truncation in kept turns */
const MAX_RESULT_CHARS = 10_000;

/**
 * Strip old tool results from message history.
 * Keeps the last KEEP_RECENT_TURNS user messages with tool results intact.
 * Older tool results are replaced with a short placeholder.
 */
export function microcompact(messages: MessageParam[]): MessageParam[] {
  // Find indices of user messages that contain tool_result blocks
  const toolResultIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (hasToolResults(messages[i])) toolResultIndices.push(i);
  }

  // If few enough tool result turns, no compaction needed
  if (toolResultIndices.length <= KEEP_RECENT_TURNS) return messages;

  const cutoffIdx = toolResultIndices[toolResultIndices.length - KEEP_RECENT_TURNS];
  return messages.map((msg, i) => {
    if (i >= cutoffIdx || !hasToolResults(msg)) return msg;
    return compactToolResults(msg);
  });
}

function hasToolResults(msg: MessageParam): boolean {
  if (msg.role !== 'user' || typeof msg.content === 'string') return false;
  return (msg.content as ContentBlockParam[]).some((b) => b.type === 'tool_result');
}

function compactToolResults(msg: MessageParam): MessageParam {
  if (msg.role !== 'user' || typeof msg.content === 'string') return msg;
  const blocks = (msg.content as ContentBlockParam[]).map((block) => {
    if (block.type !== 'tool_result') return block;
    const tb = block as ToolResultBlockParam;
    return {
      ...tb,
      content: typeof tb.content === 'string' ? '[compacted — see recent results]' : tb.content,
    } satisfies ToolResultBlockParam;
  });
  return { ...msg, content: blocks };
}

/** Truncate a tool result if it exceeds the max length (for kept turns) */
export function truncateToolResult(content: string): string {
  if (content.length <= MAX_RESULT_CHARS) return content;
  return `${content.slice(0, MAX_RESULT_CHARS)}\n... (truncated ${content.length - MAX_RESULT_CHARS} chars)`;
}
