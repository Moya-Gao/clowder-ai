'use client';

/**
 * F229 PR-A2: ConciergeRailToggle — ActivityBar re-entry toggle
 *
 * INV-3: when ball is hidden (muted=true), this is the ONLY wake path back to the concierge.
 * P2 R6: gated on configLoaded/configFailed — prevents panelOpen race during startup
 *        (store starts enabled=true optimistically; we must not let users click before we
 *        know their persisted preference, or an opted-out panel can remain open).
 */

import { useConciergeStore } from '@/stores/conciergeStore';

export function ConciergeRailToggle() {
  const configLoaded = useConciergeStore((s) => s.configLoaded);
  const configFailed = useConciergeStore((s) => s.configFailed);
  const enabled = useConciergeStore((s) => s.enabled);
  const panelOpen = useConciergeStore((s) => s.panelOpen);
  const muted = useConciergeStore((s) => s.muted);
  const setPanelOpen = useConciergeStore((s) => s.setPanelOpen);

  // P2 R6: don't render until config is known — prevents panelOpen race during startup
  if (!configLoaded && !configFailed) return null;
  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => setPanelOpen(!panelOpen)}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
        panelOpen
          ? 'bg-[var(--console-rail-active)] shadow-[var(--console-rail-shadow)]'
          : 'hover:bg-[var(--console-rail-item)] hover:shadow-[var(--console-rail-shadow)]'
      }`}
      title={panelOpen ? '收起前台猫' : muted ? '唤起前台猫（已静音）' : '唤起前台猫'}
      aria-label={panelOpen ? '收起前台猫' : '唤起前台猫'}
      data-testid="concierge-rail-toggle"
    >
      <span className="text-base leading-none" aria-hidden="true">
        🐱
      </span>
    </button>
  );
}
