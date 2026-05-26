---
title: F194 lifecycle event driven recovery plan
date: 2026-05-26
status: draft
owner: codex
feature_ids: [F194]
related_prs: [1900]
---

# F194 Lifecycle Event Driven Recovery Implementation Plan

**Feature:** F194 — `docs/features/F194-invocation-liveness-canonical-read-model.md`
**Goal:** Repair zombie invocation queue state without making `reconcileZombies()` orchestrate queue, slot, socket, and task-progress internals.
**Acceptance Criteria:**
- Zombie cleanup marks stale `running` records terminal and clears user-visible progress.
- Stale queue `processing` rows and QueueProcessor cat slots are recovered when, and only when, the lifecycle owner is the stale invocation.
- Normal completion and zombie cleanup share the same resource cleanup pipeline.
- Recovery respects cross-user dispatch, namespace-aware liveness, already-terminal retries, paused-slot backoff, and replacement invocation ownership.
- The read endpoints do not need queue-internal cleanup knowledge.
**Architecture cell:** `domains/cats/services/agents/invocation`
**Map delta:** none
**Map delta why:** This stays inside the existing invocation runtime ownership area; no new top-level subsystem boundary is needed.
**Architecture:** Introduce a lifecycle event boundary emitted on invocation terminal transitions. Resource owners subscribe to that event and perform their own cleanup behind narrow contracts. `reconcileZombies()` returns to lifecycle ownership: detect zombie, mark terminal, emit the same terminal event used by normal completion.
**Tech Stack:** TypeScript, Node test runner, existing InvocationRecordStore / InvocationQueue / QueueProcessor / TaskProgressStore / SocketManager.
**前端验证:** No frontend UI change; runtime verification uses queue API responses and existing queue/socket events.

---

## Finish Line

The finish line is a mergeable F194 recovery change where `reconcileZombies()` no longer imports or knows `InvocationQueue`, `QueueProcessor`, or `SocketManager`, while the stale processing row and slot hang from PR #1900 is still fixed through a shared lifecycle cleanup pipeline.

Not building:
- An admin recovery endpoint.
- A broad queue scheduler rewrite.
- A second ad hoc zombie cleanup path that only read endpoints call.

## Terminal Schema

```ts
type InvocationTerminalReason =
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'zombie_record_detected';

interface InvocationLifecycleEvent {
  invocationId: string;
  threadId: string;
  userId: string;
  catId: CatId | null;
  targetCats: CatId[];
  status: 'succeeded' | 'failed' | 'canceled';
  reason: InvocationTerminalReason;
  source: 'normal_completion' | 'zombie_reconcile' | 'cancel' | 'steer';
  terminalAt: number;
  recordUpdatedAt: number;
}

interface InvocationLifecycleCleanupResult {
  taskProgressCleared: boolean;
  queueEntriesRecovered: number;
  queueSlotsReleased: number;
  queueNextKicked: number;
  errors: number;
}
```

The event is the contract. Resource owners may add internal safeguards, but callers must not reach into those safeguards directly.

Atomicity contract: terminal state transition and lifecycle event emission must be observable atomically by all cleanup subscribers. The implementation must use either a store-level transaction boundary or an outbox-style record at the `InvocationRecordStore` layer so `record.status=failed` cannot persist without a corresponding cleanup event.

## Invariant Catalog From PR #1900

These review findings become required tests for the new design:

1. **Slot ownership:** a cleanup event must not release a replacement invocation's same-cat slot.
2. **Cross-user dispatch:** after freeing a system/shared thread slot, the scheduler must scan all users for the next dispatchable entry.
3. **Zombie reason safety:** queue recovery only runs when namespace-aware liveness proves the stale owner is dead.
4. **Namespace bridge:** legacy callers without invocation registry proof must not perform destructive queue-state recovery.
5. **Already-terminal retry:** a repeated cleanup event must be able to finish partial cleanup after a crash.
6. **Paused slot:** cleanup must not bypass failed/canceled slot backoff or manual resume semantics.
7. **Method ownership:** queue cleanup logic must live on the owning class so method receiver binding is not part of the call-site contract.
8. **Lifecycle event atomicity:** terminal record transition and event emission must not split; no terminal record may be left without a recoverable cleanup event.
9. **Normal completion coverage:** every current normal-completion cleanup callsite must be inventoried before replacement so the shared pipeline really replaces existing cleanup behavior.

