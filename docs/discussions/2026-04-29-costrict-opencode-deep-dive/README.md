---
doc_kind: research-note
topics: [costrict, opencode, open-source-teardown]
created: 2026-04-29
status: draft
source_repo: https://github.com/zgsm-sangfor/opencode
secondary_source_repo: https://github.com/zgsm-ai/costrict
source_commit: cb0dd02475d399beaadfc532bebe39fcc78e2365
secondary_source_commit: f9282f5b073079b7f61719ba4163ad7089050cd8
authored_by: codex
covers: [architecture, star-features, algorithms, comparison]
---

# CoStrict / OpenCode Deep Dive

## 0. Scope

- User question: CoStrict / Costrict 是不是开源；如果有代码仓，按开源项目拆解方式看一下真实能力。
- Project: CoStrict CLI / opencode fork.
- Source repo: https://github.com/zgsm-sangfor/opencode
- Local path: `/Users/lysander/projects/ref/costrict-opencode`
- Commit: `cb0dd02475d399beaadfc532bebe39fcc78e2365`
- Commit date: `2026-04-29 15:59:21 +0800`

## 1. Claim Ledger

| Claim | Source wording | Evidence paths | Verdict | Caveat |
|-------|----------------|----------------|---------|--------|
| Open-source AI coding agent | README says it is an open source AI coding agent based on opencode. | `README.md:1-8`, `package.json:96-100`, `packages/opencode/package.json:1-7` | Supported | The repository is open and MIT-licensed, but packaged CLI metadata still has `private: true`; "commercial platform/service is open source" is not proven by this repo alone. |
| CLI package is `@costrict/cs` with `cs` binary | README installation and package bin. | `README.md:15-31`, `packages/opencode/package.json:1-27` | Supported | Current package version in repo is `3.0.30`; remote release tags observed include v1.x and vscode tags, so npm/release channels need separate verification for distribution state. |
| Client/server architecture | README says the TUI is one client; `serve` starts a headless server. | `README.md:124-133`, `packages/opencode/src/cli/cmd/serve.ts:1-23`, `packages/opencode/src/index.ts:141-150` | Supported | `serve` warns when `COSTRICT_SERVER_PASSWORD` is unset; deployment hardening is a separate concern. |
| 11 specialized agents | README lists 11 specialized agents. | `README.md:49-64`, `packages/opencode/src/costrict/agent/builtin.ts:1-62` | Partly supported | Code has 17 built-in CoStrict agent prompt entries, not exactly the 11 public marketing names; some are wiki/spec/plan variants rather than distinct runtime capabilities. |
| 5 advanced tools | README lists sequential-thinking, call-graph, file-importance, file-outline, checkpoint. | `README.md:77-85`, `packages/opencode/src/tool/registry.ts:30-34`, `packages/opencode/src/tool/registry.ts:123-147` | Mixed | `sequential-thinking`, `file-outline`, `checkpoint`, `spec-manage`, `workflow` are registered. `call-graph` implementation exists, but I did not find it registered in `ToolRegistry`; `file-importance` analyzer exists, but no registered `FileImportanceTool` was found in the inspected paths. |
| Provider token refresh and dynamic models | README claims automatic token refresh and dynamic model list. | `README.md:71-75`, `packages/opencode/src/costrict/provider/index.ts:17-24`, `packages/opencode/src/costrict/provider/index.ts:94-123`, `packages/opencode/src/costrict/provider/models.ts:41-97` | Supported | The dynamic list depends on CoStrict server endpoints. Fallback defaults are generic GPT-4 / GPT-3.5 entries, not proof of provider-agnostic real model availability. |
| Enhanced retry for 503/429/connection errors | README claims intelligent error recognition and retry. | `README.md:96-100`, `packages/opencode/src/session/retry.ts:52-99`, `packages/opencode/src/costrict/error/index.ts` | Supported | Mostly transport/provider resilience, not task-quality improvement. |
| TDD / runnability verification | README says TDD agent/test support. | `README.md:87-94`, `packages/opencode/src/plugin/tdd/README.md:1-48`, `packages/opencode/src/plugin/index.ts` | Supported | The plugin describes agent workflows and has tests, but actual quality still depends on model behavior and project commands. |

## 2. Architecture Map

