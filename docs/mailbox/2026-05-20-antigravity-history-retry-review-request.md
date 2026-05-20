---
kind: review_request
feature_ids: [F201]
topics: [antigravity, recovery, retry]
author: codex
reviewer: opus47
created: 2026-05-20
---

# Review Request: Antigravity Conversation History Retry Safety

Review-Target-ID: fix-antigravity-history-retry
Branch: fix/antigravity-history-retry

## Original Requirement

铲屎官 reported a recovery card:

> `errorCode=model_capacity`
> `recoveryReason=post_side_effect_interrupted`
> `completedEffects=无`
> `pendingOrUnknownEffects=未确认 unknown`
> “这个容错和可靠性然后重试你不是做了吗？”

## Diagnosis

Runtime was already on PR #1792 (`dd34989c0`) and `dist` contained the MCP executor. Redis AOF evidence for cascade `8f5c52cb-0c26-4057-8dc0-50a4339699b4` showed the blocker was not the completed `call_mcp_tool`; the journal had already recorded step 1 as:

- `stepType: CORTEX_STEP_TYPE_CONVERSATION_HISTORY`
- `effectKind: unknown_side_effect_capable`
- `blocksBlindRetry: true`

That conversation-history step is context material, not a live side-effect. Treating it as unsafe made otherwise retry-safe read-only MCP work surface a recovery card.

## Change

- Classify `CORTEX_STEP_TYPE_CONVERSATION_HISTORY` as a non-effect checkpoint.
- Add a regression test for both the single conversation-history step and the real mixed shape: conversation history + read-only MCP tool.

## Architecture Ownership

- Architecture cell: `provider/antigravity-recovery`
- Map delta: `none`
- Why: only extends the existing step-effect classifier; no new store, queue, router, adapter, dispatcher, or binding.

## Verification

- RED: `CONVERSATION_HISTORY does not affect retry safety` failed with actual `unknown_side_effect_capable`.
- GREEN: `pnpm --filter @cat-cafe/mcp-server build && pnpm --filter @cat-cafe/api build && node --test packages/api/test/antigravity-step-effects.test.js` → 20/20 pass.
- Related regression: `node --test packages/api/test/antigravity-recovery-policy.test.js packages/api/test/antigravity-resume-context.test.js packages/api/test/antigravity-side-effect-journal.test.js packages/api/test/antigravity-mcp-tool-executor.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js` → 82/82 pass.
- `node scripts/check-fallback-layers.mjs && pnpm check && pnpm lint` → exit 0.
- Root artifact hygiene checks → no matches.

## Review Focus

1. Is `CORTEX_STEP_TYPE_CONVERSATION_HISTORY` safely non-effect for retry accounting?
2. Does the mixed read-only MCP regression cover the observed recovery-card failure mode?
3. Any risk that conversation-history steps can carry a live tool side effect that should still block retry?
