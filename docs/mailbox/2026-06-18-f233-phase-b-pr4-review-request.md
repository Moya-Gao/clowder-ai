---
feature_ids: [F233]
topics: [ball-custody, review, pr4]
doc_kind: mailbox
created: 2026-06-18
---

# Review Request: F233 Phase B PR4 projection loop

Review-Target-ID: f233
Branch: feat/f233-phase-b-pr4

## What

This PR closes the Phase B PR4 loop for ball-custody observability:

- adds task `probe` + `resolveMode` schema and task-store persistence
- adds `BallCustodyProbeScheduler`, probe evaluator, wake sender, and task spec wiring
- adds `ball.wake_sent` and PR4 `task.idle_long` emission paths
- cuts duty briefing collection from the legacy five-source collector to ball-custody projection when projection data exists
- adds focused in-memory, route, scheduler, event-builder, wiring, and Redis-backed tests

## Why

PR3 deliberately did not fake `task.idle_long` or `ball.wake_sent`. PR4 is the end-to-end closeout: structured projection has to become the read path, and real probe results must either complete blocked tasks or send a real owner wake before recording the wake event.

## Original Requirements

> PR4 -- 端到端闭环: ProbeScheduler + WakeSender + 剩余来源
> (`task.idle_long` aging 判定 + `ball.wake_sent` 唤醒结果事件)
> + task probe/resolveMode + 简报切源（5源->projection）
> + 回归套 -> AC-B1/B2/B3 端到端闭环。

- 来源: `docs/plans/2026-06-14-f233-phase-b-ball-custody-event-stream.md`
- Please judge the implementation against this PR4 closeout scope, not only local code correctness.

## Tradeoff

- Wake delivery stays best-effort and scheduler-tick based. `projector.apply(ball.wake_sent)` only updates `lastWakeAt`; it never sends messages, so rebuild/replay is safe.
- Projection cutover is gated by projection-store availability and non-empty projection index. Empty projection falls back to the legacy collector to avoid a cold-start false-zero briefing.
- Redis tests intentionally use DB 15 + isolated cleanup. While implementing PR4 I found stale `idemp:*` keys could make repeated Redis tests reuse an old invocation id after only `invoc:*` cleanup; the cleanup now clears both.
- Fallback-layer check warns by design. Coordinate self-check: these are boundary defaults and failure isolation, not wrong-coordinate fallback:
  - probe evaluator defaults `expectStatus=200` and `timeoutMs=5000`
  - scheduler catches per-subject failures so one broken probe does not stop the tick
  - duty briefing projection mode keeps legacy fallback only for missing/empty projection store
  - wake sender catches only optional invoke-trigger failures after the real scheduler delivery call

## Architecture Ownership

Architecture cell: `ball-custody`
Map delta: none
Why: PR4 extends the existing ball-custody cell with its planned scheduler/evaluator/sender read loop and switches duty-briefing to that read model; it does not introduce a parallel store/router/dispatcher.

Please reviewer-check:
- whether `BallCustodyProbeScheduler` belongs inside the existing `ball-custody` cell as implemented
- whether the duty-briefing cutover is a read-side extension rather than a new ownership boundary
- whether `Map delta: none` remains true despite the warning-only architecture noun report

## Open Questions

### Technical OQ

1. Is `sourceEventId = wake:{taskId}:{blockedSinceAt}:{at}` the right wake idempotency boundary, given cooldown is the actual duplicate-suppression mechanism?
2. Is the projection cutover condition (`projectionStore` present and index non-empty) the least surprising cold-start behavior?
3. Does `task.idle_long` aging in the scheduler correctly respect the "do not fake source" boundary from PR3?
4. Are the probe schema fields narrow enough for this PR, or should PR4 split additional probe kinds into later work?

### Value OQ

None. This follows the existing F233 plan and keeps all choices reversible within one PR.

## Next Action

Please do a cross-family review and post a logical verdict on the PR as an issue comment, covering HEAD `221c33eb3` or later.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f233/opus48`
- Start Command: `pnpm review:start` if you want a sandbox; this PR is backend-only and can also be reviewed with `git show` + node tests.
- Ports: no dev server was started by author; avoid 3001/3002/3011/3012/4111 if you start one.

## Self-Check Evidence

### Spec Compliance

- PR4 fields from plan are implemented: ProbeScheduler, WakeSender, `task.idle_long`, `ball.wake_sent`, task probe/resolveMode, and projection-backed duty briefing.
- Rebuild safety: wake side effect is only in scheduler tick; projector replay has no external side effects.
- AC-B1/B2/B3 coverage is represented in scheduler/projection/Redis tests. No UI or frontend route changed.

### Tests and Gates

Passed after rebasing onto `origin/main`:

```bash
pnpm --dir packages/api build && node --test \
  packages/api/test/task-store.test.js \
  packages/api/test/tasks-route.test.js \
  packages/api/test/ball-custody-task-store.test.js \
  packages/api/test/ball-custody-projector.test.js \
  packages/api/test/ball-custody-pr4-events.test.js \
  packages/api/test/ball-custody-probe-scheduler.test.js \
  packages/api/test/ball-custody-index-wiring.test.js \
  packages/api/test/duty-briefing-collect.test.js
# 88 pass, 0 fail

REDIS_URL=redis://localhost:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1 \
  node --test --test-concurrency=1 \
  packages/api/test/duty-briefing-collect-redis.test.js \
  packages/api/test/ball-custody-projector-redis.test.js \
  packages/api/test/ball-custody-event-log-redis.test.js
# 23 pass, 0 fail

CAT_CAFE_CHECK_CONCURRENCY=1 pnpm check
# All 27 checks passed

pnpm -r --if-present run build
# exit 0; existing web lint warnings only
```

Additional checks:

```bash
git diff --check origin/main...HEAD
node scripts/check-hotfix-pattern.mjs
node scripts/check-fallback-layers.mjs
pnpm check:architecture-ownership
```

Notes:

- `check-fallback-layers` triggers warning-only coordinate self-check; rationale is in Tradeoff above.
- `check:architecture-ownership` exits 0 and warns on diff nouns in `BallCustodyProbeScheduler` and duty-briefing read path; architecture cell is `ball-custody`, map delta none.
- Full `pnpm test` was attempted before this request and has one unrelated current-main failure in `packages/api/test/route-serial-routing-guard-remedial.test.js` (`expected 1 invocation, got 2`). This PR has no diff in route-serial source or that test.

### Root Artifact Gate

```bash
git status --short
# clean

find . -maxdepth 1 \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.gif' -o -name '*.webp' -o -name '*.mp4' -o -name '*.mov' -o -name '*.pen' \) -print
# empty
```

### Related Documents

- Plan: `docs/plans/2026-06-14-f233-phase-b-ball-custody-event-stream.md`
- Feature: `docs/features/F233-ball-custody-observability.md`
- Architecture cell: `docs/architecture/ownership/cells/ball-custody.md`

[砚砚/GPT-5.5🐾]
