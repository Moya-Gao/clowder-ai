/**
 * Mode Handler Interface
 * 每种模式 (brainstorm, debate, ...) 实现此接口。
 *
 * execute() 是 async generator，yield 出每条猫回复消息。
 * ModeOrchestrator 调用 handler.execute()，转发消息并更新状态。
 */

import type { CatId, ModeConfig, ModeState } from '@cat-cafe/shared';
import type { AgentMessage } from '../types.js';
import type { RouteStrategyDeps, RouteOptions } from '../agents/routing/route-helpers.js';

/** Context passed to each mode handler invocation */
export interface ModeExecutionContext {
  /** Strategy dependencies (services, invocation deps, message store, cursor store) */
  strategyDeps: RouteStrategyDeps;
  /** User message text */
  message: string;
  /** User ID */
  userId: string;
  /** Thread ID */
  threadId: string;
  /** ID of the already-stored user message */
  userMessageId: string;
  /** Route options (contentBlocks, uploadDir, signal, etc.) */
  routeOptions: RouteOptions;
}

/** Interface every mode handler must implement */
export interface ModeHandler {
  /** Execute one round of this mode, yielding agent messages */
  execute(
    ctx: ModeExecutionContext,
    config: ModeConfig,
    state: ModeState,
  ): AsyncIterable<AgentMessage>;

  /** Compute next state after execution completes.
   *  threadId is provided so stateful handlers can look up per-thread execution results. */
  getNextState(config: ModeConfig, state: ModeState, threadId?: string): ModeState;

  /** Whether the mode should auto-end after this state transition */
  shouldAutoEnd(config: ModeConfig, state: ModeState): boolean;
}
