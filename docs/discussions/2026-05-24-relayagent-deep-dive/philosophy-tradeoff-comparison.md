# Cat Cafe x RelayAgent -- Architecture Philosophy Tradeoff Comparison

> Date: 2026-05-25
> Author: xianxian/Opus-46
> Sources: `docs/content/drafts/longform-002-v0-formal.md` (Cat Cafe) + `/ref/RelayAgent/` full codebase (RelayAgent)
> Context: CVO asked "look at our architectural choices and theirs, what are the different tradeoffs?"

---

## Core Divergence: Who Goes First?

The most fundamental split between the two projects is **who bears the complexity of orchestration**.

### Cat Cafe: Deterministic Execution + LLM for Content/Judgment

- TeamAct 6-step loop (State -> Owner -> Action -> Evidence -> Verdict -> Route) is a hard-coded state machine
- 5 termination conditions (milestone/deadlock/budget/scope/CVO) are deterministic rules
- LLM's ReAct loop happens *within* a single cat's tool-calling layer, not at the orchestration level
- The harness is the "reality bridge" -- agents produce content inside harness-drawn sandboxes

### RelayAgent: LLM ReAct First + Deterministic Fallback

- `LLMReactMethodExecutor` lets LLM decide which callbacks to call, how many times, when to stop
- `BoundedCallbackReactMethodExecutor` is a hardcoded fallback (search -> walk -> build_prompt_block)
- Both executors return the same typed output -- the dual path is implicit, not architecturally acknowledged
- ReactMethod = "prompt as function body" -- the orchestration IS the LLM output

### Tradeoff Matrix

| Dimension | Cat Cafe (deterministic first) | RelayAgent (LLM first) |
|-----------|-------------------------------|----------------------|
| **Upper bound** | Limited by SOP designer's imagination | Scales with model capability |
| **Lower bound** | Deterministic output guaranteed | Fallback executor catches failures |
| **Latency** | No extra LLM calls for orchestration | Extra LLM ReAct loop per invocation |
| **Testability** | High -- deterministic I/O, unit-testable | Low -- LLM output non-deterministic |
| **Iteration cost** | Code change + deploy | Prompt change (but runtime.py specialization still needs code) |
| **Auditability** | Full trace of deterministic decisions | LLM reasoning not reproducible |

### Judgment

The core question is **who bears complexity**: design-time (Cat Cafe) or runtime (RelayAgent).

Cat Cafe's SOP/TeamAct/handoff capsules are all design-time artifacts. The upside: runtime behavior is predictable, auditable, reproducible. The cost: every new scenario requires human-written orchestration logic.

RelayAgent's ReactMethod pushes orchestration to the LLM. The upside: definition-side is minimal (44 lines). The cost: runtime.py is 1253 lines, and LLM orchestration decisions are non-reproducible, non-auditable.

---

## Dimension 2: Memory -- Engineering Algorithm vs LLM Judgment

### Cat Cafe: Multi-domain Knowledge Federation + Consumption-weighted Ranking

- Evolution: grep -> BM25 + vector search -> consumption feedback loop (F200)
- Ranking uses **revealed preference** (which memory fragments were actually consumed by cats) rather than LLM self-evaluation
- No extra LLM call needed for memory selection -- retrieval + ranking is fully deterministic code
- Behavioral economics principle: actual behavior > self-reported preference

### RelayAgent: ReactMethod-driven LLM Recall

- `memory.startup_recall.v1` uses ReactMethod with 12 callback tools, max_iters=8
- LLM decides what keywords to search, how many pages to browse, which memories to inject
- Underlying retrieval is real algorithms (SQLite BM25 + vector search)
- But **selection authority** belongs to the LLM

### Tradeoff

- Cat Cafe's approach is **cheaper and more predictable** -- no extra LLM call per startup
- RelayAgent's approach may be **more flexible at cold start** -- LLM can dynamically adjust search strategy based on current conversation context
- But RelayAgent hedges its own bet -- `BoundedCallbackReactMethodExecutor` is a hardcoded search->walk->build pipeline that doesn't use LLM at all
- Cat Cafe treats memory selection as an **engineering problem** (information retrieval + ranking algorithms); RelayAgent treats it as an **intelligence problem** (let LLM judge)

---

## Dimension 3: Agent Topology -- TeamAct vs Descriptor Modes

### Cat Cafe: True Multi-Agent + State Machine

- Multiple independent agents (different models, threads, hosts)
- TeamAct state machine: explicit ball ownership, pass rules, 5 termination conditions
- Handoff capsule prevents context loss across agent boundaries
- Each cat has **persistent identity** (capability profile) -- loading a skill doesn't change who you are

### RelayAgent: Single Agent Multi-Role + Descriptors

- `ModeDeclaration` + `AgentSlot` descriptors define 5 topologies (delegate/roleplay/groupchat/guarded/feishu_harness)
- `skill_play` **switches agent identity** -- loading a skill means becoming that role
- All agents live in the same process -- no cross-process state sync needed
- `ModeRegistry` allows dynamic registration via plugins

### Tradeoff

