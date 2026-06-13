---
doc_kind: review-request
topics: [memory, runtime, worktree-sync]
created: 2026-06-12
---

# Review Request: Materialize Commit Opt-In + Runtime Sync Diverged Diagnostics

Review-Target-ID: materialize-commit-optin
Branch: fix/materialize-commit-optin

## What

Two commits fixing the runtime-startup ff-only sync failure 铲屎官 hit this morning — the **sibling root cause** to your #2200 (same symptom, different mechanism, #2200 did not cover it):

| | #2200 (merged) | This PR |
|---|---|---|
| Symptom | runtime ff-only sync fails | same |
| Mechanism | untracked avatar collides with incoming-tracked (**working-tree layer**) | runtime materialize `git commit` makes the branch local-ahead/**diverged** (**commit-history layer**) |
| Script behavior | your `print_untracked_merge_blockers` reports the real blocker | falls through to `No untracked files matching… git status` ← **the exact line that misled 铲屎官** |

- **C1 (`90e622c96`) — root fix**: `MaterializationService.materialize` now git-commits **opt-in** via `MaterializeOptions.commit` (default off). Previously it unconditionally `git add && git commit`-ed each materialized `.md`; in the runtime worktree that committed onto `runtime/main-sync`, diverging it from origin/main — every materialized lesson guaranteed the next ff-only sync fails.
- **C2 (`d203444c0`) — defense**: `runtime-worktree.sh` ff-only failure now detects ahead/diverged and reports the diverged commit count + reset guidance, instead of the misleading "No untracked files matching". Complements #2200's untracked-blocker diagnostics.

## Why (root cause, traced)

`MaterializationService.ts` (pre-fix) ran `git add && git commit -m "materialize: <anchor>"` unconditionally, cwd = `docsRoot/lessons` → in runtime = commit onto `runtime/main-sync`. Confirmed this morning via `git log origin/main..HEAD` showing 2 `materialize: lesson-XXX` commits; source markers still untracked in `docs/markers/` (source of truth intact).

## Design alignment (in-thread design gate)

We aligned before coding: you picked **opt-in (not hard-delete)** so the local-dev commit path stays available, and suggested the ahead/diverged diagnostic. Both landed exactly as agreed.

## Architecture Ownership

- **Architecture cell**: memory/materialization + runtime-worktree launcher script
- **Map delta**: none
- **Why**: adds an opt-in flag to an existing service method + a diagnostic branch to an existing launcher script. No new Store/Queue/Router/Adapter/Dispatcher/Binding.

## Caller impact (grep-verified)

`materialize()` has exactly **one** src caller: `knowledge-feed.ts:162` (approve flow). It passes no `commit` → now defaults to no-commit. Full-repo grep (`*.ts/*.mjs/*.js`) confirms no other caller.

## Open Questions

### Technical OQ (for you)

1. **Semantic check (the one I want your eyes on)**: with default no-commit, knowledge-feed `approve` materializes a lesson that **writes to disk + reindexes** (locally searchable) but is **not git-committed**. The marker stays source of truth for cross-cat sharing. Does this match intended persistence semantics, or did any path rely on the auto-commit to land lessons on main? My read: reindex covers local recall; cross-cat sync was never this path's job. But you know the knowledge-feed flow better — please confirm.
2. **Shell safety**: `ahead_count=$(git … || echo 0)` + `[ "$ahead_count" -gt 0 ]` in if-position under `set -euo pipefail`. I deliberately avoided the `[ x ] && continue` trap you hit in #2200. Sane?

### Value OQ

None.

## Self-Check Evidence

### Tests (this run)

```
node --test packages/api/test/memory/materialization-service.test.js   → 21 passed, 0 failed
  (added: "does NOT commit by default (commit is opt-in)";
   updated commit test + e2e to pass { commit: true })
node --test packages/api/test/runtime-worktree-script.test.js           → 19 passed, 0 failed
  (added: "reports local ahead/diverged commits blocking an ff-only runtime sync")
bash -n scripts/runtime-worktree.sh                                     → exit 0
pnpm exec biome check <changed files>                                   → 0 warning
  (refactored commitFile() out of materialize() to keep complexity ≤15)
pnpm gate                                                               → build ✓ passed; tsc/test/check in progress (will confirm before merge)
```

### Quality Gate

- hotfix=false, fallback=0 code-layer, architecture cell delta=none, artifact hygiene clean
- **Dogfood**: 🆗 exempt (pure-internal bugfix, no user/cat-perceivable path change — lesson still writes + reindexes/searchable, only the git-commit side effect is removed; verified via materialization test reindex assertions + diverged test real-output assertion)

### Diff scope (5 files)

- C1: `MaterializationService.ts`, `interfaces.ts`, `materialization-service.test.js`
- C2: `runtime-worktree.sh`, `runtime-worktree-script.test.js`

## Review Sandbox

- Path: `/tmp/cat-cafe-review/materialize-commit-optin/codex`
- Start command: not needed (service logic + shell, test-only review)
- Ports: none

## Next Action

Please review C1 (opt-in correctness + OQ1 semantic) and C2 (shell safety + OQ2). The immediate runtime stop-gap (reset RT to origin/main) is 铲屎官's per the runtime-sync P0 and decoupled from this root-fix PR.
