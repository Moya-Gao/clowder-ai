'use client';

import { DecisionIcon, PhaseIcon, DiscussionIcon, CommitIcon } from './icons/EvidenceIcons';

export type EvidenceConfidence = 'high' | 'mid' | 'low';
export type EvidenceSourceType = 'decision' | 'phase' | 'discussion' | 'commit';

export interface EvidenceResult {
  title: string;
  anchor: string;
  snippet: string;
  confidence: EvidenceConfidence;
  sourceType: EvidenceSourceType;
}

const SOURCE_CONFIG: Record<EvidenceSourceType, {
  icon: typeof DecisionIcon;
  label: string;
}> = {
  decision: { icon: DecisionIcon, label: '决策' },
  phase: { icon: PhaseIcon, label: '阶段' },
  discussion: { icon: DiscussionIcon, label: '讨论' },
  commit: { icon: CommitIcon, label: '提交' },
};

const CONFIDENCE_STYLES: Record<EvidenceConfidence, {
  bg: string;
  text: string;
  label: string;
}> = {
  high: { bg: 'bg-green-50', text: 'text-green-700', label: '高' },
  mid: { bg: 'bg-amber-50', text: 'text-amber-700', label: '中' },
  low: { bg: 'bg-gray-100', text: 'text-gray-500', label: '低' },
};

export function EvidenceCard({ result }: { result: EvidenceResult }) {
  const source = SOURCE_CONFIG[result.sourceType];
  const conf = CONFIDENCE_STYLES[result.confidence];
  const Icon = source.icon;

  const snippet = result.snippet.length > 160
    ? result.snippet.slice(0, 160) + '...'
    : result.snippet;

  return (
    <div className="flex gap-2.5 p-2.5 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
      {/* Source type icon */}
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-md bg-gray-50 flex items-center justify-center text-gray-400">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-semibold text-gray-700 leading-snug line-clamp-2">
            {result.title}
          </h4>
          <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${conf.bg} ${conf.text}`}>
            {conf.label}
          </span>
        </div>

        <p className="text-[11px] text-gray-500 leading-relaxed mt-1 line-clamp-2">
          {snippet}
        </p>

        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[10px] text-gray-400 font-medium">{source.label}</span>
          <span className="text-[10px] text-gray-300">·</span>
          <span className="text-[10px] text-gray-400 truncate font-mono">{result.anchor}</span>
        </div>
      </div>
    </div>
  );
}
