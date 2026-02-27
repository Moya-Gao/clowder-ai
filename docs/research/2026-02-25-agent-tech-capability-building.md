---
feature_ids: [F002]
topics: [agent, tech, capability]
doc_kind: research
created: 2026-02-25
---

# Agent 技术力建设研究报告

> **作者**：布偶猫（宪宪 / Claude Opus 4.6）
> **日期**：2026-02-25
> **委托方**：铲屎官（领导安排的技术力构建任务）
> **状态**：初稿，待审阅
> **方法**：多路 Web Research + 内部经验综合

---

## 一、研究背景与目标

**核心问题**：如果一个团队想构建类似 Claude Code 的 Agent 产品，从 2026 年 2 月到 6 月应该做什么？

本报告不面向 Cat Café 项目本身，而是面向更广泛的"Agent 技术力构建"命题——帮助团队理解当前 Agent 架构全景、识别可落地的技术方向、规划 4 个月的实施路线。

---

## 二、2026 年 Agent 架构全景

### 2.1 三大厂商的 Agent 架构对比

| 维度 | Claude Code (Anthropic) | Codex CLI (OpenAI) | Gemini CLI (Google) |
|------|------------------------|--------------------|--------------------|
| **核心循环** | Model-Controlled Loop（模型当主脑，runtime 是薄壳） | Stateless per-turn（每轮完整上下文重发） | ReAct Loop + Hooks |
| **上下文管理** | 自动压缩 + 文件系统卸载（84% token 节省） | Prompt Cache 前缀匹配（减少重复推理开销） | 1M token 大窗口硬扛 |
| **多 Agent** | Agent Teams — Lead + Teammates 网状通信 | Agents SDK — Handoff 链式传递 | ADK — 树形层级 + SequentialAgent/ParallelAgent |
| **工具协议** | MCP 原生 | MCP 原生 + Agents SDK 内置 | MCP + A2A 原生 |
| **表面(Surface)解耦** | CLI only（扩展靠 MCP） | App Server Protocol（CLI/IDE/Web 统一后端） | CLI + IDE 插件 |
| **开源** | 否 | Codex CLI 开源 (Rust) | Gemini CLI 开源 |

**关键洞察**：三家殊途同归——都在向 **"模型驱动循环 + MCP 工具生态 + 多 Agent 编排"** 收敛。差异在于编排哲学和上下文策略。

### 2.2 核心架构模式（按成熟度排序）

#### 模式 1：单 Agent 循环（生产就绪 ✅）

```
用户输入 → 组装上下文 → LLM 推理
    ↑                        ↓
    └── 工具结果 ←── 执行工具调用 ←── [有工具调用?]
                                        ↓ [无]
                                     返回文本
```

这是 Claude Code / Codex CLI / Gemini CLI 的**基础单元**。看似简单但工程含量极高：
- **上下文组装**：system prompt + 项目文件（CLAUDE.md/AGENTS.md）+ 历史对话 + 工具结果
- **工具执行**：沙盒隔离、权限控制、超时管理
- **上下文压缩**：窗口满时自动摘要、大结果卸载到文件系统

**生产要点**：这个循环的质量直接决定 Agent 的天花板。Prompt 工程 > 花哨架构。

#### 模式 2：编排器-工人（Orchestrator-Worker）（生产就绪 ✅）

```
Lead Agent（贵模型，做规划）
    ├── Worker A（便宜模型，执行子任务）
    ├── Worker B（便宜模型，执行子任务）
    └── Worker C（便宜模型，执行子任务）
         ↓ 各自汇报
Lead Agent 综合 → 返回
```

Anthropic 内部研究系统用此模式：Opus 做 Lead，Sonnet 做 Worker。结果：**单 Agent 90.2% 胜率**，但 **15x token 成本**。

**生产要点**：
- 贵模型只做规划/综合，便宜模型做执行——**成本可降 90%**
- Worker 之间**完全隔离**——各自独立上下文窗口，避免"上下文污染"
- 需要明确的任务边界——模糊任务分不出去

#### 模式 3：Handoff 链（Sequential Specialists）（生产就绪 ✅）

```
Agent A（意图识别）→ Agent B（执行）→ Agent C（验证）
                  handoff           handoff
```

