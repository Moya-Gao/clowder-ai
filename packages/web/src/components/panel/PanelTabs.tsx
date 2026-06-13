import type { JSX } from 'react';

/** 右侧 panel 的三种内容模式（与 chatStore.rightPanelMode 对齐）。
 * F232 AC-A8 修订：产物已升级为 workspaceMode 顶层入口（不再是独立 panel tab）。 */
export type RightPanelMode = 'status' | 'workspace' | 'transcript';

const TABS: Array<{ mode: RightPanelMode; label: string }> = [
  { mode: 'status', label: '状态' },
  { mode: 'workspace', label: '工作区' },
  { mode: 'transcript', label: '转录' },
];

const IconClose = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

/**
 * F232 AC-A8 — 右侧 panel 顶部统一 tab，收敛原先 header 上的多个 mode 切换按钮
 * （ArtifactsToggle + RightPanelToggle）。点 tab 切 mode；× 收起 panel。
 */
export function PanelTabs({
  mode,
  onSelect,
  onClose,
}: {
  mode: RightPanelMode;
  onSelect: (mode: RightPanelMode) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div
      role="tablist"
      className="flex items-center gap-0.5 border-b border-cafe-border px-2 py-1"
      style={{ background: 'var(--console-shell-bg, #fff)' }}
    >
      {TABS.map((t) => {
        const active = mode === t.mode;
        return (
          <button
            key={t.mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(t.mode)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? 'bg-[var(--cafe-accent)]/10 text-cafe-accent' : 'text-cafe-secondary hover:text-cafe-accent'
            }`}
          >
            {t.label}
          </button>
        );
      })}
      <button
        type="button"
        aria-label="收起面板"
        onClick={onClose}
        className="ml-auto rounded p-1 text-cafe-secondary transition-colors hover:text-cafe-accent"
      >
        <IconClose />
      </button>
    </div>
  );
}
