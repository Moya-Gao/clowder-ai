---
feature_ids: [F173]
topics: [review-request, frontend, thread-runtime, fixture, regression-guard]
doc_kind: note
created: 2026-04-25
---

# Review Request: F173 Phase B-3 — thread switch ghost-bubble fixture

Review-Target-ID: f173-b3
Branch: feat/f173-b3-fixture
PR: https://github.com/zts212653/cat-cafe/pull/1391
HEAD: 62cacd8da

## What

新增 `packages/web/src/hooks/__tests__/useSocket-background-thread-switch.test.ts`（207 行 fixture-only），3 条测试锁定 Phase A merge 后的 thread-switch invariant：

1. 非 current thread 的 stream chunk 进 `threadStates` only，不污染 flat
2. 双 thread 并发 stream 在 thread switch 前后互不干扰
3. 切换后 done event 正确 finalize 之前的 thread，不 touch current

Fixture 直接驱动 `handleBackgroundAgentMessage` 跑真实 `useChatStore`，模仿现有 `useSocket-background.test.ts` 的 `simulateBackgroundMessage` helper pattern，但聚焦 thread-switch race surface。

## Why

F173 路线图 2026-04-25 重新规划（spec timeline 已记录, commit `75bb29bd6`）：B-3 fixture 抽出作 pre-Phase C 独立小 PR。Phase C 主线（hydration 简化 + 历史 dup 视觉合并层）会大幅改动 thread-runtime 读路径——这些 fixture 是 Phase C 改动时**必须保持绿**的回归门禁。

现有 `useSocket-background.test.ts` 已覆盖 "thread switch 后单一 stream recovery"（line 1224/1301/1330），但 **缺**：并发流路由隔离 / flat state 不被污染 / terminal event 跨 thread routing。这 3 个 invariant 是 Phase C hydration rewrite 最容易破坏的。

## Original Requirements（必填）

> "我建议面向最终状态来规划 少绕路，如果这样的话应该是怎么做？ 先c？"
> "我同意 但是你得先commit push你现在规划的路线图 到f173避免后续 忘记？ 然后再开wktree"

- 来源：本 thread `thread_moay5tqumsbu17yr`，2026-04-25 01:47-03:08
- 路线图决策：B-3 fixture 抽出作 pre-Phase C 独立小 PR（fixture only），Phase C 主线 PR = hydration 简化 + 历史 dup 视觉合并层 + 同 PR 砍 useSocket-background 的 hydration 协助函数
- 真相源：F173 spec line 129 (AC-B4) + line 214 (Timeline 2026-04-25 03:08)

## Tradeoff

**Fixture vs Bug Fix 心智差异**：fixture 测的是已有 invariant，不是 fix bug——TDD 角度，fixture 价值在于**锁定**而不是**驱动**。3/3 在当前 main 上**直接 Green**（不存在"先红后绿"），因为 Phase A merge 已经把这些 invariant 修对了。Fixture 的 ROI 来自 Phase C 改动时它可能变红的能力。

**重复 vs 独立**: 没有 import 现有 `simulateBackgroundMessage`（它非 export），而是新 file 本地定义了一个简化版 `simulate(msg)`。理由：fixture 应该自包含、independent、不依赖既有 1857 行测试文件的内部 helper；新文件有自己的 setup 和 reset 节奏。如果你认为应该 export 共享 helper 我可以拆。

**位置选择**: 没放在既有 `useSocket-background.test.ts`（已 1857 行）也没放在 `chatStore-multithread.test.ts`，而是新文件 `useSocket-background-thread-switch.test.ts`。理由：scope 命名清晰、独立可读。

## Open Questions

1. 3 个场景是否真覆盖 thread switch 的 race window，还是漏了关键变种？我考虑过的但没加：
   - `invocation_created` 事件在 thread switch 后到达（应 bind 正确 thread）
   - reconnect 后多个 stale unbound bubble 共存场景
   这两个属于 AC-B7 的 backlog，更适合 Phase C 一起做，不在 fixture-only PR 范围。
2. 本地 helper `simulate(msg)` 是否应该改成 import 共享 helper？
3. Fixture 验证机制：当前 3/3 直接 Green。如果你建议要"先红后绿"demo 验证 fixture 真能 catch 破坏，我可以临时 break handler 跑一遍录证据（不入 commit）。

## Next Action

请 review PR #1391。fixture-only / 0 production code change，主要看 fixture 设计是否能真正给 Phase C 提供门禁价值。

## Review Sandbox（必填）

- Path: 不需要独立沙盒，fixture 跑 vitest 即可
- Command: `cd packages/web && pnpm exec vitest run src/hooks/__tests__/useSocket-background-thread-switch.test.ts`
- 或全套: `cd packages/web && node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/hooks/__tests__/`

## 自检证据

### Spec 合规

- AC-B4 fixture 验证（spec line 129）— 直接对应
- F173 timeline 2026-04-25 03:08 路线图重新规划已落 main `75bb29bd6`
- 根目录媒体/设计工件闸门：无命中
- Diff scope: 1 文件 +207 行（fixture-only）

### 测试结果

```bash
# 本 fixture
$ cd packages/web && pnpm exec vitest run src/hooks/__tests__/useSocket-background-thread-switch.test.ts
Test Files  1 passed (1)
     Tests  3 passed (3)

# 全量 hooks 回归
$ node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/hooks/__tests__/
Test Files  61 passed (61)
     Tests  494 passed (494)

# Biome
$ pnpm biome check packages/web/src/hooks/__tests__/useSocket-background-thread-switch.test.ts --diagnostic-level=error
Checked 1 file in 28ms. No fixes applied.
```

### Rebase / Coverage

- HEAD `62cacd8da` 基于最新 `origin/main=b48194acf`（已 rebase）
- `origin/main` 是 HEAD 的祖先（merge-gate 硬条件）

### 相关文档

- Feature: `docs/features/F173-frontend-message-pipeline-unification.md`（AC-B4 + Timeline 2026-04-25）
- 上游 PR: #1373（Phase B-1, squash `30cc69e70`）, #1379（Phase A hotfix3, squash `6f7d97ab`）

[宪宪/Opus-47🐾]