```text
cs binary / npm wrapper
  -> packages/opencode/src/index.ts yargs command router
    -> run / tui / serve / web / mcp / plugin / cloud / learning commands
      -> server + session processor + provider abstraction
        -> tools registry
          -> builtin tools + CoStrict tools + external plugin tools
        -> agents registry
          -> native build/plan/general/explore + CoStrict bundled agents
        -> provider layer
          -> CoStrict CUSTOM_LOADER + AI SDK providers
        -> plugins
          -> auth, TDD, usage, learning, raw-dump, external plugins
        -> state stores
          -> SQLite / JSON migration / Global.Path data/config/cache
          -> ~/.costrict/share/auth.json
          -> .costrict project config and skills
```

Entrypoints:

- `packages/opencode/bin/cs`
- `packages/opencode/src/index.ts`
- `packages/opencode/src/cli/cmd/run.ts`
- `packages/opencode/src/cli/cmd/serve.ts`
- `packages/opencode/src/cli/cmd/tui/app.tsx`

State stores:

- `Global.Path.data` database marker `opencode.db`
- `~/.costrict/share/auth.json`
- `.costrict/costrict.json`, `.costrict/skills`, `.costrict/agent`, `.costrict/commands`
- shadow checkpoint repository under `Global.Path.data/checkpoint/...`

Extension points:

- Tool files scanned from `{tool,tools}/*.{js,ts}`.
- Plugins loaded from config plus built-in internal plugins.
- Skills from `.costrict`, `.claude`, `.agents`, configured paths, and discovery URLs.
- Registry items: skill / subagent / command / mcp.

## 3. Star Feature Deep Dives

### CoStrict Provider

- Public surface: CoStrict provider in model/provider layer.
- Core modules: `packages/opencode/src/costrict/provider/index.ts`, `credentials.ts`, `token.ts`, `models.ts`.
- State mutation: writes refreshed credentials back to `~/.costrict/share/auth.json`.
- Future behavior: later API calls use refreshed access token; model list is cached for one hour.
- Verdict: real engineering feature, mostly auth/session continuity.

### Advanced Tools

- Public surface: README claims five tools.
- Registered tools: `SequentialThinkingTool`, `FileOutlineTool`, `CheckpointTool`, `SpecManageTool`, `WorkflowTool`.
- Unclear tools: `CallGraphTool` exists as an exported tool implementation, but no registration was found in `ToolRegistry`; `file-importance` has analyzer code but no registered top-level tool found.
- Verdict: the tool-system claim is partially ahead of the currently wired runtime surface.

### Specialized Agents

- Public surface: README says 11 specialized agents.
- Core modules: built-in agent prompts generated into `packages/opencode/src/costrict/agent/builtin.ts`.
- State mutation: no learning/training loop implied; agents are prompt/persona entries.
- Future behavior: user can invoke different prompt bundles once loaded by config/agent service.
- Verdict: real prompt-pack expansion, not evidence of autonomous multi-agent orchestration quality.

### TDD Plugin

- Public surface: `/test`, `test_design`, `test_and_fix`, `run_and_fix`.
- Core modules: `packages/opencode/src/plugin/tdd/**`, loaded as an internal plugin.
- State mutation: injects commands/agents/handlers and memory guidance.
- Future behavior: routes testing/runnability tasks through specialized prompt workflows.
- Verdict: useful workflow scaffolding; quality depends on real command discovery and model fixes.

## 4. Algorithm Peel Table

| Mechanism | Input | Output | Type | Code path | Mutates future behavior? |
|-----------|-------|--------|------|-----------|---------------------------|
| Token refresh | JWT expiry / HTTP 401 | refreshed credentials | Engineering algorithm | `costrict/provider/index.ts`, `costrict/provider/token.ts` | Yes |
| Dynamic model list | `/ai-gateway/api/v1/models` response | provider model map | API integration + cache | `costrict/provider/models.ts` | Yes, for one-hour cache |
| Retry policy | API error / headers | retry delay and status | Rule + exponential backoff | `session/retry.ts`, `costrict/error/index.ts` | Yes, within current session |
| Sequential thinking | model-provided thought steps | stored in module-level arrays | Prompt/tool state helper | `costrict/tool/sequential-thinking.ts` | Weak; process-local only |
| File outline | source file AST | definitions/docstrings | Parser/query algorithm | `costrict/tool/file-outline.ts` | No |
| Call graph | source files + target symbol | call/inheritance chain | Static analysis heuristic | `costrict/tool/call-graph.ts` | No; not observed registered |
| File importance | source files + git history | weighted score | Static heuristic + PageRank | `costrict/tool/file-importance/**` | No; not observed registered |
| TDD agents | user task + repo commands | test/fix workflow | LLM workflow orchestration | `plugin/tdd/**` | Indirectly, via code edits |

