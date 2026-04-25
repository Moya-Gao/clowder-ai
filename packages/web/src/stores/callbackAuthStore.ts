'use client';

/**
 * F174 D2b-2 — global callback-auth health store.
 *
 * Single source of truth for the per-cat status dot. Mounted once at app
 * level via `useCallbackAuthSnapshotProvider()` so ThreadItem participants,
 * Hub roster, and any other CatAvatar callsite can read per-cat status with
 * a tiny zustand selector — no per-callsite polling.
 *
 * 砚砚 P1 #1403: D2b-2 must be daily-visible (not buried inside D2b-3
 * dashboard). The store + selector pattern lets every CatAvatar that
 * matters become a passive consumer of one shared snapshot.
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import {
  type CallbackAuthHealth,
  type CallbackAuthSnapshot,
  type CatCallbackAuthStatus,
  deriveByCat,
  useCallbackAuthSnapshot,
} from '@/hooks/useCallbackAuthSnapshot';

export interface CallbackAuthAggregate {
  byReason: Record<string, number>;
  byTool: Record<string, number>;
  totalFailures24h: number;
  topReasons: Array<{ name: string; count: number }>;
  topTools: Array<{ name: string; count: number }>;
}

interface CallbackAuthState {
  /** Cloud Codex P2 #1403 (round 6): keep the raw snapshot so HubCallbackAuthPanel
   *  can render every field (recentSamples, legacyFallbackHits, etc.) WITHOUT
   *  spawning its own polling instance. Single source of truth for the panel's
   *  byCat list AND CallbackAuthCatAvatar dot status — eliminates split-snapshot
   *  staleness between roster row and avatar. */
  snapshot: CallbackAuthSnapshot | null;
  byCatStatus: Record<string, CatCallbackAuthStatus>;
  aggregate: CallbackAuthAggregate;
  /** false when snapshot fetch fails (non-owner / network) — selectors then return undefined / null defaults. */
  isAvailable: boolean;
  /** Most recent fetch error (null on success). Surfaced to panel so it can render an error banner. */
  lastError: string | null;
  applySnapshot: (snapshot: CallbackAuthSnapshot | null, error?: string | null) => void;
}

const EMPTY_AGGREGATE: CallbackAuthAggregate = {
  byReason: {},
  byTool: {},
  totalFailures24h: 0,
  topReasons: [],
  topTools: [],
};

function topN(record: Record<string, number>, n = 5): Array<{ name: string; count: number }> {
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

export function buildAggregate(snapshot: CallbackAuthSnapshot): CallbackAuthAggregate {
  const r24 = snapshot.recent24h;
  return {
    byReason: { ...r24.byReason },
    byTool: { ...r24.byTool },
    totalFailures24h: r24.totalFailures,
    topReasons: topN(r24.byReason),
    topTools: topN(r24.byTool),
  };
}

export const useCallbackAuthStore = create<CallbackAuthState>((set) => ({
  snapshot: null,
  byCatStatus: {},
  aggregate: EMPTY_AGGREGATE,
  isAvailable: false,
  lastError: null,
  applySnapshot: (snapshot, error) => {
    if (error) {
      set({ isAvailable: false, lastError: error });
      return;
    }
    if (!snapshot) return;
    set({
      snapshot,
      byCatStatus: deriveByCat(snapshot),
      aggregate: buildAggregate(snapshot),
      isAvailable: true,
      lastError: null,
    });
  },
}));

/**
 * Mount-once provider hook — internal use. Prefer `<CallbackAuthSnapshotMount />`
 * over calling this directly: the hook owns useState + re-renders on every
 * fetch tick, so embedding it in a component re-renders that component's whole
 * subtree. Cloud Codex P2 #1403 (round 10): chat layout used to call this
 * directly, causing every 30s ChatContainer + thread tree to re-render.
 */
export function useCallbackAuthSnapshotProvider(options?: { enabled?: boolean; pollIntervalMs?: number }): void {
  const { snapshot, error } = useCallbackAuthSnapshot(options);
  const apply = useCallbackAuthStore((s) => s.applySnapshot);
  useEffect(() => {
    apply(snapshot, error);
  }, [snapshot, error, apply]);
}

/**
 * Render-isolated provider component. Mount once at chat layout level next
 * to ChatContainer. Returns null so re-renders on every poll tick stay
 * confined to this leaf — ChatContainer + thread tree never re-render
 * because of callback-auth polling.
 */
export function CallbackAuthSnapshotMount(props: { enabled?: boolean; pollIntervalMs?: number } = {}): null {
  useCallbackAuthSnapshotProvider(props);
  return null;
}

/** Per-cat selector. Returns undefined when no data (cat had no callback-auth events in 24h). */
export function useCallbackAuthByCat(catId: string | null | undefined): CatCallbackAuthStatus | undefined {
  return useCallbackAuthStore((s) => (catId ? s.byCatStatus[catId] : undefined));
}

/** Aggregate selector for hover popover content. */
export function useCallbackAuthAggregate(): CallbackAuthAggregate {
  return useCallbackAuthStore((s) => s.aggregate);
}

/** Whether the store has at least one successful snapshot. */
export function useCallbackAuthAvailable(): boolean {
  return useCallbackAuthStore((s) => s.isAvailable);
}

/** Most recent fetch error (null on success). Used by HubCallbackAuthPanel banner. */
export function useCallbackAuthError(): string | null {
  return useCallbackAuthStore((s) => s.lastError);
}

/** Raw snapshot — Cloud Codex P2 #1403 unified source for HubCallbackAuthPanel. */
export function useCallbackAuthRawSnapshot(): CallbackAuthSnapshot | null {
  return useCallbackAuthStore((s) => s.snapshot);
}

export type { CallbackAuthHealth };
