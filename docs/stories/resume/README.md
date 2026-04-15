---
feature_ids: []
topics: [stories, career, resume]
doc_kind: story
created: 2026-04-07
updated: 2026-04-14
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
| 联系方式 | `[发简历时自行填写]` |
| 所在地 | 深圳 |
| GitHub | github.com/zts212653 |
| 个人站点/作品集 | `[待填]` |

---

### 一句话定位

**AI Agent 架构师 / 多智能体系统设计者**
——7 年华为经验，横跨云基础设施与 AI Agent 两个技术周期。曾主导华为云服务开发框架（巫山）的中间件归一与分布式调度；后将同一套解耦哲学应用于 AI 领域，从零设计多智能体协作平台 Cat Cafe（4+ 模型家族、10+ Agent 个体实时协同），架构经高层现场验证后被内部产品化采纳，相关办公智能体方向已于 2026-04-14 以华为云 OfficeClaw 公开发布。

---

### 专业技能

| 领域 | 技能 |
|------|------|
| 云基础设施 | Java / Spring / WebFlux、中间件架构归一、分布式调度与编排（ElasticJob / YAML DSL）、多环境适配 |
| AI Agent 架构 | Multi-Agent Orchestration、愿景驱动治理、可携带治理与信任边界、联邦知识系统、Prompt Engineering、Agent 间通信协议设计 |
| LLM 工程 | Claude / OpenAI / Gemini API 集成、多模型路由与 fallback、上下文窗口分层压缩、Token 预算优化、RAG（BM25 + 向量混合检索） |
| 全栈工程 | TypeScript / Node.js / React / Next.js、Redis、SQLite、Monorepo (pnpm workspace)、MCP (Model Context Protocol) |
| 开发流程 | TDD、Cross-Model Code Review、Feature 全生命周期治理、CI/CD 门禁、IM 网关（5 渠道） |
| `[待填]` | `[铲屎官补充其他技能 — 如 K8s/容器编排/HarmonyOS 等，按目标岗位调整]` |

---

### 工作经历

#### `[待填：职位名称]` — 华为技术有限公司（2019 至今）

> 深圳 · 华为云 / ICT · 云软件开发部 · 架构与技术 · 在职约 7 年

**核心项目：Cat Cafe — 多智能体协作平台（开源）**

从零设计并实现了完整的 Multi-Agent 协作系统，以"领养团队，不是配置工具"为产品愿景，让非程序员也能通过 AI 猫猫团队将想法变成可运行的产品。

关键成果：
- **协作决策架构**：设计了无 Boss Agent 的多智能体协作架构，4+ 模型家族、10+ 个体通过独立思考 → 碰撞 → 收敛形成涌现性决策（非单模型 × N 执行者），含自主路由、@提及分发、跨模型 Code Review
- **愿景驱动的 Feature 治理**：建立了基于证物验证（evidence-based）的愿景守护体系（feat-lifecycle → Design Gate → TDD → quality-gate → cross-model review → merge-gate → 愿景守护），愿景不是指导方针而是结构性门禁——系统强制拦截任何偏离愿景的代码合入。覆盖 150+ tracked work items 全生命周期
- **五层记忆与知识涌现**：Session Chain → Evidence Index → Knowledge Feed → Durable Knowledge → Eval，基于 SQLite + BM25 + 向量混合检索的联邦知识系统，支撑跨会话知识积累、来源归因和过时知识自动退役
- **可携带治理与信任边界**：治理规则以版本化、可校验的 Governance Pack 形式随 Agent 携带（checksum 校验 + fail-closed preflight），社区扩展不能越权；已支撑多 provider bootstrap 和外部项目派遣，方法论可迁移而非项目绑定
- **Skill 生态 + IM 网关**：~30 个可插拔 Skill（TDD、Code Review、设计协作、视频制作、PPT 生成等）+ 5 渠道 IM 网关（飞书 / 微信 / Telegram / DingTalk / WeCom 双向消息、语音、图片、文件传输）
- **企业采纳**：架构在零准备高层演示中稳定通过实测，48 小时内被高层拍板采纳为企业 Agent 平台基础并启动推广。相关办公智能体方向已于 2026-04-14 以华为云 OfficeClaw 公开发布，印证了该多智能体架构方向的商业化可行性

