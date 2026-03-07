import React from 'react';

/** F070: governance status dot colors */
const GOV_STATUS_DOT: Record<string, { color: string; title: string }> = {
  healthy: { color: 'bg-green-400', title: '治理正常' },
  stale: { color: 'bg-yellow-400', title: '治理过期' },
  missing: { color: 'bg-red-400', title: '治理缺失' },
  'never-synced': { color: 'bg-gray-300', title: '未同步治理' },
};

interface SectionGroupProps {
  label: string;
  icon?: 'pin' | 'star';
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  projectPath?: string;
  governanceStatus?: string;
  children: React.ReactNode;
}

/** Collapsible section group for pinned / favorites / project threads. */
export function SectionGroup({
  label,
  icon,
  count,
  isCollapsed,
  onToggle,
  projectPath,
  governanceStatus,
  children,
}: SectionGroupProps) {
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
        title={projectPath && projectPath !== 'default' ? projectPath : undefined}
      >
        <svg
          aria-hidden="true"
          className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M4 2l4 4-4 4V2z" />
        </svg>
        {icon === 'pin' && (
          <svg
            aria-hidden="true"
            className="w-3 h-3 text-owner-primary flex-shrink-0"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M4.456 2.013a.75.75 0 011.06-.034l6.5 6a.75.75 0 01-.034 1.06l-1.99 1.838.637 3.22a.75.75 0 01-1.196.693L6.5 12.526l-2.933 2.264a.75.75 0 01-1.196-.693l.637-3.22-1.99-1.838a.75.75 0 01-.034-1.06l5.472-5.966z" />
          </svg>
        )}
        {icon === 'star' && (
          <svg
            aria-hidden="true"
            className="w-3 h-3 text-yellow-500 flex-shrink-0"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 1.5l2.09 4.26 4.71.68-3.41 3.32.8 4.69L8 12.26l-4.19 2.19.8-4.69L1.2 6.44l4.71-.68L8 1.5z" />
          </svg>
        )}
        <span className="text-xs font-medium text-gray-500 truncate">{label}</span>
        {(() => {
          const dot = governanceStatus ? GOV_STATUS_DOT[governanceStatus] : undefined;
          return dot ? <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot.color}`} title={dot.title} /> : null;
        })()}
        <span className="text-[10px] text-gray-300 flex-shrink-0 ml-auto">{count}</span>
      </button>
      {!isCollapsed && children}
    </div>
  );
}
