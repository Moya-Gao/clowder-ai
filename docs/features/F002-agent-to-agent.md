---
feature_ids: [F002]
topics: [agent]
doc_kind: note
created: 2026-02-26
---


# F002: Agent-to-Agent 调用 (A2A)

> **Status**: done
> **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- 铲屎官洞察 🐬

## What
- **F2**: Phase 3.9 7a519b9 — worklist 链式调用 + parseA2AMentions + a2a_handoff 前端显示

## Links
- [Bug Report: `@gpt5.2` 无法命中 `gpt52` 变体](../bug-report/gpt52-mention-alias-missing/bug-report.md)
- [Bug Report: --append-system-prompt 不生效，猫猫新 session 缺失身份/队友/MCP](../bug-report/append-system-prompt-not-working/bug-report.md)
- [Bug Report: System Prompt / 协作说明重复注入导致 token 膨胀（越聊越胖 + 每轮都很重）](../bug-report/2026-02-23-system-prompt-context-bloat/bug-report.md)
- [Bug Report: A2A 系统提示词在多 variant 下 @队友歧义](../bug-report/2026-02-23-a2a-prompt-variant-disambiguation/bug-report.md)
- [oh-my-opencode 多智能体协作系统技术评估（截至 2026-02-13）](../research/oh-my-opencode-research.md)
- [Agent 技术力建设研究报告](../research/2026-02-25-agent-tech-capability-building.md)
- [source-2026-02-26-wechat-article.snapshot](../research/2026-02-24-multi-agent-comparison/source-2026-02-26-wechat-article.snapshot.md)
- [Multi-Agent 架构对比：Cat Cafe vs 业界方案](../research/2026-02-24-multi-agent-comparison/opus-websearch-synthesis.md)
- [Multi-Agent 架构对比调研（三份 Deep Research）交叉审阅审计报告](../research/2026-02-24-multi-agent-comparison/gpt-pro-review.md)
- [**Multi-Agent 架构对比调研：Cat Cafe vs 业界领先方案**](../research/2026-02-24-multi-agent-comparison/gemini-deep-research.md)
- [Multi-Agent 架构对比调研报告](../research/2026-02-24-multi-agent-comparison/claude-ai-deep-research.md)
- [Multi-Agent 架构对比调研：Cat Cafe vs 业界方案](../research/2026-02-24-multi-agent-comparison/chatgpt-deep-research.md)
- [Agent Swarm 协同方式对比报告](../research/2026-02-24-multi-agent-comparison/agent-swarm-comparison.md)
- [Multi-Agent 架构对比调研 (2026-02-24)](../research/2026-02-24-multi-agent-comparison/README.md)
- [对话李笛：异构多智能体 - 研究摘录与对照笔记](../research/2026-02-24-multi-agent-comparison/2026-02-26-li-di-interview-notes.md)
- [Multi-Agent 架构对比：Cat Cafe vs 业界方案](../research/2026-02-24-multi-agent-comparison-synthesis.md)
- 历史来源：旧 BACKLOG 归档条目（be27a44^:docs/BACKLOG.md）

## Key Decisions
- Phase 3.9 `7a519b9` — worklist 链式调用 + parseA2AMentions + a2a_handoff 前端显示

## Dependencies
- 无显式依赖声明

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
- 关联 commit：`7a519b9`.
