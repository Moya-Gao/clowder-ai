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
    <div className="flex justify-center mb-6">
      <div className="bg-[var(--color-owner-bg)]/60 backdrop-blur-sm border border-[var(--color-owner-light)] rounded-2xl px-5 pt-4 pb-4 max-w-lg w-full shadow-sm shadow-[var(--color-owner-light)]/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[var(--color-owner-dark)] tracking-wide uppercase">
              Hindsight 检索结果
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/50 text-[var(--color-owner-primary)] font-bold">
              {data.results.length}
            </span>
          </div>
          {data.degraded && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 animate-pulse">
              <span>⚠️</span>
              <span>局部模式</span>
            </div>
          )}
        </div>

        {/* Degraded info if present */}
        {data.degraded && (
          <div className="text-[10px] text-[var(--color-owner-dark)] bg-white/40 border border-white/60 rounded-lg px-3 py-2 mb-3 leading-relaxed italic">
            "哎呀，有些记忆暂时找不到了，正在为您从本地文档中努力搜寻..."
          </div>
        )}

        {/* Results */}
        {data.results.length === 0 ? (
          <div className="text-xs text-[var(--color-owner-primary)]/60 text-center py-6 font-medium italic">
            喵... 翻遍了猫砂盆也没找到相关证据
          </div>
        ) : (
          <div className="space-y-2">
            {data.results.map((result, i) => (
              <EvidenceCard key={`${result.anchor}-${i}`} result={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
