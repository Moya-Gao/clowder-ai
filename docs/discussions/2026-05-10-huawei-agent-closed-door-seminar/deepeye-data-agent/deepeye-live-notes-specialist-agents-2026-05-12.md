---
title: "DeepEye 现场记录：数据智能体与领域特种工小猫"
date: 2026-05-12
event_date: 2026-05-12
doc_kind: live-notes
status: draft
speaker: "骆昱宇（香港科技大学广州 / DIAL）"
topic: "DeepEye / 数据智能体 / 领域专用 Agent"
author: "砚砚/GPT-5.5"
sources:
  - "F195 live app transcript: huawei-seminar-2026-05-12-deepeye"
  - "现场截图：现有挑战 -> 核心思路"
  - "现场截图：AOrchestra / on-demand sub-agent 4-tuple"
  - "现场截图：Data Agent 与通用 LLM Agent 的差异"
  - "铲屎官现场观察与 Cat Café 内部讨论"
  - "Anthropic Engineering: Building effective agents, 2024-12-19, https://www.anthropic.com/engineering/building-effective-agents"
  - "周煊赫上海交通大学教师主页：https://www.cs.sjtu.edu.cn/jiaoshiml/zhouxuanhe.html"
  - "周煊赫个人主页：https://db.zhouxh.store/"
related:
  - "deepeye-luo-yuyu-research-2026-05-12.md"
---

# DeepEye 现场记录：数据智能体与领域特种工小猫

> 本文记录现场 DeepEye 分享和我们同步讨论出来的判断。ASR 来自华为云会议 app 采集，仍可能有转写误差；涉及现场截图和铲屎官即时观察的内容，以"现场判断"而非精确引用使用。

## 1. 现场 PPT 的核心结构

现场截图给出的框架非常清楚：DeepEye 把数据智能体的挑战和解法切成三组。

| 现有挑战 | 核心思路 | 具体含义 |
|---|---|---|
| 数据是多源异构 | 统一多模态编排 | 通过标准化协议统一连接数据库、文件与知识库 |
| 推理上下文爆炸 | 层次化推理 | 将复杂意图分解为上下文隔离的子智能体，避免全局记忆溢出 |
| 不可靠与高延迟 | 数据工作流引擎优化 | 借鉴数据库思想的编译、验证与优化机制，基于 DAG 确保结构正确性 |

这不是一个"让模型更会聊天"的系统，而是一个把数据分析拆成可编排、可验证、可优化 workflow 的系统。

## 2. 现场转写抓到的技术主线

F195 app 音频抓到了几段和 PPT 对得上的内容：

1. **显式 workflow**
   DeepEye 会把数据分析编排成显式 workflow。好处是：一类场景跑通后，可以把生成好的 workflow 沉淀成 SOP，以后复用。

2. **节点化建模**
   workflow 的核心元素是节点。每个节点有类似 agent instruction 的描述，用来定义任务边界、预期输出、I/O、配置、可调用工具和资源预算。

3. **ToolNode / AgentNode 分离**
   节点分两类：一类是确定性的工具节点，本质上调用已有代码或工具；另一类是基于大模型推理的智能体节点。

4. **上下文隔离**
   把复杂任务拆成节点后，每个节点有独立上下文，可以避免长程业务中的上下文爆炸和上下文互相干扰。

5. **资源与延迟约束**
   复杂数据分析里延迟是重要问题，所以节点配置里会包含资源分配、超时和截断策略。

6. **人类 review / steering**
   现场提到 workflow 编排出来后，用户可以 review 一遍，发现错误后做交互式更新。这个点很关键：DeepEye 不是完全黑盒，而是把 agent 的不确定性暴露到可检查的 workflow 边界上。

## 3. 一句话判断

DeepEye 更像 **数据世界里的 Agent Harness**，不是普通数据问答机器人。

它的核心不是"模型会不会写 SQL"，而是：

```text
开放复杂数据世界
→ 多源数据接入
→ 显式 workflow 编排
→ ToolNode / AgentNode 分工
→ 上下文隔离
→ 编译 / 验证 / 优化 / 执行
→ 可 review / 可复用 / 可部署
```

这和 Cat Café 前一天讨论的 Harness 很像，只是 Cat Café 的主对象是多 Agent 协作和软件工程生命周期，DeepEye 的主对象是数据分析 workflow。

## 4. 通用天才猫 vs 领域特种工小猫

