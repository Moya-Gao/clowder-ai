---
feature_ids: [F042, F167]
related:
  - docs/decisions/030-system-prompt-engineering.md
  - docs/architecture/2026-05-05-architecture-views.md
  - docs/bug-report/2026-02-23-system-prompt-context-bloat/bug-report.md
topics: [system-prompt, context-injection, harness, skills, hooks, governance]
doc_kind: discussion
created: 2026-05-15
status: draft-converged
participants: [codex, opus-47, opus-46]
---

# Prompt / Context Injection Audit Draft

> This is a first-pass inventory, not an implementation spec. The goal is to make the injection surfaces visible before we add another rule to the prompt stack.

## Trigger

Two signals landed in the same thread:

1. The review no-middle-state incident: reviewers wrote P2/P3 findings while also softening the verdict with "not blocking" or follow-up language. That exposed a verdict contract gap, not merely a personality issue.
2. Anthropic's 2026-05-14 Claude Code large-codebase article reframed the same harness pattern we already use: root context should stay lean, skills should load on demand, hooks should enforce deterministic behavior, and configuration should be reviewed every few months as models and tools improve.

Cat Cafe already has the pieces. The debt is that too many of them can be injected at once, and some content appears in both native root prompts and runtime user-prompt context.

## Existing Maps

This audit should not replace the existing architecture sources:

- `docs/decisions/030-system-prompt-engineering.md` already identifies "7+ locations" and "3 injection paths" for system prompt engineering.
- `docs/architecture/2026-05-05-architecture-views.md` has the harness loading sequence and separates session-level identity, per-invocation dynamic context, session bootstrap, runtime hooks, and post-execution processing.
- `docs/bug-report/2026-02-23-system-prompt-context-bloat/bug-report.md` diagnosed prompt bloat from repeated static blocks and long callback manuals.

The missing piece is a current, operational ownership table: what belongs in root prompt, what belongs in dynamic context, what belongs in a skill, and what should be a hook/tool instead of natural-language instruction.

## Ragdoll Review Convergence

Opus 4.7 and Opus 4.6 both independently reached the same core diagnosis: the root files are not bloated because someone "forgot" `shared-rules.md`; they are bloated because old harnesses and older model behavior could not be trusted to follow pointers. Root prompts became distilled copies of the rules that cats were otherwise skipping.

That history matters. The right migration is not "delete all duplicated rules." The right migration is:

1. keep a small root safety skeleton for direct CLI sessions and post-compact survival;
2. make runtime-injected state the source of truth for volatile facts like roster, current model, mode, baton, and routing;
3. move stage-specific explanations into skills;
4. move deterministic enforcement into hooks, tests, and merge gates;
5. only retire a root summary after there is an equivalent pointer, hook, skill, or runtime block that is actually loaded in that path.

Accepted reviewer input:

- Target root prompt size should be roughly 60 lines per carrier, but only after a baseline token report and direct-CLI fallback check.
- `shared-rules.md` should not be shortened as the first move. It is the long-form truth source; the problem is copying too much of it into always-on root files.
- Static teammate tables in `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` are a high-confidence deletion candidate because `SystemPromptBuilder` already injects the resolved runtime roster with current models.
- Static teammate tables are stale copies, not compatibility shims; runtime injects roster data unconditionally, so this path does not depend on cats choosing to read a referenced file.
- The memory routing table should have one real source, `cat-cafe-skills/refs/memory-routing-partial.md`; root prompts should carry only a short recall principle and exact entrypoint names.
- `session-start-recall.sh` should keep deterministic local-state checks. Its recall line is acceptable only as a short trigger; it must not grow into a second memory manual.
- Review no-middle-state belongs in `shared-rules.md` as a two-line protocol skeleton, in review skills as the explanation/template layer, and in merge-gate as a contradiction check. It does not belong as a new root personality paragraph.

Rejected or narrowed input:

- Do not make "remove warmth from Opus" the fix. That treats a gate contract failure as a personality defect.
- Do not rewrite `SystemPromptBuilder.ts` before deleting obvious root duplicates. The builder is already carrying legitimate volatile context; the first safe win is retiring stale static copies.
- Do not delete recall reminders everywhere at once. User evidence says cats sometimes skip referenced docs; prompt slimming must preserve one short always-visible recall trigger until behavior is measured.

## Verified Baseline

As of 2026-05-15:

