import type { ProjectSummary } from '@/hooks/useIndexState';

interface BootstrapSummaryCardProps {
  summary: ProjectSummary;
  docsIndexed: number;
  durationMs?: number;
  onDismiss?: () => void;
}

const TIER_LABELS: Record<string, string> = {
  specs: 'Specs',
  adrs: 'ADRs',
  plans: 'Plans',
  lessons: 'Lessons',
  authoritative: 'Specs',
  derived: 'Plans',
  soft_clue: 'Lessons',
};

const TIER_COLORS: Record<string, string> = {
  specs: 'bg-cocreator-primary/10 text-cocreator-dark',
  adrs: 'bg-orange-100 text-orange-700',
  plans: 'bg-blue-100 text-blue-700',
  lessons: 'bg-green-100 text-green-700',
  authoritative: 'bg-cocreator-primary/10 text-cocreator-dark',
  derived: 'bg-blue-100 text-blue-700',
  soft_clue: 'bg-green-100 text-green-700',
};

export function BootstrapSummaryCard({ summary, docsIndexed, durationMs, onDismiss }: BootstrapSummaryCardProps) {
  const durationSec = durationMs ? Math.round(durationMs / 1000) : null;

  return (
    <div data-testid="bootstrap-summary-card" className="flex justify-center mb-3">
      <div className="max-w-[85%] w-full rounded-lg border border-green-200 bg-green-50/50 p-5">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">✅</span>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800">记忆索引构建完成</p>
            <p className="text-xs text-green-600 mt-0.5">猫猫现在可以搜索这个项目的历史知识了</p>
          </div>
        </div>

        <div className="ml-16 space-y-1.5 text-xs text-gray-600">
          <p>
            <span className="text-gray-400 mr-1.5">📁</span>
            项目 &nbsp;<strong>{summary.projectName}</strong>
          </p>
          <p>
            <span className="text-gray-400 mr-1.5">📄</span>
            已索引 {docsIndexed} 个文档
          </p>
          {durationSec !== null && (
            <p>
              <span className="text-gray-400 mr-1.5">⏱</span>
              耗时 {durationSec} 秒
            </p>
          )}
        </div>

        {Object.keys(summary.tierCoverage).length > 0 && (
          <div className="ml-16 mt-3">
            <p className="text-[10px] text-gray-400 mb-1.5">覆盖分层</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(summary.tierCoverage).map(([tier, count]) => (
                <span
                  key={tier}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {TIER_LABELS[tier] ?? tier} · {count}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 ml-16 mt-4">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              关闭
            </button>
          )}
          <button
            type="button"
            disabled
            className="px-3 py-1.5 rounded-lg text-xs text-gray-400 cursor-not-allowed inline-flex items-center gap-1"
          >
            🔍 搜索知识
          </button>
          <button
            type="button"
            disabled
            className="px-3 py-1.5 rounded-lg bg-green-600/50 text-white/70 text-xs font-medium cursor-not-allowed inline-flex items-center gap-1"
          >
            🧠 前往记忆中心
          </button>
        </div>
      </div>
    </div>
  );
}