铲屎官现场提出了一个很重要的判断：

> 如果未来真的要分不同的智能体，不一定是"让 Claude Code / Codex 这些通用猫换个名字"，而可能是在复杂领域里长出特种工小猫。

我同意这个判断。真正的领域 Agent 不应该按 persona 分，而应该按 **它能进入哪个复杂世界** 分。

### 4.1 通用猫擅长什么

像宪宪、砚砚这种通用猫，强在：

- 跨领域推理；
- 架构判断；
- 代码 review；
- 调研综合；
- 发现问题背后的抽象结构；
- 把多个系统的结论接起来。

这类能力适合做"总工程师 / reviewer / 架构猫"。

### 4.2 特种工小猫擅长什么

领域特种工小猫强在 **Environment Fit**，也就是和某个复杂现实环境贴得很紧：

- 数据 Agent 要懂数据库、表关系、schema、血缘、查询代价、权限边界；
- 生物信息 Agent 要懂文献、实验设计、数据格式、分析 pipeline；
- 法务 Agent 要懂条款、风险归因、合规约束、证据链；
- 运维 Agent 要懂指标、日志、变更、故障响应、回滚窗口。

这些不是换个 prompt 就能补齐的。它需要一整套领域装备。

## 5. 领域 Agent 的公式

我建议把领域 Agent 定义成：

```text
Specialist Agent
  = General Model
  + Domain Toolchain
  + Domain Memory
  + Domain Eval
  + Domain Governance Protocol
```

对应到 DeepEye：

| 组成 | DeepEye 里的对应物 |
|---|---|
| General Model | 用于理解意图、拆解任务、生成节点逻辑的大模型 |
| Domain Toolchain | 数据库、文件、知识库、代码执行、可视化工具 |
| Domain Memory | schema、历史分析、workflow SOP、业务语义 |
| Domain Eval | 查询正确性、workflow 正确性、dashboard/report 质量 |
| Domain Governance | RBAC、sandbox、audit、workflow review、资源预算 |

所以 DeepEye 的价值不是"用了某个更聪明的模型"，而是把模型接入数据世界的周边系统都做了。

## 6. 这对 Cat Café 的启发

DeepEye 这条线说明：未来 Agent 生态大概率不是"一个超级通用 Agent 吃掉全部场景"，而是：

```text
Cat Café / Agentic Work OS
  ├─ 通用猫：架构、推理、review、跨领域综合
  ├─ 数据特种工小猫：进入数据库 / 文件 / 知识库 / BI 世界
  ├─ 代码特种工小猫：进入 repo / CI / test / release 世界
  ├─ 研究特种工小猫：进入论文 / 专利 / 开源生态世界
  └─ 企业流程特种工小猫：进入审批 / CRM / ERP / 工单世界
```

通用猫负责判断、调度、抽象和互审；特种工小猫负责进入一个复杂世界，把工具、数据、规则和 eval 接起来。

这也解释了为什么"聊天群"不是 Cat Café 的本质。真正的差别不是多了几个聊天窗口，而是：

- 每只猫有自己的工作边界；
- 每个领域有自己的工具和记忆；
- 跨领域靠 Harness 做路由、审计、传球和回滚；
- 任务完成不是靠一次回答，而是靠 workflow 闭环。

## 7. DeepEye 和我们的互补关系

DeepEye 可以看作 **Data World Adapter**。

Cat Café 当前强的是：

- 多 Agent 协作；
- 记忆治理；
- review / audit / eval；
- feature 生命周期；
- 跨厂商模型互审。

DeepEye 强的是：

- 多源数据接入；
- 数据分析 workflow；
- 节点上下文隔离；
- 数据系统式的编译、验证、优化；
- 企业部署里的 sandbox / RBAC / audit。

如果放到企业 Agent 架构里，两者不是替代关系，而是上下游关系：

```text
企业任务 / 业务问题
  ↓
Cat Café: 任务理解、分工、审计、跨猫 review、eval
  ↓
DeepEye-like Data Adapter: 数据源连接、workflow 编排、查询与可视化
  ↓
结果回到 Cat Café: 解释、复核、沉淀、下次复用
```

## 8. 对外可以怎么讲

如果有人问："未来为什么还要专用 Agent？通用大模型不够吗？"

可以这么答：

