---
feature_ids: [F252]
topics: [story-player, adaptive-pacing, chapters, review-request]
created: 2026-06-26
---

# Review Request: F252 Phase B — Adaptive Pacing + Single-Session Chapters

Review-Target-ID: f252
Branch: feat/f252-phase-b

## What

F252 Story Player Phase B — 两个 AC：

1. **AC-B1 自适应节奏**：idle gap >5min 自动跳过 + "⏩ 跳过 N 分钟" 指示器；传球事件（@mention/cross_post）自动减速 5x + 琥珀色高亮；用户可切换 adaptive vs fixed speed
2. **AC-B2 章节系统（单 session）**：从 invocation 边界、传球事件、idle gap 恢复点提取章节标记，进度条上可点击跳转。多 session 章节（from F233 entries）推迟到 Phase C

新文件：`adaptive-pacing.ts`、`chapters.ts` + 3 个测试文件（54 tests）
修改文件：`replay-engine.ts`、`types.ts`、`useReplayEngine.ts`、`ReplayControls.tsx`、`ReplayEventBubble.tsx`、`page.tsx`

## Why

Phase A 只有固定倍速。观众看长 session 回放时需要智能节奏——idle gap（猫猫等铲屎官、等 CI）应跳过，传球时刻（@mention）应减速让观众看清协作流。章节标记让观众能跳到感兴趣的点。

## Original Requirements（必填）
> "到某个节点我能点暂停 好像也挺好"
> "那如果涉及多个thread呢！！你们现在f128 f225等等用的可6了 甚至有的是事件驱动的！"
- 来源：`docs/features/F252-story-player.md` Why 段铲屎官原话（2026-06-25）
- **请对照上面的摘录判断：章节跳转 + 自适应节奏是否解决了"回放节奏合理"的需求**

## Tradeoff

- **多 session 章节**：spec AC-B2 写"从 F233 FeatTrajectoryProjection.entries 提取"，但 F233 projector 只实现了 `closed` kind，其他 6 个 ball-shaped kinds（`thread_split`/`phase_transition`/`pr_merged` 等）的 `mapBallCustodyEventToTrajectory` return null。正确决策：单 session 章节先做，多 session 章节推到 Phase C 前置工作（补 F233 emitters）
- **Pass-ball slowdown in MAX mode**：MAX 模式不受 slowdown 影响（观众显式要瞬间跳转），但 amber highlight 仍生效

## Architecture Ownership（必填）

Architecture cell: story-player (web)
Map delta: none
Why: adaptive-pacing 和 chapters 都是 Phase A replay engine cell 的内部扩展模块，不新增架构 cell、不新增 store/queue/router

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（应无新增并行 Store/Queue/Router）
- adaptive-pacing.ts 和 chapters.ts 是否属于 replay engine 内部，不越界

## Open Questions

### 技术 OQ（给 reviewer）
1. `CAT_HANDLES` 数组（adaptive-pacing.ts）硬编码了所有猫猫 @handle。这对当前 demo 够用，但新猫加入时需手动更新。是否值得改成从 cat-config.json 动态读取？（我倾向 Phase D 再动态化，当前 hardcode 是正确的简洁选择）
2. `extractChapters` 的 dedup priority（pass_ball > invocation > post_idle）是否合理？同一 event 同时是传球 + 新 invocation + idle 恢复时，只保留最高优先级

### 价值 OQ（给 CVO，如有）
无

## Next Action

请 reviewer：
1. 重点审 `adaptive-pacing.ts` 的 idle 阈值（5min strict-gt）和 pass-ball 检测逻辑（@mention regex + 协作工具名集合）
2. 审 `chapters.ts` 的 dedup 策略和 label 生成
3. 审 `replay-engine.ts` 的 speed clamping 逻辑（Math.max(1, speed/5)）
4. 确认 54 新测试覆盖了边界条件

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f252/gpt52`
- Start Command: `pnpm review:start`
- Ports: 本 PR 纯前端逻辑层改动（无 API 变更），reviewer 可纯代码审查 + 跑测试验证，无需启动 dev server

### 沙盒 Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm --filter @cat-cafe/shared build
```

## 自检证据

### Spec 合规
Quality Gate Report 已附在 PR #2564 body。
AC-B1 全部满足（idle skip + pass-ball slowdown + toggle + highlight）。
AC-B2 单 session 部分满足，多 session 推迟到 Phase C（F233 依赖）。

### 测试结果

```bash
# Story-player targeted tests
pnpm --filter @cat-cafe/web exec vitest run src/lib/story-player/
# → 7 files, 128/128 pass ✅

# Full suite
pnpm test
# → 527 files, 4713/4713 pass ✅

# Lint
pnpm lint → 0 new errors ✅

# Code gate
pnpm check → 0 errors ✅

# Build
pnpm -r --if-present run build → exit 0 ✅

# Biome (scoped)
pnpm --filter @cat-cafe/web exec biome check src/lib/story-player/ src/components/story-player/ src/app/story/
# → 0 errors, 0 warnings ✅
```

### 相关文档
- Feature: `docs/features/F252-story-player.md`
- PR: #2564
