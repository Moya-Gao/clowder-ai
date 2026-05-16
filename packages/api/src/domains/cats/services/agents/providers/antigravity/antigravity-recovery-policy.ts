import type { AntigravitySideEffectJournalSummary } from './AntigravitySideEffectJournal.js';
import type { AntigravityCascadeHealthSnapshot } from './antigravity-cascade-health.js';

export type AntigravityRecoveryErrorCode = 'model_capacity' | 'network_error' | 'stream_error' | 'empty_response';

export type AntigravityDispatchRelevantStepKind =
  | 'none'
  | 'side_effect'
  | 'tool_read_shell'
  | 'tool_read_mcp'
  | 'tool_read'
  | 'unknown';

export interface AntigravityRecoveryDispatchState {
  hasDispatchRelevantStep: boolean;
  hasResolvedToolishStep: boolean;
  hasNativeDispatch: boolean;
  hasAttemptToolActivity: boolean;
  hasBatchToolActivity: boolean;
  toolishRetryEligible: boolean;
  dispatchRelevantStepKind: AntigravityDispatchRelevantStepKind;
  hasCooccurringUpstreamError?: boolean;
}

export interface AntigravityRecoveryRetryBudget {
  attemptsUsed: number;
  delaysMs: readonly number[];
}

export interface AntigravityRecoveryContext {
  errorCode: AntigravityRecoveryErrorCode;
  journalSummary: AntigravitySideEffectJournalSummary;
  dispatchState: AntigravityRecoveryDispatchState;
  retryBudget: AntigravityRecoveryRetryBudget;
  cascadeHealth?: Pick<AntigravityCascadeHealthSnapshot, 'level' | 'reasons' | 'retryableForEmptyResponse'>;
}

export type AntigravityRecoveryDecision =
  | { action: 'retry_fresh_cascade'; reason: string; delayMs: number }
  | { action: 'surface_resumable_error'; reason: string; journalSummary: AntigravitySideEffectJournalSummary }
  | { action: 'surface_terminal_error'; reason: string };

function retryDelay(ctx: AntigravityRecoveryContext): number | null {
  return ctx.retryBudget.delaysMs[ctx.retryBudget.attemptsUsed] ?? null;
}

function hasRetryBudget(ctx: AntigravityRecoveryContext): boolean {
  return retryDelay(ctx) != null;
}

function hasObservedSideEffect(summary: AntigravitySideEffectJournalSummary): boolean {
  return (
    summary.hasSideEffect ||
    summary.hasCompletedSideEffect ||
    summary.hasFailedSideEffect ||
    summary.hasPendingOrUnknownSideEffect ||
    summary.blocksBlindRetry
  );
}

export function decideAntigravityRecovery(ctx: AntigravityRecoveryContext): AntigravityRecoveryDecision {
  if (hasObservedSideEffect(ctx.journalSummary)) {
    return {
      action: 'surface_resumable_error',
      reason: ctx.errorCode === 'empty_response' ? 'empty_response_with_side_effect' : 'post_side_effect_interrupted',
      journalSummary: ctx.journalSummary,
    };
  }

  if (ctx.errorCode === 'empty_response') {
    const delayMs = retryDelay(ctx);
    if (ctx.cascadeHealth?.retryableForEmptyResponse && delayMs != null) {
      return {
        action: 'retry_fresh_cascade',
        reason: 'empty_response_retryable_cascade_health',
        delayMs,
      };
    }
    return { action: 'surface_terminal_error', reason: 'empty_response_without_retryable_cascade_health' };
  }

  if (!hasRetryBudget(ctx)) {
    return { action: 'surface_terminal_error', reason: 'retry_budget_exhausted' };
  }

  const { dispatchState } = ctx;
  if (dispatchState.hasCooccurringUpstreamError) {
    return { action: 'surface_terminal_error', reason: 'cooccurring_upstream_error' };
  }
  if (dispatchState.hasResolvedToolishStep) {
    return { action: 'surface_terminal_error', reason: 'resolved_toolish_step_seen' };
  }
  if (dispatchState.hasNativeDispatch) {
    return { action: 'surface_terminal_error', reason: 'native_dispatch_seen' };
  }
  if (dispatchState.hasAttemptToolActivity || dispatchState.hasBatchToolActivity) {
    return { action: 'surface_terminal_error', reason: 'tool_activity_seen' };
  }
  if (dispatchState.hasDispatchRelevantStep && !dispatchState.toolishRetryEligible) {
    if (dispatchState.dispatchRelevantStepKind === 'tool_read_mcp') {
      return {
        action: 'surface_terminal_error',
        reason: 'read_only_mcp_tool_transient_retry_intentionally_disabled',
      };
    }
    return { action: 'surface_terminal_error', reason: 'toolish_step_present' };
  }

  const delayMs = retryDelay(ctx);
  if (delayMs == null) {
    return { action: 'surface_terminal_error', reason: 'retry_budget_exhausted' };
  }
  return { action: 'retry_fresh_cascade', reason: 'pre_side_effect_transient', delayMs };
}