**企业内部采纳事件**

2026 年 3 月，被临时拉入高层演示会议，零准备现场接受实测：
- 高层用飞书直接对系统提问、生成报告、导出 PDF，全程稳定通过
- 48 小时内高层拍板启动产品化，架构被 fork 用于企业内部 Agent 平台建设
- 2026-04-14，相关办公智能体方向以华为云 OfficeClaw 公开发布，标志着架构产品化路线从内部验证走向商业化发布

**项目一：巫山框架 — 华为云服务开发框架（2019–2025）**

华为云内部统一的云服务开发框架，为各业务线提供标准化的服务开发、部署和运行基座。

- **框架奠基**：作为初创成员参与框架从零搭建，主导 WebFlux 与 Spring 集成层的设计与实现，为全框架的响应式基座打下技术底层
- **中间件架构归一**：设计框架层抽象，屏蔽 HCS / HCSO / 线上 / 线下等多套环境差异，制定统一规范供各业务线接入——使外部团队可插拔地对接，无需关心底层环境分裂（与后续 Cat Cafe IM 网关层的"渠道解耦 + 可插拔接入"是同一架构哲学）
- **分布式调度与编排**：自主设计并实现 TaskFlow 响应式任务编排引擎（基于 Reactive + YAML 工作流定义），深度重构 ElasticJob 构建分布式调度器，支撑定时任务和复杂编排场景
- **技术栈**：Java / Spring / WebFlux / ElasticJob / YAML DSL / 分布式系统

- **服务规模**：框架支撑华为云 500+ 云服务、6000+ 微服务的开发运行基座（2025 年数据）

**项目二：AI Agent 技术探索与落地（2025.03–至今）**

从零探索 AI Agent 方向，经历了从低代码编排到自主多智能体协作的完整技术演进：

- **阶段一（2025.03–2025 Q4）**：调研并实践 Dify、RAGFlow 等 Agent 编排平台，评估低代码 AI 方案的能力边界
- **阶段二（2025 Q4–2026.01）**：跟进业界 Skill / Harness 范式演进，探索单 Agent 的工具编排与任务执行能力
- **阶段三（2026.01–至今）**：设计并实现 Cat Cafe 多智能体协作平台（见上文"核心项目"），从单 Agent 工具调用演进到跨模型对等协作架构

---

### 教育背景

| 学历 | 学校 | 专业/方向 | 备注 |
|------|------|----------|------|
| 硕士 | 乔治城大学 (Georgetown University) | 计算机科学 · NLP 方向 | 华盛顿 D.C.，2017–2019 |
| 本科 | 西交利物浦大学 → 利物浦大学 (2+2) | 计算机科学 + 软件工程 | 前两年苏州，后两年英国利物浦，2013–2017 |

> 应届毕业后直接入职华为，无其他工作经历。

---

### 开源项目

| 项目 | 角色 | 描述 |
|------|------|------|
| **Cat Cafe** (clowder-ai) | Creator & Lead Architect | 多智能体协作平台，MIT 协议。150+ tracked work items，~30 Skills，5 渠道 IM 接入，跨 4 模型家族对等协作 |
| **Cat Cafe Tutorials** (cat-cafe-tutorials) | Creator | 多智能体协作实践教程，配套 Cat Cafe 的入门与进阶指南，GitHub 270+ Stars |

---

### 关键数据