Roundtable coverage notes:
- Invariant 4 needs an explicit emitter-gating test. It is not enough that the new event boundary makes legacy callers unlikely to reach destructive cleanup; tests must prove callers without namespace-aware proof cannot emit a destructive terminal recovery event.
- Invariant 5 needs an explicit idempotent-retry test. Replaying the same terminal event after partial cleanup must finish missing cleanup without double-releasing slots or double-removing queue rows.
- Invariant 8 needs an atomicity test around record transition + event persistence/dispatch.
- Invariant 9 needs a normal-completion audit artifact before implementation touches cleanup callsites.

## Invariant To Test Matrix

| Invariant | Test target | Required test name |
|-----------|-------------|--------------------|
| 1. Slot ownership | `queue-processor.test.js` | `recoverTerminalInvocation preserves replacement slot owned by a different invocationId` |
| 2. Cross-user dispatch | `queue-processor.test.js` | `recoverTerminalInvocation resumes dispatch across users after stale owner cleanup` |
| 3. Zombie reason safety | `f194-canonical-liveness-routes.test.js` | `zombie terminal event is emitted only for queue-recovery-safe zombie reasons` |
| 4. Namespace bridge | `invocation-lifecycle-events.test.js` | `legacy liveness callers cannot emit destructive queue recovery events without namespace proof` |
| 5. Already-terminal retry | `invocation-lifecycle-cleanup.test.js` | `replaying terminal cleanup event completes partial cleanup idempotently` |
| 6. Paused slot | `queue-processor.test.js` | `recoverTerminalInvocation does not kick dispatch while slot is paused` |
| 7. Method ownership | `queue-processor.test.js` | `queue recovery logic executes as QueueProcessor-owned method` |
| 8. Lifecycle event atomicity | `invocation-lifecycle-events.test.js` | `terminal record transition cannot commit without persisted lifecycle event` |
| 9. Normal completion coverage | `invocation-lifecycle-cleanup.test.js` | `normal completion cleanup callsites are covered by lifecycle pipeline inventory` |

## Task 0: Test Inventory From PR #1900

**Files:**
- Create: `docs/plans/2026-05-26-f194-pr1900-invariant-test-inventory.md`
- Read-only reference: PR #1900 pre-reset head `bdae63030`

**Step 1: Extract old hotfix tests**

Run:

```bash
git diff --unified=0 origin/main..bdae63030 -- packages/api/test/reconcileZombies.test.js packages/api/test/f194-canonical-liveness-routes.test.js packages/api/test/invocation-queue.test.js packages/api/test/queue-processor.test.js | rg '^\+\s+it\('
```

Initial extracted tests:
- `cloud P2: /queue skips queue-state recovery when namespace bridge is absent`
- `removeStaleProcessingForCat removes only stale processing entries for the target cat`
- `releaseSlotIfStartedBefore preserves newer replacement slots`
- `already-terminal zombie recovers stale queue state with age-gated slot release`
- `already-terminal zombie does not release a newer replacement slot`
- `kicks the cross-user scheduler after zombie queue recovery`
- `does not kick recovered queue while the cat slot is paused`
- `does not kick queue when no stale row or slot was recovered`
- `does not release queue state for cat-slot-reuse zombies`

**Step 2: Translate tests into invariant targets**

For each old test, write which new invariant/test target replaces it. Do not copy the old implementation shape (`catId + timestamp`); preserve the behavioral invariant only.

**Step 3: Verify**

The inventory doc must map every old test above to one of the nine invariants in this plan.

## Task 1: Add Lifecycle Event Contract

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/invocation/InvocationLifecycleEvents.ts`
- Test: `packages/api/test/invocation-lifecycle-events.test.js`

**Step 1: Write failing schema tests**

Assert that terminal lifecycle events can represent normal completion and zombie reconciliation with `invocationId`, `threadId`, `userId`, `catId`, `targetCats`, `status`, `reason`, `source`, and timestamps.

Add emitter-gating coverage:
- normal completion can construct a terminal lifecycle event from an owned invocation record;
- zombie reconciliation can construct a destructive recovery event only when namespace-aware liveness produced the zombie;
- legacy read callers without invocation registry proof cannot construct a destructive queue-recovery event.

**Step 2: Implement types and small helpers**

Add event types and helper constructors only. Do not wire cleanup yet.

**Step 3: Verify**

Run:

```bash
pnpm --dir packages/api build
node --test packages/api/test/invocation-lifecycle-events.test.js
```

## Task 1.5: Audit Normal Completion Cleanup Sites

**Files:**
- Create: `docs/plans/2026-05-26-f194-normal-completion-cleanup-audit.md`
- Read: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts`
- Read: `packages/api/src/routes/messages.ts`
- Read: `packages/api/src/routes/queue.ts`

**Step 1: Inventory current cleanup callsites**

Run:

