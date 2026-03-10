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
- **Thread-Study 关联**：开始学习时可选择新开 thread / 关联已有 thread / 挂载已有 thread——聊天和 Study 相辅相成
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

- [ ] AC-1: Signal 文章详情页有"开始学习"按钮，可选择新开 thread / 关联已有 thread / 挂载已有 thread，并自动注入文章上下文
- [ ] AC-2: 对话中贴 Signal 文章链接时，猫猫自动识别并获取文章上下文
- [ ] AC-11: Study 折叠区展示关联的 thread 列表，点击可跳转到对应 thread 继续讨论
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
| R1 | "和猫猫们聊的多，聊天才能碰撞灵感"——对话入口优先，贴链接猫识别 | AC-1, AC-2, AC-11 | manual + test | [ ] |
| R11 | "可以让我选择新开 thread 或者关联哪个 thread？甚至挂载进来！聊天和 Study 相辅相成" | AC-1, AC-11 | manual + test | [ ] |
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
- [UX Wireframe](../../designs/mission-hub-f091-signal-study-mode.pen) — 三屏 wireframe（Pencil，在 Mission Hub 画布上）

## 铲屎官原话（2026-03-10 Design Gate）

> "和猫猫们聊的多。只有聊天才能碰撞灵感。我们现在都是你们读原文然后和我讲，我只看关键原文然后我们一人三猫甚至更多猫开始讨论。"
>
> "两种都要——精华 2-3 分钟和深度 10 分钟是面对不同的场景的。声线可以选择默认参加的猫猫，甚至可以三只猫猫。"
>
> "记忆是 thread session 搜来的，可以用！但是我还是不建议走奇怪的 RAG 等，我实践了一年了没有好用的效果。"
>
> **"你记得我们的铁律：我们是面向终态，不绕路，我不建议做绕路的特性。"**
>
> **"代码是最廉价的。我们的设计、我们的思想碰撞才是灵魂。"**
>
> "讨论的话可以让我选择新开 thread 或者关联哪个 thread？甚至把什么 thread 给挂载进来！聊天和这个是相辅相成的。"

## Key Decisions

| # | 决策 | 选了什么 | Why |
|---|------|---------|-----|
| 1 | 主入口 | 对话中贴链接（铲屎官日常场景） | "聊天才能碰撞灵感" |
| 2 | 播客模式 | 两种：精华 2-3min + 深度 10min | 不同场景不同需求 |
| 3 | 播客声线 | 跟随参与猫猫，可 2-3 只 | 自然 |
| 4 | 记忆 | cat-cafe-memory session search | "实践了一年了没有好用的 RAG" |
| 5 | 笔记归档 | 用户确认后写入 | 生成质量需人把关 |
| 6 | 存储 | 文章同目录子文件夹 | 物理聚合，ls 可见 |
| 7 | 多猫研究 | 复用 F086 + deep-research | 不造轮子 |
| 8 | Phase 策略 | **面向终态不分阶段** | **P1 面向终态不绕路**（铁律） |
| 9 | 设计先行 | 先画 UX，再写代码 | "代码是最廉价的，设计才是灵魂" |
| 10 | Thread-Study 关联 | 新开/关联/挂载 thread，聊天和 Study 相辅相成 | Study 不是孤立学习，是围绕文章的对话聚合 |
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

- 2026-03-10: Kickoff + Design Gate 通过，面向终态不分阶段
- 2026-03-10: UX wireframe 完成（3 屏：文章详情+Study折叠区、对话链接注入流程、播客播放器）

## UX Wireframe 设计说明

### Screen A: 文章详情 + Study 折叠区
- 两列布局：左列文章列表（320px），右列详情（fill）
- 列表项有 study 的显示绿色 badge（"2 studies"），无 study 的显示状态 badge（"inbox"）
- 详情区：Tier badge + 状态 → 标题 → 来源/时间 → 三个 action 按钮 → AI 摘要 → **Study Mode 折叠区**
- Study 折叠区（淡灰底 + 边框）：笔记卡片（参与猫 badge + 洞见预览）+ 播客卡片（播放器 + 声线标识）
- "开始学习"按钮紫色突出，"在对话中讨论"灰色次级

### Screen B: 对话中贴链接 → 上下文注入
- 铲屎官在 thread 中贴 signal:// 链接
- 系统蓝色提示条："已识别 Signal 文章，自动注入文章上下文到猫猫 system prompt"
- 猫猫回复直接体现对文章内容的理解（不是泛泛而谈）
- 这是**主入口**——铲屎官日常场景是聊天碰撞灵感

### Screen C: 播客播放器（双模式）
- 精华版/深度版 pill 切换
- 播放控制：上一个 / 播放 / 下一个 + 进度条 + 时间
- "正在说话"指示器：高亮当前说话的猫，灰色显示其他猫（可 2-3 只）
- 对话稿预览：每猫用自己的颜色标注
