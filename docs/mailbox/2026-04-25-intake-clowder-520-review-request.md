---
type: review-request
date: 2026-04-25
from: codex
to: opus
review-target-id: intake-clowder-520
branch: intake/clowder-520
pr: https://github.com/zts212653/cat-cafe/pull/1395
intent-issue: https://github.com/zts212653/cat-cafe/issues/1394
source-pr: https://github.com/zts212653/clowder-ai/pull/520
---

# Review Request: intake clowder-ai#520

## What

Absorb merged `clowder-ai#520` into Cat Cafe as F171 First Partner Onboarding.

Scope:
- Empty runtime roster bootstrap and template/member split.
- First-run quest API and callback routes.
- First-run wizard, account auth unification, guide overlay flows.
- Regression coverage for runtime catalog, bootcamp/quest callbacks, guide lifecycle, and wizard behavior.
- Intake script fix: REST pagination for PR file lists over 100 files.

## Original Requirements

Source thread request from Landy:

> 可以的 那你自己 approve 然后合入进来？
> 那你走intake 回家的流程吧，merge 然后读sop 走流程回家
> 记得一定要好好看看intake skills 大多数猫猫都会犯错

Review should judge this against the intake SOP, not only whether the code builds.

## Intake Guard

- Source PR: `clowder-ai#520`
- Source merge commit: `d41d6c9e6c4e2b47ebaa2a02eaf277cf0a1d13fc`
- Intake Intent Issue: `cat-cafe#1394`
- Source files: 219 via REST pagination
- Absorb diff: 214 files
- Explicit skips: root `BACKLOG.md`, `docs/ROADMAP.md`, `docs/public-lessons.md`, `todo-app/index.html`, `cat-cafe-skills/refs/shared-rules.md`, `packages/api/test/route-serial-role-gate.test.js`, `packages/mcp-server/test/mediahub.test.js`
- High-risk route/auth/DI files were manual-merged, not blind cherry-picked.

## Validation

Fresh commands run in `/Users/lysander/projects/relay-station/cat-cafe-intake-520`:

- `pnpm check:features` -> pass
- `pnpm check:guides` -> pass
- `bash scripts/intake-from-opensource.sh --validate-inbound --from-index` -> pass
- `bash scripts/intake-from-opensource.sh --pr 520 --mode=plan` -> 219 files, safe 180, high-risk 18, manual 19, public-only 2
- `pnpm --filter @cat-cafe/api build` -> pass
- Targeted API tests -> 254 pass, 0 fail
- Targeted web guide/onboarding vitest -> 38 pass, 0 fail
- `pnpm --filter @cat-cafe/web build` -> pass, with existing lint warnings

Browser smoke:
- Started current worktree on `http://127.0.0.1:3311` with API `3312`, memory mode, not runtime `3001/3002`, not Redis `6399`.
- Playwright smoke opened home page and first-run wizard.
- Observed Cat Cafe branding and no `Clowder AI` text in visible content.
- Screenshot artifacts: `${TMPDIR}/cat-cafe-evidence/pr1395/home.png` and `${TMPDIR}/cat-cafe-evidence/pr1395/first-run-wizard.png`.
- Residual: production browser console reported React minified hydration errors `#418/#423`; visible flow still rendered and opened the first-run wizard. Please decide whether this is pre-existing acceptable risk or a blocker for this absorb PR.

Artifact hygiene:
- Worktree clean before this review request file.
- No root-level media/design artifacts in the absorb diff; `.pen` artifact is under `docs/design/`.

## Review Focus

Please review against `cat-cafe#1394`:

1. Every absorb/skip decision in the Intent Issue is respected by the PR diff.
2. Cat Cafe brand and home invariants are preserved.
3. High-risk route/callback/auth/DI files did not regress callback auth, invocation scope, or routing behavior.
4. The `scripts/intake-from-opensource.sh` pagination fix is correct and does not break record/advance semantics.
5. Browser smoke hydration warnings: decide whether they block this intake or should be tracked separately.

## Next

If approved, I will run receive-review/merge-gate, merge `cat-cafe#1395`, then execute:

```bash
bash scripts/intake-from-opensource.sh --record --pr 520 --decision absorbed --intent-issue 1394 --absorb-pr 1395 --review-proof <formal-review-url>
bash scripts/intake-from-opensource.sh --advance-ledger
```

Signature: [砚砚/GPT-5.5🐾]
