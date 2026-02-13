'use client';

import React from 'react';
import type { TokenUsage } from '@/stores/chat-types';
import { formatTokenCount, formatCost, formatDuration } from './status-helpers';

export interface CatTokenUsageProps {
  catId: string;
  usage: TokenUsage;
}

/** Compute cache-read percentage of input tokens */
function cachePercent(usage: TokenUsage): number | null {
  if (!usage.inputTokens || !usage.cacheReadTokens) return null;
  return Math.round((usage.cacheReadTokens / usage.inputTokens) * 100);
}

/**
 * F8: Per-cat token usage display.
 * Adapts to available fields:
 *  - opus:   input/output/cache%/cost/time/turns
 *  - codex:  input/output/cache
 *  - gemini: totalTokens only
 */
export function CatTokenUsage({ catId, usage }: CatTokenUsageProps) {
  const hasDetailed = usage.inputTokens != null || usage.outputTokens != null;
  const hasTotalOnly = !hasDetailed && usage.totalTokens != null;

  if (!hasDetailed && !hasTotalOnly) return null;

  const cachePct = cachePercent(usage);

  return (
    <div className="ml-3.5 mt-1 space-y-0.5 text-[11px] text-gray-500" data-testid={`token-usage-${catId}`}>
      {hasDetailed && (
        <>
          {usage.inputTokens != null && (
            <div className="flex gap-1">
              <span>In:</span>
              <span className="font-medium text-gray-600">{formatTokenCount(usage.inputTokens)}</span>
              {cachePct != null && (
                <span className="text-gray-400">(cached {cachePct}%)</span>
              )}
            </div>
          )}
          {usage.outputTokens != null && (
            <div className="flex gap-1">
              <span>Out:</span>
              <span className="font-medium text-gray-600">{formatTokenCount(usage.outputTokens)}</span>
            </div>
          )}
        </>
      )}
      {hasTotalOnly && usage.totalTokens != null && (
        <div className="flex gap-1">
          <span>Tokens:</span>
          <span className="font-medium text-gray-600">{formatTokenCount(usage.totalTokens)}</span>
        </div>
      )}
      {usage.costUsd != null && (
        <div className="flex gap-1">
          <span>Cost:</span>
          <span className="font-medium text-amber-600">{formatCost(usage.costUsd)}</span>
        </div>
      )}
      {(usage.durationApiMs != null || usage.durationMs != null) && (
        <div className="flex gap-1">
          <span>Time:</span>
          <span className="font-medium text-gray-600">
            {usage.durationApiMs != null && formatDuration(usage.durationApiMs)}
            {usage.durationApiMs != null && usage.durationMs != null && ' / '}
            {usage.durationMs != null && usage.durationApiMs == null && formatDuration(usage.durationMs)}
            {usage.durationMs != null && usage.durationApiMs != null && formatDuration(usage.durationMs)}
          </span>
        </div>
      )}
      {usage.numTurns != null && usage.numTurns > 1 && (
        <div className="flex gap-1">
          <span>Turns:</span>
          <span className="font-medium text-gray-600">{usage.numTurns}</span>
        </div>
      )}
    </div>
  );
}