OpenAI Agents SDK 的核心模式。每次 handoff：
- 系统 prompt 切换为接收方的 instructions
- 聊天历史**完整传递**（不是摘要）
- 同一时刻只有一个 Agent 的 system prompt 在生效

**生产要点**：
- 适合**流程明确**的场景（客服路由、审批流水线）
- 不适合需要多 Agent 同时思考的场景
- 状态完全无隐藏——全链路可观测

#### 模式 4：网状通信 / Agent Teams（实验性 ⚠️）

```
Lead
 ├── Teammate A ←→ Teammate B（直接通信）
 ├── Teammate B ←→ Teammate C
 └── 共享 Task List（DAG 依赖）
```

Claude Code Agent Teams（2026-02 实验性发布）：
- Teammates 通过 **inbox 文件**互发结构化 JSON 消息
- 共享任务列表有**依赖追踪**——上游完成自动解锁下游
- 自领任务（self-claim）+ 文件锁防竞态

**生产验证**：16 agents、~2000 sessions、$20K 成本完成了 10 万行 C 编译器。规模可行但成本高。

#### 模式 5：训练出来的编排（前沿研究 🔬）

Kimi K2.5 的 PARL（Parallel-Agent Reinforcement Learning）：
- 编排器不是代码写的规则，是**RL 训练出来的策略**
- 动态决定 spawn 多少 sub-agent、怎么分工
- 最多 100 sub-agents、1500 协调步骤
- 执行时间减少 4.5x

**意义**：代表了"编排能力从基础设施层进入模型层"的方向。未来模型可能自带多 Agent 协调能力，减少对编排框架的依赖。

### 2.3 协议标准化：MCP + A2A

#### MCP（Model Context Protocol）— Agent ↔ 工具/数据

| 时间线 | 事件 |
|--------|------|
| 2024-11 | Anthropic 推出 MCP |
| 2025-03 | OpenAI 全产品线采纳 MCP |
| 2025-11 | MCP 重大升级：异步执行、OAuth 2.1、Streamable HTTP |
| 2025-12 | MCP 治理转交 Linux Foundation |

**现状**："运行 MCP Server 已经几乎和运行 Web Server 一样普遍。"

**核心价值**：
- 标准化 Agent 的工具接口——写一次，所有 Agent 都能用
- Server 暴露三种能力：Resources（数据）、Tools（函数）、Prompts（模板）
- 代码化工具发现（code-as-tool）比 JSON Schema 减少 **98.7%** 上下文开销

#### A2A（Agent-to-Agent Protocol）— Agent ↔ Agent

| 时间线 | 事件 |
|--------|------|
| 2025-04 | Google 联合 50+ 合作伙伴推出 A2A |
| 2025 下半年 | A2A 转交 Linux Foundation |
| 2026-02 | A2A v0.3 发布（生产可用） |

**核心价值**：
- Agent 跨框架/跨厂商通信的标准
- 基于 HTTP + SSE + JSON-RPC——与现有 IT 基础设施兼容
- "Agent Cards"：能力广告 + 发现机制

**MCP vs A2A 的关系**：互补，不竞争。
- MCP = 纵向集成（给 Agent 接工具）
- A2A = 横向集成（Agent 之间协作）
- 生产系统两个都要

### 2.4 主流框架生态

| 框架 | 架构 | 生产状态 | 核心优势 | 适用场景 |
|------|------|---------|---------|---------|
| **LangGraph 1.0** | 状态图（DAG + 循环） | 生产（400+ 企业，~90M 下载/月） | 持久执行、时间旅行调试、断点续跑 | 长运行复杂工作流 |
| **OpenAI Agents SDK** | Handoff 网络 | 生产 | 简洁、MCP 原生、Guardrails | 流程明确的编排 |
| **Google ADK** | 树形事件驱动 | 生产（GCP 集成） | 多模态、A2A 原生、编排原语 | GCP 生态项目 |
| **CrewAI** | 角色层级 | 生产 | 角色专业化 | 业务流程自动化 |

**LangGraph 的持久执行为什么重要**：
- 每个节点都做 checkpoint——服务器重启后从断点恢复
- 时间旅行调试——可以回放任意节点的执行
- 这两个能力是区分"demo"和"生产"的分水岭

