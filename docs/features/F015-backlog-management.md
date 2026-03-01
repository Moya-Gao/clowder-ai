---
feature_ids: [F015]
topics: [backlog, management]
doc_kind: note
created: 2026-02-26
---


# F015: Backlog 管理

> **Status**: done
> **Owner**: 三猫
> **Created**: 2026-02-26
> **Completed**: 2026-02-27

## Why
- [brainstorm 2026-02-10](../archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md)
- F040：`docs/` 真相源重构 + 聚合体系落地（本 Feature 的机制落盘）

## What
- **F015（机制层）**：确保功能想法不散落在手机备忘录，能在 `docs/` 真相源中被持续管理与追溯。
- 本需求的机制落地由 **F040** 完成（`docs/BACKLOG.md` + `docs/features/` 聚合文件 + skills）。

## Links
- [brainstorm 2026-02-10](../archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md)
- [F040](./F040-backlog-reorganization.md)

## Key Decisions
- “BACKLOG 管理”拆成两层：
  - `docs/` 真相源与追溯链（F040）：已完成
  - 产品内调度与任务池（见 F049）：另立项

## Dependencies
- 无显式依赖声明

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
