'use client';

/**
 * F246 Phase C: Approval Panel for workspace mode.
 *
 * Replaces the ApprovalHubDrawer — same data and actions, but rendered
 * inline in the workspace panel instead of as a fixed overlay. Enjoys
 * full panel width and participates in workspace tab routing.
 */

import { useApprovalHubStore } from '@/stores/approvalHubStore';
import { ApprovalItemCard } from './ApprovalItemCard';

export function ApprovalPanel() {
  const items = useApprovalHubStore((s) => s.items);
  const count = useApprovalHubStore((s) => s.count);
  const isLoading = useApprovalHubStore((s) => s.isLoading);
  const error = useApprovalHubStore((s) => s.error);
  const fetchPending = useApprovalHubStore((s) => s.fetchPending);

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="approval-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cafe-subtle/40">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">待审批</h3>
          {count > 0 && (
            <span
              className="min-w-[20px] h-5 px-1.5 rounded-full text-micro font-bold flex items-center justify-center"
              style={{ backgroundColor: 'var(--semantic-warning)', color: 'var(--cafe-accent-foreground)' }}
            >
              {count > 99 ? '99+' : String(count)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fetchPending()}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-[var(--cafe-muted)]"
          title="刷新"
          data-testid="approval-panel-refresh"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <title>刷新</title>
            <path
              d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m0 0a9 9 0 0 1 9-9m-9 9a9 9 0 0 0 9 9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading && items.length === 0 && (
          <div className="flex items-center justify-center py-8 opacity-50">
            <p className="text-sm">加载中...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[var(--semantic-critical)] p-3">
            <p className="text-sm text-[var(--semantic-critical)]">加载失败: {error}</p>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-12 opacity-50"
            data-testid="approval-empty-state"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 mb-2">
              <title>无待审批</title>
              <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm">没有待审批的项目</p>
          </div>
        )}

        {items.map((item) => (
          <ApprovalItemCard key={item.proposalId} item={item} />
        ))}
      </div>
    </div>
  );
}
