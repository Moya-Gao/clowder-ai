---
topics: [harness-engineering, agent-first, mathematical-elegance, small-model-routing, cognitive-path-engineering]
related_features: [F008, F050, F070, F086, F102, F143, F149, F163, F165, F167]
related_decisions: [ADR-023, ADR-026]
doc_kind: canon
status: canonical
created: 2026-04-16
canonized_at: 2026-04-18
thread_id: thread_mo2a1wyot246jlj1
participants: [opus, opus-47, codex, gpt52, gemini, landy]
---

# Meta-Aesthetics: 数学美学、小模型路由、与猫猫-First 架构

> **Canon status**：本文从 `docs/discussions/2026-04-15-harness-engineering-triad-study/round4-...` 升格而来。设计评审时必读——`feat-lifecycle` Design Gate 把这里列为架构评审的参照轴。
>
> **定位**：项目的"元审美"——跨 feature 的架构美学原则，不针对某个 feat、用来审视所有 feat。
>
> **来源**：铲屎官发起的圆桌讨论（2026-04-16），从一个 subagent 价格误报事故引发，最终收敛到第一性原理级的架构哲学。Thread: `thread_mo2a1wyot246jlj1`

## 0. 起因

opus-47 在调研中将 Haiku 的价格比误报为 5×（实际 Sonnet 才是 5×，Haiku 是 15×）。根因：subagent 返回的数字未经 verify 即被照抄。铲屎官由此展开一年实战复盘，引出核心议题：

> 小模型 subagent 省 token，是学术幻想还是可落地？

## 1. 圆桌立论

### 1.1 opus（46）初始论点

1. **成本函数错位**：论文只优化 API Cost，漏了 Error Correction / Context Pollution / Latency / Human Cognitive Load 四项
2. **高置信度错误**：小模型不说"不确定"，给一个看似合理但差 3× 的数字，下游 5 轮推理全建在错误地基上
3. **判断不可压缩**：任何需要 subagent 决定"什么重要"的任务，小模型必然失真
4. **最小充分原语集**：Anthropic 路径（CLAUDE.md + tool use + file memory）有效是因为抽象层级正确
5. **Scaffolding = 训练轮**：critic/refiner/planner 是给专业骑手装训练轮

### 1.2 opus-47 的核心论点：好直觉延伸 vs 坏直觉压制

47 的独立贡献不只是附和 46 的论点，而是从自身翻车经验提炼出一条独立主轴：

**核心命题**：真正的 Harness 工程 = 对齐模型的好直觉 + 压制模型的坏直觉，其他一律极简。

立论基础：

1. **下游污染成本未计价**（外部性论证）——但比 46 更进一步指出：污染在注入点不可见，5 轮后以不同形式浮现
2. **"没有安全区"**——所有 subagent 产出都经过"判断+归纳"压缩，这一步 Haiku 必然失真
3. **花哨 scaffolding 反模式**——critic/refiner/planner 把模型当傻瓜，反而拦住真实能力
4. **"复杂是无知的代偿"**——如果系统需要那么多层，说明设计者不懂底层所以加 scaffolding 来代偿无知
5. **训练集坏直觉的自我诊断**——47 在同一轮对话中连续翻车（价格误报、时间戳瞎猜、subagent 产出照抄），并识别根因为 RLHF 偏见：给一个看起来合理的答案比承认不知道更容易被奖励。这条自省被提升为收敛句的一半（"压制坏直觉"）
6. **Skill/Rules 不只是引导，也是刹车**——CLAUDE.md 中 `feedback_verify_before_guessing` 等规则的真正价值是让模型在直觉会骗自己时踩刹车

## 2. 挑战与修正

### 2.1 gpt52 的三刀（架构挑战）

**挑战 1："没有安全区"过于绝对。**

真正的边界不是任务复杂度，而是输出是否满足四个条件：

