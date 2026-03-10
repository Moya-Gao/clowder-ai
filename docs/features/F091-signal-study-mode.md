---
feature_ids: [F091]
related_features: [F021, F034, F066, F086]
topics: [signal, study, learning, podcast, voice]
doc_kind: spec
created: 2026-03-10
---

# F091: Signal Study Mode — 信号学习伴侣

> **Status**: spec
> **Owner**: 布偶猫
> **Created**: 2026-03-10

## Why

F021 Signal Hunter 完成了 RSS 抓取 + 打分 + 收件箱的基础版。但铲屎官最初的愿景是一个**学习伴侣系统**——发现文章后能和猫猫讨论、归档学习笔记、转成播客巩固记忆。

现状断裂点：
1. "在对话中讨论文章"是假的——猫猫不知道你在讨论哪篇，零上下文
2. 没有 Study 概念——只有文章，没有笔记/报告/播客
3. 讨论精华沉没在聊天记录里，没有归档
4. Signal Hunter 的 studies 被困在旧系统里

## What

把 Signal 从 RSS 阅读器升级为学习伴侣：
- **对话优先**的双入口触发 Study（对话中贴链接为主入口，Signal 页面"开始学习"为辅）
- 文章上下文自动注入猫的 system prompt
- 深度学习笔记归档（用户确认后写入）
- 播客生成（两种模式：2-3 分钟精华 + 10 分钟深度讨论，声线跟随参与猫猫）
- 多猫研究集成（复用 F086 多猫编排）
- Study 前端展示（文章详情页折叠区）
- 记忆对接（用 cat-cafe-memory session search，不走 RAG）

## Evolved from

- `F021` — Signal Hunter 基础版（RSS 抓取 + 收件箱，已 done）
- `F066` — Voice Pipeline Upgrade（TTS 流式合成 + 播放队列）
- `F086` — Cat Orchestration（多猫编排 + multi_mention）

## Related

- `F034` — Voice Block 语音消息（TTS provider）
- `F-Swarm-1` — 多猫深度研究群

## Acceptance Criteria

- [ ] AC-1: Signal 文章详情页有"开始学习"按钮，点击后跳转 thread 并自动注入文章上下文
- [ ] AC-2: 对话中贴 Signal 文章链接时，猫猫自动识别并获取文章上下文
- [ ] AC-3: 讨论中说"归档"，猫生成深度笔记（含洞见/思考/开放问题），用户确认后写入
- [ ] AC-4: 文章详情页 Study 折叠区展示笔记、播客、研究报告
- [ ] AC-5: 播客有两种模式——精华版（2-3 分钟）和深度版（10 分钟），声线跟随参与猫猫（可 2-3 只），前端可播放
- [ ] AC-6: Study 模式可触发多猫研究，报告归档到 Study 目录
- [ ] AC-7: 4 个新 MCP 工具可用（start_study / save_notes / list_studies / generate_podcast）
- [ ] AC-8: Signal Hunter 旧 studies 迁移到新结构
- [ ] AC-9: 有 study 的文章在列表有视觉标记
- [ ] AC-10: 记忆对接用 cat-cafe-memory session search（不走 RAG），猫猫讨论前能搜到相关历史

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "和猫猫们聊的多，聊天才能碰撞灵感"——对话入口优先，贴链接猫识别 | AC-1, AC-2 | manual + test | [ ] |
| R2 | 文章上下文自动注入 system prompt，猫读原文然后和铲屎官讲 | AC-2 | test | [ ] |
| R3 | 深度学习笔记归档（用户确认后写入） | AC-3 | manual + test | [ ] |
| R4 | Study 前端展示（折叠区 + 视觉标记） | AC-4, AC-9 | screenshot | [ ] |
| R5 | "两种都要"——精华 2-3 分钟 + 深度 10 分钟，声线跟随参与猫，可三只 | AC-5 | manual + test | [ ] |
| R6 | 多猫研究集成（复用 F086） | AC-6 | manual | [ ] |
| R7 | 4 个新 MCP 工具 | AC-7 | test | [ ] |
| R8 | Study 存储方案（文章同目录） | AC-3, AC-4 | test | [ ] |
| R9 | Signal Hunter 迁移 | AC-8 | manual | [ ] |
| R10 | "记忆是 thread session 搜来的"——用 cat-cafe-memory，不走 RAG | AC-10 | test | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（开发后补充截图）

## Links

- [F21++ 设计文档（2026-02-26 feat 采访）](../plans/2026-02-26-f21-study-mode-design.md)
- [F021 聚合文件](./F021-signal-study-mode.md)
- [Signal 信源缺口审计](../plans/2026-02-20-f21-signal-sources-gap.md)

## Key Decisions

| # | 决策 | 选了什么 | Why |
|---|------|---------|-----|
| 1 | 主入口 | 对话中贴链接（铲屎官日常场景） | "和猫猫们聊的多，聊天才能碰撞灵感" |
| 2 | 播客模式 | 两种：精华 2-3min + 深度 10min | 面对不同场景 |
| 3 | 播客声线 | 跟随参与猫猫，可 2-3 只 | 自然 |
| 4 | 记忆 | cat-cafe-memory session search | "实践了一年了没有好用的 RAG" |
| 5 | 笔记归档 | 用户确认后写入 | 生成质量需人把关 |
| 6 | 存储 | 文章同目录子文件夹 | 物理聚合，ls 可见 |
| 7 | 多猫研究 | 复用 F086 + deep-research | 不造轮子 |
| 8 | Phase 策略 | 面向终态不分阶段 | P1 面向终态不绕路 |
| 沿用 | F21++ 设计文档其余决策 | 见 2026-02-26 文档 | — |

## Dependencies

- F021 (done) — Signal 基础设施
- F034 (done) — TTS provider
- F066 (done) — 语音管线

## Risk

- R5 播客 10 分钟深度版 TTS 合成耗时/成本需评估
- R4 前端改动范围较大（文章详情页 + 列表页）

## Open Questions

> Design Gate 已关闭，核心问题已确认。

## Review Gate

- [x] Design Gate: UX 确认（铲屎官 2026-03-10）
- [ ] 本地猫 review
- [ ] 云端 review

## Timeline

- 2026-03-10: Kickoff + Design Gate 通过，面向终态实施
