---
capsule_id: "F171-Completion-2026-04-25"
context: "F171 First Partner Onboarding completion — clowder-ai#520 intake as first-partner cold-start flow"
feature_ids: [F171]
doc_kind: capsule
created: 2026-04-25
---

## What Worked

- Maintainer review did not accept `clowder-ai#520` as-is. The team separated the useful product intent from upstream's original feature numbering and bootcamp framing, then gave it the home-owned anchor F171.
- Intake Review Guard caught real process risks before merge: false F anchors, incomplete feature-doc closeout, E2E/migration/README scope boundaries, and review continuity after HEAD changes.
- The absorb PR kept Cat Cafe brand and home invariants while bringing home the high-value behavior: empty roster cold start, first-run wizard, account/profile cleanup, guide overlay, and regression coverage.
- Guardian audit after merge checked current main, not just the old PR evidence: brand guard, API build, web build, targeted API/web tests, issue close, and ledger record.

## What Failed

- The first review round overweighted an older PR snapshot. The user had to point out that the contributor's latest commits had changed, which means maintainer review must refresh head state before making final claims.
- Feature closure lagged behind code and ledger closure. F171 was merged, recorded, and guarded, but the spec still said `in-progress` and BACKLOG still listed it as active.
- The intake path was large enough that unrelated test/gate stabilization work accumulated in the absorb PR before final merge, forcing explicit review-continuity confirmation.

## Trigger Missed

- `feat-lifecycle` completion should have triggered immediately after `cat-cafe#1395` merge + ledger advance + guardian audit. The closeout had to be prompted manually.
- Review statements about community PR freshness should include the current source PR head/merge commit, not only the earlier diff snapshot.
- Large intake PRs need the file pagination guard before planning; the 100-file truncation bug would have hidden part of the source surface.

## Doc Links

- F171 spec: `docs/features/F171-first-partner-onboarding.md`
- Community PR: `clowder-ai#520`
- Cat Cafe absorb PR: `cat-cafe#1395`
- Intake Intent Issue: `cat-cafe#1394`
- Intake review request: `docs/mailbox/2026-04-25-intake-clowder-520-review-request.md`
- Ledger: `docs/ops/opensource-intake-ledger.json`

## Rule Update Target

- `feat-lifecycle` SKILL.md Completion: after an intake feature reaches `PR merged + issue closed + ledger advanced + guardian audit pass`, immediately close the feature doc and BACKLOG entry in the same work session.
- `opensource-ops` refs: keep the large-PR REST pagination guard as a hard requirement for `--mode=plan`, because GraphQL/default PR file reads can truncate at 100 files.
- `merge-gate` Review Continuity Guard: continue requiring explicit reviewer extension whenever gate fixes or rebase change the absorb PR HEAD.
