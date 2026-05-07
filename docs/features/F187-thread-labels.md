---
feature_ids: [F187]
related_features: [F057, F095]
topics: [thread, navigation, ux, labels]
doc_kind: spec
created: 2026-05-06
---

# F187: Thread Labels — 用户自定义标签 + Sidebar 筛选 + 猫猫辅助分类

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官原话：
> "我发现我们现在置顶都置顶了大几十个！thread！我感觉导致这个问题是我们的收藏夹或者说也没有什么 tag 系统让我没办法分门别类我们的 thread，比如哪些是在拆技术（开源项目），哪些在 thread 开发，哪些是我们一起闲聊共创等等"

F057/F095 解决了"找得到 thread"（搜索、排序、置顶、活跃度），但没有解决"这个 thread 属于哪类事情"。pin 被迫承担分类职责：本来是"我现在要关注"（临时注意力），实际被当成"别丢了"（永久归档）。两个语义叠在一起，置顶只增不减，几十个置顶等于没有置顶。

缺的是 **thread 的用途分类层**。

## What

### Phase A: Label 系统基座 ✅

数据模型：
- `ThreadLabel` 表：`id`, `name`, `color`, `sortOrder`, `createdBy`, `createdAt`
- Thread 增加 `labels: string[]` 字段（label id 数组）
- 预置标签可选，用户可自定义

API：
- Label CRUD：`POST/GET/PATCH/DELETE /api/labels`
- Thread 打标签：`PATCH /api/threads/:id/labels`（覆盖式，传完整 label 数组）

UI：
- Thread 右键菜单 / 详情面板：打标签（多选 checkbox + 颜色圆点）
- Label 管理入口：创建/编辑/删除/排序标签

### Phase B: Sidebar 筛选 + 智能视图 ✅

- Sidebar 顶部加标签筛选器（点击标签 → 只显示该标签 thread，再点取消）
- V1 单选筛选；组合筛选（AND）留后续
- **溢出策略**：筛选条内联显示前 5-6 个最常用标签，超出折叠到 "..." 按钮 → 下拉选择器
- **"未分类"智能视图**：显示所有没有任何标签的 thread，作为持续整理的压力入口
- Thread 条目上显示标签色点（不占太多空间，hover 显示标签名）
- 所有图标使用 SVG（禁止 emoji），与现有 sidebar 图标系统一致

### Phase C: 猫猫辅助分类

- **触发**：sidebar "未分类" pill 旁 ✨ 按钮，用户主动点击触发（不是静默自动分类）
- **展示**：浮层面板（overlay/modal），不写入任何 thread 消息流，不污染聊天记录
- **路由**：按钮点击走现有消息路由（上一只活跃猫 > thread 首选猫 > 全局首选猫），当前 session 猫直接做
- **流程**：按钮点击 → 猫猫调 `list_threads` MCP 获取未分类 thread 标题+元数据 → 分析标题/关联 feature ID → 在面板中展示批量建议卡片 → 用户逐条确认/修改 → 批量调 label API 应用
- **不做**：不引入 FunctionRun 数据模型（Phase C scope 内不需要）；审计需求后续按需加 audit log

## Acceptance Criteria

### Phase A（Label 系统基座）
- [x] AC-A1: 用户可创建自定义标签（名称 + 颜色）
- [x] AC-A2: 用户可在 thread 右键菜单/详情里给 thread 打多个标签
- [x] AC-A3: 标签数据持久化（Redis），重启不丢失
- [x] AC-A4: Label CRUD API 完整且有类型定义

### Phase B（Sidebar 筛选 + 智能视图）
- [x] AC-B1: Sidebar 有标签筛选器，点击标签后只显示该标签的 thread
- [x] AC-B2: "未分类"视图显示所有无标签 thread
- [x] AC-B3: Thread 条目上有标签色点指示

### Phase C（猫猫辅助分类）
- [ ] AC-C1: sidebar "未分类" pill 旁有 ✨ 按钮，点击触发分类流程
- [ ] AC-C2: 猫猫基于 thread 元数据建议标签，用浮层面板展示建议卡片（不写入 thread 消息流）
- [ ] AC-C3: 用户可在面板中逐条确认/修改建议后批量应用标签

## Dependencies

- **Evolved from**: F057（Thread 可发现性 — 排序 + 搜索）、F095（Thread Sidebar 导航体验升级）
- **Related**: F099（Hub Navigation Scalability）

## Risk

| 风险 | 缓解 |
|------|------|
| 标签越贴越多变成新噪音 | V1 限制标签数上限（如 10-15 个）；"未分类"视图提供整理压力 |
| 历史 thread 太多难以一次性整理 | Phase C 猫猫辅助分类降低整理门槛；渐进式不强制 |
| 标签筛选与现有 pin/搜索交互复杂 | 标签筛选独立于 pin（pin 是注意力，标签是分类），搜索结果也显示标签 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 是否提供预置标签（"开发"/"拆解"/"闲聊"）还是全部用户自建？ | open |
| OQ-2 | 标签是否跨项目共享还是 per-project？ | open |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | Label 而非 Folder | thread 天然跨类别，互斥文件夹不够灵活 | 2026-05-06 |
| KD-2 | 不做自动分类，做用户触发的猫猫建议 | 自动分类会变成新噪音；用户触发+确认保证可控 | 2026-05-06 |
| KD-3 | 图标用 SVG，禁止 emoji | 铲屎官 Design Gate 反馈；与现有 sidebar 图标系统一致 | 2026-05-06 |
| KD-4 | 筛选条溢出策略：inline 5-6 个 + "..." 下拉 | 标签数可能 10+，全部内联会挤爆筛选条 | 2026-05-06 |
| KD-5 | 猫猫分类不起无头 CLI，当前 session 猫直接做 | list_threads MCP + 标题分析，成本 = 一次普通对话 | 2026-05-06 |
| KD-6 | Phase C 用浮层面板，不用固定 thread 也不用 function run | 面板零占地不污染聊天（铲屎官确认）；function run 模型太重留独立立项；固定 thread 也是噪音 | 2026-05-07 |
| KD-7 | 按钮触发走现有消息路由（上一只猫 > 首选猫 > 全局首选猫） | 复用已有机制，不需要新调度逻辑（铲屎官确认路由规则） | 2026-05-07 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-06 | 立项（铲屎官 + 布偶猫 + 缅因猫三方收敛） |
| 2026-05-06 | Phase A merged (PR #1576) |
| 2026-05-07 | Phase B merged (PR #1577) |

## Review Gate

- Phase A: 缅因猫 review 数据模型 + API
- Phase B: 前端 UI → 铲屎官确认后实现
- Phase C: interactive rich block 交互设计 → 铲屎官确认

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F057-thread-discoverability.md` | 搜索+排序基座 |
| **Feature** | `docs/features/F095-sidebar-collapse-memory.md` | Sidebar 导航基座 |

## 需求点 Checklist

| ID | 来源 | 需求 | AC 映射 | Phase |
|----|------|------|---------|-------|
| R1 | 铲屎官 | thread 可按用途分类 | AC-A1, AC-A2 | A |
| R2 | 铲屎官 | sidebar 可按分类筛选 | AC-B1, AC-B2, AC-B3 | B |
| R3 | 铲屎官 | 猫猫帮忙一键分类 | AC-C1, AC-C2, AC-C3 | C |
| R4 | 布偶猫+缅因猫 | 用 Label 不用 Folder | KD-1 | — |
