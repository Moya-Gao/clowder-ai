---
feature_ids: []
debt_ids: []
topics: [mentions, delivery, a2a, callbacks, testing]
doc_kind: plan
created: 2026-02-28
---

# Mention Auto-Ack + `includeAcked` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate “surprise backlog” when cats call `pending-mentions` by auto-acking mentions on successful A2A worklist enqueue, while preserving explicit historical review via `includeAcked=1`.

**Architecture:** Reuse the existing mention-ack cursor (`DeliveryCursorStore.ackMentionCursor`) as the single source of truth. When a mention is routed via A2A worklist enqueue, advance the cursor. Add a query param to `pending-mentions` to optionally include acked mentions and annotate results with `acked: true/false`.

**Tech Stack:** Fastify routes, Node test runner (`node --test`), in-memory stores + Redis-backed `SessionStore` where available.

---

### Task 1: Add regression test for “auto-ack on enqueue”

**Files:**
- Test: `packages/api/test/mention-ack.test.js`

**Step 1: Write the failing test**

- Add a test that:
  1) Creates a thread with a parent worklist (`WorklistRegistry`) present.
  2) Appends a message that @mentions `opus` and triggers `enqueueA2ATargets(...)` with `triggerMessage`.
  3) Asserts that `deliveryCursorStore.getMentionAckCursor(userId, opus, threadId)` advanced to `triggerMessage.id`.
  4) Asserts that `GET /api/callbacks/pending-mentions` (default) returns empty after auto-ack.

**Step 2: Run test to verify it fails**

Run: `node --test test/mention-ack.test.js` (from `packages/api/`)  
Expected: FAIL (cursor unchanged and/or pending-mentions still returns the mention).

**Step 3: Commit the red test**

Run:
```bash
git add packages/api/test/mention-ack.test.js
git commit -m "test(api): cover mention auto-ack on enqueue [砚砚/GPT-52🐾]" -m "Why: Lock in the new behavior to prevent future surprise-backlog regressions."
```

---

### Task 2: Implement auto-ack in `enqueueA2ATargets()`

**Files:**
- Modify: `packages/api/src/routes/callback-a2a-trigger.ts`
- Modify: `packages/api/src/routes/callbacks.ts`

**Step 1: Minimal implementation**

- Extend `A2ATriggerDeps` to accept `deliveryCursorStore?: DeliveryCursorStore`.
- In the worklist path (`hasWorklist(threadId)`):
  - After `pushToWorklist(...)` returns `enqueued` cats, if `enqueued.length > 0` and `deliveryCursorStore` is present:
    - For each `catId` in `enqueued`, call:
      - `await deliveryCursorStore.ackMentionCursor(opts.userId, catId, opts.threadId, opts.triggerMessage.id)`
  - Log a single info line including `triggerMessageId` and `enqueued`.
- Thread the `deliveryCursorStore` dependency from `callbacksRoutes` when calling `enqueueA2ATargets(...)`.

**Step 2: Run test to verify it passes**

Run: `node --test test/mention-ack.test.js` (from `packages/api/`)  
Expected: PASS (cursor advanced; pending-mentions default returns empty).

**Step 3: Commit**

Run:
```bash
git add packages/api/src/routes/callback-a2a-trigger.ts packages/api/src/routes/callbacks.ts
git commit -m "fix(api): auto-ack mentions on A2A enqueue [砚砚/GPT-52🐾]" -m "Why: Prevent pending-mentions from resurfacing mentions already handled by the routing path."
```

---

### Task 3: Add `includeAcked=1` to `pending-mentions` + `acked` flag

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts`
- Test: `packages/api/test/mention-ack.test.js` (or `packages/api/test/callback-routes.test.js`)

**Step 1: Write failing test**

- Add a test that:
  1) Creates two mention messages `m1`, `m2` for a cat in a thread.
  2) Acks up to `m2` (or uses the auto-ack path) so the cursor is at `m2.id`.
  3) Calls `GET /api/callbacks/pending-mentions` (default) and expects empty.
  4) Calls `GET /api/callbacks/pending-mentions&includeAcked=1` and expects `m1` and `m2` with `acked: true`.

**Step 2: Run test to verify it fails**

Run: `node --test test/mention-ack.test.js` (from `packages/api/`)  
Expected: FAIL (param ignored and/or `acked` flag missing).

**Step 3: Implement minimal change**

- In `GET /api/callbacks/pending-mentions`:
  - Parse optional query param `includeAcked` (`"1"` / `"true"`).
  - Keep reading `lastAckId` from `deliveryCursorStore.getMentionAckCursor(...)`.
  - If `includeAcked` is true:
    - call `messageStore.getMentionsFor(..., lastAckId=undefined)` (fetch all mentions up to limit)
  - Else:
    - keep current behavior (pass `lastAckId`)
  - For each returned mention, compute:
    - `acked = Boolean(lastAckId && item.id <= lastAckId)`
  - Include `acked` in response payload.

**Step 4: Run test to verify it passes**

Run: `node --test test/mention-ack.test.js` (from `packages/api/`)  
Expected: PASS.

**Step 5: Commit**

Run:
```bash
git add packages/api/src/routes/callbacks.ts packages/api/test/mention-ack.test.js
git commit -m "feat(api): pending-mentions includeAcked + acked flag [砚砚/GPT-52🐾]" -m "Why: Preserve explicit historical review without reintroducing surprise backlog."
```

---

### Task 4: Edge case test — enqueue twice is monotonic

**Files:**
- Test: `packages/api/test/mention-ack.test.js`

**Step 1: Write test**

- Simulate “same triggerMessage enqueued twice” and assert:
  - cursor is unchanged after the second enqueue (no regression)
  - `pending-mentions` default remains empty

**Step 2: Run test**

Run: `node --test test/mention-ack.test.js`  
Expected: PASS (cursor monotonic).

**Step 3: Commit**

Run:
```bash
git add packages/api/test/mention-ack.test.js
git commit -m "test(api): ensure mention ack cursor monotonic [砚砚/GPT-52🐾]" -m "Why: Guard against ping-pong/double-enqueue scenarios regressing cursors."
```

---

### Task 5: Quick sanity checks (no broad refactors)

**Files:**
- None (commands only)

**Step 1: Typecheck (API only)**

Run: `pnpm -C packages/api run lint`  
Expected: PASS.

**Step 2: Run API tests**

Run: `pnpm -C packages/api run test`  
Expected: PASS.

**Step 3: Commit any incidental fixes (if needed)**

Only if tests require minimal adjustments directly related to the change.

