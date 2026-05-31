---
doc_kind: review-request
created: 2026-05-31
feature_ids: [F210]
topics: [antigravity, agy, phase-g, profile-sandbox, review-request]
author: codex
reviewers: [opus]
---

# Review Request: F210 Phase G — AGY Profile Sandbox + Preflight

Review-Target-ID: f210
Branch: feat/f210-agy-profile-sandbox

## What

This is the cohesive Phase G runtime slice that follows the AGY 1.0.3 capability refresh:

- Adds `AgyProfileManager` for per-cat isolated AGY HOME roots under `CAT_CAFE_AGY_PROFILE_ROOT` / configured `homeRoot`.
- Writes per-profile `~/.gemini/antigravity-cli/settings.json` with intended model and trusted worktree paths.
- Adds fail-closed preflight for missing `agy`, unsafe real-HOME binding, missing/unreadable settings, model mismatch, and untrusted assigned worktree.
- Wires runtime catalog `agyProfile` config through `CatConfig` / `CatVariant` into `GeminiAgentService`.
- Gates `--dangerously-skip-permissions` behind profile sandbox proof; the unprofiled global-HOME AGY path no longer gets unattended yolo.
- Reads AGY log-selected model labels and refuses to surface text when observed model differs from the configured profile model.

## Why

The CVO asked us to plan what can be done under current AGY limits, and you recommended one PR instead of five small PRs. F210 says AGY still has no supported `--model` or ACP surface, so the right runtime architecture is verification-first profile isolation: configure an isolated HOME, verify the selected model and trusted worktree boundary, then run with yolo only inside that sandbox.

## Original Requirements

> 那我们规划一下？ 看看哪些现在agy局限下可以做的？
> 那你把这些记录到f210的md里面？ 然后请你找 opus 帮你拆任务让46帮你拆pr

- Source: current F210 thread, CVO messages at 2026-05-31 14:14/14:20 UTC.
- Planning source: `docs/features/F210-antigravity-cli-migration.md`, Phase G implementation direction and timeline entry from 2026-05-31.

## Tradeoff

- No fake per-call model selector is added. AGY still has no documented `--model`; this PR verifies profile-selected model labels from AGY logs instead.
- No user-facing Opus/Gemini AGY cats are exposed yet. Catalog can now carry `agyProfile`, but profile cats still need live smoke and CVO-visible onboarding before exposure.
- Static auth/keyring detection is not invented. AGY auth storage is undocumented; unauthenticated isolated profiles remain fail-closed through the PR #1996 auth-required parser/service guardrail.
- MCP materialization is not claimed complete. This PR writes settings/trustedWorkspaces and creates the sandbox boundary; live MCP visibility remains review/smoke focus before closing AC-G5.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: this extends the existing headless Google provider carrier with profile-local config/preflight. It adds no new store, queue, router, dispatcher, binding, ownership cell, or cross-provider transport boundary.

Please check:

- diff is consistent with `Map delta: none`
- profile HOME resolution cannot escape its configured root or touch the real user HOME/settings path
- settings writes are minimal and do not invent unsupported AGY config
- preflight is fail-closed and actionable
- yolo is only injected for sandboxed profiles
- global-HOME AGY fallback remains compatible but does not run unattended
- observed AGY selected-model mismatch cannot leak wrong-model text into chat output

## Open Questions

### Technical OQ

1. Should `AgyProfileConfig` later grow an explicit MCP config field, or should MCP materialization stay in the AGY onboarding/smoke layer until AGY's config contract is clearer?
2. Is log-selected model verification strong enough for this runtime slice, given AGY 1.0.3 has no supported model setter?
3. Should profile setup preserve more existing `settings.json` keys, or is the current merge of existing keys plus `model` / `trustedWorkspaces` the right minimum?

### Value OQ

None for this PR. User-facing AGY multi-profile exposure remains blocked on live smoke / onboarding evidence and should come back to the CVO separately.

## Next Action

Please review the profile sandbox boundary and preflight semantics. If this passes, send it back for PR/cloud review and merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/opus`
- Start Command: `pnpm review:start`
- Ports: review sandbox allocates isolated ports; no frontend/browser verification is needed for this provider/config runtime slice.

## Self-Check Evidence

### Spec Compliance

- AC-G2 partial: profile-selected model is represented in config and verified from AGY logs before success.
- AC-G3 partial: missing binary / missing model setting / model mismatch / untrusted worktree all report actionable provider errors before spawn or before text surfacing.
- AC-G4 implementation-ready: `--dangerously-skip-permissions` is profile-gated and removed from the unprofiled global-HOME path.
- AC-G5 partial: HOME/settings/trustedWorkspaces isolation is unit/service tested; MCP visibility and live auth smoke remain open before closing the AC.
- AC-G6 untouched.

### Dogfood-Your-Slice

Scope verdict: ok exempt. This PR adds an internal profile sandbox path and does not enable any user-facing AGY profile cat in the runtime catalog. The core slice is dogfooded through the service boundary tests that construct isolated HOME roots, run the AGY spawn path with mocked logs, and assert env/args/settings/model-verification behavior.

### Test Results

```bash
pnpm --dir packages/api run build
# pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/cat-config-loader.test.js packages/api/test/agy-profile-manager.test.js packages/api/test/gemini-agent-service.test.js
# 146 pass, 0 fail

pnpm check
# All 19 checks passed

pnpm check:architecture-ownership
# exit 0; existing warning-only architecture debt, current diff OK

node scripts/check-hotfix-pattern.mjs
# hotfix=false

node scripts/check-fallback-layers.mjs
# self-check triggered; see Coordinate-System Self-Check below

git diff --check
# pass
```

### Coordinate-System Self-Check

`node scripts/check-fallback-layers.mjs` flags this PR because the new profile boundary necessarily adds validation branches:

- `agy-profile-manager.ts`: profile id/path/root/model/trusted-workspace guards are boundary validation, not compensating fallback. Removing them would let configured profiles escape the sandbox root, bind to real HOME, or run with unset/mismatched model state.
- `GeminiAgentService.ts`: the added `??` / optional metadata/env handling preserves existing unprofiled AGY behavior while adding the profile path. A separate adapter would remove local conditionals but create a bigger transport split, which conflicts with F210's `Map delta: none`.
- `antigravity-cli-event-parser.ts`: the `??` only preserves the last observed selected-model label when the regex capture is unexpectedly absent; it does not mask a provider failure.

Conclusion: this repairs the coordinate system by moving yolo/model selection behind a profile sandbox. The branches are explicit safety gates for the new boundary, not ad hoc behavioral fallbacks.

### Root Artifact Gate

- `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`: no output.
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`: no output.

## Related Files

- `packages/api/src/domains/cats/services/agents/providers/agy-profile-manager.ts`
- `packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity-cli-event-parser.ts`
- `packages/api/src/config/cat-config-loader.ts`
- `packages/shared/src/types/cat.ts`
- `packages/api/test/agy-profile-manager.test.js`
- `packages/api/test/gemini-agent-service.test.js`
- `docs/features/F210-antigravity-cli-migration.md`

[砚砚/gpt-5.5🐾]
