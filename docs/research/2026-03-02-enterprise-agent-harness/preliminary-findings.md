# 2026 企业级 AI Agent Harness 预调研

> 调研者：布偶猫宪宪 (WebSearch)
> 日期：2026-03-02
> 状态：预调研完成，待三路 Deep Research 补充

---

## Executive Summary

**核心发现**：DARE Proposal 的判断与业界趋势高度吻合。2026 年企业级 agent 的"table stakes"已经从"模型更聪明"转向"默认可控、可审计、可恢复"。

---

## Q1. Audit Trail & Event Sourcing

### 业界现状

| 框架/产品 | Audit 支持 | 存储后端 | Tamper-evident |
|-----------|-----------|---------|----------------|
| LangGraph | 内置 checkpointer | SQLite(dev) / PostgreSQL(prod) | 未提及 hash-chain |
| agent-replay | SQLite WORM | 本地 SQLite | 有 (tool: verify) |
| Zenity | 云端 | 专有 | SOX/SOC2 合规 |
| Microsoft Agent Framework | 内置 | 可配置 | 与 Azure 集成 |

### 金融/合规要求

> "SOX requires public companies to maintain internal controls over financial reporting, including audit trails for systems that process financial data. Systems that enable agents to access financial records, execute transactions, or generate reports must produce comprehensive audit logs demonstrating proper controls."
> — [MCP Audit Logging](https://tetrate.io/learn/ai/mcp/mcp-audit-logging)

> "High-risk agents involved in underwriting, trading, or know-your-customer require comprehensive documentation, ongoing monitoring, and external auditability."
> — [Banking Exchange](https://www.bankingexchange.com/news-feed/item/10465-compliance-for-ai-agents-what-financial-services-organizations-need-to-know)

### 结论

- **已确认**：Audit trail 是企业级 agent 的硬性要求，不再是可选
- **分歧点**：hash-chain 级别的 tamper-evident 目前主要在金融场景，通用框架尚未默认提供
- **推荐**：DARE 提案的 SQLite + hash-chain 是合理的第一步

---

## Q2. Checkpoint, Resume, and Replay

### 业界现状

**LangGraph 已成为事实标准**：
> "Built-in checkpointers save workflow state at regular intervals or after each step, ensuring workflows can resume after errors, interruptions, or system failures, with state stored short-term in memory or long-term in SQLite, PostgreSQL, or cloud storage like S3."
> — [Prompt Engineering](https://promptengineering.org/agents-at-work-the-2026-playbook-for-building-reliable-agentic-workflows/)

**时间旅行调试工具已出现**：
- [agent-replay](https://github.com/clay-good/agent-replay)：100% 本地，SQLite，支持 diff/fork/replay
- LangGraph Time Travel：可回滚到任意 checkpoint
- Shannon Framework：Temporal workflows 驱动的 time-travel debugging
- Langfuse：session replay dashboard

### 结论

- **已确认**：Checkpoint/resume 是 2026 年 production agent 的标配能力
- **已确认**：Replay/time-travel debugging 正在从"高级功能"变成"必备能力"
- **推荐**：DARE 提案的 checkpoint + replay 方向正确

---

## Q3. Deterministic Execution vs Model-Driven

### 业界现状

> "Production systems separate agents into two broad categories: Deterministic and Interactive, with the difference lying in how much control is delegated to the agent versus retained by the system."
> — [SpiralScout](https://spiralscout.com/blog/agentic-ai-architecture-production-patterns)

> "Modern frameworks employ deterministic governance—hard rules, encoded business logic, approval hierarchies, compliance thresholds, and if-then decision trees that execute independently of the model's inference."
> — [SpiralScout](https://spiralscout.com/blog/agentic-ai-architecture-production-patterns)

**框架选择已分化**：
- **LangGraph**："Enterprise War" 赢家，graph-based deterministic control
- **CrewAI**：快速部署，适合业务自动化，较少 deterministic 控制
- **混合模式**：LangGraph brain + CrewAI team + OpenAI tools

### 结论

- **已确认**：企业倾向于更确定性的执行路径（合规+可预测）
- **已确认**：`model_driven` / `step_driven` 双模式是业界共识
- **推荐**：DARE 的 `auto` 模式（有 validated plan 走 step_driven，否则 model_driven）是实用的默认值

---

## Q4. Context Lifecycle Management

### 业界现状

**压缩策略已标准化**：
> "Deep Agents implements three main compression techniques: offloading large tool results to the filesystem, offloading large tool inputs when context size crosses a threshold, and summarization step to compress message history."
> — [LangChain Blog](https://blog.langchain.com/context-management-for-deepagents/)

**Factory AI 评估结果**：
- Factory 自研压缩：3.70 分
- Anthropic 内置压缩：3.44 分
- OpenAI compact endpoint：3.35 分

**趋势**：
> "Context window pricing will become more nuanced with sophisticated caching and compression strategies becoming table stakes for production deployments."
> — [Zylos Research](https://zylos.ai/research/2026-01-19-llm-context-management)

### 结论

- **已确认**：Context lifecycle management 是 2026 年的"table stakes"
- **已确认**：三层策略（offload → compress → summarize）是业界共识
- **推荐**：DARE 的 `coding_default` context policy 应包含上述三层

---

## Q5. Operator Control Plane

### 业界现状

**CLI + Dashboard 双轨**：
- LangGraph Studio：可视化调试
- agent-replay CLI：`replay`, `diff`, `fork`, `eval`
- AgentOps：可观测性 dashboard

**Human-in-the-loop 框架**：
> "Modern agentic frameworks such as LangGraph, Strands SDK, CrewAI provide built-in mechanisms to support Human-in-the-Loop (HITL) controls."
> — [Permit.io](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo)

**HumanLayer SDK**：
- `@require_approval` 装饰器
- Slack/Email/Discord 集成
- 组织级审批策略

### 结论

- **已确认**：Operator control plane 是企业级 agent 的必备组件
- **已确认**：CLI 级命令（runs list/show/replay/resume/audit）是合理的默认 scope
- **推荐**：DARE 提案的 CLI 命令集合理

---

## Q6. 协议标准化（2026 新趋势）

### 三大协议

| 协议 | 维护方 | 定位 | 采用情况 |
|------|--------|------|---------|
| MCP (Model Context Protocol) | Anthropic → Linux Foundation | Agent ↔ Tools (垂直) | 97M SDK downloads, 5800+ servers |
| A2A (Agent-to-Agent) | Google → Linux Foundation | Agent ↔ Agent (水平) | 50+ partners (Salesforce, PayPal, Atlassian) |
| OpenAI Agents SDK | OpenAI | 全栈框架 | OpenAI 生态 |

**重大事件**：
> "By December 2025, both protocols were donated to Linux Foundation governance under the new Agentic AI Foundation, with OpenAI, Google, Microsoft, and Anthropic all signing on."
> — [The Information](https://www.theinformation.com/articles/openai-anthropic-google-agree-develop-agent-standards-together)

### 结论

- **已确认**：MCP + A2A 是 2026 年的事实标准
- **推荐**：DARE 应考虑 MCP 兼容性

---

## Q7. 企业采用障碍

### Top 5 担忧

1. **可审计性**（Auditability）— 占比最高
2. **Shadow AI 风险**（29% 员工使用未授权 agent）
3. **权限控制**（Agent 可继承敏感权限）
4. **合规证明**（SOX, SOC2, HIPAA 等）
5. **可恢复性**（长任务中断后如何继续）

> "When leaders lack observability in their AI ecosystem, risk accumulates silently. Already 29% of employees have turned to unsanctioned AI agents for work tasks."
> — [Microsoft Security Blog](https://www.microsoft.com/en-us/security/blog/2026/02/10/80-of-fortune-500-use-active-ai-agents-observability-governance-and-security-shape-the-new-frontier/)

### 结论

- **已确认**："Auditability" 和 "Controllability" 在企业决策中权重极高
- **推荐**：DARE Harness 的定位（默认可审计、可审批、可恢复）精准命中企业痛点

---

## 综合评估

### DARE Proposal 与业界对标

| DARE 提案能力 | 业界状态 | 对标结论 |
|--------------|---------|---------|
| 默认 event log + hash-chain | LangGraph/agent-replay 已有；hash-chain 是加分项 | **领先** |
| Checkpoint / Resume | LangGraph 已标配 | **追平** |
| Replay / Time-travel | agent-replay/Shannon/Langfuse 已有 | **追平** |
| `step_driven` / `auto` mode | 业界共识，LangGraph 类似 | **追平** |
| Context lifecycle manager | Deep Agents / Factory AI 已有 | **追平** |
| Operator CLI control plane | agent-replay 类似 | **追平** |

### 最终判断

> **DARE Proposal 的核心判断是正确的**：2026 年企业级 agent 的竞争已从"谁的模型更强"转向"谁的 harness 更可控"。

**Table Stakes for 2026 Enterprise Agent**：
1. 默认 audit trail（不是可选）
2. 默认 checkpoint / resume（不是可选）
3. Deterministic execution path（至少可选）
4. Context lifecycle management（自动压缩/摘要）
5. Operator control plane（CLI 或 dashboard）
6. Human-in-the-loop approval workflow

---

## Next Steps

1. **铲屎官发送三路 Deep Research**（prompt 已备好）
2. 等待三路报告返回
3. GPT-5.2 Pro 审阅
4. Coder 猫综合 + 决策

---

## Sources

### Audit & Compliance
- [MCP Audit Logging](https://tetrate.io/learn/ai/mcp/mcp-audit-logging)
- [Microsoft Security Blog: 80% of Fortune 500 use active AI Agents](https://www.microsoft.com/en-us/security/blog/2026/02/10/80-of-fortune-500-use-active-ai-agents-observability-governance-and-security-shape-the-new-frontier/)
- [Banking Exchange: Compliance for AI Agents](https://www.bankingexchange.com/news-feed/item/10465-compliance-for-ai-agents-what-financial-services-organizations-need-to-know)

### Checkpoint & Replay
- [agent-replay GitHub](https://github.com/clay-good/agent-replay)
- [LangGraph Persistence Docs](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph v0.2 Checkpointer Libraries](https://blog.langchain.com/langgraph-v0-2/)

### Deterministic Execution
- [SpiralScout: Agentic AI Architecture Production Patterns](https://spiralscout.com/blog/agentic-ai-architecture-production-patterns)
- [Prompt Engineering: 2026 Playbook for Reliable Agentic Workflows](https://promptengineering.org/agents-at-work-the-2026-playbook-for-building-reliable-agentic-workflows/)

### Context Management
- [LangChain: Context Management for Deep Agents](https://blog.langchain.com/context-management-for-deepagents/)
- [Factory AI: Evaluating Context Compression](https://factory.ai/news/evaluating-compression)
- [Zylos: LLM Context Management 2026](https://zylos.ai/research/2026-01-19-llm-context-management)

### Human-in-the-Loop
- [Permit.io: Human-in-the-Loop for AI Agents](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo)
- [Microsoft Learn: Human-in-the-Loop Workflows](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop)

### Protocol Standards
- [Google A2A Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [OpenAI: Agentic AI Foundation](https://openai.com/index/agentic-ai-foundation/)
- [The Information: OpenAI, Anthropic, Google Agree to Develop Agent Standards](https://www.theinformation.com/articles/openai-anthropic-google-agree-develop-agent-standards-together)

### Framework Comparisons
- [DEV Community: AI Agent Showdown 2026](https://dev.to/topuzas/the-great-ai-agent-showdown-of-2026-openai-autogen-crewai-or-langgraph-1ea8)
- [DataCamp: CrewAI vs LangGraph vs AutoGen](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen)
