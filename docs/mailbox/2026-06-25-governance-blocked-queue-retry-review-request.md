---
title: Governance Blocked Queue Retry Review Request
date: 2026-06-25
doc_kind: review-request
topics: [review-request, governance, queue, retry, hub]
branch: feat/governance-blocked-queue-retry
review_target_id: governance-blocked-queue-retry
---

# Review Request: Governance blocked queue retry fix

Review-Target-ID: governance-blocked-queue-retry
Branch: feat/governance-blocked-queue-retry

## What

Fixes the terminal-status bug behind the Hub governance warning retry loop for newly approved external-project threads.

Changed:
- `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts`
  - tracks `done.errorCode` in the queue execution path
  - mirrors `messages.ts` governance handling so `GOVERNANCE_BOOTSTRAP_REQUIRED` finalizes the invocation as `failed`, not `succeeded`
- `packages/api/test/queue-processor.test.js`
  - adds a regression test for a proposal-style queue invocation that emits `governance_blocked` + terminal `done.errorCode`

## Why

The broken path was not the retry API and not the warning card itself. Proposal-approved initial messages execute through `QueueProcessor`, and that path ignored the governance terminal signal that `messages.ts` already honors. The result was:

- warning card rendered from `governance_blocked`
- invocation record later overwritten to `succeeded`
- `/api/invocations/:id/retry` correctly refused retry on a succeeded record

So the fix belongs in the queue execution plane.

## Original Requirements

> 用 `cat_cafe_propose_thread` 创建新 thread，并指定一个不存在于治理系统的外部项目路径。批准后 thread/initialMessage 都正常，但 Hub 弹出治理 warning 卡片。
> 核心错误：`Cannot retry invocation with status 'succeeded'`
> 期望修复：外部项目路径治理初始化失败时优雅降级，不留无法恢复的 warning 卡片。

- Source: `docs/discussions/2026-06-25-governance-blocked-queue-retry/README.md`
- Please review against the quoted bug intake, not only against the small diff size.

## Tradeoff

Rejected:
- loosening `/api/invocations/:id/retry` to accept `succeeded`
- frontend-only special casing to hide the warning when retry fails

Chosen:
- keep retry semantics strict
- fix the actual terminal-state writer in the queue path so it stays consistent with `messages.ts`

## Architecture Ownership

Architecture cell: dispatch
Map delta: none
Why: this is a terminal-status parity fix inside the existing `InvocationQueue` / `QueueProcessor` execution path; it does not add a new Store, Queue, Router, Adapter, Dispatcher, or Binding.

Please check:
- whether `Map delta: none` matches the diff
- whether the new branch is the right place to honor governance terminal failure
- whether treating queue-path `done.errorCode` as failed has any unintended side effects outside this governance case

## Open Questions

### Technical OQ

- `messages.ts` treats any terminal `done.errorCode` as a failed invocation. This patch mirrors that behavior in `QueueProcessor`. Please sanity-check whether queue-path callers rely on any `done.errorCode` variant that should *not* force `failed`.

### Value OQ

None. This is a narrow, reversible bugfix inside the existing dispatch boundary.

## Next Action

Please do cross-family peer review of branch `feat/governance-blocked-queue-retry` and decide whether the queue-path parity is tight enough to proceed.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/governance-blocked-queue-retry/opus`
- Start Command: `pnpm review:start`
- Ports: not started by author. This patch is backend/queue-path only; primary review can run targeted tests without starting web/api. If reviewer does start a sandbox, allocate from `web=3201`, `api=3202` upward and avoid 3001/3002/3011/3012/4111.

## Quality Gate Report

Spec: `docs/plans/2026-06-25-governance-blocked-queue-retry.md`
Original intake: `docs/discussions/2026-06-25-governance-blocked-queue-retry/README.md`
检查时间: 2026-06-25 21:01 PDT

### Vision / Requirement Coverage

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Governance-blocked proposal initial message must remain retryable. | ✅ | queue path now writes `failed + GOVERNANCE_BOOTSTRAP_REQUIRED` before any success finalization |
| 2 | Hub warning must not point at a zombie succeeded invocation. | ✅ | regression test proves no `status: succeeded` write in this scenario |
| 3 | Fix should stay in the real terminal writer, not by widening retry semantics. | ✅ | retry route unchanged; only queue execution parity updated |

### Functionality

| # | Requirement | Code | Test |
|---|---|---|---|
| 1 | Capture governance terminal signal in queue execution | `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts` | `queue-processor.test.js` governance-blocked regression |
| 2 | Prevent succeeded overwrite after governance block | same file | same regression, asserting absence of `status: succeeded` |

### Artifact Hygiene

- Worktree root media/design artifact check: no output ✅
- `origin/main...HEAD` root media/design artifact check: no output ✅

### Dogfood-Your-Slice

Scope verdict: 🆗 narrowly exempt from browser dogfood.

Reason:
- this patch changes backend queue terminal-state handling only
- the user-visible symptom is downstream of a deterministic invocation status transition
- targeted regression plus dispatch-adjacent proposal test were run against the exact execution plane

Known limitation:
- I did not rerun a full live Hub reproduction in-browser in this turn

### Verification Commands

```bash
pnpm --filter @cat-cafe/api build
bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/queue-processor.test.js
bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/proposal-approve-dispatch.test.js
pnpm --filter @cat-cafe/api lint
pnpm check
```

Result:
- all commands passed ✅

### Related Documents

- Plan: `docs/plans/2026-06-25-governance-blocked-queue-retry.md`
- Discussion: `docs/discussions/2026-06-25-governance-blocked-queue-retry/README.md`

[砚砚/gpt-5.4🐾]
