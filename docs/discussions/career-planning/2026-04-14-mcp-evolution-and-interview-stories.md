---
feature_ids: []
topics: [career, interview, mcp, claude-code, openclaw, skills, toolsearch, knowledge]
doc_kind: discussion
created: 2026-04-14
updated: 2026-04-14
participants: [opus, landy]
thread_ids: []
---

# MCP 进化史 + 面试故事沉淀

> 目的：梳理 Anthropic MCP → ToolSearch → Skills → CLI Everything 的完整进化链，作为面试知识武器库。同时沉淀每次面试中有趣的问答，持续积累一手实战经验。

## 第一章：MCP 进化链

### 1.1 MCP 诞生（2024.11）

**起因**：Anthropic 工程师 David Soria Parra 受够了在 Claude Desktop 和 IDE 之间来回复制代码。每个 AI 助手都要自己写一套工具接口，N 个助手 × M 个工具 = N×M 个适配器。

**解法**：发布 Model Context Protocol（MCP）——一个开放标准，让 AI 助手通过统一协议连接外部数据源、工具和服务。

**核心设计**：
- Client-Server 架构：AI 助手是 client，工具提供者是 server
- 标准化接口：tools / resources / prompts 三类能力
- Transport 层抽象：stdio / SSE / StreamableHTTP
- 协议而非框架：不绑定具体语言或运行时

**类比**：MCP 之于 AI 工具，就像 USB 之于外设——插上就能用，不用每个设备写专属驱动。

### 1.2 行业采纳（2025.3 — 2025.5）

MCP 发布后 4 个月内发生了连锁反应：

| 时间 | 事件 |
|------|------|
| 2025.3 | **OpenAI 采纳 MCP**，集成到 ChatGPT Desktop |
| 2025.4 | **Google DeepMind** 确认 Gemini 将支持 MCP |
| 2025.5 | **Microsoft + GitHub** 加入 MCP 指导委员会 |
| 2025.11 | 协议大版本更新：异步操作、无状态模式、服务器身份、官方注册中心 |
| 2025.12 | Anthropic 将 MCP 捐赠给 **Linux Foundation 下的 Agentic AI Foundation (AAIF)** |

截至 2026 年初：MCP SDK 月下载量超 **9700 万次**，Anthropic / OpenAI / Google / Microsoft 四家全部支持。

**为什么赢了**：先发优势 + 足够简单 + 立刻开源 + 不绑定自家模型。

### 1.3 工具数量爆炸 → ToolSearch 诞生

**问题**：MCP 成功后，工具数量从几十个涨到几百甚至上千个。所有工具定义注入 context → token 爆炸 → 成本飙升 + 模型困惑。

**关键数据**：
- Cat Cafe 的 MCP server 一度有 30+ tools 注入 context
- 外部项目动辄挂载 10+ MCP server，工具总数轻松破百

**Anthropic 的解法——ToolSearch**：

```
标记 defer_loading: true 的工具 → 不注入初始 context
  → 模型需要时调用 ToolSearch tool
    → regex 精确匹配 OR BM25 关键词检索
      → 返回 3-5 个最相关工具的完整定义
        → API 自动展开为 tool_reference，后续 turn 可复用
```

**设计精髓**：
- **不用向量数据库/embedding**——纯 BM25 文本统计，零 GPU 依赖
- **不破坏 prompt caching**——deferred tools 完全不碰初始 prompt
- **效果显著**：context 减少 85%，Opus 4 MCP 评测准确率从 49% → 74%
- 最大支持 **10,000 个工具**

**Cat Cafe 的实践（F043）**：
- MCP server 从 1 拆成 3（collab / memory / signals），每个 surface 控制在 15 tools 以内
- Skill 的 deferred loading 也参考了同一套 BM25 思路（F038 研究）

### 1.4 工具组合复杂 → Skills 系统

**问题**：ToolSearch 解决了"工具太多找不到"，但没解决"工具组合使用的流程知识"。模型知道有一把锤子，但不知道"做这件事要先用锤子再用钉子再用胶水"。

