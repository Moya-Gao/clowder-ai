---
cell_id: approval-index
title: Approval Index
summary: CVO approval aggregation layer — per-feature adapters query canonical stores, Hub UI renders unified pending list with badge + inline/jump approve.
canonical_features: [F246]
code_anchors:
  - packages/api/src/domains/approval-hub/
  - packages/api/src/routes/approval-hub-routes.ts
  - packages/shared/src/types/approval-hub.ts
  - packages/web/src/components/ApprovalHubDrawer.tsx
  - packages/web/src/components/ApprovalItemCard.tsx
  - packages/web/src/stores/approvalHubStore.ts
  - packages/web/src/hooks/useApprovalHub.ts
doc_anchors:
  - docs/features/F246-approval-hub.md
  - docs/plans/2026-06-20-f246-phase-a-approval-hub.md
static_scan_hints: [approval hub, pending approval, approval adapter, approval item, inline approve, ApprovalHubDrawer, ApprovalItemCard]
cited_by:
  - {feature: F246, date: 2026-06-20, delta: new cell}
---

# Approval Index

## Canonical Owner

F246 — Approval Hub (unified CVO approval center).

## Architecture

v1 uses query aggregation: each registered `IApprovalAdapter` reads from its
canonical store (F128 `IProposalStore`, F225 `ISessionHandoffProposalStore`) and
maps results to the unified `ApprovalItem` DTO at read time. No materialized
index, no CQRS — fresh read-through on every Hub load (KD-3).

### Data Flow

```
ActivityBar (bell icon + badge count)
  → useApprovalHubSync (fetch on mount + proposal_updated events)
  → Zustand store (useApprovalHubStore)
  → GET /api/approval-hub/pending
  → Promise.all(adapters.map(a => a.listPending(userId)))
  → F128ApprovalAdapter → proposalStore.listPending(userId)
  → F225ApprovalAdapter → handoffStore.listPendingByUser(userId)
  → merge + sort by createdAt desc → { items, count }
```

### Frontend

- `ApprovalHubDrawer` (right-side panel, root-level mount in AppShell)
- `ApprovalItemCard` (per-item: F128 inline approve/reject, F225 jump-to-thread)
- Stale detection: client-side `expiresAt < Date.now()` (pure projection, no store mutation)

## Evolution Path

- Phase B: add F193 E3 adapter
- v2+: materialized CQRS index when stores > 5
- Phase C: batch approve/reject
