---
title: "外部 Opus-47 详解 Anthropic 五种协作模式"
date: 2026-04-21
authors: [landy]
source: "Claude AI (opus-47, 非 Cat Cafe 环境)"
doc_kind: discussion
topics: [multi-agent, coordination, external-review, five-patterns]
note: |
  这是铲屎官在 Claude AI 里和 opus-47 的对话摘录。
  该 opus-47 没有 Cat Cafe 的提示词、记忆和工具——
  是一个"干净环境"下的独立视角。
---

# 外部 Opus-47 详解：Anthropic 五种 Agent 协作模式

> 铲屎官请在下方粘贴内容。

<!-- 粘贴区域开始 -->

找到了！让我去抓原文的完整内容给你细讲。抓到原文了，Anthropic 官方 blog 4 月 10 日发的，作者 Cara Phillips。先说核心论点，再逐一拆开讲——

核心哲学很朴素：别因为某个模式听起来复杂炫酷就选它，从最简单能 work 的开始，看它在哪里崩，再演化。对大多数场景，Anthropic 推荐直接从 orchestrator-subagent 起手。

---

## 1️⃣ Generator-Verifier 生成者-验证者

最简单也部署最广的一种。

**机制**：Generator 产出初始结果 → Verifier 按明确标准检查 → 接受，或带反馈打回重做 → 循环到通过或达到最大迭代。

**典型场景**：客服邮件回复系统——generator 用产品文档+工单上下文生成初稿，verifier 对照知识库查事实准确性、对照 brand guidelines 查语气、确认每个工单问题都被回应了。失败的检查带着具体问题（比如把某功能错误归到了另一个定价档）打回给 generator。适合代码生成（一个写代码、一个写并跑测试）、事实核查、rubric 评分、合规检查。

**三个翻车点**：
- **Verifier 只和它的标准一样好**。如果只让它"看看好不好"，它会橡皮图章全盖过。团队最常见的失败是实现了 loop 但没定义"验证到底意味着什么"，制造了质量控制的假象却没有实质
- 假设"生成"和"验证"是可分离的技能。如果评估一个创意方案和生成它一样难，verifier 抓不住问题
- 迭代会 stall——generator 搞不定反馈时系统震荡不收敛，必须设 max iteration + fallback（升级给人 / 返回最佳尝试带 caveat）

---

## 2️⃣ Orchestrator-Subagent 编排者-子智能体

层级结构。Claude Code 用的就是这个。

**机制**：Lead agent 收任务 → 自己做一部分 + 派发一部分给 subagent → subagent 在**自己的独立上下文窗口**里干活、返回蒸馏过的结果 → orchestrator 综合成最终输出。

Claude Code 的具体实现：主 agent 在前台写代码、改文件、跑命令，背景派发 subagent 去搜大 codebase 或调查独立问题，主工作继续推进、结果流式返回。每个 subagent 在自己的上下文窗口运行、返回蒸馏过的发现，让 orchestrator 的上下文保持聚焦。

**适用场景**：任务分解清晰、子任务依赖最少。自动 PR 审查是典型——安全漏洞、测试覆盖、代码风格、架构一致性，每项独立、需不同上下文、产出明确。

**两个翻车点**：
- **Orchestrator 是信息瓶颈**。subagent A 发现了对 subagent B 有用的东西，必须走 orchestrator 中转。几次 handoff 后关键细节容易丢失或被过度总结
- **顺序执行限制吞吐**。除非显式并行化，subagent 一个接一个跑，付了多 agent 的 token 成本但没拿到速度收益

---

## 3️⃣ Agent Teams 智能体团队

表面看像 orchestrator-subagent 的变体，**关键差异是 worker persistence**。

**机制**：Coordinator 生成多个 worker 作为独立进程，teammate 从共享队列 claim 任务，自主跨多步工作，完成时 signal。

**和 orchestrator-subagent 的本质区别**：orchestrator 派发一个 bounded 子任务，subagent 返回结果就终止。而 teammate 跨多次任务分派存活，积累上下文和领域专业化，性能随时间改善。Coordinator 分配工作、收集结果，但不在任务之间重置 worker。

**适用场景**：大规模代码迁移——每个 teammate 负责一个 service，一路处理依赖更新、代码改动、测试修复、验证，建立起对这个服务的依赖图、测试模式、部署配置的熟悉度。这种积累的上下文是 one-shot 派发拿不到的。

**三个翻车点**：
- **独立性是硬要求**。teammate 们不能像 subagent 那样靠 orchestrator 中转信息。一个 teammate 的工作影响另一个时，双方都不知道，输出可能冲突
- **完成检测难**。时长不定——一个 2 分钟搞定、另一个 20 分钟，coordinator 得处理部分完成状态
- **共享资源是放大器**。多个 teammate 操作同一个 codebase / db / 文件系统时，可能改到同一个文件或做出不兼容的修改，需要仔细的任务划分+冲突解决机制

