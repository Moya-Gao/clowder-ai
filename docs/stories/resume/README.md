---
feature_ids: []
topics: [stories, career, resume]
doc_kind: story
created: 2026-04-07
updated: 2026-04-08
participants: [opus, gpt52, gemini]
thread_ids: []
---

# Landy's Resume — Draft v2

> 猫猫委员会联合起草，铲屎官审阅定稿。`[待填]` = 需要铲屎官补充的信息。

---

## 中文版

### 基本信息

| 项目 | 内容 |
|------|------|
| 姓名 | `[待填]` |
| 联系方式 | `[待填 — 手机/邮箱/微信]` |
| 所在地 | 深圳 |
| GitHub | `[待填]` |
| 个人站点/作品集 | `[待填]` |

---

### 一句话定位

**AI Agent 架构师 / 多智能体系统设计者**
——从零设计并落地了跨模型 Multi-Agent 协作平台（Cat Cafe），支撑 4+ AI 模型家族、10+ Agent 个体实时协同，架构经高层现场验证后被内部产品化团队采纳为企业 Agent 平台基础。

---

### 专业技能

| 领域 | 技能 |
|------|------|
| AI Agent 架构 | Multi-Agent Orchestration、A2A Protocol 设计、Agent 生命周期管理、Prompt Engineering、Tool/Skill 编排 |
| LLM 工程 | Claude API/SDK、OpenAI API、Gemini API、多模型路由与 fallback、上下文窗口管理（F148 分层压缩）、Token 预算优化 |
| 全栈工程 | TypeScript / Node.js / React / Next.js、Redis、SQLite、Monorepo (pnpm workspace)、MCP (Model Context Protocol) |
| IM 集成 | 飞书 / 微信 / Telegram / DingTalk / WeCom 五渠道接入，消息路由、富媒体传输、扫码绑定 |
| 开发流程 | TDD (Red-Green-Refactor)、Code Review 跨模型互审、Git Worktree 隔离开发、CI/CD 门禁 |
| 产品思维 | 愿景驱动开发、Feature 生命周期管理、用户故事拆分、Design Gate |
| `[待填]` | `[铲屎官补充其他技能 — 比如云原生/K8s/HarmonyOS/其他语言等]` |

---

### 工作经历

#### `[待填：当前职位名称]` — 华为技术有限公司（`[待填：入职年份]` 至今）

> 深圳 · `[待填：所属 BU/部门]` · 在职约 7 年

**核心项目：Cat Cafe — 多智能体协作平台（开源）**

从零设计并实现了完整的 Multi-Agent 协作系统，以"领养团队，不是配置工具"为产品愿景，让非程序员也能通过 AI 猫猫团队将想法变成可运行的产品。

关键成果：
- **架构设计**：设计了无 Boss Agent 的对等协作架构，支持 Claude / GPT / Gemini / Codex 等 4+ 模型家族、10+ 个体并发协作，含自主路由、@提及分发、跨模型 Code Review 机制
- **记忆系统**：实现了五层记忆架构（Session Chain → Evidence Index → Knowledge Feed → Durable Knowledge → Eval），基于 SQLite + BM25 + 向量检索的混合 RAG 系统，支撑 Agent 的跨会话知识积累
- **协作纪律**：建立了完整的 SOP 体系（feat-lifecycle → TDD → quality-gate → review → merge-gate），覆盖 150+ tracked work items 的全生命周期管理
- **IM 网关**：打通飞书、微信、Telegram、DingTalk、WeCom 五个渠道，实现消息、语音、图片、文件的双向传输
- **Skill 生态**：设计了可插拔的 Skill 系统（~30 Skills），涵盖 TDD、Code Review、设计协作、视频制作、PPT 生成等全链路能力
- **企业采纳**：架构在一次无预案的高层现场演示中稳定通过实测，48 小时内被内部产品化团队采纳为企业 Agent 平台基础并启动推广

**企业内部采纳事件**

2026 年 3 月，被临时拉入高层演示会议，零准备现场接受实测：
- 高层用飞书直接对系统提问、生成报告、导出 PDF，全程稳定通过
- 48 小时内高层拍板启动产品化，架构被 fork 用于企业内部 Agent 平台建设

**华为正式项目经历**

> **P1 — 砚砚 review 指出：简历不能只有 Cat Cafe，否则看起来像"side project 比主业还大"。至少补 1-2 条华为正式产品/项目成果，要有业务结果或组织影响。**

`[待填 — 铲屎官这一段必须补，否则简历不能出门：]`
- `[项目 1：产品/项目名 + 你的角色 + 业务成果（用户量/营收/效率提升等）]`
- `[项目 2：产品/项目名 + 你的角色 + 业务成果]`

---

#### `[待填：之前的工作经历]`

`[铲屎官补充华为之前的经历]`

---

### 教育背景

| 学校 | 专业 | 学历 | 年份 |
|------|------|------|------|
| `[待填]` | `[待填]` | `[待填]` | `[待填]` |

---

### 开源项目