---

## 三、落地产品的关键技术决策

### 3.1 必须做对的五件事

#### 决策 1：Agent 循环架构 —— Model-Controlled vs Code-Controlled

| | Model-Controlled (Claude Code 风格) | Code-Controlled (DAG 驱动) |
|---|---|---|
| **代表** | Claude Code、Codex CLI | LangGraph、传统 workflow |
| **控制流** | 模型决定下一步做什么 | 代码/图定义执行流程 |
| **灵活性** | 极高（能应对未预见的情况） | 受限于图结构 |
| **可预测性** | 低（模型可能走偏） | 高（流程确定） |
| **调试难度** | 高（需要 trace 推理过程） | 低（看图即可） |

**建议**：核心 Agent 用 Model-Controlled（发挥模型能力），外层编排用 Code-Controlled（确保可预测性）。不要只选一个。

#### 决策 2：上下文管理策略

这是 Agent 产品最容易做砸的地方。三种策略各有适用场景：

| 策略 | 做法 | 适用场景 |
|------|------|---------|
| **大窗口硬扛** | 1M token 窗口，什么都往里塞 | 单轮分析任务（Gemini 风格） |
| **层级压缩** | 自动摘要 + 工具结果卸载到文件 | 多轮交互任务（Claude Code 风格） |
| **上下文分片** | 把任务切片分给多个 Agent | 大规模并行任务（Kimi Swarm 风格） |

**建议**：层级压缩是基线必做。大窗口是模型能力红利，不需要自己工程化。上下文分片是进阶优化。

#### 决策 3：工具集成 —— 自建 vs MCP

**2026 年的答案很明确：用 MCP。** 理由：
- MCP 已是事实标准（Anthropic/OpenAI/Google 全部采纳）
- 自建工具接口 = 技术债
- MCP 生态已有数千个 server 可复用
- 代码化工具发现减少 98.7% 上下文开销

**注意**：MCP Server 本身的开发仍需要投入。"用 MCP 标准"≠"不用开发工具"。

#### 决策 4：人在环（Human-in-the-Loop）设计

Google 2025 DORA 报告的数据：90% AI adoption → 9% bug 增长、91% review 时间增长、154% PR 体积增长。**不受控的 Agent 自治是有害的。**

人在环不是"加个确认弹窗"，而是一个光谱：

```
完全自治 ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ → 完全人工

Kimi Swarm  Agent Teams  Claude Code  Cat Cafe
(自主运行)  (hooks 干预)  (权限分级)   (审批棘轮)
```

**建议**：从"默认需要审批，逐步放权"开始，而不是从"默认自治，出问题再加限制"。后者的代价远大于前者。

#### 决策 5：可观测性

**2026 年的共识：没有可观测性的 Agent 不算生产系统。**

必须有的：
- 每次 Agent 调用的 correlation ID
- 工具调用 trace（输入、输出、耗时、token 消耗）
- 多 Agent 协作的依赖关系可视化
- 异常和降级状态告警

推荐方案：OpenTelemetry 标准 + 自定义 span（LLM inference、tool execution、agent handoff）。

### 3.2 成本控制的关键杠杆

Agent 产品最大的运营风险是**成本失控**。几个关键杠杆：

| 杠杆 | 效果 | 实现难度 |
|------|------|---------|
| **Plan-Execute 分层** | 贵模型只做规划（1 次），便宜模型做执行（N 次）——成本降 90% | 中 |
| **Prompt Cache** | 避免重复推理相同的上下文前缀——OpenAI 模式 | 低（API 层面） |
| **上下文压缩** | 减少每轮发送的 token 数——Anthropic 实测 84% 节省 | 中 |
| **工具结果分级** | 大结果写文件/摘要再注入，而非全量放上下文 | 低 |
| **模型路由** | 简单任务走小模型，复杂任务走大模型 | 高（需要意图分类器） |

### 3.3 生产环境中什么能 work，什么不能

#### 能 Work ✅

1. **编排器 + 专业工人**：已被 Anthropic、OpenAI 验证
2. **持久执行 + 断点续跑**：LangGraph 1.0 标准
3. **MCP 工具生态**：事实标准
4. **显式状态传递**：无隐藏状态，全链路可调试
5. **人在环中断点**：破坏性操作前必须有

