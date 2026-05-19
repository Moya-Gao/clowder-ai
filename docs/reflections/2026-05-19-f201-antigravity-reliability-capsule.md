---
capsule_id: "F201-CLOSE-GATE-2026-05-19"
context: "F201 Antigravity Reliability Contract close-gate reflection"
feature_ids: [F201]
doc_kind: capsule
created: 2026-05-19
---

# F201 Reflection Capsule

## What Worked

- **Side-effect state stayed single-source**: Phase B `AntigravitySideEffectJournal` became the only side-effect truth source, and later supervisor records only copied journal summaries. This avoided the classic reliability bug where retry, UI, and durable state each invent their own effect classification.
- **Reviewer pressure improved the boundary**: Opus-47 and cloud Codex repeatedly found real safety gaps in the long-task and YOLO path: root-delete aliases, `/bin/rm`/case variants, timeout order, listener ordering, static CSS lifecycle bypasses, and `NODE_ENV` pollution. These were not style nits; they closed real escape paths.
- **Phase F corrected the coordinates**: The first five phases made failures diagnosable, but did not stop long tasks from becoming recovery cases. The CVO pushback on 2026-05-17 forced the right coordinate system: liveness evidence + durable supervisor + bounded resume, not just better error cards.
- **AC-G8 used root-cause conditions**: The final alpha smoke deliberately ran under `NODE_ENV=production`, the original failing shell condition. Passing there is stronger than a clean-shell alpha pass.

## What Failed

- **Initial close criteria drifted**: AC-B2/C2/C3 kept older availability-smoke wording after Phase F changed the actual close gate. The close report had to explicitly delete/scope-correct those lines instead of silently pretending they were met.
- **Alpha 500 diagnosis spent too long on CSS file identity**: PR #1756 and #1760 were useful defense-in-depth, but the real root cause was environment contamination: `start-dev.sh` inherited `NODE_ENV=production`, making `next dev` route `globals.css` through an incomplete CSS loader chain.
- **Static-link assumptions needed deterministic evidence**: The cascade-order P1 looked plausible in review, but real Next HTML order showed bundled app CSS loads before JSX static links. Byte-offset evidence beat screenshot intuition.
- **Long-running external smoke is a poor close proxy**: A three-run live matrix sounds rigorous but can become brittle ceremony. F201 ended with targeted deterministic alpha evidence and typed report guards, while leaving agent-key lifecycle health to F178.

## Lessons

- **Alpha 500 first probe**: capture the child process environment before chasing loader files. If `next dev` is running under `NODE_ENV=production`, CSS/PostCSS behavior is suspect by default.
- **Defense-in-depth is not root cause**: static vendor links are valid because those app CSS files do not need Next/PostCSS, but `globals.css` still must go through PostCSS. The root-cause fix was pinning frontend dev `NODE_ENV=development`.
- **Safety invariants need ordering proof**: in controlled YOLO, hard refusal must execute before timeout-wrapped dispatch. Tests and review should prove ordering, not only output behavior.
- **Close reports must name deletions**: old ACs can be deleted or scoped out, but only if the report says why and asks CVO signoff. Leaving them unchecked or silently checking them both rot the spec.

## Links

- F201 spec: `docs/features/F201-antigravity-reliability-contract.md`
- Alpha static-link hotfix chain: PR #1756, PR #1760, PR #1773
- Long-task Phase F PRs: PR #1735, #1739, #1740, #1741, #1743, #1744, #1749, #1751
- Harness feedback: `docs/harness-feedback/reviews/F201-feature-fit-review.md`
