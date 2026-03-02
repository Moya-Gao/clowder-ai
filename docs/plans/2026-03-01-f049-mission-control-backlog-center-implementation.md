---
feature_ids: [F049]
topics: [mission-control, backlog, dispatch, ui]
doc_kind: plan
created: 2026-03-01
---

# F049 Mission Control Backlog Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Deliver F049 MVP as a direct-to-final-shape vertical slice: global backlog center in product UI, suggestion-claim workflow, human approval, and automatic thread dispatch with kickoff context.

**Architecture:** Add a dedicated Backlog domain (types + store + route) parallel to existing Task domain, using Redis-first storage with memory fallback via Store Factory. Dispatch path is transactional at service level: approve suggestion updates backlog item, creates thread, writes thread phase, injects kickoff message, then marks item dispatched with audit entry. Frontend adds a first-class `/mission-control` page and sidebar entry, reusing existing design language but introducing a stable information architecture that scales to lease/audit expansion.

**Tech Stack:** Fastify (`packages/api`), Store Factory + Redis stores, Next.js web app (`packages/web`), Zustand local view state, Pencil MCP for layout contract and screenshot validation.

---

## Task 1: Pencil UI contract (non-throwaway)

**Files:**
- Create/Update (Pencil document via MCP): `designs/f049-mission-control.pen` (if no existing design file, create new and save)
- Add screenshot artifact reference to plan/review notes later

**Step 1: Capture baseline canvas state**
Run Pencil MCP: `get_editor_state(include_schema=false)`.
Expected: active editor context available.

**Step 2: Build final IA frame (not temporary MVP)**
Design one screen with fixed regions:
- Header: filters + quick-create
- Main list: backlog cards with status lanes
- Right drawer: suggestion detail + approval actions
- Dispatch panel: thread phase selector (`coding|research|brainstorm`) and auto-generated kickoff preview

**Step 3: Validate layout with screenshot**
Run Pencil MCP `get_screenshot` on the Mission Control frame.
Expected: one coherent layout that maps 1:1 to React component boundaries.

**Step 4: Record implementation mapping**
Write mapping in this plan’s Task 4 notes (component names ↔ design regions) before coding UI.

## Task 2: Domain contracts + store layer (TDD first)

**Files:**
- Create: `packages/shared/src/types/backlog.ts`
- Modify: `packages/shared/src/types/index.ts`
- Create: `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/redis-keys/backlog-keys.ts`
- Create: `packages/api/src/domains/cats/services/stores/factories/BacklogStoreFactory.ts`
- Test: `packages/api/test/backlog-store.test.js`

**Step 1: Write failing store tests**
Cover:
- create/list by user sorted newest first
- suggest claim transition: `open -> suggested`
- decision transition: approve/reject
- dispatch transition writes `threadId`, `threadPhase`, `dispatchedAt`
- invalid transitions are rejected deterministically

Run: `cd packages/api && pnpm run build && node --test test/backlog-store.test.js`
Expected: FAIL (types/store missing).

**Step 2: Implement shared types and state machine constraints**
Define:
- `BacklogPriority`, `BacklogStatus`, `ThreadPhase`
- `BacklogClaimSuggestion`
- `BacklogAuditEntry`
- `BacklogItem`

Implement transition guards in store methods, not in route only.

**Step 3: Implement memory + Redis store parity**
Both stores expose identical interface and transition behavior.

**Step 4: Re-run targeted tests**
Run: `cd packages/api && pnpm run build && node --test test/backlog-store.test.js`
Expected: PASS.

## Task 3: API routes + auto-dispatch pipeline (TDD first)

**Files:**
- Create: `packages/api/src/routes/backlog.ts`
- Modify: `packages/api/src/routes/index.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts`
- Test: `packages/api/test/backlog-routes.test.js`
- Update: `packages/api/test/threads-endpoint.test.js` (thread phase patch coverage)

**Step 1: Write failing route tests**
Cover:
- `POST /api/backlog/items` create item
- `GET /api/backlog/items` list by requesting user
- `POST /api/backlog/items/:id/suggest-claim` writes suggestion + audit
- `POST /api/backlog/items/:id/decide-claim` with `approve` creates thread, sets thread phase, injects kickoff message, returns `threadId`
- `POST /api/backlog/items/:id/decide-claim` with `reject` returns item to `open`

Run: `cd packages/api && pnpm run build && node --test test/backlog-routes.test.js`
Expected: FAIL (route missing).

**Step 2: Add thread phase support (no side path)**
Add `phase?: 'coding'|'research'|'brainstorm'` to thread model and store update API (`updatePhase`).
Ensure routes can patch/read it without breaking existing thread behaviors.

**Step 3: Implement route with service-level ordering**
Approve path order:
1. validate suggestion pending
2. create thread with title derived from backlog item
3. set thread phase
4. append kickoff message (task description + acceptance + links)
5. mark backlog item dispatched with `threadId`

If any step fails, route returns error and does not mark dispatched.

**Step 4: Re-run targeted API tests**
Run:
- `cd packages/api && pnpm run build && node --test test/backlog-routes.test.js`
- `cd packages/api && pnpm run build && node --test test/threads-endpoint.test.js`
Expected: PASS.

## Task 4: Mission Control UI implementation (from Pencil contract, TDD first)

**Files:**
- Create: `packages/web/src/app/mission-control/page.tsx`
- Create: `packages/web/src/components/mission-control/MissionControlPage.tsx`
- Create: `packages/web/src/components/mission-control/MissionControlCard.tsx`
- Create: `packages/web/src/components/mission-control/SuggestionDrawer.tsx`
- Create: `packages/web/src/components/mission-control/QuickCreateForm.tsx`
- Create: `packages/web/src/stores/missionControlStore.ts`
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` (add entry link)
- Test: `packages/web/src/components/__tests__/mission-control-page.test.tsx`

**Step 1: Write failing UI tests**
Cover:
- render lanes by status
- quick-create posts new item and inserts into list
- suggest-claim action opens drawer and submits reason/plan
- approve action dispatches and shows linked thread CTA

Run: `cd packages/web && pnpm test -- mission-control-page.test.tsx`
Expected: FAIL (components missing).

**Step 2: Implement final-shape component structure (no throwaway UI)**
Map directly from Pencil regions:
- header/filter/create
- lane board/cards
- suggestion drawer
- dispatch feedback and link-to-thread

Use a consistent visual direction with CSS variables and deliberate typography/motion, but keep existing app tokens compatible.

**Step 3: Add navigation entry**
Add “Mission Control” entry in sidebar and route navigation to `/mission-control`.

**Step 4: Re-run UI test**
Run: `cd packages/web && pnpm test -- mission-control-page.test.tsx`
Expected: PASS.

## Task 5: Quality gate + docs sync + review package

**Files:**
- Modify: `docs/features/F049-mission-control-backlog-center.md` (mark implemented ACs)
- Create: `docs/discussions/2026-03-01-f049-mission-control-ui-contract/README.md` (Pencil screenshot + mapping)
- Create: `docs/mailbox/2026-03-01-f049-mission-control-implementation-review-request.md`

**Step 1: Run verification**
Run:
- `env -u REDIS_URL pnpm test`
- `pnpm lint`
- `pnpm -r --if-present run build`
Expected: all pass (warnings allowed if pre-existing).

**Step 2: Sync feature truth source**
Update F049 AC checklist with actual delivered scope and explicit deferred items (lease/heartbeat).

**Step 3: Prepare review request to @opus**
Include:
- original requirements quotes
- test evidence
- risk notes (thread phase + dispatch consistency)
- open question: lease/heartbeat phase boundary

