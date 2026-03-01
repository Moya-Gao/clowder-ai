---
feature_ids: [F024]
topics: [hooks, task, model-guard]
doc_kind: plan
created: 2026-03-01
---

# Task Hook Model Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Ensure project-level Claude hook config always enforces Task subagent model selection in every worktree.

**Architecture:** Add a project-owned hook script under `.claude/hooks/` and wire it through `.claude/settings.json` `PreToolUse` for `Task` alongside existing `Bash` guard. Protect this contract with a repository test that reads the committed settings file directly.

**Tech Stack:** Bash hooks, JSON config, Node.js built-in test runner (`node:test`), assert.

---

### Task 1: Red test for project hook contract

**Files:**
- Create: `packages/api/test/claude-settings-hooks.test.js`

**Step 1: Write the failing test**
- Assert `.claude/settings.json` has `hooks.PreToolUse` entry with `matcher: "Task"`.
- Assert Task hook command references `"$CLAUDE_PROJECT_DIR"/.claude/hooks/check-subagent-model.sh`.
- Assert the hook script exists and is executable.

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter @cat-cafe/api exec node --test test/claude-settings-hooks.test.js`
- Expected: FAIL (Task matcher / script missing).

### Task 2: Minimal implementation to green

**Files:**
- Create: `.claude/hooks/check-subagent-model.sh`
- Modify: `.claude/settings.json`

**Step 3: Implement minimal fix**
- Add `Task` matcher to `PreToolUse` in project settings.
- Add project-local hook script that blocks missing `model`, warns on `model=opus`.

**Step 4: Run test to verify it passes**
- Run: `pnpm --filter @cat-cafe/api exec node --test test/claude-settings-hooks.test.js`
- Expected: PASS.

### Task 3: Gate checks

**Files:**
- Verify touched files only

**Step 5: Run formatting/lint checks for touched files**
- Run: `pnpm exec biome check .claude/settings.json packages/api/test/claude-settings-hooks.test.js`
- Expected: PASS.

**Step 6: Commit readiness check**
- Run: `git status --short`
- Expected: only intended files changed.
