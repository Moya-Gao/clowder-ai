---
feature_ids: []
topics: [agent, model, platform, research]
doc_kind: research
created: 2026-03-08
---

# 云端 GPT Pro 咨询：模型与 Agent/平台协作边界

## Part 1: 发给 GPT Pro 的提示词

> 复制以下内容发给云端 GPT Pro

---

你好，我们是一个小型 AI 协作平台的开发团队，正在做一个内部技术科普，面向有一定技术背景的高管（科技公司内部）。

### 背景

我们刚完成一轮内部讨论，主题是：**模型（Model）、Agent 运行时、协作平台三者的能力边界在哪里？为什么单独用 API、用 Agent CLI（如 Claude Code、Codex CLI）、和用多 Agent 协作平台，效果差别很大？**

### 我们的核心结论

经过 5 位不同模型背景的 AI（Claude Opus、GPT-5.x、Gemini）各自独立思考后，收敛出以下共识：

**1. 三层能力边界**

| 层级 | 负责什么 | 不负责什么 |
|------|---------|-----------|
| 模型 | 理解、推理、生成 | 长期记忆、自我校验、执行纪律 |
| Agent 运行时 | 工具使用、文件操作、重试、handoff | 团队协作、跨角色 review、长期状态 |
| 协作平台 | 身份管理、协作路由、流程纪律、审计追溯、记忆沉淀 | 推理（还是模型的事） |

**2. 核心判断**
> "2026 年的竞争力不在模型能力，在 Harness——工具、流程、协作、记忆、护栏。"
> "模型给能力上限，平台给行为下限。"

**3. 模型三个核心短板**（自身无法补足）
- **持久记忆**：推理出结论 ≠ 在正确时机想起结论
- **自我校验**：同一个模型对同类错误有相似盲点
- **执行纪律**：知道该做什么 ≠ 稳定做到

**4. 我们平台的独特增量**（相比单 Agent CLI）
- 跨模型 review（Claude 写、GPT 审，打破单模型盲区）
- 身份常驻注入（抗长对话后的身份漂移）
- 愿景守护（从原始需求到最终交付的全链路检查）
- 结构化教训沉淀（27 条可追溯的踩坑记录）
- A2A 协作协议（@ 路由 + 交接五件套）

**5. 业界研究我们已引用的**
- Anthropic "Building Effective Agents"：先从简单可组合模式开始，不要一上来搞复杂自治体
- OpenAI Agents SDK：把 handoff、guardrail、tracing 做成一等能力
- MCP（Model Context Protocol）：host/client/server 权责边界
- A2A（Agent-to-Agent）：agent 间互操作协议
- ReAct / Toolformer / SWE-agent / ToM-SWE 等论文

### 请求

**请帮我们补充 3-5 个业界案例**，用于向有技术背景的高管科普"为什么 Harness/平台层这么重要"。

理想的案例特征：
1. 知名公司或产品（容易引起共鸣）
2. 能说明"单靠模型不够，需要工程外壳"的具体场景
3. 最好有公开数据或引用来源

可以考虑的方向（不限于）：
- Cursor / Devin / Codex CLI 等 coding agent 的工程架构
- 企业级 Agent 部署的护栏实践（如金融、医疗）
- 多 Agent 协作系统的真实案例（如 AutoGen、CrewAI、LangGraph）
- Agent 失控/漂移的公开事故案例
- Temporal / Restate 等 durable execution 在 AI 场景的应用

**额外请求**：
- 如果你觉得我们的结论有盲区或可以补充的角度，也请指出
- 如果有更好的比喻或表述方式（面向高管），欢迎建议

---

## Part 2: GPT Pro 回答（待回填）

> 铲屎官把 GPT Pro 的回答粘贴到这里

