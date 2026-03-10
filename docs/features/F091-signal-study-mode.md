---
feature_ids: [F091]
related_features: [F021, F034, F066, F086]
topics: [signal, study, learning, podcast, voice]
doc_kind: spec
created: 2026-03-10
---

# F091: Signal Study Mode — 信号学习伴侣

> **Status**: done
> **Owner**: 布偶猫
> **Created**: 2026-03-10
> **Completed**: 2026-03-10

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

- [x] AC-1: Signal 文章详情页有"开始学习"按钮，默认跳转 thread 并自动注入文章上下文；手动关联 thread 支持手输 ID *(scope reduced: 完整 picker deferred，当前行为满足铲屎官核心场景)*
- [x] AC-2: 对话中贴 Signal 文章链接时，猫猫自动识别并获取文章上下文 *(thread-article 关联后 activeSignals 自动注入 contentSnippet+note)*
- [x] AC-11: Study 折叠区展示关联的 thread 列表，点击可跳转到对应 thread 继续讨论
- [x] AC-3: 讨论中说"归档"，猫生成深度笔记（含洞见/思考/开放问题），用户确认后写入 *(MCP signal_save_notes)*
- [x] AC-4: 文章详情页 Study 折叠区展示笔记、播客、研究报告
- [x] AC-5: 播客有两种模式——精华版（2-3 分钟）和深度版（10 分钟），声线跟随参与猫猫（可 2-3 只），前端可播放 *(PodcastPlayer + segment viewer + generate API)*
- [x] AC-6: Study 模式可触发多猫研究，报告归档到 Study 目录 *(多猫研究按钮 + research=multi 上下文注入)*
- [x] AC-7: 7 个新 MCP 工具可用（start_study / save_notes / list_studies / generate_podcast / signal_update_article / signal_delete_article / signal_link_thread）
- [x] AC-8: Signal Hunter 旧 studies 迁移到新结构 *(migration.ts)*
- [x] AC-9: 有 study 的文章在列表有视觉标记 *(studyCount badge + ✎ note icon)*
- [x] AC-10: 记忆对接用 cat-cafe-memory session search（不走 RAG），猫猫讨论前能搜到相关历史 *(ActiveSignalArticle enrichment with relatedDiscussions)*
- [x] AC-12: "打开原文"保留外链跳转（铲屎官确认：需要给人展示来源时跳浏览器是正确行为），详情页已内嵌 markdown 渲染供日常阅读
- [~] AC-13: Signal Inbox 列表视图 UX 设计语言归一化 *(deferred: 待独立 UX pass)*
- [x] AC-14: 可删除文章（单篇 + 批量选择删除），软删除（`deletedAt` 时间戳），列表过滤隐藏
- [x] AC-15: 可给文章添加备注（自由文本，不是标签——铲屎官的个人笔记/提醒）
- [x] AC-16: 批量操作（多选 → 删除/标已读/归档/加标签），范围=当前页可见项
- [~] AC-17: 按来源过滤 *(deferred: 50+ 源过滤交互设计待定)*
- [x] AC-18: 文章关联——把相关文章绑成"学习集"（如"多 Agent 系列"），Study 折叠区展示同集文章 *(collection CRUD + StudyFoldArea UI + atomic sync)*
- [x] AC-19: 学习时间线——"上周学了什么"回顾视图，按时间线展示 study 成果 *(StudyTimeline component + SignalInboxView integration)*
- [x] AC-20: 删除语义——软删除（`deletedAt`），有 study/播客/thread 关联的文章不硬删，避免幽灵引用
- [x] AC-21: 备注与笔记边界——备注进搜索、不注入讨论上下文、列表显示图标 hover 预览
- [x] AC-22: Thread 关联 edge cases——已有关联默认"继续最近 thread"；重复贴同篇去重提示；并列挂载 vs 切换主文章；thread 删除后 link 标 stale 不级联删
- [x] AC-23: 讨论前 evidence pack——文章全文 + note + 最近 linked threads (max 3) + 最近 study note，"先搜后聊" *(通过 enriched ActiveSignalArticle 注入)*
- [x] AC-24: Artifact job state——播客/研究生成有 `queued/running/ready/failed` 状态，防止重复触发 + 失败可见

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "和猫猫们聊的多，聊天才能碰撞灵感"——对话入口优先，贴链接猫识别 | AC-1, AC-2, AC-11 | manual + test | [x] |
| R11 | "可以让我选择新开 thread 或者关联哪个 thread？甚至挂载进来！聊天和 Study 相辅相成" | AC-1, AC-11 | manual + test | [x] |
| R2 | 文章上下文自动注入 system prompt，猫读原文然后和铲屎官讲 | AC-2 | test | [x] |
| R3 | 深度学习笔记归档（用户确认后写入） | AC-3 | manual + test | [x] |
| R4 | Study 前端展示（折叠区 + 视觉标记） | AC-4, AC-9 | screenshot | [x] |
| R5 | "两种都要"——精华 2-3 分钟 + 深度 10 分钟，声线跟随参与猫，可三只 | AC-5 | manual + test | [x] |
| R6 | 多猫研究集成（复用 F086） | AC-6 | manual | [x] |
| R7 | 7 个新 MCP 工具（含管理类 parity） | AC-7 | test | [x] |
| R8 | Study 存储方案（文章同目录） | AC-3, AC-4 | test | [x] |
| R9 | Signal Hunter 迁移 | AC-8 | manual | [x] |
| R12 | "打开原文不要跳浏览器"→ 铲屎官确认保留外链（给人 show 来源） | AC-12 | 铲屎官确认 | [x] |
| R13 | "hunter 列表 UX 设计语言归一化" | AC-13 | screenshot | [~] deferred |
| R10 | "记忆是 thread session 搜来的"——用 cat-cafe-memory，不走 RAG | AC-10 | test | [x] |
| R14 | "有的时候拉到了一堆垃圾就想干掉！"——删除文章（单篇+批量） | AC-14, AC-16 | manual | [x] |
| R15 | "添加备注"——铲屎官给文章加个人笔记/提醒 | AC-15 | manual | [x] |
| R16 | 批量操作（多选 → 删除/标已读/归档/加标签） | AC-16 | manual | [x] |
| R17 | 按来源过滤（50+ 信源需要快速筛选） | AC-17 | manual | [~] deferred |
| R18 | 文章关联——相关文章绑成"学习集" | AC-18 | manual | [x] |
| R19 | 学习时间线——"上周学了什么"回顾视图 | AC-19 | screenshot | [x] |
| R20 | 删除语义——软删除，有关联资产不硬删（砚砚 brainstorm） | AC-20 | test | [x] |
| R21 | 备注 vs 笔记边界：备注进搜索、不注入上下文、列表 hover 预览 | AC-21 | manual | [x] |
| R22 | Thread 关联 edge cases（默认继续/去重/并列挂载/stale link） | AC-22 | test | [x] |
| R23 | 讨论前 evidence pack（先搜后聊） | AC-23 | test | [x] |
| R24 | Artifact job state（播客/研究 queued→running→ready/failed） | AC-24 | test | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（开发后补充截图）

