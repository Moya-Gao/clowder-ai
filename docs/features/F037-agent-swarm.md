---
feature_ids: [F037]
related_features: [F049]
topics: [agent, swarm]
doc_kind: note
created: 2026-02-26
---


# F037: Agent Swarm 协同模式

> **Status**: done (archived — spawned F049, core concepts landed) | **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- [2026-02-24 讨论](../discussions/2026-02-24-multi-agent-swarm-meeting-notes.md)

## What
- **F37**: 四猫 + 铲屎官讨论 multi-agent 协同方式借鉴。8 个 feat 拆解（4.5 初版 + 4.6 补充 + 铲屎官反馈）。追溯链：Feat 拆解（入口） → 会议纪要 → 调研报告。核心共识：Swarm 是阶段性工具（Research+Brainstorm），决策权漏斗模式，Mode 系统需从机械模板转向柔性引导。

## Acceptance Criteria
- [ ] AC-A1: 本文档需在本轮迁移后维持模板核心结构（Status/Why/What/Dependencies/Risk/Timeline）。
## Links
- [2026-02-24 讨论](../discussions/2026-02-24-multi-agent-swarm-meeting-notes.md)
- [Feat 拆解（入口）](../discussions/agent-swarm-feats.md)
- [会议纪要](../discussions/2026-02-24-multi-agent-swarm-meeting-notes.md)
- [调研报告（synthesis）](../research/2026-02-24-multi-agent-comparison-synthesis.md)
- [F049: Mission Control — Backlog Center](./F049-mission-control-backlog-center.md)

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- **Related**: F049
- **Spawns**: F049（将 F‑Swarm‑3 产品化为 Mission Control / Backlog Center）

## Risk
| 风险 | 缓解 |
|------|------|
| 历史文档口径与当前实现可能漂移 | 在 F094 批次里持续复跑审计脚本并按批次回填 |
## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
