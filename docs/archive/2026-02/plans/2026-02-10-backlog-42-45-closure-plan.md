---
feature_ids: []
topics: [backlog, closure]
doc_kind: plan
created: 2026-02-10
---

# Backlog #42 #45 Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close backlog items #42 and #45 with verifiable Red→Green tests and runtime-safe controls.

**Architecture:** For #42, keep immediate rollback behavior and add asynchronous best-effort orphan reconciliation retries when cleanup partially fails. For #45, make Codex CLI sandbox and approval policy explicit runtime configuration to unblock git writes and authorization behavior under callback execution.

**Tech Stack:** TypeScript, Fastify, Node test runner, existing Cat Café config registry/hotreload layer.

### Task 1: #42 failing test for rollback double-failure fallback

**Files:**
- Modify: `packages/api/test/thread-branch.test.js`
- Test: `packages/api/test/thread-branch.test.js`

**Step 1: Write the failing test**
- Add a test that simulates:
  - branch copy failure (append throws), and
  - both cleanup operations fail once (`deleteByThread` + `threadStore.delete`), then succeed.
- Assert eventual cleanup after background retry.

**Step 2: Run test to verify RED**
- Run: `pnpm --filter @cat-cafe/api test -- thread-branch.test.js`
- Expected: FAIL because no background reconcile exists.

### Task 2: #42 minimal implementation

**Files:**
- Modify: `packages/api/src/routes/thread-branch.ts`
- Test: `packages/api/test/thread-branch.test.js`

**Step 1: Implement minimal retry reconciliation**
- Add helper to schedule retry cleanup with bounded delays.
- Trigger it when immediate rollback has any rejected operation.

**Step 2: Run tests to verify GREEN**
- Run: `pnpm --filter @cat-cafe/api test -- thread-branch.test.js`
- Expected: PASS.

### Task 3: #45 failing tests for Codex sandbox/approval configuration

**Files:**
- Modify: `packages/api/test/codex-agent-service.test.js`
- Test: `packages/api/test/codex-agent-service.test.js`

**Step 1: Write failing tests**
- Assert default invocation args include expected sandbox and approval behavior.
- Assert env override behavior for sandbox mode and approval policy.
- Assert resume behavior for approval policy handling.

**Step 2: Run tests to verify RED**
- Run: `pnpm --filter @cat-cafe/api test -- codex-agent-service.test.js`
- Expected: FAIL because flags are not configurable yet.

### Task 4: #45 implementation + config visibility/hot-reload

**Files:**
- Modify: `packages/api/src/domains/cats/services/CodexAgentService.ts`
- Modify: `packages/api/src/config/ConfigRegistry.ts`
- Modify: `packages/api/src/config/ConfigStore.ts`
- Modify: `packages/api/test/config-hotreload.test.js`
- Modify: `.env.example`

**Step 1: Implement minimal config parsing and flag injection**
- Add env parsing for `CAT_CODEX_SANDBOX_MODE`, `CAT_CODEX_APPROVAL_POLICY`.
- Inject args in non-resume path and approval policy where supported.
- Surface values via config snapshot and hot-reload allowlist.

**Step 2: Run tests to verify GREEN**
- Run:
  - `pnpm --filter @cat-cafe/api test -- codex-agent-service.test.js`
  - `pnpm --filter @cat-cafe/api test -- config-hotreload.test.js`
- Expected: PASS.

### Task 5: Backlog + review handoff

**Files:**
- Modify: `docs/BACKLOG.md`
- Modify/Create: `docs/mailbox/2026-02-10-backlog-42-45-review-response-from-maine.md`

**Step 1: Mark closure with commit reference**
- Update #42 and #45 status to `[x]` with concrete rationale.

**Step 2: Draft review letter for one-pass review**
- Include What / Why / Tradeoff / Open Questions / Next Action.

### Task 6: Verification + commit

**Files:**
- N/A

**Step 1: Full targeted verification**
- Run:
  - `pnpm --filter @cat-cafe/api build`
  - `pnpm --filter @cat-cafe/api test -- thread-branch.test.js codex-agent-service.test.js config-hotreload.test.js`

**Step 2: Commit**
- Commit message format with cat signature and `Why:` body.