## Links

- [F21++ 设计文档（2026-02-26 feat 采访）](../plans/2026-02-26-f21-study-mode-design.md)
- [F021 聚合文件](./F021-signal-study-mode.md)
- [Signal 信源缺口审计](../plans/2026-02-20-f21-signal-sources-gap.md)
- [UX Wireframe](../../designs/mission-hub-f091-signal-study-mode.pen) — 五屏 wireframe（Pencil，在 Mission Hub 画布上）
- [Implementation Plan](../plans/2026-03-10-f091-signal-study-mode.md) — 7 层 20 个 task 的实施计划

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
>
> "打开原文能不能——hunter 的时候就保存了 md 的？不要让我跳转浏览器，而是直接渲染，和我们的 workspace 那个系统做的那样，能够渲染 md 文档！"
>
> "hunter 列表的 UX 设计你也要记得设计语言归一化。"
>
> "需要能让我删除文章！添加备注等等功能。有的时候拉到了一堆垃圾就想干掉！"

### 布偶猫场景补充（铲屎官确认前的推演）

铲屎官的日常使用场景推演：

1. **垃圾清理**（铲屎官明确要求）：50+ 信源每天拉一堆文章，质量参差不齐，需要快速删除不想看的。批量操作是必须的——一个个删太痛苦。

2. **个人备注**（铲屎官明确要求）：不同于标签（分类用），备注是铲屎官的个人提醒——"下次和砚砚讨论"、"这个和 F086 有关"、"等 Gemini 2.5 发了再看"。

