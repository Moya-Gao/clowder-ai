'use client';

/**
 * F246: Individual approval item card for the Approval Hub drawer.
 *
 * Phase A: All cards use "jump to thread" — F128 needs full approve-time overrides
 * (title/parentThreadId/preferredCats/initialMessage/projectPath/reportingMode) which
 * the Hub drawer doesn't provide, so AC-A4 mandates "强制跳转" fallback. F225 also
 * jumps (needs thread context for handoff review).
 *
 * Stale items (expiresAt < now) show an orange stale badge (AC-A6).
 */

import type { ApprovalItem } from '@cat-cafe/shared';
import { useCallback, useMemo } from 'react';
import { useApprovalHubStore } from '@/stores/approvalHubStore';
import { useChatStore } from '@/stores/chatStore';
import { scrollToMessage } from '@/utils/scrollToMessage';
import { kickTeleportResolve, planTeleport } from '@/utils/teleport';
import { pushThreadRouteWithHistory } from './ThreadSidebar/thread-navigation';

function formatAge(createdAt: number): string {
  const diffMs = Date.now() - createdAt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Navigate to a specific message via teleport, or to thread root as fallback. */
function jumpToApproval(threadId: string, messageId?: string): void {
  if (messageId) {
    const currentThreadId = useChatStore.getState().currentThreadId;
    const plan = planTeleport({ threadId, messageId, currentThreadId });
    if (plan.scrollNow) {
      scrollToMessage(plan.scrollNow);
      kickTeleportResolve();
    } else if (plan.navigateTo) {
      pushThreadRouteWithHistory(plan.navigateTo, typeof window !== 'undefined' ? window : undefined);
    }
    return;
  }
  pushThreadRouteWithHistory(threadId, typeof window !== 'undefined' ? window : undefined);
}

export function ApprovalItemCard({ item }: { item: ApprovalItem }) {
  const close = useApprovalHubStore((s) => s.close);

  const isStale = useMemo(() => item.expiresAt != null && item.expiresAt < Date.now(), [item.expiresAt]);

  const handleJump = useCallback(() => {
    close();
    jumpToApproval(item.sourceThreadId, item.sourceMessageId);
  }, [close, item.sourceThreadId, item.sourceMessageId]);

  const featureBadge = item.sourceFeatureId === 'F128' ? 'Thread' : 'Handoff';
  const featureColor = item.sourceFeatureId === 'F128' ? 'var(--semantic-info)' : 'var(--semantic-secondary, #8b5cf6)';

  return (
    <div
      className="rounded-lg border border-[var(--cafe-border)] p-3 space-y-2"
      data-testid={`approval-item-${item.proposalId}`}
    >
      {/* Header row: feature badge + stale badge + age */}
      <div className="flex items-center gap-2 text-micro">
        <span
          className="px-1.5 py-0.5 rounded-md font-medium"
          style={{ backgroundColor: featureColor, color: 'var(--cafe-accent-foreground)' }}
        >
          {featureBadge}
        </span>
        {isStale && (
          <span
            className="px-1.5 py-0.5 rounded-md font-medium"
            style={{ backgroundColor: 'var(--semantic-warning)', color: 'var(--cafe-accent-foreground)' }}
            data-testid="stale-badge"
          >
            已过期
          </span>
        )}
        <span className="ml-auto opacity-60">{formatAge(item.createdAt)}</span>
      </div>

      {/* Summary */}
      <p className="text-sm font-medium">{item.summary}</p>

      {/* Requester */}
      <p className="text-micro opacity-60">by {item.requesterCatId}</p>

      {/* F128: detail excerpt */}
      {item.sourceFeatureId === 'F128' && item.detail.reason != null && (
        <p className="text-micro opacity-80 line-clamp-2">{String(item.detail.reason)}</p>
      )}

      {/* F225: handoff note excerpt */}
      {item.sourceFeatureId === 'F225' && (
        <div className="text-micro opacity-80 space-y-0.5">
          {item.detail.done != null && <p className="line-clamp-1">Done: {String(item.detail.done)}</p>}
          {item.detail.nextSteps != null && <p className="line-clamp-1">Next: {String(item.detail.nextSteps)}</p>}
        </div>
      )}

      {/* Actions — Phase A: all cards jump to thread for full approval context.
           F128 requires full approve-time overrides (AC-A4 强制跳转 fallback).
           F225 needs thread context for handoff review. */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleJump}
          className="px-3 py-1 text-micro font-medium rounded-md border border-[var(--cafe-border)] hover:bg-[var(--cafe-muted)]"
          data-testid="jump-btn"
        >
          {item.sourceFeatureId === 'F128' ? '跳转审批' : '跳转到 Thread'}
        </button>
      </div>
    </div>
  );
}
