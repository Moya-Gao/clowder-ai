---
feature_ids: [F016]
related_features: []
topics: [codex, oauth, memory]
doc_kind: note
created: 2026-02-26
---


# F016: Codex OAuth + 记忆闭环

> **Status**: done | **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md)

## What
- **F16**: Phase F16：Codex 默认走 OAuth（隔离 HOME 下 auth.json/sessions 与真实 ~/.codex 打通），并新增 invocation-token 保护的 search-evidence / reflect / retain-memory callback + MCP 对应工具，形成缅因猫记忆闭环。计划见 2026-02-10-f16-codex-oauth-memory-loop.md。

## Acceptance Criteria
- [x] AC-A1: 本文档已补齐模板核心结构（Status/Why/What/Dependencies/Risk/Timeline）。

## Links
- [Bug Report: Codex CLI Exit Code 1 (False Alarm)](../bug-report/2026-02-12-codex-cli-exit-code-1/bug-report.md)
- [gemini-cli支持动态加载mcp](../research/gemini-cli支持动态加载mcp.md)
- [codex-支持动态加载mcp](../research/codex-支持动态加载mcp.md)
- [Cat Cafe 全员 LSP 化：OpenCode / LSP-as-MCP / Codex CLI skills 调研简报](../research/2026-02-16_LSP_MCP_report.md)
- [brainstorm 2026-02-10](./archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md)
- [`2026-02-10-f16-codex-oauth-memory-loop.md`](./plans/2026-02-10-f16-codex-oauth-memory-loop.md)

## Key Decisions
- Phase F16：Codex 默认走 OAuth（隔离 HOME 下 `auth.json`/`sessions` 与真实 `~/.codex` 打通），并新增 invocation-token 保护的 `search-evidence` / `reflect` / `retain-memory` callback + MCP 对应工具，形成缅因猫记忆闭环

## Dependencies
- **Related**: 无
- F016

## Risk
| 风险 | 缓解 |
|------|------|
| 历史文档口径与当前实现可能漂移 | 在 F094 批次里持续复跑审计脚本并按批次回填 |

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
