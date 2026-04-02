/**
 * ACP Event Transformer — maps AcpSessionUpdate → AgentMessage.
 *
 * Pure function, no side effects. Used by GeminiAcpAdapter to convert
 * ACP protocol events into the unified AgentMessage stream format.
 */

import type { CatId } from '@cat-cafe/shared';
import type { AgentMessage, MessageMetadata } from '../../../types.js';
import type { AcpSessionUpdate } from './types.js';

export function transformAcpEvent(
  update: AcpSessionUpdate,
  catId: CatId,
  metadata: MessageMetadata,
): AgentMessage | null {
  const { sessionUpdate, content, toolName, toolInput } = update.update as {
    sessionUpdate: string;
    content?: { type: string; text?: string };
    toolName?: string;
    toolInput?: Record<string, unknown>;
  };
  const now = Date.now();

  switch (sessionUpdate) {
    case 'agent_message_chunk':
      return {
        type: 'text',
        catId,
        content: content?.text ?? '',
        metadata,
        timestamp: now,
      };

    case 'agent_thought_chunk':
      return {
        type: 'system_info',
        catId,
        content: JSON.stringify({ type: 'thinking', text: content?.text ?? '' }),
        metadata,
        timestamp: now,
      };

    case 'tool_call':
      return {
        type: 'tool_use',
        catId,
        toolName,
        toolInput,
        metadata,
        timestamp: now,
      };

    case 'tool_call_update':
      return {
        type: 'tool_use',
        catId,
        toolName,
        content: content?.text,
        metadata,
        timestamp: now,
      };

    case 'plan':
      return {
        type: 'system_info',
        catId,
        content: JSON.stringify({ type: 'plan', text: content?.text ?? '' }),
        metadata,
        timestamp: now,
      };

    case 'user_message_chunk':
      return null;

    default:
      return null;
  }
}
