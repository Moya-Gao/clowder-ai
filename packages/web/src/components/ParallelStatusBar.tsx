'use client';

import { useChatStore } from '@/stores/chatStore';
import { useElapsedTime } from '@/hooks/useElapsedTime';
import { formatDuration, formatTokenCount, formatCost } from './status-helpers';
import type { CatInvocationInfo } from '@/stores/chatStore';
import type { TokenUsage } from '@/stores/chat-types';

/**
 * Per-cat status display for parallel (ideate) mode.
 * Shows each target cat with a status indicator:
 *   pending → gray pulse, streaming → colored pulse + dynamic timer, done → check + duration, error → cross
 */

const CAT_INFO: Record<string, { name: string; bg: string; text: string }> = {
  opus: { name: '布偶猫', bg: 'bg-opus-bg', text: 'text-opus-primary' },
  codex: { name: '缅因猫', bg: 'bg-codex-bg', text: 'text-codex-primary' },
  gemini: { name: '暹罗猫', bg: 'bg-gemini-bg', text: 'text-gemini-primary' },
};

function StatusDot({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <span className="inline-block w-2 h-2 rounded-full bg-gray-300 animate-pulse" />;
    case 'streaming':
      return <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />;
    case 'done':
      return <span className="text-green-500 text-xs">&#10003;</span>;
    case 'error':
      return <span className="text-red-500 text-xs">&#10007;</span>;
    default:
      return null;
  }
}

function CatStatusCard({ catId, status, invocation }: {
  catId: string;
  status: string;
  invocation?: { startedAt?: number; durationMs?: number };
}) {
  const info = CAT_INFO[catId];
  const elapsed = useElapsedTime(status === 'streaming' ? invocation?.startedAt : undefined);

  const timeDisplay = (() => {
    if (status === 'done' && invocation?.durationMs != null) {
      return formatDuration(invocation.durationMs);
    }
    if (status === 'streaming' && elapsed > 0) {
      return formatDuration(elapsed);
    }
    return null;
  })();

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${info?.bg ?? 'bg-gray-100'}`}>
      <StatusDot status={status} />
      <span className={`text-xs font-medium ${info?.text ?? 'text-gray-600'}`}>
        {info?.name ?? catId}
      </span>
      {timeDisplay && (
        <span className="text-xs text-gray-500 ml-0.5">{timeDisplay}</span>
      )}
    </div>
  );
}

/** Aggregate token usage across cat invocations, optionally filtered to specific cats */
export function aggregateUsage(invocations: Record<string, CatInvocationInfo>, filterCatIds?: string[]): TokenUsage | null {
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let count = 0;

  const entries = filterCatIds
    ? filterCatIds.map((id) => invocations[id]).filter(Boolean)
    : Object.values(invocations);

  for (const inv of entries) {
    const u = inv.usage;
    if (!u) continue;
    count++;
    if (u.inputTokens != null) inputTokens += u.inputTokens;
    if (u.outputTokens != null) outputTokens += u.outputTokens;
    if (u.totalTokens != null && u.inputTokens == null) inputTokens += u.totalTokens;
    if (u.costUsd != null) costUsd += u.costUsd;
  }

  if (count === 0) return null;
  return {
    ...(inputTokens > 0 ? { inputTokens } : {}),
    ...(outputTokens > 0 ? { outputTokens } : {}),
    ...(costUsd > 0 ? { costUsd } : {}),
  };
}

export function ParallelStatusBar() {
  const { targetCats, catStatuses, catInvocations } = useChatStore();

  if (targetCats.length === 0) return null;

  const agg = aggregateUsage(catInvocations, targetCats);

  return (
    <div className="px-5 py-2.5 bg-gradient-to-r from-opus-bg via-codex-bg to-gemini-bg border-b border-gray-200">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600">独立观点采样中</span>
        {targetCats.map((catId) => (
          <CatStatusCard
            key={catId}
            catId={catId}
            status={catStatuses[catId] ?? 'pending'}
            invocation={catInvocations[catId]}
          />
        ))}
      </div>
      {agg && (
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500" data-testid="parallel-usage-summary">
          {agg.inputTokens != null && (
            <span>In: <span className="font-medium text-gray-600">{formatTokenCount(agg.inputTokens)}</span></span>
          )}
          {agg.outputTokens != null && (
            <span>Out: <span className="font-medium text-gray-600">{formatTokenCount(agg.outputTokens)}</span></span>
          )}
          {agg.costUsd != null && (
            <span>Cost: <span className="font-medium text-amber-600">{formatCost(agg.costUsd)}</span></span>
          )}
        </div>
      )}
    </div>
  );
}