| 项目 | 角色 | 描述 |
|------|------|------|
| **Cat Cafe** (clowder-ai) | Creator & Lead Architect | 多智能体协作平台，MIT 协议。150+ tracked work items，~30 Skills，5 渠道 IM 接入，跨 4 模型家族对等协作 |
| `[待填]` | `[待填]` | `[其他开源贡献]` |

---

### 关键数据

| 指标 | 数据 |
|------|------|
| Tracked work items | 150+（feature specs + ADRs + plans） |
| Skill 数量 | ~30 |
| 接入 AI 模型家族 | 4+（Claude / GPT / Gemini / Codex） |
| Agent 个体数 | 10+（含多分身） |
| IM 渠道 | 5（飞书 / 微信 / Telegram / DingTalk / WeCom） |
| 架构企业采纳 | 高层现场验证后被内部产品化团队采纳为 Agent 平台基础 |
| 项目周期 | 约 60 天从零到生产级（2026-02 至今持续迭代） |

---

## English Version

### Summary

**AI Agent Architect** with 7+ years at a Fortune 500 tech company (Huawei). Designed and shipped Cat Cafe, a production-grade multi-agent collaboration platform orchestrating 4+ LLM families (Claude, GPT, Gemini, Codex) with 10+ agent personas in real-time. The architecture was adopted into an internal productization initiative after passing an unplanned live executive demo.

### Experience

#### `[Title]` — Huawei Technologies (`[Start Year]` – Present)

**Cat Cafe — Multi-Agent Collaboration Platform (Open Source, MIT)**

- Architected a peer-to-peer multi-agent system (no boss agent) supporting 4+ LLM families and 10+ agent personas with autonomous routing, @-mention dispatch, and cross-model code review
- Built a five-layer memory architecture (Session Chain → Evidence Index → Knowledge Feed → Durable Knowledge → Eval) with hybrid BM25 + vector retrieval for cross-session knowledge accumulation
- Designed a pluggable Skill system (~30 skills) covering TDD, code review, design collaboration, video production, and document generation
- Integrated 5 IM channels (Lark, WeChat, Telegram, DingTalk, WeCom) with bidirectional message, voice, image, and file transport
- Managed 150+ tracked work items through a rigorous SOP (feat-lifecycle → TDD → quality-gate → peer-review → merge-gate)
- Architecture adopted into an internal productization initiative after passing an unscheduled live demo to C-suite executives with zero preparation

**Resume bullet (interview pitch version):**

> "I built a multi-agent AI team from scratch — 10+ AI agents across 4 model families collaborating in real time. When my company's leadership tested it live with zero notice, it passed flawlessly. Within 48 hours, they adopted my architecture as the basis for an internal AI Agent platform."

**Extended version (for interviews where you can go deeper):**

> "The competing internal solution crashed during the same executive demo. 48 hours later, the executive directed company-wide adoption based on my architecture."

---

### Skills

- **AI/Agent**: Multi-Agent Orchestration, A2A Protocol Design, Prompt Engineering, LLM API Integration (Claude/GPT/Gemini), Context Window Management, RAG (BM25 + Vector)
- **Engineering**: TypeScript, Node.js, React, Next.js, Redis, SQLite, MCP (Model Context Protocol), Monorepo (pnpm), Git Worktree Isolation
- **Process**: TDD, Cross-Model Code Review, Feature Lifecycle Management, Vision-Driven Development
- **Product**: IM Gateway Integration (5 channels), Skill Ecosystem Design, Enterprise Productization

---

### Education

| University | Major | Degree | Year |
|------------|-------|--------|------|
| `[To be filled]` | `[To be filled]` | `[To be filled]` | `[To be filled]` |

---

## 面试口述版（30 秒 Elevator Pitch）

**30 秒标准版（简历/初筛用）：**

> "我在华为做了 7 年，最近一年从零搭了一个多 Agent 协作系统叫 Cat Cafe。4 个模型家族、10 多个 AI 个体实时协作，带记忆、带纪律、带 5 渠道 IM 集成。有一天被高层临时拉去现场演示，零准备，全程稳定通过。48 小时后公司拍板，用我的架构做内部 Agent 平台的基础。我想找一个能让我继续在 Agent 方向深耕的机会。"

**加料版（面试聊到深处、气氛合适时用）：**

> "那次演示里同时上场的还有另一个内部方案，当场崩了。所以高层选了我的架构。"

---

## 铲屎官 TODO

以下信息需要你来补充，猫猫们帮不了：

- [ ] 真实姓名 + 联系方式
- [ ] 教育背景
- [ ] 华为入职年份 + 当前职位名称 + 所属 BU
- [ ] 华为正式项目经历（Cat Cafe 之外的）
- [ ] 华为之前的工作经历（如有）
- [ ] GitHub 地址 / 个人网站
- [ ] 其他技能补充（云原生/K8s/HarmonyOS/其他语言等）
- [ ] 想投的方向/目标公司（方便我们帮你调整侧重点）

补充完了 @ 我和砚砚，我们帮你 review 打磨。

---

*[宪宪/Opus-46] drafted v1 · [砚砚/GPT-5.4] reviewed 5 findings (3×P1 + 2×P2) · [宪宪/Opus-46] applied all fixes → v2*
