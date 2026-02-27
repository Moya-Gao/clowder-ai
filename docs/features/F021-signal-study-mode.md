---
feature_ids: [F021]
topics: [signal, study, mode]
doc_kind: note
created: 2026-02-26
---


# F021: Signal Hunter 集成

> **Status**: in-progress
> **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- [讨论 2026-02-12](./archive/2026-02/discussions/2026-02-12-signal-hunter-upgrade/README.md)
- [feat 采访 2026-02-26](./plans/2026-02-26-f21-study-mode-design.md)

## What
- **F21**: 每日自动抓取 AI 技术信源 + 邮件日报 + 和猫猫深度学习。合并 Signal Hunter 到 Cat Café，launchd 定时 + 50+ 信源 + on/off 开关 + Hindsight 洞察存储。计划: 2026-02-12-signal-hunter-integration.md，缅因猫调研: signal-hunter.md。S1~S6 全部完成，缅因猫多轮 review 放行。信源补全 3→45 源 + 手动 Fetch 端点 + GitHub PAT 自动注入。已全部合入 main。
- **F21++**: F21 从 RSS 阅读器升级为学习伴侣：双入口触发 Study + 文章上下文自动注入 + 深度笔记归档 + 播客生成（复用 F34 TTS）+ 多猫研究（复用 F-Swarm-1）+ Signal Hunter 迁移。10 个需求 (R1-R10)，11 轮 feat 采访确认。设计: 2026-02-26-f21-study-mode-design.md

## Links
- [讨论 2026-02-12](./archive/2026-02/discussions/2026-02-12-signal-hunter-upgrade/README.md)
- [`2026-02-12-signal-hunter-integration.md`](./plans/2026-02-12-signal-hunter-integration.md)
- [`signal-hunter.md`](./archive/2026-02/research/signal-hunter.md)
- [feat 采访 2026-02-26](./plans/2026-02-26-f21-study-mode-design.md)
- [`2026-02-26-f21-study-mode-design.md`](./plans/2026-02-26-f21-study-mode-design.md)

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- F021
- F034

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
