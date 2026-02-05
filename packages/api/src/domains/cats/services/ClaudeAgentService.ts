/**
 * Claude Agent Service
 * 使用 @anthropic-ai/claude-agent-sdk 调用布偶猫 (Opus)
 *
 * SDK API Notes:
 * - query({ prompt, options }) returns AsyncGenerator<SDKMessage>
 * - SDKSystemMessage (subtype: 'init') contains session_id
 * - SDKAssistantMessage contains message.content with text/tool_use blocks
 * - SDKResultMessage indicates completion (success or error)
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKMessage,
  SDKSystemMessage,
  SDKAssistantMessage,
  SDKResultMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { createCatId } from '@cat-cafe/shared';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
} from './types.js';

const CAT_ID = createCatId('opus');

/**
 * Type guard for SDKSystemMessage with init subtype
 */
function isInitMessage(msg: SDKMessage): msg is SDKSystemMessage {
  return msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init';
}

/**
 * Type guard for SDKAssistantMessage
 */
function isAssistantMessage(msg: SDKMessage): msg is SDKAssistantMessage {
  return msg.type === 'assistant';
}

/**
 * Type guard for SDKResultMessage
 */
function isResultMessage(msg: SDKMessage): msg is SDKResultMessage {
  return msg.type === 'result';
}

/**
 * Service for invoking Claude via the claude-agent-sdk
 */
export class ClaudeAgentService implements AgentService {
  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    try {
      // Build options object, conditionally spreading optional fields
      const stream = query({
        prompt,
        options: {
          model: 'claude-sonnet-4-5-20250929',
          allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          ...(options?.sessionId ? { resume: options.sessionId } : {}),
          ...(options?.workingDirectory ? { cwd: options.workingDirectory } : {}),
        },
      });

      for await (const event of stream) {
        // Handle init message - extract session ID
        if (isInitMessage(event)) {
          yield {
            type: 'session_init',
            catId: CAT_ID,
            sessionId: event.session_id,
            timestamp: Date.now(),
          };
          continue;
        }

        // Handle assistant messages - extract text and tool use
        if (isAssistantMessage(event)) {
          const content = event.message?.content;
          if (!content || !Array.isArray(content)) continue;

          for (const block of content) {
            if (block.type === 'text') {
              yield {
                type: 'text',
                catId: CAT_ID,
                content: block.text,
                timestamp: Date.now(),
              };
            } else if (block.type === 'tool_use') {
              yield {
                type: 'tool_use',
                catId: CAT_ID,
                toolName: block.name,
                toolInput: block.input as Record<string, unknown>,
                timestamp: Date.now(),
              };
            }
          }
          continue;
        }

        // Handle result message - indicates completion
        if (isResultMessage(event)) {
          if (event.subtype !== 'success') {
            // Error result
            const errors =
              'errors' in event && Array.isArray(event.errors)
                ? event.errors.join('; ')
                : 'Unknown error';
            yield {
              type: 'error',
              catId: CAT_ID,
              error: errors,
              timestamp: Date.now(),
            };
          }
          // Don't yield done here - let the loop end naturally
          continue;
        }

        // Other message types (tool_progress, stream_event, etc.) are ignored
        // for now - we can add them later if needed
      }

      yield {
        type: 'done',
        catId: CAT_ID,
        timestamp: Date.now(),
      };
    } catch (err) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      };
    }
  }
}
