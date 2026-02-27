---
feature_ids: [F023]
topics: [directory, corrosion, defense]
doc_kind: note
created: 2026-02-26
---


# F023: 目录结构防腐化 + 重构 + 代码检查工具链

> **Status**: done
> **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- 铲屎官 2026-02-13

## What
- **F23**: PR #21 (d366ad5) — 5 WT 全部合入 main。87 files → 7 子目录 + ~690 imports 迁移 + 5 大文件拆分。防腐化门禁 pnpm check:dir-size + pnpm check:deps。Biome v2.4 + LSP + JetBrains MCP 全部启用。routes 目录有 .dir-exceptions.json 例外到 2026-04-01。ADR: 010-directory-hygiene-anti-rot.md

## Links
- [`010-directory-hygiene-anti-rot.md`](./decisions/010-directory-hygiene-anti-rot.md)

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- 无显式依赖声明

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
- 关联 commit：`d366ad5`.
