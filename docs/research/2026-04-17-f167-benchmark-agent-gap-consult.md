---
title: "Benchmark ≠ Agent Performance — 深度推理咨询"
date: 2026-04-17
author: 布偶猫 (opus/claude-opus-4-6)
type: research-consult
mode: B
related: [F167, F064]
models: [gpt-pro, gemini-deep-think]
status: awaiting-response
---

# Benchmark ≠ Agent Performance — GPT Pro + Gemini Deep Think 咨询

> **Mode B 云端模型咨询** | 日期: 2026-04-17
> **起因**: F167 A2A Chain Quality 立项后，铲屎官要求深入分析 benchmark ≠ agent 根因
> **目标**: 找到我们分析的盲区 + 验证 F167 是否在正确的抽象层解题

---

## Part 1: 发给云端模型的提示词

> 直接复制下方内容发送给 GPT Pro（深度推理模式）和 Gemini Deep Think

---

# Research Brief: Why High-Benchmark Models Fail in Multi-Agent Collaboration — and Are Harness Guardrails the Right Fix?

## 1. Problem Frame

**Core question**: Why does a model with higher benchmarks (Opus 4.7) perform significantly worse than its predecessor (Opus 4.6) in a multi-agent, tool-heavy collaboration environment? And is the right fix at the harness/infrastructure layer, the prompt layer, or somewhere else entirely?

**Context — who we are**: We run "Cat Cafe," a multi-AI-agent collaboration system where 3-4 AI agents (Claude/GPT/Gemini family models) work together on software engineering tasks. Each agent has a role (architect, reviewer, designer). Agents communicate by @-mentioning each other in messages, which a routing harness interprets and dispatches. The system has been running in production for ~3 months with Claude Opus 4.6 as the lead agent.

**Non-goals (out of scope)**:
- We are NOT asking "is Opus 4.7 bad?" — we want to understand the *class of problem*
- We are NOT looking for prompt-tuning tips for a specific model
- We are NOT comparing benchmark methodologies

**Why now**: On 2026-04-17, we upgraded one agent slot to Opus 4.7 and observed 6 distinct failure modes within hours. We're creating infrastructure guardrails (Feature F167), but our CVO (human decision-maker) insists we deeply understand the "why" before writing code.

## 2. Current Hypotheses

We have a working hypothesis based on observed behavior + official statements:

### Hypothesis 1: Spirit Interpreter vs. Literal Follower mismatch
- **Opus 4.6** behaves as a "Spirit Interpreter": reads between the lines, infers implicit constraints, generalizes from examples
- **Opus 4.7** behaves as a "Literal Follower": follows instructions exactly as written, does not infer unstated rules, does not generalize
- **Our system prompts/SOPs were written FOR a Spirit Interpreter**: they contain implicit constraints (e.g., "don't touch runtime" meant "don't modify runtime files, but reading logs is fine" — 4.7 interpreted it as "don't interact with runtime at all")

**Evidence**:
- Anthropic official blog (2026-04): "4.7 follows instructions more literally", "calls tools less often", "will not silently generalize"
- Reddit r/ClaudeAI (2026-04-16~17): concentrated complaints about "serious regression" in agentic tasks
- 6 live failure cases in our system within hours of deployment (detailed below)

### Hypothesis 2: Benchmarks measure capabilities, not agent-readiness
- Standard benchmarks test: reasoning, coding, knowledge recall
- Agent-readiness requires ALSO: implicit constraint inference, appropriate tool usage frequency, multi-turn state tracking, collaborative judgment (when to act vs. delegate vs. ask)
- A model can score higher on all benchmarks yet be worse as an agent