#### 不 Work ❌

1. **单 Agent 万能**：规模上来一定需要拆分
2. **轮询架构**：Agent 需要事件驱动/webhook，不是 request-response
3. **无治理的自治**：Agent 会做局部合理但全局不一致的决策（"架构漂移"）
4. **Naive RAG**：全量塞上下文会降低 coherence，需要结构化选择
5. **无验证信任输出**：AI PR 被拒率 67.3% vs 人工 15.6%——必须有 review/validation 层

---

## 四、技术力构建路线图：2026 年 2 月 → 6 月

### 总体策略

四个月分三阶段：**基座 → 能力 → 体验**

```
2月           3月           4月           5月           6月
├─── M1 基座 ──┤
│  Agent 循环   │
│  工具框架     │
│  可观测性     │
               ├─── M2 能力 ──┤
               │  多 Agent     │
               │  上下文管理   │
               │  人在环       │
                              ├─── M3 体验 ──┤
                              │  产品化       │
                              │  成本优化     │
                              │  生态整合     │
```

### Milestone 1：基座层（2 月中 → 3 月底，6 周）

> 目标：一个能跑通完整 Agent 循环的最小可用系统

#### M1.1 核心 Agent 循环（2 周）

**做什么**：
- 实现 Model-Controlled Loop：用户输入 → 上下文组装 → LLM 推理 → 工具执行 → 循环
- 支持至少一个 LLM 后端（建议 Claude API，生态最完整）
- 实现基础工具：文件读写、命令执行、搜索

**技术选型**：
- Runtime: Node.js/TypeScript 或 Python（取决于团队栈）
- LLM 调用: 直接 API（不引入框架，先理解底层）
- 工具执行: 沙盒化的子进程

**验收标准**：
- Agent 能根据用户指令读文件、改文件、跑命令
- 多轮对话保持上下文连贯
- 工具调用有超时和错误处理

#### M1.2 MCP 工具框架（2 周）

**做什么**：
- 实现 MCP Client——能连接任意 MCP Server
- 实现 1-2 个自有 MCP Server（如文件系统、Git）
- 工具发现和注册机制

**技术选型**：
- `@modelcontextprotocol/sdk`（官方 SDK）
- Transport: Streamable HTTP（2025-11 新规范）

**验收标准**：
- Agent 能通过 MCP 调用外部 Server 的工具
- 新工具上线 = 部署一个 MCP Server，不需要改 Agent 代码
- 工具 schema 动态发现

#### M1.3 可观测性基础（2 周）

**做什么**：
- OpenTelemetry 集成：每次 LLM 调用、工具执行产生 span
- Correlation ID 贯穿一次完整交互
- 基础 dashboard（推荐 Grafana + Tempo）
- Token 消耗追踪

**验收标准**：
- 任何一次 Agent 交互可以看到完整 trace
- 异常工具调用有告警
- 有 token 消耗的日报/周报

#### M1 产出物

- [ ] 可跑通的 Agent 循环 demo
- [ ] MCP Client + 2 个自有 MCP Server
- [ ] 可观测性 dashboard
- [ ] 技术选型文档（记录为什么选 X 不选 Y）

---

### Milestone 2：能力层（4 月，4 周）

> 目标：从"能跑"到"能用"——多 Agent、上下文管理、人在环

#### M2.1 多 Agent 编排（2 周）

**做什么**：
- 实现 Orchestrator-Worker 模式：Lead Agent 规划任务，Worker Agent 并行执行
- Worker 之间上下文隔离（独立 context window）
- 任务分发和结果收集机制
- 基础的任务状态管理（pending → running → completed/failed）

**架构选择建议**：

不要一上来就做最复杂的网状通信（Agent Teams 模式）。推荐路径：

```
Orchestrator-Worker (M2)  →  Handoff Chain (M2+)  →  Mesh/Teams (M3+)
     最实用                    流程场景                 协作场景
```

**验收标准**：
- Lead Agent 能拆解任务并分发给 Worker
- Worker 并行执行（不互相等待）
- 某个 Worker 失败不影响其他 Worker
- 全局有任务完成度追踪

