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
  - "铲屎官现场观察与 Cat Café 内部讨论"
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

