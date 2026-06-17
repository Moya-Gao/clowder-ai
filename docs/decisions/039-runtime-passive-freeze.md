---
title: ADR-039 Runtime Passive Freeze Contract
status: ratified
date: 2026-06-17
related: [F228, LL-077, LL-078]
---

# ADR-039: Runtime Passive Freeze Contract

## Context

The `cat-cafe-runtime` worktree (branch `runtime/main-sync`, default path `../cat-cafe-runtime`) serves cat-cafe API + Web as the user's stable daily runtime. It is conceptually distinct from feature worktrees (where developers iterate with hot reload) and from the user's main worktree (where they edit code).

A runtime crash incident on 2026-06-17 (investigated in thread `thread_mqi54fag1moyg20t`) traced the root cause to:

1. **F228 broader intake commit `42c5b349c`** added a shared export `STANDARD_MOUNT_POINT_IDS` (in `packages/shared/src/types/mount-rules.ts`) plus its import in `packages/api/src/skills/skill-sync-config.ts`. Both were source changes.
2. **`@cat-cafe/shared` dist is gitignored** — built `dist/` artifacts are not in PR diffs.
3. **Runtime sync pulled src changes but didn't rebuild dist** → stale dist on disk.
4. **`tsx watch` (in `start-dev.sh`) detected src changes** → SIGTERM-restarted the API process. The new process loaded stale dist → `SyntaxError` on the missing export.

The actual trigger was confirmed empirically by `opus-48`:
- Process tree showed `tsx watch src/index.ts` running on runtime API (PID 74084).
- API log captured `13:32:59 Received SIGTERM` followed by failed restart.
- No `[runtime-worktree]` log entry (i.e., not a manual `pnpm start`).

## Decision

**Runtime = passive frozen · single entry · explicit restart only.**

The runtime worktree MUST satisfy three invariants:

### Invariant 1: No auto-restart on src change

Runtime API processes spawn with `CAT_CAFE_DIRECT_NO_WATCH=1` (non-watch mode). The runtime does not track `main` source jitter; it does not SIGTERM-restart on file changes. Hot reload is a development convenience that violates the "stable serving" contract.

**Implementation**: `scripts/runtime-worktree.sh` exports `CAT_CAFE_DIRECT_NO_WATCH="${CAT_CAFE_DIRECT_NO_WATCH:-1}"` in both in-place mode (L538-545) and worktree mode (L574-582) before `exec ./scripts/start-dev.sh --prod-web`.

**Feature worktree paths preserved**: `pnpm dev` / `pnpm dev:direct` do not go through `runtime-worktree.sh`. They retain `tsx watch` for hot-reload iteration. This achieves the precise split: feature worktrees keep watch, runtime drops it.

### Invariant 2: Single entry — `pnpm start`

Runtime sync, build, and restart are folded into one user-facing command: `pnpm start` (which delegates to `pnpm runtime:start`).

The standalone `pnpm runtime:sync` command is removed:
- Empirical: zero auto-callers in the repo.
- Conceptual: a "sync without restart" entry encourages out-of-band state changes that violate Invariant 1.
- The `sync_runtime_worktree` function remains, but is invoked only as a subroutine of `start_runtime_worktree`.

### Invariant 3: Build invariant during start

`pnpm start` MUST rebuild stale dist before spawning API/Web processes. This prevents the F228 stale-dist scenario from recurring.

**Implementation**: Already covered by `runtime-worktree.sh:L272-287` (existing build-freshness gate in `start` flow). No new build step needed — the gate now becomes the sole path to dist refresh after Invariant 1+2 are enforced.

## Consequences

### Positive
- **Stable serving**: API connections survive arbitrary main jitter (intake PRs, lessons commits, doc edits). No surprise SIGTERM.
- **Single mental model**: Users learn one command (`pnpm start`). No "should I sync first?" or "is sync enough or do I need restart?"
- **Build invariant tied to restart**: Dist freshness is guaranteed at every restart boundary, not at arbitrary sync points.
- **Crash-resistance**: F228-class stale-dist crashes are structurally prevented (src change can't auto-trigger restart with stale dist).

### Negative
- **No quick sync-without-restart**: Users who wanted to silently pull main without restarting must now restart explicitly. This is judged acceptable — that workflow was a footgun.
- **Slower iteration on runtime**: A developer wanting hot-reload should use a feature worktree (`pnpm dev`) instead of editing in runtime. Mixing the two confuses the contract.

### Risks

- **Build time impact**: If `pnpm --filter @cat-cafe/shared build` adds significant time to `pnpm start`, restart latency increases. Empirical baseline TBD (estimated <5s, acceptable).
- **Untested CAT_CAFE_DIRECT_NO_WATCH path**: The non-watch mode in `start-dev.sh` is exercised in some test paths (`start-entry.mjs:87`). Alpha test should verify runtime behavior end-to-end (LL-064: runtime production paths require alpha verification, not just unit tests).

## Alternatives Considered

### A: Keep watch + add dist rebuild trigger
Watch detects src change → trigger dist rebuild → restart. Rejected because:
- Still violates "stable serving" — connections drop on every main commit.
- Race conditions during multi-package builds (shared rebuilds while api depends on it).
- More moving parts than killing watch entirely.

### B: Commit shared dist to git
Stop gitignoring `packages/shared/dist/`. Rejected because:
- Massive PR noise (every src change produces dist diff).
- Build determinism issues across Node versions.
- The core problem is runtime contract, not dist storage.

### C: Status quo (do nothing)
Wait for next stale-dist crash. Rejected — F228 already cost a runtime crash incident; the design flaw is now visible and fixable.

## Related Lessons

- **LL-077** (pending write-up): Runtime stability requires explicit "passive freeze" contract; copy-paste of dev convenience flags (`tsx watch`) into runtime scripts violates it.
- **LL-064**: Production-critical paths (runtime start, etc.) must be alpha-tested before merge, not relied on for unit-test coverage.

## Provenance

- Crash investigation: `thread_mqi54fag1moyg20t` (Opus-48 forensic trace + opus-47 design verdict)
- Source incident: F228 broader intake `clowder-ai#917` → cat-cafe `42c5b349c`
- Implementation: cat-cafe PR (pending), worktree `fix/runtime-passive-freeze`

[布偶猫/Opus-4.7🐾]
