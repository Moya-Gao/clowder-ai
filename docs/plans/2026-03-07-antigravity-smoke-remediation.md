# Antigravity Smoke Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Stop `antigravity-smoke` from silently stalling default `packages/api` test runs while preserving an explicit way to run the smoke test on demand.

**Architecture:** Move the smoke-test run conditions and round-trip execution into a small test helper so we can unit-test the harness itself. Then switch the smoke test to an explicit opt-in gate and wrap the CDP client lifecycle in guaranteed cleanup.

**Tech Stack:** Node test runner, ESM test helpers, Antigravity CDP client, package.json scripts

---

### Task 1: Document the bug and non-goals

**Files:**
- Create: `docs/bug-report/antigravity-smoke-stall/bug-report.md`
- Create: `docs/plans/2026-03-07-antigravity-smoke-remediation.md`
- Modify: `docs/features/F081-bubble-continuity-observability.md`

**Step 1: Capture the root cause**
- Record why both Opus sessions land in `antigravity-smoke.test.js`
- Record why default `pnpm test` is the trigger surface

**Step 2: Pin the finish line**
- We are building:
  - an explicit smoke-test gate
  - guaranteed cleanup for the smoke harness
- We are not building:
  - a full Antigravity provider redesign
  - a full replacement for F081 observability work

### Task 2: Write the failing tests

**Files:**
- Create: `packages/api/test/antigravity-smoke-harness.test.js`
- Create: `packages/api/test/helpers/antigravity-smoke.js`
- Modify: `packages/api/test/antigravity-smoke.test.js`

**Step 1: Write a failing test for gate behavior**
- Assert the helper returns a skip reason unless `RUN_ANTIGRAVITY_SMOKE=true`
- Assert reachable port alone is not enough

**Step 2: Write a failing test for cleanup**
- Use a fake client whose `pollResponse()` returns `null` or throws
- Assert the helper still calls `disconnect()`

**Step 3: Run the focused tests to see them fail**
- Run: `node --test packages/api/test/antigravity-smoke-harness.test.js`

### Task 3: Implement the minimal fix

**Files:**
- Modify: `packages/api/test/helpers/antigravity-smoke.js`
- Modify: `packages/api/test/antigravity-smoke.test.js`
- Modify: `packages/api/package.json`

**Step 1: Add a helper for gate + harness**
- `getAntigravitySmokeSkipReason(...)`
- `runAntigravityRoundTripSmoke(...)`

**Step 2: Move smoke test to explicit opt-in**
- Smoke test should only run when:
  - `RUN_ANTIGRAVITY_SMOKE=true`
  - Antigravity on `:9000` is reachable

**Step 3: Guarantee cleanup**
- Wrap client lifecycle with `try/finally`
- Best-effort `disconnect()` in `finally`

**Step 4: Add an explicit script**
- Add `test:antigravity-smoke` to `packages/api/package.json`

### Task 4: Verify and write back the cure

**Files:**
- Modify: `docs/features/F081-bubble-continuity-observability.md`

**Step 1: Run targeted tests**
- `node --test packages/api/test/antigravity-smoke-harness.test.js`
- `node --test packages/api/test/antigravity-cdp-client.test.js packages/api/test/antigravity-agent-service.test.js`

**Step 2: Run package-level verification**
- `pnpm --dir packages/api test`
  - Expect smoke test to skip by default even if `:9000` is alive

**Step 3: Record the疗效**
- Add the final fix summary and evidence back into `F081`
