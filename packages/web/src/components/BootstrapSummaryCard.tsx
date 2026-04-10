import type { ProjectSummary } from '@/hooks/useIndexState';

interface BootstrapSummaryCardProps {
  summary: ProjectSummary;
  docsIndexed: number;
  durationMs?: number;
  onDismiss?: () => void;
}

export function BootstrapSummaryCard({ summary, docsIndexed, durationMs, onDismiss }: BootstrapSummaryCardProps) {
  const durationSec = durationMs ? (durationMs / 1000).toFixed(1) : null;

  return (
    <div data-testid="bootstrap-summary-card" className="flex justify-center mb-3">
      <div className="max-w-[85%] w-full rounded-lg border border-green-200 bg-green-50/50 p-5">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">✅</span>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800">记忆索引就绪</p>
            <p className="text-xs text-green-600 mt-0.5">
              <strong>{summary.projectName}</strong> — 已索引 {docsIndexed} 份文档
              {durationSec && <span className="text-gray-400">（{durationSec}s）</span>}
            </p>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="ml-auto text-gray-400 hover:text-gray-600 text-xs"
              aria-label="关闭"
            >
              ✕
            </button>
          )}
        </div>

        <div className="ml-16 space-y-2">
          {summary.techStack.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">技术栈</span>
              <div className="flex flex-wrap gap-1">
                {summary.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-cocreator-primary/10 text-cocreator-dark font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {summary.dirStructure.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">目录</span>
              <p className="text-xs text-gray-700">
                {summary.dirStructure.slice(0, 8).join(' / ')}
                {summary.dirStructure.length > 8 && (
                  <span className="text-gray-400"> +{summary.dirStructure.length - 8}</span>
                )}
              </p>
            </div>
          )}

          {Object.keys(summary.tierCoverage).length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">文档层</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.tierCoverage).map(([tier, count]) => (
                  <span key={tier} className="text-[10px] text-gray-600">
                    {tier === 'authoritative' ? '权威' : tier === 'derived' ? '推导' : '线索'}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {summary.coreModules.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">模块</span>
              <p className="text-xs text-gray-700">{summary.coreModules.join(', ')}</p>
            </div>
          )}
        </div>

        <p className="text-[10px] text-gray-400 mt-3 ml-16">
          🐾 猫猫已记住这个项目的结构，可以更准确地搜索文档和解答问题了。
        </p>
      </div>
    </div>
  );
}