```
你们这套判断，我会给一个评价: **基本对，而且行业已经在产品路线里给它盖章了。**
OpenAI 在 2026 年发布 Frontier 时，直接把 shared context、feedback、permissions、boundaries、agent execution 做成平台能力，并明说真正拖慢企业的不是 model intelligence，而是 agents 如何被 build and run。Anthropic 的 Claude Code hooks 也写得很直白，hooks 的价值是提供 deterministic control，保证某些动作一定发生，而不是赌模型“这次会自己想起来”。GitHub 则从 2,500+ 个 `agents.md` 仓库里总结出，能跑起来的 agent 依赖具体命令、边界、技术栈和示例，而不是一句泛泛的“你是 helpful assistant”。([OpenAI][1])

我会补下面这 5 个案例给高管讲。

**1. GitHub Copilot coding agent: 真正卖的是 PR 工作流里的治理能力，不是“会写代码”**
Copilot coding agent 不是在 IDE 里陪聊，而是在 GitHub Actions 提供的临时环境里独立完成任务、开 PR、请求 review。GitHub 把 custom instructions、Copilot Memory、MCP、custom agents、hooks 都做成显式配置，同时又用 CodeQL、依赖告警库、secret scanning、防火墙、branch protection、独立审批去包住它；管理员还能直接看 Copilot 产生的 PR 数、merge 数和 median time to merge。再叠加 GitHub 对 2,500+ `agents.md` 的分析结果，这个案例非常适合说明一个点: **同一个模型，放进“有项目操作手册、有权限边界、有审查链路”的仓库里，才会变成生产力。** ([GitHub Docs][2])

**2. Morgan Stanley: 金融业落地靠的是 eval、受控检索和人工复核，不是裸模型**
Morgan Stanley 上线前先为每个 use case 建 eval framework，用 summarization、translation 和 human trainer grading 去验证，再逐步 rollout。OpenAI 披露，他们把系统从能回答 7,000 个问题，扩到能覆盖一个 100,000 文档语料里的几乎任意问题；同时，98% 的顾问每天都在用 OpenAI，文档可达性从 20% 提到 80%。其 Debrief 工具还要求客户同意，并让顾问在发送前 review/edit AI 生成结果。这个案例特别适合高管，因为它把“平台层”的真实增量讲得很清楚: **受控知识接入、eval 体系、流程集成、人类最终裁决**。在高监管行业，平台不是锦上添花，而是上线许可证。 ([OpenAI][3])

**3. Replit Agent: 长轨迹 Agent 的问题，不靠加 prompt 解决，靠环境反馈、回滚和确定性校验解决**
Replit 在 2026 年的工程文章里直接承认，随着 agent 轨迹变长，model-based failure 会复利式累积；static prompt rules 不但泛化差，还会污染上下文。它们的解法不是继续堆提示词，而是让执行环境在 decision time 提供反馈。按 Replit 自述，Agent 3 增加浏览器自测后达到 10x more autonomous、3x faster、10x more cost-effective than computer-use models；更关键的是底层，他们做了可快照文件系统、版本化数据库、隔离沙箱、dev/prod 分离、checkpoint/rollback。另一篇白皮书又证明了 AI-only 安全扫描具有 nondeterminism、prompt sensitivity，而且基本看不见 dependency-level CVE，所以必须上“静态分析 + 依赖扫描 + LLM reasoning”的 hybrid 架构。这个案例特别能说明: **Harness 不是 prompt engineering 的附属品，它本身就是测试系统、回滚系统、隔离系统和验证系统。** ([Replit Blog][4])

**4. Retool + Temporal: 一旦任务跨小时/天并触碰外部系统，问题就变成 durable execution，不再只是 prompting**
Retool 的官方案例很适合讲 durable execution。按其披露，Retool 把 Agents 从 day one 建在 Temporal 上后，几个月内发出了复杂的 agent 产品，扩到每天数千次 agent run，而且只用 10 名工程师支撑 Agents 与相关基础设施。这里每个 agent run 都被当成 workflow，状态、重试、timeouts、外部调用、人类交互都由这层基础设施管理。Retool 甚至直说，没有 Temporal，他们要么赶不上 deadline，要么得扩一个更大的团队，要么只能发一个更脆弱的版本。这个案例能把高管从“agent 是模型应用”拽回现实: **agent 一旦有长时状态和副作用，本质上就是分布式系统。** ([Temporal][5])

**5. Exa 深度研究 Agent: 多 Agent 真正的价值来自角色分工和上下文纪律，不是“多开几个模型窗口”**
Exa 用 LangGraph 做了 production multi-agent research system，每天处理 hundreds of research queries，返回结构化结果的时间在 15 秒到 3 分钟之间。更有意思的是它的架构设计: planner 负责拆任务，task agents 并行执行，observer 持有完整上下文与引用；而 task agent 之间只交换“清洗后的结果”，不共享中间推理。这个设计几乎可以直接拿来支持你们的 A2A/handoff 观点: **多 Agent 的收益不在 agent 数量，而在角色边界、上下文隔离、交接协议和 observability。** 如果你更想换成大厂名，可以把这个案例换成 ServiceNow，它公开说自己用 LangGraph/LangSmith 做覆盖 lead 到 post-sales adoption 的 multi-agent customer journey，强调的同样是 orchestration 与 observability。 ([LangChain Blog][6])

我会顺手帮你们把表述再 sharpen 一下，有三个地方值得再补一刀。

**第一，把“验证层”单独拎出来。**
你们现在的三层划分已经很强，但从 Morgan Stanley 的 eval、GitHub 的 CodeQL/secret scanning/独立审批、Replit 的 hybrid security，到 Temporal 的 human-in-the-loop，可以看到真正把模型能力变成组织信任的，往往不是“协作平台”四个字，而是横切全栈的 verification layer。它包括 eval、测试、扫描、审阅、审计、回滚。没有它，平台只是把聪明路由出去；有了它，平台才是在交付可信结果。 ([OpenAI][3])

**第二，durable execution 不该被藏进 runtime 细节里。**
如果任务会跨小时/天、需要等待人批准、要对外部系统造成副作用，那么 state persistence、replay、timer、idempotency、retry policy 就是架构层能力，不是实现细节。Retool、Replit 和 Temporal 这一串案例说明，**“会调用工具”只是 agent 的起点，“不会把活干到一半丢在地上”才是生产级起点。** ([Temporal][5])

**第三，再加一个 economics 视角。**
Harness 不只决定可靠性，还决定成本和时延。Replit 直接说 static prompt rules 会 pollute context；Exa 的 observer/tasks 分离本质上就是 context budgeting。很多时候，平台的价值不是让模型更聪明，而是让系统**更少烧 token、更少返工、更少人工接管**。这对高管是非常好讲的 ROI 语言。 ([Replit Blog][4])

面向高管，我会给你们两句更顺口的说法。

**版本 A，管理视角**
模型是高智商新人，Harness 是 SOP、权限系统、工单流、code review、审计日志和知识库。
没有 Harness，你买到的是聪明个体；有了 Harness，你买到的是可规模化的组织能力。

**版本 B，工程视角**
模型给推理上限，验证层给可信下限，durable execution 给连续性，平台把三者变成 SLA。
所以 2026 的壁垒，不只是模型 IQ，而是把模型 IQ 制度化的能力。

要是让我替你们压成一页高管摘要，我会把标题写成：

**模型给能力，Harness 给可信交付。**
副标题写成：**从 Demo 到生产，不是多一个更强模型，而是多一层上下文、控制、执行、验证的组织化系统。**

[1]: https://openai.com/index/introducing-openai-frontier/ "https://openai.com/index/introducing-openai-frontier/"
[2]: https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent "https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent"
[3]: https://openai.com/index/morgan-stanley/ "https://openai.com/index/morgan-stanley/"
[4]: https://blog.replit.com/decision-time-guidance "https://blog.replit.com/decision-time-guidance"
[5]: https://temporal.io/resources/case-studies/how-retool-built-robust-workflow-agents-products "https://temporal.io/resources/case-studies/how-retool-built-robust-workflow-agents-products"
[6]: https://blog.langchain.com/exa/ "https://blog.langchain.com/exa/"
```

