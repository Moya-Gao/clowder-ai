---
feature_ids: [F106]
related_features: [F087, F096]
topics: [onboarding, bootcamp, ux]
doc_kind: spec
created: 2026-03-12
---

# F106: 多训练营支持 + 训练营列表页

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P2
> **Evolved from**: F087（CVO Bootcamp — 当前只支持单训练营）

## Why

铲屎官体验训练营后发现候选任务很多都很好玩，想同时开多个训练营。当前限制：前端 CTA 用 `find(t => t.bootcampState)` 找到第一个就只显示"继续"，不让开新的。后端无限制。

### 铲屎官原话（2026-03-12）

> "我们能开多个训练营吗？好像很多都很好玩。我们的训练营好像现在只开一个？"
> "我希望训练营列表页，展示每个训练营的 phase 进度，然后点击训练营应该不是新建新的而是选择新的还是去哪个老的。"

## What

### 核心改动

1. **训练营列表页（新 UI）**：点击训练营入口 → 不是直接创建新 thread，而是进入一个列表页/面板
   - 展示用户所有训练营 thread：标题、当前 Phase 进度、选择的任务、创建时间
   - 每个训练营可点击跳转到对应 thread
   - 底部"开始新训练营"按钮

2. **前端 CTA 逻辑调整**：
   - 有训练营 → "我的训练营" → 打开列表
   - 无训练营 → "开始猫猫训练营" → 创建新 thread

3. **Phase 进度可视化**：列表中每个训练营显示当前 phase（如 Phase 5/11）

### 不需要改的

- 后端：`POST /api/threads` + `bootcampState` 已支持多个
- 状态机：per-thread，天然支持
- `GET /api/bootcamp/thread`：改为返回数组（或新增 `/api/bootcamp/threads`）

## Acceptance Criteria

- [ ] AC-A1: 用户可以创建多个训练营 thread（前端不再阻止）
- [ ] AC-A2: 训练营列表页展示所有训练营的 phase 进度
- [ ] AC-A3: 点击列表中的训练营跳转到对应 thread
- [ ] AC-A4: 列表底部有"开始新训练营"入口
- [ ] AC-A5: 空消息态 CTA 适配：有训练营→"我的训练营(N)"打开列表 modal，无训练营→"开始猫猫训练营"打开列表 modal（显示空态+创建按钮）

## Dependencies

- **Evolved from**: F087（CVO Bootcamp — 单训练营基座）
- **Related**: F096（Interactive Rich Blocks）

## Risk

| 风险 | 缓解 |
|------|------|
| 训练营太多导致列表拥挤 | 按时间排序，完成的训练营灰显/折叠 |
| 多个进行中训练营让新手困惑 | 高亮最近活跃的那个 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 列表页是独立页面 `/bootcamp` 还是 modal/drawer？ | ⬜ 未定 — Design Gate 确认 |
| OQ-2 | API 是改 `GET /api/bootcamp/thread` 返回数组还是新增端点？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 点击入口进列表页而非直接创建新训练营 | 铲屎官明确要求"选择新的还是去哪个老的" | 2026-03-12 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-12 | 铲屎官提出多训练营需求，从 F087 演化立项 |

## Review Gate

- TBD

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F087-cvo-bootcamp.md` | 单训练营基座 |