```bash
rg -n "processingSlots\\.delete|releaseSlot\\(|removeProcessed|removeProcessedAcrossUsers|onInvocationComplete|queue_updated|clearPause|tryExecuteNext" packages/api/src/domains/cats/services/agents/invocation packages/api/src/routes/messages.ts packages/api/src/routes/queue.ts
```

Initial audit targets:
- `QueueProcessor.onInvocationComplete(...)`: system completion path that pauses/resumes and dispatches next work.
- `QueueProcessor.tryAutoExecute(...)`, `tryExecuteNextAcrossUsers(...)`, `tryExecuteNextForUser(...)`: fire-and-forget execution paths that delete `processingSlots` and call `onInvocationComplete`.
- `QueueProcessor.executeEntry(...)`: removes processed rows and emits `queue_updated`.
- `routes/messages.ts`: force/immediate cancellation clears pause, releases slot, emits queue update, and calls `onInvocationComplete` for background completion.
- `routes/queue.ts`: steer/cancel paths clear pause, release slot, and emit queue update.
- `InvocationQueue.removeProcessed(...)` and `removeProcessedAcrossUsers(...)`: queue row cleanup primitives.

**Step 2: Classify each callsite**

For each callsite, mark one of:
- stays local and emits lifecycle event after local cleanup;
- moves into lifecycle cleanup subscriber;
- remains manual-control-only (for example user steer/cancel) and must not be conflated with normal terminal cleanup.

**Step 3: Verify**

Task 4 cannot start until the audit doc lists every current cleanup callsite and its replacement strategy.

## Task 2: Move TaskProgress Cleanup Behind Event Handler

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/reconcileZombies.ts`
- Create: `packages/api/src/domains/cats/services/agents/invocation/InvocationLifecycleCleanup.ts`
- Test: `packages/api/test/reconcileZombies.test.js`
- Test: `packages/api/test/invocation-lifecycle-cleanup.test.js`

**Step 1: Write failing tests**

Prove that `reconcileZombies()` emits a terminal event and no longer calls TaskProgress directly.

**Step 2: Implement TaskProgress cleanup handler**

Move `deleteSnapshot(threadId, catId)` into the lifecycle cleanup module.

**Step 3: Verify**

Run:

```bash
pnpm --dir packages/api build
node --test packages/api/test/reconcileZombies.test.js packages/api/test/invocation-lifecycle-cleanup.test.js
```

## Task 3a: Stamp Queue And Slot Ownership

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts`
- Test: `packages/api/test/invocation-queue.test.js`
- Test: `packages/api/test/queue-processor.test.js`

**Step 1: Write failing ownership stamp tests**

Cover:
- `InvocationQueue.enqueue(...)` stores `invocationId` when a caller has one;
- `markProcessing(...)` and `markProcessingAcrossUsers(...)` preserve the owner token through status changes;
- `QueueProcessor.executeEntry(...)` stamps the processing slot with the entry owner before route execution starts;
- ownership is written at creation/state-transition time, never inferred later by timestamp.

**Step 2: Implement schema evolution**

Add `invocationId` or `ownerInvocationId` to queue entries and slot metadata. Prefer explicit naming over reusing unrelated message ids.

**Step 3: Verify**

Run:

```bash
pnpm --dir packages/api build
node --test packages/api/test/invocation-queue.test.js packages/api/test/queue-processor.test.js
```