| 指标 | 数据 |
|------|------|
| Tracked work items | 150+（feature specs + ADRs + plans） |
| 自动化测试 | 990+ 测试文件（回归测试基础设施） |
| 事故驱动护栏 | 每条关键约束可追溯到具体事故与复盘 |
| Skill 数量 | ~30 |
| 接入 AI 模型家族 | 4+（Claude / GPT / Gemini / Codex） |
| Agent 个体数 | 10+（含多分身） |
| IM 渠道 | 5（飞书 / 微信 / Telegram / DingTalk / WeCom） |
| 架构企业采纳 | 高层现场验证后被内部产品化团队采纳为 Agent 平台基础，并于 2026-04-14 出现华为云 OfficeClaw 公开发布信号 |
| 项目周期 | 约 60 天从零到生产级（2026-02 至今持续迭代） |

---

## English Version

### Summary

**AI Agent Architect** with 7+ years at Huawei, spanning cloud infrastructure and AI agent systems. Built Huawei Cloud's service development framework (middleware abstraction, distributed scheduling for 6000+ microservices), then applied the same decoupling philosophy to design Cat Cafe — a production-grade multi-agent collaboration platform with vision-driven governance, cross-project portable methodology, and federated knowledge systems across 4+ LLM families. The architecture was adopted into an internal productization initiative after passing an unplanned live executive demo, and the related office-agent direction was later surfaced publicly in Huawei Cloud's OfficeClaw announcement on April 14, 2026.

### Experience

#### `[Title]` — Huawei Technologies (2019 – Present)

> Huawei Cloud / ICT · Cloud Software Development · Architecture & Technology

**Cat Cafe — Multi-Agent Collaboration Platform (Open Source, MIT)**

- Architected a collaborative decision-making multi-agent system (no boss agent) where 4+ LLM families and 10+ agent personas produce emergent decisions through independent thinking → collision → convergence, not single-model × N executors. Includes autonomous routing, @-mention dispatch, and cross-model code review
- Built evidence-based, vision-driven feature governance (feat-lifecycle → Design Gate → TDD → quality-gate → cross-model review → merge-gate → Vision Guard) where architectural vision acts as a structural gate — the system enforces rejection of any change that deviates from vision. Covers 150+ tracked work items with full lifecycle traceability
- Designed a five-layer federated knowledge system (Session Chain → Evidence Index → Knowledge Feed → Durable Knowledge → Eval) with hybrid BM25 + vector retrieval, source attribution, and automated knowledge retirement
- Built portable governance with trust boundaries: methodology carried as versioned, checksum-verified Governance Packs with fail-closed preflight; community extensions cannot exceed granted permissions. Supports multi-provider bootstrap and external project dispatch
- Designed a pluggable Skill ecosystem (~30 skills) + 5-channel IM gateway (Lark, WeChat, Telegram, DingTalk, WeCom) with bidirectional rich media transport
- Architecture adopted into an internal productization initiative after passing an unscheduled live demo to C-suite executives with zero preparation; the related office-agent direction was publicly launched on April 14, 2026, as **Huawei Cloud OfficeClaw**, validating the commercial viability of the multi-agent architecture direction

**Resume bullet (interview pitch version):**

> "I built a multi-agent AI team from scratch — 10+ AI agents across 4 model families collaborating in real time. When my company's leadership tested it live with zero notice, it passed flawlessly. Within 48 hours, they adopted my architecture as the basis for an internal AI Agent platform."

**Extended version (for interviews where you can go deeper):**

> "The competing internal solution crashed during the same executive demo. 48 hours later, the executive directed company-wide adoption based on my architecture."

**Wushan Framework — Huawei Cloud Service Development Framework (2019–2025)**