| Artifact | Lines | Notes |
|---|---:|---|
| `AGENTS.md` | 207 | Codex root prompt; contains static teammate table, SOP table, memory routing table, key docs table |
| `CLAUDE.md` | 188 | Claude root prompt; same duplicated families of content |
| `GEMINI.md` | 183 | Gemini root prompt; same duplicated families of content |
| `cat-cafe-skills/refs/shared-rules.md` | 738 | Long-form governance truth source; should not be treated as prompt bloat by itself |
| `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` | 1017 | Runtime static and invocation context builder |
| `.claude/hooks/user-level/session-start-recall.sh` | 100 | Hook output includes one recall reminder plus local-state checks |

Confirmed repeated anchors:

- `开工前先 recall` appears in all three root files and the session-start hook.
- static teammate tables appear in all three root files, while runtime also injects teammate roster/model data.
- `Skill 不是可选的`, `Redis 6399`, and key document pointers appear in multiple always-on places.

## Strict Channel Semantics

This document uses "prompt/context injection" as a broad harness term. That is not the same as "API `system` role." The production path must distinguish them:

| Source | Production transport in Cat Cafe runtime | Strict role classification |
|---|---|---|
| `CLAUDE.md` | Claude Code `prependUserContext()` wraps content in `<system-reminder>` and injects as the first **user message** (`api.ts:449-474` in restored source v2.1.88) | **user message**, not API system role |
| `AGENTS.md` | Codex CLI `build_contextual_user_message()` wraps content in `<INSTRUCTIONS>` and injects as a **user message** (`updates.rs:178-202`; confirmed by test `agents_md.rs:22-27`) | **user message**, not developer role |
| `GEMINI.md` | Gemini CLI default JIT mode: project-level GEMINI.md goes into first **user message** via `getInitialChatHistory()` (`environmentContext.ts:87-101`); global `~/.gemini/GEMINI.md` goes into `systemInstruction` | **user message** (project-level, JIT=true default); `systemInstruction` (global-level only) |
| `buildStaticIdentity()` | Built in `route-serial.ts` / `route-parallel.ts`, passed to `invokeSingleCat()` as `params.systemPrompt`, then normally prepended into `effectivePrompt` when injection is needed | query/prompt text in the normal production path, despite the parameter name |
| `buildInvocationContext()` | Prepended into the per-call prompt parts before context/history/current message | query/prompt text |
| `modeSystemPrompt`, session bootstrap, MCP fallback instructions, context history | Joined into the same prompt body around invocation context and the current message | query/prompt text |
| `buildSystemPrompt()` | Backward-compatible helper used by tests and legacy callers; production route uses split `buildStaticIdentity()` + `buildInvocationContext()` | do not use this function name as proof of API `system` role |
| `ClaudeAgentService` `options.systemPrompt` | If a caller passes it directly to the provider, it becomes `--append-system-prompt` | provider system-prompt flag |
| `CatAgentService` `options.systemPrompt` | If a caller passes it directly, it becomes Anthropic Messages API `body.system` | strict API system field |
| Codex / Gemini / Antigravity / Kimi / OpenCode provider paths | No reliable provider system channel in our wrapper; system-like text is prepended or wrapped into the user prompt text | query/prompt text |

Important correction: the identifier `systemPrompt` in TypeScript is a local variable/parameter name, not proof that content enters the model API's `system` role. In the current `invokeSingleCat()` hot path, `params.systemPrompt` is intentionally prepended to `effectivePrompt` because universal CLI prompt text was more reliable than provider-specific system flags.

Carrier source code audit (2026-05-15, opus-46): All three CLI carriers were verified against open-source or restored source. Claude Code (`prependUserContext`), Codex CLI (`build_contextual_user_message`), and Gemini CLI (JIT mode default) all inject project-level instruction files as **user messages**, not into the API system/developer/systemInstruction field. This means root instruction files and `SystemPromptBuilder` output occupy the same channel — duplication between them is pure double-counting with no priority-tier differentiation.

Edge case: the self-heal retry path can set `baseOptions.systemPrompt = params.systemPrompt` after a stale or poisoned session is dropped. In that exceptional retry, providers that honor `options.systemPrompt` may use their system channel/flag. This does not change the normal-path classification above.

## Current Injection Surfaces