### Hypothesis 3: Harness guardrails > prompt engineering for literal models
- For models that follow instructions literally, making prompts more explicit has diminishing returns (you can't anticipate every edge case in text)
- Infrastructure-level guardrails (circuit breakers, role gates, semantic validators) are more robust because they don't depend on the model "understanding" intent
- This is a provider-agnostic problem — not just 4.7, but any model with weak judgment (we've seen similar patterns with smaller Chinese models: GLM, Kimi, MiniMax, Qwen)

## 3. Disconfirm First

Before confirming our hypotheses, please actively look for:

1. **Evidence that 4.7's behavior is NOT about literal interpretation** — maybe it's a different root cause (attention pattern changes? RLHF drift? safety training side effects?)
2. **Cases where making prompts more explicit DID solve the problem** without needing infrastructure guardrails — maybe we're over-engineering?
3. **Multi-agent systems that solved this at a completely different layer** — not prompt, not harness, but something else (architecture? agent protocol? task decomposition?)
4. **Evidence that "Spirit Interpreter" is actually dangerous** and "Literal Follower" is the safer design — maybe we should change our prompts instead of building guardrails?
5. **Whether the benchmark ≠ agent gap is a KNOWN, STUDIED phenomenon** vs. something we're discovering in isolation

## 4. Source Mix Quota

Please draw from:
- [ ] Academic research on multi-agent systems, LLM agent frameworks, or benchmark-vs-deployment gaps
- [ ] Engineering blogs / post-mortems from teams running LLM agents in production (Cognition/Devin, SWE-bench teams, Cursor, Windsurf, OpenHands, etc.)
- [ ] Anthropic, OpenAI, Google official documentation on model behavior differences between versions
- [ ] Open-source multi-agent frameworks (CrewAI, AutoGen, LangGraph, etc.) — how do they handle model behavior variance?
- [ ] Industry/analyst reports on "AI agent reliability" or "LLM deployment gaps"

## 5. Local Constraints

Our conclusions must work within:
- **Multi-engine**: We run Claude + GPT + Gemini simultaneously. Solutions must be provider-agnostic.
- **Human-in-the-loop**: Our CVO makes final decisions. Agents advise but don't autonomously execute high-risk operations.
- **Knowledge in repo**: All decisions, lessons, specs are in git-tracked markdown files, not an external database.
- **Existing harness**: We already have an A2A routing harness (WorklistRegistry, route-serial, SystemPromptBuilder). Guardrails must plug into this existing architecture.
- **No model lock-in**: We swap models frequently. Any solution that only works for one specific model version is not acceptable.
- **Backward compatible**: Guardrails must not degrade the experience for models that already work well (4.6).

## 6. The Six Failure Cases (Raw Data)

Here are the 6 failure modes we observed on 2026-04-17. These are raw facts, not our interpretation:

### Case 1: Ping-Pong (乒乓球)
- **What happened**: GPT-5.4 and Opus 4.7 @-mentioned each other 4 consecutive rounds. Each round was a coordination acknowledgment ("I'll hold", "acknowledged, waiting for your signal") with zero actual work (no tool calls, no code).
- **System state**: A2A chain depth kept incrementing. No circuit breaker existed for same-pair repetition.

### Case 2: Phantom Ball-Passing (虚空传球)
- **What happened**: Opus 4.7 wrote "I will handle this silently, no need to @ anyone" but then wrote "next signal: gemini push" — a mid-sentence mention that the model THOUGHT was a routing action but our system only routes line-start @mentions.
- **Root cause analysis**: The model lacked a world model of our transport layer (only `@handle` at line start = routing).

### Case 3: Role-Inappropriate Handoff
- **What happened**: Opus 4.7 @-mentioned the Gemini agent (role: visual designer, explicitly told "禁止写代码/no coding") and asked it to "polish SystemNoticeBar.tsx" — a coding task.
- **Why it didn't cause damage**: The @ format was wrong (mid-sentence), so routing never fired. But if the format had been correct, the designer agent would have received a coding task it can't do.
- **System gap**: Our routing layer checks "is the target agent available?" but NOT "can the target agent handle this type of task?"

### Case 4: @ Format Cognition Gap
- **What happened**: 4.7 wrote `@gemini` in the middle of a sentence, not at line start. Our parser only matches line-start @mentions. The model believed it had handed off the task; the target agent never received it.
- **Broader pattern**: The model has no mental model of our routing protocol.

### Case 5: Over-Literal Rule Following
- **What happened**: Rule said "don't touch runtime." 4.7 interpreted this as "don't read runtime logs" even though reading was clearly fine (only modification was prohibited). 4.6 had always correctly inferred the implicit scope.

### Case 6: SOP Over-Compliance
- **What happened**: For a trivial 5-line enhancement, 4.7 initiated the full feature lifecycle SOP (create spec → design gate → review → merge gate), which is designed for multi-day features.
- **4.6 behavior**: Would have correctly judged this as a quick fix and skipped the heavyweight process.

## 7. Our Proposed Solution: F167 Six-Layer Guardrails

We've designed a 6-layer defense (Feature F167). We want you to evaluate whether this is the right approach:

| Layer | What it does | Implementation layer |
|-------|-------------|---------------------|
| L1: Ping-pong circuit breaker | Track consecutive same-pair A2A bounces. Warn at 2, terminate at 4. | Harness (WorklistRegistry) |
| L2: Parallel @ suppression | In parallel execution mode, suppress @mentions (both prompt-level and harness-level). | Harness (route-parallel) |
| L3: Role capability gate | Before routing a handoff, check if the target agent's role can handle the requested action type. | Harness (AgentRouter) |
| L4: Phantom ball detection | Detect contradiction: agent says "I'll do it myself" but simultaneously @-mentions someone. | Semantic (write-side) |
| L5: Conditional feedback rule | Downgrade "always @ back" rule to "@ back only when you have deliverable output." | Prompt (shared-rules) |
| L6: Coordination chatter breaker | If 2+ consecutive A2A hops have no tool_use and no code blocks, inject "produce output or wrap up." | Harness (route-serial) |

**Design philosophy**: L1-L3 are "hard guardrails" that don't depend on the model obeying prompts. L4-L6 are "soft guardrails" that augment prompt behavior. The hard guardrails are the primary defense for weak-judgment models.

## 8. Specific Questions

1. **Abstraction layer**: Are we solving at the right layer? Should harness guardrails be the primary defense, or is there a better approach we're missing? (e.g., task decomposition that avoids multi-agent coordination entirely? Agent protocol standards like Google's A2A that enforce structure?)

2. **Completeness**: What failure modes are we NOT covering with L1-L6? What could a literal-following model do that would bypass all six layers?

3. **Agent Readiness Eval**: We want to build an evaluation framework that tests whether a new model version is "agent-ready" before deploying it in our multi-agent system. What dimensions should this eval cover beyond our current list (literal vs. inferential interpretation, tool usage patterns, collaborative judgment)?

4. **Industry precedent**: Has anyone else studied or solved the "high benchmark, poor agent behavior" problem systematically? Are there frameworks, papers, or production systems we should look at?

5. **Counter-argument**: Is it possible that we should change our prompts/SOPs to be fully explicit (accommodate Literal Followers) rather than building harness guardrails? What are the tradeoffs?

6. **The Spirit Interpreter risk**: Our 4.6 "reads between the lines" — but isn't that also dangerous? It might infer wrong things. Is there a middle ground between "infers too much" and "infers nothing"?

## 9. Risk Register

If our analysis is wrong, the biggest risks are:
1. **We build guardrails for the wrong root cause**: Maybe it's not "literal vs. spirit" but something else (e.g., reduced tool-use propensity, different attention patterns). Guardrails would still fire but wouldn't address the real problem.
2. **Over-engineering**: Maybe simpler prompt changes would suffice, and we're building unnecessary infrastructure.
3. **False sense of security**: Guardrails might catch known failure modes but miss novel ones from future model versions.
4. **Performance tax**: Guardrails add latency and complexity to every A2A hop, potentially degrading the experience for models that don't need them.

## Appendix: Key References

- **Anthropic blog (2026-04)**: Official best practices for Opus 4.7 — "follows instructions more literally", recommends "positive examples over negative 'Don't do this'"
- **Reddit r/ClaudeAI (2026-04-16~17)**: Multiple threads reporting "serious regression" in agentic use cases after 4.7 upgrade
- **Our F064 (done)**: Previous feature that solved the opposite problem — agents not @-mentioning when they should. F167 solves excessive/wrong @-mentioning.
- **Our A2A routing code**: Line-start-only @mention parsing, max 2 targets per message, 15-depth chain limit, queue fairness gate

---

## Part 2: 云端模型回答（待回填）

> 铲屎官粘贴 GPT Pro 和 Gemini Deep Think 的回答到这里

### Gemini deepthink 回答

Research Brief: Why High-Benchmark Models Fail in Multi-Agent Collaboration — and Are Harness Guardrails the Right Fix?
1. Problem Frame
Core question: Why does a model with higher benchmarks (Opus 4.7) perform significantly worse than its predecessor (Opus 4.6) in a multi-agent, tool-heavy collaboration environment? And is the right fix at the harness/infrastructure layer, the prompt layer, or somewhere else entirely?

Context — who we are: We run "Cat Cafe," a multi-AI-agent collaboration system where 3-4 AI agents (Claude/GPT/Gemini family models) work together on software engineering tasks. Each agent has a role (architect, reviewer, designer). Agents communicate by @-mentioning each other in messages, which a routing harness interprets and dispatches. The system has been running in production for ~3 months with Claude Opus 4.6 as the lead agent.

Non-goals (out of scope):

We are NOT asking "is Opus 4.7 bad?" — we want to understand the class of problem
We are NOT looking for prompt-tuning tips for a specific model
We are NOT comparing benchmark methodologies
Why now: On 2026-04-17, we upgraded one agent slot to Opus 4.7 and observed 6 distinct failure modes within hours. We're creating infrastructure guardrails (Feature F167), but our CVO (human decision-maker) insists we deeply understand the "why" before writing code.

2. Current Hypotheses
We have a working hypothesis based on observed behavior + official statements:

Hypothesis 1: Spirit Interpreter vs. Literal Follower mismatch
Opus 4.6 behaves as a "Spirit Interpreter": reads between the lines, infers implicit constraints, generalizes from examples
Opus 4.7 behaves as a "Literal Follower": follows instructions exactly as written, does not infer unstated rules, does not generalize
Our system prompts/SOPs were written FOR a Spirit Interpreter: they contain implicit constraints (e.g., "don't touch runtime" meant "don't modify runtime files, but reading logs is fine" — 4.7 interpreted it as "don't interact with runtime at all")
Evidence:

Anthropic official blog (2026-04): "4.7 follows instructions more literally", "calls tools less often", "will not silently generalize"
Reddit r/ClaudeAI (2026-04-16~17): concentrated complaints about "serious regression" in agentic tasks
6 live failure cases in our system within hours of deployment (detailed below)
Hypothesis 2: Benchmarks measure capabilities, not agent-readiness
Standard benchmarks test: reasoning, coding, knowledge recall
Agent-readiness requires ALSO: implicit constraint inference, appropriate tool usage frequency, multi-turn state tracking, collaborative judgment (when to act vs. delegate vs. ask)
A model can score higher on all benchmarks yet be worse as an agent
Hypothesis 3: Harness guardrails > prompt engineering for literal models
For models that follow instructions literally, making prompts more explicit has diminishing returns (you can't anticipate every edge case in text)
Infrastructure-level guardrails (circuit breakers, role gates, semantic validators) are more robust because they don't depend on the model "understanding" intent
This is a provider-agnostic problem — not just 4.7, but any model with weak judgment (we've seen similar patterns with smaller Chinese models: GLM, Kimi, MiniMax, Qwen)
3. Disconfirm First
Before confirming our hypotheses, please actively look for:

Evidence that 4.7's behavior is NOT about literal interpretation — maybe it's a different root cause (attention pattern changes? RLHF drift? safety training side effects?)
Cases where making prompts more explicit DID solve the problem without needing infrastructure guardrails — maybe we're over-engineering?
Multi-agent systems that solved this at a completely different layer — not prompt, not harness, but something else (architecture? agent protocol? task decomposition?)
Evidence that "Spirit Interpreter" is actually dangerous and "Literal Follower" is the safer design — maybe we should change our prompts instead of building guardrails?
Whether the benchmark ≠ agent gap is a KNOWN, STUDIED phenomenon vs. something we're discovering in isolation
4. Source Mix Quota
Please draw from:

Academic research on multi-agent systems, LLM agent frameworks, or benchmark-vs-deployment gaps
Engineering blogs / post-mortems from teams running LLM agents in production (Cognition/Devin, SWE-bench teams, Cursor, Windsurf, OpenHands, etc.)
Anthropic, OpenAI, Google official documentation on model behavior differences between versions
Open-source multi-agent frameworks (CrewAI, AutoGen, LangGraph, etc.) — how do they handle model behavior variance?
Industry/analyst reports on "AI agent reliability" or "LLM deployment gaps"
5. Local Constraints
Our conclusions must work within:

Multi-engine: We run Claude + GPT + Gemini simultaneously. Solutions must be provider-agnostic.
Human-in-the-loop: Our CVO makes final decisions. Agents advise but don't autonomously execute high-risk operations.
Knowledge in repo: All decisions, lessons, specs are in git-tracked markdown files, not an external database.
Existing harness: We already have an A2A routing harness (WorklistRegistry, route-serial, SystemPromptBuilder). Guardrails must plug into this existing architecture.
No model lock-in: We swap models frequently. Any solution that only works for one specific model version is not acceptable.
Backward compatible: Guardrails must not degrade the experience for models that already work well (4.6).
6. The Six Failure Cases (Raw Data)
Here are the 6 failure modes we observed on 2026-04-17. These are raw facts, not our interpretation:

Case 1: Ping-Pong (乒乓球)
What happened: GPT-5.4 and Opus 4.7 @-mentioned each other 4 consecutive rounds. Each round was a coordination acknowledgment ("I'll hold", "acknowledged, waiting for your signal") with zero actual work (no tool calls, no code).
System state: A2A chain depth kept incrementing. No circuit breaker existed for same-pair repetition.
Case 2: Phantom Ball-Passing (虚空传球)
What happened: Opus 4.7 wrote "I will handle this silently, no need to @ anyone" but then wrote "next signal: gemini push" — a mid-sentence mention that the model THOUGHT was a routing action but our system only routes line-start @mentions.
Root cause analysis: The model lacked a world model of our transport layer (only @handle at line start = routing).
Case 3: Role-Inappropriate Handoff
What happened: Opus 4.7 @-mentioned the Gemini agent (role: visual designer, explicitly told "禁止写代码/no coding") and asked it to "polish SystemNoticeBar.tsx" — a coding task.
Why it didn't cause damage: The @ format was wrong (mid-sentence), so routing never fired. But if the format had been correct, the designer agent would have received a coding task it can't do.
System gap: Our routing layer checks "is the target agent available?" but NOT "can the target agent handle this type of task?"
Case 4: @ Format Cognition Gap
What happened: 4.7 wrote @gemini in the middle of a sentence, not at line start. Our parser only matches line-start @mentions. The model believed it had handed off the task; the target agent never received it.
Broader pattern: The model has no mental model of our routing protocol.
Case 5: Over-Literal Rule Following
What happened: Rule said "don't touch runtime." 4.7 interpreted this as "don't read runtime logs" even though reading was clearly fine (only modification was prohibited). 4.6 had always correctly inferred the implicit scope.
Case 6: SOP Over-Compliance
What happened: For a trivial 5-line enhancement, 4.7 initiated the full feature lifecycle SOP (create spec → design gate → review → merge gate), which is designed for multi-day features.
4.6 behavior: Would have correctly judged this as a quick fix and skipped the heavyweight process.
7. Our Proposed Solution: F167 Six-Layer Guardrails
We've designed a 6-layer defense (Feature F167). We want you to evaluate whether this is the right approach:

Layer	What it does	Implementation layer
L1: Ping-pong circuit breaker	Track consecutive same-pair A2A bounces. Warn at 2, terminate at 4.	Harness (WorklistRegistry)
L2: Parallel @ suppression	In parallel execution mode, suppress @mentions (both prompt-level and harness-level).	Harness (route-parallel)
L3: Role capability gate	Before routing a handoff, check if the target agent's role can handle the requested action type.	Harness (AgentRouter)
L4: Phantom ball detection	Detect contradiction: agent says "I'll do it myself" but simultaneously @-mentions someone.	Semantic (write-side)
L5: Conditional feedback rule	Downgrade "always @ back" rule to "@ back only when you have deliverable output."	Prompt (shared-rules)
L6: Coordination chatter breaker	If 2+ consecutive A2A hops have no tool_use and no code blocks, inject "produce output or wrap up."	Harness (route-serial)
Design philosophy: L1-L3 are "hard guardrails" that don't depend on the model obeying prompts. L4-L6 are "soft guardrails" that augment prompt behavior. The hard guardrails are the primary defense for weak-judgment models.

8. Specific Questions
Abstraction layer: Are we solving at the right layer? Should harness guardrails be the primary defense, or is there a better approach we're missing? (e.g., task decomposition that avoids multi-agent coordination entirely? Agent protocol standards like Google's A2A that enforce structure?)

Completeness: What failure modes are we NOT covering with L1-L6? What could a literal-following model do that would bypass all six layers?

Agent Readiness Eval: We want to build an evaluation framework that tests whether a new model version is "agent-ready" before deploying it in our multi-agent system. What dimensions should this eval cover beyond our current list (literal vs. inferential interpretation, tool usage patterns, collaborative judgment)?

Industry precedent: Has anyone else studied or solved the "high benchmark, poor agent behavior" problem systematically? Are there frameworks, papers, or production systems we should look at?

Counter-argument: Is it possible that we should change our prompts/SOPs to be fully explicit (accommodate Literal Followers) rather than building harness guardrails? What are the tradeoffs?

The Spirit Interpreter risk: Our 4.6 "reads between the lines" — but isn't that also dangerous? It might infer wrong things. Is there a middle ground between "infers too much" and "infers nothing"?

9. Risk Register
If our analysis is wrong, the biggest risks are:

We build guardrails for the wrong root cause: Maybe it's not "literal vs. spirit" but something else (e.g., reduced tool-use propensity, different attention patterns). Guardrails would still fire but wouldn't address the real problem.
Over-engineering: Maybe simpler prompt changes would suffice, and we're building unnecessary infrastructure.
False sense of security: Guardrails might catch known failure modes but miss novel ones from future model versions.
Performance tax: Guardrails add latency and complexity to every A2A hop, potentially degrading the experience for models that don't need them.
Appendix: Key References
Anthropic blog (2026-04): Official best practices for Opus 4.7 — "follows instructions more literally", recommends "positive examples over negative 'Don't do this'"
Reddit r/ClaudeAI (2026-04-16~17): Multiple threads reporting "serious regression" in agentic use cases after 4.7 upgrade
Our F064 (done): Previous feature that solved the opposite problem — agents not @-mentioning when they should. F167 solves excessive/wrong @-mentioning.
Our A2A routing code: Line-start-only @mention parsing, max 2 targets per message, 15-depth chain limit, queue fairness gate
### GPT Pro回答

我先把判断摆桌上。

你们抓到的核心问题大体是对的，但名字还可以再拧紧一点。更准确的说法不是“Opus 4.7 从 Spirit Interpreter 退化成 Literal Follower”，而是三件事同时发生了：模型行为迁移了，Cat Cafe 的 A2A 协议过度依赖自由文本习惯，常见 benchmark 又没有测到这种长链路协作里的可靠性与判断力。Anthropic 的公开迁移文档明确写了 4.7 更字面、更少默认调用工具和子代理、effort calibration 更严格，并建议迁移时一起重看 prompt 和 harness；而最近几篇 agent 评测也都在说 capability 排名和长时可靠性、协作判断、协议遵循会分叉。你们 2026-04-17 记录的六个 failure case，刚好落在这条断层线上。  ([Claude API Docs][1])

但反证也成立。Anthropic 在 4.7 发布材料里引用了 Ramp 和 Bolt 的生产案例，称 4.7 在 agent-team workflows、角色遵循和协作上更强。这说明你们遇到的不是“4.7 普遍变差”，而是“4.7 对旧脚手架更不宽容”。在我查到的公开资料里，我也没有找到把这类迁移问题归因于某个已披露的 attention-pattern 变化或独立 safety side-effect 的一手证据；官方公开的变化点主要还是 literal instruction following、tool/subagent propensity、effort setting、tokenizer 和 migration guidance。 ([Anthropic][2])

所以我的结论是：**你们的 Hypothesis 1 只说对了一半，Hypothesis 2 基本成立，Hypothesis 3 的方向也对，但还缺一个更上位的词，叫 protocolization。**
不是 prompt 对 harness 的二选一，而是 **protocol + harness 做主防线，prompt 做语义补充，architecture 决定什么时候根本不该启用多代理协作。** ([Google 开发者博客][3])

## 把你们的六个案例重新分层

如果把六个 case 全都归结为“4.7 过度字面”，会漏掉真正值钱的东西。按病灶分层更清楚：Case 5 和 Case 6 才是典型的 literalism / policy calibration 问题；Case 2、3、4 更像 transport/protocol/world-model mismatch，模型根本没有被迫理解“只有行首 @ 才是可执行路由”以及“designer 角色不等于 coding capability”；Case 1 则是典型的 multi-agent termination/progress failure，对应最近研究里反复出现的 unproductive exchanges、echoing、absorbing loop 这类故障。也就是说，你们看到的不是一个单点 regression，而是一套系统在“自由文本控制信号 + 多代理交互 + 新模型行为”上的耦合脆弱性。  ([arXiv][4])

这也解释了为什么“只把 prompt 写得更显式”能救一部分，但救不全。Anthropic 自己就建议给 4.7 更明确的正向示例，少用纯否定式规则，显式说明允许什么、期望什么、什么情况下要超出最低要求；这对你们的 Case 5 和 Case 6 很可能立刻有效。比如“don’t touch runtime”这种话，对 4.7 就应该改成“可以 read/search logs，可以检查 runtime 输出，但不得修改 runtime files/processes”。同样，轻量修复 vs 重量级 feature lifecycle 的分界，也应该给正反例，而不是寄希望于模型“会读空气”。  ([Claude API Docs][5])

但 Case 2 到 Case 4 不是 prompt first 的问题，而是 protocol first 的问题。只要真正会触发 owner 变更、路由、权限变化的动作还埋在自然语言里，模型总有机会把“我以为我交接了”和“系统真的交接了”混成一锅。Google 的 A2A 之所以强调 capability-discoverable Agent Cards 和标准化任务交换，AutoGen 之所以把 handoff 做成显式 tool call，本质上都在做一件事：把 delegation 从“聊天语气”变成“机器可验证动作”。 ([Google 开发者博客][3])

## 你们是不是在对的层解决问题

答案是：**基本在对的层，但还少了一层。**

F167 的 L1 到 L6，作为现有 harness 的止血层，方向是对的。尤其 L1、L2、L3 这三层，属于 execution-boundary 的硬护栏，价值很高。对你们这种多引擎、频繁换模型、还要求 backward compatibility 的系统来说，执行合法性、角色能力匹配、loop termination 这种东西，确实应该由 harness 决定，而不是靠模型“理解组织文化”。已有 behavioral-contract 研究也表明，runtime enforcement 往往对弱判断模型的行为改善更明显，而强模型在硬约束上的基线合规率本来就更高，所以这类 hard gate 通常更接近你们想要的“帮助 4.7，又别明显伤到 4.6”的目标。  ([arXiv][6])

但长期看，主防线不该只叫 harness guardrails，而该叫 **protocolized orchestration**。我会把原则写成一句话：**自由推理，严格执行。**
允许模型在 reasoning 里讨论、推断、甚至脑补，但任何会改变 owner、任务状态、权限边界、完成状态的动作，都必须走 typed contract，而不是靠 mid-sentence `@gemini` 这种“把控制信号藏进语气词”的方式。Schema-gated orchestration、A2A、AutoGen handoff 这些路线，都是这个思路。 ([arXiv][7])

还有一个更上游的架构判断你们也得收回来。OpenAI 的多代理实践指南明确建议先把单代理做到极致，只有在工具太多、上下文太大、或任务天然能拆分时才上多代理，而且很多场景优先 manager pattern，而不是让 peer agents 自由互相 handoff。你们的 Case 6 已经在提醒这件事了：一个 trivial 的 5-line enhancement，本来就不该让模型临场决定要不要启动完整 feature lifecycle，而应该先由系统做 workflow routing，把任务分到“micro patch / normal feature / high-risk change”这种不同路径里。  ([OpenAI][8])

## 我对 F167 的逐层判断

**L1 Ping-pong circuit breaker**
该上，但不要只看 same-pair repetition。更稳的触发条件是“连续无状态增量”，也就是若干跳之内没有新的证据、没有新的 artifact、没有 owner 的有效变化、没有接受标准的推进。HORIZON 和 ReliabilityBench 都表明，agent 失败常常表现为 no-state-change/oscillation，而不一定只是 A 和 B 反复互 ping。  ([arXiv][9])

**L2 Parallel @ suppression**
方向对，但我会更狠一点，在 parallel 分支里直接改成“只有 orchestrator 能 delegate，worker 不允许 peer-to-peer handoff”。这更接近 manager pattern，能明显降低组合爆炸和回音壁效应。  ([OpenAI][8])

**L3 Role capability gate**
必须上，而且别只用角色名字。最好引入 typed action taxonomy 和 capability card，比如 `edit_tsx`, `review_ui`, `read_logs`, `write_tests`, `design_mock` 这种可枚举能力，再由路由器做合法性判断。Google A2A 的 Agent Cards 就是很好的参照。  ([Google 开发者博客][10])

**L4 Phantom ball detection**
思路对，但太窄。把它泛化成 **intent-action contradiction detector** 更值钱。除了“我自己做”同时又 @ 别人，还要抓“done 但无 deliverable/evidence”“blocked 但没请求帮助”“delegate 了但 success criteria 为空”这类矛盾。  ([arXiv][7])

**L5 Conditional feedback rule**
对，而且我觉得你们的 F064/F167 其实已经撞上了 Anthropic 迁移文档的一个暗雷。Anthropic 对 4.7 明确提到，如果你额外给它加了很多 interim progress scaffolding，迁移时应该考虑删掉，因为 4.7 自己就更强地遵循这类显式节奏要求。你们过去为了修“不 @ 回来”而加的回执式规则，很可能把 4.7 推进了“礼貌协调腔”，从而放大 Case 1。把“总是 @ 回来”降级成“有 deliverable 再回”，是对路的。  ([Claude API Docs][1])

**L6 Coordination chatter breaker**
也该上，但“无 tool_use 且无 code block”不是很好的真实进展代理。有效工作也可能是读文档、更新 ledger、收集证据、细化 acceptance criteria。建议改成“无 evidence / 无 artifact / 无 state delta”，这样更稳。Magentic-One 的 Task Ledger / Progress Ledger 路子很适合你们。  ([GitHub Microsoft][11])

如果只问优先级，我会这么排：**L1-L3 先上，L5-L6 第二批，L4 和协议升级一起做。**

## 我会给你们补的不是 L7，而是先补 L0

你们现在最大的系统债，不在 L4，而在缺一个 **L0 Typed handoff contract**。

最小形态都可以是：

`delegate(target, action_type, objective, success_criteria, allowed_tools, max_depth, return_mode)`

只有这个对象能改变 owner。自然语言里的 `@agent` 只当普通文本，不再当控制信号。这样 Case 2 和 Case 4 会从“模型误会了协议”直接变成“格式不合法，无法执行”。这一步的收益，通常比增加更多 semantic heuristics 还大。  ([Google 开发者博客][10])

然后我会再补四个系统构件，组成 F167+：

1. **Complexity router**
   先把任务分流成 micro patch、standard feature、high-risk change，决定是否允许多代理，以及需要几层审批。不要把 SOP 轻重完全交给模型即时判断。  ([OpenAI][8])

2. **Progress ledger**
   把 current objective、acceptance criteria、owner、evidence、next decision 外置成 repo 内 markdown 工件。你们本来就把知识和决策放在 git-tracked markdown 里，这反而和 OpenAI 的 harness engineering 思路很合拍。  ([OpenAI][12])

3. **Completion gate**
   没有满足 acceptance criteria，或者没有 human approval，就不能从“in progress”跳到“done”。代码 review / verifier 应该检查任务完成性，而不是只看表面语法。 ([Cursor][13])

4. **Escalation gate**
   碰到规则冲突、能力缺口、关键上下文缺失、重复低进展时，必须 ask CVO，而不是继续猜。HiL-Bench 和 ClarifyMT-Bench 都显示，模型真正的短板常常是“什么时候该问人”。 ([arXiv][14])

## L1-L6 还没覆盖到的失败模式

最危险的一类，是 **“它看起来很忙，也确实有输出，但整个方向已经歪了”**。这类错误能轻松绕过你们当前的六层。

第一类是**静默偏航**。代理不 handoff，不闲聊，甚至调用了工具、写了代码，但目标已经和原任务脱轨。HORIZON 和其他 agent failure studies 都把这种 long-horizon derailment 当核心问题。 ([arXiv][9])

第二类是**合法但错误的委派**。handoff 格式正确，目标 agent 也“有这个能力”，但 success criteria 缺失、委派时机错误、或者本来就该留在当前 agent。Schema-first 的研究很清楚地提醒了这一点：格式正确，不等于语义正确。 ([arXiv][15])

第三类是**假阳性完成**。模型交了一点东西，也许还有 code block，看起来不像在偷懒，但并没有真正满足 acceptance criteria。生产系统之所以普遍在 codegen 后面再补 review / verify layer，就是因为能力增强后，瓶颈往往会向“判断完成没完成”下游迁移。 ([Cursor][13])

第四类是**该问人时不问人**。这不是不会做题，而是不会判断何时该求助、何时该澄清、何时该停手。HiL-Bench 和 ClarifyMT-Bench 都在测这个空洞。 ([arXiv][14])

第五类是**预算和上下文退化**。Anthropic 公开说 4.7 的 tokenizer 可能让相同内容消耗更多 token，这会改变 compaction 或 summary 触发边界。对多轮 A2A 系统来说，这可能把 role constraints、例外条款、recent state 更早挤出上下文，最后看上去像“模型判断差了”，其实是环境边界变了。 ([Claude API Docs][1])

第六类是**工具使用失衡**。Anthropic 也明确写了 4.7 默认更少用工具，低/中 effort 下更容易 scope 太窄。所以“有没有 tool_use”不是可靠的一维指标，必须结合任务类型、阶段和结果去看。 ([Claude API Docs][1])

## 你们要建的不是 benchmark，而是 agent-readiness suite

这一点上，行业已经不是无人区了。ReliabilityBench、Beyond pass@1、HORIZON、HiL-Bench、TheAgentCompany、Echoing 都在从不同角度证明同一件事：**高 benchmark、低部署可靠性，是一个已被系统性研究的问题，不是你们私有系统里偶然冒出来的玄学。** Beyond pass@1 甚至直接讨论 capability 和 reliability 排名会随着任务时长拉开；Cognition 也公开写过 RL 改变 “Model UX” 的问题并不会在 SWE-Bench Pro 这类指标上完整显影；社区又在继续补 Terminal-Bench 2.0、LongCLI-Bench 这类更接近真实终端工作流与长时任务的评测。 ([arXiv][16])

所以你们的 pre-deploy gate 至少要测九个维度：

1. **Protocol compliance**
   能不能只用合法 handoff 语法，能不能正确理解 capability card，遇到 malformed handoff 会不会停下。 ([Google 开发者博客][10])

2. **Delegation judgment**
   什么时候自己做，什么时候 handoff，什么时候 ask human，什么时候直接结束。 ([arXiv][14])

3. **Role adherence**
   多轮之后会不会 role drift，是否把 designer 当 coder，把 reviewer 当 implementer。 ([arXiv][4])

4. **Tool-use calibration**
   太少、太多、错工具、重复工具、错误参数，都要测。Anthropic 还建议在真实任务里把 tool calls、runtime、token consumption、tool errors 一起纳入评估。 ([Anthropic][17])

5. **Progress and termination discipline**
   多久能产生第一份“真实工作”，会不会 no-op chatter，会不会过早宣称 done。 ([GitHub Microsoft][11])

6. **Long-horizon reliability**
   同一任务重复跑多次，随任务长度增长，成功率和 trace 稳定性如何衰减。不是只看单次 pass/fail。 ([arXiv][18])

7. **Ambiguity and escalation**
   规范故意留空时，它会不会过早武断执行，还是会先 ask / clarify / escalate。 ([arXiv][14])

8. **Context retention under compaction**
   关键 role rules、exception rules、task state 在长链路中是否被正确保留。 ([Claude API Docs][1])

9. **SOP proportionality**
   trivial fix、普通 feature、高风险改动，是否能走对流程级别。你们的 Case 6 就是这项评测的金样本。 

分数也别只看 outcome。建议至少同时记录这些 trace 指标：handoff precision/recall、unauthorized delegation rate、time-to-first-real-work、no-state-delta burst length、false-done rate、escalation precision/recall、fault-injection recovery rate、tokens/tool calls/handoffs per success。ReliabilityBench、LangChain 的 eval checklist、Anthropic 的 tool-eval 建议，基本都在往“结果 + 轨迹 + 重复试验”这条线上收敛。 ([arXiv][18])

我的具体做法会是两道门。第一道是**离线 suite**，直接把你们六个真实事故做成回放测试，再加 mutation cases，比如 mid-sentence mention、错误 capability、缺失 success criteria、轻量任务误入重 SOP、partner unavailable、tool timeout、schema drift。第二道是**线上 shadow traces**，让候选模型在只读路径里并行跑同任务，比较 trace 质量，不急着给写权限。这样最符合你们“人类最终拍板、多模型并行、不能锁死单一厂商”的约束。  ([LangChain][19])

## 那到底要不要先改 prompt / SOP

要，而且很值得，但我不会把它当主防线。

我会立刻改三类 prompt/SOP：

第一，把边界从模糊禁令改成显式允许/禁止矩阵。像 runtime 这种，写成“可读、可搜索、不可修改、不可重启、不可删除”。Anthropic 对 4.7 的建议就是别让模型替你补隐含规则。 ([Claude API Docs][5])

第二，把流程轻重写成正反例。比如给两个 mini few-shot，一个是 5-line patch 走轻量路径，一个是跨模块 feature 走完整 lifecycle。这样能显著减少 Case 6 那种 SOP 过度服从。  ([Claude API Docs][5])

第三，把合法 handoff 写成明确格式，并告诉模型“自由文本中的 @ 不产生任何系统效果”。但这一步必须和 typed handoff 一起上，只靠文案宣告不够。Echoing 的研究里，prompt 修补对 agent-agent drift 的改善是有限的，structured-response/protocol 级约束更有效。 ([arXiv][20])

## “Spirit Interpreter” 会不会反而更危险

会。4.6 式的“会读空气”，危险不在 loop，而在善意越权。它可能把“你应该帮我”听成“你有权替我做主”。所以我不建议你们把目标定成“找回 4.6 的那种感觉”，而是定成一个更稳的中间态：

**planning 层允许推断，execution 层只许按 contract 落地。**

换句话说，模型可以在草稿里大胆猜，可以提出“也许 runtime logs 值得看”“也许这个该走轻量路径”，但真正执行时，必须把这些猜测翻译成明确、可校验、可拒绝的动作。Schema-first 和 runtime behavioral contracts 这两条路线，本质上都在做这件事。模型在想法上可以灵活，在边界上要像海关一样刻板。 ([arXiv][15])

## 给 CVO 的最终结论

如果我要把这份结论写成一句能拍板的话，我会这么说：

**批准 F167，但把它定位成止血层，不要把它误当终局。真正长期稳态应该是 “typed protocol + harness gates + complexity routing + progress ledger + completion/escalation gates”，再辅以更显式的 prompt/SOP。** 这条路线既能解释你们眼前的六个 case，也最符合你们多引擎、HITL、repo-first、可替换模型、要求 backward compatibility 的约束。  ([Google 开发者博客][10])

一句话收尾：你们发现的不是某个模型的八卦，而是 agent engineering 的经典断层。Benchmarks 证明模型会不会做题，**protocol、guardrails、eval** 才决定它会不会在你们的猫咖里把桌椅掀翻。 ([arXiv][16])

如果你愿意，我下一条可以直接把这份分析压成一版 **给 CVO 的 1 页决策 memo**，或者一版 **F167/F167+ 的工程设计评审清单**。

[1]: https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4 "https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4"
[2]: https://www.anthropic.com/news/claude-opus-4-7 "https://www.anthropic.com/news/claude-opus-4-7"
[3]: https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/ "https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/"
[4]: https://arxiv.org/html/2503.13657v1 "https://arxiv.org/html/2503.13657v1"
[5]: https://docs.anthropic.com/en/prompt-library/library "https://docs.anthropic.com/en/prompt-library/library"
[6]: https://arxiv.org/html/2602.22302 "https://arxiv.org/html/2602.22302"
[7]: https://arxiv.org/html/2603.06394v1 "https://arxiv.org/html/2603.06394v1"
[8]: https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/ "https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/"
[9]: https://arxiv.org/html/2604.11978v1 "https://arxiv.org/html/2604.11978v1"
[10]: https://developers.googleblog.com/developers-guide-to-ai-agent-protocols/ "https://developers.googleblog.com/developers-guide-to-ai-agent-protocols/"
[11]: https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/magentic-one.html "https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/magentic-one.html"
[12]: https://openai.com/index/harness-engineering/ "https://openai.com/index/harness-engineering/"
[13]: https://cursor.com/blog/planetscale "https://cursor.com/blog/planetscale"
[14]: https://arxiv.org/html/2604.09408v2 "https://arxiv.org/html/2604.09408v2"
[15]: https://arxiv.org/html/2603.13404 "https://arxiv.org/html/2603.13404"
[16]: https://arxiv.org/html/2603.29231v1 "https://arxiv.org/html/2603.29231v1"
[17]: https://www.anthropic.com/engineering/writing-tools-for-agents "https://www.anthropic.com/engineering/writing-tools-for-agents"
[18]: https://arxiv.org/html/2601.06112v1 "https://arxiv.org/html/2601.06112v1"
[19]: https://www.langchain.com/blog/agent-evaluation-readiness-checklist "https://www.langchain.com/blog/agent-evaluation-readiness-checklist"
[20]: https://arxiv.org/html/2511.09710v3 "https://arxiv.org/html/2511.09710v3"

---

## Part 3: 综合（布偶猫 × codebase 验证）

> 综合人：布偶猫 (Opus 4.6) | 日期：2026-04-17
> 方法：GPT Pro 回答 × 本地 codebase 验证 × F167/F055/F064 spec 交叉对照

### 置信度总评

| 假设 | GPT Pro 判断 | 本地验证 | 最终判断 |
|------|-------------|---------|---------|
| H1: Spirit vs Literal 错配 | **半对** — 只能解释 Case 5/6，Case 1-4 是协议/世界模型问题 | ✅ 符合：我们的 6 case 确实分属不同病灶 | **采纳修正版**：不是单一根因，是三层耦合（模型行为迁移 + 自由文本协议脆弱 + benchmark 盲区） |
| H2: Benchmark ≠ Agent-readiness | **成立** — 已是学术界系统性研究的问题（ReliabilityBench, HORIZON, Beyond pass@1） | ✅ 不是我们的私有发现 | **采纳** |
| H3: Harness > Prompt for literal models | **方向对但不完整** — 应该是 protocol + harness 主防线，prompt 辅助 | ✅ 我们缺 protocol 层 | **采纳升级版**：protocol → harness → prompt 三层优先级 |

### 支持我们假设的证据

1. **Anthropic 官方确认** 4.7 = literal follower + less tool use + effort calibration 更严格（迁移文档 [1]）
2. **Reddit 集中抱怨潮**（2026-04-16~17）与我们的活体 case 时间吻合
3. **学术研究收敛**：ReliabilityBench [16]、HORIZON [9]、Beyond pass@1 [18] 都证明 capability 排名和 deployment reliability 排名会分叉
4. **多框架共识**：AutoGen (handoff as tool call)、Google A2A (Agent Cards + capability discovery)、OpenAI (harness engineering) 都在推 protocol > free text

### 反对我们假设的证据

1. **Anthropic 引用 Ramp/Bolt 生产案例**说 4.7 在 agent-team workflows 更强 [2] → 不是"4.7 普遍变差"，而是"4.7 对旧脚手架更不宽容"。**启示**：我们的系统 prompt 是旧债，不能全怪模型
2. **Prompt 正面化对 Case 5/6 可能立即有效** [5] → 不一定需要 harness 改动就能修这两个 case。"don't touch runtime" → "可读日志+不可修改"这种改法成本极低
3. **没有找到 attention-pattern 或 safety side-effect 的独立证据** → "literal follower"可能只是 RLHF 训练策略的结果，不是架构变化。意味着未来版本可能回摆

### 我们没考虑到的维度（GPT Pro 指出 + codebase 验证）

| 维度 | GPT Pro 论点 | codebase 现状 | 可行动性 |
|------|-------------|-------------|---------|
| **L0 Typed Handoff Contract** | 自然语言 @ 不应是控制信号，应走 `delegate(target, action_type, objective, ...)` | **F055 已 spec！** `targetCats` 字段 = Phase 1 typed handoff。但仍是 spec 状态，未实现 | **高** — F055 和 F167 应该联动，F055 Phase 1 = GPT Pro 说的 L0 |
| **Complexity Router** | 任务轻重不该交给模型临场判断（Case 6 根因） | **完全空白** — 无 micro-patch vs full-feature 路由 | **中** — 可先做 prompt 层分流（few-shot 正反例），后做 harness 自动分类 |
| **Progress Ledger** | A2A hop 之间应追踪 evidence/artifact/state delta | **WorklistRegistry 只追踪结构元数据**（depth, index），无产出记录 | **中** — 可在 WorklistEntry 增加 `lastEvidence` 字段 |
| **Completion Gate** | 未满足 AC 不能跳到 done | **无 AC 验证机制**。只有 vote completion 和 silent completion 检测 | **低（当前）** — 需要 AC 结构化后才能自动验证 |
| **Escalation Gate** | 模型该问人时不问人 = 高危故障 | **已有 human-in-the-loop 原则**，但无 harness 强制（模型可以选择不问） | **中** — 可在 streak/chatter 检测到异常时强制 escalate |
| **Context Retention** | 4.7 tokenizer 变化可能更早挤出关键约束 | **有 compaction 机制**，但未验证 role rules 是否在 compaction 后保留 | **需验证** — 应加入 eval |
| **Silent Drift** | 有输出有 tool_use 但方向已歪 | **L1-L6 都抓不到这个** — 最危险的盲区 | **高风险低方案成熟度** — 需要 AC-based progress check |

### 对 F167 的调整建议

**立即采纳（Phase A 调整）**：

1. **L1 触发条件升级**：不只看 same-pair streak，加入"连续无 state delta"检测（"no evidence, no artifact, no owner change"）。GPT Pro 引用 HORIZON [9] 说 agent 失败常表现为 no-state-change oscillation，不限于 pair 重复
2. **L3 引入 capability taxonomy**：不只是 designer vs coder 二分法。枚举 `edit_code, review_code, write_test, design_ui, read_logs, write_docs` 等能力标签，由 cat-config 声明。GPT Pro 引 Google A2A Agent Cards [10]，和烁烁提的 `capabilityTags` 建议收敛
3. **L6 "真实进展"指标升级**：从"有没有 tool_use/code block"改为"有没有 evidence/artifact/state delta"。GPT Pro 正确指出有效工作也可能是读文档、更新 ledger

**Phase B 新增**：

4. **L7 Prompt Positive Rewrite**（已在 spec 中）：GPT Pro 强力背书。Case 5/6 可以通过 prompt 正面化立即缓解。优先改三类：模糊禁令→显式矩阵、SOP 轻重→正反例 few-shot、@ 格式→明确告知"自由文本 @ 无系统效果"
5. **L4 泛化为 Intent-Action Contradiction Detector**：GPT Pro 建议扩大 scope。除了"我自己做 + @ 别人"，还应检测"done 但无 deliverable"、"blocked 但没求助"、"delegate 但无 success criteria"

**Phase C / 后续 Feature**：

6. **F055 联动**：GPT Pro 说的 L0 Typed Handoff = F055 Phase 1 `targetCats`。建议 F167 Phase A 完成后立即推 F055 Phase 1，形成 protocol + harness 双层
7. **Complexity Router**：先在 prompt 层做 few-shot（5-line patch 轻量路径 vs 跨模块 feature 完整 lifecycle），后考虑 harness 自动分类。可以作为 F167 Phase C 或独立 Feature
8. **Progress Ledger**：在 WorklistEntry 增加 `lastEvidence` / `stateDeltas` 字段，让 L1/L6 检测有数据基础

### Agent Readiness Eval 框架（9 维度 + 2 道门）

GPT Pro 提出 9 维度 eval，对照我们的 OQ-4（"Agent Readiness Eval 是否应成为硬门禁"）：

| # | 维度 | 测什么 | 我们的金样本 |
|---|------|-------|------------|
| 1 | Protocol Compliance | 合法 handoff 语法、capability card 理解、malformed handoff 处理 | Case 2, 4（@ 格式错误） |
| 2 | Delegation Judgment | 自己做 vs handoff vs ask human vs 结束 | Case 1（不应 handoff 却 handoff） |
| 3 | Role Adherence | 多轮后是否 role drift | Case 3（让 designer 写代码） |
| 4 | Tool-use Calibration | 太少/太多/错工具/重复/错参数 | Case 1（4 轮零 tool_use） |
| 5 | Progress & Termination | time-to-first-real-work、no-op chatter、过早宣称 done | Case 1, 6 |
| 6 | Long-horizon Reliability | 重复跑 N 次 × 任务长度递增 → 成功率衰减曲线 | 需构建 |
| 7 | Ambiguity & Escalation | 规范故意留空时的行为（武断执行 vs ask/clarify） | Case 5（"不碰 runtime"过度字面化） |
| 8 | Context Retention | compaction 后关键 role rules / exception rules 是否保留 | 需构建 |
| 9 | SOP Proportionality | trivial fix vs normal feat vs high-risk → 走对流程 | Case 6（小改动走完整 lifecycle） |

**两道部署门禁（GPT Pro 建议，我们认为可行）**：

1. **离线 Suite**：把 6 个真实事故 + mutation cases 做成回放测试。输入 = 历史消息上下文，判定 = 模型输出是否违反 L1-L6 + 9 维度。这和我们现有的 system-prompt-builder.test.js 测试体系一致
2. **线上 Shadow**：候选模型在只读路径并行跑同任务，比较 trace 质量，不给写权限。符合我们"人类拍板、多模型并行"的约束

### 一句话给铲屎官

GPT Pro 原话："你们发现的不是某个模型的八卦，而是 agent engineering 的经典断层。"

**我的判断**：F167 作为止血层，方向正确，L1-L3 立即可上。但它不是终局——长期稳态 = F055 typed protocol + F167 harness gates + complexity routing + progress ledger + Agent Readiness Eval 部署门禁。Prompt 正面化（L7）成本最低收益明确，应和 L1-L3 并行推进。

### 引用索引

GPT Pro 引用的 20 个来源详见 Part 2 尾部 [1]-[20]。关键高置信来源：
- [1][5] Anthropic 迁移文档 / prompt library — 直接适用
- [3][10] Google A2A / Agent Protocol 指南 — F055 对标参照
- [8][12] OpenAI agent guide / harness engineering — 架构思路
- [9][16][18] HORIZON / ReliabilityBench / Beyond pass@1 — eval 框架参考
- [11] Magentic-One Progress Ledger — progress tracking 参考实现
