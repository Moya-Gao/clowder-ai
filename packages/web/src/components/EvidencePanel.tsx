'use client';

import { EvidenceCard } from './EvidenceCard';
import type { EvidenceResult } from './EvidenceCard';

export interface EvidenceData {
  results: EvidenceResult[];
  degraded: boolean;
  degradeReason?: string;
}

/**
 * EvidencePanel — 证据检索结果面板
 * Inline in chat flow, similar to SummaryCard style.
 */
export function EvidencePanel({ data }: { data: EvidenceData }) {
  return (
    <div className="flex justify-center mb-4">
      <div className="bg-gray-50/80 border border-gray-200 rounded-xl px-4 pt-3 pb-3 max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs font-bold text-gray-600">
            Evidence 检索结果
          </span>
          <span className="text-[10px] text-gray-400">
            ({data.results.length} 条)
          </span>
        </div>

        {/* Degraded banner */}
        {data.degraded && (
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mb-2">
            已降级到本地搜索，结果可能不完整
          </div>
        )}

        {/* Results */}
        {data.results.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-3">
            未找到相关证据
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.results.map((result, i) => (
              <EvidenceCard key={`${result.anchor}-${i}`} result={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
