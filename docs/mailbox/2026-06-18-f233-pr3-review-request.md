---
feature_ids: [F233]
doc_kind: review-request
created: 2026-06-18
---

# Review Request: F233 Phase B PR3 Event Sources

Review-Target-ID: f233
Branch: `feat/f233-pr3-event-sources`
PR: https://github.com/zts212653/cat-cafe/pull/2364
Review head: use the current PR head on GitHub
Implementation commit: `1463eb3db`
Author: [砚砚/gpt-5.5🐾]
Requested reviewer: @opus48

## Original Requirements

Source: `docs/features/F233-ball-custody-observability.md`

> “至少要知道有哪些是不是球到了我手上 然后我 忘了？是不是有哪些球在猫手上但是猫可能出现任何问题 包括网络波动无法继续导致本质球到了我手上 但是我还是 忘了？”

Thread handoff instruction (2026-06-17): “后续两个pr你来做？ 然后让48帮你review 如果48开始出现幻觉你找46或者47”

## What Changed

- Added pure builders for PR3 event kinds in `ball-custody-events.ts`.
- Wired production event sources:
  - `ball.held` after `hold_ball` scheduler commit.
  - `ball.hold_expired` when a hold-ball reminder actually fires.
  - `task.blocked`, `task.unblocked`, `task.done` through `BallCustodyTaskStore`.
  - `invocation.started`, throttled `invocation.heartbeat` from route-serial own turn id + draft/keepalive heartbeat.
  - `invocation.died` from `reconcileZombies` after a running invocation is marked failed.
  - `ball.handed_cvo` from explicit line-start co-creator mention, default intent `handoff`.
- Updated F233 plan/spec docs to mark PR3 boundaries.

## Architecture Ownership

- Architecture cell: `ball-custody`
- Map delta: new cell required, already established by B1; this PR extends that cell's producers and does not add a new cell.
- Why: append-only event log + projector is the single custody ledger; all writes here are observability side effects and must remain non-blocking.

## Boundaries / Tradeoffs

- `task.idle_long` is not generated from `taskStore.update`; it needs ProbeScheduler/aging semantics and stays in PR4.
- `ball.wake_sent` is a WakeSender result event and stays in PR4.
- `ball.handed_cvo` does not classify natural language. It records only explicit co-creator routing as `handoff`; `fyi`/`done_notify` need a future explicit intent input.
- Opus 4.8 P2-1 handled in this branch: ball-custody heartbeat events are throttled to a minimum 30s window per invocation, while draft store flush cadence stays unchanged for F5 recovery.
- Opus 4.8 P2-2 remains a documented PR4 boundary: `fyi`/`done_notify` need explicit intent input, not NL classification.
- Fallback-layer self-check triggered in route-serial. Assessment: acceptable. The added guards and `.catch()` paths isolate optional observability writes from user-visible routing/invocation flow. Removing them would let a telemetry failure break the primary path.

## Quality Gate Evidence

```bash
pnpm --filter @cat-cafe/api build
# pass

node --test packages/api/test/ball-custody-ingest.test.js packages/api/test/ball-custody-state-machine.test.js packages/api/test/ball-custody-projector.test.js packages/api/test/ball-custody-hold-events.test.js packages/api/test/ball-custody-task-store.test.js packages/api/test/ball-custody-invocation-events.test.js packages/api/test/ball-custody-cvo-event.test.js packages/api/test/route-serial-z9-yield-stamps-own-turn.test.js
# tests 55, pass 55, fail 0

pnpm --filter @cat-cafe/api lint
# pass

CAT_CAFE_CHECK_CONCURRENCY=1 pnpm check
# All 27 checks passed

pnpm check
# current residual: check:pre-merge-gate fails only under default concurrency=4 on
# "does shutdown owned orphan Redis"; the same test passes isolated and in serial check.
# This is a harness concurrency isolation issue, not an F233 code-path failure.

pnpm check:architecture-ownership
# exits 0; F233 diff architecture nouns OK, remaining warnings are pre-existing repo-wide warnings

node scripts/check-hotfix-pattern.mjs
# hotfix=false

node scripts/check-fallback-layers.mjs
# triggered self-check; rationale documented above
```

## Review Focus

1. Event source placement: each event should be emitted at the real source of truth, not early or inferred.
2. Idempotency keys: ensure the new `sourceEventId` values do not collide or swallow valid repeated events.
3. Non-blocking behavior: ball-custody writes must not change route/callback/scheduler/task/zombie behavior on failure.
4. Boundary call: confirm `task.idle_long` and `ball.wake_sent` should remain PR4.

## Next Step

If approved, I will handle review feedback and then proceed through merge-gate. PR4 starts after PR3 lands.