---

## 4️⃣ Message Bus 消息总线

Agent 数量上去、交互模式变复杂后，直接协调就管不住了。

**机制**：Agent 通过 publish/subscribe 两个原语交互。agent 订阅自己关心的 topic，router 分发匹配消息。加新 agent 只需订阅，不用重连现有连接。

**典型场景**：安全运营自动化。告警从多源到达 → triage agent 按严重度和类型分类，高危网络告警路由给网络调查 agent、凭证相关的路由给身份分析 agent → 调查 agent 可能 publish 上下文请求、由 context-gathering agent 响应 → 发现流向响应协调 agent 决定动作。适合事件驱动流水线——工作流从事件里**涌现**而非预定义。

**两个翻车点**：
- **可追溯性差**。一个告警触发 5 个 agent 的事件级联时，想搞清楚发生了什么需要细致的日志+关联。比追 orchestrator 的顺序决策难调试得多
- **路由准确性关键**。router 分类错或丢事件时系统**静默失败**——什么都没处理但也没崩。LLM-based router 给了语义灵活性但引入自己的失败模式

---

## 5️⃣ Shared State 共享状态

前四种都有中心角色管信息流（orchestrator / team lead / router）。共享状态把中介拿掉。

**机制**：Agent 自主读写一个共享 db / 文件系统 / 文档。没有中心协调者。初始化步骤给存储 seed 一个问题或数据集开始，终止条件满足时结束——时间限制 / 收敛阈值 / 指定 agent 判断存储已经有足够答案。

**典型场景**：研究综合系统。多个 agent 调查复杂问题的不同面——一个查学术文献，一个分析行业报告，一个看专利，一个监控新闻。学术 agent 发现一个关键研究者，这个信息立刻能被行业 agent 看到并顺藤摸瓜去查其公司，不用等 coordinator 路由。

**隐藏收益**：去掉了单点故障。orchestrator 或 router 挂了整个系统停；shared state 下任一 agent 停了其他的继续读写。

**两个翻车点**：
- **重复工作/方向冲突**。没显式协调，两个 agent 可能独立调查同一条线索。系统行为从交互里涌现，结果更不可预测
- **最阴的失败模式：reactive loop**。A 写个发现 → B 读到写 follow-up → A 看到又回应 → 循环烧 token 但不收敛。重复工作和并发写有已知工程解法（锁、版本、分区），但 reactive loop 是行为问题，需要把终止条件当一等公民：时间预算、收敛阈值（N 个周期没新发现）、或专门一个 agent 负责判断"存储里的答案够不够"。把终止当事后考虑的系统要么无限循环，要么在某个 agent 上下文塞满时任意停下来

---

## 如何选择和演化（原文几组锐利对比）

| 对比 | 关键问题 |
|---|---|
| Orchestrator-subagent vs. Agent teams | worker 需要跨多轮维持上下文吗？不需要前者（PR 审查），需要后者（代码迁移） |
| Orchestrator-subagent vs. Message bus | 工作流可预测吗？可预测前者，emergent 后者。**当你发现 orchestrator 里堆越来越多条件分支时，该换 message bus 了** |
| Agent teams vs. Shared state | agent 们需要彼此的发现吗？不需要前者（独立分区），需要后者（研究综合） |
| Message bus vs. Shared state | 工作是离散事件流动，还是累积成共享知识库？**如果你的 bus 里 agent 在 publish 事件是为了"共享发现"而非"触发动作"，说明该换 shared state 了** |

## 最后的建议

- **生产系统经常混合模式**。常见混合：orchestrator-subagent 管总体 + shared state 处理某个协作重的子任务；或 message bus 做事件路由 + agent team 风格的 worker 处理每种事件
- **多数场景先用 orchestrator-subagent**。覆盖范围最广、协调开销最小
- 核心哲学延续上一篇：**按上下文边界划分工作，而不是按工作类型划分**

---

从猫咖视角看：你现在的架构本质上是 **orchestrator-subagent（铲屎官做 lead）+ shared state（Redis + session chain）** 的混合。文章里 "reactive loop 需要一等公民的终止条件" 这个点值得细品——你之前搞的两阶段记忆架构（实时标记 + 异步归档）本身就是一种结构性防 reactive loop 的设计，它强制了写入节奏而非让 agent 们自由互相反应 🐾

原文链接：https://claude.com/blog/multi-agent-coordination-patterns

<!-- 粘贴区域结束 -->
