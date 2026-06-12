/**
 * F232 P2 (cloud review): ArtifactsToggle state-transition regression.
 * Tests the exported artifactsToggleTransition from ChatContainerHeader.
 *
 * Bug: when the drawer is closed via the panel's own close/collapse controls,
 * statusPanelOpen becomes false but rightPanelMode stays 'artifacts'. Clicking the
 * 产物 button must reopen the artifacts view — not toggle to status based on the
 * stale 'artifacts' mode.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { artifactsToggleTransition } from '../ChatContainerHeader';

describe('F232 ArtifactsToggle transition', () => {
  let panelOpen: boolean;
  let mode: 'status' | 'workspace' | 'transcript' | 'artifacts';
  const togglePanel = () => {
    panelOpen = !panelOpen;
  };
  const setMode = (m: 'status' | 'workspace' | 'transcript' | 'artifacts') => {
    mode = m;
  };

  beforeEach(() => {
    panelOpen = false;
    mode = 'status';
  });

  it('closed with stale artifacts mode → opens panel and forces artifacts (not status)', () => {
    // Repro: user closed the drawer via panel controls; mode left at 'artifacts'.
    panelOpen = false;
    mode = 'artifacts';

    artifactsToggleTransition(panelOpen, mode, {
      onToggleStatusPanel: togglePanel,
      setRightPanelMode: setMode,
    });

    expect(panelOpen).toBe(true);
    expect(mode).toBe('artifacts'); // stale-mode toggle bug would set 'status'
  });

  it('closed with status mode → opens panel in artifacts', () => {
    panelOpen = false;
    mode = 'status';

    artifactsToggleTransition(panelOpen, mode, {
      onToggleStatusPanel: togglePanel,
      setRightPanelMode: setMode,
    });

    expect(panelOpen).toBe(true);
    expect(mode).toBe('artifacts');
  });

  it('open + artifacts → toggles off to status without closing the panel', () => {
    panelOpen = true;
    mode = 'artifacts';
    const spy = vi.fn(togglePanel);

    artifactsToggleTransition(panelOpen, mode, {
      onToggleStatusPanel: spy,
      setRightPanelMode: setMode,
    });

    expect(spy).not.toHaveBeenCalled();
    expect(panelOpen).toBe(true);
    expect(mode).toBe('status');
  });

  it('open + status → switches to artifacts without toggling the panel', () => {
    panelOpen = true;
    mode = 'status';
    const spy = vi.fn(togglePanel);

    artifactsToggleTransition(panelOpen, mode, {
      onToggleStatusPanel: spy,
      setRightPanelMode: setMode,
    });

    expect(spy).not.toHaveBeenCalled();
    expect(panelOpen).toBe(true);
    expect(mode).toBe('artifacts');
  });

  it('open + workspace → switches to artifacts without toggling the panel', () => {
    panelOpen = true;
    mode = 'workspace';
    const spy = vi.fn(togglePanel);

    artifactsToggleTransition(panelOpen, mode, {
      onToggleStatusPanel: spy,
      setRightPanelMode: setMode,
    });

    expect(spy).not.toHaveBeenCalled();
    expect(panelOpen).toBe(true);
    expect(mode).toBe('artifacts');
  });
});
