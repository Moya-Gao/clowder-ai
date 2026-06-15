# Review Request: F229 Phase B1 — switchboard triage

Review-Target-ID: f229
Branch: feat/f229-phase-b
PR: https://github.com/zts212653/cat-cafe/pull/2299

## What

F229 Phase B PR-B1: 前台猫总机能力第一半，交付 AC-B1 的可确认分诊链。

新增/修改重点：
- `ConciergeTriagePlanStore`：TriagePlan port + Redis + Memory，TTL=0。
- `/api/concierge/confirmations` / `/api/concierge/triage` / confirm/cancel / propose-thread endpoints。
- duty-cat prompt Phase B 扩展：分诊计划仍走 MD-first + validator，不让模型直接执行工具。
- reply validator：解析 `[传话给 Rn]` / `[跟去 Rn]` / `[开新调查]`，HandleMap 解析失败 fail-closed。
- targetCats resolver：单候选自动，0/多候选 fail-closed，不盲投。
- `CardBlock` confirm/cancel/propose-thread action handlers + `useConciergeConfirmations` mount-time recovery。

## Why

Phase A 已经让前台猫能找、能跳、能看。Phase B 的第一步是让它能“接线”：用户一句话进来，系统生成可确认的分诊计划，确认后执行 relay / go / propose_thread，并且刷新后确认状态可恢复。

## Original Requirements

来源：当前 F229 thread + `docs/plans/2026-06-15-f229-phase-b-switchboard.md`

> 铲屎官：我们现仔细规划一下 b？然后可能 e 这个门面等 b 之后先搞一下？现在的有点太丑了
> 铲屎官：fable喵被拷走了，你最好和 5.5 砚砚一起讨论你们的 Phase B，看看铲屎官的愿景……等 b 完成我们再考虑 e
> 铲屎官：Phase B 搞四个 pr！？……你们一个 b 打算写多久！

请 reviewer 对照判断：本 PR 是否把 Phase B PR-B1 收成一条 AC-B1 用户链，而不是拆成半成品中间态。

## Tradeoff

- **B1 一 PR 做完 AC-B1**：confirmation persistence / TriagePlan / relay-go-propose dispatch / receipt recovery 是同一条用户链，拆开会产生不可验收中间态。
- **不做 relay 监听子系统**：v1 receipt 只保证投递留痕；目标猫回复仍通过已有 cross_post 回 concierge thread。
- **不做 document action**：doc/feature/GitHub references 留给 B2 报告文本，B1 只对 thread/message 生成可执行 action。
- **不让模型写 JSON 或直接 dispatch**：继续 Phase A/KD-17 的 MD marker + validator + confirmation gate。

## Architecture Ownership

Architecture cell: `concierge-surface`
Map delta: none
Why: 本 PR 扩展既有 F229 concierge surface 的 product state/store/routes/action handling；没有新建 parallel agent/runtime/router cell。

请 reviewer 检查：
- diff 是否仍在 `concierge-surface` 边界内。
- TriagePlan 是否是 product state，而不是模型上下文里的临时状态。
- confirm route 是否在状态迁移前完成可执行性校验，避免“确认了但没有可执行目标”。

## Open Questions

### 技术 OQ

1. **确认前解析是否足够硬**：`reply-validator` 现在要求 relay/go 的 target 必须是 HandleMap R-handle，且必须解析到 thread anchor；free-text target fail-closed。请重点看是否还有路径能创建不可执行 TriagePlan。
2. **targetCats resolver 是否安全**：0/多候选 fail-closed 到用户选择（B1 还没有 selection UI），单候选才自动。请确认没有盲投。
3. **dispatch 状态机边界**：confirm route 对 invalid target 标记 failed + 422；dispatch error 标记 failed + 502；成功路径写 completed/result。请确认状态迁移和返回码一致。
4. **propose_thread 执行面**：B1 提供后端 endpoint + CardBlock action；请确认没有把 MCP/外部调用藏进模型层。

### 价值 OQ

无。铲屎官已明确 Phase B 先做总机、Phase E 门面等 B 后；PR 拆分已从 4 PR 收敛为 2 PR。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f229/gpt52`
- Branch: `feat/f229-phase-b`
- Start Command: `pnpm review:start`

## Self-Check Evidence

### Quality Gate

```
pnpm gate
✅ GATE PASSED
Branch : feat/f229-phase-b
SHA    : 272d1f6c
Base   : rebased onto origin/main
Tests  : all passed
Lint   : passed
Check  : passed
```

### Focused Tests

```
node --test \
  packages/api/test/concierge-phase-b-route.test.js \
  packages/api/test/concierge-triage-plan-store.test.js \
  packages/api/test/concierge-reply-validator.test.js \
  packages/api/test/concierge-target-cats-resolver.test.js

61/61 pass
```

### Build / Typecheck

```
pnpm --filter @cat-cafe/api build
pnpm --filter @cat-cafe/web exec tsc --noEmit
```

Both passed.

### Browser Smoke

Feature worktree dev server opened at `http://127.0.0.1:3211` with:

```
FRONTEND_PORT=3211 API_SERVER_PORT=3212 PREVIEW_GATEWAY_PORT=0 pnpm dev:direct --quick --memory
```

Playwright opened `/` and saved `data/review-smoke-f229-b1-home.png` locally (ignored artifact). The page rendered successfully in memory mode. Concierge interaction could not be fully exercised in that ephemeral mode because the memory-mode catalog had no available cats; interaction behavior is covered by the focused tests above.

### Root Artifact Guard

`git status --short --branch` clean before this request file. No root media/design artifact in committed diff.

## Reviewer Focus

Please review PR #2299 with emphasis on:
1. TriagePlan lifecycle and fail-closed behavior.
2. HandleMap-backed target resolution before confirmation.
3. targetCats resolver safety.
4. CardBlock action wiring and confirmation recovery.

After review, route back to the author.
