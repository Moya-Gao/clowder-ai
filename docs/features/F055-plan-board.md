---
feature_ids: [F055]
related_features: [F045]
topics: [plan-board, task-progress, multi-cat, right-panel, ux]
doc_kind: spec
created: 2026-03-03
---

# F055 — 猫猫祟祟（Plan Board）

> **Status**: spec
> **Owner**: 布偶猫 (Opus)
> **Reviewer**: TBD（跨 family 优先）
> **Created**: 2026-03-03
> **Evolved from**: F045（计划看板 stale bug）→ 发现设计层问题 → 新立项

## Why

右上角"当前调用"板块把**路由意图**（targetCats）和**执行进度**（task_progress）耦合在一起。单猫串行还勉强能用，但 8 只猫并发时：

- targetCats 只反映最新一次 intent_mode，丢失其他猫
- 猫 A 完成后 targetCats 没清，面板不刷新（F045 修过但治标不治本）
- completed 快照被 hydration 恢复时塞回 targetCats（PR #201 补丁）
- "当前调用"区混了 cat status + invocation info + task progress，职责不清

**铲屎官原话**："不建议做最小，而是按照一个新的 feat 那样对齐需求搞……和 session chain 类似新增一个 mission / plan 的板块，多少只猫不同的 plan 各自管各自的。"

## What

在右侧状态栏新增独立的 **「猫猫祟祟」** 板块（类似 SessionChainPanel 的独立 section），专门展示每只猫的执行计划/任务进度，与"当前调用"板块解耦。

### 设计要点

1. **独立板块**：不修改现有"当前调用"section，新增 `<PlanBoardPanel />` 作为独立 section
2. **显示范围**：只显示当前 thread 中有过 invocation 的猫（不论 running / completed / interrupted）
3. **每猫独立卡片**：每只猫一张计划卡，各管各的，互不影响
4. **完成态折叠**：completed 的计划折叠到底部（类似 session chain 的 sealed sessions），可展开查看
5. **实时刷新**：基于 `catInvocations` 变化自动刷新，不依赖 targetCats
6. **名字来源**："猫猫祟祟"= 猫猫鬼鬼祟祟执行计划

### 信息架构

```
「猫猫祟祟」(N 只猫有计划)
├─ 🟢 执行中的猫（按 startedAt desc）
│  ├─ [opus] ██████░░░░ 3/7 任务
│  └─ [codex] ████░░░░░░ 2/8 任务
├─ 🟡 已中断（有"继续"按钮）
│  └─ [gemini] ████████░░ 5/6 任务 [继续]
└─ ▼ 已完成 (2)   ← 折叠，点击展开
   ├─ [opus] ✓ 7/7 · 2分钟前
   └─ [sonnet] ✓ 4/4 · 5分钟前
```

### 数据来源

- **唯一数据源**：`catInvocations: Record<string, CatInvocationInfo>` — 已有的 store 数据
- **分类依据**：`taskProgress.snapshotStatus` (`running` / `completed` / `interrupted`)
- **不再依赖**：`targetCats`（路由意图归路由意图，执行进度归执行进度）

### 与"当前调用"的关系

- "当前调用"保留原有职责：显示 cat status、invocation ID、时间、token 用量
- 从"当前调用"**移除** `CatTaskProgress` 组件（任务 checklist 部分）
- 任务 checklist 全部交给「猫猫祟祟」板块

## Acceptance Criteria

- **AC-1**: 右侧状态栏出现独立的「猫猫祟祟」section，位于 SessionChainPanel 附近
- **AC-2**: 只显示当前 thread 中有过 invocation 且有 taskProgress 的猫
- **AC-3**: 每猫独立卡片，卡片显示：猫名（带颜色标识）+ 进度条 + 任务数
- **AC-4**: running 的猫排在最上面，completed 的折叠到底部可展开
- **AC-5**: interrupted 的猫显示"继续"按钮，点击可恢复执行
- **AC-6**: 新 invocation 开始时（invocation_created 事件），对应猫的卡片自动重置为新计划
- **AC-7**: 8 只猫同时有计划时面板不溢出（合理的 scroll / 紧凑布局）
- **AC-8**: "当前调用"section 不再显示 task progress checklist（职责迁移）
- **AC-9**: 切换 thread 时面板正确切换到新 thread 的计划数据
- **AC-10**: hydration 恢复时，completed 计划直接出现在折叠区，不污染 running 区

## 需求点 Checklist

| ID | 需求点 | AC 编号 | 验证方式 | 状态 |
|----|--------|---------|----------|------|
| R1 | 新增独立「猫猫祟祟」section | AC-1 | test + screenshot | [ ] |
| R2 | 只显示有 invocation+taskProgress 的猫 | AC-2 | test | [ ] |
| R3 | 每猫独立卡片带颜色+进度 | AC-3 | test + screenshot | [ ] |
| R4 | running 排顶部，completed 折叠底部 | AC-4 | test | [ ] |
| R5 | interrupted 显示"继续"按钮 | AC-5 | test | [ ] |
| R6 | invocation_created 自动重置 | AC-6 | test | [ ] |
| R7 | 8 猫并发不溢出 | AC-7 | manual + screenshot | [ ] |
| R8 | 从"当前调用"移除 task progress | AC-8 | test | [ ] |
| R9 | 切 thread 正确切换 | AC-9 | test | [ ] |
| R10 | hydration completed 不污染 running | AC-10 | test | [ ] |

## Dependencies

- **Evolved from**: F045（计划看板 stale bug 修复，PR #186/#187/#188/#191/#201）
- **Related**: F026（Task progress checklist 原始实现）
- **Related**: SessionChainPanel（UI pattern 参考）

## Risk

| 风险 | 缓解 |
|------|------|
| 从"当前调用"移除 task progress 可能影响用户习惯 | 位置接近，且新板块更清晰 |
| 8 猫同时有计划时右栏太长 | 紧凑布局 + 完成态折叠 + 整个 aside 已有 overflow-y-auto |

## Open Questions

1. ~~面板放在 SessionChainPanel 上面还是下面？~~ → 待铲屎官看到 UI 后决定
2. 是否需要"全部折叠/展开"按钮？→ 先不做，观察使用情况
3. 未来是否需要跨 thread 汇总视图？→ 不在本次范围

## Review Gate

- 跨 family 首选（缅因猫/砚砚）
- 前端 UI：需要截图 + "需求→截图"映射表

## Timeline

- 2026-03-03: kickoff + spec
