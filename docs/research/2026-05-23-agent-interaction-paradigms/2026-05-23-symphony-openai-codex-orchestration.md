# Symphony: Open-Source Spec for Codex Orchestration

- **Source**: OpenAI
- **Date**: 2026-05 (late April / early May)
- **URL**: https://openai.com/index/open-source-codex-orchestration-symphony/
- **GitHub**: https://github.com/openai/symphony
- **Spec**: https://github.com/openai/symphony/blob/main/SPEC.md
- **Type**: Open-source spec + Elixir reference implementation (no PDF)

## Core Idea

Turn a project management board (Linear) into a control plane for coding
agents. Each open issue maps to an isolated agent workspace; Symphony
continuously polls, spawns agents, manages retries, and lands PRs.

> "Moving from managing coding agents to managing work that needs to get done."

## Architecture

```
Linear Board ──poll──> Orchestrator ──spawn──> per-issue Workspace
                          |                         |
                     in-memory state            Codex agent subprocess
                     (running/claimed/retry)    (sandbox + approval policy)
```

### Components

- **Workflow Loader**: Reads `WORKFLOW.md` (YAML frontmatter + Markdown prompt
  template)
- **Orchestrator**: Single-authority scheduler, poll -> reconcile -> dispatch,
  bounded concurrency
- **Workspace Manager**: issue -> directory mapping, lifecycle hooks
  (after_create, before_run, after_run, before_remove)
- **Agent Runner**: prepares workspace, builds prompt, launches Codex
  subprocess, streams updates back

## State Machine

**Issue lifecycle**: Unclaimed -> Claimed -> Running/RetryQueued -> Released

**Run attempt phases**: PreparingWorkspace -> BuildingPrompt ->
LaunchingAgentProcess -> InitializingSession -> StreamingTurn -> Finishing ->
terminal (Succeeded/Failed/TimedOut/Stalled/CanceledByReconciliation)

## Key Design Decisions

| Decision | Choice |
|----------|--------|
| State storage | Pure in-memory, restart recovers from tracker |
| Config | Policy-as-Code: `WORKFLOW.md` versioned with repo |
| Retry | Normal exit: 1s continuation; Failure: exponential backoff (max 5min) |
| Safety | Strict workspace isolation + path prefix validation + filename sanitization |
| Recovery | Tracker-driven: no persistent DB, poll active issues on restart |
| Concurrency | Single authority serializes all state mutations |

## Safety Invariants

1. Agent subprocess runs only within per-issue workspace path
2. Workspace path must remain under configured root (prefix validation)
3. Directory names sanitized to `[A-Za-z0-9._-]`

## Reconciliation

- **Stall detection**: elapsed time since last codex event > stall_timeout_ms
  -> terminate + retry
- **State refresh**: fetch current tracker states for running issues; stop +
  clean terminal issues
- **Startup cleanup**: remove workspaces for already-terminal issues

## Results

OpenAI reported **500% increase in merged PRs** on some internal teams.

## Contrast with Cat Cafe

| Dimension | Symphony | Cat Cafe |
|-----------|----------|----------|
| Agent model | Single model x N issues | Multi-model x collaborative |
| Control plane | Linear board | Thread + ball-passing protocol |
| Scope per agent | One issue, isolated | Shared feature, coordinated |
| Orchestration | Automated poll + spawn | Human-in-the-loop + A2A routing |
| Philosophy | "Manage work, not agents" | "Cats are family, not workers" |
