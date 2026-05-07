---
feature_ids: [F061, F184]
topics: [review-request, bubble-pipeline, draft-live-split]
doc_kind: review-request
created: 2026-05-07
author: codex
reviewer: opus
---

# Review Request: Draft + Live Bubble Split Reconcile

Review-Target-ID: draft-live-split
Branch: fix/draft-live-split

## What

Fixed the frontend split where one running invocation can render as two assistant bubbles:

- A persisted server draft from `/api/messages` (`draft-{invocationId}`)
- A local live stream bubble for the same cat/invocation that started before identity binding was restored

The patch closes both identity gaps:

- `useAgentMessages.ts`: when an explicit `invocationId` arrives for an active or recovered invocationless stream bubble, back-fill `extra.stream.invocationId` and update the active bubble ledger binding.
- `useChatHistory.ts`: during replace hydration, if there is exactly one running server draft for the same cat, merge it into the local live stream bubble instead of keeping both.

## Why

The screenshot symptom was not CSS. Runtime evidence showed the thread had a real `draft-*` assistant message persisted for Opus while the UI also had a live active Opus bubble. That means the message pipeline lost a stream identity binding, so history hydrate and active streaming treated the same run as two bubbles.

## Original Requirements

> 以及还是 气泡是分裂的！ 直接两个气泡
> 图1和图2是同一个thread f5前后的样子

- 来源：A2A current thread, 2026-05-07 铲屎官原话 + screenshots
- 请对照上面的摘录判断：这版是否修掉“同一运行期 assistant response 被拆成 draft bubble + live bubble”的前端问题。

## Tradeoff

This intentionally stays inside the existing bubble identity coordinate system. It does not add a new reducer path or a parallel draft store. The hydration fallback only fires when there is exactly one server draft for that cat; ambiguous multiple drafts are left untouched to avoid unsafe merges.

## Architecture Ownership

Architecture cell: bubble-pipeline
Map delta: none
Why: Extends existing stream identity binding and hydration reconciliation; no new Store/Queue/Router/Adapter/Dispatcher/Binding is introduced.

Please reviewer check:

- Whether matching a unique same-cat server draft is narrow enough, or should require an additional timestamp/content proximity guard.
- Whether active-path back-fill on explicit `invocationId` can misbind a stale invocationless bubble in any known preempt/reconnect race.
- Whether `Architecture cell: bubble-pipeline / Map delta: none` matches the diff.

## Open Questions

- `check:architecture-ownership` reports a warning on `const recoveredMessage = useChatStore`; I believe this is a mechanical noun false positive, not a new ownership cell.
- `pnpm check` is currently blocked by unrelated formatting errors in architecture generator scripts on main; changed-file biome check is clean.

## Next Action

Please review the branch and focus on identity safety, especially false-positive merge risk.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/draft-live-split/opus`
- Start Command: `pnpm review:start`
- Ports: assigned by `pnpm review:start`

## 自检证据

### RED

Both regressions failed before the fix:

```text
useChatHistory replace hydration:
expected ids ['b1', 'local-stream-opus']; received ['b1', 'local-stream-opus', 'draft-inv-live']

useAgentMessages bubble merge:
expected setMessageStreamInvocation('msg-active-invocationless', 'inv-late-bind')
Number of calls: 0
```

### Tests

```text
NODE_ENV=test pnpm -C packages/web exec vitest run \
  src/hooks/__tests__/useChatHistory-replace-hydration.test.ts \
  src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts
# 2 files passed, 56 tests passed

pnpm --filter @cat-cafe/web exec biome check --diagnostic-level=error \
  src/hooks/useChatHistory.ts \
  src/hooks/useAgentMessages.ts \
  src/hooks/__tests__/useChatHistory-replace-hydration.test.ts \
  src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts
# pass

pnpm --filter @cat-cafe/web exec tsc --noEmit --pretty false
# pass

pnpm --filter @cat-cafe/web build
# pass; existing no-hardcoded-colors / exhaustive-deps warnings only

node scripts/check-fallback-layers.mjs
# No fallback pattern changes detected

node scripts/check-hotfix-pattern.mjs
# hotfix=false
```

### Known Unrelated Gate Noise

```text
pnpm check
# fails before project checks on unrelated formatting in:
# docs/architecture/assets/2026-05-05/generate-architecture-diagrams.mjs
# docs/architecture/ownership/generate-readme.mjs
```

## Related Files

- `packages/web/src/hooks/useAgentMessages.ts`
- `packages/web/src/hooks/useChatHistory.ts`
- `packages/web/src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts`
- `packages/web/src/hooks/__tests__/useChatHistory-replace-hydration.test.ts`
