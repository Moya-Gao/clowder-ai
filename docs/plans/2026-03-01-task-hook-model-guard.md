---
feature_ids: [F024]
topics: [hooks, task, model-guard, subagent-type]
doc_kind: plan
created: 2026-03-01
updated: 2026-03-06
---

# Task Hook Model Guard — Subagent Cost Control

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Control Opus token burn from subagents by gating `Agent` tool calls based on `subagent_type`.

**Architecture:** `.claude/hooks/check-subagent-model.sh` wired through `.claude/settings.json` `PreToolUse` matcher `"Task"`. Protected by `packages/api/test/claude-settings-hooks.test.js`.

---

## Empirical Findings (2026-03-06, Claude Code v2.1.70)

### Agent Tool Schema — No `model` Parameter

The Agent tool only has these parameters:
- `description`, `prompt`, `subagent_type`, `isolation`, `resume`, `run_in_background`

**There is NO `model` parameter.** The original plan assumed `model` existed; it doesn't.

### subagent_type → Model Selection (Empirical)

| subagent_type | Model selected | Cost | Hook decision |
|---------------|---------------|------|---------------|
| `Explore` | `claude-haiku-4-5` (auto) | Cheap | **allow** |
| `Plan` | Inherits parent (Opus) | Expensive but justified | **allow** |
| `general-purpose` | Inherits parent (Opus) | Expensive, usually overkill | **ask** |
| (empty/unspecified) | Inherits parent (Opus) | Expensive, usually overkill | **ask** |

### Hook Matcher Behavior

- Matcher `"Task"` matches: `Task`, `TaskOutput`, `TaskStop`, and `Agent` (internal mapping)
- `TaskOutput`/`TaskStop` are read/stop ops → always allow (exit 0, no JSON output)

### Anti-Pattern: Deny → Self-Grep Fallback

When the hook previously **denied** Agent calls, Opus fell back to self-grep — polluting Opus context with search results that a haiku subagent could have handled cheaply. The fix: use **ask** (not deny) for general-purpose, and clearly explain the alternative.

---

## Implementation (Completed)

### Phase 1: Original Plan (2026-03-01)

Implemented model-param checking hook. Tests validated `model` field presence.

### Phase 2: Rewrite (2026-03-06)

Discovered `model` parameter doesn't exist in Agent tool schema. Rewrote hook to check `subagent_type` instead:

1. `TaskOutput`/`TaskStop` → silent allow (exit 0)
2. `Explore` → allow (auto-haiku, cheap)
3. `Plan` → allow (needs Opus-level thinking)
4. `general-purpose`/empty → ask with explanation

**Commits:**
- `072faf54` — skip model check for TaskOutput/TaskStop
- `13e9367c` — rewrite deny message
- `c7f30017` — add precise haiku/sonnet criteria
- `c6232a76` — clarify all Agent types support model
- `7521fa8b` — complete rewrite to subagent_type-based checking
- `6532bac9` — allow Plan, only ask for general-purpose

### Phase 3: Test Rewrite (2026-03-06)

Rewrote tests to validate subagent_type-based logic instead of model-param logic.

---

## Files

| File | Role |
|------|------|
| `.claude/hooks/check-subagent-model.sh` | Hook script (subagent_type gating) |
| `.claude/settings.json` | Hook wiring (PreToolUse → Task matcher) |
| `packages/api/test/claude-settings-hooks.test.js` | Contract tests |
| `docs/plans/2026-03-01-task-hook-model-guard.md` | This plan doc |
