---
feature_ids: [F091]
related_features: [F021, F034, F066, F086]
topics: [signal, study, learning, podcast, voice]
doc_kind: spec
created: 2026-03-10
---

# F091: Signal Study Mode — 信号学习伴侣

> **Status**: kickoff
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
- 双入口触发 Study（Signal 页面 + 对话中贴链接）
- 文章上下文自动注入猫的 system prompt
- 深度学习笔记归档（用户确认后写入）
- 播客生成（精华提取 → 双猫对话稿 → TTS，复用 F066 语音管线）
- 多猫研究集成（复用 F086 多猫编排）
- Study 前端展示（文章详情页折叠区）

## Evolved from

- `F021` — Signal Hunter 基础版（RSS 抓取 + 收件箱，已 done）
- `F066` — Voice Pipeline Upgrade（TTS 流式合成 + 播放队列）
- `F086` — Cat Orchestration（多猫编排 + multi_mention）

## Related

- `F034` — Voice Block 语音消息（TTS provider）
- `F-Swarm-1` — 多猫深度研究群

## Acceptance Criteria

> 🔴 待 Design Gate 确认后细化。以下为 F21++ 设计文档的初始 AC，需重新评估。

- [ ] AC-1: Signal 文章详情页有"开始学习"按钮，点击后跳转 thread 并自动注入文章上下文
- [ ] AC-2: 对话中贴 Signal 文章链接时，猫猫自动识别并获取文章上下文
- [ ] AC-3: 讨论中说"归档"，猫生成深度笔记（含洞见/思考/开放问题），用户确认后写入
- [ ] AC-4: 文章详情页 Study 折叠区展示笔记、播客、研究报告
- [ ] AC-5: 从 study 笔记生成播客（双猫对话稿 + TTS 合成 + 前端可播放）
- [ ] AC-6: Study 模式可触发多猫研究，报告归档到 Study 目录
- [ ] AC-7: 4 个新 MCP 工具可用（start_study / save_notes / list_studies / generate_podcast）
- [ ] AC-8: Signal Hunter 旧 studies 迁移到新结构
- [ ] AC-9: 有 study 的文章在列表有视觉标记

## 需求点 Checklist

| ID | 需求点 | AC 编号 | 验证方式 | 状态 |
|----|--------|---------|----------|------|
| R1 | 双入口触发 Study | AC-1, AC-2 | manual + test | [ ] |
| R2 | 文章上下文自动注入 system prompt | AC-1, AC-2 | test | [ ] |
| R3 | 深度学习笔记归档（用户 gate） | AC-3 | manual + test | [ ] |
| R4 | Study 前端展示（折叠区 + 视觉标记） | AC-4, AC-9 | screenshot | [ ] |
| R5 | 播客生成（精华 → 对话稿 → TTS） | AC-5 | manual + test | [ ] |
| R6 | 多猫研究集成 | AC-6 | manual | [ ] |
| R7 | 4 个新 MCP 工具 | AC-7 | test | [ ] |
| R8 | Study 存储方案 | AC-3, AC-4 | test | [ ] |
| R9 | Signal Hunter 迁移 | AC-8 | manual | [ ] |
| R10 | 记忆接口（cat-cafe-memory 已上线，可直接对接） | — | test | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（Design Gate 后补充）

## Links

- [F21++ 设计文档（2026-02-26 feat 采访）](../plans/2026-02-26-f21-study-mode-design.md)
- [F021 聚合文件](./F021-signal-study-mode.md)
- [Signal 信源缺口审计](../plans/2026-02-20-f21-signal-sources-gap.md)

## Key Decisions

> 待 Design Gate 重新评估。F21++ 设计文档有 11 条决策，需结合当前技术栈（F066 已可用、cat-cafe-memory 已上线）重新确认。

## Dependencies

- F021 (done) — Signal 基础设施
- F034 (done) — TTS provider
- F066 (done) — 语音管线

## Risk

- R5 播客生成涉及长音频合成，TTS 延迟和成本需评估
- R4 前端改动范围可能较大（文章详情页 + 列表页）

## Open Questions

1. R10 记忆接口：cat-cafe-memory 上线后，是直接对接还是保留抽象层？
2. 播客默认长度/风格需要铲屎官确认
3. F21++ 设计文档的 11 条决策是否全部沿用？

## Review Gate

- [ ] Design Gate: UX 确认（铲屎官）
- [ ] 本地猫 review
- [ ] 云端 review

## Timeline

- 2026-03-10: Kickoff，从 F21++ 设计文档演化而来