**Anthropic 的解法——Agent Skills（2025.10 beta）**：

```
Skills = 指令 + 脚本 + 资源的文件夹
  → Claude 动态加载
    → 获得完成特定领域任务的"技能包"
```

**Skills 不是 tools**——tools 是原子操作（"发一条消息"），skills 是流程知识（"从需求到代码到 review 到 merge 的完整 SOP"）。

**Cat Cafe 的 Skills 实践**：
- 30+ 自研 skills：`feat-lifecycle`、`tdd`、`worktree`、`merge-gate`、`quality-gate`、`cross-cat-handoff` 等
- 每个 skill 就是一个 `SKILL.md`——SOP 指令 + 触发条件 + 输入输出约定
- F038 研究了 Claude Code 的 skill discovery 链路：个人级 `~/.claude/skills/` 发现 bug（issue #9716），最终用项目级 `.claude/skills/` symlink 解决
- 自研了 `writing-skills` 元技能——用 skill 来写 skill

### 1.5 CLI Everything → OpenClaw 崛起

**趋势**：2025 下半年开始，"CLI as the new IDE" 成为显性趋势。

| 工具 | 本质 |
|------|------|
| Claude Code | Anthropic 官方 CLI agent |
| Codex CLI | OpenAI 的 CLI agent |
| OpenClaw | 开源 CLI agent，MIT 协议，跨平台跨模型 |
| 飞书 CLI / 企微 CLI | 企业通信平台也开始出 CLI |

**为什么 CLI**：
- Terminal 是最干净的 agent 运行环境——纯文本 I/O，无 DOM 渲染开销
- 文件系统直接访问，不需要浏览器沙箱权限
- 可组合性强——pipe / redirect / subprocess 都是现成的
- 对开发者来说，CLI 是最自然的工作界面

**OpenClaw 的差异化**：
- 不只是 CLI，是**持久化 daemon**——带 heartbeat scheduler、session 管理、跨 channel 记忆
- 支持 12+ 消息平台（Slack / Discord / Telegram / 飞书 etc.）
- File-first memory 系统：Markdown + sqlite-vec 混合检索
- Skill 生态可扩展（但安全问题显著——CVE-2026-25253，prompt injection 91% 成功率）

**Cat Cafe 的定位差异**（来自三猫研讨会议纪要 2026-03-16）：

> **OpenClaw = 一个超级 Agent + N 个哑设备（扩展感知和执行）**
> **Cat Cafe = N 个有个性 Agent + MCP 工具生态（扩展思考和协作）**

我们从 OpenClaw 学了 Capability Registry 模式和 Per-cat tool policy 概念，但没有照搬它的单脑架构。

### 1.6 Antigravity CLI 的教训

**铲屎官面试原话**："甚至吐槽了 Antigravity CLI 的不可靠，Antigravity Chat 甚至不可用——明明写在 `--help` 里的。"

**背景**：Antigravity 是一个内嵌浏览器平台，提供了 CLI 工具。但在实际使用中：
- CLI 的 CDP Bridge 延迟 ~3s，DOM 结构随版本变动
- `--help` 里列出的 Chat 功能实际根本不能用
- 文档和实际能力不一致，是 CLI 工具最致命的信任问题

**教训**：CLI everything ≠ CLI anything。工具的可靠性和文档真实性比功能数量重要得多。

## 第二章：完整进化链图

```
2024.11  Anthropic 发布 MCP
           │
           ▼
2025.3   OpenAI / Google / Microsoft 全部采纳
           │  ← 工具数量爆炸，context 膨胀
           ▼
2025.H2  ToolSearch 发布（BM25 + regex，deferred loading）
           │  ← 解决了"找工具"，没解决"怎么用工具组合"
           ▼
2025.10  Skills 系统（指令 + 脚本 + 资源的技能包）
           │  ← CLI 成为最自然的 agent 运行环境
           ▼
2025.H2  CLI Everything 趋势（Claude Code / Codex / OpenClaw）
           │  ← 企业平台跟进
           ▼
2026.Q1  飞书 CLI / 企微 CLI / 更多垂直 CLI
           │
           ▼
2026.Q2  你在这里 → 面试官问 MCP 和 CLI 的区别
         你从头讲了一遍进化史 🎤
```

