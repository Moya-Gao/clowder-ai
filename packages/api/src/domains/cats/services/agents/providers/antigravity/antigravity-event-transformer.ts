/**
 * Transform Antigravity cascade trajectory steps → AgentMessage stream.
 *
 * Maps CORTEX_STEP_TYPE_PLANNER_RESPONSE → text (+ optional thinking)
 * Maps CORTEX_STEP_TYPE_ERROR_MESSAGE → error
 */
import type { CatId } from '@cat-cafe/shared';
import type { AgentMessage, MessageMetadata } from '../../../types.js';
import type { TrajectoryStep } from './AntigravityBridge.js';

/**
 * Extract AgentMessages from trajectory steps.
 * Pure function — no side effects, easy to test.
 */
export function transformTrajectorySteps(
  steps: TrajectoryStep[],
  catId: CatId,
  metadata: MessageMetadata,
): AgentMessage[] {
  const messages: AgentMessage[] = [];

  for (const step of steps) {
    if (step.type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE' && step.plannerResponse) {
      const pr = step.plannerResponse;

      // Emit thinking as system_info (if present)
      if (pr.thinking) {
        messages.push({
          type: 'system_info',
          catId,
          content: JSON.stringify({ type: 'thinking', text: pr.thinking }),
          metadata,
          timestamp: Date.now(),
        });
      }

      // Emit response text (prefer modifiedResponse over response)
      const text = pr.modifiedResponse || pr.response;
      if (text) {
        messages.push({
          type: 'text',
          catId,
          content: text,
          metadata,
          timestamp: Date.now(),
        });
      } else if (pr.stopReason === 'STOP_REASON_CLIENT_STREAM_ERROR') {
        messages.push({
          type: 'error',
          catId,
          error: 'Antigravity model stream error (STOP_REASON_CLIENT_STREAM_ERROR)',
          errorCode: 'stream_error',
          metadata,
          timestamp: Date.now(),
        });
      }
    }

    if (step.type === 'CORTEX_STEP_TYPE_ERROR_MESSAGE' && step.errorMessage?.error) {
      const err = step.errorMessage.error;
      messages.push({
        type: 'error',
        catId,
        error: err.userErrorMessage || err.modelErrorMessage || 'Unknown Antigravity error',
        metadata,
        timestamp: Date.now(),
      });
    }
  }

  return messages;
}
