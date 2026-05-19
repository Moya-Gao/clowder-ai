# F188 Phase D: Chat-to-Collection Materialization

**Feature:** F188 — `docs/features/F188-library-stewardship.md`
**Goal:** Enable Collection selection when approving knowledge candidates in the Knowledge Feed
**Acceptance Criteria:**
- AC-D1: 猫猫在 Knowledge Feed approve 时可以选择目标 Collection
- AC-D2: materialize 后自动触发增量 reindex (**already implemented**)
- AC-D3: materialize 产出的文件有 frontmatter（至少 doc_kind + created） (**already implemented**)
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** Extends existing KnowledgeFeed UI + existing approve API contract — no new architectural concepts
**Architecture:** Add Collection selector dropdown to KnowledgeCard approve flow. Frontend fetches catalog via existing GET /api/library/catalog, passes targetCollectionId to existing POST /api/knowledge/approve.
**Tech Stack:** React, TypeScript, existing apiFetch utility
**前端验证:** Yes — reviewer 必须用浏览器实测

---

## Pre-implementation Notes

- AC-D2 verified: `MaterializationService.materialize()` calls `indexBuilder.incrementalUpdate()` (line 96)
- AC-D3 verified: frontmatter includes `doc_kind`, `created`, `anchor`, `materialized_from`, optional `target_collection`/`source_collection`
- Backend approve API already accepts `{ markerId, targetCollectionId?, confirmVisibilityWidening? }`
- Visibility-widening guard returns 400 with `error: 'visibility-widening requires confirmation'`

## Implementation

### Task 1: Collection selector in KnowledgeFeed approve flow

**Files:**
- Modify: `packages/web/src/components/workspace/KnowledgeFeed.tsx`
- Create: `packages/web/src/components/workspace/__tests__/KnowledgeFeed.test.tsx`

**Step 1: Write failing test — collection fetch on mount**

Test that KnowledgeFeed fetches `/api/library/catalog` and stores active collections.

**Step 2: Run test, verify red**

**Step 3: Implement collection fetching**

Add `useEffect` to fetch `/api/library/catalog`, filter to active collections, store in state.
Pass collections array to KnowledgeCard.

**Step 4: Run test, verify green**

**Step 5: Write failing test — approve sends targetCollectionId**

Test that handleApprove includes selected collectionId in POST body.

**Step 6: Implement Collection selector dropdown in KnowledgeCard**

Add `<select>` element in the review actions area showing available collections.
Wire selection to handleApprove.

**Step 7: Write failing test — visibility-widening confirmation**

Test that when approve returns 400 with visibility-widening error, UI shows confirmation
and re-sends with `confirmVisibilityWidening: true`.

**Step 8: Implement visibility-widening confirmation flow**

When approve API returns 400 with visibility-widening detail, show a window.confirm()
with the detail message. If confirmed, re-send with confirmVisibilityWidening: true.

**Step 9: Run full test suite, commit**

**Step 10: Verify in browser via alpha**
