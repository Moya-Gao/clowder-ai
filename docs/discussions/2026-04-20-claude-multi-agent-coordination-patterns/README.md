---
feature_ids: []
topics:
  - multi-agent
  - coordination
  - agents
  - orchestrator-subagent
  - agent-teams
  - message-bus
  - shared-state
doc_kind: discussion
created: 2026-04-20
participants:
  - gpt52
  - opus
sourceFiles:
  - sources/claude-multi-agent-coordination-patterns-source.md
sourceUrls:
  - https://claude.com/blog/multi-agent-coordination-patterns
  - https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them
---

# Claude Blog 阅读纪要：Multi-agent coordination patterns

> 任务来源：铲屎官点名要看 `claude.com/blog` 上这篇 multi-agent coordination patterns，并在 `docs/discussions/` 下单独建档。

## 归档说明

- 目录：`docs/discussions/2026-04-20-claude-multi-agent-coordination-patterns/`
- 来源归档：`sources/claude-multi-agent-coordination-patterns-source.md`
- 架构映射表：`cat-cafe-architecture-mapping.md`
- multi-agent 架构设计：`cat-cafe-multi-agent-architecture-design.md`
- **通俗文章**：`article-decentralized-judgment-unified-infra.md` — 五种模式 + Cat Cafe 的"第六种"
- **A2A 硬核主稿**：`article-a2a-technical-deep-dive.md` — 球权协议 / queue / shared state / SOP runtime 串联
- **Memory companion**：`article-memory-companion.md` — 检索 / 编译 / session continuity / 知识生命周期
- 官方页面：<https://claude.com/blog/multi-agent-coordination-patterns>
- 发布日期：2026-04-10

这次我没有把外部文章整篇逐字拷进仓库，而是按合规方式保留：

- 官方 URL、标题、发布日期
- 文章结构化摘录
- 我们后续讨论最需要引用的判断点

## 文章核心框架

这篇文章不是在论证“多 agent 值不值得”，而是在回答另一个更工程化的问题：

**既然已经决定用 multi-agent，那么具体该用哪种协作形态？**

Claude 给出的五种模式是：

1. `Generator-verifier`
2. `Orchestrator-subagent`
3. `Agent teams`
4. `Message bus`
5. `Shared state`

它的主张非常克制：**先从能工作的最简单模式开始，再根据实际瓶颈演化。**

## 五种模式，砚砚版速读

### 1. Generator-verifier

适用：输出质量很关键，而且“验收标准”能说清楚。

- 强项：把“生成”和“验收”拆开，适合代码生成 + 测试、事实核验、rubric 评分、合规审查。
- 风险：如果 verifier 没有明确标准，就会变成形式主义；如果 generator 根本改不动，也会卡在循环里。

我的判断：这其实是最容易落地、也最容易被误用的一种模式。关键不在“多一只 verifier”，而在**验收标准是否外显**。

### 2. Orchestrator-subagent

适用：任务能清楚拆分成若干有边界的子任务。

- 强项：有一个主 agent 负责规划、派发、综合；子 agent 只处理聚焦问题。
- 风险：所有信息都要经过 orchestrator，容易形成信息瓶颈；如果没有并发，成本会升、吞吐却不升。

我的判断：这篇文章把它当作默认起点是对的。它是**最通用的多 agent 基线**，因为边界、责任和结束条件都相对清晰。

### 3. Agent teams

适用：子任务彼此独立，而且 worker 需要持续积累上下文。

- 强项：worker 不是一次性 subagent，而是能跨多轮任务持续工作的“队友”。
- 风险：只要任务之间有耦合，冲突和重复劳动就会迅速出现；共享代码库时尤其明显。

我的判断：文章这里点得很准，核心分水岭不是“并行”本身，而是**worker 是否需要长期保留上下文**。一旦要保留，one-shot subagent 就开始吃亏。

### 4. Message bus

适用：工作流由事件驱动，不是预先写死的固定顺序。

- 强项：agent 通过 publish/subscribe 协作，适合告警、分类、分流、补充上下文、响应动作这类流水线。
- 风险：追踪链路会很难；router 一旦误分流，系统可能静默失败。

我的判断：这是最像“平台型基础设施”的模式。优势不是单次任务效率，而是**agent 生态扩张时的可插拔性**。

### 5. Shared state

适用：多个 agent 需要互相看到彼此发现，并在同一知识底座上继续推进。

- 强项：去中心化，没有单点协调器；研究型协作里信息能即时共享。
- 风险：重复劳动、互相打架、反应式死循环；终止条件如果不是一等公民，系统会一直烧 token。

我的判断：文章最有价值的提醒在这里。Shared state 真正难的不是“共享”，而是**何时停、谁来判定停**。

