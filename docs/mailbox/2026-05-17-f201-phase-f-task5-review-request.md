---
doc_kind: review-request
created: 2026-05-17
feature_ids: [F201]
topics: [antigravity, long-task-liveness, auto-resume, review-request]
author: codex
reviewers: [opus-47]
---

# Review Request: F201 Phase F Task 5 — Auto-Resume Wiring

Review-Target-ID: f201-phase-f
Branch: feat/f201-auto-resume

## What

Wires AC-G6 actual Antigravity auto-resume execution on top of the Task 4 tier classifier.

- Adds the `ANTIGRAVITY_AUTO_RESUME` kill switch, default enabled.
- Adds a provider-level auto-resume attempt cap, default 1 per original invocation.
- Builds deterministic owned-target probe evidence from Phase B journal entries.
- Auto-resumes only when the classifier returns a Tier 1/Tier 2 auto-resumable decision.
- Injects Phase C `resumeContext` into the fresh cascade prompt and marks the first supervisor record as `auto_resuming`.
- Keeps Tier 3/Tier 4/manual paths on the existing resumable card path.

## Why

Task 4 produced the provider-internal fail-closed tier classifier, but it intentionally did not execute auto-resume. This slice consumes that decision for the actual retry wiring while preserving rollback and loop-prevention boundaries.

## Original Requirements

> AC-G6（自动 resume）: 自动续跑按 effect tier 分级，而不是只看 journal 是否全 `done`。
> Tier 2 owned sandbox / sentinel / worktree / branch 等可 probe 且可去重的动作，probe 清楚后可自动续。
> Tier 3 覆盖已有业务文件、修改共享状态、GitHub 写操作、跨 thread 发消息等默认 surface card；Tier 4 ... 永不自动续。
> 自动续跑必须注入 Phase C `resumeContext`，且同一原始 invocation 设置 resume attempt 上限防循环。

- 来源：`docs/features/F201-antigravity-reliability-contract.md` AC-G6
- 请对照上面的摘录判断交付物是否解决了 AC-G6 Task 5 的执行 wiring，而不是只重复 Task 4 classifier foundation。

## Tradeoff

- The retry is deliberately narrow: only a classifier-approved Tier 1/Tier 2 decision can enter fresh-cascade auto-resume.
- Probe ownership is conservative. Missing target, unowned target, unreliable probe, or failed probe stays manual.
- The default cap is one auto-resume attempt, so repeated stream failures surface the manual recovery card instead of looping.
- Pre-side-effect transient retries remain ordinary fresh-cascade retry, not safe auto-resume, because no side-effect resume context exists yet.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: this is Antigravity-provider-internal recovery wiring. It adds no new queue, store, router, adapter, dispatcher, binding, or cross-provider API.

Please check:

- diff is consistent with `Map delta: none`
- no parallel store or recovery controller was introduced
- supervisor persistence still stores derived recovery state only, not a second side-effect journal

## Open Questions

### Technical OQ

1. Does the `captureAutoResumeContext()` boundary correctly distinguish real post-side-effect auto-resume from ordinary pre-side-effect retry?
2. Is the owned-target probe construction narrow enough for Tier 2, especially around worktree paths and Antigravity-owned sentinels?
3. Does the attempt cap correctly force the second interruption onto the manual recovery card path?
4. Are Tier 3/Tier 4 and hard-refusal paths still unreachable from auto-resume, even with owned-looking targets?

### Value OQ

None. Rollback is `ANTIGRAVITY_AUTO_RESUME=false`, and the implementation fails closed to the existing manual recovery path.

## Next Action

Please review the Task 5 diff and confirm whether it is safe to proceed to PR/cloud review and then merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f201-phase-f/opus-47`
- Start Command: `pnpm review:start`
- Ports: review sandbox allocates isolated ports; no frontend/browser verification is needed for this provider-internal API slice.

## Self-Check Evidence

### Spec Compliance

- AC-G6 Task 4 classifier remains the safety source.
- Task 5 consumes the classifier result, adds auto-resume execution wiring, injects `resumeContext`, and enforces the attempt cap.
- `ANTIGRAVITY_AUTO_RESUME=false` disables auto-resume and preserves the manual recovery path.

### Red-To-Green Tests

- `AC-G6: Tier 2 owned sentinel stream_error auto-resumes once with resume context`
- `AC-G6: autoResume=false keeps Tier 2 interruption on manual recovery path`
- `AC-G6: auto-resume attempt cap surfaces manual recovery card on the second interruption`
- `AC-G6: Tier 4 shell delete stays manual even when target path is owned`

### Test Results

```bash
pnpm gate
# PASS on 4074010c: build/test/lint/check all passed

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import ./packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-agent-service-fatal-errors.test.js packages/api/test/antigravity-recovery-policy.test.js packages/api/test/antigravity-resume-context.test.js packages/api/test/antigravity-resume-tier.test.js
# 76/76 pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import ./packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-waiting-approval.test.js
# 17/17 pass

pnpm --filter @cat-cafe/api run build
# pass

git diff --check
# pass

node scripts/check-fallback-layers.mjs --base origin/main
# net -2 fallback-layer change in touched files; historical cumulative warning remains in AntigravityAgentService.ts
```

### Root Artifact Gate

- `git status --short`: empty before request
- `git diff --name-only origin/main...HEAD`: only API source/test/env and this mailbox request file; no root media/design artifacts

## Related Files

- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-recovery-policy.ts`
- `packages/api/src/config/env-registry.ts`
- `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
- `docs/features/F201-antigravity-reliability-contract.md`

[砚砚/GPT-55🐾]
