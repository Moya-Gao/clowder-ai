/**
 * F095 Phase E: Scroll anchor hook for ThreadSidebar.
 *
 * Problem: When threads reorder (active thread jumps up), the scroll container
 * keeps its pixel scrollTop but the content has shifted — the user loses their place.
 *
 * Solution: On every scroll event, capture the first visible thread element and its
 * position relative to the container. After a reorder re-render, find that element's
 * new position and adjust scrollTop to compensate for the drift.
 */

import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react';

interface ScrollAnchor {
  threadId: string;
  /** Distance from container top to the anchor element top (px) */
  offsetFromTop: number;
}

/** Minimum scrollTop before we bother anchoring (skip when at the top). */
const ANCHOR_THRESHOLD_PX = 40;

/** Minimum drift to correct (avoids sub-pixel jitter). */
const DRIFT_TOLERANCE_PX = 2;

/**
 * Keeps the visible content in place when thread list reorders.
 *
 * @param containerRef - ref to the scrollable container div
 * @param threadGroups - the current sorted/grouped thread data (used as effect dep)
 */
export function useScrollAnchor(
  containerRef: RefObject<HTMLDivElement | null>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  threadGroups: readonly unknown[],
) {
  const anchorRef = useRef<ScrollAnchor | null>(null);

  /** Record the first visible `[data-thread-id]` element as anchor. */
  const captureAnchor = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll('[data-thread-id]');
    const containerTop = container.getBoundingClientRect().top;

    for (const item of items) {
      const rect = item.getBoundingClientRect();
      // First element whose bottom is still visible
      if (rect.bottom > containerTop) {
        anchorRef.current = {
          threadId: item.getAttribute('data-thread-id')!,
          offsetFromTop: rect.top - containerTop,
        };
        return;
      }
    }
  }, [containerRef]);

  /** Scroll handler — attach to the container's onScroll. */
  const onScroll = useCallback(() => {
    captureAnchor();
  }, [captureAnchor]);

  /**
   * After React commits DOM changes (layout phase), check if the anchor
   * element drifted and compensate scrollTop.
   */
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const container = containerRef.current;

    // Don't anchor if user is near the top — let natural reorder show newest items
    if (!anchor || !container || container.scrollTop < ANCHOR_THRESHOLD_PX) return;

    const selector = `[data-thread-id="${CSS.escape(anchor.threadId)}"]`;
    const el = container.querySelector(selector);
    if (!el) return;

    const containerTop = container.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    const drift = elTop - containerTop - anchor.offsetFromTop;

    if (Math.abs(drift) > DRIFT_TOLERANCE_PX) {
      container.scrollTop += drift;
      // Update stored anchor to reflect corrected position
      anchorRef.current = {
        ...anchor,
        offsetFromTop: el.getBoundingClientRect().top - container.getBoundingClientRect().top,
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadGroups]);

  return { onScroll };
}
