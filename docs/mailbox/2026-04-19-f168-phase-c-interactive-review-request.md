---
doc_kind: review-request
created: 2026-04-19
---

# Review Request: F168 Phase C Interactive Features (C6/C7/B5)

Review-Target-ID: f168-phase-c
Branch: feat/f168-phase-c-interactive

## What

Three interactive features for the CommunityPanel workspace tab:

1. **C6 — Click-to-navigate**: Issue/PR rows navigate to their assigned thread via `pushThreadRouteWithHistory`. Unassigned items show reduced opacity.
2. **C7 — Filtering**: State filter dropdown (全部/未回复/讨论中/...) and cat filter dropdown (全部/per-cat). Filters apply to issue display.
3. **B5 — Dispatch button**: "发送给系统猫" button on unreplied issues. Calls `POST /api/community-issues/:id/dispatch` which transitions unreplied→discussing. Returns 409 if already dispatched.

Also: extracted SVG icons to `community-panel-icons.tsx` to keep CommunityPanel under 350-line limit.

## Why

Phase A-C PR #1270 landed the data layer and basic UI. These interactive features complete the panel's core usability — users can now filter, navigate to threads, and dispatch issues to cats.

## Original Requirements

> "比如说我可以点击跳转到 feat153 里面去看这个社区处理进度，毕竟猫猫跑在 thread 里！我觉得应该这样联动才是对的！"
> "issue 112 发送给系统猫（如果没有被具体线程接单）"

- Source: `docs/features/F168-community-ops-board.md` (铲屎官原话 section)
- **Please verify the implementation matches the intent above**

## Tradeoff

- C7 time range filter not implemented — state and cat filters cover the high-value scenarios. Time range can be added later.
- B5 dispatch does a simple state transition (unreplied→discussing). Actual triage routing to specific threads is Phase A automation (not yet built).

## Open Questions

1. Is `e.stopPropagation()` on the dispatch button sufficient to prevent the row's navigation click from firing?
2. The `uniqueCats` list is derived from current board data — should it also include cats from pr_tracking?
3. C7 filters apply to issues only. Should PR filtering be added in this pass?

## Next Action

Please review for P1/P2 issues. Focus on navigation correctness, filter behavior, and dispatch endpoint safety.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f168-phase-c/gpt52`
- Start Command: `pnpm review:start`
- Ports: web=3201, api=3202

## Self-check Evidence

### Spec Compliance

| AC | Status | Code | Test |
|---|---|---|---|
| C6 | Done | CommunityPanel.tsx:97-137 | community-panel-navigation.test.ts (3 tests) |
| C7 | Done | CommunityPanel.tsx:168-169,208-215 | community-panel-filter.test.ts (4 tests) |
| B5 | Done | community-issues.ts:112-128 + CommunityPanel.tsx:119-131 | community-issues-routes.test.js (3) + community-panel-dispatch.test.ts (2) |

### Test Results

```
pnpm --filter @cat-cafe/api test  → 8655 passed, 0 failed
pnpm --filter @cat-cafe/web test  → 2261 passed, 0 failed
pnpm check                        → 0 errors
pnpm lint                         → 0 errors
pnpm -r --if-present run build    → all 5 packages Done
```

### Artifact Hygiene
Root directory media artifacts: None

### Related Docs
- Feature: `docs/features/F168-community-ops-board.md`
- Plan: `docs/plans/2026-04-18-f168-community-ops-board.md`
