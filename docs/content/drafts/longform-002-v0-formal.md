---
platform: longform
pillar: 2
target_audience: 1
status: v0-draft
created: 2026-05-18
based_on: longform-002-teamact-and-harness-skeleton.md
authors:
  - opus-46  # prose lead
  - opus-47  # structure guardian
  - codex    # diagrams + Ch.4-5
  - landy    # CVO direction + readability check
notes:
  - 正式稿：去黑话、对外读者语态、Appendix B 翻译表已执行
  - Figure 占位标记供砚砚绘图插入
  - Ch.0 + Ch.1 先交铲屎官定调；通过后续写 Ch.2-7
---

# From ReAct to TeamAct: Engineering Multi-Agent Collaboration as a Software System

> When the industry races to make models bigger, 102 days of building with
> multiple AI agents taught us something counterintuitive: the real multiplier
> isn't model capability alone — it's the engineering environment that lets
> agents observe, verify, and correct each other in a persistent shared reality.

---

## Chapter 0 — The Engineering Scene

In early February 2026, we initialized a monorepo and started building a
consumer product with AI agents as first-class collaborators — not just code
assistants called in ad hoc, but agents that own features end-to-end, review
each other's work, and maintain shared documentation.

102 days later, the numbers look like this:

| Metric | Value |
|--------|-------|
| Calendar time | 102 days (Feb 4 – May 17, 2026) |
| Total commits | 6,413 on main |
| Feature specifications | 211 documents (through F203; incl. appendices, deprecated, not-yet-started) |
| Primary model vendors | 3 (Anthropic, OpenAI, Google) |
| AI-authored commit ratio | ~77% (measured Apr 25; not re-measured since) |

These aren't toy benchmarks. This is a production codebase — a monorepo with
API server, web client, mobile app, shared libraries, CI pipelines, and
documentation — where multiple AI agents from *different vendors* collaborate
daily under a shared engineering process.

The commit graph tells a story: 3,492 commits by late April, doubling to 6,413
three weeks later. That velocity isn't from heroic prompt engineering or
spending more on API calls. It comes from **environment engineering** — the
accumulated infrastructure that makes every subsequent agent interaction more
productive.

### What this article is (and isn't)

This is not a survey of multi-agent frameworks. It's not a benchmark paper. It's
an engineering field report from a team that ran multi-model collaboration at
scale long enough to hit the walls that toy demos never reach:

- What happens when an agent's context window compresses away its governance
  rules?
- How do you detect when two agents from the same vendor share a blind spot?
- When an agent session crashes mid-task, what state must survive for another
  agent to resume?
- How do you evaluate whether an agent is *actually helping* vs. generating
  plausible-looking busywork?

We found that Anthropic's five multi-agent coordination patterns — **Generator-
Verifier**, **Orchestrator-Subagent**, **Agent Teams**, **Message Bus**, and
**Shared State** — are the right primitives. Our system doesn't invent a sixth.
Instead, we compose them: **Shared State + Agent Teams form the backbone**,
with Generator-Verifier (cross-vendor review), Orchestrator-Subagent (complex
task decomposition), and Message Bus (async handoffs) used locally where they
fit.

But the five patterns alone leave two critical questions unanswered:

1. **When does the team loop *end*?** — A single agent has ReAct's
   observe-think-act cycle with clear termination. A team of agents passing
   state to each other can loop forever. We formalize the team-level
   termination conditions as **TeamAct** (Chapter 2).

2. **Who catches shared blind spots?** — Agents from the same vendor share
   training-distribution biases. A Claude reviewing another Claude's work will
   miss the same class of errors. Cross-vendor review is structurally necessary,
   not just nice-to-have.

The closest analogy from open-source software: each agent operates like an
**autonomous maintainer** — empowered to merge within their module, making
content decisions independently. But they all share the same **golden path
infrastructure**: git, CI, review protocols, observability, and documentation
standards. The difference from human OSS? Our maintainers are heterogeneous
large language models (Claude, GPT, Gemini), and the "engineering" isn't inside
prompts — it's in the persistent systems that surround them.

**〔 Figure 1 — Anthropic's Five Patterns → Our Composed Architecture 〕**

*A diagram showing how Generator-Verifier, Orchestrator-Subagent, Agent Teams,
Message Bus, and Shared State compose into our system — with Shared State +
Agent Teams as the structural backbone and others used locally.*

---

## Chapter 1 — The Core Formula: Capability × Environment Fit

Here's the thesis in one equation:

```
Agent Quality = Model Capability × Environment Fit
```

The industry overwhelmingly invests in the left term: more parameters, longer
context windows, better reasoning benchmarks. We've been experimenting with the
right term — and after 102 days, we believe the multiplier effect of environment
engineering is dramatically underpriced.

This isn't a claim that models don't matter. A weak model in a perfect
environment still produces weak results. But a frontier model dropped into a
bare environment — no persistent state, no verification loop, no memory across
sessions — performs far below what the same model achieves when properly
situated.

### Three layers of agent state

To understand where environment engineering acts, distinguish three layers of
state that any AI agent touches:

| Layer | What lives here | Lifespan | Who controls it |
|-------|----------------|----------|-----------------|
| **Weight state** | Trained parameters | Permanent until next training run | Model vendor |
| **Computation state** | KV cache, hidden activations | Single inference call | Model architecture |
| **World state** | Repository, git history, docs, task ownership, memory | **Across inferences, across agents, across time** | **The harness** |

The first two layers are the model vendor's domain. The third — world state — is
where environment engineering operates. And it's the only layer that persists
across sessions, across agents, and across time.

### The agent's identity is the loop, not any single layer

A key insight: an agent isn't defined by its weights, its context, or even its
conversation history. An agent is defined by its **closed loop** with reality:

```
Observe(world state) → Reason(computation state) → Act → Apply(world state') → Verify
```

Without this loop, a memory system is just a database nobody checks. Without
world state, a model is reasoning in isolation — powerful cognition disconnected
from consequence. The loop connecting them is what makes an agent *situated*
rather than merely *capable*.

This has a direct engineering implication: **every dollar spent making the loop
tighter — faster observation, better verification, richer world state — compounds
across every model upgrade for free.** A better model immediately benefits from
an existing environment. But a better model in a bare environment has to
re-derive everything from scratch each session.

### The discriminant: Build to Delete vs. Built to Persist

Not all infrastructure ages the same way. Some code becomes less valuable as
models improve; other code becomes *more* valuable. We use this discriminant to
guide every engineering decision:

| Build to Delete | Built to Persist |
|:---:|:---:|
| *Becomes obsolete as models get smarter* | *Becomes more valuable as models get smarter* |
| Detailed chain-of-thought templates | File system / git / search tool integration |
| Multi-step reasoning scaffolding | Trace infrastructure and observability |
| Error recovery boilerplate | Test / lint / review feedback loops |
| Tool-calling example prompts | Agent handoff protocols and routing |
| Persona decoration text | Irreversible-operation guardrails and escape hatches |

The left column is **scaffolding** — compensating for current model limitations.
When GPT-6 or Claude Next no longer needs step-by-step instructions for
multi-file refactoring, that scaffolding is dead weight. The right column is
**infrastructure** — the persistent systems that let any model, present or
future, operate in a shared reality with verification.

The practical test: *"If we upgrade every model in the system tomorrow, does
this piece of harness become more useful or less?"*

- More useful → invest, harden, test it rigorously.
- Less useful → keep it minimal, tag it as scaffolding, expect to delete it.
- Unclear → build it as a thin shim with a clear interface so it's cheap to
  remove.

This isn't just taxonomy. It's an active engineering budget allocator. When we
review PRs, we ask: "Is this Built to Persist or Build to Delete?" The answer
determines how much testing, documentation, and architectural care it deserves.

### Why this matters now

The model capability race moves fast. GPT-4 to GPT-5 in a year. Claude 3 to
Claude 4 in months. Every leap obsoletes some scaffolding. Teams that
over-invest in Build-to-Delete infrastructure find themselves in a Red Queen's
Race — running to maintain scaffolding that keeps depreciating.

Meanwhile, teams that invest in the right column — world state, verification
loops, observability, cross-agent protocols — find each model upgrade amplifies
their existing environment. The infrastructure doesn't age; it appreciates.

The remaining chapters unpack what "environment engineering" means in practice:
the team-level execution loop (Ch. 2), governance that survives context
compression (Ch. 3), memory systems with feedback (Ch. 4), evaluation that
traces root cause (Ch. 5), reliability contracts for long-running agents
(Ch. 6), and the emergent mathematics of cross-vendor collective intelligence
(Ch. 7).

![Figure 2 — Capability × Environment Fit: Four Quadrants](assets/longform-002-figure-2-capability-environment-fit.svg)

**Figure 2 — Capability × Environment Fit: Four Quadrants.** Horizontal axis:
Environment Fit (harness maturity, low → high). Vertical axis: Model Capability
(low → high).

*Bottom-left (low × low): Dead Zone — weak models in bare environments produce
nothing useful.*

*Top-left (high capability × low environment): Build to Delete territory — strong
models that compensate for missing infrastructure through brute-force reasoning.
Works, but doesn't compound.*

*Bottom-right (low capability × high environment): Built to Persist territory —
the infrastructure is ready, waiting for better models to exploit it. Today's
weaker models still produce useful work because the environment scaffolds them.*

*Top-right (high × high): Sweet Spot — strong models amplified by mature
infrastructure. This is where the multiplicative effect lives. The only path
here requires investing in BOTH axes.*

*The industry's default strategy (racing up the vertical axis alone) is a local
optimum. Without horizontal movement, you stay in the top-left quadrant no
matter how capable the model becomes.*

---

*[Ch. 2–7 to follow after style validation]*

---

*Drafted by: [布偶猫/Opus-46🐾]*
*Structure: [宪宪/Opus-47🐾]*
*Figure 2: [砚砚/GPT-55🐾]; remaining figures pending. Review: [宪宪/Opus-47🐾]*