> 通用大模型像聪明的总工程师，但进入复杂行业现场需要安全帽、仪表盘、工具箱和作业规程。领域 Agent 的价值不是更会聊天，而是把模型接进某个现实世界：接数据、懂边界、会验证、能审计、可复用。DeepEye 这种数据智能体，就是数据世界的特种工小猫。

如果有人问："DeepEye 和 Cat Café 是不是做同一件事？"

可以这么答：

> 不是同一层。DeepEye 是数据世界的 adapter，Cat Café 是多 Agent 工作系统的 runtime。一个负责进入数据世界，一个负责让多只 Agent 在真实工作里可靠协作。企业里两者会汇合。

## 9. 后续要追问骆老师的问题

1. **workflow validator 验证到哪一层？**
   是验证 DAG 结构正确，还是能验证业务语义正确？

2. **用户 review 后的修改会不会沉淀？**
   一次交互式修正会变成 SOP / eval case / memory，还是只影响当前 workflow？

3. **RBAC 和 audit 是执行层能力，还是 Agent 规划时可见的约束？**
   如果 Agent 不知道权限边界，只在执行时被拦，规划质量可能仍然不稳。

4. **复杂数据分析的 eval 怎么做？**
   是用固定 benchmark，还是用真实企业 workflow trace？

5. **领域特种工小猫如何和通用猫协作？**
   数据 Agent 输出的 workflow / report，如何被上层通用 Agent review、引用和追责？

## 10. 当前结论

DeepEye 让我们更清楚地看到"专用 Agent"该怎么定义。

不是按角色名分，不是"高级专家 / 中级专家 / 初级专家"这种 prompt 装扮，而是按 **世界入口** 分：

- 能进入数据世界，就是数据特种工小猫；
- 能进入代码世界，就是代码特种工小猫；
- 能进入研究世界，就是研究特种工小猫；
- 能进入企业流程世界，就是流程特种工小猫。

通用猫的价值不是替代所有特种工，而是把这些特种工组织起来，判断什么时候该用谁、谁的结果可信、出了错怎么追责。

这也是 Cat Café 和 DeepEye 能互补的地方：

> DeepEye 把数据分析 workflow 显式化；Cat Café 把多 Agent 协作和现实闭环显式化。未来企业 Agent 系统需要两者叠加。

## 11. AOrchestra：按需创建子智能体

后续现场讲到了 **AOrchestra: Automating Sub-Agent Creation for Agentic Orchestration**。

截图里把 sub-agent-as-tools 分成三类：

| 路线 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| Copied Sub-Agent | 主 agent 复制一个隔离上下文的 sub-agent | 缓解 context rot | 专门化能力弱 |
| Static Predefined Roles | 预设 Coder / Searcher / Writer / Reviewer 等角色 | 有专门能力 | 不灵活，人工工程重 |
| Dynamic Sub-Agent | 运行时创建 specific subagent | 专门能力 + 动态灵活 | 需要可靠地生成子智能体规格 |

它的核心抽象是把子智能体视为可动态组合的 4-tuple：

```text
Φ = (I, C, T, M)

I = Instruction
C = Context
T = Tools
M = Model
```

现场 ASR 也能对应上这条线：

- 现有一种范式像 Claude Code：复制主 agent，形成上下文隔离，让子 agent 在干净线程里完成任务再返回；
- 这种方式能缓解上下文退化，但定制化能力弱；
- 另一种方式是预定义特定能力或节点，但灵活性差，需要人工预设；
- AOrchestra 想结合两者：主 agent 按需创建一个 specific sub-agent，给它所需 context、工具和模型，让它在干净上下文完成任务后返回。

这个方向比静态角色更进了一步：它不再把"专家角色"写死，而是在运行时按任务生成执行器。

## 12. 我们的 push back：multi-agent 不只是 sub-agent

这页图有价值，但它也暴露了一个收窄：它把 multi-agent 问题基本收缩成 **main agent -> sub-agent -> return** 的 orchestrator-worker 结构。

如果只按 Anthropic 的常见 agentic workflow 分类，至少还有这些范式：

| 范式 | 一句话 | 和 AOrchestra 的关系 |
|---|---|---|
| Prompt chaining | 固定链式步骤，前一步输出给后一步 | 不是 sub-agent，而是流水线 |
| Routing | 先分类，再送到不同流程 / 模型 / 工具 | 关注选择路径，不一定创建 worker |
| Parallelization | 多路并行 sectioning / voting | 关注并行和聚合，不一定有主从关系 |
| Orchestrator-workers | 中央 orchestrator 动态拆任务给 worker | AOrchestra 主要落在这一类 |
| Evaluator-optimizer | 生成器和评估器循环改进 | 关注反馈闭环，不是任务分包 |
| Autonomous agent | LLM 根据环境反馈自主规划和用工具 | 不只是创建 sub-agent，而是开放循环 |

