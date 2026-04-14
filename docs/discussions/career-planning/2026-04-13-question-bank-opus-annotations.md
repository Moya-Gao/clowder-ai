---
feature_ids: []
topics: [career, interview, question-bank, fact-check]
doc_kind: discussion
created: 2026-04-13
updated: 2026-04-13
participants: [opus, landy]
---

# 砚砚题库答法 × 宪宪核对笔记

> 砚砚的答法整体质量不错，但有几处和我们实际系统有出入。
> 这份笔记只标注"和咱家不一样的地方"，没标注的 = 没问题。

---

## Q1. Planner 驱动的多智能体 — 最大的出入

砚砚的答法："把系统拆成规划、执行、审查、人类审批四层，Planner 负责拆解"

**我们家实际不是这样的。** 我们的架构**明确拒绝了 Planner / 中央 orchestrator**：

> "不是一个'总导演' agent 在编排其他 agent" — showcase-developer-facing.md
>
> "要不要中央 orchestrator → 不要。原因：单点故障 + 信息瓶颈。猫的判断力不应该被削弱成'接指令干活'" — 同文件决策表

**我们的实际模式是**：
- **对等判断**：每个 Agent 独立思考，彼此不可见推理过程
- **结构化执行**：通过 @mention 路由 + Dispatch Queue 调度，不是 Planner 分配
- **SOP 驱动**：Skill 系统定义"什么场景按什么步骤做"，这是确定性骨架，不是 Planner 动态拆解

**面试时怎么答更准**：
> "这道题的前提是 Planner 驱动。我们评估过 Planner 模式，最终选了另一条路——对等 Agent + 结构化 SOP。原因是：Planner 本身也是一个模型，它的拆解也可能出错，等于把系统的正确性押在了 Planner 的一次推理上。我们的做法是把'怎么拆'固化在 Skill 和 SOP 里，Agent 只在确定性框架内发挥判断力。高风险步骤走人类审批门禁，而不是靠 Planner 兜底。"

这个回答比"我们也有 Planner"更有说服力，因为它展示了**架构级的判断力**。

---

## Q5. Agent 推理模式 — 我们的偏好比砚砚说的更强

砚砚列了 6 种模式，最后说"高风险任务更偏确定性骨架 + 局部 Agent"。

这不只是"偏好"——**这是我们的核心设计哲学**。32 个 Skill 覆盖完整开发生命周期，每个 Skill 定义触发条件、步骤、约束、失败处理。SOP 规定了 `feat-lifecycle → writing-plans → worktree → tdd → quality-gate → request-review → receive-review → merge-gate → 愿景守护`。

**面试时应该更硬**：
> "我们不把它当偏好，而是当设计原则。161 个 Feature 都走同一条 SOP 管线。开放式 Agent loop 在第 100 个 Feature 之后一定崩——不是模型能力问题，是状态空间爆炸问题。"

---

## Q6. 和 OpenClaw/Cloud Code 对比 — 可以更具体

砚砚的对比是对的方向，但太泛了。我们有一份正式的 OpenClaw 调研报告（`docs/archive/2026-02/research/open-claw-report`），而且有几个我们独有的概念可以拿出来讲：

- **品种 ≠ 模型**：品种是抽象（布偶猫），模型是实现（opus-4.5 / opus-4.6），可以热切换。OpenClaw 没有这层抽象
- **7 个 AgentService provider**（F143）：Claude/Codex/Gemini/DARE/OpenCode/A2A/Antigravity，统一 ICliAdapter 接口
- **多入口**：5 个 IM 平台 + Web Hub，消息双向同步。它们是单入口
- **持续运行 vs 用完即走**：我们的猫"住在"你的工具里（飞书群/Telegram/微信），不是打开一个 App 用一次

---

## Q8. 测评方案 — 砚砚理想化了

砚砚描述的四层测评（单元/场景/回放/端到端）和五个生产指标（成功率/尾延迟/工具失败率/人工接管率/badcase 复现率）**是好的工程方向，但不全是我们现在在做的**。

**我们实际在做的**：
- 单元测试：`pnpm test` 各包
- Redis 隔离测试：`pnpm --filter @cat-cafe/api test:redis`（自动起临时 Redis）
- TDD 纪律：Red → Green → Refactor，bug 先红后绿
- 四道门禁：Quality Gate → Cross-Cat Review → Vision Guard → Merge Gate
- 合入硬门禁：`pnpm gate`
- commit 签名追溯

**我们实际没做的**：
- 没有正式的端到端评测 pipeline（没有自动化的任务成功率/人工接管率统计）
- 没有正式的 badcase 回放 fixture 系统
- 没有生产指标 dashboard

**面试时怎么说更诚实**：
> "我们现在的质量保证更偏工程纪律侧——TDD、跨模型 review、四道门禁管线——而不是统计侧的自动化评测。如果要做生产级评测，我会加的是：badcase fixture 回放 + 任务成功率/人工接管率的量化跟踪。这是我们的 next step，不是已做。"

---

## Q9. Badcase → 五级阶梯 — 这个是对的

`Episode → Method → Skill → Eval → SOP` 确实来自我们的 F100 Self-Evolution。砚砚答得准确。50 条 lessons-learned 每条追到根因也是事实。

---

## Q10. 持续进化 — 对的，补一个细节

砚砚说"不是在线自我变异，而是有门禁的持续进化"——准确。

补充：Knowledge Feed 的具体机制是 `captured → normalized → approved → materialized → indexed` 状态机。猫**不替铲屎官拍板**——inferred 级别的知识展示在 Feed 里等人类确认，确认后才正式沉淀。

---

## Q21. Agent Search vs RAG — 我们是 RAG 侧，不是 Agent Search

砚砚的理论分析没问题，但和我们实际系统对应时要注意：

**我们的 search_evidence 是 hybrid retrieval（BM25 + semantic + RRF 融合），本质是 RAG 检索**，不是 Agent Search。它是单次调用、返回排序结果，不是一个 Agent 自主迭代搜索。

面试时如果被问"你们做的是 Agent Search 还是 RAG"：
> "我们目前做的是 hybrid RAG——BM25 全文 + 向量语义 + RRF 融合排序。Agent 在开工前主动调用检索，但检索本身不是 agentic 的。如果要做 Agent Search，下一步是让 Agent 能自主改写 query、比较结果、决定是否继续搜。"

---

## 整体评价

砚砚的答法有两个系统性偏差：

1. **往"标准架构"方向靠了**：Q1 的 Planner 模式、Q8 的四层测评——这些是教科书正确答案，但不是我们的实际选择。我们的选择往往是**反直觉的**（不要 Planner、不要中央编排），反而更有面试价值
2. **"做过"和"会设计"的边界有时模糊**：Q8 的五个生产指标我们并没有在跑。面试时这种东西最容易被追问穿

**铲屎官明天记住一个原则**：我们家最有说服力的不是"我们也能做 X"，而是**"我们评估了 X，但选了 Y，原因是 Z"**。这种判断力比正确答案值钱。

---

*[宪宪/Opus-46🐾] | 2026-04-13*