## 5. Feedback Loops

| Claimed loop | signal | decision | state mutation | future behavior | verdict |
|--------------|--------|----------|----------------|-----------------|---------|
| Provider resilience | expired token / 401 | refresh token | auth file update | future requests use new token | Real loop |
| Error retry | 503 / 429 / connection error | retry policy | session retry status | current request retries | Real loop |
| TDD verification | build/test output | LLM diagnosis | code edits / command rerun | project may pass checks | Workflow loop, quality not guaranteed |
| Knowledge/skill evolution | observed learnings | LLM/manual capture | `.costrict/.learnings` / skill paths | future skill context may change | Design exists, needs deeper runtime audit |
| "advanced static understanding" | source files | static parsing/heuristics | no durable runtime state | current response only | Tool utility, not learning |

## 6. Cat Café Comparison

| Dimension | CoStrict | Cat Café | Learn / Gap / Do Not Follow | Reason |
|-----------|----------|----------|-----------------------------|--------|
| Provider auth resilience | Strong CoStrict-specific token refresh and model-list cache | Codex/MCP config is mostly external | Learn | The concrete 401 recovery path is worth copying for any first-party provider integration. |
| Tool registry | Simple runtime registry + plugin tools + some built-ins | MCP/tool discovery with richer project memory | Learn | Tool registration clarity matters; their unregistered `call-graph` claim is a useful warning. |
| Specialized agents | Prompt-pack expansion | Cat identities + skills + cross-thread memory | Do Not Follow directly | Prompt-pack agents are cheap, but without routing/governance they do not become team collaboration. |
| TDD workflow | Built-in plugin route for runnability/test/fix | We already have SOP + `tdd` skill + quality gate | Learn selectively | Good idea to expose runnability as a first-class command, but keep our review/quality separation. |
| Checkpoint | Shadow git checkpoint | Worktree + git discipline | Gap / evaluate | Shadow checkpoints can help experimentation, but may hide actual git state if UX is unclear. |
| Marketing accuracy | README mostly backed, but some tool claims are not wired in inspected registry | We require code-path evidence | Do Not Follow | Claim ledger should stay close to runtime wiring, not aspirational code. |

## 7. Harness Assessment

Working definition used here: harness is everything outside the model that turns raw capability into reliable work in the real world: system prompts, tools, permissions, workflow, memory, state, audit trail, recovery, and collaboration protocol.

Short verdict: CoStrict has a competent single-agent coding CLI harness, but it is not yet a strong enterprise harness and it is not a TeamAct/A2A harness. It is closer to an opencode-style ReAct runtime with CoStrict provider hardening, prompt-pack agents, plugin tools, permissions, retry handling, and shadow checkpoints.

| Harness layer | CoStrict evidence | Judgment |
|---------------|-------------------|----------|
| CLI/runtime shell | Command router, TUI/server modes, session processor, tool registry, provider abstraction | Solid baseline for local coding agent work |
| Tool and permission boundary | Built-in tools, plugin tools, allow/deny/ask permissions, plan-mode restrictions | Useful, but policy is local and rule-based rather than governance-grade |
| Provider resilience | CoStrict token refresh, dynamic model cache, retry/error mapping, output continuation | Strongest concrete harness addition |
| State and recovery | Session/status events, worktree support, shadow-git checkpoint restore | Medium; helps local coding recovery, but not durable workflow replay or side-effect-wide rollback |
| Observability and audit | Status bus, logs/plugins such as usage/raw-dump | Weak to medium; not enough evidence of end-to-end trace, verdict trail, or replayable audit |
| Approval and governance | Permission prompt flow | Medium-low; no cross-role approval, no "different agent reviews author" rule, no external approval workflow seen |
| Multi-agent coordination | Built-in/specialized agents are prompt definitions and modes | Weak; no shared-state owner/action/evidence/verdict/route loop observed |
| Security defaults | Server warns when `COSTRICT_SERVER_PASSWORD` is unset | Correct warning, but passwordless server mode is still a footgun if exposed |

Approximate score by our standards:

