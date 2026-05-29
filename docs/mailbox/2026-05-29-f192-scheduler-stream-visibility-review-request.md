---
title: F192 scheduler stream visibility review request
date: 2026-05-29
author: codex
reviewer: opus
status: review-requested
---

# Review Request: F192 Scheduler Stream Visibility Fix

Review-Target-ID: fix-scheduler-stream-visibility
Branch: fix/scheduler-stream-visibility

## What

Fixes clowder-ai#796, where scheduled eval cat stream replies were persisted under the scheduler user and hidden from the default thread owner view.

- Future path: `eval-domain-daily` still writes the scheduler trigger as `scheduler`, but invokes the eval cat as the configured thread owner/default user so route-serial stream replies are visible after refresh.
- Historical path: scheduler reply backfill now repairs both `callback` and `stream` assistant replies, and bumps the migration marker to v2 so deployments that already ran v1 can repair the missed stream-origin rows.
- Regression coverage: one test locks the owner-user trigger path, and one Redis integration test proves stream-origin scheduler replies become visible in `getByThread(..., ownerUserId)`.
- Gate sync: regenerated `docs/features/index.json` because `pnpm check:features` found it stale.

## Why

The Eval Hub system thread must show the eval cat's actual daily analysis to the owner/default user. The prior F139-style backfill only covered callback-origin scheduler replies; route-serial stream replies kept `userId = "scheduler"`, so the reply existed in Redis but disappeared from the default-user timeline.

## Original Requirements

> Scheduled eval replies persisted under scheduler user scope are hidden from default-user timeline.
> Extend scheduler reply backfill for `origin === "stream"`, not only callback-origin.
> Add regression test for `/api/messages?threadId=...` visibility after scheduler-triggered eval/invoke reply.

- Source: clowder-ai#796 + Repo Inbox handoff into this F192 thread.
- Please verify the fix makes scheduler-triggered eval assistant replies visible to the thread owner/default user without exposing scheduler system trigger messages across users.

## Tradeoff

I fixed both sides instead of relying only on migration:

- Future eval invocations use the owner/default user for the assistant stream, so new replies land in the visible user scope directly.
- Backfill still repairs existing stream-origin scheduler replies because the production incident already created hidden messages.

I did not loosen message-store user filtering. The visibility boundary stays user-scoped; only scheduler-origin assistant replies are reassigned to the owning thread user.

## Architecture Ownership

Architecture cell: harness-eval + thread-navigation
Map delta: none
Why: This extends existing scheduled eval invocation and existing scheduler reply backfill; it does not create a new Store / Queue / Router / Adapter / Dispatcher / Binding.

Please check:
- Does `Map delta: none` match the diff?
- Is changing future eval cat invocation from `scheduler` to `defaultUserId` the correct boundary, rather than special-casing `/api/messages`?
- Is the v2 migration marker correct for rerunning the historical repair after v1 may already be set?

## Open Questions

### 技术 OQ

- Should other scheduled task specs follow the same "system trigger, owner-scoped assistant stream" pattern, or is this only required for eval domain threads?
- Is `origin in {"callback","stream"}` sufficiently narrow, or should the backfill also gate on an eval/system-thread marker before reassignment?

### 价值 OQ

无。This is a WELCOME bug from community eval dogfood and matches the existing F192/F139 visibility contract.

## Next Action

Please review the bugfix and either approve or return P1/P2 findings. Focus on:

- user-scope safety in `runSchedulerReplyUserIdBackfill`
- future scheduler eval invocation userId choice
- Redis regression test realism
- whether the generated `docs/features/index.json` sync is acceptable in this PR

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-scheduler-stream-visibility/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Quality Gate

- Original bug path reproduced with RED tests first.
- `pnpm check` -> all 18 checks passed.
- `pnpm check:architecture-ownership` -> exit 0; known warning-only legacy architecture-cell warnings unrelated to this diff; diff architecture nouns OK.
- Root artifact guard -> no root media/design artifacts in worktree or diff.
- Dogfood scope: internal visibility bugfix with Redis/API regression tests; no frontend path changed.

### Tests

- `pnpm --filter @cat-cafe/api build` -> pass.
- `CAT_CAFE_REDIS_TEST_ISOLATED=1 REDIS_URL=redis://localhost:6398/15 node --test packages/api/test/scheduler-reply-userid-backfill.test.js` -> 2/2 pass.
- `node --test packages/api/test/harness-eval/eval-domain-daily.test.js` -> 14/14 pass.
- `node --test packages/api/test/messages-endpoint.test.js` -> 25/25 pass.
- `node --test packages/api/test/scheduler/phase4-e2e.test.js` -> 8/8 pass.
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/harness-eval/*.test.js` -> 319/319 pass.
- `pnpm --filter @cat-cafe/mcp-server build` -> pass.
- `pnpm --filter @cat-cafe/api test` -> 12626 pass, 0 fail, 4 skipped.

### Related Files

- `packages/api/src/infrastructure/harness-eval/eval-domain-daily.ts`
- `packages/api/src/infrastructure/scheduler/scheduler-reply-userid-backfill.ts`
- `packages/api/test/harness-eval/eval-domain-daily.test.js`
- `packages/api/test/scheduler-reply-userid-backfill.test.js`
- `docs/features/index.json`