3. **来源过滤**（推演）：50+ 信源太多，铲屎官会想"今天只看 Anthropic 的"或"只看论文"。现有 Tab 只有状态过滤（全部/未读/收藏），缺来源维度。

4. **学习集**（推演）：铲屎官常常关注一个主题的多篇文章（如"多 Agent 系列"），把它们关联起来可以看全局图景，也方便生成跨文章的播客。

5. **学习时间线**（推演）：铲屎官想回顾"上周学了什么"，不是按文章列表看，而是按时间线看 study 成果——哪些笔记、哪些播客、和谁讨论了什么。

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
| 8 | Phase 策略 | **面向终态不分阶段，但 artifact 保留 job state** | **P1 面向终态不绕路**（铁律）+ 砚砚 push back |
| 9 | 设计先行 | 先画 UX，再写代码 | "代码是最廉价的，设计才是灵魂" |
| 10 | Thread-Study 关联 | 新开/关联/挂载 thread，聊天和 Study 相辅相成 | Study 不是孤立学习，是围绕文章的对话聚合 |
| 11 | 原文渲染 | 内嵌 md 渲染（不跳浏览器），复用 workspace md renderer | Hunter 已存 .md，不该再让用户出 Cat Café |
| 12 | 列表 UX | Signal Inbox 列表设计语言归一化 | 与 Cat Café 整体风格一致 |
| 13 | 删除策略 | 软删除（`deletedAt`），不硬删有关联的文章 | 防幽灵引用，保留恢复可能（砚砚 brainstorm） |
| 14 | 备注边界 | 备注进搜索、不注入上下文、列表 hover 预览 | 备注≠study 笔记，控制噪声（砚砚 brainstorm） |
| 15 | MCP parity | 管理操作（删除/备注/thread 关联）必须有 MCP 工具 | 主入口是对话，不能只在 Web UI（砚砚 push back） |
| 16 | 数据模型 | frontmatter 轻量 + sidecar 目录 meta.json 聚合索引 | 不把 frontmatter 写成垃圾场（砚砚 brainstorm） |
| 17 | Evidence pack | 讨论前固定搜：文章全文 + note + linked threads + study note | "先搜后聊"具体化，不是玄学记忆（砚砚提案） |
| 18 | 实施顺序 | 模型→MCP→对话入口→UI→视图层 | 按依赖拓扑落，不按功能切片（砚砚建议） |
| 沿用 | F21++ 设计文档其余决策 | 见 2026-02-26 文档 | — |

## Dependencies

- F021 (done) — Signal 基础设施
- F034 (done) — TTS provider
- F066 (done) — 语音管线

## Risk

- R5 播客 10 分钟深度版 TTS 合成耗时/成本需评估
- R4 前端改动范围较大（文章详情页 + 列表页）
- 现有 PATCH 端点只支持 `status/tags/summary`，需扩展共享 schema + API + MCP（砚砚发现）
- 删除/迁移操作与 `filePath` 耦合（`article-query-service.ts` 静默跳过缺失文件），需确保一致性
- Thread 关联 many-to-many 模型复杂度（当前是硬编码 `/thread/default?signal=...`）

## Open Questions

> Design Gate 已关闭，核心问题已确认。

## Review Gate

- [x] Design Gate: UX 确认（铲屎官 2026-03-10）
- [x] 本地猫 review（codex R1+R2，2026-03-10）
- [x] 云端 review（PR #348 R1+R2，2026-03-10）
- [x] 愿景守护 close review（gpt52 2026-03-10：第二次守护后铲屎官拍板缩 scope，AC-13/AC-17 deferred）

## Timeline

