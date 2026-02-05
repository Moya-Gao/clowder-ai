/**
 * Codex Agent Service
 * 使用 @openai/codex-sdk 调用缅因猫 (Codex)
 *
 * SDK API Notes:
 * - Codex.startThread(options) returns Thread
 * - Codex.resumeThread(id, options) resumes existing thread
 * - thread.runStreamed(input) returns { events: AsyncGenerator<ThreadEvent> }
 * - ThreadEvent types: thread.started, turn.started, item.completed, turn.completed, etc.
 */

import { Codex, type ThreadEvent } from '@openai/codex-sdk';
import { createCatId } from '@cat-cafe/shared';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
} from './types.js';

const CAT_ID = createCatId('codex');

/**
 * Interface for Codex SDK (for dependency injection)
 */
interface CodexLike {
  startThread(options?: { workingDirectory?: string }): ThreadLike;
  resumeThread(id: string, options?: { workingDirectory?: string }): ThreadLike;
}

interface ThreadLike {
  runStreamed(input: string): Promise<{ events: AsyncGenerator<ThreadEvent> }>;
}

/**
 * Options for CodexAgentService constructor
 */
interface CodexAgentServiceOptions {
  /** Injected Codex instance (for testing) */
  codex?: CodexLike;
}

/**
 * Type guard for thread.started event
 */
function isThreadStartedEvent(
  event: ThreadEvent
): event is ThreadEvent & { type: 'thread.started'; thread_id: string } {
  return event.type === 'thread.started' && 'thread_id' in event;
}

/**
 * Type guard for item.completed event with agent_message
 */
function isAgentMessageCompleted(
  event: ThreadEvent
): event is ThreadEvent & {
  type: 'item.completed';
  item: { type: 'agent_message'; text: string };
} {
  return (
    event.type === 'item.completed' &&
    'item' in event &&
    event.item?.type === 'agent_message' &&
    typeof event.item?.text === 'string'
  );
}

/**
 * Type guard for turn.failed event
 */
function isTurnFailedEvent(
  event: ThreadEvent
): event is ThreadEvent & { type: 'turn.failed'; error: { message: string } } {
  return event.type === 'turn.failed' && 'error' in event;
}

/**
 * Type guard for error event
 */
function isErrorEvent(
  event: ThreadEvent
): event is ThreadEvent & { type: 'error'; message: string } {
  return event.type === 'error' && 'message' in event;
}

/**
 * Service for invoking Codex via the codex-sdk
 */
export class CodexAgentService implements AgentService {
  private codex: CodexLike;

  constructor(options?: CodexAgentServiceOptions) {
    this.codex = options?.codex ?? new Codex();
  }

  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    try {
      // Build thread options
      const threadOptions = options?.workingDirectory
        ? { workingDirectory: options.workingDirectory }
        : undefined;

      // Start or resume thread
      const thread: ThreadLike = options?.sessionId
        ? this.codex.resumeThread(options.sessionId, threadOptions)
        : this.codex.startThread(threadOptions);

      // Run streamed
      const { events } = await thread.runStreamed(prompt);

      for await (const event of events) {
        // Handle thread.started - extract thread ID as session ID
        if (isThreadStartedEvent(event)) {
          yield {
            type: 'session_init',
            catId: CAT_ID,
            sessionId: event.thread_id,
            timestamp: Date.now(),
          };
          continue;
        }

        // Handle agent_message items
        if (isAgentMessageCompleted(event)) {
          yield {
            type: 'text',
            catId: CAT_ID,
            content: event.item.text,
            timestamp: Date.now(),
          };
          continue;
        }

        // Handle turn.failed
        if (isTurnFailedEvent(event)) {
          yield {
            type: 'error',
            catId: CAT_ID,
            error: event.error.message,
            timestamp: Date.now(),
          };
          continue;
        }

        // Handle stream error
        if (isErrorEvent(event)) {
          yield {
            type: 'error',
            catId: CAT_ID,
            error: event.message,
            timestamp: Date.now(),
          };
          continue;
        }

        // Other event types (turn.started, turn.completed, item.started, etc.)
        // are ignored for now - we can add them later if needed
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
