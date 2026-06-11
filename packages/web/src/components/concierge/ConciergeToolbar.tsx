'use client';

/**
 * F229 PR-A3a: ConciergeToolbar — 猫的能力工具栏（Layer 2）
 *
 * surfaceState=toolbar 时渲染，其他态返回 null
 * 四个能力按钮 + stagger 动画（0/80/160/240ms）
 * 全部颜色从 OKLCH token 来，零 Tailwind 原生色
 *
 * 按钮动作：
 *   找找看 → setSurfaceState('bubble') + 预填 prompt
 *   新功能 → setSurfaceState('bubble') + 预填 prompt
 *   传话   → setSurfaceState('bubble') + 预填 prompt
 *   聊聊   → setSurfaceState('bubble') 空气泡
 */

import { useEffect } from 'react';
import { useConciergeStore } from '@/stores/conciergeStore';

// Inline SVG icons (no icon library dependency)
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
    <line x1="10.5" y1="10.5" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 2C5.8 2 4 3.8 4 6c0 1.5.8 2.8 2 3.5V11h4V9.5c1.2-.7 2-2 2-3.5 0-2.2-1.8-4-4-4z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6.5" y1="13.5" x2="9.5" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <polyline points="2,4 8,9 14,4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M2 3.5C2 2.67 2.67 2 3.5 2h9c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H5L2 14V3.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const TOOLS = [
  {
    key: 'search',
    label: '找找看',
    icon: <SearchIcon />,
    prompt: '帮我找找：',
  },
  {
    key: 'discover',
    label: '新功能',
    icon: <LightbulbIcon />,
    prompt: '我想了解',
  },
  {
    key: 'relay',
    label: '传话',
    icon: <MailIcon />,
    prompt: '帮我转达：',
  },
  {
    key: 'chat',
    label: '聊聊',
    icon: <ChatIcon />,
    prompt: '',
  },
] as const;

export function ConciergeToolbar() {
  const surfaceState = useConciergeStore((s) => s.surfaceState);
  const setSurfaceState = useConciergeStore((s) => s.setSurfaceState);

  // P2 cloud fix: second-level Escape — toolbar → collapsed (mirrors ConciergePanel's bubble → toolbar)
  // Guard inside effect so the listener is only registered (and removed on cleanup) when in toolbar state.
  useEffect(() => {
    if (surfaceState !== 'toolbar') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSurfaceState('collapsed');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [surfaceState, setSurfaceState]);

  if (surfaceState !== 'toolbar') return null;

  return (
    <div
      data-testid="concierge-toolbar"
      className="absolute bottom-[calc(100%+8px)] right-0 flex flex-col items-end gap-2 pointer-events-auto"
      role="toolbar"
      aria-label="猫猫能力工具栏"
    >
      {TOOLS.map((tool, i) => (
        <button
          key={tool.key}
          type="button"
          aria-label={tool.label}
          title={tool.label}
          style={{
            transitionDelay: `${i * 80}ms`,
            backgroundColor: 'var(--accent-100)',
          }}
          className={[
            'concierge-tool',
            'pointer-events-auto',
            'flex items-center justify-center',
            'w-9 h-9 rounded-full',
            'text-[color:var(--cafe-text-secondary)]',
            'shadow-[var(--shadow-elevation-1)]',
            'border border-[color:var(--cafe-border-subtle)]',
            'transition-all duration-200',
            'hover:scale-110',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cafe-accent)]',
          ].join(' ')}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-200)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-100)';
          }}
          onClick={() => setSurfaceState('bubble', tool.prompt)}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
