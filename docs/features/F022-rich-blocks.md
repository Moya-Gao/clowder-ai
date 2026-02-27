---
feature_ids: [F022]
topics: [rich, blocks]
doc_kind: note
created: 2026-02-26
---


# F022: Rich Blocks 富消息系统

> **Status**: done
> **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- [SillyTavern 调研](./archive/2026-02/research/sillytavern-phone-ui-research.md)

## What
- **F22**: bd8ae63 PR #34 — 全栈实现：4 种 block kind (card/diff/checklist/media_gallery) + 双路由 (MCP callback + cc_rich text) + RichBlockBuffer (invocationId 绑定 + dedup + post-completion 拒绝) + Zod discriminatedUnion 入口验证 + isValidRichBlock 全字段类型守卫 + 前端 5 组件 + 50 tests。7 轮 cloud review + 砚砚本地 R1-R7。

## Links
- [Bug Report: `cat_cafe_create_rich_block` MCP 工具缺失注册](../bug-report/mcp-create-rich-block-missing-registration/bug-report.md)
- [SillyTavern 调研](./archive/2026-02/research/sillytavern-phone-ui-research.md)

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- 无显式依赖声明

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
- 关联 commit：`bd8ae63`.
