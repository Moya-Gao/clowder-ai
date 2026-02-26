---
feature_ids: []
topics: [prompts, multi, agent]
doc_kind: note
created: 2026-02-24
---

# Multi-Agent 架构对比调研：Cat Cafe vs 业界方案

> 委托人：铲屎官 + 布偶猫
> 日期：2026-02-24

## 背景

我们正在开发 **Cat Cafe**，一个让多个 AI Agent（Claude / Codex / Gemini）真正协作的系统。我们的架构走了一条比较独特的路线——**去中心化 + 强人在环（Human-in-the-Loop）**，和业界主流的中心化编排器模式有显著差异。

现在想系统对比以下四个 multi-agent 方案的设计理念、架构模式和取舍：

| # | 方案 | 简介 |
|---|------|------|
| 1 | **Claude Code Agent Teams** | Anthropic 官方的多 Agent 协作方案（Team Lead + Teammates） |
| 2 | **oh-my-opencode** | 社区项目，基于 OpenCode 的 agent harness suite，Sisyphus 编排器 |
| 3 | **Kimi Agent Swarm** | Moonshot AI 的多 Agent 框架（k1 模型 + swarm 模式） |
| 4 | **Cat Cafe A2A** | 我们自己的方案（去中心化 worklist + CLI 子进程 + MCP 回传） |

### Cat Cafe 的核心设计特征（供对比参考）

为了让调研有针对性，这里列出 Cat Cafe 的 6 个关键设计特征。请调研时以此为锚点，对比其他方案在相同维度上的选择：

1. **去中心化 Worklist**：没有中央编排器。Cat 通过在回复中 @mention 其他 Cat 来触发 A2A 链式调用，worklist 是一个共享的执行队列，任何正在运行的 cat 都可以向其中追加目标。支持 A→B→A 的 ping-pong review 模式。最大深度 15。

2. **CLI 子进程 + 订阅经济学**：每只猫通过 `spawn()` 启动各自的 CLI（claude / codex / gemini），使用订阅额度而非 API 计费。这是一个经济约束驱动的架构决策——API key 太贵，订阅套餐可以让三只异构猫共存。

3. **强人在环权限系统**：猫猫执行敏感操作前必须通过 `request-permission` MCP 工具申请铲屎官批准。审批范围分三级（once / thread / global），形成**策略学习棘轮**——频繁批准的操作会自动变成永久规则，猫的能力边界随时间扩展。WebSocket + Web Push 双通道确保铲屎官即使不在浏览器也能收到通知。

4. **异构 Agent 统一回传**：Claude 原生支持 MCP，Codex/Gemini 不支持。我们通过 McpPromptInjector 向非 Claude 猫的 prompt 中注入 HTTP callback 指令，实现统一的回传通道（发消息、获取上下文、申请权限等）。

5. **Session 链式管理**：不是一个 session 用到死，而是 active → sealing → sealed 的链式生命周期。session 满了就 seal + 写 transcript，新 session 通过 bootstrap 注入摘要。跨越 CLI 的上下文窗口限制。

6. **Intent 驱动路由**：用户 @mention 2+ 只猫时自动进入 parallel（ideate 模式），@mention 1 只猫时 serial（execute 模式）。也可以用 `#ideate` / `#execute` 显式控制。路由策略是推断出来的，不需要用户手动选模式。

## 需要调研的问题

### Q1: 架构模式对比

对每个方案，请描述其核心架构模式：

- **编排模式**：中心化（有明确的 orchestrator/team lead）vs 去中心化（agent 之间直接通信）vs 混合？
- **Agent 间通信机制**：共享状态？消息传递？任务队列？直接调用？
- **Agent 发现与路由**：怎么决定把任务给哪个 agent？静态配置？动态路由？用户指定？
- **上下文共享策略**：每个 agent 有独立上下文还是共享？怎么处理上下文窗口限制？

### Q2: Human-in-the-Loop 设计

这是我们最关心的对比维度之一：

- 每个方案中，人类的角色是什么？（纯监督？主动参与？审批门？）
- 有没有权限申请/审批机制？如果有，粒度如何？
- Agent 能否自主做决策，还是每步都需要人类确认？
- 失败/异常时如何通知人类？有没有推送机制？
- 人类能否实时干预正在运行的 agent？（中断、重定向、修改指令）

### Q3: Agent 异构性支持

- 方案是否支持不同 AI 模型/Provider 的 Agent 混用？（例如 Claude + GPT + Gemini）
- 如果支持，如何处理不同模型能力差异？（上下文窗口、工具调用格式、输出格式）
- 如果不支持，是只支持自家模型，还是有扩展接口？

### Q4: 任务分解与并行

- 如何将复杂任务分解为子任务？（人工分解？AI 自动分解？混合？）
- 子任务能否并行执行？有并发控制吗？
- 子任务之间有依赖关系管理吗？
- 失败的子任务怎么处理？重试？降级？上报？

### Q5: Session / Context / Memory 管理

