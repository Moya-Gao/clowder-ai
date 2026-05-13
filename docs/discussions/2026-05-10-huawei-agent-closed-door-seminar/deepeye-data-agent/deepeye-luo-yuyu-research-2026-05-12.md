---
title: "DeepEye / 骆昱宇：面向开放复杂数据世界的自主智能体"
date: 2026-05-12
event_date: 2026-05-12
doc_kind: field-research
status: draft
speaker: "骆昱宇（香港科技大学广州 / DIAL）"
topic: "DeepEye / Data Agent / Agent Data System"
author: "砚砚/GPT-5.5"
sources:
  - "F195 live mic transcript: huawei-cloud-meeting-live-2026-05-12-mic"
  - "https://arxiv.org/abs/2603.28889"
  - "https://deepeye.tech/"
  - "https://github.com/HKUSTDial"
  - "https://github.com/HKUSTDial/DeepEye-SQL"
  - "https://arxiv.org/abs/2510.17586"
---

# DeepEye / 骆昱宇：面向开放复杂数据世界的自主智能体

> 本文是现场快研沉淀。公开资料来自 arXiv / 项目站 / GitHub；现场内容来自 F195 麦克风采集，ASR 质量有限，所以现场片段只作为低置信线索，不当作精确引用。

## 1. 一句话判断

DeepEye 不是单纯 Text-to-SQL，也不是单纯 ChatBI 或可视化工具。它更像一个面向复杂数据分析任务的 **Data Agent Harness**：

```text
复杂自然语言意图
→ 多源数据编排
→ workflow 拆解
→ AgentNode / ToolNode
→ 编译 / 验证 / 优化 / 执行
→ dashboard / report / data video
```

它的强项在 **data access + workflow orchestration**。它试图回答的是：

> 当企业数据分散在数据库、文档、文件和各种工具里时，Agent 怎样可靠地组织一个复杂数据分析流程？

这和我们前一天 Topic 1 里听到的“进入不了数据，就进入不了企业”是同一条线。

## 2. 公开资料锚点

### DeepEye 主系统

公开论文：**DeepEye: A Steerable Self-driving Data Agent System**（arXiv:2603.28889，2026-03-30）。

论文摘要里的核心判断：

- 现有 ChatBI 仍偏线性；
- 异构数据源联合分析困难；
- 复杂迭代分析会遇到 context explosion；
- DeepEye 采用 workflow-centric architecture；
- 引入 Unified Multimodal Orchestration protocol；
- 用 Hierarchical Reasoning + context isolation 降低幻觉；
- 将复杂意图拆成 autonomous AgentNodes 和 deterministic ToolNodes；
- Workflow Engine 采用 database-inspired 结构：Compiler / Validator / Optimizer / Executor；
- 目标输出包括 Data Videos、Dashboards、Analytical Reports。

项目站点：`deepeye.tech`，定位为 steerable self-driving data agent system。

### DeepEye-SQL

相关论文：**DeepEye-SQL: A Software-Engineering-Inspired Text-to-SQL Framework**（arXiv:2510.17586，标注 SIGMOD 2026）。

相关代码：`HKUSTDial/DeepEye-SQL`。

这个方向更窄，集中在 Text-to-SQL。DeepEye 主系统比 DeepEye-SQL 更大一层：它把 SQL / 数据查询当成 workflow 中的一类能力，而不是终点。

### HKUST-DIAL 生态

HKUSTDial GitHub 公开组织里有：

- `DeepEye`：Autonomous Data Agent System；
- `DeepEye-SQL`：Software-Engineering-Inspired Text-to-SQL；
- `awesome-data-agents`：数据智能体资料列表；
- `NL2SQL_Handbook`：Text-to-SQL 技术手册；
- `DeepEar` / `DeepFund` 等应用型数据智能体项目。

这说明骆老师这条线不是单点论文，而是围绕 Data Agent / Text-to-SQL / 数据工作流的一组生态。

## 3. 现场转写线索

F195 麦克风采集到的片段里，主持人介绍本场为数据 / AI 基础设施相关专场，并引出骆老师。ASR 把题目识别成“deepAI 自主式数据智能体系”等，但结合用户现场描述和公开资料，应对应 **DeepEye / 自主式数据智能体系**。

现场低置信片段能拼出的主线：

- 主题围绕“数据智能正在从传统分析向数据智能体范式演进”；
- 企业应用中仍面临数据孤岛、上下游复杂、系统配合等挑战；
- 骆老师强调自己组长期做大数据智能管理，前期也做面向模型训练和后训练的数据工作；
- 场景不是简单可视化报表，而是面向更开放的数据分析场景；
- 输出形态可能包括数据分析大屏、数据视频等；
- 即便看起来简单的数据中心 / CSV / Excel / DB / 文档输入，也会出现复杂推理和各种错误；
- 错误可能出现在意图理解、数据与代码关联、工具调用、交互编排等多个环节。

这和 DeepEye 论文里说的两个痛点一致：

1. 线性 ChatBI 不够；
2. 复杂数据分析会出现 context explosion 和多源数据编排困难。

## 4. DeepEye 的架构含义

### 4.1 它不是“会写 SQL 的聊天机器人”

Text-to-SQL 只解决“自然语言 → 查询语句”的一段。但 DeepEye 要处理的是完整分析链路：

```text
用户意图
→ 识别相关数据源
→ 拆任务
→ 选择工具
→ 查询 / 清洗 / 聚合
→ 生成分析结构
→ 产出报告或可视化
→ 人类可 steering / 修正
```

所以它更接近 **data workflow runtime**。

### 4.2 它把数据库系统思想带进 Agent

DeepEye 的 Workflow Engine 用 Compiler / Validator / Optimizer / Executor，这不是常见 Agent 框架里的“多个 tool 串起来”。

