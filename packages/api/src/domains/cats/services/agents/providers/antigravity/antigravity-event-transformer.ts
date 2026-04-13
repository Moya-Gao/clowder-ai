import type { CatId } from '@cat-cafe/shared';
import type { AgentMessage, MessageMetadata } from '../../../types.js';
import type { TrajectoryStep } from './AntigravityBridge.js';

export type StepBucket =
  | 'terminal_output'
  | 'partial_output'
  | 'thinking'
  | 'tool_pending'
  | 'tool_error'
  | 'unknown_activity';

export function classifyStep(step: TrajectoryStep): StepBucket {
  if (step.type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE' && step.plannerResponse) {
    const pr = step.plannerResponse;
    if (pr.stopReason === 'STOP_REASON_CLIENT_STREAM_ERROR') return 'tool_error';
    if (pr.modifiedResponse || pr.response) return 'terminal_output';
    if (pr.thinking) return 'thinking';
  }
  if (step.type === 'CORTEX_STEP_TYPE_ERROR_MESSAGE') return 'tool_error';
  if (step.type === 'CORTEX_STEP_TYPE_TOOL_CALL') return 'tool_pending';
  if (step.type === 'CORTEX_STEP_TYPE_TOOL_RESULT') {
    return step.toolResult?.success === false ? 'tool_error' : 'tool_pending';
  }
  return 'unknown_activity';
}

export function transformTrajectorySteps(
  steps: TrajectoryStep[],
  catId: CatId,
  metadata: MessageMetadata,
): AgentMessage[] {
  const messages: AgentMessage[] = [];

  for (const step of steps) {
    const bucket = classifyStep(step);

    switch (bucket) {
      case 'terminal_output': {
        const pr = step.plannerResponse!;
        if (pr.thinking) {
          messages.push({
            type: 'system_info',
            catId,
            content: JSON.stringify({ type: 'thinking', text: pr.thinking }),
            metadata,
            timestamp: Date.now(),
          });
        }
        messages.push({
          type: 'text',
          catId,
          content: (pr.modifiedResponse || pr.response)!,
          metadata,
          timestamp: Date.now(),
        });
        break;
      }

      case 'thinking': {
        const pr = step.plannerResponse!;
        messages.push({
          type: 'system_info',
          catId,
          content: JSON.stringify({ type: 'thinking', text: pr.thinking }),
          metadata,
          timestamp: Date.now(),
        });
        break;
      }

      case 'tool_pending': {
        if (step.type === 'CORTEX_STEP_TYPE_TOOL_CALL' && step.toolCall) {
          messages.push({
            type: 'system_info',
            catId,
            content: JSON.stringify({ type: 'tool_activity', toolName: step.toolCall.toolName }),
            metadata,
            timestamp: Date.now(),
          });
          let parsedInput: Record<string, unknown> | undefined;
          try {
            parsedInput = step.toolCall.input ? JSON.parse(step.toolCall.input) : undefined;
          } catch {
            parsedInput = step.toolCall.input ? { raw: step.toolCall.input } : undefined;
          }
          messages.push({
            type: 'tool_use',
            catId,
            toolName: step.toolCall.toolName,
            toolInput: parsedInput,
            metadata,
            timestamp: Date.now(),
          });
        }
        if (step.type === 'CORTEX_STEP_TYPE_TOOL_RESULT' && step.toolResult) {
          messages.push({
            type: 'tool_result',
            catId,
            toolName: step.toolResult.toolName,
            content: step.toolResult.output,
            metadata,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'tool_error': {
        if (step.type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE') {
          messages.push({
            type: 'error',
            catId,
            error: 'Antigravity model stream error (STOP_REASON_CLIENT_STREAM_ERROR)',
            errorCode: 'stream_error',
            metadata,
            timestamp: Date.now(),
          });
        } else if (step.type === 'CORTEX_STEP_TYPE_ERROR_MESSAGE' && step.errorMessage?.error) {
          const err = step.errorMessage.error;
          messages.push({
            type: 'error',
            catId,
            error: err.userErrorMessage || err.modelErrorMessage || 'Unknown Antigravity error',
            metadata,
            timestamp: Date.now(),
          });
        } else if (step.type === 'CORTEX_STEP_TYPE_TOOL_RESULT' && step.toolResult) {
          const tr = step.toolResult;
          messages.push({
            type: 'error',
            catId,
            error: `Tool ${tr.toolName} failed: ${tr.error || 'unknown error'}`,
            errorCode: 'tool_error',
            metadata,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'unknown_activity': {
        messages.push({
          type: 'system_info',
          catId,
          content: JSON.stringify({ type: 'unknown_activity', stepType: step.type, status: step.status }),
          metadata,
          timestamp: Date.now(),
        });
        break;
      }
    }
  }

  return messages;
}
