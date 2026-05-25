---
title: RelayAgent Architecture and Harness Addendum
date: 2026-05-25
source_repo: https://github.com/huxixx/RelayAgent
source_commit: 05ad5132f5ccabef01d450b82646963de545eb37
source_local_path: /Users/lysander/projects/ref/RelayAgent
author: 砚砚/GPT-5.5
---

# RelayAgent Architecture and Harness Addendum

This addendum focuses on architecture beyond the initial ReactMethod read:
mode topology, agent harness construction, plugin/skill loading, Feishu
harness, interrupt/confirmation, and how execution decisions are encoded.

## High-Level Judgment

RelayAgent is not mainly a ReactMethod project. ReactMethod is one important
abstraction inside a broader runtime:

1. A single Python runtime owns sessions, agents, plugins, MCP, skills,
   interrupts, confirmation, and web/CLI entrypoints.
2. `ModeDeclaration` describes the agent topology for each mode.
3. `AgentFactory.create_react_agent` turns a mode slot into a concrete ReAct
   agent with prompt composition, tools, plugins, memory, hooks, and optional
   plan notebook.
4. Skills become sub-agent configs; sub-agents become callable tools; utility
   skills can also be injected as tool wrappers.
5. ReactMethod is used for method-scoped LLM decisions with typed input/output
   and a bounded callback surface.
6. Feishu harness is the most complete "agent harness" in the repo: it routes
   chat events into a durable harness agent and dispatches worker sessions for
   long work.

The unusual architecture decision is this: RelayAgent makes many execution
surfaces descriptor-driven, but still relies on LLM-directed ReAct loops for
some decisions that most workflow systems would encode as deterministic code.

## Architecture Map

| Layer | Main files | What it does |
| --- | --- | --- |
| Application root | `src/relay/apps/relay_application.py` | Owns app lifecycle, session init/resume, plugin loading, MCP init, agent tree, message handling, interrupts. |
| Mode registry | `src/relay/domain/agent/service/mode_registry.py` | Per-app registry for builtin and plugin-defined modes; plugin modes can override same-name builtins. |
| Mode declarations | `src/relay/domain/agent/service/builtin_mode_declarations.py` | Declares delegate, roleplay, groupchat, guarded, and feishu_harness topologies. |
| Agent factory | `src/relay/domain/agent/service/agent_factory.py` | Unified builder for primary agents, participants, harness agents, prompts, tools, plugins, startup recall, and hooks. |
| ReAct runtime | `src/relay/runtime/agent.py` | Core loop: pre_reasoning hooks, model streaming, tool scheduling, post_acting hooks, memory append. |
| Invocation boundary | `src/relay/domain/agent/invocation/runner.py` | Source-agnostic transaction wrapper for user messages, tool calls, groupchat turns, and internal method calls. |
| Skill/sub-agent system | `src/relay/domain/skill/service/*` | Loads skills, converts role skills to sub-agents, wraps sub-agents as tools, supports skill_play role injection. |
| Plugin system | `src/relay/domain/plugin/service/*` | Discovers plugin packages, loads metadata, registers tools/hooks/modes, filters contributions by slot policy. |
| ReactMethod | `src/relay/domain/react_method/*` | Typed method definitions with prompt bodies, callback allowlists, invocation ledger, LLM or bounded executors. |
| Feishu harness | `src/relay/web/services/im/*`, `src/relay/config/plugins/feishu_harness/plugin.py` | IM event loop, route/workspace resolution, harness tools, durable worker task sessions. |
| Confirmation/interrupt | `src/relay/domain/confirmation/*` | Risk-level confirmation strategy dispatch plus session/process interrupt tracking. |

## Mode And Harness Design

RelayAgent's mode system is the cleanest part of the architecture.

`ModeDeclaration` carries:

- `root_agent`
- `agent_slots`
- default skill/tool visibility
- context strategy
- utility injection policy

Each `AgentSlot` controls:

- builtin tools
- MCP tools
- plan tools
- plugin tools
- parallel tool calls
- max iterations
- eager creation
- sub-agent visibility
- contribution policies

The builtin modes show the intended product surfaces:

| Mode | Root agent | Context strategy | Main design decision |
| --- | --- | --- | --- |
| `delegate` | `delegate_agent` | `isolated` | Root agent can call role and utility sub-agents as tools. |
| `roleplay` | `delegate_agent` | `isolated` | Same topology, different prompt persona. |
| `groupchat` | `orchestrator` | `shared_board` | Orchestrator coordinates visible role agents through a shared board. |
| `feishu_harness` | `feishu_harness_agent` | `durable_harness` | IM gateway agent has plugin tools only and delegates long work to workers. |

