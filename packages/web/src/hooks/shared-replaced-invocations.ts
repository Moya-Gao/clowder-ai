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

const replacedInvocations = new Map<string, string>();

/** Compose the canonical stream key shared between active + background handlers. */
export function makeReplacedKey(threadId: string, catId: string): string {
  return `${threadId}::${catId}`;
}

/** Mark an invocation as replaced (by callback). Idempotent overwrite. */
export function markReplacedInvocation(threadId: string, catId: string, invocationId: string): void {
  replacedInvocations.set(makeReplacedKey(threadId, catId), invocationId);
}

/** Read the currently-replaced invocation id for a (threadId, catId) pair. */
export function getReplacedInvocation(threadId: string, catId: string): string | undefined {
  return replacedInvocations.get(makeReplacedKey(threadId, catId));
}

/** Clear the replaced flag once we observe a different invocation (caller decides when). */
export function clearReplacedInvocation(threadId: string, catId: string): void {
  replacedInvocations.delete(makeReplacedKey(threadId, catId));
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

/** Read-only snapshot for debug / observability. */
export function snapshotSharedReplacedInvocations(): Map<string, string> {
  return new Map(replacedInvocations);
}
