/**
 * Regression test: reconcileThread seq guard prevents stale GET from
 * overwriting a newer user intent.
 *
 * Scenario:
 *   1. User pins thread → PATCH fails (500)
 *   2. reconcileThread fires GET to fetch server truth
 *   3. Before GET returns, user unpins → new PATCH in flight (seq increments)
 *   4. GET returns with { pinned: true } — but seq has moved → must NOT apply
 *
 * This test replicates the seq-guard pattern from ThreadSidebar without
 * rendering the full component tree (too many deps: router, TaskPanel, etc).
 */

import { describe, it, expect } from 'vitest';

// ---------- controlled promise helpers ----------

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

// ---------- replicate the seq-guard logic from ThreadSidebar ----------

/**
 * Minimal extraction of the handleTogglePin + reconcileThread pattern.
 * Uses the same Map<string, number> ref-based seq guard as production code.
 */
function createPinToggleHandler(onUpdate: (threadId: string, pinned: boolean) => void) {
  const pinSeqMap = new Map<string, number>();

  async function reconcileThread(
    threadId: string,
    expectedPinSeq: number,
    fetcher: () => Promise<{ ok: boolean; json: () => Promise<{ pinned?: boolean }> }>,
  ) {
    try {
      const res = await fetcher();
      if (!res.ok) return;
      const t = await res.json();
      // Seq guard: only apply if no newer request since reconcile was triggered
      if (t.pinned !== undefined && pinSeqMap.get(threadId) === expectedPinSeq) {
        onUpdate(threadId, t.pinned);
      }
    } catch { /* best-effort */ }
  }

  async function handleTogglePin(
    threadId: string,
    pinned: boolean,
    patchFetcher: () => Promise<{ ok: boolean; json: () => Promise<{ pinned?: boolean }> }>,
    reconcileFetcher: () => Promise<{ ok: boolean; json: () => Promise<{ pinned?: boolean }> }>,
  ) {
    const seq = (pinSeqMap.get(threadId) ?? 0) + 1;
    pinSeqMap.set(threadId, seq);
    try {
      const res = await patchFetcher();
      if (!res.ok) {
        if (pinSeqMap.get(threadId) === seq) {
          void reconcileThread(threadId, seq, reconcileFetcher);
        }
        return;
      }
      if (pinSeqMap.get(threadId) !== seq) return;
      const updated = await res.json();
      onUpdate(threadId, updated.pinned ?? pinned);
    } catch {
      if (pinSeqMap.get(threadId) === seq) {
        void reconcileThread(threadId, seq, reconcileFetcher);
      }
    }
  }

  return { handleTogglePin, _seqMap: pinSeqMap };
}

// ---------- tests ----------

describe('reconcileThread seq guard (race regression)', () => {
  it('stale reconcile GET does not overwrite newer toggle intent', async () => {
    const updates: { threadId: string; pinned: boolean }[] = [];
    const onUpdate = (threadId: string, pinned: boolean) => {
      updates.push({ threadId, pinned });
    };
    const { handleTogglePin } = createPinToggleHandler(onUpdate);

    const patchFail = deferred<{ ok: boolean; json: () => Promise<{ pinned?: boolean }> }>();
    const reconcileGet = deferred<{ ok: boolean; json: () => Promise<{ pinned?: boolean }> }>();
    const patchSuccess = deferred<{ ok: boolean; json: () => Promise<{ pinned?: boolean }> }>();
    const reconcileGet2 = deferred<{ ok: boolean; json: () => Promise<{ pinned?: boolean }> }>();

    // Step 1: User pins thread → PATCH will fail
    const toggle1 = handleTogglePin('t1', true, () => patchFail.promise, () => reconcileGet.promise);

    // Step 1a: PATCH returns 500 → reconcile fires (reconcileGet is now in flight)
    patchFail.resolve({ ok: false, json: () => Promise.resolve({}) });
    await toggle1; // Let toggle1 fully settle (fires reconcile in background)

    // Step 2: Before reconcile GET returns, user clicks unpin → seq increments to 2
    const toggle2 = handleTogglePin('t1', false, () => patchSuccess.promise, () => reconcileGet2.promise);

    // Step 3: reconcile GET from step 1 returns { pinned: true } — seq was 1, now it's 2 → SKIP
    reconcileGet.resolve({
      ok: true,
      json: () => Promise.resolve({ pinned: true }),
    });
    // Let the reconcile microtask process
    await new Promise(r => setTimeout(r, 0));

    // Assert: the stale GET should NOT have written pinned=true
    expect(updates.filter(u => u.pinned === true)).toHaveLength(0);

    // Step 4: Second PATCH succeeds with { pinned: false }
    patchSuccess.resolve({
      ok: true,
      json: () => Promise.resolve({ pinned: false }),
    });
    await toggle2;

    // Final: store has exactly one update — pinned=false from the latest toggle
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ threadId: 't1', pinned: false });
  });

  it('reconcile GET applies when no newer toggle has fired', async () => {
    const updates: { threadId: string; pinned: boolean }[] = [];
    const onUpdate = (threadId: string, pinned: boolean) => {
      updates.push({ threadId, pinned });
    };
    const { handleTogglePin } = createPinToggleHandler(onUpdate);

    const patchFail = deferred<{ ok: boolean; json: () => Promise<{ pinned?: boolean }> }>();
    const reconcileGet = deferred<{ ok: boolean; json: () => Promise<{ pinned?: boolean }> }>();

    // Toggle → PATCH fails → reconcile fires
    const toggle = handleTogglePin('t1', true, () => patchFail.promise, () => reconcileGet.promise);
    patchFail.resolve({ ok: false, json: () => Promise.resolve({}) });
    await toggle;

    // Reconcile GET returns — no newer toggle, so seq matches → APPLY
    reconcileGet.resolve({
      ok: true,
      json: () => Promise.resolve({ pinned: false }),
    });
    await new Promise(r => setTimeout(r, 0));

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ threadId: 't1', pinned: false });
  });
});
