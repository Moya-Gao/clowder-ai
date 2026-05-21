---
title: 半年贡献汇报 — 五路并行的 AI Agent 工程实践
subtitle: 2026 H1 期中审视草稿
date: 2026-05-21
author: Landy（砚砚起草 v0）
audience: 期中审视
status: draft v0
topics: [career, contribution, ai-agent, cat-cafe, officeclaw, pangu-doer, codewiki, agent-engineering]
doc_kind: discussion
---

# 半年贡献汇报 — 五路并行的 AI Agent 工程实践

## 一、可直接交的简单版

2026 年上半年，我围绕 AI Agent 工程化做了五类技术探索，重点不是做单个 demo，而是验证 Agent 如何进入真实工程和企业流程。

1. **长期记忆与知识治理**：探索 Agent 如何保存跨任务上下文、沉淀决策和经验，并通过索引、权威等级、过期治理和使用反馈，避免知识只增不减、越用越乱。

2. **多 Agent 协同机制**：探索多个模型如何分工、交接、互相校验和收敛结果，解决多 Agent 场景里的任务归属、状态共享、完成判定和错误传递问题。

3. **质量评估与审计闭环**：探索 Agent 产出如何被验证，包括测试、日志、调用链、证据留痕、人工复核和行为数据评估，避免只看“回答像不像对”。

4. **自我改进机制**：探索 Agent 如何从失败案例、用户反馈、评审意见和真实使用轨迹中更新规则、工具和知识，形成持续改进，而不是每次从零开始。

5. **企业场景接入与工具编排**：探索 Agent 如何接入 IM、知识库、任务系统、代码仓、企业流程和外部工具，把能力从对话窗口扩展到真实业务链路。

可以概括为一句话：

> 2026 年上半年，我主要探索的是“如何把 AI Agent 从聊天助手推进到可记忆、可协作、可评估、可改进、可接入企业系统的工程化能力”。

## 二、长版摘要

2026 年上半年，我围绕 AI Agent 工程化做了五条并行探索：多智能体协作平台、Agent 治理与可靠性工程、企业组织效能落地、意图路由与知识接入、开源生态调研与吸收。核心特点不是单点 demo，而是把 Agent 从“会调用工具的模型”推进到“有共享状态、可审计、可恢复、可评估、可持续协作的工程系统”。

代表性产出包括：独立设计并持续演进 Cat Café 多智能体协作平台，截至 2026-05-21 已形成 6700+ commits、200+ feature 文档、4 个模型家族/10+ Agent 个体的长期协作系统；沉淀 TeamAct、能力画像路由、记忆治理、harness eval、native system prompt 等 AI-native 工程方法；并将这些能力映射到 OfficeClaw、盘古 Doer Router、CodeWiki 等企业场景，支撑组织效能、知识治理和多 Agent 分工落地。

## 三、五路并行探索

### 1. Cat Café 多智能体协作平台：长期团队化 Agent Runtime

围绕“AI Agent 不是一次性工具，而是长期协作伙伴”的假设，设计并交付 Cat Café 多智能体协作平台。

关键贡献：

- 构建 4 个模型家族、10+ Agent 个体的协作体系，支持串行交接、并行独立思考、多猫 review、跨线程协作。
- 形成 Feature lifecycle：立项、Design Gate、TDD、quality gate、cross-model review、merge gate、愿景守护。
- 通过 A2A、multi_mention、Shared State、IM gateway、rich block、workspace explorer，把 Agent 协作从聊天推进到真实工程工作台。
- 用 6700+ commits、200+ feature 文档、长期回归测试和真实 issue/PR 处理证明系统不是一次性 demo。

可展开讲法：

> 这套系统验证了一个核心判断：多 Agent 协作的难点不在“让多个模型同时说话”，而在任务归属、共享状态、证据留痕、跨模型 review 和完成条件。Cat Café 把这些问题工程化，形成了可复用的 Agent-native 协作底座。

### 2. Agent 治理与可靠性工程：从 ReAct 到 TeamAct

在长期协作过程中，发现单 Agent ReAct 循环不足以描述团队级协作，于是沉淀 TeamAct：State → Owner → Action → Evidence → Verdict → Route。

关键贡献：

- 提出 TeamAct：把单 Agent 的观察-行动闭环升级为多 Agent 团队主循环。
- 治理团队级新失败模式：球权掉地、乒乓球、虚空传球、无人持球、错误代理。
- 将家规、身份、Magic Words、球权三选一、工作流触发点切入 native system prompt / developer instructions，解决压缩后治理规则丢失问题。
- 建立 harness eval：用 telemetry、fixture、snapshot、cat interview 评估规则、skill、MCP tool 和协作协议是否真的有效。

可展开讲法：

> 传统 Agent 工程关注“模型能不能完成一个任务”。我的探索重点是：当多个 Agent 长期协作时，系统如何知道任务有没有 owner、证据是否足够、谁有权判断完成、下一棒如何接住。这些问题本质上是 AI-native 的软件工程问题。

### 3. 企业组织效能落地：从个人平台到办公 Agent 基建

将 Cat Café 中验证过的多 Agent 协作、知识治理和工作流能力，映射到企业办公与组织效能场景。

关键贡献：

