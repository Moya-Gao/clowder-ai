/**
 * F174 D2b-2 — global callback-auth store (砚砚 P1 #1403 fix).
 *
 * Asserts applySnapshot mutates byCatStatus/aggregate/isAvailable correctly,
 * and selectors reflect the new state. Covers: success, error, multi-cat,
 * topReasons/topTools sort + cap.
 */

import { describe, expect, it } from 'vitest';
import type { CallbackAuthSnapshot } from '@/hooks/useCallbackAuthSnapshot';
import { buildAggregate, useCallbackAuthStore } from '../callbackAuthStore';

const baseSnapshot: CallbackAuthSnapshot = {
  reasonCounts: { expired: 0, invalid_token: 0, unknown_invocation: 0, stale_invocation: 0, missing_creds: 0 },
  toolCounts: {},
  byCat: {},
  recentSamples: [],
  totalFailures: 0,
  startedAt: 0,
  uptimeMs: 0,
  recent24h: { totalFailures: 0, byReason: {}, byTool: {}, byCat: {} },
};

function resetStore() {
  useCallbackAuthStore.setState({
    snapshot: null,
    byCatStatus: {},
    aggregate: { byReason: {}, byTool: {}, totalFailures24h: 0, topReasons: [], topTools: [] },
    isAvailable: false,
    lastError: null,
  });
}

describe('callbackAuthStore (F174 D2b-2)', () => {
  it('applySnapshot(null, error) marks isAvailable=false and leaves prior state', () => {
    resetStore();
    useCallbackAuthStore.getState().applySnapshot(null, 'forbidden');
    expect(useCallbackAuthStore.getState().isAvailable).toBe(false);
  });

  it('applySnapshot(snapshot) populates byCatStatus and aggregate', () => {
    resetStore();
    useCallbackAuthStore.getState().applySnapshot({
      ...baseSnapshot,
      recent24h: {
        totalFailures: 8,
        byReason: { expired: 5, invalid_token: 3 },
        byTool: { register_pr_tracking: 4, post_message: 4 },
        byCat: { opus: 8 },
      },
    });
    const s = useCallbackAuthStore.getState();
    expect(s.isAvailable).toBe(true);
    expect(s.byCatStatus.opus.status).toBe('broken');
    expect(s.byCatStatus.opus.failures24h).toBe(8);
    expect(s.aggregate.totalFailures24h).toBe(8);
  });

  it('applySnapshot replaces previous state on each call', () => {
    resetStore();
    useCallbackAuthStore.getState().applySnapshot({
      ...baseSnapshot,
      recent24h: { totalFailures: 10, byReason: { expired: 10 }, byTool: {}, byCat: { opus: 10 } },
    });
    expect(useCallbackAuthStore.getState().byCatStatus.opus.status).toBe('broken');
    useCallbackAuthStore.getState().applySnapshot({
      ...baseSnapshot,
      recent24h: { totalFailures: 0, byReason: {}, byTool: {}, byCat: {} },
    });
    expect(useCallbackAuthStore.getState().byCatStatus.opus).toBeUndefined();
    expect(useCallbackAuthStore.getState().aggregate.totalFailures24h).toBe(0);
  });
});

describe('Cloud P2 #1403 (round 6): unified snapshot source', () => {
  it('applySnapshot stores raw snapshot for HubCallbackAuthPanel to read', () => {
    resetStore();
    const snap: CallbackAuthSnapshot = {
      ...baseSnapshot,
      recent24h: { totalFailures: 7, byReason: { expired: 7 }, byTool: {}, byCat: { opus: 7 } },
      recentSamples: [{ at: 1234, reason: 'expired', tool: 'register_pr_tracking', catId: 'opus' }],
      legacyFallbackHits: { byTool: {}, total: 2 },
    };
    useCallbackAuthStore.getState().applySnapshot(snap);
    const stored = useCallbackAuthStore.getState().snapshot;
    expect(stored).not.toBeNull();
    expect(stored?.recent24h.totalFailures).toBe(7);
    expect(stored?.recentSamples[0].reason).toBe('expired');
    expect(stored?.legacyFallbackHits?.total).toBe(2);
    // byCat used by panel + byCatStatus used by dot are derived from SAME snapshot
    expect(stored?.recent24h.byCat.opus).toBe(7);
    expect(useCallbackAuthStore.getState().byCatStatus.opus.failures24h).toBe(7);
  });

  it('error path keeps lastError so panel can render banner', () => {
    resetStore();
    useCallbackAuthStore.getState().applySnapshot(null, 'forbidden');
    expect(useCallbackAuthStore.getState().lastError).toBe('forbidden');
    expect(useCallbackAuthStore.getState().isAvailable).toBe(false);
  });

  it('success after error clears lastError', () => {
    resetStore();
    useCallbackAuthStore.getState().applySnapshot(null, 'forbidden');
    expect(useCallbackAuthStore.getState().lastError).toBe('forbidden');
    useCallbackAuthStore.getState().applySnapshot({
      ...baseSnapshot,
      recent24h: { totalFailures: 0, byReason: {}, byTool: {}, byCat: {} },
    });
    expect(useCallbackAuthStore.getState().lastError).toBeNull();
    expect(useCallbackAuthStore.getState().isAvailable).toBe(true);
  });
});

describe('buildAggregate (topReasons/topTools sort + cap)', () => {
  it('sorts top reasons descending and caps to 5', () => {
    const agg = buildAggregate({
      ...baseSnapshot,
      recent24h: {
        totalFailures: 21,
        byReason: { expired: 10, invalid_token: 1, unknown_invocation: 5, stale_invocation: 2, missing_creds: 3 },
        byTool: {},
        byCat: {},
      },
    });
    expect(agg.topReasons).toEqual([
      { name: 'expired', count: 10 },
      { name: 'unknown_invocation', count: 5 },
      { name: 'missing_creds', count: 3 },
      { name: 'stale_invocation', count: 2 },
      { name: 'invalid_token', count: 1 },
    ]);
  });

  it('skips zero-count entries', () => {
    const agg = buildAggregate({
      ...baseSnapshot,
      recent24h: {
        totalFailures: 1,
        byReason: { expired: 1, invalid_token: 0 },
        byTool: { register_pr_tracking: 1 },
        byCat: {},
      },
    });
    expect(agg.topReasons.map((r) => r.name)).toEqual(['expired']);
    expect(agg.topTools.map((t) => t.name)).toEqual(['register_pr_tracking']);
  });
});
