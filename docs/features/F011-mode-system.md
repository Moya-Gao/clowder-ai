---
feature_ids: [F011]
related_features: []
topics: [mode, system]
doc_kind: note
created: 2026-02-26
---


# F011: 模式系统

> **Status**: done | **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md)

## What
- **F11**: 开发自闭环 / 头脑风暴 / 辩论三种模式 + 可扩展。6 轮 review 通过，939 tests。攻防录

## Acceptance Criteria
- [x] AC-A1: 本文档已补齐模板核心结构（Status/Why/What/Dependencies/Risk/Timeline）。

## Links
- [Bug Report: `/mode` 快速入口未自动 kickoff，需再次 `@` 才会开始](../bug-report/mode-command-no-auto-kickoff/bug-report.md)
- [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md)
- [攻防录](../tmp/f11-maine-log.md)

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- **Evolved to**: F101（Mode v2 — 游戏系统引擎 + 狼人杀）
- **Related**: F011（保留原始依赖记录见下）

## Risk
| 风险 | 缓解 |
|------|------|
| 历史文档口径与当前实现可能漂移 | 在 F094 批次里持续复跑审计脚本并按批次回填 |

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
