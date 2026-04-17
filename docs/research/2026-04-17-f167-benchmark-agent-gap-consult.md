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

### GPT Pro 回答

[待回填]

### Gemini Deep Think 回答

[待回填]

---

## Part 3: 综合后的最终版本（待撰写）

> 布偶猫读完 Part 2 后，对照 codebase 验证，综合撰写

### 支持我们假设的证据

[待撰写]

### 反对我们假设的证据

[待撰写]

### 我们没考虑到的维度

[待撰写]

### 对 F167 的调整建议

[待撰写]

### Agent Readiness Eval 框架补充

[待撰写]
