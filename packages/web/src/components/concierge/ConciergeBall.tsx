'use client';

/**
 * F229 PR-A2: ConciergeBall — 悬浮球 UI
 *
 * z-30 < FloatingPresentationSurface z-[35] (micro-spec §4)
 * Non-modal: no focus trap, accessible keyboard nav
 * aria-live="polite" (安静默认 §3): badge changes announced non-disruptively
 * Quiet default: badge shows dot only (no count text), hover/focus for tooltip
 */

import type { ConciergeBallState } from '@cat-cafe/shared';
import { useConciergeStore } from '@/stores/conciergeStore';

interface ConciergeBallProps {
  ballState: ConciergeBallState;
}

// State → visual color class
const STATE_COLORS: Record<ConciergeBallState, string> = {
  idle: 'bg-zinc-500',
  sleeping: 'bg-zinc-700',
  listening: 'bg-blue-500',
  thinking: 'bg-amber-500',
  found: 'bg-emerald-500',
  'needs-confirmation': 'bg-orange-500',
  handoff: 'bg-violet-500',
  error: 'bg-red-500',
};

// State → aria-label suffix
const STATE_LABELS: Record<ConciergeBallState, string> = {
  idle: '待机中',
  sleeping: '静音',
  listening: '聆听中',
  thinking: '思考中',
  found: '发现结果',
  'needs-confirmation': '需要确认',
  handoff: '传话中',
  error: '出错了',
};

export function ConciergeBall({ ballState }: ConciergeBallProps) {
  const setPanelOpen = useConciergeStore((s) => s.setPanelOpen);
  const panelOpen = useConciergeStore((s) => s.panelOpen);
  const unseenResultCount = useConciergeStore((s) => s.unseenResultCount);

  const handleClick = () => {
    setPanelOpen(!panelOpen);
  };

  const colorClass = STATE_COLORS[ballState] ?? 'bg-zinc-500';
  const stateLabel = STATE_LABELS[ballState] ?? ballState;

  return (
    <div aria-live="polite" aria-atomic="false" className="fixed bottom-6 right-6 z-30 pointer-events-none">
      <button
        type="button"
        aria-label={`猫猫球 — ${stateLabel}`}
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        className={[
          'pointer-events-auto',
          'relative flex items-center justify-center',
          'w-12 h-12 rounded-full shadow-lg',
          'transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
          'select-none cursor-pointer',
          colorClass,
        ].join(' ')}
        onClick={handleClick}
      >
        {/* Cat icon placeholder (Phase E: replace with skin sprite) */}
        <span className="text-xl leading-none" aria-hidden="true">
          🐱
        </span>

        {/* Badge dot — shows only when unseenResultCount > 0 (quiet-badge policy §3)
            No text node: just a color indicator. role="img" lets aria-label attach. */}
        {unseenResultCount > 0 && (
          <span
            role="img"
            aria-label={`${unseenResultCount} 条未读结果`}
            className={[
              'absolute -top-0.5 -right-0.5',
              'w-3 h-3 rounded-full',
              'bg-emerald-400 border-2 border-white',
            ].join(' ')}
          />
        )}

        {/* State indicator dot (always shown, color varies) */}
        <span
          className={[
            'absolute -bottom-0.5 -right-0.5',
            'w-2.5 h-2.5 rounded-full border-2 border-white',
            colorClass,
          ].join(' ')}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
