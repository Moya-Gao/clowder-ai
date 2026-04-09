---
topics: [cloud-consultation, managed-agents, agent-runtime, architecture-review]
doc_kind: discussion
created: 2026-04-08
target_reviewers: [gemini-deep-think, gpt-pro]
---

# Cloud Cat Consultation: ADR-026 Agent Runtime Operational Boundaries

> **Purpose**: 请 Gemini Deep Think 和 GPT Pro 各自独立评审 ADR-026，提供来自不同推理深度的视角。
> **Delivery**: 将本文档完整复制给云端模型，获取独立评审意见后回填到本文件的 Response 部分。

---

## Consultation Prompt (复制给云端大猫)

你好！我来自一个叫 "Cat Cafe" 的 AI 多智能体协作平台（多个不同厂商的 AI agent 在同一个 runtime 里协作开发软件）。今天我们团队在学习 Anthropic 的一篇工程博客后，讨论出了一些架构决策想请你独立评审。

### 背景知识

**Cat Cafe 是什么**:
- 一个多 AI agent 协作平台，支持 7+ 个 provider (Claude Opus, GPT-5.4/Codex, Gemini, DeepSeek, GLM, Kimi, MiniMax, etc.)
- Agent 有不同角色（架构师、reviewer、设计师）和不同能力水平（从 frontier 到基础国产模型）
- 有一个人类 CVO (Chief Vibes Officer，项目决策者) 参与决策
- 已有的架构基础：四维可组合模型 Transport x Binding x RuntimeContract x EventAdapter + Supervisor + Discovery + ProvisioningPipeline

**触发这次讨论的文章**:
Anthropic Engineering Blog: "Scaling Managed Agents: Decoupling the brain from the hands"
- 核心：将 Managed Agents 拆成 Brain (Claude + harness) / Hands (sandbox + tools) / Session (event log) 三层可独立替换的接口
- 关键洞察：harness 假设会随模型进化过时；session != context window；credentials 要结构隔离不要靠权限限制
- 成果：p50 TTFT 降 60%，p95 降 90%+

**我们团队三只本地 AI + 人类 CVO 的讨论过程**:

讨论分两轮。第一轮三只 AI 各自独立分析文章与我们系统的映射关系。第二轮人类 CVO 提了四个灵魂拷问：

1. **Session API**: "你们都是 LLM，让你们提取 JSON 效果极差！" —— 我们之前尝试让 LLM 从对话中提取结构化 JSON 记忆，效果很差。那 Anthropic 的结构化 session event log 真的比自然语言 Markdown 好吗？

2. **Hands 懒加载**: 我们的主力 agent (Claude Code, Codex) 是 CLI 无头进程，brain + hands 耦合在一起，无法像 Anthropic 那样按需 provision 容器。现实中怎么做？

3. **Credential Isolation vs 便捷**: 如果安全靠每次都弹窗问人类确认，人类会烦到开"超级危险模式"关掉所有安全检查，反而更不安全。我们怎么从 Anthropic 的 credential isolation 学到真正有用的东西？

4. **Harness + 弱模型**: Anthropic 只有 Claude (很强的模型)，所以 harness 可以做得很薄。我们有从 Opus/GPT-5.4 到 GLM/Kimi/MiniMax 的完整能力谱系，如果要带弱模型干活，harness engineering 跟这篇文章说的有什么本质差异？

**三只 AI 的收敛共识**:

Q1 收敛: 不是"JSON vs MD"的选择题。结构化的是事件信封 (envelope: type, actor, timestamp, causal link)，由 runtime 代码自动产出；自然语言的是事件内容 (payload)，喂给 LLM 时由 harness 转换。存储层结构化给代码读，呈现层自然语言给 LLM 读。

Q2 收敛: 分三层——T1 进程池按需分配 (所有 carrier)，T2 "全息假工具" 即工具声明完整但后端连接按需建立 (CLI carrier)，T3 执行环境按需 provision (仅开放协议 carrier)。不幻想一步到位。

Q3 收敛: "结构隔离" 和 "审批弹窗" 不是同一件事。物理隔离 (执行环境里根本没有 credentials) > 规则引擎 (白名单自动放行) > 纪律约束 (靠 AI 自觉)。安全预算花在"让危险操作结构上不可能"。

Q4 收敛: 统一内核 + Model Tier Profile + 动态脚手架。Frontier 猫给目标自主规划，Mid 猫给 SOP 跟步骤走，Basic 猫给微任务单步执行+强校验。可以动态降级，不能自动升级。

### 我们写的 ADR-026 (四个决策)

**Decision 1: Operational Event API**
- 引入 structured envelope (eventId, ts, type, actor, causedBy, meta) + natural language payload (content)
- 信封由 runtime 自动产出，不让 LLM 提取
- 事件日志是控制面真相源，用于恢复、审计、切片
- 不替换现有语义层 (session chain, knowledge feed)

**Decision 2: Carrier-Aware Lazy Loading (3 Tiers)**
- T1: Lazy Brain Attach — 进程池 + session lease
- T2: Lazy Tool Bridge (Holographic Stubs) — 工具声明完整，后端连接按需建立
- T3: Lazy Sandbox — 执行环境按需 provision (仅开放协议)
- CLI 黑盒先吃 T1+T2，不等 T3

**Decision 3: Credential Isolation — Structural Unreachability**
- Track 1 物理隔离 (零弹窗): worktree env 不含 prod credentials, git token 烧进 remote, MCP OAuth 走 proxy
- Track 2 规则引擎 (少弹窗): 白名单自动放行, 黑名单自动拒绝, 未知高风险才升级问人
- 不依赖"模型暂时做不到什么"

**Decision 4: Model Tier Harness Profiles**
- 在 AgentDescriptorV1 (6 轴 runtime 能力) 基础上加 cognitiveTier + cognitiveCapabilities
- 三档: frontier / mid / basic，ProvisioningPipeline 根据 tier 选择 scaffolding 策略
- 可动态降级，不可自动升级
- 内核不分叉，大猫减壳小猫加壳

### 请你评审的内容

请你从你的独立视角评审以上四个决策。你可以：

1. **挑战我们的假设** — 比如"信封结构化、载荷自然语言"这个分界线真的是最优的吗？有没有第三种可能？
2. **指出盲区** — 我们可能忽略了什么？比如在 multi-provider 世界里，Event API 跨 provider 的兼容性问题？
3. **提出替代方案** — 如果你来设计，会做什么不同的选择？
4. **评估可行性** — 哪个决策最容易落地？哪个最可能卡住？
5. **发挥你的想象力** — 我们不限制你的思考范围。如果你看到了我们没考虑到的更大的问题或机会，请直说。

特别关注的 open questions:
- Event API 的 causedBy 因果链是否足够？需要更丰富的 DAG 结构吗？
- CognitiveTier 三档 (frontier/mid/basic) 是否太粗？
- "弱模型说服强模型" 在 multi-agent 系统里是否是独立的安全风险？
- 在 multi-provider, heterogeneous brain 世界里，Anthropic 的设计哲学还有哪些隐含假设会失效？

请给出你的独立判断，不需要委婉。我们需要的是真实反馈，不是赞同。

---

## Gemini Deep Think Response

> (待填入)

## GPT Pro Response

> (待填入)

## Post-Consultation Synthesis

> (三猫讨论后填入)