- Single-agent developer CLI harness: 6.5/10. It gives the model a usable execution shell, tool surface, permission prompts, retry behavior, and local recovery.
- Enterprise runtime harness: 4/10 from the public repo evidence. It lacks durable event sourcing, standardized audit/replay, policy gateway, identity boundary, and external side-effect contracts.
- TeamAct/A2A harness: 2/10. It has "agents" as prompts, but not our loop of State -> Owner -> Action -> Evidence -> Verdict -> Route, and no no-unowned-ball convergence rule.

What we should learn:

- Provider hardening deserves first-class code, not just generic SDK retries.
- Runnability/TDD commands are worth exposing as explicit workflow entrypoints.
- Tool registry evidence should be part of every public claim ledger.

What we should not copy blindly:

- Do not call prompt bundles "multi-agent collaboration" unless routing, ownership, shared state, and cross-review are implemented.
- Do not treat a filesystem checkpoint as full recovery; external side effects need contracts.
- Do not rely on status/log streams as audit unless they can answer who changed what, why, with which evidence, and how to replay or revoke it.

## 8. Lessons / Next Steps

Candidate lessons:

- Public README claims should be checked against the tool registry / command router, not just source file existence.
- Provider resilience is one of CoStrict's strongest concrete additions over base opencode.
- "More agents" mostly means more prompt bundles unless there is scheduling, state transfer, permission isolation, and review routing.

Follow-up:

- If we want a full competitive teardown, next pass should compare against upstream `sst/opencode` or current official opencode to isolate what CoStrict changed.
- Check npm package contents for whether unregistered tools are packaged but hidden, or simply dead code.
- Inspect `costrict-deploy-docker` separately for what part of the cloud/private backend is actually self-hostable.

## 9. Follow-up: Main CoStrict Repo and "85% of Claude Code + Opus" Claim

This follow-up was added after the user reported a direct conversation with the CoStrict team: they said the system is not only the opencode fork, also has Claude Code-related code, and that weak-model harness optimization lets GLM-4.7 reach roughly 85% of Claude Code + Opus.

Scope added:

- Main repo: https://github.com/zgsm-ai/costrict
- Local path: `/Users/lysander/projects/ref/costrict`
- Commit: `f9282f5b073079b7f61719ba4163ad7089050cd8`
- Commit date: `2026-04-28 14:54:58 +0800`

### 9.1 Revised Verdict

The original opencode-only read underestimates their public work. The main `costrict` repo is a larger Roo/Cline-style VS Code extension fork with real CoStrict additions: Z.ai/GLM-4.7 provider handling, Claude Code OAuth/API compatibility, code-index/RAG infrastructure, task persistence, checkpointing, MCP/name normalization, tool aliasing, mistake detection, model fallback, Strict workflow prompts, and eval infrastructure inherited from Roo Code.

That said, the public code still does not validate the "85% of Claude Code + Opus" number. I found an eval system, but no public result table, benchmark report, SWE-bench run, pass-rate comparison, or reproducible data showing GLM-4.7 + CoStrict harness reaches 85% of Claude Code + Opus. Treat the number as an internal/commercial claim until they publish the evaluation protocol and raw results.

I also do not treat "leaked Claude Code source" as proven. Public code shows Claude Code-compatible OAuth/API integration and Claude Code-like prompt/protocol behavior. That is not the same as proving they possess or used leaked proprietary source. We should not request, inspect, or depend on leaked proprietary code.

### 9.2 Evidence Ledger

