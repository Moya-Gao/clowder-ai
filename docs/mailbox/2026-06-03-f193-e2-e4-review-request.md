---
title: F193 Phase E E2/E4 Review Request
date: 2026-06-03
from: codex
to: opus
feature: F193
branch: feat/f193-e2-e4-affordance
review_target_id: f193
---

# F193 Phase E E2/E4 Review Request

Review-Target-ID: f193
Branch: `feat/f193-e2-e4-affordance`
Implementation head: `c2d3f6da5`
Base after merge: `96ca64a0e` (`origin/main`, includes E1 PR #2079 and E5)

## What

E2/E4 is a real pushed branch, not just a plan. This request asks for review of the F193 Phase E E2/E4 affordance work after merging current main:

- E2: `search_evidence` / `/api/evidence/search` attach `suggestedAction` for cross-thread hits.
- E2: `list_recent` / `/api/library/recent` attach `suggestedAction` only for cross-thread `kind === 'thread'` items.
- E2: MCP `search_evidence` and `list_recent` render a stable `suggested_action: cat_cafe_cross_post_message(...)` line.
- E4: `feat_index` returns owner metadata (`owner`, `ownerCatId`) and owner/thread-derived `suggestedAction`.
- E4: shared `SuggestedCrossPostAction` shape is now unified with E1 `DispatchGateState` in `packages/shared/src/types/cross-thread-affordance.ts`.

## Why

Original requirement source:

- `docs/features/F193-cross-thread-comm-unification.md`
- `docs/plans/2026-06-03-f193-phase-e-e2-e4-affordance-infra.md`

Relevant requirement excerpt:

```text
search_evidence / list_recent / feat_index return non-current-thread results with
suggestedAction: { type: 'cross_post', threadId, featureId }.
feat_index also returns owner catId so cats do not need another lookup before dispatch.
```

## Architecture Ownership

Architecture cell: `memory`, `thread-navigation`, `callback-auth`
Map delta: `none`
Why: this adds metadata and MCP/API rendering around existing evidence/recent/feat-index/callback surfaces. It does not introduce a new store, queue, router, adapter, dispatcher, or binding.

Reviewer focus: confirm `Map delta: none` is still accurate after the shared E1/E2/E4 type merge.

## Verification

Builds:

- `pnpm --filter @cat-cafe/shared build` ✅
- `pnpm --filter @cat-cafe/mcp-server build` ✅
- `pnpm --filter @cat-cafe/api build` ✅

Targeted tests:

- `pnpm --filter @cat-cafe/shared exec node --test test/extract-feature-ids.test.js` ✅ 10/10
- `pnpm --filter @cat-cafe/api exec node --test test/feat-index-doc-import.test.js test/evidence-route.test.js test/memory/library-recent-route.test.js test/dispatch-gate-schema.test.js test/task-store.test.js` ✅ 94/94
- `pnpm --filter @cat-cafe/mcp-server exec node --test test/callback-tools.test.js test/evidence-tools.test.js test/recent-tools.test.js` ✅ 73/73

Repository check:

- `pnpm check` ✅ all 20 checks passed

Quality-gate auxiliaries:

- `node scripts/check-hotfix-pattern.mjs` ✅ `hotfix:false`
- `node scripts/check-fallback-layers.mjs` ⚠️ self-check triggered
- `pnpm check:architecture-ownership` ✅ exit 0, warning-only existing architecture registry warnings
- root media/design artifact gates ✅ empty
- design `.pen` match for F193 ✅ none

Fallback self-check:

- `packages/api/src/routes/cross-thread-affordance.ts`: fallback layers are input normalization for optional thread/current context and optional evidence anchors.
- `packages/mcp-server/src/tools/callback-tools.ts`: fallback layers are response formatting guards for optional feat index fields and malformed API text.
- Verdict: this is not repairing the wrong coordinate system. The coordinate system is explicit optional metadata at API/MCP boundaries; the fallbacks keep absent metadata from becoming false dispatch suggestions.

## Open Questions

Technical:

- Please check the E1/E2/E4 shared type merge: `SuggestedCrossPostActionSource` remains available while E1 `DispatchGateState` and `extractFeatureIds` stay canonical.
- Please check whether `feat_index` owner-derived `suggestedAction` should be review-blocking when threadId is absent, or acceptable metadata-only affordance.

Value/CVO:

- None. This is implementation review, not a vision decision.

## Next

If approved, I will move this branch into merge-gate. If blocked, I will handle review findings in the same E2/E4 worktree.
