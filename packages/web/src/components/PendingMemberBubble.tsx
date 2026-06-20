'use client';

import type { CapabilityTipContext } from '@cat-cafe/shared';
import { formatCatName, useCatData } from '@/hooks/useCatData';
import type { CatStatusType } from '@/stores/chatStore';
import { CapabilityTipStrip } from './CapabilityTipStrip';
import { CatAvatar } from './CatAvatar';
import { DEFAULT_STREAMING_TIP_CONTEXTS, isStreamingTipSuppressedByStatus } from './capability-tip-placement';
import { MessageBubble } from './MessageBubble';

interface PendingMemberBubbleProps {
  catId: string;
  invocationId: string;
  /** Liveness status for stall suppression — hide tips when cat is stalled (AC-B2 red line). */
  catStatus?: CatStatusType;
  /** Tip contexts from intentMode — review mode gets review tips instead of generic thinking tips. */
  tipContexts?: readonly CapabilityTipContext[];
  /** Only one pending bubble per thread should show tips (dedup — cloud review P2). */
  showCapabilityTip?: boolean;
}

/**
 * #936: Show a member-level pending bubble with avatar and animated dots
 * as soon as an invocation starts, before any stream content arrives.
 *
 * This replaces the gap where the user sees nothing between sending a message
 * and the first assistant stream chunk. The bubble is keyed by invocationId
 * so it naturally unmounts when replaced by real content.
 *
 * F244: Capability tips show here (the "分析处理中" wait phase), NOT in the
 * streaming ChatMessage — CVO dogfood confirmed this is the correct timing.
 */
export function PendingMemberBubble({
  catId,
  invocationId,
  catStatus,
  tipContexts,
  showCapabilityTip = false,
}: PendingMemberBubbleProps) {
  const { getCatById } = useCatData();
  const catData = getCatById(catId);
  const catName = catData ? formatCatName(catData) : catId;

  return (
    <MessageBubble
      messageId={`pending-${invocationId}`}
      avatar={<CatAvatar catId={catId} size={32} status="streaming" />}
      header={
        <span className="text-xs font-semibold" style={{ color: catData?.color?.primary, opacity: 0.8 }}>
          {catName}
        </span>
      }
      wrapperClassName="group cat-persona-derived"
    >
      <div className="flex items-center gap-1 py-2 text-cafe-fg-muted">
        <span className="text-sm">分析处理中</span>
        <span className="inline-flex gap-0.5">
          <span className="animate-bounce text-sm" style={{ animationDelay: '0ms' }}>
            .
          </span>
          <span className="animate-bounce text-sm" style={{ animationDelay: '150ms' }}>
            .
          </span>
          <span className="animate-bounce text-sm" style={{ animationDelay: '300ms' }}>
            .
          </span>
        </span>
      </div>
      {showCapabilityTip && (
        <CapabilityTipStrip
          surface="pending_bubble"
          contexts={tipContexts ?? DEFAULT_STREAMING_TIP_CONTEXTS}
          enabled={!isStreamingTipSuppressedByStatus(catStatus)}
        />
      )}
    </MessageBubble>
  );
}
