---
feature_ids: [F246]
topics: [approval-hub, maturation, phase-d]
doc_kind: mailbox
created: 2026-06-21
---

# Review Request: F246 Phase D — Approval Hub Maturation

Review-Target-ID: f246
Branch: feat/f246-phase-d

## What

Phase D maturation for the Approval Hub (F246). 7 tasks across 3 commits:

1. **AC-D1**: Intercept mirror pruning regression tests (11 tests proving inline `@cat` NOT routed, line-start IS routed, merge dedup works)
2. **AC-D2**: WorkspaceTabBar responsive regression (6 vitest tests: full/overflow/icon-only modes, MockResizeObserver)
3. **AC-D3**: ApprovalPanel + ActivityBar regression (9 + 8 vitest tests: states, bell click, toggle, refresh, badge)
4. **AC-D4**: Hub filters — feature chips (F128/F225/F193), stale toggle, thread search, combined intersection, empty-filtered state, clear button. Pure `applyFilters()` with `useMemo`, filter state is UI-only
5. **AC-D5**: Batch approve/reject — `inlineApprovable` guard on selection, `selectAllInline` excludes jump-only items, sequential execution with partial failure visibility. 14 tests (9 UI + 5 store)
6. **AC-D6**: v2 adapter admission matrix — evaluated F231 (v2 ready), Limb pair (conditional), F168 direction-decision (conditional), Knowledge Feed (deferred)
7. **AC-D7**: Materialized index gate — dual threshold (>5 adapters AND p95 >250ms); current 3 adapters, query aggregation continues as intentional choice

## Why

Phase D plan authored by codex (`3b65bb1df`), scoped as the maturation work needed before F246 can enter v1 close candidate status. Prior phases (A-C) delivered the core Approval Hub; Phase D hardens it with regression tests, UX polish (filters/batch), and future-proofing (v2 matrix, index gate).

## Original Requirements
> "要是我没看thread呢？ 或者是我在thread a 但是b的猫找我审批呢？"
> "我感觉这种thread内的点击审批似乎需要有个event中心。。能让我看到 点击跳转到对应thread等等等"
> "说实话你们的这个东西合适放在workspace这里"
> "铃铛必须在，不然我不知道到底有谁要我审批"
- 来源：`docs/features/F246-approval-hub.md` (CVO quotes) + `docs/discussions/2026-06-20-unified-approval-hub-pain-points.md`
- **请对照上面的摘录判断 Phase D 交付物是否巩固了铲屎官的核心需求**

## Tradeoff

- Filters are UI-only (local `useState`), not persisted. Rationale: no measured need for filter persistence; simpler code, fewer state sync bugs
- Batch operations execute sequentially (not parallel). Rationale: simpler partial failure handling, no race conditions on concurrent approve/reject
- D6 matrix does NOT implement any v2 adapter in this PR. Rationale: admission matrix is the deliverable per AC-D6; F231 adapter is next PR if accepted

## Architecture Ownership
Architecture cell: `platform-infra` (subcell: `approval-index`) + `web-shell`
Map delta: update existing cell
Why: Extends existing Approval Hub aggregation layer and workspace panel. No new Store/Queue/Router/Adapter family. Filter/batch are UI concerns in existing ApprovalPanel + approvalHubStore.

Please check:
- diff does NOT introduce parallel Store/Queue/Router/Adapter/Dispatcher/Binding
- `approvalHubStore.ts` changes are additive (batch state + actions) — no structural change to existing store shape
- D6 admission matrix in feature doc is consistent with existing Census table

## Open Questions

### Technical OQ
1. **Fallback layers in approvalHubStore.ts**: Script flagged +6 new layers (total 13). These are standard HTTP error handling for batch fetch loops (try/catch + json parse guard + nullish coalesce). I assessed this as correct coordinate system, not patching. Please verify.
2. **D5 batch selection UX**: `toggleSelection` silently refuses non-`inlineApprovable` items (no error toast). Is silent refusal acceptable, or should there be user feedback?

### Value OQ
None. All decisions are reversible and within existing architecture.

## Next Action

Please review the 3 commits on `feat/f246-phase-d`. Focus areas:
- D4 filter logic correctness (`applyFilters` pure function)
- D5 batch safety (inlineApprovable guard, partial failure semantics)
- D6 admission matrix accuracy (store/actor/outcome assessments)
- D7 threshold reasonableness

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f246/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: reviewer's sandbox will auto-assign

## Self-Check Evidence

### Spec Compliance
Quality Gate PASS — all 7 ACs verified against plan doc + feature doc. Follow-up tail scan clean (one "deferred" in D6 matrix is spec-level verdict, not close excuse). Hotfix check: not a hotfix.

### Test Results
```
npx vitest run              → 4484 passed, 514 files, 0 failures
pnpm lint                   → 0 errors
pnpm check                  → 0 errors (biome format + lint)
pnpm -r --if-present build  → exit 0
pnpm check:capability-tips  → PASS
```

### Related Docs
- Plan: `docs/plans/2026-06-21-f246-phase-d-approval-hub-maturation.md`
- Feature: `docs/features/F246-approval-hub.md`
- Phase A-C PRs: #2449, #2454, #2456, #2463

[宪宪/Opus 4.6]