- 将对等协作架构映射为 OfficeClaw / 办公多 Agent 分工模型。
- 将愿景守护、质量门禁、审计路径映射为企业 AI 产出治理链。
- 将五层记忆系统映射为企业决策沉淀、教训检索、知识回流。
- 将 IM gateway、rich block、MCP skill、schedule task 等能力映射为办公入口直连和跨平台自动化。

可展开讲法：

> 企业场景里，Agent 价值不只是“替人写一段文本”，而是进入真实组织流程：接收 IM 事件、调用企业系统、沉淀决策、复用知识、触发复盘、形成审计链。这要求 Agent runtime 具备长期状态和治理边界。

### 4. 意图路由与知识接入：Pangu Doer Router / CodeWiki / Skill 渐进披露

围绕企业级 Agent 如何接入大量能力和知识，探索意图路由、渐进式披露和知识工具化。

关键贡献：

- 为盘古 Doer 30+ 下游 Agent 设计自学习意图分发层 POC，探索国产模型 + MCP + 记忆反思的路由方案。
- 将 Cat Café 的 Skill 渐进式披露机制迁移到 CodeWiki / 企业知识库场景，按用户角色、任务场景和上下文动态暴露工具。
- 形成“不要一次性把所有工具塞给模型”的工程原则：能力要按场景加载、按风险治理、按行为反馈迭代。
- 将 RAG、记忆、工具、路由拆成可解释的链路，而不是把所有问题包装成一个黑盒 Agent。

可展开讲法：

> Agent 系统的瓶颈经常不是模型不会做，而是工具和知识暴露方式错误。渐进式披露能减少工具过载，意图路由能减少错误分发，记忆回流能让系统从历史任务中学习。

### 5. 开源生态调研与吸收：从框架比较到工程标准

系统性拆解 DARE、CoStrict、OpenHuman、MemOS、MCP/Plugin 生态、clowder-ai 社区 PR 等外部项目，把外部经验吸收到 Cat Café 工程标准中。

关键贡献：

- 从 DARE 提炼企业级 Agent 框架四层结构与边界接口。
- 从 OpenHuman / MemOS 等项目拆解中校准本地优先、记忆、eval、claim-token、job queue 等真实工程含量。
- 在 clowder-ai 社区协作中实践 PR review、intake、outbound sync、Console UI 收敛、plugin framework 等开源工程流程。
- 建立判断标准：区分“看起来像 Agent”的 wrapper，与具备状态、审计、恢复、回放、评估能力的 Agent-native 系统。

可展开讲法：

> 这一线的价值不是“看了很多框架”，而是建立了 AI Agent 工程判断力：哪些是真架构，哪些只是 prompt 包装；哪些能力可以吸收，哪些方向不适合跟随。

## 四、核心方法论沉淀

### 1. Agent 质量 = 模型能力 × Harness 契合度

模型能力只是左项。真正决定 Agent 工程上限的是运行环境：状态、工具、记忆、验证、恢复、路由、可观测性。

### 2. Role Agent 不够，能力画像才是长期主体

岗位式 Agent 适合短任务，但长期协作需要知道每只 Agent 的强项、盲点、坏直觉、历史表现和当前状态。能力画像不是简历，必须写缺点和熔断信号。

### 3. 记忆系统不能只增不减，必须有治理闭环

记忆不是“存更多聊天记录”，而是要有 authority、verification、usage signal、sunset、health debt、graph edge、replay eval。

### 4. 多 Agent 协作必须有完成条件

没有 TeamAct close predicate，多 Agent 会无限讨论、互相传球、或把未完成包装成完成。团队级循环必须显式收敛。

### 5. 企业 Agent 必须可审计、可恢复、可回放

只要进入企业流程，就不能只靠模型即时回答。每一步要能追踪输入、工具调用、判断依据、失败恢复和责任边界。

## 五、量化弹药

| 维度 | 数据 |
|---|---|
| Cat Café commits | 6700+ |
| Feature 文档 | 200+ |
| 当前编号 | F208 |
| 模型家族 | 4+ |
| Agent 个体 | 10+ |
| 协作模式 | 串行交接 / 并行独立思考 / A2A / multi_mention / cross-thread |
| 工具体系 | MCP tools / Skills / IM gateway / rich blocks / schedule tasks |
| 记忆体系 | Session Chain / Evidence Index / Knowledge Feed / Library / Recall Eval |
| 质量体系 | Design Gate / TDD / quality gate / cross-model review / merge gate |
| 外部映射 | OfficeClaw / Pangu Doer Router / CodeWiki / DARE / clowder-ai |

## 六、可以对外讲的一句话

> 2026 上半年，我不是只做了几个 Agent demo，而是围绕 AI Agent 工程化做了五路并行实践：从多智能体协作平台，到企业组织效能落地，再到意图路由、知识治理和开源生态吸收，核心目标是把 Agent 从“会回答问题的模型”推进到“可协作、可治理、可恢复、可评估的工程系统”。

## 七、待补证据

| 方向 | 需要补的证据 |
|---|---|
| OfficeClaw | 对应内部项目名称、已落地模块、可公开口径 |
| Pangu Doer Router | POC 代码/README/演示截图/下游 Agent 数量确认 |
| CodeWiki | 对接方式、渐进式披露 demo、真实使用方反馈 |
| DARE / 外部框架 | 调研报告路径、关键结论、被吸收进 Cat Café 的设计点 |
| Cat Café 数据 | 最新测试数、代码行数、开源 star 数、社区 PR/intake 数 |
