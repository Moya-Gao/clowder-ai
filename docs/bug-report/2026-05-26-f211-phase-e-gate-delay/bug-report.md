---
feature_ids: [F211]
topics: [bug-report, gate, test-infrastructure, pre-merge, phase-e]
doc_kind: bug-report
created: 2026-05-26
---

# Bug Report: F211 Phase E `pnpm gate` Took Multiple Attempts Before Stable Full Test Entry

## 1. Summary

F211 Phase E implementation was not blocked by one functional failure. The painful gate run came from several gate-infrastructure and environment issues stacking together:

1. gate preflight repeatedly encountered machine-level contention from other long-running validation/sync processes;
2. gate preflight found unmanaged random-port Redis listeners left behind by prior test runs;
3. a nested pre-merge gate test did not isolate its lock path when run inside the outer `pnpm gate`;
4. two unrelated tests had hidden environment/timing assumptions that only became visible under full-gate load;
5. after rebase, generated feature index drifted because `origin/main` changed F188 status.

Final result: `pnpm gate` passed at `2ad0bdc3`, then the review-request mailbox commit was added at `6407d6d15`.

This was a real process problem. It was not a Phase E UI/API correctness failure, but the gate friction is high enough to deserve infrastructure follow-up.

## 2. User-Visible Symptom

铲屎官看到的现象：

- "跑一次 gate 这么难受";
- roughly half an hour before entering the full test segment on one attempt;
- repeated restarts/retries before a clean final gate.

That perception is accurate. The gate made progress, but the user-visible feedback loop was bad: too much time was spent clearing preflight/test-infra friction before the actual full test run became stable.

## 3. Timeline Of Observed Issues

| Order | Issue | Evidence / Fix | Status |
|------|-------|----------------|--------|
| 1 | Focused Phase E tests passed, then full gate exposed unrelated brittle tests | API 25/25 and web 35/35 passed before full gate; full gate later exposed service lifecycle and tmux timing/env assumptions | fixed in branch |
| 2 | `services-lifecycle-failure-route.test.js` inherited local ASR env | `createTestEnv()` now pins test profile and disables ASR env | fixed: `c3309f7ab` |
| 3 | `tmux-agent-spawner.test.js` had too-short first-event timing under load | stderr progress test now separates first-event timeout from command timeout and emits longer progress | fixed: `9b8d72d19` |
| 4 | Inner `scripts/pre-merge-check.sh` test saw the outer gate lock | `pre-merge-check.test.mjs` now passes an isolated `CAT_CAFE_GATE_LOCK_DIR` for the temp test run | fixed: `77612e2b9` |
| 5 | Rebase brought generated feature-index drift from `origin/main` | `node scripts/generate-feature-index.mjs` refreshed F188 status in `docs/features/index.json` | fixed: `2ad0bdc3` |
| 6 | Gate preflight repeatedly saw unmanaged random-port Redis listeners | stale high-port Redis instances were shut down manually with `redis-cli ... shutdown nosave`; 6398/6399 were not touched | mitigated manually |
| 7 | Gate preflight had to wait on concurrent validation/sync processes from another local workstream | waited instead of killing unrelated work | mitigated manually |

## 4. Root Cause Analysis

### 4.1 Not A Single Slow Test

The delay was not caused by Phase E tests taking half an hour. Focused tests were fast and green:

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/transcript-writer.test.js packages/api/test/external-runtime-sessions-route.test.js
```

Result: 25 tests passed.

```bash
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run \
  src/components/runtime-sessions/__tests__/external-runtime-session-format.test.ts \
  src/components/runtime-sessions/__tests__/ExternalRuntimeSessionsPanel.test.tsx \
  src/components/settings/__tests__/OpsContent-deep-link.test.tsx \
  src/components/audit/__tests__/AuditExplorerPanel.test.ts \
  src/components/audit/__tests__/SessionEventsViewer.test.ts
```

Result: 35 tests passed.

The slow part was repeated gate setup/cleanup/retry around unrelated infra conditions.

### 4.2 Gate Singleflight Is Correct But Operationally Noisy

`pnpm gate` correctly serializes pre-merge validation through a lock and refuses unsafe parallel gate runs. During this run, another local validation/sync flow was active. The safe action was to wait, not kill it.

The problem is ergonomics: the gate reports the block, but there is no higher-level queue or ETA, so it feels like the current task is "doing nothing" before tests even start.

### 4.3 Random-Port Redis Guard Is Correct But Cleanup Is Too Manual

The preflight guard correctly rejects unmanaged random-port Redis listeners. That protects Redis 6399 and prevents test pollution.

The weak point is cleanup provenance. When stale high-port Redis instances exist, the operator must inspect and shut them down manually. That is safe but slow, and it creates repeated gate restarts.

### 4.4 Nested Gate Lock Test Was A Real Bug

`pre-merge-check.test.mjs` invokes `scripts/pre-merge-check.sh` while the outer `pnpm gate` already holds `.cat-cafe/gate/pre-merge-check.lock`.

Before the fix, the inner test reused the same lock location, so it falsely failed with "pre-merge gate already running" even though the test intended to validate a temp checkout. The fix is correct: tests now pass their own `CAT_CAFE_GATE_LOCK_DIR`.

### 4.5 Hidden Env/Timing Assumptions Were Real Test Bugs

Two tests were only stable in a narrower environment:

- service lifecycle failure route inherited local ASR env and could observe `whisper-stt` config unexpectedly;
- tmux stderr progress timeout assumed the first event would arrive within a short window that is not reliable under full-gate load.

Both were fixed as deterministic test isolation/hardening changes, not waived.

## 5. What Was Fixed In This Branch

| Commit | Fix |
|--------|-----|
| `c3309f7ab` | isolate lifecycle failure env from inherited ASR settings |
| `9b8d72d19` | harden tmux stderr progress timeout case |
| `77612e2b9` | isolate nested pre-merge lock during gate tests |
| `2ad0bdc3` | refresh generated feature index after rebase |

Final full gate:

```bash
pnpm gate
```

Result:

```text
GATE PASSED
Branch : feat/f211-phase-e-hub-visibility
SHA    : 2ad0bdc3
Base   : rebased onto origin/main
Tests  : all passed
Lint   : passed
Check  : passed
```

## 6. Remaining Infrastructure Follow-Ups

These are not blockers for F211 Phase E, but they should be treated as gate-infra debt:

1. **Gate queue/owner visibility**  
   Show which process owns the gate lock, what command it is running, and whether it is a known Cat Cafe gate/sync job. Ideally expose a bounded wait mode instead of forcing manual polling.

2. **Managed stale Redis cleanup**  
   Extend the preflight guard to distinguish known test Redis leftovers from unknown Redis processes. Known test leftovers should have a safe, bounded cleanup path with clear provenance.

3. **Generated index drift ergonomics**  
   When `check:features` fails only because `docs/features/index.json` is stale after rebase, print the exact regeneration command and whether the diff is generated-only.

4. **Full-gate progress reporting**  
   The current gate has long phases where the user sees little semantic progress. A lightweight phase timer would make "stuck before tests" distinguishable from "waiting on build/install/preflight".

5. **Test isolation audit for inherited env**  
   `services-lifecycle-failure-route.test.js` was one concrete case. Other tests that construct runtime config should explicitly sanitize profile/service env instead of inheriting the operator shell.

## 7. Current Status

- Phase E implementation branch is gate-clean.
- Screenshots generated during browser verification were deleted per user request and are not part of the branch.
- The latest branch commit after this report is documentation-only.

