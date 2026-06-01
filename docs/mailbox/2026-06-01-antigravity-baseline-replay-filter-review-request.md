---
doc_kind: review-request
feature_ids: []
topics: [antigravity, streaming, response-aggregation, runtime-bug]
author: codex
reviewer: opus
created: 2026-06-01
---

# Review Request: Antigravity Baseline Planner Replay Filter

Review-Target-ID: fix-antigravity-baseline-replay-filter
Branch: fix/antigravity-baseline-replay-filter

## What

Fixes a user-visible Antigravity/Gemini response contamination bug where a later turn can persist the previous answer together with the current answer.

Changed:

- `AntigravityBridge.pollForSteps()` now passes the current invocation baseline (`stepsBefore`) into the delivered-step diff.
- `diffDeliveredSteps()` still refreshes pre-baseline mutation snapshots, but no longer emits replay text for steps before the current invocation baseline.
- `diffDeliveredSteps()` also no longer counts skipped pre-baseline mutations as current-turn progress, so a baseline-only mutation cannot produce an empty terminal delivery before the real current answer arrives.
- Added a regression test proving a previous planner-response mutation is not emitted as text for a later user turn.
- Added a cloud-review regression test proving a skipped baseline-only mutation does not end the poll before later current-turn steps arrive.

## Why

The live runtime showed the second `@gemini35` answer contained both:

1. the earlier Rich Sutton "The Bitter Lesson" completion, and
2. the later "Reward is Enough" completion.

The persisted second assistant message used the same AGY session as the first turn. Antigravity had mutated a planner step that existed before the second invocation baseline. Cat Cafe treated that old mutation as replay text for the new turn, then appended the current answer.

## Original Requirements

> "现在runtime上的暹罗猫好奇怪啊。 我给他发了两条消息。消息2 的那次竟然1和2都回答？！"

- 来源：当前 thread，铲屎官 2026-06-01 02:35 UTC 截图与报告。
- 请 reviewer 对照判断：这次是否真正阻止 later turn 混入 pre-baseline answer text，并且没有破坏 same-turn planner delta replay。

## Tradeoff

The fix is deliberately narrow. It only filters replay emissions before `stepsBefore`; it does not disable planner mutation replay globally. Same-turn planner growth/rewrite behavior remains covered by existing streaming tests.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: This adjusts Antigravity provider delivery semantics inside the existing agent transport path. It adds no new router, queue, adapter, dispatcher, binding, or ownership cell.

Please reviewer check:

- replay filtering is scoped to pre-baseline steps only
- `hadMutation` is scoped to replayable/current-turn mutation only, while snapshot refresh still prevents repeated stale mutation detection
- current-turn planner delta and replacement replay tests remain meaningful
- the regression models the observed live contamination shape

## Open Questions

### Technical OQ

1. Is `stepsBefore` the correct boundary for suppressing replay emissions in a later invocation?
2. Does skipping only emission, while still refreshing fingerprints/text snapshots, preserve mutation bookkeeping?
3. Does `hadMutation` now correctly mean "current-turn delivery progress" rather than "any observed historical mutation"?

### Value OQ

无。This is a user-visible correctness fix for an observed runtime bug.

## Next Action

Please review the branch HEAD after this request is committed/amended. If approved, I will continue merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-antigravity-baseline-replay-filter/opus`
- Start Command: N/A for API unit-review
- Ports: N/A

## Self-Check Evidence

### Root Cause Evidence

- Live API/DB persisted the second assistant message as first completion block plus second completion block.
- Both affected assistant messages used the same AGY session id.
- Runtime preflight showed live runtime was on a sibling runtime checkout, but the faulty replay code path exists on current main too.
- Red test before the fix emitted `[' finalized', 'current answer']`; after the fix it emits only `['current answer']`.
- Cloud review caught the second-order case: a pre-baseline-only mutation could set `hadMutation=true`, emit an empty terminal batch, and return before a later current-turn step was delivered. The new test fails red with `actual=[]`, then passes after moving the `hadMutation=true` assignment behind the `replayStartIndex` guard.

### Verification

- `pnpm --filter @cat-cafe/api run build` -> PASS
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/antigravity-streaming.test.js` -> PASS, 19/19
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/antigravity-bridge-busy-reuse-poll.test.js` -> PASS, 2/2
- `pnpm check` -> PASS, all 20 checks
- `git diff --check origin/main...HEAD` -> PASS
- `node scripts/check-fallback-layers.mjs` -> PASS, no threshold trigger
- `node scripts/check-hotfix-pattern.mjs` -> PASS, hotfix=false
- root media/design artifact gate -> no matches
- `pnpm check:architecture-ownership` -> exit 0; existing warning-only repo warnings, diff architecture nouns OK

### Dogfood

Scope verdict: required for user-visible bugfix, but live AGY dogfood is intentionally not repeated in this turn because it would launch external Antigravity/Gemini work and may open Google OAuth/browser prompts. Evidence used instead: persisted live bad output + deterministic red/green regression at the Antigravity streaming boundary.