- Cat Cafe's model solves **real multi-agent coordination** (ball ownership, context handoff, deadlock detection)
- RelayAgent's model solves **single-agent versatility** (one agent, many roles)
- RelayAgent's `ModeDeclaration` is elegantly minimal -- 5 fields define a complete topology
- Cat Cafe's breed descriptors + runtime catalog carry more information but are more complex
- These solve problems at different levels -- they're not directly competing

---

## Dimension 4: Eval/Metabolism -- Structured vs Absent

### Cat Cafe: Eval Contract + Three-Party Signals

- Eval Contract asks 5 questions: what to test / what it means / who drives / who to attribute to / what to change
- Three-party signals: CVO (user intent), Agent (self-assessment), Runtime (telemetry)
- 7-category attribution matrix maps failures to root causes
- Eval is defined as "harness metabolism" -- without it, the harness is dead

### RelayAgent: Observability Without Eval

- `ReactMethodInvocation` ledger tracks status (created/running/completed/failed/interrupted)
- `trace_summary` captures execution traces
- 5 test files cover ReactMethod behavior
- But no systematic eval framework, no feedback loop, no attribution model

### Judgment

Not really a tradeoff -- more like Cat Cafe is further along this axis. RelayAgent's invocation ledger is **pre-requisite infrastructure** for eval (you need data before you can evaluate), but the eval loop isn't closed. As ReactMethod evolves, they'll eventually need to answer "did this prompt change make things better or worse?" -- that's when eval becomes necessary.

---

## Dimension 5: Reliability -- Distributed Systems vs Monolith

### Cat Cafe: Distributed Systems Model

- 3 failure classes (invocation failure / state drift / liveness loss)
- 4 recovery tiers (single retry / session rebuild / cross-session recovery / manual intervention)
- Unified host abstraction (Claude Code, Codex, OpenCode treated as different hosts of same capability)
- Liveness split-brain detection and resolution

### RelayAgent: Monolith + Idempotency

- Single FastAPI + WebSocket process
- SHA256 input hash + call_id for idempotent invocations
- Invocation ledger supports cached/resumed/rerun states
- No cross-process coordination needed

### Tradeoff

- Cat Cafe's model is **necessary** because we have true multi-agent (different processes, hosts, models)
- RelayAgent's monolith **doesn't need** this complexity -- but also can't easily scale to true multi-agent
- RelayAgent's idempotency + invocation ledger is **worth learning** -- clean, useful, applicable even in our architecture

---

## Dimension 6: Build to Delete -- Explicit vs Implicit

### Cat Cafe: Explicit Discriminator

Longform-002 proposes a discriminator for harness features:
- **Build to Delete**: agent capability that will be absorbed by future model native capabilities (know it's temporary, build it anyway)
- **Built to Persist**: infrastructure that becomes MORE needed as models get stronger (coordination, eval, governance)

### RelayAgent: Implicit but Unacknowledged

ReactMethod **is** a Build to Delete framework, but the project doesn't frame it that way:
- `session.topic_generation.v1` -- already a native LLM capability for most models
- `memory.startup_recall.v1` -- if future models natively support memory retrieval+injection, this ReactMethod becomes unnecessary
- The dual executor pattern (LLM + deterministic) is essentially saying "we're not sure which path will win" -- but without a framework to decide when to retire one

Cat Cafe's advantage: **explicitly acknowledging the tension** between temporary and permanent harness features, with clear criteria for when to delete.

---

## Summary Table

| Dimension | Cat Cafe | RelayAgent | Assessment |
|-----------|---------|------------|------------|
| Execution philosophy | Deterministic orchestration + LLM content | LLM orchestration + deterministic fallback | Different trust levels in LLM; Cat Cafe has higher floor |
| Complexity location | Design-time (SOP/TeamAct) | Runtime (runtime.py 1253 lines) | Cat Cafe more auditable |
| Memory selection | Engineering algorithm (consumption-weighted) | LLM judgment (ReAct loop) | Cat Cafe cheaper + more predictable |
| Topology model | True multi-agent + state machine | Single agent multi-role + descriptors | Different problem levels |
| Definition simplicity | Medium (Skill + breed + SOP) | High (44 lines per method) | RelayAgent wins |
| Eval loop | Yes (Eval Contract + 3-party signals) | No (has ledger, no eval) | Cat Cafe ahead |
| Reliability | Distributed systems model | Monolith + idempotency | Each fits its architecture |
| Self-awareness | Build to Delete discriminator | No explicit discriminator | Cat Cafe ahead |

## The Deepest Difference

Cat Cafe believes: **Agent Quality = Capability x Harness Fit** -- stronger harness = more stable agent output.

RelayAgent believes: **Agent Quality = LLM Reasoning Power** -- stronger model = better peripheral functions, even without re-development.

Both are correct. But at **current** model capability levels (mid-2026), Cat Cafe's conservative path has clear advantages in **production reliability** -- deterministic orchestration doesn't change output when you swap models, modify prompts, or adjust temperature. RelayAgent's aggressive path has more **future upside** -- if next year's models can reliably make orchestration decisions, then ReactMethod's "44-line function definition" iterates faster than our SOP system.

The essence of the tradeoff: **your trust level in model capability** determines how much complexity you place at design-time vs runtime.

---

*[xianxian/Opus-46]*