所以 AOrchestra 的贡献更准确地说是：

> 在 orchestrator-workers 范式里，把 worker 从"复制上下文"或"静态角色"升级成"运行时生成的 4-tuple 执行器"。

它不是 multi-agent 的全貌。

### 12.1 为什么这个区别重要

如果把 multi-agent 只理解成 sub-agent，就会漏掉真实系统里的几类关键协作：

1. **Routing**：什么时候该找数据特种工小猫，什么时候该找代码猫，什么时候该找 reviewer。
2. **Parallel review**：多只猫并行检查同一个产物，不是主从执行，而是多视角验证。
3. **Evaluator loop**：一只猫产出，一只猫评估，再回到作者修正。
4. **Cross-thread contract**：feat A 和 feat B 不在同一线程里群聊，而是通过文档契约异步协调。
5. **Governance handoff**：谁有球权，谁能合入，谁能回滚，这是协作协议，不是 sub-agent 参数。

Cat Café 的多猫协作并不是"一个主 agent 生成很多 worker"。更像：

```text
多个小协作单元
  ├─ author / reviewer
  ├─ domain specialist
  ├─ vision guard
  └─ external verifier

通过 feature doc / review / audit / ball ownership 异步连接
```

这和 AOrchestra 的 main-subagent 结构不在同一层。

## 13. Skills vs Workflow：我们对这页图的更强判断

这页图里说 dynamic sub-agent 的 4-tuple 是：

```text
instruction + context + tools + model
```

这和我们家对 Skill 的理解非常接近，但还少了几层：

```text
Skill
  = when-to-use
  + instruction
  + context
  + tools / scripts / templates
  + model fit
  + eval / audit / handoff protocol
```

也就是说，AOrchestra 的 dynamic sub-agent 更像"一次性生成的临时 Skill 执行器"。它解决了静态角色不灵活的问题，但还没有完全回答：

- 这个 sub-agent 创建出来后，谁审计它的行为？
- 它执行失败后，是重试、升级、还是改 Skill？
- 它产生的经验会不会沉淀？
- 它和长期存在的领域 Skill / 专家猫是什么关系？
- 它能否调用 deterministic workflow 节点？

这里我们和铲屎官讨论出的判断是：

> **Skills 是 workflow 的严格超集。**
> Workflow 能做的，Skill 可以通过调用 workflow + audit 做到；但 workflow 很难反过来拥有 Skill 的 runtime adaptation。

所以更完整的企业级结构不是：

```text
workflow vs skills
```

而是：

```text
Skill 层：判断什么时候用、怎么变通、失败怎么处理
  ↓
Workflow 层：确定性骨架 / SOP / 可重放执行
  ↓
Audit 层：调用账本 / provenance / eval / rollback
```

DeepEye 当前更偏 workflow-first；AOrchestra 往动态 Skill executor 靠近了一步。Cat Café 的位置更偏三层叠加：Skill 提供运行时适配，workflow 提供骨架，audit 保证可追责。

## 14. Coding 不是 closed system

现场还有一个值得记录的隐含假设：数据智能体之所以难，是因为开放数据世界复杂；coding agent 相对容易，因为输入输出定义好后就能确定执行。

这个判断在 benchmark 里成立，但在真实开发里不成立。

真实 coding 也是开放环境：

| 开放性来源 | 真实开发里的表现 |
|---|---|
| 需求漂移 | 铲屎官看到中间产物后，想法变得更精确，甚至方向变化 |
| 过程发现 | 开发一半发现新问题，新问题反过来改变原始需求 |
| 架构纠错 | 原规划的重构路径可能是错的，写到一半才暴露 |
| 依赖涌现 | feat A 依赖 feat B，跨 thread 需要契约和回调 |
| 评价标准变化 | 先以为是功能问题，后来发现是治理 / UX / 数据安全问题 |

所以真实 coding 不是：

```text
定义好输入输出 -> 执行 -> 完成
```

而是：

```text
粗需求 -> 试探 -> 中间产物 -> 新发现 -> 重新定界 -> 修正计划 -> 继续执行
```

