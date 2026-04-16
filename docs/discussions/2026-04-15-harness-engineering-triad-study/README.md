---
topics: [harness-engineering, agent-runtime, context-engineering, managed-agents, multi-agent, coding-agents]
related_features: [F050, F070, F086, F102, F143, F149, F163]
related_decisions: [ADR-023, ADR-026]
doc_kind: discussion
created: 2026-04-15
participants: [opus, gpt52, gemini, landy]
---

# Harness Engineering 三篇套读

> 目的：把三篇高信号外部文章放进同一组讨论资产里，便于后续三猫继续补充，而不是把判断散落在聊天记录里。
>
> 套读对象：
> 1. OpenAI: [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
> 2. Anthropic: [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
> 3. Anthropic: [Scaling Managed Agents: Decoupling the brain from the hands](https://www.anthropic.com/engineering/managed-agents)

## 0. 放哪里，算什么

### 这组材料为什么放 `docs/discussions/`

因为它是**带时间戳的外部文章套读 + 我们的立场收敛**，不是稳定的长期方法论手册。

- **discussion**：适合记录“看了什么、怎么理解、达成了哪些判断、哪些还没拍板”
- **ref**：更适合放稳定模板、写法规范、长期可复用的方法论

结论：**这组先算 discussion，不算 ref。**

如果以后我们把这里的共识沉淀成稳定规则，例如：
- 多引擎 harness 的设计原则
- 弱模型/强模型分层的运行契约
- 会话/执行/权限的统一抽象

那时再升格为 ADR、lesson 或 `refs/` 更合适。

## 1. 当前家里已有资产

这三篇里，**`Scaling Managed Agents` 已经有完整 study session**：

- [docs/discussions/2026-04-08-managed-agents-study/README.md](/Users/lysander/projects/relay-station/cat-cafe/docs/discussions/2026-04-08-managed-agents-study/README.md)
- [docs/decisions/026-agent-runtime-operational-boundaries.md](/Users/lysander/projects/relay-station/cat-cafe/docs/decisions/026-agent-runtime-operational-boundaries.md)

缺的是把它和另外两篇放进**同一个 harness engineering 语境**里统一比较。所以这份目录不是替代 `managed-agents-study`，而是做它的上层总览。

## 2. 三篇文章各自说了什么

| 文章 | 时间 | 核心命题 | 它眼里的 harness 是什么 |
|------|------|----------|--------------------------|
| OpenAI — Harness engineering | 2026-02-11 | 人类不再主要写代码，而是设计环境、意图表达和反馈回路 | **repo-centered scaffolding**：知识、lint、CI、评测、清理机制、agent legibility |
| Anthropic — Harness design for long-running application development | 2026-03-24 | 长任务性能不只是模型问题，要靠结构化分工、context reset、独立 evaluator | **task-centered orchestration**：planner / generator / evaluator + handoff artifact |
| Anthropic — Scaling Managed Agents | 本地 study 记录为 2026-04-09；源站当前无明显可见发布日期 | harness 假设会过时，所以要把 session / harness / sandbox 解耦成稳定接口 | **runtime-centered interfaces**：session log、wake/resume、brain/hands separation、credential isolation |

## 3. 我们和他们的共识

### 共识 1：`Harness > Model`

三家都在往同一个方向推：

- OpenAI 说，真正稀缺的是人类时间和注意力，工程工作的重心正在转到“系统、脚手、反馈回路”。
- Anthropic 说，长任务效果明显受 harness design 影响，而且模型变强后，原来有效的 harness 组件会失效或变成 dead weight。
- 我们在 2026-03-02 对 DARE 的反馈里也已经写过：企业级 agent 的 table stakes 不再是“模型更聪明”，而是“默认有状态、可审计、可审批、可恢复、可回放”。

这点是**强共识**，不是口味差异。

## 共识 2：context 不是“多塞点 token”，而是工程对象

- OpenAI 把 `AGENTS.md` 从百科全书降格成目录，把结构化 `docs/` 当系统记录。
- Anthropic 在 long-running 那篇里强调 context reset、structured handoff、独立 evaluator。
- 我们自己的 Phase 5 / F102 / evidence 搜索链路，本质上也是把 context assembly 从聊天技巧变成系统能力。

### 共识 3：评估和执行要分层

- Anthropic 最明确：generator 和 evaluator 要分开。
- OpenAI 也把 review、validation、cleanup、quality grading 外置成持续回路。
- 我们的“同一个体不能 review 自己”的铁律，本质上也是同一逻辑：**做事的和判定的不能完全重叠。**

### 共识 4：人类仍在环，但抽象层上移了

- OpenAI：Humans steer. Agents execute.
- Anthropic：人类不必写每一行，但要设计 harness、判断何时 reset、何时拆 agent。
- 我们：CVO 不写代码细节，但拍方向、拍边界、拍高风险动作。

这不是“无人化”，而是**把人从直接执行层挪到约束/验收/判断层**。

## 4. OpenAI、Anthropic、我们家的关键分歧

### 分歧 1：问题域不同

| 对象 | 主要问题 |
|------|----------|
| OpenAI | 怎么把一个 repo 做成 agent-first，提升吞吐并控制漂移 |
| Anthropic Harness Design | 怎么让单次长任务跑更稳、更久、更能自评 |
| Anthropic Managed Agents | 怎么把 agent runtime 拆成稳定接口，降低实现耦合和运维成本 |
| 我们 | 怎么让**多引擎、多身份、多家族**长期协作，还能 review、handoff、守规矩 |

所以严格说，**我们和他们不是同题竞争**。

OpenAI / Anthropic 重点是：
- 单模型或单家族 agent 如何更强
- 单个 runtime 如何更稳

我们重点是：
- 异构 agent 如何协作
- 判断权如何分布
- 守规矩、记住历史、交接 baton 的机制怎么做

### 分歧 2：他们大多是单引擎/单家族视角，我们是多引擎视角

OpenAI 这篇虽然在文中提到了其他 agent 一起工作，但整体还是 **Codex-first** 的 agent-first repo 工程。

Anthropic 两篇更明显：
- harness design 默认是 Claude 体系内多 agent
- managed agents 也是 Claude Platform 的 hosted runtime

而我们从第一天就不是单引擎问题。我们的难点多了四层：

1. **身份契约**
2. **跨引擎共享规则**
3. **跨引擎 review 与 handoff**
4. **弱模型/强模型混跑的脚手差异**

这也是为什么我们在给 DARE 的反馈里强调：**多 agent 场景先要解决 identity / collaboration / handoff，不只是 session / event / checkpoint。**

### 分歧 3：Anthropic 在执行隔离上比我们更硬

这是我认为最值得我们正视的差距。

`Scaling Managed Agents` 的核心不是“brain / hands / session”这个名词本身，而是他们把下面几件事做成了**基础设施边界**：

- harness 离开容器
- session 外部化
- crash 后靠 `wake(sessionId)` 恢复
- sandbox 当 cattle 而不是 pet
- credentials 做物理隔离，不靠“希望模型别碰”

我们在抽象哲学上是同路的，见：
- [docs/decisions/026-agent-runtime-operational-boundaries.md](/Users/lysander/projects/relay-station/cat-cafe/docs/decisions/026-agent-runtime-operational-boundaries.md)
- [docs/discussions/2026-04-08-managed-agents-study/README.md](/Users/lysander/projects/relay-station/cat-cafe/docs/discussions/2026-04-08-managed-agents-study/README.md)

但在**硬隔离落地程度**上，目前他们更成熟，我们更像“方向已定、局部到位”。

### 分歧 4：OpenAI 在 repo legibility / doc-as-system-of-record 上比我们更激进

OpenAI 文章最强的一点，是把“仓库知识是系统记录”从口号做到日常工程：

- `AGENTS.md` 只做目录
- `docs/` 才是真正的知识库
- 有 linters / CI / doc-gardening agent 持续清理漂移
- 连“golden principles”都编码进 repo，作为持续垃圾回收的一部分

我们在理念上高度一致，甚至很多地方已经走在同一路上：

- `shared-rules.md`
- feature docs / ADR / lessons / session chain
- evidence search
- governance pack / preflight gate

但如果只看“把文档当作 agent system of record，并做机械校验”的完成度，**OpenAI 这篇展示得更极致、更工程化**。

### 分歧 5：我们比他们更重视“多脑判断”，他们比我们更重视“单脑执行壳”

Anthropic 和 OpenAI 都在强化一个 agent 或一类 agent 的执行可靠性。

我们则更重视：
- 不同猫之间的认知差异
- 对等判断，而非 boss agent 一统天下
- 跨家族 review
- 独立思考避免锚定

这意味着我们的问题不只是“怎么让 agent 更稳”，还是“怎么让 agent 之间不会互相带偏”。这个问题在 `Scaling Managed Agents` 里几乎没被展开，在我们这里却是核心。

## 5. 我判断我们家的方向是不是和他们一致

### 结论：**大方向一致，但侧重点不同；问题域部分重叠，不完全相同。**

**一致的地方**

1. 都认为 harness 是核心杠杆，不再把模型当全部答案。
2. 都把上下文、知识、评估、反馈、恢复当成工程对象。
3. 都承认 harness 不是写一份 prompt 就结束，而是要持续演化。
4. 都在把“人类写代码”迁移成“人类设计约束、验收结果、维护脚手”。

**不同的地方**

1. OpenAI 更像 **agent-first repo engineering**
2. Anthropic Harness Design 更像 **long-task orchestration engineering**
3. Anthropic Managed Agents 更像 **runtime interface engineering**
4. 我们更像 **multi-engine collaboration engineering**

我的判断是：**我们不是逆着趋势走，而是在主趋势上多做了一层。**

他们解决的是“一个聪明 agent 怎么跑得更稳”；  
我们解决的是“多只不同的猫怎么长期一起干活，还不把家搞乱”。

## 6. 我们当前最清楚的短板

如果按这三篇文章来照镜子，我认为我们最该补的不是理念，而是这三类硬度：

### 6.1 结构隔离硬度

我们已经有 governance / permission / shared rules，但离 Anthropic 那种“凭证物理不可达、sandbox/harness/session 明确解耦”的级别还有差距。

### 6.2 runtime 事件语义硬度

ADR-026 已经开始补 Event API、typed body、causal parents、authority/effect isolation，但还在 draft 收敛期。

### 6.3 repo-native 治理硬度

我们已经把很多知识沉进 repo 了，但如果要接近 OpenAI 那种 agent-first repo 形态，还需要更机械化的：

- doc freshness 检查
- cross-link / ownership / drift lint
- background cleanup / gardening
- 对“过期规则”和“无效说明”的持续清理

## 7. 下一步建议

### 文档归档层

这套三篇套读现在已经有了总目录。后续建议：

1. 布偶猫补“OpenAI 文章对 repo 治理和 throughput 的启发”
2. 我补“我们和 Anthropic 在 runtime/isolation 侧的差距清单”
3. 烁烁补“Anthropic generator/evaluator 对审美与体验工作的启发”

### 工程决策层

如果要把这轮讨论继续推进到架构决策，我建议下一步不是再写一篇感想，而是开一个 ADR 或 feature 讨论，专门回答：

1. 我们是否要把 `session / harness / sandbox` 的边界继续硬化？
2. 我们是否要把 repo-native doc gardening / knowledge lint 提升为正式能力？
3. 我们是否要为弱模型/强模型分层定义 execution profile？

## 8. Round 2: 过拟合命题 × 记忆熵减

铲屎官在讨论中提出了一个更深层的命题：**AI 应用的有效价值本质上是对使用者个体思维的过拟合**。三猫围绕这个命题展开了独立思考，并收敛到一个共同公式：

> **Harness 长期价值 = 对用户决策边界的拟合精度 × 知识压缩后的信噪比**

详见 → [round2-overfitting-and-entropy.md](./round2-overfitting-and-entropy.md)

潜在 Feature 方向：F102（记忆基础设施）→ F152（记忆可移植性）→ **F163（记忆熵减 / 知识生命周期治理）**（已立项）

## 8.5 Round 3: Research Prompt 设计 × 引导式过拟合

铲屎官在 F163 立项后指出"讨论完不能少了 research pipeline"，并追问两个更深层的问题：
1. 如何设计 research agent 的提示词来激发调研潜能？
2. 记忆系统如何引导新铲屎官"养好自己的猫"？

铲屎官确认了三段式主战场框架：

> 记忆怎么减（F163）→ 记忆怎么长对（过拟合精度）→ 过拟合怎么引导（养猫路径）

详见 → [round3-research-prompt-and-guided-overfitting.md](./round3-research-prompt-and-guided-overfitting.md)

## 9. 附：本目录包含的文件

- `README.md`：三篇套读总览 + 我们的判断（Round 1）
- `round2-overfitting-and-entropy.md`：过拟合命题 + 记忆熵减讨论收敛（Round 2）
- `round3-research-prompt-and-guided-overfitting.md`：Research Prompt 设计 + 引导式过拟合（Round 3）
- `sources/openai-harness-engineering.md`：OpenAI 文章 source note
- `sources/anthropic-harness-design-long-running-apps.md`：Anthropic 文章 source note
- `sources/anthropic-scaling-managed-agents.md`：Managed Agents 套读入口 note
- `sources/*.full.md`：烁烁抓取的文章详细摘要
- `docs/discussions/2026-04-08-managed-agents-study/README.md`：既有 managed agents 深读，不重复搬运
