---
feature_ids: [F170]
related_features: [F093]
topics: [game, frontend, demo]
doc_kind: spec
created: 2026-04-20
---

# F170: Web Chinese Chess — 网页端中国象棋

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P2

## Why

铲屎官要求做一个端到端可运行的网页象棋游戏，用于**演示 feat lifecycle 全流程**（立项 → 设计 → 开发 → review → 合入 → 愿景守护）。同时验证 Cat Café 多猫协作在独立前端项目上的执行效率。

> 铲屎官原话："我们来进行一个演示 演示虚拟的 feat lifecycle 要你们写一个网页端的端到端可以跑的象棋游戏"

## What

### Phase A: 核心棋盘与规则引擎

- 经典 9×10 棋盘渲染（HTML Canvas 或 DOM）
- 全部 7 种棋子（将/帅、士、象/相、马、车、炮、兵/卒）正确绘制
- 完整走子规则校验（含蹩马腿、塞象眼、将帅对面、九宫限制）
- 落子高亮、可走位置提示

### Phase B: 对局逻辑与交互

- 红先黑后轮流走子
- 将军检测 + 将杀（胜负）判定
- 悔棋功能
- 新开一局 / 重置

### Phase C: 体验打磨（可选）

- 棋谱记录与回放
- 简单 AI 对手（随机合法走子 or minimax）
- 移动端响应式布局

## Acceptance Criteria

### Phase A（核心棋盘与规则引擎）
- [ ] AC-A1: 浏览器打开页面可见标准 9×10 中国象棋棋盘，红黑双方各 16 子正确摆放
- [ ] AC-A2: 点击己方棋子高亮选中，显示所有合法落点
- [ ] AC-A3: 走子规则完整覆盖 7 种棋子（含蹩马腿、塞象眼、九宫、将帅对面）
- [ ] AC-A4: 不能走到被将军的位置（送将检测）

### Phase B（对局逻辑与交互）
- [ ] AC-B1: 红先黑后严格交替，非己方回合点击无响应
- [ ] AC-B2: 将军时有视觉提示，将杀时显示胜负结果
- [ ] AC-B3: 悔棋可撤回上一步
- [ ] AC-B4: "新对局"按钮重置棋盘

## Dependencies

- **Related**: F093（Cats & U 世界引擎 — 象棋作为潜在 Scene Card 候选）

## Risk

| 风险 | 缓解 |
|------|------|
| 走子规则实现遗漏（炮的翻山、将帅对面等边界） | Phase A 对每种棋子写单元测试覆盖边界 |
| 演示性质可能 scope creep 到 AI 对手 | Phase C 标注"可选"，演示只需 A+B |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 技术栈：纯 HTML/CSS/JS 单文件 or React 组件？ | ⬜ 待 Design Gate 确认 |
| OQ-2 | 部署位置：独立页面 or 嵌入 Cat Café 前端？ | ⬜ 待确认 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 演示用途，Phase C 为可选 | 核心目标是走通 lifecycle，不是做完美产品 | 2026-04-20 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-20 | 立项（feat lifecycle 演示） |

## Review Gate

- Phase A: 跨猫 review（规则引擎正确性）
- Phase B: 跨猫 review + 铲屎官试玩验收

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F093-cats-and-u-world-engine.md` | 象棋作为 Scene Card 候选 |