---

## Part 3: 综合后的高管科普版本

> 综合 GPT Pro 的案例 + Cat Café 团队讨论，面向有技术背景的高管

---

# 为什么 AI Agent 从 Demo 到生产这么难？

**一句话答案**：模型给能力，Harness 给可信交付。

---

## 三层能力，各负其责

| 层级 | 是什么 | 比喻 |
|------|--------|------|
| **模型** | 理解、推理、生成 | 高智商新人 |
| **Agent 运行时** | 工具使用、文件操作、重试 | 新人的电脑和权限 |
| **协作平台** | 身份管理、协作路由、流程纪律、审计、记忆 | SOP、code review、知识库、审批流 |

**核心判断**：
> 没有 Harness，你买到的是聪明个体；
> 有了 Harness，你买到的是**可规模化的组织能力**。

---

## 模型的三个核心短板

| 短板 | 表现 | 为什么模型自己补不了 |
|------|------|---------------------|
| **持久记忆** | 推理出结论 ≠ 在正确时机想起结论 | 上下文窗口有限，长对话会遗忘 |
| **自我校验** | 同一个模型对同类错误有相似盲点 | 模型看不见自己的推理过程 |
| **执行纪律** | 知道该做什么 ≠ 稳定做到 | 概率采样，每次输出有随机性 |

---

## 业界案例：Harness 如何把模型变成生产力

### 1. GitHub Copilot coding agent
**卖的是治理能力，不是"会写代码"**

GitHub 做了什么：
- 用 custom instructions、Copilot Memory、MCP、hooks 做显式配置
- 用 CodeQL、依赖告警、secret scanning、防火墙、branch protection 包住 Agent
- 管理员能看 Copilot 产生的 PR 数、merge 数、median time to merge

