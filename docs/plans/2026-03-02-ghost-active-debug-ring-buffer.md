---
feature_ids: [F039]
topics: [websocket, diagnostics, debug]
doc_kind: plan
created: 2026-03-02
updated: 2026-03-02
---

# Ghost Active Debug Ring Buffer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Add a local, opt-in event ring-buffer in web client to capture invocation state timeline for ghost-active investigations without collecting sensitive payloads.

**Architecture:** Add a tiny debug module used by `useSocket` and thread-route sync points. Module stays disabled by default, stores in-memory only, exposes `window.__catCafeDebug` when enabled, and enforces field whitelist + dump-time masking.

**Tech Stack:** TypeScript, React hooks, Vitest, existing `useSocket` and Zustand chat store.

---

### Task 1: Build debug ring-buffer module (no integration yet)

**Files:**
- Create: `packages/web/src/debug/invocationEventDebug.ts`
- Test: `packages/web/src/debug/__tests__/invocationEventDebug.test.ts`

**Step 1: Write failing tests**
- `default disabled`: no records when disabled.
- `configure enabled`: can record event.
- `size clamp`: `<50 => 50`, `>500 => 500`, invalid => default 200.
- `TTL`: auto-disable + clear after expiry; re-configure refreshes TTL.
- `dump masking`: default masked threadId, raw only with `rawThreadId:true` and `RAW` marker.
- `whitelist`: dump output excludes content/token/header/user input fields.

**Step 2: Run test to verify RED**
- Run: `pnpm --filter @cat-cafe/web exec vitest run src/debug/__tests__/invocationEventDebug.test.ts`
- Expected: failing assertions / missing module.

**Step 3: Implement minimal module**
- ring-buffer store in module scope.
- API: `configureDebug`, `recordDebugEvent`, `dumpDebugEvents`, `clearDebugEvents`, `getDebugStatus`, `ensureWindowDebugApi`.
- Strict metadata-only event type.

**Step 4: Run test to verify GREEN**
- Same command should pass.

**Step 5: Commit (later squashed with integration if preferred)**

### Task 2: Integrate debug recording at key socket/state edges

**Files:**
- Modify: `packages/web/src/hooks/useSocket.ts`
- Test: `packages/web/src/hooks/__tests__/useSocket-thread-guard.test.ts`

**Step 1: Write failing tests**
- when debug disabled, socket events do not emit debug records.
- when enabled, `queue_updated`, `intent_mode`, `connect`, `disconnect`, `done` produce metadata records.
- verify no event data contains blocked fields.

**Step 2: Run RED**
- Run: `pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts`

**Step 3: Implement minimal integration**
- call `ensureWindowDebugApi()` once during hook setup.
- call `recordDebugEvent(...)` in event handlers with allowed metadata only.

**Step 4: Run GREEN**
- same test command passes.

### Task 3: Quality gate + review package

**Files:**
- Create: `docs/discussions/2026-03-02-ghost-active-debug-ring-buffer/README.md`
- Create: `docs/bug-report/2026-03-02-ghost-active-debug-ring-buffer/bug-report.md`
- Create: `docs/mailbox/2026-03-02-ghost-active-debug-ring-buffer-review-request-to-gpt52.md`

**Step 1: Run verification**
- `pnpm --filter @cat-cafe/web exec vitest run src/debug/__tests__/invocationEventDebug.test.ts`
- `pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts`
- `pnpm --filter @cat-cafe/web lint`
- `pnpm --filter @cat-cafe/web build`

**Step 2: Produce quality-gate report**
- include requirement coverage + command evidence.

**Step 3: Send review request to @gpt52**
- include What/Why/Tradeoff/Open/Next + original requirement excerpt.

**Step 4: Open PR**
- push branch and create PR with test evidence + risk notes.
