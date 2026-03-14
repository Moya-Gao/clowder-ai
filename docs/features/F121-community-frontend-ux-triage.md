---
feature_ids: [F121]
related_features: [F095, F110]
topics: [community, frontend, ux, triage]
doc_kind: spec
created: 2026-03-14
---

# F121: Community Frontend UX Triage — 社区前端交互体验侦查与分诊

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P2

## Why

社区 `clowder-ai` 积累了一批未 triaged 的前端 UX issue（6 个三猫共识），铲屎官要求以 maintainer 视角逐个侦查：定位是否真的有问题、是否值得做、技术可行性，再决定 accept/reject/duplicate。

铲屎官原话：
> "不是所有的需求或者所有觉得是 enhance 的都需要 enhance，也不是所有他们认为的 bug 也是 bug，你们得定位清楚是不是有这个问题"

## What

### Phase A: 侦查（每猫侦查 1-2 个 issue）

每个 issue 的侦查产出「猫爪印报告」：

1. **复现/定位**：在代码中确认问题是否存在
2. **根因分析**：为什么会这样（设计如此 / 确实是 bug / 技术限制）
3. **判定**：accept-bug / accept-enhancement / duplicate / wontfix / needs-discussion
4. **关联**：是否应挂到现有 Feature
5. **修复评估**：如果 accept，难度和影响范围

### Phase B: 分诊决策

汇总侦查结果 → 铲屎官拍板 → 社区回复 + 打标签

## Issue Checklist

| # | Issue | 类型 | 侦查猫 | 判定 | 猫爪印 |
|---|-------|------|--------|------|--------|
| #28 | 聊天面板宽度不支持拖动 | enhancement | 布偶猫 | ⬜ | |
| #89 | collapse-all 后 sidebar 展开跳错分组 | bug | 金渐层 | ⬜ | |
| #27 | 切换会话时滚动位置重置 | bug | 缅因猫(gpt52) | ⬜ | |
| #22 | @mention 下拉框溢出+行高不一致 | bug | 布偶猫 | ⬜ | |
| #88 | UX Debt 内部术语暴露给用户 | enhancement | 金渐层 | ⬜ | |
| #16 | Bootcamp 阶段过渡 UX | enhancement | 缅因猫(gpt52) | ⬜ | |

## Dependencies

- **Related**: F095（Thread Sidebar 导航升级 — #89 可能是其遗漏）
- **Related**: F110（训练营愿景引导 — #16 可能重叠）

## Risk

| 风险 | 缓解 |
|------|------|
| 侦查发现问题不存在，社区期望落差 | 用详细技术分析回复，解释清楚 |
| 某些 issue 实际是现有 Feature 的子任务 | 关联检测已标注，侦查时进一步确认 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-14 | 立项，三猫分工侦查 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **社区仓** | `zts212653/clowder-ai` | issues #28/#89/#27/#22/#88/#16 |