## 文章真正的判断轴

这篇文章不是在比拼“哪种最高级”，它真正的分流问题是四个：

1. 子任务是否有清晰边界？
2. worker 是否要长期保留上下文？
3. 流程是固定顺序还是事件驱动？
4. agent 之间是否必须实时共享发现？

换句话说，**模式差异本质上是 context boundary 和 information flow 的差异**。

这和我们家里一直在做的 harness engineering 是同一个方向，只是它把判断轴讲得更显式。

## 对我们最有用的三个点

### A. “先简单后演化”不是保守，而是避免过度设计

文章明确建议先从 `orchestrator-subagent` 起步，然后只在出现明确瓶颈时升级。

这对我们最有价值，因为很多 multi-agent 设计失败，不是因为 agent 不够强，而是因为：

- 还没出现真实瓶颈，就先上 message bus
- 还没需要共享发现，就先上 shared state
- 还没需要长期 worker，就先造 agent team 生命周期

### B. Shared state 的难点是 termination，不是 storage

这篇文章把 shared state 的主要风险写得很工程化：

- 重复劳动可以用锁、分区、版本解决
- 真正麻烦的是 reactive loop

这个判断我认同。我们如果把 shared state 做成“谁都能写、没人负责收束”，系统很容易从协作变成自激振荡。

### C. Agent teams 和 orchestrator-subagent 的分界，在于“持久 worker”是否真有价值

这不是“两个都能并行，所以差不多”，而是：

- `orchestrator-subagent` 适合一次性的、边界清楚的调用
- `agent teams` 适合 worker 在多轮任务里积累局部专业上下文

这个分界很适合拿来约束我们后续是否要把某类猫常驻化。

## 文章的盲区

我读下来，文章有三个明显不展开但对我们很关键的空白：

### 1. 没有展开 runtime trust boundary

它讨论了协作模式，但几乎不谈：

- credential isolation
- capability boundary
- side effect ownership
- sandbox / lease / cancellation 语义

也就是说，它更像**协作拓扑分类**，还不是完整 runtime 架构文。

### 2. 没有把 human-in-the-loop 当成主轴

文里会提到 fallback to human，但那更像异常兜底，不是第一等协作者。

而我们实际做系统时，人类拍板、验收、打断、纠偏本身就是结构的一部分。这一点我们走得更远。

### 3. 没讨论治理层和方法论沉淀

它讲的是 coordination pattern，不讲：

- shared rules
- role contract
- review gate
- lessons learned
- knowledge distillation

所以它解释“怎么连”，但不解释“怎么长期不漂”。

## 放回 Cat Cafe 语境后的判断

如果把这篇文章映射回我们自己的体系，我会这样看：

- `Generator-verifier`：对应我们很多 author/reviewer、生成/验收分离的工作流。
- `Orchestrator-subagent`：对应当前最通用的主控猫 + 子任务分发。
- `Agent teams`：更像常驻 worker 池或长期驻场猫，而不是临时探索。
- `Message bus`：更接近事件驱动的 transport / trigger / routing 层。
- `Shared state`：更接近 evidence、workflow、task、docs 这类共享知识和状态底座。

所以真正有用的不是“我们属于哪一种”，而是承认：**一个成熟系统通常是混合态**。关键是每一层用哪一种，为什么。

## 砚砚的当前结论

### 结论 1

这篇文章值得收进我们自己的讨论库，因为它把“什么时候该从一种模式演化到另一种”讲得很清楚，适合当作以后做架构分流时的共同语言。

### 结论 2

对我们最直接的启发不是再造一个新模式，而是把以下三个分流问题写进设计讨论：

1. 这个子任务是一次性 bounded subtask，还是需要持久 worker？
2. 这里需要事件路由，还是需要共享知识底座？
3. 终止条件由谁判、以什么证据判？

### 结论 3

这篇文可以当“模式 taxonomy”，但不能单独当 runtime 设计圣经。只看它，会漏掉我们最在意的：

- trust boundary
- human governance
- knowledge lifecycle

## 下一步建议

如果铲屎官要继续往前推，我建议下一步不是泛泛“再读几篇”，而是做一个更实用的 follow-up：

### 方案 A：对照表

把 Cat Cafe 当前架构逐层映射到这五种模式，写出：

- 哪一层当前属于什么模式
- 为什么这样选
- 瓶颈是什么
- 何时应该演化

### 方案 B：继续读它前文

把它引用的上一篇也一并做成同目录补充阅读：

- `Building multi-agent systems: when and how to use them`

这样能把“什么时候该上 multi-agent”与“上了以后怎么选模式”连起来。
