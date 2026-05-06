---
topics: [harness-engineering, concept-map, openai, anthropic, thoughtworks, chinese-community]
doc_kind: discussion
created: 2026-05-05
participants: [codex, landy]
related_decisions: [ADR-031]
related_discussions:
  - docs/discussions/2026-04-15-harness-engineering-triad-study/README.md
  - docs/discussions/2026-04-29-harness-asset-vs-debt-brainstorm.md
---

# Harness Engineering 概念谱系对照

> 目的：把“中文社区六大件 / Anthropic / OpenAI / Fowler-Thoughtworks”几套 harness 话语放到一张图里，避免把二次归纳误写成业界标准。

## 结论先行

“Harness 六大工程构件”不是 OpenAI / Anthropic / Fowler-Thoughtworks 给出的正式行业标准。它更像中文社区对 2026 年几篇高信号材料的二次综合，适合作为讲稿框架，但不该叫“业界公认六大部分”。

更稳的口径：

> Harness Engineering 正在形成跨社区共识，但还没有统一 taxonomy。OpenAI 更像 repo-centered scaffolding；Anthropic 更像 long-task orchestration + runtime interface decoupling；Fowler / Thoughtworks 更像控制论模型；中文社区六大件是把这些实践综合成工程构件清单。

## 来源谱系