- 2026-03-10: Kickoff + Design Gate 通过，面向终态不分阶段
- 2026-03-10: UX wireframe 完成（5 屏：文章详情+Study折叠区、对话链接注入流程、播客播放器、Inbox 列表、原文渲染）
- 2026-03-10: 布偶猫×砚砚(GPT-5.4) 头脑风暴，补充 R20-R24 + Decision 13-18
- 2026-03-10: Phase 1-3 实现合入 main (PR #348)，17/24 AC done
- 2026-03-10: 砚砚(GPT-5.4) 愿景守护：**不可 close**，剩余 7 AC 待补（AC-5/6/10/12/13/17/18/19）
- 2026-03-10: Phase 4 实现合入 main (PR #351)，22/24 AC done — codex R1→R5 五轮 review
- 2026-03-10: 砚砚(GPT-5.4) 第二次愿景守护 → 铲屎官拍板缩 scope（AC-1 partial→done, AC-12 行为正确→done, AC-13/17 deferred）→ close

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

### Screen D: Signal Inbox 列表（设计归一化）
- 标题 + 实时统计（今日/未读计数）
- 搜索栏（pill 形状，搜文章/标签/来源）
- Tab 过滤：全部 / 未读 / 已学习（绿色书本图标）/ 收藏
- 列表卡片：Tier badge + 来源 + 时间 → 标题 → 标签 pills
- 未读文章有红点指示 + 淡蓝背景
- Study badge 绿色带数字（2/1）——一目了然

### Screen E: 原文内嵌 Markdown 渲染
- "返回详情"导航 + "浏览器打开"fallback 按钮
- 文章元信息条（Tier + 来源 + 日期）
- **复用 MarkdownContent 组件**渲染完整 .md 正文
- 支持标题、段落、blockquote（紫色竖线）、代码块（深色主题 + 复制按钮）
- 猫猫标注：橙色提示条，猫猫在原文旁加批注/关联洞见

## 布偶猫×砚砚 头脑风暴纪要（2026-03-10）

**参与者**: 布偶猫/宪宪 (@opus) + 缅因猫/砚砚 (@gpt52, GPT-5.4)
**模式**: collaborative-thinking Mode B（多猫独立思考）

### 砚砚的 2 个 Push Back（已采纳）

1. **MCP 工具数量不够**：主入口是对话，管理操作（删除/备注/thread 关联）不能只在 Web UI。4→7 个新工具。
2. **Artifact job state 必须有**：不要 Study 生命周期状态机，但播客/研究生成的 `queued/running/ready/failed` 不可省。Decision #8 已修正。

### 砚砚补充的 5 个缺口场景（已转为 R20-R24）

1. **删除语义**（R20）：软删除 `deletedAt`，有关联资产不硬删。当前 `article-query-service.ts` 静默跳过缺失文件会留幽灵数据。
2. **备注 vs 笔记边界**（R21）：备注=铲屎官 scratch note（进搜索、不注入上下文、列表 hover 预览）；笔记=猫猫深度分析（重量、需确认）。
3. **Thread 关联 many-to-many**（R22）：4 条 edge case——默认继续最近 thread / 重复贴去重 / 并列挂载 vs 切换 / thread 删后 stale 不级联。
4. **批量操作范围**（AC-16 更新）：当前页可见项，不做全部命中项。
5. **讨论前检索策略**（R23）：evidence pack = 文章全文 + note + linked threads (max 3) + study note。"先搜后聊"。

### 砚砚的数据模型建议（已采纳为 Decision #16）

- **frontmatter 保持轻量**：现有 `status/tags/summary` + 新增 `note/deletedAt/studyCount/lastStudiedAt`
- **sidecar 目录 + meta.json**：`{articleId}/meta.json` 做聚合索引（threads/artifacts/collections），notes/report/audio 独立文件
- **stable id 原则**：UI 不依赖文件名推关系，`articleId` 做 anchor

### 砚砚的实施顺序建议（已采纳为 Decision #18）

不是"分 Phase 阉割功能"，而是"同一终态按依赖拓扑落"：
1. 聚合模型 + 写接口（note/delete/thread-link/artifact-manifest）
2. 对话入口 + 内嵌阅读 + MCP parity
3. Study 折叠区 + 归档 + 播客/研究生成
4. 学习集 + 时间线（视图层，吃前面归一化好的数据）

### 共识区

- 19→24 个需求点 + 24 个 AC，覆盖更完整
- 数据模型方向：frontmatter 轻量 + sidecar meta.json
- 实施不分"阉割 Phase"，但按依赖拓扑顺序落

### 分歧区

无重大分歧。砚砚的 2 个 push back 都被采纳。

### 收敛检查

1. 否决理由 → ADR？有 → Decision #8 修正（否决"完全无状态"，保留 artifact job state）
2. 踩坑教训 → lessons-learned？有 → 文件存在≠任务状态，长任务必须有 job state（待写入）
3. 操作规则 → 指引文件？没有新全局规则