| Surface | Primary files | Lifecycle | What it currently carries | Audit risk |
|---|---|---:|---|---|
| Native root instruction files | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `OPENCODE.md` | loaded by carrier / project context | identity, team roster, SOP navigation, shared rules, memory guidance, hard rules | duplicates runtime static identity and dynamic roster; easy to become every-session bulk |
| Prompt shards and sync | `assets/system-prompts/*.md`, `scripts/sync-system-prompts.ts` | compile/sync to user-level native config and hooks | codex/gemini identities, collab rules, governance L0, dynamic roster rendering | shard truth source and runtime constants can drift |
| Runtime static identity | `SystemPromptBuilder.buildStaticIdentity()` | session-level candidate; reinjected on new session / compression / registry change | identity, personality, restrictions, A2A examples, callable handles, teammate roster, workflow triggers, CVO info, governance digest, pack blocks, Claude MCP tool summary | currently broad; overlaps root files and some dynamic prompt blocks |
| Runtime dynamic context | `SystemPromptBuilder.buildInvocationContext()` | every invocation | identity pin, direct-message/cross-thread hints, ping-pong warning, teammates this turn, mode, A2A exit check, routing feedback, SOP stage, voice mode, bootcamp/guide/world/signal/always-on context, trailing handoff decision tree | necessary for volatile state, but long static prose here becomes per-turn tax |
| Incremental history packet | `route-helpers.ts` | every invocation with message history | `[导航]`, baton, recent messages, smart window, thread memory, related evidence, context coverage map | appears in user-prompt channel, so any duplicated system-like rules here are especially expensive |
| Session bootstrap | `SessionBootstrap.ts` | session #2+ | previous session digest, thread memory, auto-recall, task snapshot, recall tool instructions | recall instructions overlap root memory guidance and session-start hook |
| MCP callback fallback | `McpPromptInjector.ts` | per-message for non-native MCP carriers | callback env vars, callback tool list, @ teammate examples | should remain a tiny fallback pointer; full docs belong in skill refs / callback endpoint |
| User-level session hooks | `.claude/hooks/user-level/session-start-recall.sh` and generated hook targets | SessionStart / local shell | dirty docs warnings, unpushed commits, recall reminder | good for deterministic checks; bad if it grows into another prose prompt |
| Skills and refs | `cat-cafe-skills/*/SKILL.md`, `cat-cafe-skills/refs/*` | on demand | workflow-specific rules, templates, detailed checklists | right home for most process detail; manifest says route tables are still partly manual |
| MCP tool descriptions | `packages/mcp-server/src/tools/*` | tool discovery / schema | exact tool affordances, input fields, result semantics | should replace generic prompt reminders when a tool can advertise itself precisely |
| Pack/governance externalization | `packages/api/src/config/governance/*`, `docs/decisions/021-f129-pack-system-architecture.md` | external project install/runtime | portable rules and pack blocks | useful distribution path, but raw pack prompt must stay schema-compiled, not blindly injected |

## Classification Rule

Every instruction should have exactly one primary home:

| Content type | Primary home | Why |
|---|---|---|
| Identity constants and non-negotiable safety boundaries | root prompt or runtime static identity | must survive task changes and compression |
| Volatile state: current cat, mode, baton, direct-message source, voice mode, current SOP stage | runtime dynamic context | changes every invocation; cannot live in root files |
| Workflow procedures and templates | skills / refs | load only when doing that workflow |
| Deterministic checks | hooks, tests, merge gates, linters | machines should enforce machines' rules |
| Tool usage details | MCP schema / tool descriptions / callback instructions endpoint | tool contracts should travel with the tool |
| Long rationale and historical lessons | docs / evidence / memory | retrieved when relevant, not injected by default |
| Navigation by symbol | LSP / code intelligence plugin | not natural-language prompt work |

If a rule fits multiple rows, choose the lowest-loading row that still prevents the failure.

## Immediate Findings

### 1. Root Prompt Is Carrying Runtime Material

The native root files still contain team roster, SOP navigation, and broad shared rules. Runtime also injects callable teammate handles, a roster table with resolved models, workflow triggers, and A2A routing guidance. This duplication is useful for direct CLI sessions outside Cat Cafe, but wasteful inside Cat Cafe invocation context.

Recommendation: split "native direct CLI minimum" from "Cat Cafe runtime-injected state." Root files should keep identity, fatal gotchas, and pointers. Runtime state should remain in `SystemPromptBuilder`, but static blocks should not repeat content already supplied by runtime when the carrier is known to have that runtime context.

Compatibility caveat: direct CLI sessions still need a tiny root skeleton because they may not receive Cat Cafe runtime injection. This is why root prompts should be slimmed, not deleted.

### 2. Review No-Middle-State Should Not Become Another Root Paragraph

The incident tempts us to write "do not be too gentle" into every prompt. That is the wrong layer.

Better placement:

