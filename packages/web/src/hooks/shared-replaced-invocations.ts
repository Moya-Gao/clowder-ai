/**
 * F173 Phase A.6 — Shared `replaced invocations` runtime state (bidirectional handoff).
 *
 * 砚砚 review P1-1 round 2: A.5 only fixed background → active. The reverse direction
 * (active callback replace → user switches away → late stream lands in background) was
 * still broken because `replacedInvocationsRef` (active) and `bgReplacedInvocationsRef`
 * (background) lived in different React refs.
 *
 * This module is a single source of truth: both handlers (active in `useAgentMessages.ts`
 * and background in `useSocket-background.ts` + `useSocket.ts`) read/write the same Map,
 * keyed by `${threadId}::${catId}`. Whichever side first marks an invocation as "replaced
 * by callback", the other side will see it and drop late stream chunks accordingly.
 *
 * Lifetime: process-singleton (runtime-only, NOT in zustand per spec KD-3). Tests reset
 * via `resetSharedReplacedInvocations()` to avoid cross-test pollution.
 *
 * This is a stepping stone toward Phase B AC-B1 (full thread-scoped runtime refs Map);
 * for now we only collapse the one ref that has cross-handler suppression semantics.
 */

// Cloud P2 (PR#1352): storage upgraded from Map<key, string> to Map<key, Set<string>>
// so multiple in-flight stale invocations per (thread, cat) can be tracked. Earlier
// single-value storage overwrote earlier invocations when invocation_created closed
// multiple stale bubbles, leaving them un-suppressed and reopen-able.
const replacedInvocations = new Map<string, Set<string>>();

/** Compose the canonical stream key shared between active + background handlers. */
export function makeReplacedKey(threadId: string, catId: string): string {
  return `${threadId}::${catId}`;
}

/** Mark an invocation as replaced (by callback or boundary closure). Idempotent. */
export function markReplacedInvocation(threadId: string, catId: string, invocationId: string): void {
  const key = makeReplacedKey(threadId, catId);
  let set = replacedInvocations.get(key);
  if (!set) {
    set = new Set<string>();
    replacedInvocations.set(key, set);
  }
  set.add(invocationId);
}

/** Membership check: is this specific invocationId replaced for the (threadId, catId) pair? */
export function isInvocationReplaced(threadId: string, catId: string, invocationId: string): boolean {
  return replacedInvocations.get(makeReplacedKey(threadId, catId))?.has(invocationId) ?? false;
}

/**
 * Read any one stored invocationId (legacy single-value API).
 * Returns the most recently added value (insertion order). Prefer
 * `isInvocationReplaced` for membership checks.
 */
export function getReplacedInvocation(threadId: string, catId: string): string | undefined {
  const set = replacedInvocations.get(makeReplacedKey(threadId, catId));
  if (!set || set.size === 0) return undefined;
  let last: string | undefined;
  for (const v of set) last = v;
  return last;
}

/** Clear ALL replaced invocations for a (threadId, catId) pair. */
export function clearReplacedInvocation(threadId: string, catId: string): void {
  replacedInvocations.delete(makeReplacedKey(threadId, catId));
}

/** Remove a single invocationId from the replaced set (cloud P2 — surgical clear). */
export function removeReplacedInvocation(threadId: string, catId: string, invocationId: string): void {
  const set = replacedInvocations.get(makeReplacedKey(threadId, catId));
  if (!set) return;
  set.delete(invocationId);
  if (set.size === 0) replacedInvocations.delete(makeReplacedKey(threadId, catId));
}

/** Test-only: reset all entries (call from beforeEach). */
export function resetSharedReplacedInvocations(): void {
  replacedInvocations.clear();
}

/**
 * F173 receive-review fix for砚砚 P1 round 3 — clear ONLY the entries that belong to a
 * specific thread, leaving suppression set for other threads intact. Used by `handleStop`
 * and `resetRefs` (thread switch) — global reset would erase background threads' active
 * suppression and let late stream chunks overwrite their authoritative callback content.
 */
export function clearReplacedInvocationsForThread(threadId: string): void {
  const prefix = `${threadId}::`;
  for (const key of [...replacedInvocations.keys()]) {
    if (key.startsWith(prefix)) replacedInvocations.delete(key);
  }
}

/** Read-only snapshot for debug / observability. Set entries cloned per key. */
export function snapshotSharedReplacedInvocations(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [k, v] of replacedInvocations) out.set(k, new Set(v));
  return out;
}