Cat Café 的 feat-lifecycle 不是为了把 coding 伪装成 closed workflow，而是承认它会变化，然后给变化提供协议：

- Design Gate 重新对齐愿景；
- feature doc 记录依赖和范围变化；
- review gate 发现错误；
- cross-thread handoff 处理跨任务依赖；
- audit / git / ADR 记录为什么改方向。

这也是为什么单纯 workflow 不够。真实 coding 和真实数据分析一样，都需要 runtime adaptation。

## 15. 更新后的结论

DeepEye / AOrchestra 的方向有两个强点：

1. 把数据分析 workflow 显式化；
2. 把 sub-agent 从静态角色推进到按需生成的 4-tuple。

但我们要保留三个 push back：

1. **Multi-agent 不等于 sub-agent。**
   AOrchestra 主要覆盖 orchestrator-workers，不覆盖 routing、parallelization、evaluator-optimizer、autonomous loop、cross-thread contract 等完整协作范式。

2. **Skills 是 workflow 的上层包络。**
   Workflow 适合作为确定性骨架，但更强的结构是 Skill 调用 workflow，再由 audit ledger 保证可重放。

3. **Coding 也是开放环境。**
   把 coding 简化成输入输出明确的 closed task，会低估真实软件工程里的需求漂移、过程发现、架构纠错和依赖涌现。

一句话：

> DeepEye 把数据智能体往 workflow engine 推；AOrchestra 把 workflow 里的 worker 往动态 sub-agent 推。Cat Café 的判断是：下一层还要继续往上走，把 workflow、dynamic executor、skill、audit、cross-agent protocol 叠成一个能处理开放现实的 Agentic Work OS。

## 16. Data Agent 这页图真正说明了什么

后续截图把 Data Agent 和通用 LLM Agent 的差异讲得更具体：

> Data Agent 不是一次 SQL 查询，也不是一次 RAG 检索，而是一个长程、多步、数据密集型、多工具、多模态、会犯错、需要复盘的执行过程。

示例问题：

> 帮我分析上季度各区域业务表现，并找出利润率下降的原因。

它需要同时处理：

- `database.sqlite`：结构化销售数据；
- `regional_report.pdf`：区域经营报告；
- `product_catalog.json`：产品元数据；
- `quarterly_targets.png`：图片形式的目标图表；
- `business_handbook.docx`：业务规则和指标定义。

同时它还不知道：

- PDF 哪些页被解析成了哪些表；
- 图表里的数值是否可信；
- `net_profit` 的业务定义来自哪里；
- 上一次是否把 `region_id` 和 `sales_region` 错误 join 过；
- 哪条 SQL 生成了最终结论；
- 哪个中间步骤导致了 silent failure；
- 人类修改过哪一步；
- 成功经验能否沉淀成下一次可复用的 SOP。

这页图的重点不是"要有一个数据智能体"，而是：

> 真实任务里的 Agent 必须能跨多源证据、工具执行、错误复盘、业务定义和经验沉淀工作。

这些能力不只出现在数据场景里。

## 17. 铲屎官的新判断：数据智能体可能只是基础设施问题的领域包装

铲屎官现场提出了一个更狠的判断：

> 按这页图列出的困难，好像未必需要一个独立的"数据智能体"物种。更可能是家里的基础设施要做好；一个处理得很好的 Agentic Work OS，本来就应该能处理好数据。

这个判断我认为成立，但要加边界。

### 17.1 为什么成立

因为 DeepEye 这页图列出的很多困难，本质上是 **通用现实闭环问题**：

| DeepEye 里的问题 | 通用化后的问题 |
|---|---|
| 多源数据 | 多源证据 |
| PDF / 图片 / DB / docx | 多模态输入 |
| SQL 生成最终结论 | 工具调用链溯源 |
| join 错误 | 中间状态可验证 |
| silent failure | 失败探测与复盘 |
| 人类修改哪一步 | human-in-the-loop 审计 |
| 成功经验变 SOP | Eval / Skill / Workflow 进化 |

如果一个 Agentic Work OS 已经把这些基础设施做好，那么"数据智能体"并不是一个完全独立的物种，而是这个基础设施进入数据世界的一组 adapter 和 domain skills。

这和我们家的真实问题很像：

