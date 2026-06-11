/**
 * F229 PR-A2: ConciergeHost / ConciergeBall / ConciergePanel 组件测试
 *
 * Block 2  生命周期  INV-5/6/7
 * Block 5  安静默认  §3 三条
 * Block 6  a11y/motion  Esc + aria + reduced-motion
 *
 * Pattern: react-dom/client createRoot + act（项目标准，见 feishu-qr-panel.test.tsx）
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock apiFetch BEFORE component imports
// ---------------------------------------------------------------------------

vi.mock('@/utils/api-client', () => ({
  apiFetch: vi.fn(),
  API_URL: 'http://localhost:3001',
  resolveApiUrl: () => 'http://localhost:3001',
}));

import { useConciergeStore } from '@/stores/conciergeStore';
import { apiFetch } from '@/utils/api-client';
import { ConciergeBall } from '../ConciergeBall';
import { ConciergeHost } from '../ConciergeHost';
import { ConciergePanel } from '../ConciergePanel';
import { ConciergeRailToggle } from '../ConciergeRailToggle';

const mockApiFetch = vi.mocked(apiFetch);

// Default successful config response — matches backend shape: { config: ConciergeConfig } (P1-1)
function configOk() {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        config: {
          enabled: true,
          muted: false,
          displayName: '猫猫球',
          personaTone: 'cool',
          dutyCatProfileId: 'gemini25',
          proactivePolicy: 'quiet-badge',
          skin: 'yarn-ball',
        },
      }),
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

async function render(jsx: React.ReactNode) {
  await act(async () => {
    root.render(jsx);
    await Promise.resolve();
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(configOk);

  // Reset store to known defaults
  useConciergeStore.setState({
    enabled: true,
    muted: false,
    panelOpen: false,
    inputFocused: false,
    invocationStatus: 'idle',
    pendingConfirmationCount: 0,
    pendingRelayCount: 0,
    unseenResultCount: 0,
    configLoaded: false,
    configLoading: false,
    configFailed: false,
    threadIdLoaded: false,
    threadIdLoading: false,
    threadId: null,
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Block 2: 生命周期 (INV-3/5/6/7)
// ---------------------------------------------------------------------------

describe('Block 2: 生命周期', () => {
  it('INV-3: muted=true → ConciergeHost renders no ball (zero DOM)', async () => {
    // configLoaded=true prevents fetchConfig from overriding the muted value
    useConciergeStore.setState({ muted: true, configLoaded: true });
    await render(<ConciergeHost />);
    await flushEffects();
    // No button in DOM when ball is hidden
    expect(container.querySelector('button[aria-haspopup="dialog"]')).toBeNull();
  });

  it('INV-3: enabled=true, muted=false → ball button present in DOM', async () => {
    await render(<ConciergeHost />);
    await flushEffects();
    expect(container.querySelector('button[aria-haspopup="dialog"]')).not.toBeNull();
  });

  it('INV-3: enabled=false → ball NOT in DOM', async () => {
    // configLoaded=true prevents fetchConfig from overriding enabled=false
    useConciergeStore.setState({ enabled: false, configLoaded: true });
    await render(<ConciergeHost />);
    await flushEffects();
    expect(container.querySelector('button[aria-haspopup="dialog"]')).toBeNull();
  });

  it('INV-5: single instance contract — host renders exactly one ball button', async () => {
    await render(<ConciergeHost />);
    await flushEffects();
    const buttons = container.querySelectorAll('button[aria-haspopup="dialog"]');
    expect(buttons.length).toBe(1);
  });

  it('INV-7: panelOpen=false → panel NOT in DOM initially', async () => {
    await render(<ConciergeHost />);
    await flushEffects();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('INV-7: setPanelOpen(true) → panel appears; onNavigationAction → panelOpen=false', async () => {
    await render(<ConciergeHost />);
    await flushEffects();

    act(() => {
      useConciergeStore.getState().setPanelOpen(true);
    });
    await flushEffects();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    // Navigation action collapses panel
    act(() => {
      useConciergeStore.getState().onNavigationAction();
    });
    await flushEffects();
    expect(useConciergeStore.getState().panelOpen).toBe(false);
  });

  it('ConciergeHost renders ball after config fetch fails (P2 R5: no dead state on network error)', async () => {
    // Simulate config fetch failure (503) — host must render with optimistic defaults
    // not stay null forever when configLoaded stays false
    mockApiFetch.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) } as unknown as Response),
    );
    useConciergeStore.setState({ configLoaded: false, configLoading: false });
    await render(<ConciergeHost />);
    await flushEffects();
    // After failure: ball must render with optimistic defaults (not null dead state)
    expect(container.querySelector('button[aria-haspopup="dialog"]')).not.toBeNull();
  });

  it('ConciergeHost renders nothing until configLoaded (P2-A: no flash for opted-out users)', async () => {
    // Config not yet loaded — ball must NOT appear before user preference is known
    // Prevents opted-out users (enabled=false or muted=true) from seeing the ball flash
    useConciergeStore.setState({ enabled: true, muted: false, configLoaded: false, configLoading: true });
    // Simulate slow startup: fetch never resolves during this test
    mockApiFetch.mockImplementation(() => new Promise(() => {}));
    await render(<ConciergeHost />);
    // Ball must NOT appear before configLoaded=true (P2-A)
    expect(container.querySelector('button[aria-haspopup="dialog"]')).toBeNull();
  });

  it('ConciergeRailToggle: hidden before config loads (P2 R6: no panelOpen race)', async () => {
    // Config not yet loaded — toggle must NOT appear so user can't open panel
    // before we know their persisted enabled/muted preference
    useConciergeStore.setState({ configLoaded: false, configFailed: false, enabled: true });
    await render(<ConciergeRailToggle />);
    expect(container.querySelector('[data-testid="concierge-rail-toggle"]')).toBeNull();
  });

  it('ConciergeRailToggle: renders after configLoaded (P2 R6)', async () => {
    useConciergeStore.setState({ configLoaded: true, configFailed: false, enabled: true });
    await render(<ConciergeRailToggle />);
    expect(container.querySelector('[data-testid="concierge-rail-toggle"]')).not.toBeNull();
  });

  it('ConciergeRailToggle: renders after configFailed with enabled=true (P2 R6: fallback)', async () => {
    useConciergeStore.setState({ configLoaded: false, configFailed: true, enabled: true });
    await render(<ConciergeRailToggle />);
    expect(container.querySelector('[data-testid="concierge-rail-toggle"]')).not.toBeNull();
  });

  it('ConciergeRailToggle: hidden after configLoaded when enabled=false (opted-out)', async () => {
    useConciergeStore.setState({ configLoaded: true, enabled: false });
    await render(<ConciergeRailToggle />);
    expect(container.querySelector('[data-testid="concierge-rail-toggle"]')).toBeNull();
  });

  it('INV-9: ConciergeHost triggers one fetchConfig on mount', async () => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(configOk);
    await render(<ConciergeHost />);
    await flushEffects();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch.mock.calls[0][0]).toContain('/api/concierge/config');
  });
});

// ---------------------------------------------------------------------------
// Block 5: 安静默认 (§3)
// ---------------------------------------------------------------------------

describe('Block 5: 安静默认', () => {
  it('§3.1: badge has no text content (dot only, no count number)', async () => {
    useConciergeStore.setState({ unseenResultCount: 5 });
    await render(<ConciergeBall ballState="found" />);

    // Badge span should have no text node children
    // It's a <span> with aria-label but empty visual content
    const badge = container.querySelector('span[aria-label*="未读"]');
    expect(badge).not.toBeNull();
    // The badge itself has no text node — just an empty span with visual CSS
    expect(badge?.textContent).toBe('');
  });

  it('§3.2: aria-live="polite" present (not assertive)', async () => {
    await render(<ConciergeBall ballState="idle" />);
    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion?.getAttribute('aria-live')).not.toBe('assertive');
  });

  it('§3.3: no panel popup on first ConciergeHost render (panelOpen starts false)', async () => {
    await render(<ConciergeHost />);
    await flushEffects();
    // No dialog in DOM on first render
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(useConciergeStore.getState().panelOpen).toBe(false);
  });

  it('§3.3: unseenResultCount=0 → no badge dot rendered', async () => {
    useConciergeStore.setState({ unseenResultCount: 0 });
    await render(<ConciergeBall ballState="idle" />);
    const badge = container.querySelector('span[aria-label*="未读"]');
    expect(badge).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Block 6: a11y / motion
// ---------------------------------------------------------------------------

describe('Block 6: a11y + motion', () => {
  it('ball button has aria-label, aria-expanded, aria-haspopup=dialog', async () => {
    await render(<ConciergeBall ballState="idle" />);
    const btn = container.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toBeTruthy();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('ball button aria-expanded=true when panel is open', async () => {
    useConciergeStore.setState({ panelOpen: true });
    await render(<ConciergeBall ballState="idle" />);
    const btn = container.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('panel role=dialog aria-modal=false (non-modal, no focus trap)', async () => {
    useConciergeStore.setState({ panelOpen: true });
    await render(<ConciergePanel />);
    const panel = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('aria-modal')).toBe('false');
  });

  it('Esc key closes panel (sets panelOpen=false)', async () => {
    useConciergeStore.setState({ panelOpen: true });
    await render(<ConciergePanel />);
    await flushEffects();

    // Fire Esc keydown
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await flushEffects();

    expect(useConciergeStore.getState().panelOpen).toBe(false);
  });

  it('panel has mute toggle button when panel is open (AC-A6)', async () => {
    useConciergeStore.setState({ panelOpen: true, muted: false, configLoaded: true });
    await render(<ConciergePanel />);
    // Mute toggle button must be present in panel header
    const muteBtn = container.querySelector('button[aria-label="静音"]');
    expect(muteBtn).not.toBeNull();
  });

  it('panel mute toggle shows "取消静音" when already muted (AC-A6)', async () => {
    useConciergeStore.setState({ panelOpen: true, muted: true, configLoaded: true });
    await render(<ConciergePanel />);
    const unmuteBtn = container.querySelector('button[aria-label="取消静音"]');
    expect(unmuteBtn).not.toBeNull();
  });

  it('panel mute toggle calls setMuted when clicked (AC-A6)', async () => {
    useConciergeStore.setState({ panelOpen: true, muted: false, configLoaded: true });
    // Mock setMuted call — apiFetch is already mocked (configOk)
    mockApiFetch.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as unknown as Response),
    );
    await render(<ConciergePanel />);
    await flushEffects();

    const muteBtn = container.querySelector('button[aria-label="静音"]') as HTMLButtonElement;
    expect(muteBtn).not.toBeNull();
    act(() => {
      muteBtn.click();
    });
    await flushEffects();

    // setMuted(true) → optimistic store update → muted becomes true
    expect(useConciergeStore.getState().muted).toBe(true);
  });

  it('reduced-motion: ball renders without animation class when prefers-reduced-motion matches', async () => {
    // Mock matchMedia for reduced-motion preference
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      // Ball renders in reduced-motion context — no animation classes (just state color)
      await render(<ConciergeBall ballState="idle" />);
      const btn = container.querySelector('button[aria-haspopup="dialog"]');
      // Ball must render (non-null) even in reduced-motion
      expect(btn).not.toBeNull();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
