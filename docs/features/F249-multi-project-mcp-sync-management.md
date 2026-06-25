---
feature_ids: [F249]
related_features: [F041, F043, F145, F178, F213, F228, F240]
topics: [mcp, capability-dashboard, multi-project, sync, drift-detection, single-source]
doc_kind: spec
created: 2026-06-25
---

# F249: Multi-Project MCP Sync Management — 多项目 MCP 配置同步管理

> **Status**: design | **Owner**: community @mindfn + cat-cafe maintainers | **Priority**: P2 | **Created**: 2026-06-25

## Provenance

- **Community PR**: [clowder-ai#713](https://github.com/zts212653/clowder-ai/pull/713) — `fix(#712): unify MCP config to capabilities.json single source of truth`
- **Bug issue**: [clowder-ai#712](https://github.com/zts212653/clowder-ai/issues/712) — MCP 配置多源不一致
- **Author**: `@mindfn`（lang，`authorAssociation=COLLABORATOR`，同 F240 IM connectors / F228 / F161 / F237 贡献者）

## 编号纠错背景

PR #713 原使用 F240，但家里 F240 已分配给 IM Connector Plugin Architecture（PR #903，已 absorbed）。CVO 2026-06-25 signoff 分配 F249。

## Why

Skill 侧（F228）已实现完整的多项目管理体系。MCP 配置目前还停留在扁平模型，缺失项目级管理、按成员控制、漂移检测、级联同步。

前置依赖：`clowder-ai#712` 单源改造（capabilities.json 作为 MCP 唯一真相源 + invoke-time provider 注入）。

## Scope（PR #713 中 F249 相关部分）

| 维度 | 内容 |
|------|------|
| 数据模型 | `blockedCats` 黑名单模型、`mcpServerOverride` 项目覆盖、`McpSyncState` |
| 同步引擎 | `syncMcpProject` / `syncMcpAll` 级联 |
| 漂移检测 | 3-case drift detection（global-new / project-orphan / config-mismatch） |
| API | `GET /api/mcp/:id/tools`、`POST /api/mcp/drift-check`、`POST /api/mcp/drift-resolve`、`POST /api/mcp/sync-all` |
| 前端 | DriftBanner、McpConfigModal、per-cat toggle |
| 迁移 | `enabled` → `globalEnabled` 对齐 F228 |

## 待 Maintainer 评估

- PR #713 当前混合了 #712 bug fix + F249 feature，需评估是否拆分
- blockedCats 模型 vs 现有 overrides 模型的取舍
- 新 API 路由是否符合家里的 API 设计模式
- intake 策略待定（absorbed / manual-port / public-only）

## 详细设计

见 PR #713 body 中 F240（应为 F249）设计章节，含数据模型、场景流程、API 接口详解。