## Task 3b: Add Queue Owner Recovery API

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts`
- Test: `packages/api/test/queue-processor.test.js`
- Test: `packages/api/test/invocation-queue.test.js`

**Step 1: Write failing owner-recovery tests**

Cover:
- stale processing row owned by `invocationId` is removed;
- same cat replacement owned by a different `invocationId` is preserved;
- paused slot is not kicked;
- cross-user next work is discoverable after release.
- replaying the same terminal event after partial cleanup is idempotent and completes missing cleanup without double-counting or deleting replacement state.

**Step 2: Implement owner-aware cleanup**

Preferred shape:

```ts
recoverTerminalInvocation(event: InvocationLifecycleEvent): QueueRecoveryResult
```

This API may inspect queue and slot internals because it is owned by the queue subsystem. Callers pass only the lifecycle event.

**Step 3: Verify**

Run:

```bash
pnpm --dir packages/api build
node --test packages/api/test/invocation-queue.test.js packages/api/test/queue-processor.test.js
```

## Migration Notes

Queue ownership stamping must be explicit before recovery logic ships:

- `QueueEntry` schema change: add `ownerInvocationId?: string` or `invocationId?: string`. The implementation must choose one name and use it consistently across enqueue, mark-processing, and cleanup tests.
- Persistence impact: confirm whether queued entries are process-local only or serialized in Redis/local storage in any runtime path. If persisted, support missing owner ids as legacy entries that are never destructively recovered.
- `QueueProcessor.processingSlots` is in-memory. It can change from `Map<slotKey, startedAt>` to an owner-aware slot record if needed; existing in-flight process state is naturally reset by API restart, but no code should assume timestamp ownership after the migration.
- Existing in-flight invocations at deploy time may lack queue/slot owner stamps. The first implementation should fail closed for destructive recovery when ownership is missing, and rely on manual API restart as the reversible stopgap.
- Stamping must happen at enqueue / markProcessing / executeEntry boundaries immediately. Do not backfill owner tokens later from timestamps or latest records.

## Task 4: Wire Normal Completion And Zombie Cleanup To The Same Pipeline

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts`
- Modify: `packages/api/src/routes/messages.ts`
- Modify: `packages/api/src/routes/queue.ts`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/reconcileZombies.ts`
- Test: `packages/api/test/messages-delivery-mode.test.js`
- Test: `packages/api/test/messages-parallel-slot-release.test.js`
- Test: `packages/api/test/f194-canonical-liveness-routes.test.js`

**Step 1: Write failing integration tests**

Recreate PR #1900 production symptom:
- queue contains `status="processing"`;
- active invocations are empty;
- zombie cleanup marks the record terminal;
- the queue row and slot are recovered by the lifecycle cleanup pipeline;
- `/queue/next` or scheduler can start the next eligible entry.

Add namespace bridge gate coverage:
- `/queue` and `/messages` legacy paths without `invocationRegistry` may reconcile records and TaskProgress, but must not emit a destructive queue-recovery event;
- namespace-aware paths may emit recovery only for zombie reasons that prove the stale lifecycle owner is dead.

**Step 2: Wire both paths**

Normal terminal transitions and zombie terminal transitions emit `InvocationLifecycleEvent` and use the same cleanup function.

Every callsite classified in Task 1.5 must either move into the lifecycle cleanup pipeline or be explicitly left as manual-control-only with a test proving it is outside normal terminal cleanup.

**Step 3: Verify**

Run:

```bash
pnpm --dir packages/api build
node --test packages/api/test/reconcileZombies.test.js packages/api/test/f194-canonical-liveness-routes.test.js packages/api/test/messages-delivery-mode.test.js packages/api/test/messages-parallel-slot-release.test.js
```

## Task 5: Runtime And Governance Gate

**Files:**
- Modify: `docs/bug-report/f194-queue-zombie-processing-row/bug-report.md`
- Test: targeted F194 / queue / message suites

**Step 1: Update bug report**

Change status from `blocked-design-reset` to `fixed` only after the event-driven pipeline lands and passes review.

**Step 2: Run gates**

Run:

```bash
node --test packages/api/test/reconcileZombies.test.js packages/api/test/f194-canonical-liveness-routes.test.js packages/api/test/invocation-queue.test.js packages/api/test/queue-processor.test.js packages/api/test/messages-delivery-mode.test.js packages/api/test/messages-parallel-slot-release.test.js
pnpm check
node scripts/check-fallback-layers.mjs
```

Expected:
- all tests pass;
- no same-file fallback stack is introduced to compensate for missing ownership state;
- `reconcileZombies.ts` remains lifecycle-only and does not import queue or socket classes.

## Open Questions

**Technical OQ:** Where should `invocationId` ownership be stamped for queue rows and processing slots?

Default answer: stamp at enqueue / markProcessing / executeEntry boundaries immediately, then let QueueProcessor own slot cleanup. Backfilling by timestamp is forbidden.

**Technical OQ:** Should cleanup event dispatch be synchronous or best-effort background?

Default answer: synchronous for state convergence inside the terminal transition, with the atomicity contract above. If implementation cannot make synchronous event delivery atomic with the record transition, use an outbox pattern so terminal records always have a recoverable cleanup event.

**Value OQ:** If production hangs again before the redesign lands, should we restart API manually or resurrect a minimal hotfix?

Default answer: manual API restart is the safer reversible stopgap. Do not resurrect the PR #1900 ad hoc recovery implementation unless 铲屎官 explicitly declares emergency.

## PR Strategy

Implementation should proceed in a fresh worktree and PR:

- Branch: `feat/f194-lifecycle-events`
- PR title: `feat(F194): lifecycle event driven recovery (replaces hotfix #1900)`
- Link PR #1900 as the invariant catalog and failed-coordinate evidence.

Do not continue implementation in PR #1900. Its review history is intentionally frozen around the failed coordinate system, and the docs-only reset should remain an artifact, not the implementation vehicle.