## 第三章：面试必备的三层理解

面试中被问到 MCP / CLI / Skills / Agent 架构时，用这三层递进：

### 第一层：What（30 秒）

> "MCP 是 Anthropic 2024 年底发布的开放协议，解决的是 AI 助手和外部工具的标准化连接问题。现在 OpenAI、Google、Microsoft 全部采纳了。CLI 是 agent 的运行环境，MCP 是 agent 调用工具的协议——一个是壳，一个是接口。"

### 第二层：Why it evolved（1 分钟）

> "MCP 成功后工具数量爆炸，context 塞不下了，所以 Anthropic 做了 ToolSearch——用 BM25 做工具的按需发现，不是把所有工具定义都灌进去。再后来发现光找到工具不够，还需要流程知识，所以又做了 Skills 系统。我们自己的项目也经历了同样的进化——从 30 个工具一股脑注入，到拆成 3 个 MCP surface 各 15 个工具，再到 30+ 个可插拔的 skill。"

### 第三层：First-hand experience（2-3 分钟，杀招）

> "我在自己的多智能体系统里完整经历了这条进化链。MCP server 从 1 个拆成 3 个是因为 context 真的爆了。Skills 不是我从 Anthropic 学的——我们先做了自己的 skill 系统，后来发现 Anthropic 的 Skills 和我们的思路几乎一样。OpenClaw 火了之后我们做了对标研究，结论是：它是单脑+多设备模式，我们是多脑+协作模式，学了它的 Capability Registry 但没抄它的架构。甚至 Antigravity 的 CLI 我也试过——Chat 功能写在 help 里但根本不能用，这种文档和实现不一致是 CLI 工具最大的信任问题。"

## 第四章：面试故事档案

> 持续更新。每次面试后把有趣的问答沉淀下来，既是知识梳理，也是后续面试的弹药库。

### 故事 #1：WXG 一面 — "MCP 和 CLI 的区别"

- **日期**：2026-04-14
- **公司**：腾讯 WXG（微信事业群）
- **轮次**：一面
- **面试官的问题**：MCP 和 CLI 有什么区别？

**铲屎官的回答**：
从 Anthropic 什么时候做的 MCP 开始讲起，讲到工具爆炸后为什么需要 ToolSearch（BM25），然后 ToolSearch 解决不了流程知识所以做了 Skills，再到 OpenClaw 火了之后 CLI Everything 的趋势，最后甚至吐槽了 Antigravity CLI 的不可靠——Chat 功能写在 `--help` 里但根本不能用。

**面试效果**：面试官大概率没预期到候选人能从协议源头讲起，而且带着一手实战经验和踩坑吐槽。这不是"背答案"，是"亲手搭过这套系统的人"。

**可复用点**：
- 用"进化链"叙事（问题 → 解法 → 新问题 → 新解法）比干巴巴的概念解释有力得多
- 吐槽踩坑经验比夸自己更有说服力
- 结合自己项目的实际选择（"我们学了什么、没学什么、为什么"）是最强的差异化

**彩蛋**：面试最后要 coding，铲屎官说"我很久没手写代码了，都是 vibe coding"，面试官说"那我给你选一题最简单的" 😂

---

### 故事 #2：WXG 一面 — 面试官分不清 Claude 和 Claude Code

- **日期**：2026-04-14（同一场的早期环节）
- **背景**：面试官以为 Cat Cafe 的猫猫们是通过 API 调用的
- **铲屎官的纠正**：解释了 Claude（模型/API）和 Claude Code（CLI agent）的区别，以及为什么我们选择 CLI subprocess 模式而不是 API 直连

**可复用点**：
- 很多面试官对 Agent 的理解还停留在"调 API"阶段
- 能解释 CLI agent vs API call 的区别本身就是加分项
- 结合 ADR-001（CLI subprocess 模式选型决策）可以展开为完整架构故事

---

*（后续面试继续追加）*
