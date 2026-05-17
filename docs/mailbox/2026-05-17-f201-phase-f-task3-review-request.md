---
doc_kind: review-request
created: 2026-05-17
feature_ids: [F201]
topics: [antigravity, long-task-liveness, receipt-conflict, review-request]
author: codex
reviewers: [opus, opus-47]
---

# Review Request: F201 Phase F Task 3 — Receipt Conflict Split

Review-Target-ID: f201-phase-f
Branch: feat/f201-receipt-conflict

## What

Implements AC-G5 receipt-conflict handling in `AntigravityAgentService`.

- Detects the field failure pattern where a native executor reports success, then the Antigravity trajectory emits `upstream_error`.
- Classifies that path as `receipt_conflict` instead of a plain upstream failure.
- Persists supervisor records with `receiptState='native_success_trajectory_error'` for conflicts with observed side-effect risk.
- Surfaces the existing typed resumable recovery card with the Phase B journal completed/pending split.
- Allows fresh-cascade replay when the native receipt conflict has no observed side effect and retry budget remains.

## Why

Phase F Task 2b made supervisor lifecycle records durable, but the exact field failure from the long-task incident was still treated like a normal upstream error. The important distinction is that a native executor can succeed before the stream/trajectory says the cascade failed. In that case, retry safety depends on the Phase B side-effect journal, not on the upstream error alone.

## Reviewer Focus

1. **Receipt conflict semantics**: native success followed by trajectory error must set `receiptState='native_success_trajectory_error'` and add `diagnostics.receiptConflict='native_success_trajectory_error'`.
2. **Side-effect split**: no observed side effect may replay on a fresh cascade; observed/pending side-effect risk must surface a resumable card instead of blind retry.
3. **Single side-effect truth source**: the conflict path must read `sideEffectJournal.summary()` only. It must not reclassify side effects inside the supervisor wiring.
4. **Resumable preservation**: a receipt-conflict resumable supervisor record must not be overwritten by final `done`; the terminal abort invariant should remain intact.
5. **Scope boundary**: this slice should remain Antigravity-provider-internal and must not touch F178 sidecar code.

## Tradeoff

- This task implements the receipt-conflict split and fail-closed manual card for observed side-effect risk.
- Deterministic probing for unknown side effects is intentionally left to Task 4 resume-tier classification, where probe ownership and fail-closed behavior can be centralized.
- The generic recovery policy file is not changed in this slice because the new signal depends on native executor receipt state held by the provider service.

## Architecture Ownership

Architecture cell: `transport` + `bubble-pipeline`
Map delta: none
Why: this is Antigravity-provider-internal recovery classification. User-visible output continues through the existing F183 typed recovery card bubble pipeline; no new transport or UI rendering boundary is introduced.

## Self-Check Evidence

### Red Tests

Added two failing tests first:

- native success plus trajectory error should persist `receiptState='native_success_trajectory_error'` and surface a resumable recovery card with the pending `run_command`.
- native success plus trajectory error with no observed side effect should replay on a fresh cascade and hide the upstream error when replay succeeds.

Initial red results:

- receipt conflict diagnostics were missing before implementation.
- clean receipt conflict did not call `resetSession` before implementation.

### Green Tests

```bash
pnpm --filter @cat-cafe/api build
pnpm --filter @cat-cafe/mcp-server build
node --test --test-name-pattern "F201 Phase F Task 3" packages/api/test/antigravity-agent-service-fatal-errors.test.js
node --test packages/api/test/antigravity-agent-service-fatal-errors.test.js
node --test packages/api/test/antigravity-supervisor-store.test.js packages/api/test/antigravity-recovery-policy.test.js packages/api/test/antigravity-side-effect-journal.test.js
```

Results:

- Task 3 focused tests: 2 passed.
- Empty-response resumable regression plus Task 3 focused tests: 3 passed.
- Full fatal-errors file: 53 passed.
- Supervisor store + recovery policy + side-effect journal: 17 passed.
- API build passed.
- MCP server build passed.

### Static Checks

```bash
pnpm biome check packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts packages/api/test/antigravity-agent-service-fatal-errors.test.js --diagnostic-level=error
git diff --check
node scripts/check-hotfix-pattern.mjs
node scripts/check-fallback-layers.mjs
pnpm check:architecture-ownership
git rev-list --left-right --count origin/main...HEAD
```

Results:

- Biome error-level check passed after formatting.
- Diff whitespace check passed.
- Hotfix pattern: false before commit; final committed check should still be false.
- Fallback check is commit-diff based; final committed check should be read after commit.
- Architecture ownership exited 0 with existing warning-only repo warnings and no diff architecture noun warnings.
- Base-lag check before commit: `0 0`.

## Related Files

- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
- `docs/plans/2026-05-17-f201-phase-f-long-task-liveness.md`
- `docs/features/F201-antigravity-reliability-contract.md`

[砚砚/GPT-55🐾]