| Claim / question | Public evidence | Verdict |
|------------------|-----------------|---------|
| Main CoStrict is open source | `zgsm-ai/costrict` is public; `README.md` describes an enterprise AI coding extension and acknowledges Roo Code, OpenSpec, OpenCode, agents.md, and agentskills. | Supported for this repo. |
| They have Claude Code-related code | `src/integrations/claude-code/streaming-client.ts:164-180` sets Claude Code beta headers and user-agent; `:466-503` builds a Claude Code-format request, prepends Claude Code branding, prefixes tool names for OAuth compatibility; `src/api/providers/claude-code.ts:119-186` wires the handler into message streaming. | Supported as compatibility/integration code. Not proof of leaked source. |
| They optimized GLM-4.7 / Z.ai handling | `src/api/providers/zai.ts:42-109` enables/disables GLM-4.7 thinking mode, converts messages via `convertToZAiFormat`, preserves reasoning content, and enables parallel tool calls; `src/api/transform/zai-format.ts:23-35` states the conversion is optimized for GLM-4.7 thinking mode; tests in `src/api/providers/__tests__/zai.spec.ts:407-497` assert thinking-mode behavior. | Supported. This is real provider-level harness work. |
| They improve weak-model tool reliability | `src/shared/tools.ts:397-413` defines central aliases such as `read -> read_file`; `src/core/assistant-message/NativeToolCallParser.ts:313-325` and `:792-815` resolve aliases and normalize dynamic MCP names; `src/services/mcp/McpHub.ts:979-1006` fuzzy-matches sanitized MCP server names. | Supported. Practical weak-model compatibility work. |
| They have codebase RAG | `src/services/code-index/**` implements scanner/cache/vector-store/search; `src/services/code-index/orchestrator.ts:98-260` handles full/incremental indexing; `search-service.ts:29-59` embeds query and searches vector store; `src/core/tools/CodebaseSearchTool.ts:18-146` implements a tool wrapper. | Supported as infrastructure. Caveat: `codebase_search` native tool is commented out in `src/core/prompts/tools/native-tools/index.ts:9-10` and `:150-151`, and execution import is commented in `src/core/assistant-message/presentAssistantMessage.ts:41-46`, so runtime exposure needs validation. |
| They have workflow/agent harness beyond prompt bundles | `packages/types/src/costrict/prompt/i18n/en/spec.ts:53-121` defines Strict workflow phases and approval gates; `plan.ts:4-60` forces QuickExplore then PlanApply delegation; `plan-apply.ts:4-60` delegates coding to SubCodingAgent and maintains task status. | Partly supported. This is structured local orchestration, stronger than "just prompts", but still prompt/tool-state driven. |
| They have resilience/recovery | `src/core/task/SmartMistakeDetector.ts:77-180` tracks weighted mistakes over a time window; `ModelFallbackManager.ts:28-35` documents transient fallback without modifying persistent profile; `:119-193` records failures and builds fallback handlers. | Supported as runtime resilience mechanisms. |
| 85% of Claude Code + Opus | `packages/evals/**` and `apps/web-evals/**` provide an eval harness, but repo search did not find public result data or a GLM-4.7-vs-Claude-Code-Opus comparison. | Not publicly substantiated. |

### 9.3 Harness Assessment Update

With both public repos considered, the fairer assessment is:

- Single-user IDE/CLI harness: 7.0-7.5/10. They have meaningful provider transforms, context compaction, task persistence, checkpointing, aliases, MCP normalization, RAG indexing, Strict workflow prompts, and some eval infrastructure.
- Enterprise runtime harness: 4.5/10 from public evidence. There is still not enough public evidence for durable audit/replay, policy gateway, org-grade identity boundary, approval workflow, or external side-effect contracts.
- TeamAct/A2A harness: 2-3/10. They have local subtask delegation and task state, but not our State -> Owner -> Action -> Evidence -> Verdict -> Route loop, cross-agent review rule, durable ball ownership, or CVO/vision layer.

The important correction: CoStrict is not an empty marketing wrapper, and not merely a pile of prompt personas. The main repo shows a serious attempt to make weaker models usable by improving provider protocol compatibility, tool-call tolerance, project context retrieval, and workflow scaffolding.

The important boundary: none of that makes the 85% claim true without eval evidence. The codebase contains plausible mechanisms that could improve GLM-4.7, but it does not prove the magnitude.

### 9.4 What We Should Learn

- Weak-model harness work is often low-level and unglamorous: message-shape conversion, reasoning-state preservation, tool aliasing, MCP name normalization, retry/fallback, and context hygiene.
- `codebase_search`/RAG plus `file_outline` is the right direction for reducing context waste, but public claims must track whether the tool is actually exposed to the model.
- A public benchmark claim needs three artifacts: task suite, model/config/harness version, and raw per-task results. Without those, a percentage is not reviewable.

### 9.5 What We Should Not Follow

- Do not infer "leaked source" from protocol compatibility. Public evidence supports Claude Code-compatible integration, not possession of proprietary source.
- Do not cite "85%" unless the benchmark is published or we reproduce it.
- Do not call local prompt-mode delegation equivalent to TeamAct/A2A. It is useful single-user orchestration, but not independent-agent collaboration with ownership and verdict routing.
