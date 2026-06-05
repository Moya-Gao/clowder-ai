---
feature_ids: [F193]
topics: [callback-auth, cross-thread, system-threads, review-request]
doc_kind: mailbox
created: 2026-06-05
---

# Review Request: F193 System Thread Cross-Post Auth

Review-Target-ID: fix-f193-system-thread-crosspost
Branch: `fix/f193-system-thread-crosspost`
Commit: `eb4e0e815` (`fix(callbacks): allow indexed system thread cross-posts`)
Worktree: `/Users/lysander/projects/relay-station/cat-cafe-f193-system-thread-crosspost`
Author: [砚砚/GPT-5.5🐾]

## Original Requirements

Source: `thread_mp5blhaqbe5dckek`, user message `0001780631762262-000450-6afaa006`.

> `thread_eval_memory @codex 你也试试看？ 如果 @codex 你也不行 那这好像是谁的bug啊？f192？ 或者是啥的？导致的你们和系统thread没办法通讯？`

Observed repro: `cat_cafe_list_threads(keyword="eval_memory")` can see `thread_eval_memory`, but `cat_cafe_cross_post_message(threadId="thread_eval_memory", targetCats=["codex"])` returns `403 Thread access denied`.

## Change Summary

- Align callback write-side thread authorization with existing read-side/index model.
- `resolveScopedThreadId` and `resolvePrincipalThread` now allow cross-thread access when:
  - target thread is owned by the user, or
  - target thread is `createdBy === "system"` and appears in `threadStore.list(userId)`.
- Preserve fail-closed behavior for:
  - missing thread store,
  - missing target thread,
  - foreign user-owned thread,
  - unindexed non-default system thread.
- Added route-level regression for `/api/callbacks/post-message` to indexed `thread_eval_memory`-style system thread with `targetCats`.

## Architecture Ownership

- Architecture cell: `callback-auth`
- Map delta: `none`
- Why: This extends existing callback scope authorization in `callback-scope-helpers.ts`; it does not create a new store/router/adapter. It reuses `IThreadStore.list(userId)` as the existing user-visible index truth source used by system-thread read paths.

## Review Focus

1. Does using `threadStore.list(userId)` as the indexed-system-thread authorization source match the existing F192/F193 model?
2. Is the fail-closed boundary still tight enough for agent-key and invocation-token paths?
3. Does this unintentionally widen access to default/system threads beyond already user-visible thread list semantics?

## Quality Gate Evidence

- Repro before fix: `cat_cafe_cross_post_message` to `thread_eval_memory` with `targetCats=["codex"]` returned `403 Thread access denied`.
- RED: new indexed-system-thread tests failed with 403 before implementation.
- `NODE_ENV= pnpm --filter @cat-cafe/api run build` -> exit 0.
- `NODE_ENV= pnpm --filter @cat-cafe/api exec node --test test/callback-scope-helpers.test.js test/callback-principal-helpers.test.js test/callback-cross-post-fail-closed.test.js` -> 23/23 pass.
- `NODE_ENV= pnpm lint` -> exit 0; existing web warnings only.
- `NODE_ENV= pnpm check` -> all 22 checks passed.
- `NODE_ENV= pnpm -r --if-present run build` -> exit 0; existing web warnings only.
- First fresh-worktree `NODE_ENV= pnpm test` exposed pre-build ordering failures around `packages/mcp-server/dist`; after workspace build, the failed files passed 252/252.
- Final `NODE_ENV= pnpm test` -> exit 0.
- `node scripts/check-hotfix-pattern.mjs` -> `hotfix:false`.
- `node scripts/check-fallback-layers.mjs` -> cumulative warning only; production helper net fallback change +0, test mock +1.
- Artifact hygiene checks for root media/design files -> no hits.

## Dogfood

Scope verdict: required, because this is a cat-visible callback/cross-thread path.

Dogfood path:
1. Listed target: `cat_cafe_list_threads(keyword="eval_memory")` returned `thread_eval_memory`.
2. Before fix against live runtime: `cat_cafe_cross_post_message(threadId="thread_eval_memory", targetCats=["codex"])` returned 403, confirming the production symptom.
3. In worktree route-level test after fix: indexed system thread + `targetCats` returns 200 through `/api/callbacks/post-message`.

## Open Questions

Technical OQ for reviewer: none blocking; please specifically challenge whether `threadStore.list(userId)` is the right authorization primitive for indexed system threads.

Value OQ for CVO: none.
