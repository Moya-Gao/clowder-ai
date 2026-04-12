---
doc_kind: review-request
feature_ids: [F118]
created: 2026-04-12
---

# Review Request: F118 D1 — circuit breaker failure count inheritance

Review-Target-ID: f118-d1
Branch: fix/f118-circuit-breaker-inherit

## What

`cli_session_replaced` creates new session via `create()` + immediate `update()` to inherit `consecutiveRestoreFailures` from the replaced session. 9 lines added, 1 removed in `invoke-single-cat.ts:1109`.

## Why

Bug: failure count resets to 0 on every session replacement, so the overflow circuit breaker (threshold=3) never triggers. Users experience infinite hang cycles when upstream CLI hangs repeatedly.

Root cause identified in 2026-04-11 detective investigation (thread_mntwt5b8petacm1f, thread_mnuvv7bkwz5jdg1u).

## Original Requirements

> 侦探猫猫出大事了！！这两个线程的砚砚 我at都过了五分钟了竟然都还没出来！
- Source: 2026-04-11 detective investigation thread (铲屎官)
- **Please verify: does this fix actually prevent the infinite hang cycle reported?**

## Tradeoff

- Chose `create() + immediate update()` over extending `CreateSessionInput` interface — avoids contract change for a single field, uses existing `SessionRecordPatch` path.
- `inheritedFailures > 0` guard avoids unnecessary update call when old session had no failures.

## Open Questions

1. The `create()` return value was previously unused (fire-and-forget). Now we use `newRec.id` for the follow-up `update()`. If `create()` throws, the old behavior (no new session) is preserved. If `update()` fails, the new session exists but with count=0 — degraded but not worse than the current bug.
2. Both `cli_session_replaced` and `shouldRetryWithoutSession` paths can create new sessions. D1 only fixes the `cli_session_replaced` path (line 1109). The retry path (line 1120) is a first-invocation-or-sealed scenario where there's no existing count to inherit.

## Next Action

Code review on the 1 source file change + 1 new test file. This is D1 only (plan-approved for independent merge).

## Review Sandbox

Backend-only change, no frontend. No sandbox needed.
- Path: `/tmp/cat-cafe-review/f118-d1/codex`
- Run tests: `pnpm --filter @cat-cafe/api test`

## Self-check Evidence

### Spec Compliance

| AC | Status | Evidence |
|----|--------|----------|
| AC-D1: inherit failures on replacement | PASS | test "AC-D1: inherits..." |
| AC-D2: breaker trips at threshold | PASS | test "AC-D2: overflow..." |
| AC-D3: regression — ephemeral isolation | PASS | test "AC-D3: ephemeral..." |

### Test Results

```
node --test test/invoke-single-cat-breaker-inherit.test.js  # 4/4 pass
node --test test/invoke-single-cat-overflow-breaker.test.js # 2/2 pass (regression)
node --test test/invoke-single-cat-timeout-retry.test.js    # 3/3 pass (regression)
Full suite: 7679/7680 pass, 0 fail, 1 skip
pnpm lint (tsc --noEmit): 0 errors
pnpm biome check: 0 errors
```

### Related Documents

- Plan: `docs/plans/2026-04-11-f118-phase-d-invocation-resilience.md`
- Feature: `docs/features/F118-cli-liveness-watchdog.md`
