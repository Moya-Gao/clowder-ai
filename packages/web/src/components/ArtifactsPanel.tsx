'use client';

import type { ThreadArtifactDTO, ThreadArtifactType } from '@cat-cafe/shared';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCatData } from '@/hooks/useCatData';
import { useChatStore } from '@/stores/chatStore';
import { API_URL } from '@/utils/api-client';
import { scrollToMessage } from '@/utils/scrollToMessage';
import { kickTeleportResolve, planTeleport } from '@/utils/teleport';
import { useThreadArtifacts } from '../hooks/useThreadArtifacts';
import { ArtifactDetailView } from './artifacts/ArtifactDetailView';
import { artifactRowMeta, resolveAssetUrl } from './artifacts/artifact-view';

const resolveUrl = (url?: string): string | undefined => resolveAssetUrl(url, API_URL);

// Inline SVG icons (sandbox/sanitizer-safe: no <symbol>/<use> — see F232 KD-2).
const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;
const IconImage = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" {...S}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);
const IconFile = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" {...S}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </svg>
);
const IconCode = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" {...S}>
    <path d="M16 18l6-6-6-6" />
    <path d="M8 6l-6 6 6 6" />
  </svg>
);
const IconMic = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" {...S}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
    <path d="M12 18v4" />
  </svg>
);
const IconSearch = () => (
  <svg className="h-[15px] w-[15px] shrink-0" viewBox="0 0 24 24" {...S}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);
const IconArrow = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" {...S}>
    <path d="M7 17L17 7" />
    <path d="M8 7h9v9" />
  </svg>
);
const IconLayers = () => (
  <svg className="h-[17px] w-[17px]" viewBox="0 0 24 24" {...S}>
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);
const IconX = () => (
  <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" {...S}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const TYPE_ICON: Record<ThreadArtifactType, () => JSX.Element> = {
  image: IconImage,
  file: IconFile,
  code: IconCode,
  pr: IconCode,
  audio: IconMic,
};
const TYPE_TINT: Record<ThreadArtifactType, { color: string; background: string }> = {
  image: { color: '#4a7fb0', background: '#eef3f8' },
  file: { color: '#b58a45', background: '#f8f2e9' },
  code: { color: '#479a5a', background: '#edf5ef' },
  pr: { color: '#479a5a', background: '#edf5ef' },
  audio: { color: '#8866b0', background: '#f2edf8' },
};

type FilterKey = 'all' | 'image' | 'file' | 'codepr' | 'audio';
const inFilter = (a: ThreadArtifactDTO, f: FilterKey): boolean =>
  f === 'all' ? true : f === 'codepr' ? a.type === 'code' || a.type === 'pr' : a.type === f;

