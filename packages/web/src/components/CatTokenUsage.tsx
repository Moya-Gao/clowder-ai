'use client';

import React from 'react';
import type { TokenUsage } from '@/stores/chat-types';
import { formatTokenCount, formatCost, formatDuration } from './status-helpers';
import { useCountUp } from '@/hooks/useCountUp';
import { TokenCacheBar } from './TokenCacheBar';

export interface CatTokenUsageProps {
  catId: string;
  usage: TokenUsage;
}

const CAT_TEXT_COLORS: Record<string, string> = {
  opus: 'text-opus-dark',
  codex: 'text-codex-dark',
  gemini: 'text-gemini-dark',
};

function cachePercent(usage: TokenUsage): number {
  if (!usage.cacheReadTokens || !usage.inputTokens) return 0;
  return Math.round((usage.cacheReadTokens / usage.inputTokens) * 100);
}

function AnimatedTokenCount({ value, label }: { value: number; label: string }) {
  const display = useCountUp(value);
  return (
    <span className="tabular-nums" title={`${label}: ${value.toLocaleString()}`}>
      {formatTokenCount(display)}
    </span>
  );
}

/**
 * F8: Per-cat token usage dashboard card.
 * Dynamic display with count-up animations, cache progress bar, and brand colors.
 */
export function CatTokenUsage({ catId, usage }: CatTokenUsageProps) {
  const hasDetailed = usage.inputTokens != null || usage.outputTokens != null;
  const hasTotalOnly = !hasDetailed && usage.totalTokens != null;

  if (!hasDetailed && !hasTotalOnly) return null;

  const textColor = CAT_TEXT_COLORS[catId] ?? 'text-gray-700';
  const cachePct = cachePercent(usage);

  return (
    <div className="mt-1.5 space-y-1 animate-fade-in" data-testid={`token-usage-${catId}`}>
      {/* Token counts row */}
      <div className="flex items-baseline gap-2 font-mono text-[11px]">
        {hasDetailed && (
          <>
            {usage.inputTokens != null && (
              <span className={textColor}>
                <AnimatedTokenCount value={usage.inputTokens} label="Input" />
                <span className="text-gray-400 ml-0.5">↓</span>
              </span>
            )}
            {usage.outputTokens != null && (
              <span className="text-gray-600">
                <AnimatedTokenCount value={usage.outputTokens} label="Output" />
                <span className="text-gray-400 ml-0.5">↑</span>
              </span>
            )}
          </>
        )}
        {hasTotalOnly && usage.totalTokens != null && (
          <span className={textColor}>
            <AnimatedTokenCount value={usage.totalTokens} label="Total" />
            <span className="text-gray-400 ml-0.5">tok</span>
          </span>
        )}
      </div>

      {/* Cache bar */}
      {cachePct > 0 && (
        <TokenCacheBar percent={cachePct} catId={catId} />
      )}

      {/* Cost + duration row */}
      <div className="flex items-center gap-2 text-[10px]">
        {usage.costUsd != null && (
          <span className="text-amber-600 font-medium tabular-nums animate-cost-glow">
            {formatCost(usage.costUsd)}
          </span>
        )}
        {usage.numTurns != null && usage.numTurns > 1 && (
          <span className="text-gray-400">{usage.numTurns} turns</span>
        )}
        {usage.durationApiMs != null && (
          <span className="text-gray-400">API {formatDuration(usage.durationApiMs)}</span>
        )}
      </div>
    </div>
  );
}