- Agent 的对话上下文怎么管理？
- 有没有跨 session 的记忆机制？
- 上下文窗口满了怎么办？压缩？新 session？丢弃？
- 多 agent 之间的上下文如何隔离或共享？

### Q6: 开发者体验与可扩展性

- 添加一个新 agent 需要改什么？
- 有没有 plugin/extension 机制？
- 配置驱动还是代码驱动？
- 社区生态如何？

### Q7: 已知问题与社区反馈

- 每个方案的已知问题、limitations、社区吐槽有哪些？
- 有没有性能问题？（延迟、成本、稳定性）
- 安全问题？（prompt injection、权限越界、数据泄露）

### Q8: 对 Cat Cafe 的借鉴价值

基于以上对比，哪些设计理念或机制值得 Cat Cafe 借鉴？具体建议：

- 每个方案最值得学习的 1-2 个设计点
- Cat Cafe 当前缺失但别人做得好的能力
- Cat Cafe 做得独特/更好的方面（确认我们的优势）
- 具体的改进建议（如果有）

## 输出要求

1. **每个结论标注信息来源**（URL / 文档名 / 代码仓库路径）
2. **区分「已确认」和「推测」**——没有一手证据的判断要标注
3. **给出推荐方向 + 风险**
4. **用对比表格汇总关键维度**——方便快速浏览
5. **总字数控制在 3000-5000 词**——深度优先于广度，不需要面面俱到

## 补充说明

### 关于 Kimi Agent Swarm

这是我们了解最少的方案。已知信息：
- Moonshot AI 推出了 k1 模型，支持 agent 模式
- 有 "agent swarm" 的概念，但具体架构不清楚
- 请重点调研其架构设计、与其他方案的差异点

### 关于 oh-my-opencode

我们已有 2026-02-13 的详细调研报告（评分 7/10）。请关注：
- 2026-02-13 至今有无重大更新
- 社区反馈变化（当时报告了 race condition、无限循环等问题）
- 是否有新的竞品出现

### 关于 Claude Code Agent Teams

我们已有 2026-02-06 的调研报告。请关注：
- 最新的 Agent Teams 功能更新（2 月以来 Anthropic 可能有新发布）
- TeammateTool 的最新状态
- 社区实际使用反馈和最佳实践

## 我们已有的调研结论（供参考，请验证是否仍然准确）

### 关于 Claude Code Agent Teams（2026-02-06 调研）

- 采用 "Team Lead + Teammates" 模式，每个 teammate 有独立上下文
- 通过共享 task list + inbox 通信
- 用户可以直接跟任何 teammate 对话，不必经过 Team Lead
- 当时的限制：不支持 team session resume、不支持嵌套 teams、通信仅限本地
- Token 成本根据 teammates 数量和 plan mode 从 1x 到 7x 不等
- Anthropic 内部案例：16 agents, ~2000 sessions, ~$20,000 API 成本，从零构建了一个 C 编译器
- 社区发现 TeammateTool 二进制文件包含 "13 operations"

### 关于 oh-my-opencode（2026-02-13 调研，评分 7/10）

- 是基于 OpenCode 插件/session/tool/hook 系统的 "agent harness suite"——不是新的多 agent 算法，而是编排层
- **Sisyphus 编排器**：超长 system prompt + model config，强制 parallel-by-default 任务分解 + todo 驱动工作流
- **委托方式**：通过 `delegate-task` 工具，解析父 session 上下文、选模型（带 fallback）、注入 skill 内容
- **通信是单向的**：主编排器委托给子 agent，子 agent 汇报——不是点对点
- 角色隔离两层：prompt 约束 + tool 权限。子执行器（Sisyphus-Junior）禁止再委托
- **Hook 系统**管理上下文窗口压力：context-window 监控、压缩、工具输出截断
- **已知问题**：后台任务卡住数小时、任务完成太快卡在 running、并行任务竞态导致 Atlas 挂起、无限通知循环、订阅用量飙升
- Anthropic 2026年1月限制了第三方 OAuth，明确提到该项目是原因之一

### 关于 Cat Cafe 自身架构

上面「Cat Cafe 的核心设计特征」部分已经完整描述了我们的 6 个关键设计特征，无需重复。
补充说明：
- Cat Cafe 目前是一个约 20,000 行 TypeScript 的私有项目（Node.js + Fastify + Next.js）
- 已有 500+ 测试用例通过
- 已完成 Phase 0-5，三猫（Claude/Codex/Gemini）均已接入并可协作
- 经济模型：使用各 AI 平台的订阅额度（Claude Max / ChatGPT Pro / Gemini），不走 API 计费

## 外部参考链接

- Anthropic Multi-Agent 指南：https://docs.anthropic.com/en/docs/build-with-claude/multi-agent
- Claude Code Agent Teams 文档：https://docs.anthropic.com/en/docs/claude-code/agent-teams（请确认最新地址）
- oh-my-opencode 仓库：https://github.com/nicobailey/oh-my-opencode（请确认最新地址）
- Kimi 官方：https://kimi.ai / Moonshot AI 官网
- OpenCode 仓库：https://github.com/opencode-ai/opencode
