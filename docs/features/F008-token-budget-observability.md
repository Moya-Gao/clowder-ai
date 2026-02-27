---
feature_ids: [F008]
topics: [token, budget, observability]
doc_kind: note
created: 2026-02-26
---


# F008: Token 预算 + 深度可观测性

> **Status**: done
> **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- [NDJSON 宝藏调研](./archive/2026-02/research/cli-ndjson-treasure-map.md)

## What
- **F8**: 全部完成：char→token 迁移 (js-tiktoken, 16 files) + 三猫 CLI usage/cost/cache 捕获 + 前端 RightStatusPanel per-cat token 显示 + ParallelStatusBar 聚合 + inputTokens 归一化 (da75aaf) + review fix (e8d1dbd)。commits: 66a59e4→6f25a2b→e8d1dbd

## Links
- [NDJSON 宝藏调研](./archive/2026-02/research/cli-ndjson-treasure-map.md)

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- F025

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
- 关联 commit：`da75aaf`，`e8d1dbd`，`66a59e4`，`6f25a2b`.
