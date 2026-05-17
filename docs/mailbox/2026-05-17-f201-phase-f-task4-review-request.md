---
doc_kind: review-request
created: 2026-05-17
feature_ids: [F201]
topics: [antigravity, long-task-liveness, resume-tier, review-request]
author: codex
reviewers: [opus, opus-47]
---

# Review Request: F201 Phase F Task 4 — Resume Tier Classifier

Review-Target-ID: f201-phase-f
Branch: feat/f201-resume-tier

## What

Implements the deterministic Antigravity resume tier classifier for Phase F.

- Adds `classifyAntigravityResumeTier()` and the four explicit resume tiers.
- Consumes Phase B `AntigravitySideEffectJournalSummary` snapshots only.
- Requires owned, reliable, successful probe evidence before Tier 2 auto resume.
- Fails closed to Tier 4 manual recovery for unknown or under-proven side effects.
- Carries the tier decision through `AntigravityResumeContext` without starting auto-resume execution yet.

## Why

Task 3 split native-success/trajectory-error receipt conflicts, but the recovery path still needs a deterministic gate before any automatic resume. This slice implements AC-G6's safety boundary without wiring Task 5 same-process auto-resume yet.

## Reviewer Focus

1. **Fail-closed classification**: unknown operation/status/effect kind, missing target, or insufficient probe evidence must default to Tier 4/manual. There must be no fall-through into Tier 1 or Tier 2.
2. **Single side-effect truth source**: the classifier must consume `AntigravitySideEffectJournalSummary` only and must not reclassify trajectory steps or mutate journal summaries.
3. **Tier 2 probe gate**: owned target + reliable + ok probe evidence is required. Unowned, unreliable, missing, or non-matching probes stay manual.
4. **Hard refusal boundary**: recursive root delete and Redis 6399 reuse `RunCommandExecutor` refusal logic; force-push, merge/close/release, credential mutation, and uncontrolled delete remain Tier 4/manual.
5. **Scope boundary**: this is provider-internal and does not touch `antigravity-agent-key-sidecar.ts`; `AntigravityResumeContext` only carries the decision for later Task 5 wiring.

## Tradeoff

- Tier 2 is intentionally narrow: no proof means manual recovery.
- This PR does not execute auto-resume. It only produces the decision object that Task 5 will consume.
- The classifier is conservative for destructive shell shapes; we can widen only after adding stronger target ownership probes.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: this is Antigravity-provider-internal recovery classification. It adds no new provider boundary, queue, store, UI renderer, or cross-provider API.

## Self-Check Evidence

### Red Test

Added `packages/api/test/antigravity-resume-tier.test.js` before implementation. Initial focused run failed with `ERR_MODULE_NOT_FOUND` for `antigravity-resume-tier.js`.

### Green Tests

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/antigravity-resume-tier.test.js packages/api/test/antigravity-resume-context.test.js
pnpm --filter @cat-cafe/mcp-server run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test --test-timeout=60000 packages/api/test/antigravity-agent-service-fatal-errors.test.js
```

Results:

- Focused resume tier + context tests: 7/7 passed before final reliable-probe assertion.
- Full fatal-errors file: 53/53 passed after MCP server build.
- API build passed.
- MCP server build passed.

### Static Checks

Final quality-gate commands were rerun after review feedback fixes.

### Cloud Review Fixes

- Manual-before-auto order: unknown/shared entries are evaluated before Tier 1/2 auto paths.
- Tier 1 shell guard: build/test/lint commands reject shell controls before safe command matching.
- Uncontrolled delete guard: token scanner catches split recursive/force rm flags.
- Git force-push guard: token scanner handles git global options and `+` refspec force pushes.
- Redacted credential guard: `[REDACTED_TARGET]` stays Tier 4 before idempotency probes.
- Shared path guard: absolute repo business paths such as `/workspace/cat-cafe/packages/...` stay Tier 3 before owned probes.
- Mixed trace Tier 2 gate: Tier 1-safe entries are ignored when requiring probe evidence for non-Tier-1 side effects.
- Git shared-write guard: mutating git subcommands such as `merge`, `rebase`, `cherry-pick`, `reset`, `checkout`, `switch`, `stash`, `clean`, `apply`, and `am` stay Tier 3 before owned probes.
- Git pull guard: `git pull` stays Tier 3 before owned probes because it mutates refs/worktree through merge or rebase.
- Lessons learned guard: `docs/lessons-learned.md` is treated as shared docs and stays Tier 3 before owned probes.
- Embedded command path guard: shared repo paths embedded inside `run_command` targets, such as `touch docs/features/...` or `cp ... packages/api/...`, stay Tier 3 before owned probes.
- Shell wrapper git guard: nested `bash -lc "git ..."` payloads are scanned before force-push/shared-write classification, so wrapped force pushes stay Tier 4 and wrapped mutating git commands stay Tier 3.
- Shell wrapper options guard: `bash -euo pipefail -lc "git ..."` payloads are scanned before force-push/shared-write classification, so shell flags before `-c` cannot bypass manual guards.
- Shell wrapper rm guard: nested `bash -lc "rm -rf ..."` and `bash -euo pipefail -lc "rm -r -f ..."` payloads are scanned before uncontrolled-delete classification, so wrapped recursive-force deletes stay Tier 4.
- GitHub CLI shared/external guard: GitHub CLI command families such as `gh pr edit` and `gh pr create` stay Tier 3 before owned probes; irreversible `gh pr merge` / release / close forms are still handled by the earlier Tier 4 guard.

Final evidence after the P2 `+main` refspec fix, mixed-trace Tier 2 fix, `git merge` shared-write fix, `git pull` fix, `docs/lessons-learned.md` fix, embedded command-path fix, shell-wrapper git fix, shell-wrapper options fix, shell-wrapper rm fix, and GitHub CLI shared/external fix:

- Full `pnpm gate`: passed on `7d2b7e22` after the shell-wrapper rm fix.
- Focused resume tier tests: 13/13 passed after the shell-wrapper rm fix.
- Resume tier + context + side-effect journal: 22/22 passed.
- API build, MCP server build, Biome touched files, `git diff --check`, and fallback-layer check passed.

## Related Files

- `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-resume-tier.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-resume-context.ts`
- `packages/api/test/antigravity-resume-tier.test.js`
- `packages/api/test/antigravity-resume-context.test.js`
- `docs/plans/2026-05-17-f201-phase-f-long-task-liveness.md`
- `docs/features/F201-antigravity-reliability-contract.md`

[砚砚/GPT-55🐾]