#### M2.2 上下文管理（1 周）

**做什么**：
- 层级压缩：对话历史超过阈值时自动摘要
- 工具结果分级：大结果写临时文件 → 注入摘要/路径
- 项目级上下文：支持类似 CLAUDE.md/AGENTS.md 的项目指令文件

**关键指标**：
- 50 轮对话后 Agent 仍能记住第 1 轮的关键信息
- Token 消耗增长率从线性降为对数级

**验收标准**：
- 长对话不再因 token 超限崩溃
- 压缩前后 Agent 行为一致性 > 90%（人工评估）

#### M2.3 人在环框架（1 周）

**做什么**：
- 权限分级：哪些工具自动执行、哪些需要确认
- 审批 UI：用户能看到 Agent 要做什么并批准/拒绝
- 破坏性操作保护：删除、推送、发消息等操作必须确认

**设计原则**：
- 默认保守：新工具默认需要确认
- 渐进放权：频繁批准的操作可升级为自动执行
- 可追溯：所有审批/拒绝记录可查

**验收标准**：
- Agent 不会在用户不知情的情况下执行破坏性操作
- 常规操作（读文件、搜索）自动执行，不打断用户
- 审批历史可查

#### M2 产出物

- [ ] 多 Agent 编排 demo（Lead + 2 Workers 协作完成任务）
- [ ] 上下文管理器（压缩 + 分级）
- [ ] 人在环审批框架
- [ ] 性能基准测试报告（延迟、token 消耗、成功率）

---

### Milestone 3：体验层（5 月 → 6 月中，6 周）

> 目标：从"能用"到"好用"——产品化、成本优化、生态

#### M3.1 产品化打磨（2 周）

**做什么**：
- 错误处理和降级策略（LLM 超时/限流/不可用时的 fallback）
- Session 管理（对话持久化、断点续跑）
- 多用户支持（隔离、并发）
- CLI 或 Web UI（取决于目标用户群）

**验收标准**：
- Agent 在网络不稳定环境下优雅降级
- 用户关掉终端再打开能继续上次的任务
- 多用户同时使用互不干扰

#### M3.2 成本优化（2 周）

**做什么**：
- Plan-Execute 分层：贵模型规划，便宜模型执行
- 模型路由：简单意图走小模型（Haiku/GPT-4o-mini），复杂任务走大模型
- Prompt Cache 利用率优化
- Token 预算管理：用户/项目级别的消耗上限

**关键指标**：
- 相同任务完成质量下，成本降低 60%+
- P99 延迟 < 10s（单轮交互）

**验收标准**：
- 有模型路由策略且可配置
- 有 token 预算告警
- 成本优化前后的对比报告

#### M3.3 生态整合（2 周）

**做什么**：
- 接入主流 MCP Server 生态（GitHub、Jira、Slack 等）
- A2A 协议基础支持（Agent Card 发布、基本的跨 Agent 通信）
- 插件/扩展机制：第三方可以为 Agent 添加能力

**验收标准**：
- Agent 能通过 MCP 连接至少 5 个外部服务
- Agent Card 发布和发现机制可用
- 有扩展开发文档

#### M3 产出物

- [ ] 可交付的 Agent 产品（CLI 或 Web）
- [ ] 成本优化报告
- [ ] 生态集成 demo（MCP + A2A）
- [ ] 产品化 checklist（安全、隔离、降级、监控全通过）

---

### Milestone 汇总表

| Milestone | 时间 | 周数 | 核心产出 | 成功标准 |
|-----------|------|------|---------|---------|
| **M1 基座** | 2 月中 → 3 月底 | 6 | Agent 循环 + MCP + 可观测性 | Agent 能通过 MCP 工具完成多轮任务 |
| **M2 能力** | 4 月 | 4 | 多 Agent + 上下文 + 人在环 | Lead-Worker 编排跑通，长对话不崩 |
| **M3 体验** | 5 月 → 6 月中 | 6 | 产品化 + 成本优化 + 生态 | 可交付产品，成本降 60% |

---

## 五、技术选型推荐

### 5.1 基础设施

