import type { CapabilityTipContext } from '@cat-cafe/shared';
import type { CatStatusType, ChatMessage } from '@/stores/chatStore';

export const DEFAULT_STREAMING_TIP_CONTEXTS = [
  'thinking',
  'long_running',
] as const satisfies readonly CapabilityTipContext[];
export const REVIEW_STREAMING_TIP_CONTEXTS = [
  'review',
  'long_running',
] as const satisfies readonly CapabilityTipContext[];

export function getStreamingTipContexts(intentMode: 'execute' | 'ideate' | null | undefined) {
  return intentMode === 'ideate' ? REVIEW_STREAMING_TIP_CONTEXTS : DEFAULT_STREAMING_TIP_CONTEXTS;
}

export function isStreamingTipSuppressedByStatus(status: CatStatusType | undefined): boolean {
  return status === 'suspected_stall' || status === 'alive_but_silent';
}

export function selectStreamingTipMessageId(
  messages: readonly ChatMessage[],
  catStatuses: Readonly<Record<string, CatStatusType>>,
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.type !== 'assistant' || !message.isStreaming || !message.catId) continue;
    if (isStreamingTipSuppressedByStatus(catStatuses[message.catId])) continue;
    return message.id;
  }
  return null;
}