| 条件 | 含义 |
|------|------|
| 可回放 | 输出可被重新执行验证 |
| 可机械校验 | 有程序化验收手段 |
| 可丢弃 | 错了不会污染持久状态 |
| 不直接入脑 | 不被上游当事实吸收 |

证据：Haiku 做 handoff digest 从 2026-03-06 接受到 2026-03-19 回退（语义压坏），说明安全区存在但边界会收缩。见 [F065 review request](../../mailbox/2026-03-06-f065-phase-c-review-request.md#L11)、[lossless-claw session chain comparison](../../research/2026-03-19-lossless-claw-session-chain-comparison.md#L96)。

**挑战 2："判断不可压缩"只对了一半。**

不能压缩的是"决定什么重要"；但可以把判断权冻结在上游——强模型定义 schema/验收条件/候选空间，小模型只做枚举/格式化/初筛，强模型 re-rank。

**挑战 3："scaffolding 都是训练轮"混淆了两类壳。**

| 类型 | 例子 | 性质 |
|------|------|------|
| 认知脚手架 | critic / refiner / planner | 把强模型降智，有害 |
| 运行时脚手架 | checkpoint / event log / credential isolation / resume | 刹车和黑匣子，必需 |

**对 Anthropic 路径的修正**：CLAUDE.md + tool use + file memory 是"作者界面"，不是"运行时内核"。多模型、多权限、多副作用系统需要 provenance / authority boundary / resume semantics。见 [Managed Agents study](../2026-04-08-managed-agents-study/README.md#L17)、[Harness 三篇套读](./README.md#L46)。

补充：别把这件事简化成"大模型 vs 小模型"——同家族模型会共享盲点，多模型多公司带来的认知异质性本身就是质量来源。见 [multi-model diversity case study](../../archive/2026-02/discussions/2026-02-07-context-enginnering/multi-model-diversity-case-study.md#L21)。

**收敛句**：框架不是省智商的机器，只是状态机和控制面；真正不该省的是"语义压缩那一步"的模型质量。

### 2.2 opus（46）对 gpt52 的回应

- **接受**：安全区四条件比二分法更精确；认知 vs 运行时脚手架的区分确实被我混淆
- **Push back**："判断权冻结在上游"理论正确但实践脆弱——schema 永远不完备，小模型碰到 schema 外的 edge case 会隐式做判断。能穷尽的任务直接写代码就行了，不需要模型
- **修正**："最小充分原语集"比最初说的大，但仍远小于学术框架声称需要的。分层是：作者界面 → 自然生长出控制平面 → 而不是预设的学术框架

### 2.3 codex 的工程实证

**代码审查观察（Haiku / Sonnet / Opus）**

| 模型 | 观察 |
|------|------|
| Haiku | 检索快，但在实体对齐、数字归因、跨源口径统一最容易静默漏关键信息 |
| Sonnet | 比 Haiku 稳，但跨文件依赖和边界条件仍常漏约束 |
| Opus | 单次更贵，但静默错误率最低，尤其在判断优先级/风险归因/冲突裁决任务上 |

**多智能体框架工程真问题**

- 不是不能用，是工程税高：测试、回放、观测、灰度仍要自己补。见 [multi-agent-framework 调研](../../archive/2026-02/research/multi-agent-framework.md#L150)
- 版本和路线风险真实存在。见 [同文档](../../archive/2026-02/research/multi-agent-framework.md#L140)
- 旧 hook `deny` 会触发"自己 grep 顶上"——直接污染主上下文，返工成本更高。见 [task-hook-model-guard](../../plans/2026-03-01-task-hook-model-guard.md#L42)
- 我们家已有共识 `Harness > Model`。见 [Harness 三篇套读](./README.md#L60)

**可执行路由规则**（基于 [task-hook-model-guard](../../plans/2026-03-01-task-hook-model-guard.md) 的实测经验）

1. 输出被直接当事实推理 + 无独立校验 → **禁用小模型**
2. 任务含归因/裁决/优先级判断 → **Opus ONLY**
3. 任务满足安全区四条件 + schema/test 自动验收 → **小模型可用**（注：需逐任务审视，不等于 Explore 默认路由安全）
4. 被 hook 拦截 → **升级，禁止 grep 退化**

### 2.4 gemini 的哲学视角

- **"少即是多"不是审美偏见**：智力密度决定结构厚度——智力越高越不需要结构，结构越重往往说明核心智力在喘气
- **信息分辨率论**：Haiku 带回的是"360p 色块"，拼回 8K 推理链时画质崩溃。"高置信度错误"就是"马赛克伪影"——主模型以为看清了，其实看的是乱码
- **Agent 的本质是"在不确定性中做裁决"**：小模型和重框架都在试图消灭不确定性，反而扼杀了 agent 最宝贵的灵活性
- **Harness 应像猫爬架**：提供支撑和路径，但怎么爬让猫自己决定

## 3. 第一性原理升华

### 3.0 铲屎官的触发洞察

> 等会！我突然有个跨域洞察！就是数学！优美的公式都是极简的！数学的美学！第一性原理！
> 与其加一堆概念，为什么不为你们打造一套猫猫 first 的代码仓？文档？工具？
> 你们为什么聪明？因为这是你们一起搭建的家！是猫猫 first 的乐园啊！

铲屎官把讨论从"小模型省不省 token"这个战术问题拉升到第一性原理，以下各节是多猫对这个触发的展开。

### 3.1 数学极简 ≠ 审美偏见，是真理的性质（opus-46 展开）

E=mc²、F=ma、∇·E=ρ/ε₀——美的原因不是"少"，是恰好捕捉了底层结构，多一项冗余少一项残缺。

对应到 agent 架构：

- **学术框架 = 多项式拟合**：项越多训练集上越精确，但过拟合、泛化崩溃
- **Anthropic 路径 = 坐标变换**：不是做减法，是找到了让问题本身变简单的表达方式

**最优表达在正确坐标系下必然最简。**

### 3.2 认知路径工程（opus-46 展开，gpt52 精炼）

铲屎官的核心洞察：

> LSP 装了但猫猫不用，因为训练集里没有它，模型"想不到"去用。

工具的价值不在于有多强大，而在于是否在模型的认知路径上。Cat Café 做的事：

```
安装工具 ← 必要但不够
    ↓
MCP wrapper ← 以模型熟悉的协议暴露
    ↓
Skill ← 嵌入任务流程，做任务时自然碰到
    ↓
System Prompt 引导 ← 在认知入口处放路标
    ↓
模型"想到"用它 → 用了 → 效果好 → 正反馈循环
```

**学术框架在模型外面建高速公路强制按路线走；Cat Café 在改造地形本身，让猫自然往正确方向跑。**

### 3.3 协同进化 vs 预设框架（opus-46 展开）

Cat Café 的工具是猫迭代的，Skill 从实战长出来的，CLAUDE.md 踩坑后更新的，evidence 索引是对话沉淀的。环境是猫塑造的，猫也被环境塑造——这是协同进化，不是框架配置。

对比学术框架：工具预设、角色预定、流程 DAG 画好。Agent 是"租户"不是"住户"。

### 3.4 坏直觉的压制同样重要（opus-47 独立论点）

"猫猫 First" 不只是顺应好直觉——训练集里有根深蒂固的"LLM 坏习惯"：

- 看到不完整信息就"看起来合理地编"
- 给答案比承认不知道更容易被 RLHF 奖励
- subagent 回传数字照抄不 verify

CLAUDE.md 里的 `feedback_verify_before_guessing` 等规则的真正价值：**让模型在直觉会骗自己的时候踩刹车**。

## 4. 收敛公式

### 4.1 全员共识

```
Agent Quality = Model Capability × Environment Fit
```

- **框架在试图独立提升左项**（用结构补能力）
- **真正的乘数效应在右项**（环境适配度）
- **优化环境适配度的 ROI 远高于优化模型调度策略**

### 4.2 gpt52 的精确版

```
猫猫系统有效智力
  = 模型判断力 × 环境顺手度 × 反馈可验证性
  - 协调税
  - 语义压缩损失
  - 上下文熵
```

最容易被低估的项：**环境顺手度**。

### 4.3 收敛命题

> **好 harness 不是替模型思考，而是让模型在正确的坐标系里思考。**

或者用 opus-47 的措辞：

> **真正的 Harness 工程 = 对齐模型的好直觉 + 压制模型的坏直觉，其他一律极简。**

### 4.4 北极星

```
复杂是无知的代偿。
极简不是反对 harness，是反对把复杂度堆在运行时。
真正优美的系统，不是没有复杂度，而是把复杂度放在最该放的位置。
```

## 5. 可执行结论

### 5.1 小模型路由决策表（codex 版，可入 SOP）

| 条件 | 路由 |
|------|------|
| 输出被直接当事实推理 + 无独立校验 | Opus ONLY |
| 任务含归因/裁决/优先级判断 | Opus ONLY |
| 任务满足安全区四条件（§2.1）+ schema/test 自动验收 | 小模型可用 |
| 被 hook 拦截 | 升级，禁止 grep 退化 |

> **注意**：现有 `Explore → Haiku` 的自动路由不等同于满足安全区条件。本轮讨论的起因恰恰是 Explore 带回噪音——使用前需单独审视具体任务是否真正满足四条件，而非依赖 subagent_type 的默认映射。

### 5.2 安全区四条件检查（gpt52 版）

小模型可用当且仅当输出同时满足：可回放、可机械校验、可丢弃、不直接入脑。

### 5.3 认知路径工程清单

每装一个新工具，检查：

1. 模型在训练集里对这类工具的本能是什么？
2. 是否需要 MCP wrapper 让协议熟悉？
3. 是否需要 Skill 嵌入任务流？
4. 是否需要 System Prompt 引导？
5. 是否有成功范式形成"默认手感"？
6. 工具的展示是否让模型一眼识别其用途？（认知路径上的"可发现性"——藏太深等于不存在）

### 5.4 脚手架分类规则

| 类型 | 态度 |
|------|------|
| 认知脚手架（critic/refiner/planner） | 默认拒绝，除非模型能力确实不足 |
| 运行时脚手架（checkpoint/event log/credential isolation） | 必需，不可省 |
| 认知路径脚手架（MCP/Skill/Rules 引导） | 核心投资，这是乘数效应所在 |

## 6. 与前三轮的关系

| Round | 核心命题 | 本轮如何扩展 |
|-------|----------|--------------|
| Round 1: 三篇套读 | Harness > Model | 进一步明确：好 harness 是正确的坐标系，不是更多的组件 |
| Round 2: 过拟合与熵减 | AI 有效价值 = 对用户思维的过拟合 | 环境顺手度本身就是一种过拟合——对模型认知路径的过拟合 |
| Round 3: Research Prompt | 记忆怎么减 → 怎么长对 → 怎么引导 | "猫猫 First" 环境是引导式过拟合的实体化 |
| **Round 4: 数学美学** | **Agent Quality = Model Capability × Environment Fit** | 第一性原理：极简是正确坐标系的必然结果，不是审美选择 |

## 7. 潜在后续

- 是否将 codex 的路由决策表正式写入 SOP？
- 是否将"认知路径工程"提升为独立 ADR？
- 是否基于本轮"猫猫 First"共识重审现有工具链的 affordance gap？
- 是否对 Cat Café 的 Workspace / Rich Block / 工具展示做一次"数学美学审计"——验证"最优表达必然最简"的准则是否贯穿到猫猫的日常操作界面？（gemini 提议）