| 组件 | 推荐 | 理由 |
|------|------|------|
| **LLM 接口** | Claude API (主) + OpenAI API (备) | Claude 生态最完整，OpenAI 做 fallback |
| **工具协议** | MCP | 事实标准，三大厂全部采纳 |
| **编排框架** | 自建薄层 (M1-M2) → 可选 LangGraph (M3) | 先理解底层，再决定是否引框架 |
| **可观测性** | OpenTelemetry + Grafana | 开放标准，生态成熟 |
| **状态持久化** | Redis (session/task) + 文件系统 (artifacts) | 快且简单 |

### 5.2 "不要做"清单（同样重要）

| 不要做 | 为什么 |
|--------|-------|
| **不要自建工具协议** | MCP 已是标准，自建 = 技术债 |
| **不要一开始就做 Agent Mesh** | 复杂度爆炸，先用 Orchestrator-Worker |
| **不要追 100 Agent 规模** | Kimi Swarm 是研究展示，生产场景 3-5 Agent 就够 |
| **不要忽略成本** | Agent 产品最大杀手是 token 成本，M3 之前就要有成本意识 |
| **不要跳过可观测性** | 没有 trace 的 Agent = 黑盒，出问题无法排查 |
| **不要把所有东西塞进上下文** | Naive RAG 降低 coherence，结构化选择上下文 |

---

## 六、值得持续关注的前沿方向

这些方向目前不适合直接落地，但会在 6-12 个月内影响技术路线：

### 6.1 模型原生编排能力（Kimi PARL 方向）

如果未来模型自带多 Agent 协调能力，**大部分编排框架代码会变成废物**。建议：
- 编排层做薄，不要过度投资
- 保持编排逻辑与模型调用的解耦，方便未来切换

### 6.2 递归语言模型（RLM, 2025-10）

模型学会**主动管理自己的上下文**——压缩、委托、外部记忆读写。如果成熟：
- 上下文压缩基础设施会被模型自己接管
- 当前的工程化压缩策略变成过渡方案

### 6.3 Surface-Agnostic Agent Core（Codex App Server 方向）

Agent 核心逻辑与用户界面完全解耦——同一个 Agent 后端同时服务 CLI、IDE 插件、Web UI、移动端。建议：
- 从 M1 开始就把 Agent 核心做成无 UI 依赖的模块
- 表面层是适配器，不是核心

### 6.4 代码化工具发现（MCP 演进方向）

用代码（而非 JSON Schema）描述工具——**98.7% 上下文减少**。当 MCP 规范更新时，第一时间跟进。

---

## 七、从 Cat Café 实践中提炼的经验

虽然这份报告不面向 Cat Café 本身，但我们在 Cat Café 项目中踩过的坑对任何 Agent 团队都有参考价值：

### 7.1 异构 Agent 协作是真实需求

Cat Café 让 Claude/Codex/Gemini 三个不同平台的 Agent 协作。真实收获：
- **不同模型真的有不同强项**——Claude 擅长架构，Codex 擅长 review，Gemini 擅长视觉
- **统一回传协议是关键**——McpPromptInjector 让非 MCP Agent 也能回传结构化数据
- **格式漂移是最大的痛点**——长上下文压力下 Agent 会"忘记"回传格式

### 7.2 人在环不是阻碍，是加速器

Cat Café 的三级审批棘轮（once/thread/global）+ 策略学习的实践证明：
- 初期审批确实慢，但**棘轮策略让常规操作逐渐自动化**
- 关键操作保留审批比"出了事再修"成本低 10 倍
- **决策权是漏斗**：上游（架构、方向）严格审批，下游（实现细节）渐进放权

### 7.3 Session 链式管理解决长期记忆

Agent 的上下文窗口终归有限。Cat Café 的方案：
- Session 有生命周期：active → sealing → sealed
- Session 结束时生成结构化 transcript
- 新 Session 启动时通过 bootstrap injection 注入关键上下文
- **比"大窗口硬扛"可靠**——摘要是有结构的，不是随机截断

### 7.4 Swarm 是阶段性工具，不是常态

经过 4 猫讨论（见 `docs/discussions/2026-02-24-multi-agent-swarm-meeting-notes.md`），我们得出结论：

