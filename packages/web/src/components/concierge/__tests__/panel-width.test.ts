/**
 * F229 BUG-UX-3 R4: Panel width clamping / initialization pure function tests.
 *
 * Focused regression coverage for the narrow-viewport persistence case
 * that escaped three review rounds: save a width below PANEL_MIN_W on a
 * narrow screen, reload, and keep that saved width through initialization.
 *
 * Pure functions — no React mount needed.
 */

import { describe, expect, it } from 'vitest';
import { clampPanelWidth, PANEL_DEFAULT_W, PANEL_MAX_W, PANEL_MIN_W, resolveInitialPanelWidth } from '../usePanelWidth';

// ---------------------------------------------------------------------------
// clampPanelWidth
// ---------------------------------------------------------------------------

describe('clampPanelWidth', () => {
  it('clamps below PANEL_MIN_W up to PANEL_MIN_W on wide viewport', () => {
    expect(clampPanelWidth(200, 1920)).toBe(PANEL_MIN_W); // 280
  });

  it('passes through a value within [MIN, MAX] on wide viewport', () => {
    expect(clampPanelWidth(400, 1920)).toBe(400);
  });

  it('clamps above PANEL_MAX_W down to PANEL_MAX_W', () => {
    expect(clampPanelWidth(800, 1920)).toBe(PANEL_MAX_W); // 560
  });

  it('viewport constraint wins over PANEL_MIN_W on narrow viewport', () => {
    // viewport 320 → maxViewportW = 272 → effectiveMin = 272 (< 280)
    expect(clampPanelWidth(400, 320)).toBe(272);
  });

  it('returns effectiveMin when requested width is below narrow viewport max', () => {
    // viewport 320 → maxViewportW = 272 → effectiveMin = 272
    // requested 100 < 272 → clamped up to 272
    expect(clampPanelWidth(100, 320)).toBe(272);
  });

  it('handles exact PANEL_MIN_W viewport boundary', () => {
    // viewport = PANEL_MIN_W + 48 = 328 → maxViewportW = 280 = PANEL_MIN_W
    expect(clampPanelWidth(280, 328)).toBe(280);
  });

  it('handles very small viewport gracefully', () => {
    // viewport 100 → maxViewportW = 52 → effectiveMin = 52
    expect(clampPanelWidth(300, 100)).toBe(52);
  });
});

// ---------------------------------------------------------------------------
// resolveInitialPanelWidth
// ---------------------------------------------------------------------------

describe('resolveInitialPanelWidth', () => {
  it('returns saved value when within bounds on wide viewport', () => {
    expect(resolveInitialPanelWidth('400', 1920)).toBe(400);
  });

  it('returns default when no saved value on wide viewport', () => {
    expect(resolveInitialPanelWidth(null, 1920)).toBe(PANEL_DEFAULT_W); // 384
  });

  it('clamps saved value above MAX down to MAX', () => {
    expect(resolveInitialPanelWidth('800', 1920)).toBe(PANEL_MAX_W); // 560
  });

  it('clamps saved value below MIN up to MIN on wide viewport', () => {
    expect(resolveInitialPanelWidth('100', 1920)).toBe(PANEL_MIN_W); // 280
  });

  // KEY REGRESSION: narrow-viewport persistence (R3 finding)
  it('preserves saved width below PANEL_MIN_W on narrow viewport', () => {
    // User on 300px viewport saved 252. On reload (still 300px viewport):
    // maxViewportW = 252, effectiveMin = min(280, 252) = 252
    // saved 252 is valid (finite + positive) → clamp(252, 252) = 252
    expect(resolveInitialPanelWidth('252', 300)).toBe(252);
  });

  it('re-clamps narrow-viewport save to MIN when loaded on wide viewport', () => {
    // User saved 252 on narrow screen, now on 1920px screen:
    // effectiveMin = 280 → saved 252 < 280 → clamped up to 280
    expect(resolveInitialPanelWidth('252', 1920)).toBe(PANEL_MIN_W); // 280
  });

  it('returns clamped default on narrow viewport with no saved value', () => {
    // viewport 300 → maxViewportW = 252 → effectiveMin = 252
    // default 384 → clamped to max(252, min(384, 252)) = 252
    expect(resolveInitialPanelWidth(null, 300)).toBe(252);
  });

  it('handles invalid saved value (NaN) by falling back to default', () => {
    expect(resolveInitialPanelWidth('abc', 1920)).toBe(PANEL_DEFAULT_W); // 384
  });

  it('handles invalid saved value (empty string) by falling back to default', () => {
    expect(resolveInitialPanelWidth('', 1920)).toBe(PANEL_DEFAULT_W); // 384
  });

  it('handles invalid saved value (negative) by falling back to default', () => {
    expect(resolveInitialPanelWidth('-100', 1920)).toBe(PANEL_DEFAULT_W); // 384
  });

  it('handles invalid saved value (zero) by falling back to default', () => {
    expect(resolveInitialPanelWidth('0', 1920)).toBe(PANEL_DEFAULT_W); // 384
  });

  it('handles invalid saved value (Infinity) by falling back to default', () => {
    expect(resolveInitialPanelWidth('Infinity', 1920)).toBe(PANEL_DEFAULT_W); // 384
  });
});
