---
capsule_id: "F168-Close-2026-06-19"
context: "F168 Community Operations Board reopen close: Event Log, narrator routing, closure/reconciler, and Decision Queue"
feature_ids: [F168]
doc_kind: capsule
created: 2026-06-19
---

## What Worked
- The reopen split into A-E kept the original pain visible while allowing each layer to close with concrete invariants: Event Log/projection, repo comment intake, narrator routing, closure/reconciler, and Decision Queue.
- LL-072 cloud-loop sealing kept review noise from turning into endless rework while still fixing true P1/P2 findings.
- Phase C's stale-dist lesson was applied at final guard time: Opus 4.7 did a clean rebuild before test verdicts, preventing another false failure.
- Phase E turned the board from a raw status list into an owner action queue: urgent decisions float first, owner-thread navigation is preserved, and close-via-github stays external-only.

## What Failed
- The feature took two generations: the April v1 shipped useful surfaces, but production use exposed that webhook events, dispatch, closure, and owner actions were not one coherent loop.
- Ownership changed from Fable to Opus family to Codex-led Phase D/E; the handoff chain worked, but the status docs lagged behind several merge steps and needed repeated truth sync.
- Route guard behavior around external review waits still conflicted with KD-27 event-backed waits, causing redundant hold/route-guard churn after PR tracking and EYES were already present.
- `packages/web/src/components/community/DecisionQueueItem.tsx` closed at 380 lines, crossing the 350-line hard cap by 30 lines.

## Trigger Missed
- Component-size audit should have fired before Phase E close guard merged, not only during final vision guard.
- Completion routing should distinguish "waiting on GitHub/CI" from "event-backed PR tracking already exists"; otherwise a stale timer can wake after the PR has merged.
- Phase plans need a clearer "closed/archived" convention. F168 Phase E has a plan file, but no obvious docs/plans archive pattern to follow.

## Doc Links
- `docs/features/F168-community-ops-board.md`
- `docs/plans/2026-06-19-f168-phase-e-decision-queue.md`
- `docs/discussions/2026-06-19-f168-close-gate/close-gate-report.md`
- PR #2425 `c979ce8d2` — Phase E backend decision queue contract
- PR #2431 `2d35bd585` — Phase E frontend UX + docs
- PR #2432 `14fdb4e6` — Phase E close guard

## Rule Update Target
- `cat-cafe-skills/merge-gate/SKILL.md`: clarify KD-27 event-backed wait exit so route guard does not require a fresh `hold_ball` when PR tracking/EYES already covers the external condition.
- `cat-cafe-skills/feat-lifecycle/SKILL.md`: specify how to mark a phase plan closed when no `docs/plans/archive/` convention exists.
- `cat-cafe-skills/refs/close-gate.md`: distinguish non-blocking P3 hardening candidates from illegal unmet-AC close resolutions.
