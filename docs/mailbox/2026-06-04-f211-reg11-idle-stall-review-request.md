---
title: "Review Request: F211 REG11 dirty-IDLE cascade reuse stall"
date: 2026-06-04
feature: F211
status: review-request
---

# Review Request: F211 REG11 dirty-IDLE cascade reuse stall

Review-Target-ID: f211-reg11-idle-stall
Branch: fix/f211-idle-stall

## What

Fixes a live Antigravity Desktop stall where `getOrCreateSession` reused a cascade reported as `CASCADE_RUN_STATUS_IDLE` even though the latest turn was not actually clean.

Code changes:
- `AntigravityBridge.getOrCreateSession` now blocks reuse of dirty IDLE cascades when inline trajectory steps show:
  - a latest-turn `ERROR_MESSAGE` without terminal planner text, or
  - any planner response still `CORTEX_STEP_STATUS_GENERATING`.
- The same guard applies to runtime-store active bindings and the legacy JSON fallback.
- RUNNING/no-progress reuse behavior is preserved.
- IDLE cascades without inline steps still reuse, to avoid replacing summary-only/older trajectories without evidence.
- F211 doc gets a REG11 register row and timeline entry.

There is one separate formatting commit before the behavior commit:
- `ec5ed7306 chore(api): format agy trajectory files`
- `33cb78ad8 fix(antigravity): replace dirty idle cascades before reuse`

## Why

Live failure source:

> 这个thread的 thread_mq0980eu7l3zonck  
> 孟加拉 session id 4face7b4-fe8b-4b2f-b1d3-492889b9999e  
> Error: Antigravity stall: no activity for 60252ms (steps=15, status=CASCADE_RUN_STATUS_IDLE)  
> Error: Antigravity stall: no activity for 60197ms (steps=44, status=CASCADE_RUN_STATUS_IDLE)

- Source: live thread message `0001780625343751-000271-648a557c`
- Please judge whether the fix addresses this live stall, not just the unit-test shape.

Diagnosis from runtime logs:
- First turn ended with `STOP_REASON_CLIENT_STREAM_ERROR` and `ERROR_MESSAGE`; later invocation reused the same cascade because status was `IDLE`, then stalled at `steps=15`.
- A later invocation showed step 43 `PLANNER_RESPONSE` stuck in `CORTEX_STEP_STATUS_GENERATING`; status still became `IDLE`, then stalled at `steps=44`.
- The old reuse predicate treated all reachable `IDLE` cascades as clean continuation targets.

## Tradeoff

This is a targeted reuse guard, not a broad replacement policy:
- It does not replace RUNNING cascades, preserving REG5 long-thinking/no-progress behavior.
- It does not replace IDLE trajectories with no inline steps, because we cannot distinguish dirty vs compact/summary-only from local evidence.
- It preserves IDLE cascades that have terminal planner text before a later noisy error tail, so answered turns are not needlessly replaced.

## Architecture Ownership

Architecture cell: `transport` + `identity-session`
Map delta: none
Why: This tightens the existing Antigravity cascade reuse contract; it does not add a new store/router/adapter/binding.

Please check:
- whether `Map delta: none` matches the diff,
- whether the dirty-IDLE predicate is the right contract boundary,
- whether applying it to both runtime-store and legacy JSON paths is appropriate.

## Open Questions

### 技术 OQ（给 reviewer）

1. Is `latest turn has ERROR_MESSAGE && no terminal planner text` the right safe blocker for IDLE reuse?
2. Is `hasGeneratingPlannerResponse(allSteps)` too broad, or correct because any generating planner response means the cascade is not reuse-clean?
3. Is the positive guard correct: answered IDLE turn with terminal planner text plus later error tail should still be reusable?
4. Is fail-open reuse for IDLE trajectories without inline steps acceptable?

### 价值 OQ（给 CVO，如有）

无。This is a live P1 bug fix with low rollback cost.

## Next Action

Please review branch `fix/f211-idle-stall`. If approved, I will run merge-gate: full `pnpm gate`, PR, cloud Codex review, squash merge, doc sync, and runtime restart only if explicitly authorized.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f211-reg11-idle-stall/opus48`
- Start Command: `pnpm review:start` if you want an isolated runtime; unit/backend review does not require a dev server.
- Ports: `web=n/a`, `api=n/a`

## 自检证据

### Spec 合规

- Live root cause reproduced from logs: dirty IDLE cascade reused, then `pollForSteps` stalled.
- Added red tests for both dirty IDLE forms: error-without-terminal-text and generating planner response.
- Added positive guard test for terminal planner text before an error tail.
- Fallback-layer check: net fallback change is `-1`; script still reports cumulative layer count for existing `AntigravityBridge.ts`, not a new fallback stack.
- Hotfix detector: `hotfix=false`.

### 测试结果

Current HEAD after amend:

```bash
pnpm check
# All 22 checks passed

pnpm --dir packages/api run build
# shared + api build passed

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 \
  packages/api/test/antigravity-bridge-session.test.js \
  packages/api/test/agy-trajectory-extractor.test.js
# 59 passed, 0 failed
```

### 相关文档

- Feature: `docs/features/F211-cross-runtime-session-transparency.md`
- Live logs inspected from runtime API log: `../cat-cafe-runtime/packages/api/data/logs/api/api.2026-06-04.1.log`