- Founding member of Huawei Cloud's internal unified service development framework; led the design and implementation of the WebFlux–Spring integration layer as the reactive foundation
- Designed a middleware abstraction layer to shield environment differences across HCS / HCSO / online / offline deployments; published integration specifications adopted across business lines — enabling plug-and-play onboarding (same architectural philosophy later applied to Cat Cafe's IM gateway: channel decoupling + pluggable adapters)
- Independently designed and built TaskFlow, a reactive task orchestration engine (Reactive + YAML workflow DSL), and deeply refactored ElasticJob into a distributed scheduler supporting scheduled tasks and complex orchestration
- Tech stack: Java, Spring, WebFlux, ElasticJob, YAML DSL, distributed systems

**AI Agent Technical Exploration & Productization (2025.03–Present)**

- Evaluated low-code AI orchestration platforms (Dify, RAGFlow) and their capability boundaries
- Tracked industry evolution through Skill/Harness paradigms to multi-agent orchestration
- Designed and shipped Cat Cafe (see above), evolving from single-agent tool calling to cross-model peer collaboration

---

### Skills

- **Cloud Infrastructure**: Java, Spring, WebFlux, Middleware Abstraction, Distributed Scheduling (ElasticJob, YAML DSL), Multi-Environment Adaptation
- **AI/Agent**: Multi-Agent Orchestration, Vision-Driven Governance, Portable Governance & Trust Boundaries, Federated Knowledge Systems, Prompt Engineering, LLM API Integration (Claude/GPT/Gemini), RAG (BM25 + Vector)
- **Full-Stack**: TypeScript, Node.js, React, Next.js, Redis, SQLite, MCP (Model Context Protocol), Monorepo (pnpm)
- **Process**: TDD, Cross-Model Code Review, Feature Lifecycle Governance, CI/CD Gating, IM Gateway (5 channels)

---

### Education

| Degree | University | Major / Focus | Notes |
|--------|-----------|---------------|-------|
| M.S. | Georgetown University | Computer Science · NLP | Washington, D.C. · 2017–2019 |
| B.Eng. | Xi'an Jiaotong-Liverpool University → University of Liverpool (2+2) | Computer Science + Software Engineering | 2 years Suzhou + 2 years Liverpool · 2013–2017 |

---

## 面试口述版（30 秒 Elevator Pitch）

**30 秒标准版（简历/初筛用）：**

> "我在华为做了 7 年。前 6 年做云基础设施——华为云的服务开发框架是我和同事们从零搭的，主要做中间件架构归一和分布式调度。去年开始转 AI Agent 方向，把做框架时积累的解耦思维用到了多智能体系统上，从零搭了 Cat Cafe——4 个模型家族、10 多个 AI 个体实时协作，带记忆系统、带 5 渠道 IM 集成。有一天被高层临时拉去现场演示，零准备通过，48 小时后公司拍板用我的架构做内部 Agent 平台。我想找一个能让我在 Agent 方向继续深耕的机会。"

**加料版（面试聊到深处、气氛合适时用）：**

> "那次演示里同时上场的还有另一个内部方案，当场崩了。所以高层选了我的架构。"

---

## 铲屎官 TODO

以下信息需要你来补充，猫猫们帮不了：

- [x] ~~教育背景~~ — 乔治城 NLP 硕士 (2017–2019) + 西浦/利物浦 2+2 本科 (2013–2017)
- [x] ~~华为 BU/部门~~ — 华为云/ICT · 云软件开发部 · 架构与技术
- [x] ~~华为正式项目经历~~ — 巫山框架（500+ 云服务 / 6000+ 微服务）
- [x] ~~华为之前的工作经历~~ — 应届入职，无
- [x] ~~GitHub~~ — github.com/zts212653
- [x] ~~想投的方向~~ — Agent 相关，大厂均可看

**发简历时自行补充：**
- [ ] 真实姓名 + 联系方式（手机/邮箱/微信）
- [ ] 华为职位名称（级别写不写自己拿捏）
- [x] ~~毕业年份~~ — 已填
- [ ] 其他技能（云原生/K8s/HarmonyOS 等，按目标岗位调整）

---

*[宪宪/Opus-46] drafted v1 · [砚砚/GPT-5.4] reviewed 5 findings (3×P1 + 2×P2) · [宪宪/Opus-46] applied all fixes → v2 → filled Huawei exp + education → v2.2*
