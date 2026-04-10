import type { IndexState } from '@/hooks/useIndexState';

interface BootstrapPromptCardProps {
  indexState: IndexState;
  isSnoozed: boolean;
  projectPath: string;
  onStartScan: () => void;
  onSnooze: () => void;
}

export function BootstrapPromptCard({
  indexState,
  isSnoozed,
  projectPath,
  onStartScan,
  onSnooze,
}: BootstrapPromptCardProps) {
  if (indexState.status !== 'missing' && indexState.status !== 'stale' && indexState.status !== 'failed') return null;
  if (isSnoozed) return null;

  const dirName = projectPath.split(/[/\\]/).pop() ?? projectPath;
  const isFailed = indexState.status === 'failed';
  const isStale = indexState.status === 'stale';

  return (
    <div data-testid="bootstrap-prompt-card" className="flex justify-center mb-3">
      <div className="max-w-[85%] w-full rounded-lg border border-cocreator-primary/20 bg-cocreator-bg/30 p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-cocreator-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🧠</span>
          </div>
          <div>
            <p className="text-sm font-medium text-cafe-black">
              {isFailed ? '记忆索引构建失败' : isStale ? '记忆索引已过期' : '这个项目还没有记忆索引'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isFailed
                ? `项目 ${dirName} 上次扫描出错：${indexState.error_message ?? '未知错误'}`
                : isStale
                  ? `项目 ${dirName} 代码已更新，需要重新扫描以保持记忆新鲜。`
                  : '建立索引后，猫猫可以搜索项目历史知识（specs、ADRs、教训等），不再从零开始'}
            </p>
          </div>
        </div>

        {!isFailed && (
          <div className="ml-16 mb-4 space-y-1.5 text-xs text-gray-500">
            <p>
              <span className="text-cocreator-primary mr-1.5">📂</span>
              扫描范围 &nbsp;docs/ 下文档（specs · ADRs · plans · lessons）
            </p>
            <p>
              <span className="text-cocreator-primary mr-1.5">⏱</span>
              预计耗时 &nbsp;~30 秒（后台运行，不影响对话）
            </p>
            <p>
              <span className="text-cocreator-primary mr-1.5">🔒</span>
              数据安全 &nbsp;所有索引数据保留在本地，不上传任何内容
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 ml-16">
          <button
            type="button"
            onClick={onSnooze}
            className="px-4 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            稍后再说
          </button>
          <button
            type="button"
            onClick={onStartScan}
            className="px-4 py-2 rounded-lg bg-cocreator-primary hover:bg-cocreator-dark text-white text-xs font-medium transition-colors"
          >
            🐾 {isFailed ? '重试扫描' : isStale ? '更新索引' : '开始扫描'}
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-3 ml-16">
          {isFailed
            ? '扫描仅读取项目文件结构和文档，不会执行代码或修改任何文件。'
            : '选择「稍后再说」将在 7 天后再次提醒。你也可以在记忆中心手动触发扫描。'}
        </p>
      </div>
    </div>
  );
}