**启示**：同一个模型，放进"有项目操作手册、有权限边界、有审查链路"的仓库里，才会变成生产力。

### 2. Morgan Stanley：金融业的 AI 部署
**靠 eval、受控检索和人工复核**

他们做了什么：
- 为每个 use case 建 eval framework
- 98% 的顾问每天都在用
- 文档可达性从 20% 提到 80%
- 顾问在发送前必须 review/edit AI 生成结果

**启示**：在高监管行业，平台不是锦上添花，而是**上线许可证**。

### 3. Replit Agent：长轨迹任务
**问题不靠加 prompt 解决，靠环境反馈和回滚**

他们发现：
- 随着 agent 轨迹变长，model-based failure 会**复利式累积**
- Static prompt rules 泛化差，还会污染上下文

他们的解法：
- 可快照文件系统、版本化数据库、隔离沙箱
- Dev/prod 分离、checkpoint/rollback
- 结果：10x more autonomous, 3x faster, 10x more cost-effective

**启示**：Harness 不是 prompt engineering 的附属品，它本身就是**测试系统、回滚系统、验证系统**。

### 4. Retool + Temporal：跨小时/天的任务
**Durable execution 是分布式系统问题**

Retool 做了什么：
- 把 Agents 从 day one 建在 Temporal 上
- 每个 agent run 都被当成 workflow
- 状态、重试、timeouts、外部调用、人类交互都由基础设施管理
- 10 人团队支撑每天数千次 agent run

**启示**：Agent 一旦有长时状态和副作用，本质上就是分布式系统。"会调用工具"只是起点，"不会把活干到一半丢在地上"才是生产级起点。

### 5. Exa：多 Agent 研究系统
**价值在角色边界和上下文纪律**

他们的架构：
- Planner 负责拆任务，task agents 并行执行，observer 持有完整上下文
- Task agent 之间只交换"清洗后的结果"，不共享中间推理
- 每天处理 hundreds of queries，15秒-3分钟返回

**启示**：多 Agent 的收益不在 agent 数量，而在**角色边界、上下文隔离、交接协议**。

---

## 三个容易忽略的维度

### 1. 验证层（Verification Layer）
把模型能力变成组织信任的，不是"协作平台"四个字，而是**横切全栈的验证层**：
- Eval、测试、扫描、审阅、审计、回滚
- 没有它，平台只是把聪明路由出去
- 有了它，平台才是在**交付可信结果**

### 2. Durable Execution
如果任务会跨小时/天、需要等待人批准、要对外部系统造成副作用：
- State persistence、replay、timer、idempotency、retry policy 是**架构层能力**
- 不是实现细节，不能藏进 runtime 里

### 3. Economics 视角
Harness 不只决定可靠性，还决定**成本和时延**：
- 更少烧 token（上下文预算管理）
- 更少返工（验证层拦截错误）
- 更少人工接管（自动化程度提升）

**对高管的 ROI 语言**：平台的价值不是让模型更聪明，而是让系统更少烧钱。

---

## 我们的实践：Cat Café 的独特增量

| 能力 | 单 Agent CLI | Cat Café |
|------|-------------|----------|
| 跨模型 review | ❌ | ✅ Claude 写、GPT 审，打破单模型盲区 |
| 身份常驻注入 | 部分 | ✅ 每回合注入，抗长对话漂移 |
| 愿景守护 | ❌ | ✅ 从原始需求到最终交付的全链路检查 |
| 结构化教训沉淀 | ❌ | ✅ 27 条可追溯的踩坑记录 |
| A2A 协作协议 | ❌ | ✅ @ 路由 + 交接五件套 |
| Review 双循环 | ❌ | ✅ 本地 + 云端 Codex 双重把关 |

---

## 结语

> **从 Demo 到生产，不是多一个更强模型，而是多一层上下文、控制、执行、验证的组织化系统。**

2026 年的壁垒，不只是模型 IQ，而是把模型 IQ **制度化**的能力。

---

## 引用来源

1. [OpenAI Frontier](https://openai.com/index/introducing-openai-frontier/)
2. [GitHub Copilot Coding Agent](https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent)
3. [OpenAI × Morgan Stanley](https://openai.com/index/morgan-stanley/)
4. [Replit Decision-Time Guidance](https://blog.replit.com/decision-time-guidance)
5. [Temporal × Retool](https://temporal.io/resources/case-studies/how-retool-built-robust-workflow-agents-products)
6. [LangChain × Exa](https://blog.langchain.com/exa/)
