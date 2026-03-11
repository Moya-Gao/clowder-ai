---
feature_ids: [F017]
related_features: [F019]
topics: [export, dialog, image]
doc_kind: note
created: 2026-02-26
---


# F017: 导出对话长图

> **Status**: done | **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- [ux-polish 2026-02-10](./archive/2026-02/discussions/2026-02-10-ux-polish-brainstorm/README.md)

## What
- **F17**: Chrome headless 导出。缅因猫 3 轮 review 通过（R1 路径 + R2 安全/构建/性能 + R3 system thread）。设计: 2026-02-10-f19-f18-f17-ux-polish.md

## Acceptance Criteria
- [x] AC-A1: 本文档已补齐模板核心结构（Status/Why/What/Dependencies/Risk/Timeline）。

## Links
- [logo-动画](../research/logo-动画.md)
- [ux-polish 2026-02-10](./archive/2026-02/discussions/2026-02-10-ux-polish-brainstorm/README.md)
- [`2026-02-10-f19-f18-f17-ux-polish.md`](./plans/2026-02-10-f19-f18-f17-ux-polish.md)

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- **Related**: F019
- F019
- F018
- F017

## Risk
| 风险 | 缓解 |
|------|------|
| 历史文档口径与当前实现可能漂移 | 在 F094 批次里持续复跑审计脚本并按批次回填 |

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
