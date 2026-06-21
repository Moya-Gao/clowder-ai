---
cell_id: approval-index
title: Approval Index
summary: CVO approval aggregation layer — per-feature adapters query canonical stores, workspace tab renders unified pending list with badge + inline/jump approve.
canonical_features: [F246]
code_anchors:
  # API — adapters + routes
  - packages/api/src/domains/approval-hub/adapters/F128ApprovalAdapter.ts
  - packages/api/src/domains/approval-hub/adapters/F193ApprovalAdapter.ts
  - packages/api/src/domains/approval-hub/adapters/F225ApprovalAdapter.ts
  - packages/api/src/domains/approval-hub/ports/IApprovalAdapter.ts
  - packages/api/src/domains/approval-hub/stores/ports/IDispatchProposalStore.ts
  - packages/api/src/domains/approval-hub/stores/redis/RedisDispatchProposalStore.ts
  - packages/api/src/domains/approval-hub/stores/factories/DispatchProposalStoreFactory.ts
  - packages/api/src/routes/approval-hub-routes.ts
  # Shared types
  - packages/shared/src/types/approval-hub.ts
  # Web — workspace integration (Phase C)
  - packages/web/src/components/ApprovalPanel.tsx
  - packages/web/src/components/workspace/WorkspaceTabBar.tsx
  - packages/web/src/components/ApprovalItemCard.tsx
  - packages/web/src/stores/approvalHubStore.ts
  - packages/web/src/hooks/useApprovalHub.ts
  # Deprecated (Phase C — retained but no longer rendered)
  - packages/web/src/components/ApprovalHubDrawer.tsx  # deprecated: replaced by ApprovalPanel
doc_anchors:
  - docs/features/F246-approval-hub.md
  - docs/plans/2026-06-20-f246-phase-a-approval-hub.md
  - docs/plans/2026-06-20-f246-phase-b-f193-dispatch-adapter.md
  - docs/plans/2026-06-21-f246-phase-c-workspace-integration.md
static_scan_hints: [approval hub, pending approval, approval adapter, approval item, inline approve, ApprovalPanel, ApprovalItemCard, WorkspaceTabBar, workspace approval, dispatch proposal, DispatchProposalStore, F193ApprovalAdapter]
cited_by:
  - {feature: F246, date: 2026-06-20, delta: new cell}
  - {feature: F246, date: 2026-06-20, delta: "Phase B — F193 E3 adapter + DispatchProposalStore"}
  - {feature: F246, date: 2026-06-21, delta: "Phase C — drawer→workspace tab + WorkspaceTabBar"}
---

# Approval Index

## Canonical Owner

F246 — Approval Hub (unified CVO approval center).

## Architecture

v1 uses query aggregation: each registered `IApprovalAdapter` reads from its
canonical store (F128 `IProposalStore`, F225 `ISessionHandoffProposalStore`,
F193 `IDispatchProposalStore`) and maps results to the unified `ApprovalItem`
DTO at read time. No materialized index, no CQRS — fresh read-through on every
Hub load (KD-3).

### Data Flow

```
ActivityBar (bell icon + badge count)
  → click → setWorkspaceMode('approval') + fetchPending()
  → WorkspacePanel renders ApprovalPanel
  → useApprovalHubSync (fetch on mount + proposal_updated events)
  → Zustand store (useApprovalHubStore)
  → GET /api/approval-hub/pending
  → Promise.all(adapters.map(a => a.listPending(userId)))
  → F128ApprovalAdapter  → proposalStore.listPending(userId)
  → F193ApprovalAdapter  → dispatchProposalStore.listPendingByUser(userId)
  → F225ApprovalAdapter  → handoffStore.listPendingByUser(userId)
  → merge + sort by createdAt desc → { items, count }
```

### Frontend

- `ApprovalPanel` — workspace-inline panel (Phase C, replaces deprecated `ApprovalHubDrawer`)
- `WorkspaceTabBar` — responsive tab bar with three modes (full/overflow/icon-only) driven by ResizeObserver
- `ApprovalItemCard` (per-item: F128 inline approve/reject with full overrides, F193 dispatch approve, F225 jump-to-thread)
- Stale detection: client-side `expiresAt < Date.now()` (pure projection, no store mutation)
- Bell icon in ActivityBar: badge count always visible, click opens workspace→approval tab (toggle: re-click closes workspace)

### F193 Dispatch (Phase B)

- `DispatchProposalStore` (Redis-backed, CAS approve/reject, TTL=0 persistent)
- Effect-class boundary: only `assign_work` produces ApprovalItem; `fyi`/`coordinate`/`investigate` auto-deliver without Hub involvement
- Target validation + delivery rollback on approve failure

## Evolution Path

- ~~Phase B: add F193 E3 adapter~~ ✅ merged PR #2454
- ~~Phase C: workspace integration~~ ✅ merged PR #2463
- C3 maturation: batch approve/reject, filtering (by feature/thread/时效), AC-C8 intercept pruning
- v2 接入: F231 propose_profile_update, F168 direction-decision subcell, Knowledge Feed, Limb pair_approve
- v2+ architecture: materialized CQRS index when adapter count > 5 (query fan-out bottleneck threshold)