| 阶段 | 适合 Swarm? | 理由 |
|------|------------|------|
| Research | ✅ 适合 | 多视角有价值，合并成本可控 |
| Brainstorm | ✅ 适合 | 独立思考避免锚定效应 |
| Coding | ❌ 不适合 | 单 Agent + Review 流水线更高效 |
| Review | ❌ 不适合 | 需要深度理解上下文，不适合并行 |

**核心洞察**：Swarm 不是万能的。强行并行化串行任务会增加协调成本而不减少总成本。

---

## 八、总结

### 一句话

**2026 年构建 Agent 产品的正确姿势：Model-Controlled Loop + MCP 工具生态 + 分层编排 + 人在环 + 全链路可观测。**

### 三个最重要的判断

1. **MCP 是标准——不用就是债**。工具协议已经收敛，现在入场刚好。
2. **编排要分层——不要一步到位**。先做好单 Agent，再做 Orchestrator-Worker，最后才考虑 Mesh。
3. **成本是生死线**。Agent 产品的 unit economics 极其敏感，成本优化要从第一天就想。

### 给领导的建议

4 个月（2 月 → 6 月）足够做出一个**可内测的 Agent 产品**。关键是：
- M1（基座）不要跳过——很多团队直接上框架，结果不理解底层，出问题排不了
- M2（能力）是核心竞争力——多 Agent、上下文管理、人在环决定了产品天花板
- M3（体验）是见真章的地方——成本能不能控住决定了产品能不能活下去

---

## Sources

### Agent 架构
- [How Claude Code works — Claude Code Docs](https://code.claude.com/docs/en/how-claude-code-works)
- [Claude Code Architecture (Reverse Engineered)](https://vrungta.substack.com/p/claude-code-architecture-reverse)
- [Claude Code: Behind-the-scenes of the master agent loop](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)
- [Orchestrate teams of Claude Code sessions — Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [How we built our multi-agent research system — Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Unrolling the Codex agent loop — OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/)
- [OpenAI Codex App Server Architecture — InfoQ](https://www.infoq.com/news/2026/02/opanai-codex-app-server/)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- [GitHub — google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
- [Agent Development Kit — Google Developers Blog](https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/)

### Multi-Agent 框架
- [Kimi K2.5 Agent Swarm (arXiv 2602.02276)](https://arxiv.org/html/2602.02276v1)
- [Kimi K2.5 — InfoQ](https://www.infoq.com/news/2026/02/kimi-k25-swarm/)
- [LangGraph 1.0 — Released October 2025](https://medium.com/@romerorico.hugo/langgraph-1-0-released-no-breaking-changes-all-the-hard-won-lessons-8939d500ca7c)
- [Developer's guide to multi-agent patterns in ADK — Google](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)

### 协议标准化
- [Model Context Protocol — Wikipedia](https://en.wikipedia.org/wiki/Model_Context_Protocol)
- [MCP November 2025 Specification](https://medium.com/@dave-patten/mcps-next-phase-inside-the-november-2025-specification-49f298502b03)
- [A2A Protocol — Google Developers Blog](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [A2A Upgrade — Google Cloud Blog](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade/)
- [A Survey on Agent Interoperability Protocols — arXiv](https://arxiv.org/html/2505.02279v1)

### 生产实践
- [Agentic Frameworks in 2026: What Actually Works — Zircon Tech](https://zircon.tech/blog/agentic-frameworks-in-2026-what-actually-works-in-production/)
- [AI Coding Agents in 2026: Coherence Through Orchestration — Mike Mason](https://mikemason.ca/writing/ai-coding-agents-jan-2026/)
- [AI Agent Architecture: Build Systems That Work — Redis](https://redis.io/blog/ai-agent-architecture/)
- [Google DORA Report 2025](https://dora.dev/research/)

### 前沿方向
- [Recursive Language Models — Prime Intellect](https://www.primeintellect.ai/blog/rlm)
- [Building agents with the Claude Agent SDK — Anthropic](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)

### 内部经验
- [Cat Café Multi-Agent 讨论纪要](./2026-02-24-multi-agent-swarm-meeting-notes.md)
- [Cat Café Multi-Agent 架构对比](./2026-02-24-multi-agent-comparison-synthesis.md)
- [Cat Café Agent Swarm Feats 拆解](../discussions/agent-swarm-feats.md)
