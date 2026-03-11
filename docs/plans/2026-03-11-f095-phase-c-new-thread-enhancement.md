# F095 Phase C: 新建对话增强 Implementation Plan

**Feature:** F095 — `docs/features/F095-sidebar-collapse-memory.md`
**Goal:** Improve thread creation UX: title input, feat association, pin-on-create, project list by recency
**Acceptance Criteria:**
- AC-C1: 新建对话时可填写 thread title
- AC-C2: 新建对话时可从下拉选择关联的活跃 feat
- AC-C3: 新建对话时可勾选"创建后置顶"
- AC-C4: 项目列表按最近活跃排序（不再纯字母序）
- AC-C5: 后端 `POST /api/threads` 支持 `backlogItemId` 和 `pinned` 入参
**Architecture:** Extend existing `DirectoryPickerModal` with new input fields (title, feat dropdown, pin checkbox). Backend already accepts `title`; add `pinned` + `backlogItemId` to create schema + handler. Sort project list using `getProjectLatestActivity` from Phase B.
**Tech Stack:** React, Fastify/Zod, TypeScript
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## What we're NOT building

- No backend `GET /api/backlog/active` — reuse existing `GET /api/backlog/items` filtered client-side
- No drag-drop reordering of projects
- No modal resize (current `max-w-[640px]` is adequate with optimized layout)

## Terminal Schema

### Backend: Extended `createThreadSchema`

```typescript
const createThreadSchema = z.object({
  userId: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200).optional(),       // already exists
  projectPath: z.string().min(1).max(500).optional(),
  preferredCats: z.array(catIdSchema()).max(10).optional(),
  pinned: z.boolean().optional(),                       // NEW: AC-C3/C5
  backlogItemId: z.string().min(1).max(100).optional(), // NEW: AC-C2/C5
});
```

### Frontend: Extended `onSelect` callback

```typescript
onSelect: (opts: {
  projectPath?: string;
  preferredCats?: string[];
  sessionBindings?: SessionBinding[];
  title?: string;           // NEW: AC-C1
  pinned?: boolean;         // NEW: AC-C3
  backlogItemId?: string;   // NEW: AC-C2
}) => void;
```

---

## Task 1: Backend — add `pinned` + `backlogItemId` to POST /api/threads

**Files:**
- Modify: `packages/api/src/routes/threads.ts:47-54` (schema), `:133-168` (handler)
- Test: `packages/api/src/__tests__/threads-create.test.ts` (new or existing)

**Step 1:** Write failing test — POST /api/threads with `pinned: true` returns thread with `pinned: true`
**Step 2:** Run test, confirm FAIL (schema rejects `pinned`)
**Step 3:** Add `pinned` and `backlogItemId` to `createThreadSchema`; apply in handler after create
**Step 4:** Run test, confirm PASS
**Step 5:** Commit

## Task 2: Frontend — extend DirectoryPickerModal with title + feat + pin

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx`
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx:124-172` (createInProject)

**Step 1:** Add state: `threadTitle`, `selectedBacklogItem`, `pinOnCreate`
**Step 2:** Add title input field above cat selector
**Step 3:** Add backlog item dropdown (fetches from `/api/backlog/items`, filters for non-done)
**Step 4:** Add "创建后置顶" checkbox
**Step 5:** Update `onSelect` signature to pass new fields as object
**Step 6:** Update `createInProject` to send `title`, `pinned`, `backlogItemId` to POST
**Step 7:** Manual browser test + commit

## Task 3: Frontend — sort project list by recent activity (AC-C4)

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx`
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` (pass threads to modal)

**Step 1:** Pass `threads` to DirectoryPickerModal (or a `projectActivityMap`)
**Step 2:** Sort `existingProjects` by most recent thread activity desc
**Step 3:** Write pure function test for project sorting logic
**Step 4:** Commit

## Task 4: Integration test + quality gate

**Step 1:** Run full test suite, lint, build
**Step 2:** Browser verification of new dialog fields
**Step 3:** Commit any fixes
