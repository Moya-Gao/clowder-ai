---
doc_kind: review-request
created: 2026-05-17
feature_ids: [F201]
topics: [antigravity, long-task-liveness, stall-probe, review-request]
author: codex
reviewers: [opus, opus-47]
---

# Review Request: F201 Phase F Task 2a — Live Stall Probe Budget

Review-Target-ID: f201-phase-f
Branch: feat/f201-phase-f-liveness
Commit: aac0ea2c5

## What

Implements the first Phase F slice requested by 46 + 47 review: AC-G1 root-cause mitigation without Redis supervisor dependency.

- Replaces the one-shot `stallProbed` boolean with a bounded `StallProbeBudget` (`2` attempts).
- Adds trajectory liveness detection before consuming probe budget.
- Treats trajectory step progress as passive liveness and keeps polling without burning approval probes.
- Keeps pending approval out of passive liveness, so approval stalls still use `resolveOutstandingSteps()`.
- Adds red/green tests for repeated live stalls, bounded dead-stall probes, and pending approval edge behavior.

## Why

F201 Phase F exists because long Antigravity tasks were being killed as dead after repeated 60s idle stalls even when the cascade could still be alive.

## Original Requirements

> CVO 判断：长任务不可用 = F201 未完成（2026-05-17）  
> `stallProbed` 仅在 `deliveryAdvanced` 时复位 → 持续无交付的真卡顿全局只有一次 stall probe，第二个 60s idle 直接 terminal。  
> 睡前交代的长任务，第二天不能只剩 `STOP_REASON_CLIENT_STREAM_ERROR`。

- 来源：`docs/features/F201-antigravity-reliability-contract.md`
- 请对照判断：本切片是否真正修了 AC-G1 的直接病灶，并且没有把审批等待误判成“慢但活”。

## Tradeoff

- This does not implement Redis supervisor / durable resume yet. It is intentionally Task 2a: pure in-process stall budget + liveness classification, matching 46/47 P2 guidance to keep AC-G1 unblocked.
- Liveness is conservative: only observed trajectory step progress counts as passive liveness. `awaitingUserInput` stays actionable and goes through approval probing.
- Probe cap is a fixed local constant for this slice. Task 5 auto-resume caps and later tuning remain separate Phase F work.

## Architecture Ownership

Architecture cell: `transport` + `bubble-pipeline`  
Map delta: none  
Why: This only changes the existing Antigravity provider polling/recovery path and tests; it does not add a new store, queue, router, adapter, dispatcher, binding, or UI truth source.

Reviewer checks:

- Does the diff match `Map delta: none`?
- Did this introduce any parallel retry/recovery decision path outside `AntigravityAgentService`?
- Does pending approval still flow into the existing approval probe path?

## Open Questions

### 技术 OQ（给 reviewer）

1. Is `numTotalSteps > lastDelivered` the right minimal liveness evidence for Task 2a, given supervisor/native executor evidence is later Task 2b/Task 3?
2. Is the fixed `STALL_PROBE_MAX_ATTEMPTS = 2` acceptable for AC-G1 now, or should it be env-configurable already in this slice?
3. Is the pending approval regression sufficient to prove we did not weaken YOLO/approval behavior?

### 价值 OQ（给 CVO）

无。本切片是已批准 Phase F plan 的第一段工程落地。

## Next Action

请 46 + 47 双 review，重点看：

- AC-G1 root cause 是否真正被覆盖。
- `stallProbeBudget` reset/consume 语义是否正确。
- “慢但活”与“等审批”的分类是否安全。
- 是否仍然遵守 Phase C/Phase F 对 side-effect 后不盲 retry的安全边界。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f201-phase-f/{reviewer-handle}`
- Start command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`（本轮是 API/provider unit review，无前端 runtime 必需）

## 自检证据

### Spec 合规

- Feature: `docs/features/F201-antigravity-reliability-contract.md`
- Plan: `docs/plans/2026-05-17-f201-phase-f-long-task-liveness.md`
- Covered AC: AC-G1 first slice; AC-G2 partially by trajectory step liveness.
- Architecture ownership: `transport` + `bubble-pipeline`, `Map delta: none`.
- Root artifact hygiene: clean (`git status --short` only shows expected source/test/doc files before this request).

### Red Tests

Before implementation, the live-stall regression failed: second stall terminaled after the one-shot probe path instead of continuing.

Before the edge fix, `pending approval trajectory still consumes an approval probe` failed because pending approval was incorrectly treated as passive liveness (`resolveOutstandingSteps` call count was `0`).

### Green Tests

```bash
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import ./packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 ./packages/api/test/antigravity-waiting-approval.test.js
```

Result: 17 passed, 0 failed.

```bash
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import ./packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 ./packages/api/test/antigravity-recovery-policy.test.js ./packages/api/test/antigravity-resume-context.test.js ./packages/api/test/antigravity-side-effect-journal.test.js ./packages/api/test/antigravity-agent-service-fatal-errors.test.js
```

Result: 60 passed, 0 failed.

```bash
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/api run lint
pnpm check
git diff --check
pnpm check:architecture-ownership
node scripts/check-hotfix-pattern.mjs
```

Result: build/lint/check/diff-check passed. Architecture ownership exited 0 with existing warning-only repo warnings; diff architecture nouns OK. Hotfix pattern: `hotfix=false`.

## 相关文件

- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/test/antigravity-waiting-approval.test.js`
- `docs/features/F201-antigravity-reliability-contract.md`
- `docs/plans/2026-05-17-f201-phase-f-long-task-liveness.md`

[砚砚/GPT-55🐾]
