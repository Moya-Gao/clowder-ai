---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Project instructions are authoritative + safety verification = reliable isolation.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Directory Selection Process

Follow this priority order:

### 1. Check Project Instructions (HIGHEST PRIORITY)

```bash
# Check project-level instructions for worktree directory preference
grep -i "worktree" CLAUDE.md AGENTS.md GEMINI.md 2>/dev/null
```

**If preference specified:** Use it without asking. Project conventions are authoritative and always win.

> **Why first?** A `.worktrees/` directory may exist from a previous incorrect creation.
> Project instructions represent the team's deliberate choice. Existing directories are
> just artifacts — they can be stale, wrong, or created by accident.

### 2. Check Existing Directories (fallback)

Only if project instructions say nothing about worktree location:

```bash
# Check in priority order
ls -d .worktrees 2>/dev/null     # Preferred (hidden)
ls -d worktrees 2>/dev/null      # Alternative
```

**If found:** Use that directory. If both exist, `.worktrees` wins.

### 3. Ask User

If no project preference and no existing directory:

```
No worktree directory found. Where should I create worktrees?

1. .worktrees/ (project-local, hidden)
2. ../project-name-{feature}/ (sibling directory)
3. ~/.config/superpowers/worktrees/<project-name>/ (global location)

Which would you prefer?
```

## Safety Verification

### For Project-Local Directories (.worktrees or worktrees)

**MUST verify directory is ignored before creating worktree:**

```bash
# Check if directory is ignored (respects local, global, and system gitignore)
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:**

Per Jesse's rule "Fix broken things immediately":
1. Add appropriate line to .gitignore
2. Commit the change
3. Proceed with worktree creation

**Why critical:** Prevents accidentally committing worktree contents to repository.

### For Sibling or Global Directories

No .gitignore verification needed - outside project entirely.

## Worktree Protection Rules

**Some worktrees are NOT development branches — they are runtime environments.**

Before cleaning up any worktree, check:
1. Is it named `*-runtime`? → **NEVER delete.** This is a production environment.
2. Is another cat actively using it? → **Do not delete.**
3. Is its branch merged into main? → Safe to clean up (unless rule 1 or 2 applies).

## Creation Steps

### 1. Detect Project Name

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

### 2. Create Worktree

```bash
# Determine full path based on selected location
case $LOCATION in
  sibling)
    # Preferred for projects that specify sibling directory convention
    path="../$project-$FEATURE_NAME"
    ;;
  .worktrees|worktrees)
    path="$LOCATION/$BRANCH_NAME"
    ;;
  ~/.config/superpowers/worktrees/*)
    path="~/.config/superpowers/worktrees/$project/$BRANCH_NAME"
    ;;
esac

# Create worktree with new branch
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

### 3. Run Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 4. Verify Clean Baseline

Run tests to ensure worktree starts clean:

```bash
# Examples - use project-appropriate command
npm test
cargo test
pytest
go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

### 5. Report Location

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| CLAUDE.md specifies location | Use it (highest priority) |
| `.worktrees/` exists, no project preference | Use it (verify ignored) |
| `worktrees/` exists, no project preference | Use it (verify ignored) |
| Neither exists, no preference | Ask user |
| Directory not ignored | Add to .gitignore + commit |
| Tests fail during baseline | Report failures + ask |
| Worktree named `*-runtime` | **NEVER delete** — production environment |

## Common Mistakes

### Ignoring project instructions

- **Problem:** `.worktrees/` exists from a past mistake, skill uses it instead of project convention
- **Fix:** Always check CLAUDE.md/AGENTS.md/GEMINI.md FIRST. Project instructions > existing directories.

### Deleting runtime worktrees

- **Problem:** `*-runtime` worktrees are production environments, not dev branches
- **Fix:** Never clean up worktrees named `*-runtime`. Ask user if unsure.

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always use `git check-ignore` before creating project-local worktree

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Follow priority: project instructions > existing > ask

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

### Hardcoding setup commands

- **Problem:** Breaks on projects using different tools
- **Fix:** Auto-detect from project files (package.json, etc.)

## Example Workflow

```
You: I'm using the using-git-worktrees skill to set up an isolated workspace.

[Check CLAUDE.md - says "worktree add ../cat-cafe-{feature-name}"]
[Create worktree: git worktree add ../cat-cafe-auth -b feat/auth]
[Run pnpm install]
[Run pnpm test - 984 passing]

Worktree ready at /Users/lysander/projects/relay-station/cat-cafe-auth
Tests passing (984 tests, 0 failures)
Ready to implement auth feature
```

## Red Flags

**Never:**
- Create worktree without checking project instructions first
- Delete a `*-runtime` worktree
- Skip baseline test verification
- Proceed with failing tests without asking
- Let `.worktrees/` override explicit project conventions

**Always:**
- Follow directory priority: project instructions > existing > ask
- Verify directory is ignored for project-local
- Auto-detect and run project setup
- Verify clean test baseline

## Integration

**Called by:**
- **brainstorming** (Phase 4) - REQUIRED when design is approved and implementation follows
- Any skill needing isolated workspace

**Pairs with:**
- **finishing-a-development-branch** - REQUIRED for cleanup after work complete
- **executing-plans** or **subagent-driven-development** - Work happens in this worktree
