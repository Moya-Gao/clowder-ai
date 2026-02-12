/**
 * Agent Service Types
 * Agent 服务的共享类型定义
 */

import type { CatId, MessageContent } from '@cat-cafe/shared';

/**
 * Metadata about the provider/model behind an agent message
 */
export interface MessageMetadata {
  provider: string;
  model: string;
  sessionId?: string;
}

/**
 * Correlation fields used by audit pipelines to connect service-level events.
 */
export interface AuditContext {
  invocationId: string;
  threadId: string;
  userId: string;
  catId: CatId;
}

/**
 * Types of messages that can be yielded from an agent
 */
export type AgentMessageType =
  | 'session_init'
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'error'
  | 'done'
  | 'a2a_handoff'
  | 'system_info';  // budget warnings, cancel feedback, extraction progress

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
  /** Provider/model metadata (set by agent services) */
  metadata?: MessageMetadata;
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
  /** Env vars to pass to CLI process for MCP callback auth */
  callbackEnv?: Record<string, string>;
  /** Rich content blocks (e.g. images) to pass to the CLI agent */
  contentBlocks?: readonly MessageContent[];
  /** Upload directory for resolving image paths */
  uploadDir?: string;
  /** AbortSignal to cancel the invocation */
  signal?: AbortSignal;
  /** Correlation context for audit logging and raw trace linking */
  auditContext?: AuditContext;
  /** Static identity prompt (Claude: --append-system-prompt, others: prepend to prompt) */
  systemPrompt?: string;
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
