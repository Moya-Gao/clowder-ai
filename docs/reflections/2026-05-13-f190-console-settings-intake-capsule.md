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
- **CRITICAL: No visual / functional parity diff across the entire review chain (post-close discovery, CVO push back 2026-05-13)**: Review/愿景守护 link never compared open-source vs local UI side-by-side. `settings/` 开源 20 components vs ours 13—missing PushServiceConfig (VAPID 公私钥输入面板), GithubConfigPanel, capability-settings-ui, InstallPreviewModal, ServiceStatusPanel, SkillsContent, useCapabilityState. 4/7 are F190 KD-5 deliberate defer (secret write-back), but the deliberate defer was never mapped to user-visible UI degradation—CVO close-gate saw `Phase C 4/4 ✅` without knowing "通知页 退化成诊断矩阵". Plus 2 SVG icons (`box`/`puzzle`) were genuine review miss, fixed via hotfix PR #1659 (`d928fb696`).
- **Vision guardian PASS conflated "red-zone untouched" with "vision achieved"**: Opus-46 守护 verified F183/F184/F194 red-zone files had 0 F190 commits and called it "source intent preserved"—but source intent ≠ source feature parity. "Didn't break existing" ≠ "Brought back what should have come".
- **Reviewer/CVO perspective misalignment**: Reviewer's mental model = "is the section wired up + code diff clean", CVO's mental model = "can I actually configure VAPID in the UI"—these two perspectives diverged silently for 4 Phase C slices.

## Trigger Missed

- **Resource lifecycle early-return check** should have been explicit for every upload/stream route. The unauthorized multipart drain P1 made this a standard review pattern.
- **Full entity field path audit** should have triggered as soon as `voiceConfig` became user-editable: write path and read path both need complete chain tracing.
- **Alpha ownership check** should have triggered before asking CVO to run smoke manually. Runtime operations can stay read-only/diagnostic while cats handle repeatable alpha checks.
- **Visual parity diff trigger**: inbound community PR with UI changes should auto-trigger "open-source screenshot vs local screenshot" comparison at request-review stage, not after CVO push-back at post-close.
- **Deliberate defer transparency trigger**: every `deferred` decision in a feature spec should auto-trigger a "user-visible consequence" line in the close report. KD-5 said "secret write-back is deferred"—but never said "通知页变成纯诊断" in CVO-readable language.

## Trigger Missed

- **Resource lifecycle early-return check** should have been explicit for every upload/stream route. The unauthorized multipart drain P1 made this a standard review pattern.
- **Full entity field path audit** should have triggered as soon as `voiceConfig` became user-editable: write path and read path both need complete chain tracing.
- **Alpha ownership check** should have triggered before asking CVO to run smoke manually. Runtime operations can stay read-only/diagnostic while cats handle repeatable alpha checks.

## Doc Links

- Feature spec: `docs/features/F190-console-settings-appshell-skeleton.md`
- Frontend lessons: `cat-cafe-skills/refs/f190-frontend-lessons.md`
- Phase C issue ledger: `cat-cafe#1618`
- Alpha hotfix PR: `cat-cafe#1658`
- Settings icon hotfix PR: `cat-cafe#1659` (post-close, fixed `box`/`puzzle` SVG miss)
- Follow-up F190 Phase D parity audit (to be opened): backfill 5 remaining missing components vs open-source.

## Rule Update Target

- `cat-cafe-skills/refs/shared-rules.md`: add review pattern "entity field extension must trace schema -> handler -> writer -> loader -> response mapper".
- `cat-cafe-skills/merge-gate/SKILL.md`: clarify that AC alpha smoke can be executed by cats in `pnpm alpha:start`; CVO alpha is for subjective product signoff, not routine smoke.
- `cat-cafe-skills/opensource-ops/SKILL.md`: **add mandatory parity gate** — inbound intake must produce open-source vs local component diff + visual side-by-side at request-review stage; deliberate defer requires CVO signoff mapped to user-visible UI consequence (not just technical "deferred" label).
- `cat-cafe-skills/feat-lifecycle/SKILL.md`: close gate must list "what user sees vs what user doesn't see vs what was deliberately deferred" before CVO signoff; cannot close on AC ✅ alone.
- `cat-cafe-skills/refs/shared-rules.md` 愿景守护 section: "red-zone untouched" ≠ "vision achieved" — guardian must verify functional parity with source intent, not just safety invariants.