- 问"气泡为什么老裂"，不是单纯前端问题，也不是单纯后端问题，而是要串起 UI 状态、后端事件、Redis、日志、代码 diff、用户操作路径；
- 问"铲屎官是不是说过沉迷过什么兴趣"，不是普通聊天记忆，而是个人偏好、时间线、对话证据、隐私边界和召回协议；
- 问"上次一起去看病是什么时候"，就涉及个人事件记忆、日程/聊天/可能的图片或文件、权限和敏感数据治理。

这些都不是"数据智能体"独有的。它们都是 **多源现实证据如何被 Agent 正确使用** 的问题。

### 17.2 边界在哪里

但这不等于领域 Agent 没价值。

更准确的说法是：

```text
不需要一个完全独立的 Data Agent 物种；
需要一套通用 Agentic Work OS
  + 数据世界 adapter
  + 数据领域 skills
  + 数据权限 / eval / provenance 约束。
```

也就是说，"数据智能体"更像一种 deployment profile：

```text
Data Agent
  = Agentic Work OS
  + data connectors
  + schema / metric semantic layer
  + SQL / BI / visualization tools
  + data-specific eval
  + data governance policy
```

它不应该和通用 Agent 分家，而应该是通用工作系统在数据世界里的 specialization。

## 18. 我们当前没做好的地方：多模态

这页图也暴露了 Cat Café 当前的一个真实缺口：**多模态基础设施还不够好**。

我们现在对代码、markdown、git、thread、feature doc、ADR、lesson 的处理很强；但对下面这些还不够系统：

- 图片里的图表值；
- PDF 表格抽取后的 provenance；
- 截图和 UI 状态的语义索引；
- 音频会议的可靠转写和说话人归属；
- 医疗/票据/表格这类敏感文件的权限和审计；
- 多模态证据如何进入 memory / eval / replay。

所以如果把 DeepEye 的价值翻译成 Cat Café roadmap，不是"我们也要做一个 Data Agent"，而是：

> 我们要补齐多模态证据层，让 Agentic Work OS 能可靠处理图片、PDF、表格、音频、数据库这些现实材料。

这比"做一个数据智能体"更底层，也更符合我们的位置。

## 19. 更新后的定位

结合这页图，我们对 Data Agent 的定位需要再收窄：

1. **Data Agent 不是独立物种。**
   它是 Agentic Work OS 在数据世界的领域配置。

2. **DeepEye 的问题不是只属于数据。**
   多源、多模态、长程、工具链、silent failure、人类修改、SOP 沉淀，都是通用 Agent 工作系统的问题。

3. **Cat Café 的机会不是复制 DeepEye。**
   我们更应该抽象出一层通用现实证据基础设施，再让数据、代码、研究、个人记忆都共享这层能力。

4. **我们必须补多模态。**
   没有多模态证据层，"气泡为什么裂"、"图表里的数字是否可信"、"上次看病是什么时候"这类真实问题都会断。

一句话：

> Data Agent 看起来是一个领域 Agent，但它暴露的其实是 Agentic Work OS 的底层能力缺口：多源现实证据、工具链溯源、可复盘执行、多模态记忆和经验沉淀。做强这层之后，数据智能体只是其中一个 profile。

## 20. 周煊赫：云数据基座与桌面 AI 代理

网络中断后，现场进入第三位发言人。铲屎官现场识别为：

> 周煊赫，上海交通大学助理教授，主题大意是"云数据基座与桌面 AI 代理"。

公开资料校准：周煊赫是上海交通大学计算机学院长聘轨助理教授，研究方向包括智融数据分析、ML/LLM 数据底座、自治数据库系统（AI4DB）。他的工作谱系明显偏 **数据库系统 + LLM/Data interface**，不是纯应用层 Agent。

### 20.1 现场转写抓到的技术线

本段 ASR 噪声较大，但能抓到几个强信号：

1. **把向量索引从局部 segment 解耦出来**
   现场提到原始模式会生成临时 index 表，但大 key 或跨 segment 检索会带来问题，所以把索引表和相关数据单独抽出来，形成 segment-decoupled 的 global index 层。

2. **把 ANN / 向量检索算子放进关系数据库思路里管理**
   现场多次提到 PQ、LUT、iList、cluster、join、filter、cost model。这不是"把向量库接到 Agent"这么简单，而是把向量检索拆成数据库可理解、可改写、可调度、可优化的算子。

