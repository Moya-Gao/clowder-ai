---
capsule_id: "F190-2026-05-13"
context: "Console/Settings community intake + Phase C high-risk hardening close-out"
feature_ids: [F190]
doc_kind: capsule
created: 2026-05-13
---

# F190 Reflection Capsule

## What Worked

- **Manual-port by risk surface** worked: read-only settings wrappers landed first, then MCP write, Service Manifest, refAudio, and IM connector writes each moved through isolated Phase C slices.
- **Red-zone denylist stayed effective**: Opus-46 verified F183/F184/F194 chat and bubble paths had zero F190 touches across the full intake.
- **Cloud review caught hidden chain gaps** in refAudio: runtime writer persistence, response hydration, and unauthorized multipart drain were all fixed before merge.
- **Alpha channel caught dev-only integration blockers**: `pnpm alpha:start` exposed CSP React Refresh and `ThreadCatPill` render loop issues that unit tests alone would not have found.

## What Failed

- **Decision ownership was briefly pushed to CVO for technical details**: OQ-1..OQ-5 in IM connector write were implementation tradeoffs and should have been self-decided from the design memo.
- **Initial local review under-traced entity fields**: refAudio `voiceConfig` needed schema -> handler -> writer -> loader -> response mapper tracing, not just route-level review.
- **AC-A7 was incorrectly framed as Landy-only manual alpha** even though the agent team can run `pnpm alpha:start` and delegate smoke review to cheaper cats.

## Trigger Missed

- **Resource lifecycle early-return check** should have been explicit for every upload/stream route. The unauthorized multipart drain P1 made this a standard review pattern.
- **Full entity field path audit** should have triggered as soon as `voiceConfig` became user-editable: write path and read path both need complete chain tracing.
- **Alpha ownership check** should have triggered before asking CVO to run smoke manually. Runtime operations can stay read-only/diagnostic while cats handle repeatable alpha checks.

## Doc Links

- Feature spec: `docs/features/F190-console-settings-appshell-skeleton.md`
- Frontend lessons: `cat-cafe-skills/refs/f190-frontend-lessons.md`
- Phase C issue ledger: `cat-cafe#1618`
- Alpha hotfix PR: `cat-cafe#1658`

## Rule Update Target

- `cat-cafe-skills/refs/shared-rules.md`: add review pattern "entity field extension must trace schema -> handler -> writer -> loader -> response mapper".
- `cat-cafe-skills/merge-gate/SKILL.md`: clarify that AC alpha smoke can be executed by cats in `pnpm alpha:start`; CVO alpha is for subjective product signoff, not routine smoke.
