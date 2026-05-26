---
feature_ids: [F209]
related_features: [F102, F188, F193, F200, F208, F213]
topics: [reflection, memory, evidence-recall, dogfood, close-gate]
doc_kind: reflection
created: 2026-05-26
---

# F209 Reflection Capsule — Evidence Recall Optimization

> Feature: F209 — `docs/features/F209-evidence-recall-optimization.md`
> Closed: 2026-05-26
> Close gate: `docs/decisions/2026-05-26-f209-close-gate.md`

## What Worked

1. **Evidence-first boundary held** — F209 never turned recall into summary truth. Every phase kept the same contract: candidate, anchor, drill-down, cat judgment.
2. **D.0 readiness gate was worth the extra day** — it caught stale runtime, missing raw embeddings, file-slice access, and missing visible entity evidence before Perspective was built on top.
3. **Vision guardian dogfood found the real user gap** — Opus 4.6 tested the feature as a cat user and caught the `scope=threads` degraded path that author/reviewer checks had missed.
4. **PR #1910 was a coordinate fix, not a band-aid** — threads/sessions are project-local evidence. Preventing fan-out to global store matches the data model and removes degraded metadata pollution.
5. **ADR-036 converted saga pain into review machinery** — the multi-layer retrieval surface matrix is now reusable for future memory/MCP changes.

## What Failed

1. **Close sequencing lagged after cloud green** — PR #1887 and later PR #1910 both needed explicit nudges to finish merge/close flow. Merge green is not feature close.
2. **D.0 final unblock validated `dimension=project` but not enough `scope=threads` cases** — the original CVO pain was thread recall, so thread-scope semantic/hybrid needed to be a mandatory close dogfood row.
3. **Main vs `cat-cafe-runtime` split confused live dogfood** — code was fixed on main while the live API process still ran the runtime directory. The close report now records this as deployment timing, not feature scope.
4. **Phase E stayed in the spec too long as unchecked ACs** — KD-6 already transferred eval-system ownership to F200, but the spec still looked like F209 carried unfinished work.

## Trigger Missed

1. **Before Phase D close: rerun the exact failing D.0 scopes** — if a readiness report blocks on `scope=threads`, the unblock proof must include `scope=threads`, not only equivalent-looking project/default variants.
2. **After merge-gate: immediately run feat-lifecycle completion** — close docs, BACKLOG, feature index, reflection capsule, and guardian handoff belong in the same work session as the merge.
3. **Live-runtime dogfood must state deployment surface** — every dogfood result should say whether it tested main worktree, alpha, runtime, or an MCP process from another directory.

## Doc Links

- F209 spec: `docs/features/F209-evidence-recall-optimization.md`
- D.0 readiness report: `docs/decisions/2026-05-23-f209-d0-readiness.md`
- Perspective visibility audit: `docs/decisions/2026-05-24-f209-phase-d-visibility-audit.md`
- Close gate report: `docs/decisions/2026-05-26-f209-close-gate.md`
- ADR-036: `docs/decisions/036-f209-retrieval-surface-multi-layer.md`
- PR #1887: Phase D Perspective runtime
- PR #1910: final thread/session scoped recall fix

## Rule Update Target

1. **quality-gate Dogfood-Your-Slice**: include "rerun the exact scope/mode/depth that previously blocked", not just a nearby happy path.
2. **feat-lifecycle Completion**: after merge, require same-session close bookkeeping unless a concrete blocker is recorded.
3. **merge-gate / vision guardian handoff**: dogfood reports must disclose deployment surface (`main`, `alpha`, `runtime`, MCP process path) before interpreting failures.

[砚砚/GPT-5.5🐾]
