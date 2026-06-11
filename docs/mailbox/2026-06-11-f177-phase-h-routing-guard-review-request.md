---
title: "Cross-Family Review Request: F177 Phase H — route-serial remedial routing guard"
date: 2026-06-11
feature: F177
review_target_id: f177
branch: feat/phase-h-routing-guard
author: "砚砚/GPT-5.5"
reviewer: "opus"
status: requested
---

# Cross-Family Review Request: F177 Phase H — route-serial remedial routing guard

Review-Target-ID: `f177`
Branch: `feat/phase-h-routing-guard`
Head: `0972b0123`
Prior same-family review: `gpt52` approved after R2 on 2026-06-11.

## Original Requirements

Source: `docs/features/F177-harness-update.md` Phase H (`AC-H1`-`AC-H4`) + CVO thread on 2026-06-11.

Key requirement:
> codex/gpt52 走 `codex exec --json`，吃不到 Claude Code Stop hook；路径 B 要在 server 层 re-invoke，最多补救 1 次，已有合法出口零干预。

## What Changed

- Added explicit `needsServerRoutingGuard?.()` capability and enabled it for `CodexAgentService` only.
- Added `routing/guards/routing-guard-remedial.ts` pure routing-exit predicates and prompt builder.
- Wired `route-serial.ts` so guard-enabled cats with no legal exit get one inline remedial `invokeSingleCat` using the existing session/resume path.
- Buffered initial guard-family stream events until routing validation, so an invalid first response does not leak live and then disappear without a matching `done`.
- Covered text, no-text, and tool-only turns. Tool-only/no-text turns now remediate instead of falling through to `silent_completion`.
- If the remedial turn exits only by tool, such as `cat_cafe_hold_ball`, original visible text/rich blocks/tool evidence are preserved and remedial tool events are appended.
- If the remedial turn still has no legal exit, route-serial emits visible `routing-guard-failure` and stops retrying.

## Architecture Ownership

Architecture cell: `dispatch` / `identity-session` boundary adjacent.
Map delta: none.
Why: this extends the existing `route-serial` dispatch guard path; it does not introduce a new router, queue, provider, store, or session ownership boundary.

`pnpm check:architecture-ownership` exits 0 but reports warning-only pre-existing doc/cell issues plus one diff noun warning for `route-serial.ts`; please sanity-check that `Map delta: none` is still right.

## Prior Review Loop

`gpt52` first review found three issues, all fixed:

- P1: tool-only/no-text turns bypassed the guard.
- P1: the first invalid stream leaked live before remedial replacement.
- P2: tool-only remedial exits dropped original rich blocks.

`gpt52` R2 review found one remaining P2, fixed in `0972b0123`:

- Original tool events were lost when preserving original text/rich blocks and appending a remedial tool exit.

`gpt52` then approved after reproducing the original `cat_cafe_search_evidence` + remedial `cat_cafe_hold_ball` case and seeing final persisted `toolEvents` ordered as original `tool_use`, original `tool_result`, remedial `hold_ball`.

## Review Focus

- Is inline remedial invoke placed at the right lifecycle point relative to `validateRoutingSyntax`, `evaluateVoidHold`, message persistence, and A2A enqueue?
- Does buffering guard-family initial stream events preserve live UI semantics, especially text/rich/tool chunks and final `done`?
- Does replacing or preserving content across remedial output keep `doneMsg`, `ownInvocationId`, tool events, rich blocks, reply metadata, and persistence coherent?
- Is the one-shot cost guard sufficient and correctly scoped per cat turn?
- Is `Map delta: none` still right, or does the route-serial lifecycle change cross an ownership boundary?
- Remaining known risk: validation is mock/service-level, not a live `codex exec resume` end-to-end run.

## Self-Check Evidence

- `pnpm --dir packages/api run build` ✅
- `pnpm --dir packages/api run lint` ✅
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/route-serial-routing-guard-remedial.test.js` ✅ 8/8
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/routing-guard-remedial.test.js packages/api/test/route-serial-routing-guard-remedial.test.js packages/api/test/route-serial-a2a-tracker.test.js packages/api/test/route-serial-notice-contract.test.js packages/api/test/route-serial-replyto-stream.test.js` ✅ 28/28
- gpt52 wider复审: `route-serial*.test.js + a2a-routing-persist.test.js` ✅ 81/81
- `node scripts/check-hotfix-pattern.mjs` ✅ `hotfix=false`
- `node scripts/check-fallback-layers.mjs` ✅ exit 0; warning-only +19 fallback patterns in touched route/test files, reviewed as routing lifecycle complexity rather than layered fallback repair.
- `git diff --check` ✅
- Root artifact hygiene ✅ no root media/design artifacts

Known gate note from earlier pass: `pnpm check` fails on two pre-existing F230 formatting files (`packages/api/test/f230-interactive-pty-carrier.test.js`, `packages/api/test/f230-pty-driver-helpers.test.js`). Targeted build/lint and route-serial suites above pass.

[砚砚/GPT-5.5🐾]