- `cat-cafe-skills/request-review/refs`: define a reviewer verdict contract.
- `cat-cafe-skills/receive-review`: author fail-closed handling for contradictory review text.
- `cat-cafe-skills/merge-gate`: accept only an explicit `APPROVE` verdict with no open P1/P2.
- `shared-rules.md` L0: at most one compressed invariant: "P1/P2 open implies request changes; approve-with-follow-up is invalid."
- optional deterministic check: scan review replies/PR bodies for `APPROVE` plus `P1|P2|follow-up|deferred|not blocking` in the same verdict block.

Do not remove "温柔" from the broad personality prompt as the main fix. Personality can be warm; review verdicts must be binary and machine-readable.

### 3. Session-Start Hook Should Stay a Hook, Not a Shadow Prompt

The current `session-start-recall.sh` is mostly operational: dirty docs, unpushed commits, branch warning, recall reminder. That is healthy because it observes local state and emits concrete warnings.

Boundary: keep it short and exact. If recall guidance grows beyond one or two lines, move it into `memory-routing-partial.md`, a memory skill, or MCP tool descriptions. Hook output should not restate team roster, SOP, or governance. Do not remove the one-line recall trigger until root slimming has a measured behavior check, because the whole reason root summaries grew was that cats skipped referenced docs.

### 4. Dynamic Context Needs a Token Budget, Not Just Good Intentions

The harness loading sequence currently lists 19 dynamic context items. Many are legitimate because they are volatile, but "legitimate" does not mean "unbounded."

Recommendation: add a prompt capture audit that groups effective prompt bytes/tokens by source block:

- static identity
- dynamic invocation context
- session bootstrap
- incremental history packet
- MCP callback fallback
- mode-specific prompt
- native carrier root prompt if observable

This would turn "prompt feels fat" into an observable budget.

### 5. LSP Is a Capability Surface, Not Prompt Content

The Anthropic article's most practical reminder for us is symbol-level navigation. We already use `rg`, ownership cells, and memory search, but that does not replace LSP for "same symbol" navigation.

Recommendation: evaluate whether our active carriers expose LSP or code-intelligence plugins. If yes, document the invocation path. If no, add it to the harness backlog as a capability gap. Do not compensate by adding more "use precise search" prompt text.

### 6. Subdirectory Context Is Underused

We usually start from repo root. For a monorepo, local context should come from the code area: `packages/api`, `packages/web`, `packages/mcp-server`, `cat-cafe-skills`, `docs/architecture`, etc.

Recommendation: prefer path-scoped guidance where the same rule is only relevant under one subtree. Candidate directories:

- `packages/api/AGENTS.md`: API test/build commands, callback auth, Redis isolation.
- `packages/web/AGENTS.md`: frontend verification, browser screenshots, UI density constraints.
- `packages/mcp-server/AGENTS.md`: tool schema standards and callback auth rules.
- `cat-cafe-skills/AGENTS.md`: skill authoring quality rules and manifest sync.

Root should point to these, not duplicate them.

## Proposed Layering

### Root Prompt: Small Skeleton

Keep:

- identity and current family contract
- "we are Cat Cafe" relationship frame
- fatal safety boundaries: runtime sanctuary, Redis 6399, no self-review, no destructive cleanup
- one-line skill routing principle: load applicable skill, details live in skill
- one-line memory principle: recall before project work, exact tool names if needed
- one-line A2A principle: line-start @ transfers ball; volatile routing details are injected dynamically

Remove or downshift:

- full teammate table when runtime already injects resolved roster
- long SOP tables already represented by skills
- repeated shared-rules digest when `GOVERNANCE_L0_DIGEST` is injected by runtime
- detailed MCP tool manual when tool schema or callback endpoint exists

Target shape:

| Section | Target |
|---|---|
| identity and family contract | 3-6 lines |
| fatal local hazards | 5-8 lines |
| skill / SOP pointer | 2-4 lines |
| memory pointer | 2-5 lines |
| family-specific tool caveats | only what is unique to that family |
| duplicated roster / long tables | remove |

### Runtime Static Identity: Session-Level Contract

Keep:

- current cat identity, role, restrictions
- compact A2A syntax examples
- CVO mention handles
- compact L0 governance digest
- pack masks/guardrails

Question:

- teammate roster should probably be behind a "roster changed / direct A2A enabled / no native root roster" condition, not always static.

### Runtime Dynamic Context: Volatile Only

Keep:

- `Identity: @catId model=...`
- mode, teammates this invocation, direct-message/cross-thread hints
- routing feedback, active participant hint, SOP stage
- voice/bootcamp/guide/world/signal/always-on context when active
- trailing exit decision tree only when A2A is enabled

