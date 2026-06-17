---
title: Community Reconciliation 2026-06-17
date: 2026-06-17
sync_pr: clowder-ai#956
source_range: 0952b377..0a275da6
sync_merge_commit: f3d530cea3efc8e193892769c2368ff812bd0258
---

# Community Reconciliation: 2026-06-17 — F228 broader outbound sync

## Synced Content

### Features

- **F228 Phase A/B (multi-project skill mount management)** — full broader implementation absorbed via outbound sync; inbound rebase + merge of `clowder-ai#917` (mindfn) layered on top of this baseline
- **F239 Phase A/B (skill mount HOME hygiene)** — `sync:skills` default project-level; legacy HOME-level symlinks cleanup with `clean-stale-skill-links.sh` + `setup.sh` hints
- **F235 (community publisher)** — frustration-issue-to-GitHub-issue automation pipeline; outbound channel for community signals
- **F238 Phase D + E (Bidirectional Boundary Symmetry)** — reverse-sanitizer detect-only CLI + round-trip fixtures + `--summary-json` counters; vision guardian sign-off (烁烁/Gemini 3.5 Flash)
- **F192 (eval:a2a sample window build)** — `/api/telemetry/traces` expandLimit opt-in
- **CI test:public exclusion governance Phase A** — `public-test-exclusions.json` registry + resolver/validator (replaces 43-entry `grep -v` chain in shell script)

### Bug Fixes

- **fix(sync) R1-R6 + R7-R8 (F228 outbound sync drift bow wave cleared)** — 8 distinct drift classes patched across the outbound sync toolchain (sanitizer line-based JSON, file-type scope, script surface closure, race-residue, doc template, obsolete transform, flaky test PID collision, internalScripts coverage)
- **fix(F239)** — `Status: complete` → `closed` alignment with `isDoneStatus()` classifier
- **fix(test)** — Windows port probe tests use high PID values (90xxx) to prevent flaky failures in test-isolation mode
- **fix(#949)** — MR review thread rotation to prevent context overflow
- **fix(merge-gate)** — degradation table corrected: cross-provider, not same-provider

### Process

- LL-075 / LL-076 (-p mode + worktree gate execution lessons + outsource-before-verify variant)
- F228 Phase 2 outbound sync `f3d530cea` (8 round drift fix + Spark Phase 5 continuity ack)

## Community Issue Review

Reviewed sync payload + already-merged community PRs included in this snapshot + cross-checked open issues affected by the 7-day source range. Per-issue verdict (cross-validation by `Ragdoll-Opus-4.6` parallel session, replacing 砚砚 GPT-5.5 due to token exhaustion — Step 8.3 SOP-compliant non-author cross-validation):

### Close

- **clowder-ai#741** — Full test suite red on public main → CLOSE. F228+F239 fix landed; `pre-merge-check.sh:resolve_test_mode()` auto-detects public mode → invokes `test:public` (now driven by `public-test-exclusions.json` registry). Attempt #9 全 gate green is direct evidence.
- **clowder-ai#932** — HOME-level skill links → CLOSE. PR `clowder-ai#931` already merged on `8845a42c5` (base of this sync) removed HOME-level linking from install scripts.

### Close (with caveat — CVO scope review noted)

- **clowder-ai#923** — eval:a2a runtime → CLOSE with caveat. F167-C2 + F192 patched verdict scope + eval infra (code layer). Issue labeled `needs-maintainer-decision` — comment should note CVO reviews remaining open scope.

### Keep open (comment + tracking)

- **clowder-ai#832** — sentinel for source vs public mirror auto-detection → KEEP OPEN + progress comment. Public-side detection works (`.claude/settings.json` absent + `test:public` exists → correctly returns public mode). Root cause untreated: source clean clones similarly lack `.claude/settings.json` and misdetect as public unless `CAT_CAFE_GATE_TEST_MODE=full` is explicitly set. Tracked-marker-file fix deferred.
- **clowder-ai#927** — governance registry as source of truth → KEEP OPEN. Out of scope for this sync (F168 Phase C Community Operations Role Registry, ≠ internal `governance-registry.json` project-discovery UX). Different problem domain.
- **clowder-ai#895** — totalEvents=1 textEvents=0 → KEEP OPEN. Upstream `opencode` CLI behavior (`--format json` outputs only `step_start` before exit). F194 codex stream convergence is in-house stream processing, does not fix upstream CLI output.

### Push back to CVO (RFC scope)

- **clowder-ai#598** — Review Verdict Scope RFC → PUSH BACK + KEEP OPEN. F167-C2 patched verdict routing scope at the code layer, but `#598` is labeled `enhancement` and frames an RFC-level governance design (broader scope than a code patch). Closing on code-fix alone may collapse the RFC tracking surface; CVO should review whether F167-C2 fully resolves RFC scope or if RFC stays open as an enhancement tracker.

### Already done (no action)

- **clowder-ai#915** — session handoff → already CLOSED
- **clowder-ai#929** — batch 6 issues fix → already MERGED

## Actions Taken

- Verified sync PR `clowder-ai#956` merged after CI passed (Lint / Test (Windows) / Build / Test (Public) / Directory Size Guard / Brand Boundary Guard F238) and source-owned public gate green via `sync-to-opensource.sh --yes` (Phase 2 attempt #9 after 8-round drift fix)
- Cross-validation by `Ragdoll-Opus-4.6` parallel session (Step 8.3) due to 砚砚 GPT-5.5 / GPT-5.4 token exhaustion; replaces Maine family reviewer when Maine cascade is unavailable; satisfies "non-author, non-reviewer" continuity rule via different-session-different-thread `parallel-self` instantiation
- Spark (Maine 5.3-codex) confirmed Phase 5 review continuity on `#917` rebased HEAD (`410f76f4e`), allowing merge without re-running deep review

## Release Provenance

- Sync PR: `clowder-ai#956`
- Sync merge commit: `f3d530cea3efc8e193892769c2368ff812bd0258`
- Source commit: `0a275da699b6` (`fix(sync): strip check:boundary-roundtrip from exported package.json`)
- Source range: `0952b377..0a275da6`
- Inbound PR `clowder-ai#917` (F228 broader implementation by `mindfn`) merged on top of this sync at `9ac16836b6368948b170c72e736197579d2c8003`
- Companion cat-cafe absorb PR: pending Phase 6 intake (will reference this reconciliation)

## Recommended CVO Actions

1. **Close immediately**: `clowder-ai#741`, `clowder-ai#932` (verified resolved)
2. **Close with comment**: `clowder-ai#923` (note CVO review on remaining RFC scope)
3. **Add progress comment + keep open**: `clowder-ai#832` (root-cause fix deferred), `clowder-ai#927` (out of scope), `clowder-ai#895` (upstream)
4. **Review RFC scope, then decide**: `clowder-ai#598` (push-back — F167-C2 may not fully resolve RFC tracking)
5. **No action**: `clowder-ai#915`, `clowder-ai#929` (already done)