export function ArtifactsPanel({
  threadId,
  width,
  onClose,
}: {
  threadId: string;
  width?: number;
  onClose?: () => void;
}) {
  const { artifacts, loading, error } = useThreadArtifacts(threadId);
  const { getCatById } = useCatData();
  const workspaceWorktreeId = useChatStore((s) => s.workspaceWorktreeId);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [q, setQ] = useState('');
  // AC-A7: 选中产物 → panel 内进入内容详情视图（null = 列表视图）。
  const [selected, setSelected] = useState<ThreadArtifactDTO | null>(null);

  // P1-2（砚砚 review）：组件不随 threadId remount，切 thread 时本地视图状态会残留——
  // selected 残留会显示旧 thread 产物详情，且「跳回原消息」用新 threadId 配旧 sourceMessageId 串 thread。
  // 切 thread 一并清空选中/筛选/搜索，回到干净列表。
  useEffect(() => {
    setSelected(null);
    setFilter('all');
    setQ('');
  }, [threadId]);

  // F232 P2 (cloud review): 跳回原消息走 teleport（jump-with-load），不裸 scrollToMessage。
  // 全量聚合后老产物的 source message 常在已加载窗口外，裸 scroll 静默 no-op；planTeleport 在
  // 同 thread 也记录 pending teleport，让 useChatHistory 的 older-page resolver 自动加载更老
  // 历史再定位（AC-A4 跳回原消息）。对齐 CardBlock 同款 same-thread teleport pattern。
  const handleJump = useCallback(
    (sourceMessageId: string) => {
      const currentThreadId = useChatStore.getState().currentThreadId;
      const plan = planTeleport({ threadId, messageId: sourceMessageId, currentThreadId });
      if (plan.scrollNow) {
        scrollToMessage(plan.scrollNow);
        kickTeleportResolve();
      } else if (plan.navigateTo) {
        window.location.href = `/?threadId=${plan.navigateTo}`;
      }
    },
    [threadId],
  );

  const counts = useMemo(() => {
    const c = { all: artifacts.length, image: 0, file: 0, codepr: 0, audio: 0 };
    for (const a of artifacts) {
      if (a.type === 'image') c.image++;
      else if (a.type === 'file') c.file++;
      else if (a.type === 'audio') c.audio++;
      else c.codepr++; // code | pr
    }
    return c;
  }, [artifacts]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return artifacts.filter((a) => inFilter(a, filter) && (!needle || a.name.toLowerCase().includes(needle)));
  }, [artifacts, filter, q]);

  const chips: Array<[FilterKey, string, number]> = [
    ['all', '全部', counts.all],
    ['image', '图', counts.image],
    ['file', '文件', counts.file],
    ['codepr', '代码·PR', counts.codepr],
    ['audio', '语音', counts.audio],
  ];

  return (
    <aside
      className="flex flex-col overflow-hidden"
      style={{ width: width ?? 304, flexShrink: 0, background: 'var(--console-shell-bg, #fff)', color: '#2c2c2c' }}
    >
      {selected ? (
        <ArtifactDetailView
          artifact={selected}
          worktreeId={workspaceWorktreeId}
          onBack={() => setSelected(null)}
          onJump={handleJump}
        />
      ) : (
        <>
          <div className="px-4 pt-[18px] pb-3" style={{ borderBottom: '1px solid #eee' }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#333' }}>
                <IconLayers />
                产物 · 当前 thread
              </span>
              {onClose && (
                <button type="button" onClick={onClose} aria-label="关闭" className="flex" style={{ color: '#bbb' }}>
                  <IconX />
                </button>
              )}
            </div>
            <div className="mt-1 text-xs" style={{ color: '#999' }}>
              {loading
                ? '加载中…'
                : error
                  ? '加载失败，点筛选可重试'
                  : `共 ${counts.all} 项 · ${counts.image} 图 · ${counts.file} 文件 · ${counts.codepr} 代码/PR · ${counts.audio} 语音`}
            </div>
            <label
              className="mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm"
              style={{ background: '#f4f4f4', border: '1px solid #e4e4e4', color: '#888' }}
            >
              <IconSearch />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="在本 thread 的产物里搜…（不用记全名）"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#2c2c2c' }}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map(([key, label, n]) => {
                const on = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                    style={on ? { background: '#333', color: '#fff' } : { background: '#f0f0f0', color: '#666' }}
                  >
                    {label} {n}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#bbb' }}>
                {loading ? '' : '该类型暂无产物'}
              </div>
            ) : (
              visible.map((a, i) => {
                const Icon = TYPE_ICON[a.type];
                const tint = TYPE_TINT[a.type];
                const url = resolveUrl(a.url);
                const meta = artifactRowMeta(a, (id) => getCatById(id)?.nickname);
                return (
                  // biome-ignore lint/a11y/useSemanticElements: 整行可点击进入产物详情 + 内嵌跳转/打开按钮，嵌套 interactive 元素无法用 <button>
                  <div
                    key={`${a.ref ?? a.name}-${i}`}
                    data-artifact-row
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(a)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(a);
                      }
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#fafafa]"
                    style={{ borderBottom: '1px solid #f2f2f2', cursor: 'pointer' }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ color: tint.color, background: tint.background, border: '1px solid #e6e6e6' }}
                    >
                      <Icon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: '#9a9a9a' }}>
                        <span className="truncate">
                          {meta.catLabel} · {meta.relativeTime}
                        </span>
                        {a.sourceMessageId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (a.sourceMessageId) handleJump(a.sourceMessageId);
                            }}
                            className="flex shrink-0 items-center gap-0.5"
                            style={{ color: '#5a7fa3' }}
                          >
                            跳转
                            <IconArrow />
                          </button>
                        )}
                      </div>
                    </div>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded px-2.5 py-1 text-xs"
                        style={{ border: '1px solid #e0e0e0', background: '#fafafa', color: '#666' }}
                      >
                        打开
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </aside>
  );
}