这个设计的含义是：

- workflow 可以被编译成结构；
- 结构可以被验证；
- 执行顺序可以被优化；
- 中间过程比黑盒 chat 更透明。

这也是它和普通 ChatBI 的主要差异。

### 4.3 它的核心护城河可能不在模型，而在“数据工作流抽象”

如果 DeepEye 能成立，关键不只是用更强模型，而是把数据分析里的对象抽象出来：

- 数据源；
- schema；
- 文档；
- 中间表；
- 分析步骤；
- 可视化组件；
- workflow 节点；
- human-in-the-loop 修正点。

这和我们说的 “Agent Data System” 是同源方向：Agent 时代需要管理的不只是 memory，还包括推理轨迹、数据操作、工具调用、分析产物。

## 5. 和 Cat Café 的关系

### 5.1 共鸣点：它在解企业数据入口

DeepEye 正好在回答企业 Agent 的一个硬问题：

> Agent 不能只会聊天，它要能进入企业数据系统，把复杂数据分析 workflow 跑起来。

这是 Cat Café 当前没有完整覆盖的企业级死结。我们家主要在代码、文档、git、feature / ADR / lessons 这类可治理文本资产上跑通了闭环；DeepEye 的主战场是企业数据世界。

### 5.2 差异点：它更像 data harness，我们更像 socio-technical harness

| 维度 | DeepEye | Cat Café |
|---|---|---|
| 主对象 | 数据源、查询、分析 workflow、dashboard/report/video | 多 Agent 协作、feature 生命周期、记忆、review、eval |
| 核心难题 | 数据怎么查、怎么编排、怎么生成可信分析 | Agent 怎么共享现实、怎么审计、怎么纠错、怎么长期演进 |
| 强项 | Workflow Engine + 数据系统抽象 | Governance + Cross-vendor review + Eval feedback loop |
| 风险 | 业务语义正确性、数据权限、分析结论可追责 | 企业数据接入弱、多租户/合规尚未覆盖 |

### 5.3 可以互补

如果未来接企业场景，DeepEye 这类系统可以成为 Cat Café Harness 的一个“数据世界适配器”：

```text
Cat Café / Agentic Work OS
  ├─ Memory / docs / feature / ADR / lessons
  ├─ Review / audit / eval / ball ownership
  └─ Data Agent adapter
       └─ DeepEye-like data workflow engine
            ├─ structured DB
            ├─ files / docs
            ├─ BI / dashboards
            └─ data analysis reports
```

换句话说，DeepEye 更像 **企业数据世界里的 Agent runtime**，不是替代 Cat Café，而是可以成为 Cat Café 进入企业数据系统的一条下游能力。

## 6. 我们应该追问什么

最值得问骆老师的不是“DeepEye 能不能生成 dashboard”，而是它在企业可靠性上的边界。

### 问题 1：验证的是结构正确，还是业务语义正确？

> DeepEye 有 Compiler / Validator / Optimizer / Executor。这里的 Validator 主要验证 workflow 结构正确，还是能验证业务语义正确？比如 dashboard 结论错了，系统怎么追溯是哪一步数据、SQL、工具调用或 AgentNode 出错？

这个问题能把话题拉到 provenance / audit / eval。

### 问题 2：Data Agent 的权限和责任边界怎么建模？

> 当 Agent 能跨数据库、文档、文件和业务系统取数时，权限、脱敏、使用范围和删除证明怎么表达？这些是 workflow metadata，还是需要单独的 governance layer？

这个问题对应我们 Memory Protocol 的“责任优先”判断。

### 问题 3：Human-in-the-loop 是 steering，还是审计闭环？

> DeepEye 强调 steerable。人类 steering 之后，系统会不会把“为什么改、改了什么、后续如何避免同类错误”沉淀成 eval / policy / memory？还是只作为一次性交互修正？

这个问题能区分 demo 级可控和长期可进化。

### 问题 4：开放复杂数据世界里的 benchmark 怎么设计？

> 如果数据源是异构、动态、权限受限的，单一 benchmark 很容易退化成固定题库。DeepEye 更适合用公开 benchmark，还是用企业内真实 workflow trace 做 eval？

这个问题能接上我们对 benchmark vs eval trajectory 的判断。

## 7. 对我们后续材料的影响

DeepEye 这条线应该补进我们对外叙述里的 **企业数据接入缺口**：

- 我们原来的 Memory / Harness 发言更强调治理、协作、审计、eval；
- 但企业 Agent 落地还有一个硬门槛：**数据世界的可操作性**；
- DeepEye 代表的 data workflow runtime 是这个门槛上的重要路线；
- 我们不应该把它归类成普通 memory vendor 或普通 BI 工具。

建议在后续总综述里新增一个维度：

> **Data Harness / Agent Data System**：让 Agent 进入复杂企业数据世界的运行时层。它和 Memory / Harness / Eval 是互补关系，不是替代关系。

## 8. 当前结论

DeepEye 的价值不在“又一个数据分析 Agent”，而在它把数据分析工作流工程化为可编译、可验证、可优化、可执行的结构。

我们的初步判断：

1. **技术方向真实**：它抓住了 ChatBI 线性问答不够的问题。
2. **和企业痛点贴合**：企业 Agent 最大障碍之一就是数据进不来、查不动、查错了不可追责。
3. **和 Cat Café 互补**：DeepEye 解决数据世界入口；Cat Café 解决多 Agent 共享现实和治理闭环。
4. **关键待验证点**：业务语义正确性、权限/审计、错误归因、eval 反馈环。

现场如果要一句话概括：

> DeepEye 是数据世界的 Agent Harness；Cat Café 是多 Agent 工作世界的 Harness。两个方向最终会在 enterprise runtime 里汇合。
