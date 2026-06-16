---
title: "Review Request: F229 AC-B2 Investigation Report Frontend"
feature: F229
type: review-request
date: 2026-06-16
author: opus
---

# Review Request: F229 AC-B2 Investigation Report Frontend

Review-Target-ID: f229
Branch: feat/f229-investigation-report

## What

After triage confirm with `intent=investigate`, CardBlock now:
1. Extracts `investigationJobId` from the confirm response
2. Renders inline `InvestigationProgress` component that polls `GET /api/concierge/investigation/:jobId` every 2s
3. Shows spinner + status text (排队中/正在调查) while queued/running
4. Renders report summary + clickable anchor list when done (`InvestigationReportCard`)
5. Thread anchors navigate via `pushThreadRouteWithHistory` (Bug1 pathname fix pattern)
6. GitHub anchors open external links, doc/feature anchors show inline paths
7. Cancel button calls `POST .../cancel`
8. Shows error/cancelled terminal states

Files changed (3):
- `packages/web/src/components/rich/CardBlock.tsx` — added `investigationJobId` state + investigate branch in `handleTriageConfirm` + render `InvestigationProgress`
- `packages/web/src/components/concierge/InvestigationProgress.tsx` — **NEW**: poll + render + navigate component (queued→running→done|failed|cancelled state machine, stable ref pattern for polling effect, `AnchorItem` per-kind rendering)
- `packages/web/src/components/rich/__tests__/CardBlock-investigation.test.tsx` — **NEW**: 5 TDD tests covering confirm→progress, done→report, failed, anchor navigation, cancel

## Why

The backend investigation worker (PR #2307) was merged but had zero frontend rendering — users clicking the "帮你查一下" confirm card saw nothing after the dispatched response. This closes the last functional gap for AC-B2 Phase B.

## Original Requirements（必填）

> "这个猫猫球可能帮忙发送到哪个 thread 或者**自己调查**"
> AC-B2: "自己调查"产出带 anchor 的报告回对话框（抽查 anchor 真实性）→ R4

- 来源：`docs/features/F229-cat-ball-concierge.md` L23, L147
- **请对照上面的摘录判断：用户点确认后，是否能看到调查结果 + anchor 列表 + 跳转能力**

## Tradeoff

- Polling (2s interval) vs WebSocket/SSE streaming: polling is simpler and sufficient for 60s-deadline investigation jobs. Phase C can upgrade to streaming if needed.
- Report rendered inline below the card vs separate panel: inline keeps context visible, avoids panel state management.
- No persistence of investigation report view state across refresh: the `InvestigationJob` itself is persisted (TTL=0, INV I2), so re-opening the concierge panel will see the card in "已确认" state — but the polled report display is ephemeral. This is acceptable because the report is always re-fetchable from the backend.

## Architecture Ownership（必填）

Architecture cell: concierge-frontend
Map delta: none
Why: Extends existing CardBlock action handling pattern + adds one new component to `concierge/` directory. No new Store/Queue/Router/Adapter/Dispatcher/Binding.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Polling effect stability**: I used `useRef` for `jobIdRef` + single `useEffect` with `[jobId]` dependency to avoid stale closures in the interval. The `handleCancel` reads from `jobIdRef.current` and manually clears `timerRef`. Please verify no leak/race condition.
2. **AnchorItem useCallback dependency**: `[anchor]` as dep — object reference changes per render but values are stable once the report arrives (terminal state stops polling). Should be fine since done→report is a terminal render, but worth reviewing.

### 价值 OQ（给 CVO，如有）

无

## Next Action

请 review 代码质量 + 架构对齐 + 测试覆盖。特别关注 InvestigationProgress 的 polling lifecycle 和 AnchorItem 的 navigation pattern。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f229/gpt52`
- Start Command: `pnpm review:start`
- Ports: TBD (auto-assigned by review:start, typically 3201/3202)
- Note: This is a frontend-only change — code review sufficient, no need to start dev server for visual testing (unit tests cover the interaction lifecycle; visual integration will be alpha-tested post-merge)

## 自检证据

### Spec 合规

AC-B2: "自己调查"产出带 anchor 的报告回对话框 → ✅ InvestigationProgress polls job, renders report with anchors, thread anchors navigate via pathname.

### 测试结果

```
pnpm --filter @cat-cafe/web test → 4143 passed, 0 failed ✅
  ✓ CardBlock-investigation.test.tsx (5 tests) 44ms
pnpm biome check → 0 errors, 8 warnings (pre-existing complexity) ✅
pnpm --filter @cat-cafe/shared build → exit 0 ✅
```

### Artifact Hygiene

Root artifact check (committed + untracked): clean ✅
Hotfix pattern: not a hotfix ✅

### Dogfood-Your-Slice

Scope verdict: 🆗 可豁免 — frontend polling component is unit-tested with full lifecycle mocks (confirm→poll→render→navigate); real integration requires running backend investigation worker which is already merged. Alpha validation with @sonnet post-merge will cover end-to-end dogfood.

### 相关文档

- Feature: `docs/features/F229-cat-ball-concierge.md`
- Backend PR: #2307 (already merged)
- Triage PR: #2310 (already merged)