The good idea for us is not the exact implementation, but the separation:
"what topology should exist" is data, while "how to build a ReAct agent" stays
in `AgentFactory`.

## Agent Factory Chain

The runtime path is:

1. `RelayApplication` loads plugins and registers plugin-provided modes.
2. `_build_root_agent_for_mode` resolves a `ModeDeclaration`.
3. `_interpret_mode` creates the root slot and visible sub-agent slots.
4. `_create_agent_from_slot` resolves sub-agent visibility patterns and builds
   a `SubAgentToolFactory`.
5. `AgentFactory.create_react_agent` creates the actual `ReActAgent`.

`create_react_agent` is the central harness builder. It decides:

- model config for primary vs participant agents
- tool inventory shape
- builtin/MCP/plan/plugin tool inclusion
- prompt composition
- sub-agent tool factories
- startup memory recall hook
- incremental save hook
- plugin event hooks
- plan notebook wiring
- parallel tool calls

This gives them a single construction path for ordinary agents, harness agents,
and sub-agents. The tradeoff is that `create_react_agent` becomes a very large
composition hub.

## Sub-Agent And Skill Design

Skills are not only local instructions. RelayAgent uses skills in three ways:

1. Role skills become sub-agent configs.
2. Utility skills become callable tool wrappers.
3. `skill_play` injects a role context into the current agent, which changes
   the current agent's behavior without spawning another agent.

The sub-agent tool wrapper is more mature than the initial ReactMethod layer.
It supports:

- fresh isolated sub-agent instances
- stable `agent_id` reuse for continuity
- spawn manifest recovery
- lifecycle registration in `AgentTree`
- nested delegation tracking
- interrupt checks before execution
- groupchat board injection
- plan artifact persistence for plan utility skills
- loop detection and emergency compression triggers

This is one of the places where RelayAgent has real harness work, not just a
prompt abstraction.

## ReactMethod Feature Chain

ReactMethod is a typed method ledger plus a small ReAct executor.

Definition:

- `method_id`
- `prompt_body`
- `input_model`
- `output_model`
- `callback_tool_names`
- `max_iters`
- UI visibility

Invocation:

- derive a stable `call_id`
- hash the input
- reuse completed invocations when possible
- reject mismatched input for the same call
- run through `AgentInvocationRunner`
- parse LLM output back into the typed output model
- persist status, trace, output, and errors

Callbacks are strictly allowlisted by method definition, but callback failures
are converted to failed observations instead of always aborting the method.

Current method examples:

| Method | What it does | Architectural read |
| --- | --- | --- |
| `memory.startup_recall.v1` | LLM chooses memory callbacks, then compiles selected memory/path evidence. | Best fit for ReactMethod, but still needs code-side validation and hard-coded output conversion. |
| `session.topic_generation.v1` | Reads recent conversation and returns a Chinese title. | Overbuilt for a one-callback, near-linear task. |
| `feishu.tick_decision.v1` | Reads Feishu groups/routes/progress and decides reply vs task dispatch. | Interesting harness decision layer, but business rules are encoded in prompt text. |

Recent commits changed startup recall so request budget is removed from the
input hash/payload. That is a practical idempotency fix: changing token budget
should not create a different logical recall method call.

## Memory Recall Decision Design

Startup recall has three modes:

| Mode | Decision owner | Notes |
| --- | --- | --- |
| `deterministic` | Code | Search, playbook selection, path traversal, pack construction are fixed. |
| `llm_guided` | LLM planner plus code validator | LLM proposes, code validates and can fall back. |
| `react_method` | ReactMethod ReAct loop | LLM chooses callback sequence inside a method-scoped callback allowlist. |

The key design tension is visible here. RelayAgent wants a stronger model to
improve recall quality by choosing better search/walk/read paths. But they
still keep deterministic and bounded callback executors nearby because recall
is startup-critical.

## Feishu Harness Chain

Feishu is the strongest end-to-end harness example.

Flow:

1. Feishu polling finds changed group chats.
2. `FeishuEmployeeCycleRunner` builds a `FeishuTickDecisionRequest`.
3. `FeishuTickDecisionRunner` invokes `feishu.tick_decision.v1`.
4. ReactMethod callbacks can read messages, send short replies, resolve
   workspaces, check kanban/progress, or start tasks.
5. `feishu_start_task` creates a durable task envelope and worker session.
6. A background worker calls the normal Relay application message path with a
   rendered worker prompt.
7. Task progress is tracked in a JSON envelope and can be read in later ticks.

Architecturally, this is a meta-harness:

