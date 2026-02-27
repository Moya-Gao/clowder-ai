---
feature_ids: [F038]
topics: [skills, discovery]
doc_kind: note
created: 2026-02-26
---


# F038: Skills 梳理 + 按需发现机制

> **Status**: in-progress
> **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- [skills 调研 2026-02-25](./discussions/2026-02-25-f38-skills-discovery/README.md)

## What
- **F38**: 当前：方向 A（分类标记），skill bug 已修（项目级 .claude/skills/ symlinks 5257e1c）。未来：方向 B（类 ToolSearch 延迟加载，BM25/regex，触发条件 skills 50+）。ToolSearch 不用向量数据库，用 BM25 词频排序。铲屎官决策：simple is better, build when you need。

## Links
- [skills 调研 2026-02-25](./discussions/2026-02-25-f38-skills-discovery/README.md)

## Key Decisions
- simple is better, build when you need

## Dependencies
- F038

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
- 关联 commit：`5257e1c`.
