'use client';

/**
 * F229 PR-A3a: ConciergeHost — always-mounted root entry point
 *
 * INV-5: single AppShell instance (mounted at root alongside FloatingPresentationSurfaceHost)
 * INV-6: route survival — host stays mounted across / → /memory → /settings
 * INV-9: lazy config fetch (one GET at idle, triggered here on mount)
 *
 * A3a: Three-layer rendering:
 *   Layer 1: ConciergeBall (always when not hidden)
 *   Layer 2: ConciergeToolbar (surfaceState=toolbar)
 *   Layer 3: ConciergePanel / bubble (surfaceState=bubble)
 *
 * Layout: ball + toolbar share a fixed wrapper (data-testid=concierge-ball-wrapper)
 * so toolbar's `absolute bottom-[calc(100%+8px)] right-0` resolves to that wrapper.
 * Panel has its own independent fixed position (viewport-relative).
 *
 * P1-A cloud fix: toolbar was a Fragment sibling of ConciergeBall's wrapper → no
 *   positioned ancestor → absolute toolbar resolved to initial containing block (off-screen).
 *   Fix: shared positioned wrapper so both ball + toolbar live in the same stacking context.
 *
 * P1-B cloud fix: muted=true → ballState=hidden → early return suppressed panel + toolbar,
 *   making the rail-toggle unmute path unreachable. Fix: when muted+surfaceState≠collapsed
 *   (user explicitly opened toolbar via rail toggle), override hidden→sleeping so the cat
 *   body and toolbar both render, allowing access to the panel's "取消静音" control.
 */

import { useEffect } from 'react';
import { projectBallState, useConciergeStore } from '@/stores/conciergeStore';
import { ConciergeBall } from './ConciergeBall';
import { ConciergePanel } from './ConciergePanel';
import { ConciergeToolbar } from './ConciergeToolbar';

export function ConciergeHost() {
  const fetchConfig = useConciergeStore((s) => s.fetchConfig);

  // Lazily load config once (INV-9: only one GET, guard inside fetchConfig)
  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  // P2-A cloud: defer render until config is known — prevents flash of wrong content
  // for users who have enabled=false or muted=true persisted in config.
  // P2 R5: also render if configFailed — network error must not permanently silence the host.
  // All hooks are called above; this conditional return is safe (Rules of Hooks compliant).
  const configLoaded = useConciergeStore((s) => s.configLoaded);
  const configFailed = useConciergeStore((s) => s.configFailed);

  // Derive inputs for projection (subscribe to each field individually to avoid
  // unnecessary re-renders when unrelated store fields change)
  const enabled = useConciergeStore((s) => s.enabled);
  const muted = useConciergeStore((s) => s.muted);
  const invocationStatus = useConciergeStore((s) => s.invocationStatus);
  const pendingConfirmationCount = useConciergeStore((s) => s.pendingConfirmationCount);
  const pendingRelayCount = useConciergeStore((s) => s.pendingRelayCount);
  const unseenResultCount = useConciergeStore((s) => s.unseenResultCount);
  const surfaceState = useConciergeStore((s) => s.surfaceState);
  const inputFocused = useConciergeStore((s) => s.inputFocused);

  // Wait for config before rendering — but if config fetch failed, render with optimistic
  // defaults so ball/panel are still accessible (rail toggle + retry) (P2 R5)
  if (!configLoaded && !configFailed) return null;

  const ballState = projectBallState({
    enabled,
    muted,
    invocationStatus,
    pendingConfirmationCount,
    pendingRelayCount,
    unseenResultCount,
    surfaceState,
    inputFocused,
  });

  // P1-B cloud fix: muted users who explicitly open toolbar/bubble via rail toggle
  // (surfaceState != collapsed) should see the ball + toolbar so the panel's
  // "取消静音" control is reachable. We override hidden → sleeping only in this case.
  // When surfaceState = collapsed the normal INV-3 "muted → zero DOM" is preserved.
  const effectiveBallState =
    ballState === 'hidden' && muted && surfaceState !== 'collapsed' ? ('sleeping' as const) : ballState;

  // INV-3: hidden → zero DOM (no ball, no badge, no tooltip, no toolbar, no bubble)
  if (effectiveBallState === 'hidden') return null;

  return (
    <>
      {/* P1-A cloud fix: shared positioned wrapper for ball + toolbar.
          ConciergeToolbar uses `absolute bottom-[calc(100%+8px)] right-0`; it
          needs a positioned ancestor — this wrapper provides `position: fixed`
          (72px tall, from the ball button) so the toolbar resolves 8px above the cat.
          ConciergeBall's own outer div no longer carries `fixed bottom-6 right-6 z-30`
          (see ConciergeBall.tsx P1-A fix comment). */}
      <div data-testid="concierge-ball-wrapper" className="fixed bottom-6 right-6 z-30 pointer-events-none">
        {/* Layer 1: Cat body */}
        <ConciergeBall ballState={effectiveBallState} />
        {/* Layer 2: Ability toolbar — absolute, resolves relative to this wrapper */}
        <ConciergeToolbar />
      </div>

      {/* Layer 3: Comic bubble — `position: fixed` with explicit viewport coordinates;
          not inside the wrapper above (a fixed ancestor without transform/filter does not
          create a new containing block for fixed descendants per CSS spec) */}
      <ConciergePanel />
    </>
  );
}
