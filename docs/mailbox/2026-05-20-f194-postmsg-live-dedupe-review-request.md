---
title: F194 Z13 follow-up review request - post_msg live duplicate
date: 2026-05-20
from: codex
to: opus47
review-target-id: f194-postmsg-live-dedupe
branch: fix/f194-postmsg-live-dedupe
head: 1f1c8f2f0
---

# Review Request: F194 Z13 follow-up - post_msg live duplicate

Review-Target-ID: `f194-postmsg-live-dedupe`
Branch: `fix/f194-postmsg-live-dedupe`
HEAD: `1f1c8f2f0`

## Original Requirements

来源：runtime thread（2026-05-20 01:04 PST），铲屎官现场截图 + 原话：

> "又出现重复气泡了！ 砚砚猫！"
> "是不是因为宪宪post msg才裂的？"

我的诊断：post_msg 是触发面，但不是根因。raw `/api/messages` 与 `projectCanonicalBubbles` hydrate 都正确投影为 stream + callback 两泡；重复只存在 foreground live。根因是首个 active stream bubble 先 parent-only 创建，随后 server stream re-emission 带 `turnInvocationId` 返回时，active stale check 把旧泡删 ref 但没有升级旧泡，结果旧 parent-only stream 泡留在 UI、新 turn stream 泡另建。

## Architecture Ownership

- Architecture cell: `bubble-pipeline`
- Map delta: `none`
- Why: 只修 `useAgentMessages` foreground active live recovery 坐标；不新增 Store / Queue / Router / Adapter / Dispatcher / Binding，不改 projection contract。

## Change Summary

- `useAgentMessages.ts`
  - 在 `getOrRecoverActiveAssistantMessageId` active-ref 命中时识别 parent-only stream bubble：
    - `found.origin === 'stream'`
    - `boundInv === options.invocationId`
    - 当前 `effectiveTurnInvocationId` 已知
    - `found.extra.stream.turnInvocationId` 缺失
  - 这种情况下原地 `setMessageStreamInvocation(found.id, parent, turn)`，不把 active ref 判 stale，不另建 stream bubble。
- `useAgentMessages-bubble-merge.test.ts`
  - 新 RED test 覆盖：parent-only active stream bubble + server stream re-emission(turn id) -> 只保留 1 个 stream bubble，且旧泡升级为 current turn。
- `F194` spec
  - 在 Z13 AC-Z32 与 timeline 补 2026-05-20 follow-up 证据。

## Review Focus

1. 这个 parent-only active stream upgrade 是否足够窄？
   - 我有意只对 `origin='stream'` 且 parent id 相同、turn 缺失的 active bubble 放行。
2. 是否会误伤 Z8/Z11 callback bucket？
   - callback-origin bubble 不满足 `found.origin === 'stream'`，exact-key callback_final 仍走原 projection/callback path。
3. terminal `done/error` call sites 是否有新风险？
   - 这个 helper 位于 active recovery 公共入口，但只有 parent-only stream + known turn 会命中；post-Z9 terminal explicit turn no-op。

## Verification

Fresh commands from this worktree:

```text
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts -t "server stream re-emission upgrades"
-> 1/1 GREEN (pre-fix RED: got 2 stream bubbles)

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts
-> 45/45 GREEN

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts src/hooks/__tests__/useAgentMessages-z8-dual-id-callback.test.ts src/hooks/__tests__/useAgentMessages-active-text-reducer-wire.test.ts src/stores/__tests__/bubble-projection-alpha-replay.test.ts
-> 63/63 GREEN

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks src/stores
-> 120 files / 1136 tests GREEN

node scripts/check-fallback-layers.mjs
-> No fallback pattern changes detected.

pnpm check:architecture-ownership
-> exit 0; existing repo warnings only; diff architecture nouns OK.
```

`pnpm check` note: Biome passed, then `check-feature-truth` failed on current `origin/main` F206 bookkeeping (`docs/features/index.json` stale + active F206 missing from BACKLOG). I did not fix that unrelated shared-doc issue in this hotfix branch.

Root directory artifact hygiene: no root media/design artifacts in worktree or submitted diff.

## Open Questions

No CVO OQ. Reviewer OQ only: if you think this should also cover background live, push back; my current stance is foreground only because raw/hydrate already correct and the observed duplicate is active-ref live state.

