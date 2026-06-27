/**
 * F252 Phase E — ReplayEvent → ChatMessage Bridge
 *
 * Maps the replay engine's ReplayEvent into a ChatMessage-compatible shape
 * that Hub components (MessageBubble, ThinkingContent, CliOutputBlock) can render.
 *
 * This is a pure function (INV-6: referential transparency, INV-7: total mapping).
 * No state, no side effects.
 */

import type { ReplayEvent } from './types';

// ---------------------------------------------------------------------------
// Output type — subset of ChatMessage that Hub rendering components need
// ---------------------------------------------------------------------------

export interface ReplayChatMessage {
  /** Unique id for React key + MessageBubble */
  id: string;
  /** ChatMessage-compatible type */
  type: 'user' | 'assistant' | 'system';
  /** Text content */
  content: string;
  /** Original timestamp (epoch ms) */
  timestamp: number;
  /** Cat actor ID (for avatar rendering) */
  catId?: string;
  /** Invocation grouping (for session boundary display) */
  invocationId?: string;
  /** Always false — replayed events are never streaming */
  isStreaming: false;
  /** Tool call events (for CliOutputBlock rendering) */
  toolEvents?: Array<{
    id: string;
    name: string;
    input?: string;
    output?: string;
    isError?: boolean;
    status: 'completed' | 'error';
  }>;
  /** Extended thinking content (for ThinkingContent rendering) */
  thinking?: string;
}

// ---------------------------------------------------------------------------
// Role → ChatMessage type mapping
// ---------------------------------------------------------------------------

const ROLE_TO_TYPE: Record<string, ReplayChatMessage['type']> = {
  user: 'user',
  assistant: 'assistant',
  system: 'system',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Bridge a ReplayEvent into a ChatMessage-compatible shape for Hub rendering.
 *
 * Invariants:
 * - INV-6: Same input → same output (pure function)
 * - INV-7: All ReplayEvent.type values produce a valid result (total function)
 */
export function bridgeReplayEvent(event: ReplayEvent): ReplayChatMessage {
  const base: Pick<ReplayChatMessage, 'id' | 'timestamp' | 'catId' | 'invocationId' | 'isStreaming'> = {
    id: `replay_${event.index}`,
    timestamp: event.timestamp,
    catId: event.catId,
    invocationId: event.invocationId,
    isStreaming: false,
  };

  switch (event.type) {
    case 'message':
      return {
        ...base,
        type: ROLE_TO_TYPE[event.role] ?? 'system',
        content: event.content,
      };

    case 'tool_call':
      return {
        ...base,
        type: 'assistant',
        content: '',
        toolEvents: [
          {
            id: `tool_${event.index}`,
            name: event.toolName ?? 'unknown',
            input: event.toolInput,
            output: event.toolResult,
            isError: event.toolIsError,
            status: event.toolIsError ? 'error' : 'completed',
          },
        ],
      };

    case 'thinking':
      return {
        ...base,
        type: 'assistant',
        content: '',
        thinking: event.content,
      };

    case 'system':
      return {
        ...base,
        type: 'system',
        content: event.content,
      };
  }
}
