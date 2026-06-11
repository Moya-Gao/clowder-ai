'use client';

/**
 * F229 PR-A2: ConciergeHost — always-mounted root entry point
 *
 * INV-5: single AppShell instance (mounted at root alongside FloatingPresentationSurfaceHost)
 * INV-6: route survival — host stays mounted across / → /memory → /settings
 * INV-9: lazy config fetch (one GET at idle, triggered here on mount)
 */

import { useEffect } from 'react';
import { projectBallState, useConciergeStore } from '@/stores/conciergeStore';
import { ConciergeBall } from './ConciergeBall';
import { ConciergePanel } from './ConciergePanel';

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
  const panelOpen = useConciergeStore((s) => s.panelOpen);
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
    panelOpen,
    inputFocused,
  });

  // INV-3: hidden → zero DOM (no ball, no badge, no tooltip)
  return (
    <>
      {ballState !== 'hidden' && <ConciergeBall ballState={ballState} />}
      {/* Panel always rendered conditionally via store (INV-6: panel state survives route) */}
      <ConciergePanel />
    </>
  );
}
