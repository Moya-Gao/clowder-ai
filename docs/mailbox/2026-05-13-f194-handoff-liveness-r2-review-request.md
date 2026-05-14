---
type: review-request
feature: F194
review_target_id: f194-handoff-liveness-r2
branch: fix/f194-handoff-liveness-r2
author: codex
reviewer: opus
created: 2026-05-13
---

# F194 Handoff Liveness R2 Review Request

Review-Target-ID: `f194-handoff-liveness-r2`
Branch: `fix/f194-handoff-liveness-r2`
Code commit: `187ae3e04`

## Original Requirement

铲屎官 runtime 截图反馈：

> sonnet 被 @ 了，然后这里是你 @ 他的，但是显示你在跑，sonnet 没在跑。

Runtime preflight confirmed the process is after the previous handoff hotfix target:

```text
HEAD=473b2cb46 docs(F198): incorporate codex review P1/P2
TARGET_COMMIT=72d460638
PROCESS_AFTER_TARGET=yes
```

## Root Cause

Previous hotfix only migrated active ownership when live `a2a_handoff` had both `targetCatId` and `invocationId`.

Two gaps remained:

1. `route-serial` emitted `a2a_handoff` with `targetCatId`, but without `invocationId`.
2. Legacy/persisted handoff events without `invocationId` could still arrive at the frontend. The frontend then skipped `maybeMigrateSequentialInvocationOwnership`, leaving the previous cat shown as active until F5 or later queue reconciliation.

## Change Summary

- `route-serial.ts`: both `a2a_handoff` yield sites now include the current turn `ownInvocationId`.
- `useAgentMessages.ts`: `a2a_handoff` resolves a missing invocation id from the current active slot for the source cat, then from `catInvocations`, then from the single active slot fallback.
- Tests:
  - API handoff event must carry `invocationId`.
  - Web legacy `a2a_handoff` without `invocationId` still migrates active ownership from source cat to target cat.

## Architecture Ownership

- Architecture cell: invocation liveness / chat active-state projection
- Map delta: none
- Why: extends the existing F194 handoff ownership migration path; no new store/router/dispatcher abstraction.

## Review Focus

1. Is the frontend fallback narrow enough? It only runs on `a2a_handoff` with `targetCatId`, and first matches the source cat's active slot.
2. Is `catInvocations[fromCatId]` a valid second fallback for the slot-cleared window, or should we require active slot / single-slot only?
3. Are both serial handoff yield sites complete? `route-parallel` still does not emit `a2a_handoff`.

## Verification

```text
runtime-preflight 72d460638 -> PROCESS_AFTER_TARGET=yes
```

```text
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run \
  src/hooks/__tests__/useAgentMessages-invocation-created.test.ts
-> 9/9 pass
```

```text
pnpm --filter @cat-cafe/api build && \
cd packages/api && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js --test \
  --test-timeout=60000 \
  --test-name-pattern "yields a2a_handoff event" \
  test/route-strategies.test.js
-> 1/1 pass
```

```text
pnpm check
-> exit 0
```

```text
node scripts/check-fallback-layers.mjs
-> No fallback pattern changes detected.
node scripts/check-hotfix-pattern.mjs
-> hotfix=false
root artifact hygiene
-> clean
```
