# F045 Task Progress Redis Persistence + Continue Button — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist per-cat checklist/task progress to Redis so it survives refresh/restart/process-kill, and add a right-panel “继续” action that posts a visible resume message and triggers a new invocation.

**Architecture:** Replace/augment the current module-level `TaskProgressCache` with a Redis-backed store keyed by `(threadId, catId)` and retaining a snapshot `{ tasks, status, updatedAt, lastInvocationId, interruptReason? }` with TTL. RightStatusPanel renders status + checklist and shows `继续` for `interrupted`. Clicking `继续` posts a visible “🔁 继续上次任务 …” message targeted to that cat (new invocation; no attempt to resume a dead process).

**Tech Stack:** TypeScript, Fastify routes (api), Redis store layer, Zustand store + React (web), Vitest.

---

## Acceptance Criteria

1. **Refresh/restart safe:** After browser F5 (and after runtime restart), the right panel still shows the last known checklist snapshot for each cat (subject to TTL).
2. **Status semantics:** Each snapshot has `status: running | completed | interrupted` and an `updatedAt` timestamp.
3. **Continue UX (right panel):** For `interrupted` snapshots, show a `继续` button that opens a confirmation dialog and then posts a visible “🔁 继续上次任务 …” message to the thread, targeting that cat.
4. **No misleading “still running”:** If the invocation is no longer running, the UI must not imply it is; `interrupted` is explicit.
5. **Auth preserved:** The existing `/task-progress` endpoint keeps user/thread ownership checks; the resume action uses the same auth boundary as normal message posting.
6. **Tests:** Add regression tests for: snapshot persistence read/write behavior, continue message generation, and UI gating of `继续`.

---

## Task 0: Locate existing task progress pipeline

**Files (read):**
- `packages/api/src/domains/cats/services/agents/invocation/TaskProgressCache.ts`
- `packages/api/src/routes/threads.ts` (task-progress endpoints)
- `packages/web/src/components/RightStatusPanel.tsx` (checklist rendering)
- `packages/web/src/hooks/useChatHistory.ts` (task progress restore)

**Step 1:** Confirm current in-memory cache behavior and where it is cleared.

**Step 2:** Confirm the client already restores `taskProgress` after refresh, but loses it after restart.

**Step 3:** Commit nothing (read-only).

---

## Task 1: Define a Redis-backed Task Progress store

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/invocation/TaskProgressStore.ts`
- Create: `packages/api/src/domains/cats/services/agents/invocation/RedisTaskProgressStore.ts`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/TaskProgressCache.ts` (or replace its usage)

**Step 1: Write failing unit test (RED)**

Create: `packages/api/src/domains/cats/services/agents/invocation/__tests__/task-progress-store.test.ts`

- Given `(threadId, catId)` and a snapshot, `setSnapshot()` then `getSnapshot()` returns it.
- Snapshot includes `tasks[]`, `status`, `updatedAt`, optional `interruptReason`.

Run: `pnpm --filter @cat-cafe/api test -- task-progress-store`
Expected: FAIL (store not implemented / not wired)

**Step 2: Implement minimal store interface**

Define:
- `TaskProgressSnapshot`
- `getSnapshot(threadId, catId)`
- `setSnapshot(threadId, catId, snapshot, ttlSeconds)`
- `deleteSnapshot(threadId, catId)`

**Step 3: Implement Redis store**

Use JSON value or hash; prefer JSON string for simplicity.
- Key format: `cat-cafe:task-progress:{threadId}:{catId}`
- TTL: configurable constant, default `7d`

**Step 4: Run tests (GREEN)**

If Redis is not available in default tests, mock Redis client for unit tests (do not require real Redis).

**Step 5: Commit**

Commit: `feat(api): add redis task progress store [砚砚/Codex🐾]`

---

## Task 2: Wire API endpoint `/task-progress` to Redis store

**Files:**
- Modify: `packages/api/src/routes/threads.ts` (existing GET `/api/threads/:id/task-progress`)
- Modify/Create: API deps wiring for the new store (wherever `TaskProgressCache` is used today)
- Test: `packages/api/src/routes/__tests__/task-progress-route.test.js` (extend)

**Step 1: RED**

Add a test that:
- Writes a snapshot (via mocked store / helper)
- `GET /api/threads/:id/task-progress` returns it

Expected: FAIL (still using in-memory cache)

**Step 2: GREEN**

Update route handler to read from Redis store.

**Step 3: Commit**

Commit: `feat(api): serve task progress from redis [砚砚/Codex🐾]`

---

## Task 3: Persist progress updates during invocation

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` (where `task_progress` is emitted)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts`

**Step 1: RED**

Add tests ensuring:
- On `task_progress` event, store writes `status=running`.
- On normal completion: `status=completed` if all tasks are checked.
- On error/kill: `status=interrupted` and preserves last tasks.

Expected: FAIL (no redis writes / no status)

**Step 2: GREEN**

Implement minimal status transitions:
- Any progress update → `running`.
- Invocation ends:
  - If ended with error → `interrupted`.
  - Else if tasks all `done=true` → `completed`.
  - Else → `interrupted` (ended without full completion).

**Step 3: Commit**

Commit: `feat(api): persist progress snapshot + status transitions [砚砚/Codex🐾]`

---

## Task 4: Right panel Continue button (web)

**Files:**
- Modify: `packages/web/src/components/RightStatusPanel.tsx` (or `CatTaskProgress` subcomponent)
- Modify: `packages/web/src/stores/chat-types.ts` (if needed to carry `status/updatedAt`)
- Modify: `packages/web/src/hooks/useChatHistory.ts` (hydrate status/updatedAt)
- Test: `packages/web/src/components/__tests__/right-status-panel-continue.test.tsx` (new)

**Step 1: RED**

Test: For an interrupted snapshot, the UI renders a `继续` button; for completed/running it does not.

Expected: FAIL (no button)

**Step 2: Implement UI**

- Show status pill.
- On click: confirm dialog.
- After confirm: call existing “send message” path to post a visible resume message targeting that cat.
  - Message content includes last known checklist (minimize noise; optionally include only unchecked items).

**Step 3: GREEN**

Run: `pnpm --filter @cat-cafe/web test`

**Step 4: Commit**

Commit: `feat(web): right panel continue for interrupted progress [砚砚/Codex🐾]`

---

## Task 5: End-to-end verification (manual)

**Step 1:** Start runtime using dev Redis (6398).

**Step 2:** Trigger a task that produces checklist progress.

**Step 3:** Kill the CLI process (or simulate error), confirm status becomes `已中断` and `继续` appears.

**Step 4:** Click `继续`, confirm a visible `🔁` message is posted and a new invocation starts.

**Step 5:** Restart runtime, confirm snapshots still show (until TTL).

---

## Task 6: Docs update

**Files:**
- Modify: `docs/features/F045-ndjson-observability.md` (Gap #4 becomes ✅ with new semantics)

**Step 1:** Document:
- Status meanings
- TTL
- “继续” is *new invocation*, not process resume

**Step 2:** Commit

Commit: `docs(F045): close gap #4 with redis persistence + continue UX [砚砚/Codex🐾]`

