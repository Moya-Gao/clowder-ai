/**
 * Agent Service Types
 * Agent 服务的共享类型定义
 */

import type { CatId } from '@cat-cafe/shared';

/**
 * Types of messages that can be yielded from an agent
 */
export type AgentMessageType =
  | 'session_init'
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'error'
  | 'done';

/**
 * A message yielded from an agent during invocation
 */
export interface AgentMessage {
  /** The type of this message */
  type: AgentMessageType;
  /** Which cat (agent) produced this message */
  catId: CatId;
  /** Text content (for 'text' and 'tool_result' types) */
  content?: string;
  /** Session ID (for 'session_init' type) */
  sessionId?: string;
  /** Tool name (for 'tool_use' type) */
  toolName?: string;
  /** Tool input parameters (for 'tool_use' type) */
  toolInput?: Record<string, unknown>;
  /** Error message (for 'error' type) */
  error?: string;
  /** Whether this is the final 'done' in a multi-cat invocation (for 'done' type) */
  isFinal?: boolean;
  /** When this message was created */
  timestamp: number;
}

/**
 * Options for invoking an agent
 */
export interface AgentServiceOptions {
  /** Session ID to resume (optional) */
  sessionId?: string;
  /** Working directory for the agent */
  workingDirectory?: string;
}

/**
 * Interface that all agent services must implement
 */
export interface AgentService {
  /**
   * Invoke the agent with a prompt and stream back messages
   * @param prompt The user's prompt/message
   * @param options Optional configuration
   * @returns An async iterable of agent messages
   */
  invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage>;
}