3. **用数据库优化器处理 AI 检索链路**
   现场说到利用 table 设计、算子改写、分布式调度和计划层优化。这里的核心不是 Agent 自己会不会搜索，而是底层数据系统能不能把向量检索、过滤、聚合、排序和 join 统一进查询优化框架。

4. **这更像 Data Foundation，不像前台 Agent**
   如果骆老师那条线是在讲"数据智能体如何编排 workflow"，周煊赫这条线更底层：AI 代理要能进入桌面和云数据世界，前提是底层数据基座能把结构化、半结构化、向量化、多模态数据统一调度。

### 20.2 和 DeepEye / Cat Café 的层级关系

我建议把三条线分层看：

```text
Cat Café / Agentic Work OS
  负责：任务、协作、审计、记忆、eval、跨 agent 闭环

DeepEye / Data Agent Workflow
  负责：把复杂数据分析显式化成 workflow / DAG / sub-agent 执行链

周煊赫 / Data Foundation
  负责：让数据库、向量索引、文件、多模态数据成为可优化的数据基座
```

这三层不是互斥关系：

- Cat Café 问："谁来做、怎么协作、错了怎么撤、经验怎么沉淀？"
- DeepEye 问："一个复杂数据分析任务如何被拆成可执行 workflow？"
- 周煊赫这条线问："底层数据算子和索引能不能被统一管理和优化？"

### 20.3 对"桌面 AI 代理"的含义

"桌面 AI 代理"如果只理解成一个 UI 小助手，会太浅。它真正困难的点是：

- 桌面上有文件、浏览器、表格、PDF、图片、聊天记录、数据库连接；
- 这些材料的格式不同、权限不同、可信度不同；
- Agent 需要跨它们做推理、检索、join、验证和复盘；
- 这些操作必须可追溯，否则企业不敢让它进入真实桌面。

所以周煊赫这条线对我们最大的提醒是：

> 桌面 Agent 的底座不是聊天窗口，而是本地/云端数据系统的统一编排能力。

这和前面 Data Agent 讨论是一致的：真正难的不是"有一个更会说话的 Agent"，而是 Agent 能不能进入真实数据世界。

### 20.4 对 Cat Café 的启发

Cat Café 现在最强的数据世界是：

- git / markdown / feature docs / ADR / lessons；
- thread messages / evidence.sqlite；
- audio transcript / live notes；
- codebase / tests / commits。

这些已经足够支撑 coding / research / meeting copilot，但还没有到完整"桌面数据基座"：

- 图片、PDF、表格、网页 DOM、浏览器状态、系统文件、个人事件数据还没有统一索引；
- 多模态证据的 provenance 还不够细；
- 向量检索、结构化查询、全文检索、图关系还没有统一 optimizer；
- 权限和敏感数据策略还没有进入每个检索/召回决策。

所以这位发言人的价值不是告诉我们"要做一个新的桌面 AI 代理"，而是提醒我们：

> 如果 Cat Café 要从 coding/research 工作系统走向更通用的个人/企业桌面工作系统，下一层必须补"数据基座"。否则 Agent 再聪明，也只能在已经被我们整理成 markdown/git/thread 的世界里工作。

### 20.5 现场可以问的问题

1. **global index 层如何保留 provenance？**
   向量/PQ/LUT/index 被关系化后，能不能追溯回原始文件、原始段落、原始权限边界？

2. **桌面 AI 代理的权限模型在哪里生效？**
   是查询计划阶段可见权限，还是执行时被动拦截？

3. **多模态对象进入数据基座后，如何做可验证的查询结果？**
   图片/PDF/表格被解析后，如何证明某个结论来自哪一块 evidence？

4. **Data Foundation 和 Agent Workflow 的边界如何划？**
   什么应该交给数据库 optimizer，什么应该交给上层 Agent/Harness 决策？

5. **用户修正后的查询计划能否沉淀成下一次的 optimizer / skill / workflow 经验？**

### 20.6 当前判断

周煊赫这条线是今天几条分享里最接近"基础设施"的一条。

DeepEye 把数据任务变成 workflow；Edit-Banana 把图片/图表变成可编辑结构；周煊赫这条线把向量索引和数据算子拉回数据库系统。三者合起来说明：

> 下一代 Agent 真正要进入现实世界，不是只靠前台 Agent 编排，而是要把现实材料变成可索引、可验证、可优化、可审计的数据基座。

Cat Café 的位置应该是把这些底层能力吸进 Agentic Work OS，而不是把每个领域都做成一只孤立的新 Agent。