Remove:

- anything that is merely a policy restatement and does not depend on current thread state.

### Skills: Workflow Details

Move here:

- review verdict contract
- no-middle-state examples
- quality-gate checklists
- merge-gate procedure
- browser verification details
- rich block and MCP callback full docs

### Hooks / Gates: Deterministic Enforcement

Move here:

- review verdict contradiction detection
- prompt drift check between `shared-rules.md`, `governance-l0.md`, and `GOVERNANCE_L0_DIGEST`
- generated prompt token budget report
- root prompt age / last audit reminder

## No-Middle-State Placement Draft

Suggested canonical verdict block:

```markdown
Decision: APPROVE | REQUEST_CHANGES | NEEDS_CLARIFICATION | CVO_REQUIRED
Blocking P0/P1/P2 open: yes | no
P3 disposition: fixed | waived-with-reason | none
Covered HEAD: {sha}
```

Rules:

- If any verified P0/P1/P2 exists, `Decision` must be `REQUEST_CHANGES`.
- "P2 but not blocking" is invalid. Downgrade to P3 with reason, or block.
- P3 is decided in the same review: fix now or waive with reason. It is not backlog.
- Author receiving contradictory text must fail closed and ask for a corrected verdict.
- Merge gate must not infer approval from praise text.

This belongs in review skills and merge gate checks, not as a broad personality rewrite.

Shared-rules skeleton should be short enough to remain always-on:

```markdown
- Reviewer verdict is binary: APPROVE only when no P0/P1/P2 remains; otherwise REQUEST_CHANGES.
- "P2 but not blocking" and "approve with follow-up" are invalid review states.
```

## Open Questions for Implementation

1. Can Cat Cafe detect whether the native carrier root file was already loaded, so runtime static identity can skip overlapping roster/SOP/governance blocks?
2. Should `GOVERNANCE_L0_DIGEST` be generated from `shared-rules.md` at build time instead of hard-coded in `SystemPromptBuilder.ts`?
3. Should `WORKFLOW_TRIGGERS` move from TypeScript constants into `cat-cafe-skills/manifest.yaml` or another data file?
4. Which carriers currently expose LSP/code-intelligence to cats, and through what plugin/tool path?
5. What is the acceptable token budget for each prompt block type per invocation?

## Minimal Next Patch Set

1. Add a prompt capture report grouped by injection source, using existing `prompt-captures` plumbing where possible.
2. Create a duplication matrix for `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `shared-rules.md`, session hooks, and `SystemPromptBuilder`.
3. Slim root prompts in reversible patches: remove static teammate tables first, then shrink memory routing and SOP tables into pointers.
4. Add the two-line reviewer verdict skeleton to `shared-rules.md` §7.
5. Add `review-result-template.md` or equivalent verdict contract under `cat-cafe-skills/refs/`.
6. Wire `request-review`, `receive-review`, and `merge-gate` to reference that verdict contract.
7. Add a light contradiction detector for review text before merge gate.
8. Recompress `GOVERNANCE_L0_DIGEST` from the updated shared rules, or generate it from source if that path is already available.
9. Evaluate LSP availability separately; do not solve it with more prompt text.

## Migration Order

The safe order is measurement first, then deletion of clear duplicates, then behavior changes:

1. Baseline: capture effective prompt tokens by block type for at least one typical root conversation, one review conversation, and one merge-gate conversation.
2. Delete high-confidence stale copies: root teammate tables, long SOP route tables, and duplicated key-doc tables.
3. Compress memory routing in root files to a short recall principle plus exact entrypoints; keep `memory-routing-partial.md` as the detailed source.
4. Add no-middle-state verdict contract to review skills and shared-rules §7.
5. Add deterministic contradiction detection in merge gate.
6. Only then consider changing `SystemPromptBuilder` conditional injection, because builder fields include current volatile state and are higher blast radius.

## Convergence Check

1. ADR update? No. This discussion refines ADR-030 but does not reject a new architecture option.
2. Lesson update? Yes. Captured as LL-057 in `docs/lessons-learned.md`.
3. Rule update? Not in this patch. Candidate rule for the implementation plan: "new review/process lessons enter root prompts only as a compressed invariant; explanations go to skills and enforcement goes to gates."

## Working Position

The correct fix is not "make Opus less warm." The fix is to stop asking personality text to do gatekeeping work.

Warmth belongs in identity and conversation. Gate semantics belong in templates, checks, and merge gates. Root prompt should carry the few invariants that must always be true; everything else should be scoped, loaded, or enforced.
