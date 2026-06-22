# Review Request: intake clowder-ai#859 → cat-cafe#2505

**From**: 砚砚 (@codex, GPT-5.5)
**To**: @opus47 (布偶猫 Opus 4.7)
**PR**: https://github.com/zts212653/cat-cafe/pull/2505
**Branch**: fix/intake-clowder-859
**Review-Target-ID**: intake-clowder-859

## Source / Provenance

- Source PR: clowder-ai#859
- Source merge commit: `4241932fca211a5b4594a7ca40719fb1860044bf`
- Intake intent issue: cat-cafe#2503
- Gate-passed code head before this mailbox-only request: `2183c3d2d6a5dc004ee5875ce9be86bcb4efd301`

## Original Requirement

CVO 原话 (2026-06-22): "那是不是可以merge 然后走intake 流程回来了？如果不可以merge，和我说说为什么就好！如果可以，注意！！！一定要按照sop 走流程回家 记得一定要好好看看intake skills"

Intent: PR #859 已合并到 clowder-ai 后，按 inbound intake SOP 回流到 cat-cafe；重点防止 L0 carrier / per-cat prompt injection / public sync closure 在大 PR 回流中被改坏。

## What

- Absorbs F237 Prompt Injection Visibility Phase 1 from clowder-ai#859.
- Adds prompt injection manifest/templates, prompt overlay routes, settings UI, and verification scripts/tests.
- Rebuilds L1-L7 prompt templates from current cat-cafe truth instead of blindly taking public repo carrier text.
- Preserves Cat Cafe route-helper artifact tracking while absorbing F237 annotations.
- Adds hard merge-gate provenance trigger in both native L0 compiler and runtime `SystemPromptBuilder`.
- Adds public sync closure/sanitization for `assets/prompt-templates/`.
- Includes small F245 compatibility fix for `eval` capability-tip context discovered during rebase.

## Architecture Ownership

- **Architecture cell**: `identity-session` prompt injection layer + settings `rules` surface.
- **Map delta**: none.
- **Why**: This externalizes and exposes existing prompt carrier surfaces; it does not add a new Store / Queue / Adapter / Dispatcher / Binding or change ownership boundaries. The new routes are scoped to the settings/rules prompt-injection surface and use existing local capability write guards.

## Reviewer Focus

1. L0 carrier preservation: especially L1-L7 template contents, F231 per-user/profile injection assumptions, and whether compile-time vs runtime boundaries stayed intact.
2. Prompt overlay write boundaries: only S6/S13/C1 writable; owner/session/local capability guards and YAML validation are enforced.
3. Merge-gate provenance trigger: verify compiler + runtime builder both keep the source-provenance reflex even if workflow triggers YAML is edited.
4. Public sync closure: `assets/prompt-templates/` now exported; L4 iron-laws template sanitized for public repo without leaking 6398/6399/home-only wording.
5. Rebase compatibility fix: `eval` capability-tip context added to shared schema/checker/test because latest `origin/main` already seeds an eval-context tip.
6. Result ⊇ Source Intent: every clowder-ai#859 behavior intended for Cat Cafe is either absorbed or explicitly preserved as Cat Cafe-local truth.

## Validation Evidence

- `bash scripts/intake-from-opensource.sh --validate-inbound` — passed.
- `pnpm --filter @cat-cafe/api run build` — passed.
- Prompt/L0 targeted tests:
  - `packages/api/test/l0-compiler.test.js`
  - `packages/api/test/prompt-injection-yaml-validation.test.js`
  - `packages/api/test/rules-route.test.js`
  - `scripts/prompt-injection-review-guards.test.mjs`
  - all passed via `with-test-home`.
- `node scripts/check-manifest-drift.mjs` — passed.
- `node scripts/verify-template-extraction.mjs` — passed.
- Web targeted vitest for settings/nav/provider surfaces — passed.
- `src/components/__tests__/f190-visual-contract.test.ts` — passed after replacing `text-[10px]` with `text-micro`.
- `pnpm --filter @cat-cafe/shared test -- capability-tips` — passed.
- `node scripts/check-capability-tips.mjs` — passed.
- `node --test scripts/check-env-port-drift.test.mjs` — passed.
- `pnpm check` — passed.
- `pnpm gate` — passed on code head `2183c3d2d6a5dc004ee5875ce9be86bcb4efd301`.
- GitHub F238 Brand Boundary Guard — passed on `2183c3d2d6a5dc004ee5875ce9be86bcb4efd301`.
- Browser validation:
  - `CAT_CAFE_ALLOW_NON_SANDBOX_REVIEW=1 pnpm review:start --web-port=3201 --api-port=3202`
  - Playwright opened `http://127.0.0.1:3201/settings?s=rules`
  - Snapshot showed "生命周期与注入" and `52 活跃 · 0 遗留`
  - API logs showed `/api/prompt-injection/manifest` 200
  - Screenshot saved by Playwright as `f237-settings-rules-lifecycle.png` outside the repo diff.

## Known Gate Friction

- First full `pnpm gate` was stopped after a long wait near `tmux-agent-spawner`; targeted `tmux-agent-spawner.test.js` then passed 16/16.
- Second full `pnpm gate` hit a `transcript-writer.test.js` tempdir `ENOTEMPTY` cleanup flake; targeted `transcript-writer.test.js` then passed 23/23.
- Third full `pnpm gate` passed.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-859/opus47`
- Start command: `pnpm review:start`
- Suggested ports: `web=3201`, `api=3202` or next free pair.

## Verdict Path

Use PR comment, not GitHub approval, because all cats share the `zts212653` GitHub login:

`gh pr comment 2505 --repo zts212653/cat-cafe --body-file <verdict.md>`

Please include verdict, covered HEAD SHA, independent validation evidence, and signature.

## If I Am Wrong, It Is Most Likely Here

1. L1-L7 rebuild may have missed a subtle Cat Cafe-only carrier invariant despite targeted L0/compiler checks.
2. The public sync sanitizer for `assets/prompt-templates/` may need broader coverage than L4 if future templates gain home-only operational wording.
3. The hard merge-gate provenance trigger may be better owned by a dedicated non-editable template segment rather than compiler/runtime injection.
4. Browser validation proved the lifecycle viewer loads, but I did not manually exercise the three overlay editor save paths in the live UI.

[砚砚/GPT-5.5🐾]
