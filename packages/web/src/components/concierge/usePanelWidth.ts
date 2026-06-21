/**
 * F229 BUG-UX-3: Panel width state + resize logic.
 *
 * Extracted from ConciergePanel.tsx (gpt52 R5 P1: file exceeded 350-line limit).
 * Contains:
 *   - Width constants (PANEL_MIN_W / MAX / DEFAULT / MARGIN)
 *   - Pure clamping helpers (exported for unit testing)
 *   - usePanelWidth hook (state + localStorage + viewport resize + drag handlers)
 */

import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Panel width constants + pure helpers (exported for testing)
// ---------------------------------------------------------------------------

export const PANEL_MIN_W = 280;
export const PANEL_MAX_W = 560;
export const PANEL_DEFAULT_W = 384; // was w-80=320, widened for readability
export const PANEL_MARGIN = 48; // 24px margin each side

/** Clamp a width to viewport bounds. Viewport constraint ALWAYS wins over PANEL_MIN_W —
 *  a too-narrow panel is better than one that overflows the left edge. */
export function clampPanelWidth(w: number, viewportWidth: number): number {
  const maxViewportW = viewportWidth - PANEL_MARGIN;
  const effectiveMin = Math.min(PANEL_MIN_W, maxViewportW);
  return Math.max(effectiveMin, Math.min(w, PANEL_MAX_W, maxViewportW));
}

/** Resolve the initial panel width from a localStorage value + current viewport.
 *  Accepts any positive finite saved value; clamp handles viewport bounds. */
export function resolveInitialPanelWidth(saved: string | null, viewportWidth: number): number {
  const maxViewportW = viewportWidth - PANEL_MARGIN;
  const effectiveMin = Math.min(PANEL_MIN_W, maxViewportW);
  const effectiveMax = Math.min(PANEL_MAX_W, maxViewportW);
  if (saved) {
    const n = Number(saved);
    if (Number.isFinite(n) && n > 0) {
      return Math.max(effectiveMin, Math.min(n, effectiveMax));
    }
  }
  return Math.max(effectiveMin, Math.min(PANEL_DEFAULT_W, effectiveMax));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const PANEL_STORAGE_KEY = 'concierge-panel-width';

export interface UsePanelWidthReturn {
  panelWidth: number;
  handleResizePointerDown: (e: PointerEvent) => void;
  handleResizePointerMove: (e: PointerEvent) => void;
  handleResizePointerUp: () => void;
}

export function usePanelWidth(): UsePanelWidthReturn {
  const clampWidth = useCallback((w: number) => {
    if (typeof window === 'undefined') return w;
    return clampPanelWidth(w, window.innerWidth);
  }, []);

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return PANEL_DEFAULT_W;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(PANEL_STORAGE_KEY);
    } catch {
      // Storage unavailable (restricted iframe / corporate policy) — use default
    }
    return resolveInitialPanelWidth(saved, window.innerWidth);
  });

  const resizeDragRef = useRef<{ startX: number; startW: number } | null>(null);

  // Cloud P2: re-clamp panel width on viewport resize (e.g. device rotation,
  // window resize while panel is saved at a wider width than the new viewport)
  useEffect(() => {
    const handleResize = () => {
      setPanelWidth((prev) => clampPanelWidth(prev, window.innerWidth));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleResizePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeDragRef.current = { startX: e.clientX, startW: panelWidth };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [panelWidth],
  );

  const handleResizePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!resizeDragRef.current) return;
      // Panel grows leftward (anchored right-6), so moving left = wider
      const delta = resizeDragRef.current.startX - e.clientX;
      const newW = clampWidth(resizeDragRef.current.startW + delta);
      setPanelWidth(newW);
    },
    [clampWidth],
  );

  const handleResizePointerUp = useCallback(() => {
    if (!resizeDragRef.current) return;
    resizeDragRef.current = null;
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, String(panelWidth));
    } catch {
      // Storage unavailable — width not persisted, non-critical
    }
  }, [panelWidth]);

  return { panelWidth, handleResizePointerDown, handleResizePointerMove, handleResizePointerUp };
}