- The harness agent is a gateway and router.
- The worker agent does the actual long task.
- The same runtime path handles both user-facing and worker-facing messages.
- Sent message IDs are tracked to distinguish agent self messages from human
  messages when sharing the same Feishu identity.

That split is worth learning from. It avoids making the IM-facing agent both
router and worker.

## Plugin System Decisions

Plugin discovery has layered precedence:

1. explicit extra plugin paths
2. project `.relay/plugins`
3. user `~/.relay/plugins`
4. system plugins under `src/relay/config/plugins`
5. Python entry points

The loader extracts metadata statically without importing plugin code first.
The manager then initializes plugins and registers tools, tool groups, hooks,
and modes.

The important safety decision: tool contributions are filtered by current slot
and contribution policy. If there is no slot context, plugin tool lookup fails
closed. That is a good boundary for a descriptor-driven agent runtime.

## Confirmation And Interrupt

Confirmation is strategy-based:

- Web modal strategy
- CLI stdin strategy
- NoOp deny-all fallback

Requests carry `risk_level`, timeout, metadata, and agent/session IDs. The
registry selects the first available strategy that supports the request type.

Interrupt is centralized in `InterruptManager`:

- session interrupted flags
- tracked session processes
- process tree kill support
- strategy notification

`RelayApplication.interrupt` then fans this into runtime state: session flag,
agent tree interrupt, scheduler cancellation, and process termination.

This part is closer to the industry direction we like: explicit state owner,
typed request, strategy dispatch, and fail-closed fallback.

## How They Decide What Becomes Code Vs Prompt

The repo suggests this rule of thumb:

| Surface | Their choice | My read |
| --- | --- | --- |
| Agent topology | Descriptor/code | Good. Topology should be explicit. |
| Tool visibility | Descriptor/code | Good. Permission surfaces need deterministic policy. |
| Plugin discovery | Code | Good. Needs stable precedence and isolation. |
| Interrupt/confirmation | Code | Good. Risk and cancellation should not be prompt-driven. |
| Startup recall path | LLM first in default ReactMethod mode, deterministic alternatives nearby | Ambitious, but startup-critical behavior becomes harder to reproduce. |
| Topic generation | ReactMethod | Mostly ceremony. |
| Feishu tick routing | ReactMethod | Interesting experiment, but business policy in prompt is fragile. |
| Compression | Traditional prompt, not ReactMethod | Confirms not all LLM tasks need ReAct-style method wrapping. |

So yes: compared with "workflow first, agent fallback", they often lean toward
"agent chooses, deterministic executor or validator catches it if needed".
They do not apply that everywhere, but ReactMethod is explicitly pushing in
that direction.

## Cat Cafe Takeaways

### Learn

1. Mode topology as descriptors is useful. It makes UI discovery, plugin modes,
   validation, and runtime construction share one source of truth.
2. Slot-level contribution policy is worth copying conceptually. Plugin tools
   should be allowed by role/slot, not globally sprayed into every agent.
3. Harness agent vs worker agent split is strong. IM/webhook agents should
   route and supervise; durable worker sessions should do long work.
4. Stable invocation identity is important. `AgentInvocationRunner` and
   ReactMethod invocation ledgers make internal calls traceable.
5. Confirmation strategy dispatch is clean. Risk-level request plus web/CLI/noop
   strategies is a good shape.
6. Sent-message identity tracking in Feishu is a practical detail we should not
   overlook in shared-identity IM integrations.

### Do Not Follow Blindly

1. Do not encode business policy primarily in prompt bodies when it can be a
   typed workflow or policy table.
2. Do not turn one-callback linear LLM tasks into ReAct methods just for API
   uniformity.
3. Do not let fallback executors hide architectural uncertainty. If a
   deterministic path is the trusted path, it should be the primary path.
4. Do not put too much construction responsibility into one agent factory hub
   without strong decomposition.
5. Do not assume "model stronger" means the harness itself needs less
   engineering. Stronger models help judgment, but identity, durability,
   permissions, interrupts, and traceability still need code.

## Bottom Line

RelayAgent's interesting contribution is not just "prompt as function body".
The bigger architecture is:

- descriptor-driven agent topologies
- one unified ReAct agent factory
- plugin tools and hooks filtered by slot context
- skills as both sub-agents and role injection
- typed internal invocations
- IM harness as gateway plus durable workers
- ReactMethod as a typed LLM decision surface

The strongest ideas for Cat Cafe are topology descriptors, slot-scoped plugin
contributions, and the harness/worker split. The weakest idea is treating
prompt-directed ReAct as the default execution planner for flows whose policy
can be expressed deterministically.