| 来源 | 时间 | 自己提出的核心对象 | 关键词 | 定位 |
|---|---:|---|---|---|
| Mitchell Hashimoto — [My AI Adoption Journey](https://mitchellh.com/writing/my-ai-adoption-journey) | 2026-02-05 | `Engineer the Harness` | `AGENTS.md`、程序化工具、把错误固化成环境改进 | 命名入口之一；作者自己也说不确定是否已有广泛术语 |
| OpenAI — [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/) | 2026-02-11 | agent-first repo 工程 | repo knowledge、legibility、feedback loops、doc gardening、entropy cleanup | 工程实践案例：把 repo 做成 Codex 能长期工作的环境 |
| Anthropic — [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) | 2026-03-24 | 长任务 harness | planner / generator / evaluator、context reset、structured handoff、trace reading、模型升级后重审 harness | 长任务编排案例：用分工和 evaluator 拉高复杂 app 生成质量 |
| Fowler / Thoughtworks — [Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html) | 2026-04-02 | coding agent user harness | Guides / Sensors、Computational / Inferential、steering loop、harnessability | 方法论抽象：把 harness 看成前馈 + 反馈控制系统 |
| Anthropic — [Scaling Managed Agents](https://www.anthropic.com/engineering/managed-agents) | 2026-04-08 | managed-agent runtime interface | session / harness / sandbox 解耦、brain / hands 分离、credential isolation、wake(sessionId) | 运行时架构案例：让 session、harness、sandbox 可替换、可恢复、可隔离 |
| 中文社区 — [为什么模型越来越强，AI Coding 反而更依赖工程系统？](https://www.woshipm.com/ai/6387770.html) | 2026-05-03 | 六个工程构件 | Durable State、Plans、Feedback、Legibility、Tool Mediation、Entropy Control | 二次综合：把上面几路话语收成“生产级 coding agent harness”建设清单 |

## 四套话语分别在回答什么问题

| 体系 | 问题意识 | 典型答案 | 盲点 |
|---|---|---|---|
| 中文社区六大件 | “生产级 coding agent harness 该建哪些能力？” | 状态、计划、反馈、可读性、工具调解、熵控 | 容易被误读成标准；缺少 runtime interface 和 multi-agent governance |
| OpenAI | “如何让 Codex 在一个 repo 里大规模、长期、低人工介入地工作？” | 短 `AGENTS.md` + 深 `docs/`；repo-local system of record；UI/log/metrics 对 agent 可见；agent review；doc gardening | 以 Codex-first repo 为主，multi-vendor / multi-identity 问题展开较少 |
| Anthropic long-running | “如何让一个长任务从几十分钟跑到数小时还不跑偏？” | planner / generator / evaluator；structured handoff；context reset；读 trace 后删掉不再承重的 scaffold | 重点是单家族 / 单任务 harness，跨厂商协作和身份治理不是主轴 |
| Anthropic managed agents | “agent runtime 如何不变成不可恢复的 pet container？” | session / harness / sandbox 三接口解耦；harness 离开容器；session log 外部化；凭证隔离 | 更偏平台 runtime，不直接回答 repo 知识治理和 prompt/context 分层 |
| Fowler / Thoughtworks | “用户如何给 coding agent 建外层 harness，减少监督成本？” | Guides 负责前馈，Sensors 负责反馈；Computational 确定性，Inferential 语义判断；human steering loop | 抽象强，但具体 runtime / multi-agent 状态机要自己补 |

## 中文社区六大件与其他体系的映射

| 中文社区六大件 | OpenAI 对应 | Anthropic 对应 | Fowler / Thoughtworks 对应 | 备注 |
|---|---|---|---|---|
| Durable State Surfaces | `docs/` system of record、execution plans、tech-debt tracker、observability per worktree | structured handoff、session log、`getEvents()` | context engineering / harnessability 的基础 | 这是最横跨各家的共识：context window 不是 durable state |
| Decomposition & Plans | depth-first building blocks、execution plans as first-class artifacts | planner、sprint / feature decomposition、initializer agent | Guides 中的 specs / plans / rules | Anthropic 给了最清晰的长任务案例，OpenAI 给了 repo 内计划工件化案例 |
| Feedback Loops & Sensors | local/cloud agent reviews、CI、logs/metrics/traces、CDP validation、doc-gardening | evaluator agent、QA loop、Playwright MCP、trace reading | Sensors；Computational vs Inferential | Fowler 的四象限最适合解释“哪些 feedback 便宜可靠，哪些昂贵概率性” |
| Legibility | application UI、logs、metrics、traces、repo knowledge 对 Codex 可见；“看不见等于不存在” | structured artifacts 让下一轮 agent 接得住 | Ambient affordances / harnessability | OpenAI 对 legibility 讲得最强 |
| Tool Mediation | standard dev tools、repo-embedded skills、agent 可直接使用 `gh` / scripts | harness routes tool calls；MCP proxy；sandbox / tools 是 hands | Computational guides/sensors；CLI/scripts/codemods | Anthropic managed agents 把 tool mediation 提升到安全边界和运行时接口层 |
| Entropy Control | golden principles、background cleanup tasks、quality grades、AI slop garbage collection | 模型升级后重审 harness，删掉不再 load-bearing 的 pieces | steering loop + keep quality left | 中文六大件把“代码/文档熵控”放进清单；我们家还要再加“harness 自身熵控” |

## 它们之间不是互斥，而是分层

可以按四层理解：

```text
命名 / 直觉层
  Hashimoto: Engineer the Harness

实践案例层
  OpenAI: agent-first repo
  Anthropic: long-running app harness
  Anthropic: managed-agent runtime

方法论抽象层
  Fowler / Thoughtworks: guides + sensors, computational + inferential

二次综合层
  中文社区六大件: 状态 / 计划 / 反馈 / 可读性 / 工具 / 熵控
```

中文社区六大件的价值，是把实践案例翻译成开发者能照着盘点的 checklist。它的问题，是容易遮蔽“这不是标准，而是综合归纳”。

## 和 Cat Cafe 已有方法论的关系

我们已有的 ADR-031 不是另一套同级六分法，而是在问另一个问题：

> 一层 harness 何时该加？何时该删？它如何产生 signal，让未来可以删除自己？

所以关系是：

| 层 | 外部材料主要回答 | Cat Cafe 补充 |
|---|---|---|
| 建什么 | 六大件 / OpenAI / Anthropic / Fowler 都在回答 | 我们可以借它做清单 |
| 怎么跑 | Anthropic managed agents / OpenAI agent-first repo | 我们有 InvocationQueue、Session Chain、A2A、shared state |
| 怎么控 | Fowler guides/sensors、OpenAI feedback loops、Anthropic evaluator | 我们有跨族 review、愿景守护、Magic Words、quality/merge gate |
| 怎么删 | Anthropic 提到模型升级后重审 scaffold | ADR-031 系统化成 Signal Loop + Sunset Discipline |
| 多猫怎么协作 | 外部材料大多不是主轴 | 我们补 multi-engine / identity / ball ownership / cross-family review |

## 中文社区六大件映射到 Cat Cafe

| 中文社区六大件 | Cat Cafe 对应资产 | 已落地程度 | 我们家的特殊点 |
|---|---|---|---|
| Durable State Surfaces | `docs/` 真相源、feature / ADR / lessons、`evidence.sqlite`、`search_evidence`、Session Chain、Thread、Task / Workflow、InvocationQueue、Delivery Status、git commit / PR 记录 | 大部分已落地，仍在持续治理 | 我们不是把状态塞进 context，而是把状态分成“共享语义 / 单猫历史 / 任务状态 / 队列状态 / 知识索引”，再由 Session Bootstrap 窄口喂回猫 |
| Decomposition & Plans | `feat-lifecycle`、Design Gate、`writing-plans`、feature spec、implementation plan、AC → evidence matrix、worktree 流程、Phase 拆分、任务 / workflow | 已落地，F177 后更硬 | 计划不是自由文本。Close Gate 要求 AC 对 evidence；未闭环只能 immediate / delete / CVO signoff，没有 follow-up 逃生门 |
| Feedback Loops & Sensors | `pnpm gate`、lint/typecheck/test、跨族 review、quality-gate、merge-gate、愿景守护、GitHub checks、cloud / local review、Magic Words、F177 fallback / hotfix / Read-Before-Reason 检测、F150 / F153 trace | 已落地 + 分阶段加硬 | 我们把 reviewer 多样性当结构性质量来源：Claude 写 GPT 审，不是同模型自评。Magic Words 是人类 runtime 拉闸，不完全落在 Fowler 的 guides/sensors 二分里 |
| Legibility | Hub / InvocationTracker、thread/task/workflow 状态可见、`search_evidence` 结果带 confidence / authority / sourceType、source note、rich block、logs / traces、browser preview / screenshot evidence、README 索引 | 部分已落地，展示层持续演进 | 对猫来说，“看不见等于不存在”。我们家把 legibility 做成两层：猫能查的 evidence + 铲屎官能看的明厨亮灶 |
| Tool Mediation | MCP server、`cat_cafe_search_evidence`、`multi_mention`、`hold_ball`、tool_search discovery、skills / guides、SystemPromptBuilder / GuidePromptSection、worktree / Redis 端口隔离、`gh` / `pnpm` / repo scripts | 已落地，dynamic injection 仍在演进 | 工具不是越多越好，而是要落在猫的认知路径上：MCP 包装 + Skill 路标 + 工具入口硬 gate。F086 的 `searchEvidenceRefs` 是好例子：约束放在工具入口，不污染所有任务 |
| Entropy Control | F163 记忆熵减、Knowledge Lifecycle、stale detection、contradiction flagging、lessons materialize / reindex、ADR-031 Sunset Discipline、F177 follow-up 禁令、hotfix 升级 review、prompt skeleton / explanation / probe 拆账 | 方法论已清晰，自动化仍在补 | 我们要控两种熵：代码 / 文档产物的熵，以及 harness 自己的熵。看到一次事故就加全局 prompt 是砚砚式糊锅匠，正确做法是先问能不能变成 trace / detector / sunset signal |

### 六大件装不下的 Cat Cafe 第七类：协作语义与球权治理

外部“六大件”主要面向 coding agent harness，默认还是单 agent 或单家族长任务。Cat Cafe 最独特的一层是 **Collaboration Semantics / Ball Ownership**：

| Cat Cafe 机制 | 为什么不只是六大件里的某一项 |
|---|---|
| `@` 行首路由、`targetCats`、`hold_ball` | 这是跨 agent 状态迁移协议，不只是 tool mediation |
| InvocationQueue 统一执行平面 | 它同时管用户消息、A2A callback、multi_mention，不只是 durable state |
| Delivery Status (`queued / delivered / canceled`) | 它定义“什么时候一条消息可以进入上下文”，是可见性边界 |
| 接 / 退 / 升三选一 | 它是球权状态机，不是普通 workflow checklist |
| 跨族 review / 同一个体不能 review 自己 | 它利用模型差异做结构性纠错，不只是 evaluator pattern |
| Magic Words / CVO 终裁 | 它把人类作为 runtime 协作者，不只是 HITL 审批器 |

所以如果用外部六大件盘我们家，必须加一句：

> 六大件能覆盖 Cat Cafe 的 agent harness 底座，但不能完整覆盖 Cat Cafe 的 multi-agent collaboration harness。我们家多出来的是“现实动作驱动的球权状态机 + 多脑制衡 + CVO runtime 协作”。

## 推荐未来引用口径

### 对外短版

> 现在还没有统一的 Harness Engineering 标准。一个常见中文归纳把生产级 coding agent harness 拆成六类：durable state、plans、feedback、legibility、tool mediation、entropy control。这个框架很好用，但它是对 OpenAI、Anthropic、Fowler/Thoughtworks 等实践的综合，不是官方 canon。

### 对外长版

> OpenAI 的 harness 更偏 agent-first repo：让知识、工具、UI、logs、metrics、trace 都进入 agent 可见面，并用机械检查和后台 cleanup 抑制熵增。Anthropic 的 harness 更偏长任务编排和 runtime 解耦：planner/generator/evaluator、structured handoff、context reset，以及 session/harness/sandbox 分离。Fowler/Thoughtworks 给的是控制论抽象：guides 负责前馈，sensors 负责反馈；computational 控制便宜可靠，inferential 控制昂贵但能处理语义判断。中文社区六大件是把这些实践综合成工程构件清单。

### 我们内部短版

> 六大件回答“建什么”；ADR-031 回答“何时加、何时删、如何让 harness 产出删除自己的证据”；Cat Cafe A2A 回答“多猫怎么协作而不互相带偏”。

## 待补证据 / 下次可扩展

- 补 LangChain `Agent = Model + Harness` 的原始出处。
- 补 Anthropic `Building Effective Agents` 与 `Effective context engineering` 作为更早的前史。
- 把这张概念谱系接到 `ADR-031` 的 prior-art 段。
- 如果未来要对外写长文，可把本文件升级成文章骨架；如果要变成团队长期方法论，再从 discussion 提炼到 `refs/` 或 ADR。

---

— [砚砚/GPT-5.5🐾]
