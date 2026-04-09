/**
 * CatAgent Types — F152: Thin Agent Runtime
 *
 * Type definitions for the CatAgent provider.
 * CatAgent calls the LLM API directly (not via CLI subprocess),
 * implementing a lightweight agent loop with native Cat Cafe tool integration.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { CatId } from '@cat-cafe/shared';

/** Tool permission decision */
export type ToolPermission = 'allow' | 'deny';

/** Registered tool definition for CatAgent */
export interface CatAgentTool {
  /** Anthropic tool schema (sent to the API) */
  schema: Anthropic.Messages.Tool;
  /** Execute the tool and return result string */
  execute: (input: Record<string, unknown>) => Promise<string>;
  /** Permission level — 'allow' = auto-execute, 'deny' = blocked */
  permission: ToolPermission;
}

/** Config passed to the agent loop */
export interface CatAgentLoopConfig {
  catId: CatId;
  model: string;
  apiKey: string;
  /** Anthropic API base URL override */
  baseURL?: string;
  /** Maximum turns before forced stop */
  maxTurns: number;
  /** Maximum output tokens per LLM call */
  maxTokens: number;
  /** Cumulative token budget (input+output) before forced stop. 0 = unlimited. */
  tokenBudgetLimit: number;
  /** Working directory for file tools */
  workingDirectory: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Test-only: inject a mock Anthropic client */
  _testClient?: { messages: { create: (params: unknown) => Promise<unknown> } };
}

/** Cumulative token usage across the entire agent session */
export interface SessionTokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  turns: number;
}

/** Kernel prompt context — rebuilt every turn */
export interface KernelPromptContext {
  catId: CatId;
  /** Cat identity name (e.g. '布偶猫/宪宪') */
  catName: string;
  /** Model identifier */
  model: string;
  /** Current working directory */
  workingDirectory: string;
  /** Current turn number (for context awareness) */
  turnNumber: number;
  /** Custom system prompt from invocation options */
  customSystemPrompt?: string;
}
