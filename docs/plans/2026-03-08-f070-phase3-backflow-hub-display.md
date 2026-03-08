# F070 Phase 3: Execution Backflow + Hub Display — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Let Mission Hub show what dispatched cats brought back from external projects — execution digests, completion status, file changes — without needing to go look in external project logs.

**Architecture:** After a cat finishes work in an external project, capture a structured execution digest and write it to the governance registry. Hub pulls these digests via a new API endpoint and renders them in the ExternalProjectTab's existing sub-tab structure.

**Tech Stack:** Node.js (node:test), Fastify API, Zustand store, React components, existing HandoffDigestGenerator + GovernanceRegistry

**Not building:** 3b (real-world closure verification) — deferred until cats actually return from a dispatch. No new DB layer — in-memory + JSON file storage consistent with existing governance infrastructure.

---

## Terminal Schema

```typescript
// packages/shared/src/types/capability.ts — additions

/** Structured execution result captured after dispatch completion */
interface DispatchExecutionDigest {
  readonly id: string;                    // uuid
  readonly projectPath: string;           // external project root
  readonly threadId: string;              // cat-cafe thread that dispatched
  readonly catId: string;                 // which cat was dispatched
  readonly missionPack: DispatchMissionPack; // what they were sent to do
  readonly completedAt: number;           // timestamp
  readonly summary: string;              // 1-3 sentence human-readable summary
  readonly filesChanged: readonly string[]; // relative paths touched
  readonly status: 'completed' | 'partial' | 'blocked'; // outcome
  readonly doneWhenResults: readonly DoneWhenResult[]; // per-criterion pass/fail
  readonly nextSteps: readonly string[];  // what the cat recommends next
}

interface DoneWhenResult {
  readonly criterion: string;   // from mission pack doneWhen
  readonly met: boolean;
  readonly evidence: string;    // brief explanation
}
```

---

## Task 1: Shared Types — DispatchExecutionDigest

**Files:**
- Modify: `packages/shared/src/types/capability.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Add types to capability.ts**

Add `DispatchExecutionDigest` and `DoneWhenResult` interfaces after existing `DispatchMissionPack`.

**Step 2: Export from index.ts**

Add re-exports for new types.

**Step 3: Rebuild shared**

Run: `pnpm --filter @cat-cafe/shared build`

**Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat(F070): add DispatchExecutionDigest shared types"
```

---

## Task 2: ExecutionDigestStore (backend)

**Files:**
- Create: `packages/api/src/domains/projects/execution-digest-store.ts`
- Create: `packages/api/test/execution-digest-store.test.js`

**Step 1: Write failing tests**

Tests for:
1. `create(digest)` → stores and returns with id
2. `getById(id)` → returns digest or undefined
3. `listByProject(projectPath)` → returns digests for a project, newest first
4. `listByThread(threadId)` → returns digests for a thread
5. `listAll()` → returns all digests

**Step 2: Run tests, verify all fail**

Run: `node --test packages/api/test/execution-digest-store.test.js`

**Step 3: Implement store**

In-memory Map store (consistent with ExternalProjectStore, IntentCardStore pattern). Key: digest id. Indexes: projectPath → id[], threadId → id[].

**Step 4: Run tests, verify all pass**

**Step 5: Commit**

```bash
git commit -m "feat(F070): add ExecutionDigestStore with 5 tests"
```

---

## Task 3: Digest Capture Hook in invoke-single-cat.ts

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
- Create: `packages/api/src/config/governance/execution-digest-capture.ts`
- Create: `packages/api/test/governance/execution-digest-capture.test.js`

**Step 1: Write failing tests for captureExecutionDigest()**

Test the pure function `captureExecutionDigest(missionPack, completionData)`:
1. Maps mission pack doneWhen to doneWhenResults
2. Extracts filesChanged from completion data
3. Sets status based on completion (completed/partial/blocked)
4. Returns well-formed DispatchExecutionDigest

**Step 2: Run tests, verify fail**

**Step 3: Implement captureExecutionDigest()**

Pure function that takes:
- `missionPack: DispatchMissionPack`
- `completionData: { summary: string; filesChanged: string[]; toolResults: unknown[]; blocked: boolean }`

Returns `Omit<DispatchExecutionDigest, 'id'>` (store assigns id).

**Step 4: Run tests, verify pass**

**Step 5: Wire into invoke-single-cat.ts**

At the `msg.type === 'done'` handler (~line 468), after existing completion logic:
- If external project dispatch: call `captureExecutionDigest()` → `executionDigestStore.create()`
- Guard: only if `missionPack` was injected (i.e., this was an external project dispatch)

**Step 6: Commit**

```bash
git commit -m "feat(F070): capture execution digest on dispatch completion"
```

---

## Task 4: API Routes for Execution Digests

**Files:**
- Create: `packages/api/src/routes/execution-digests.ts`
- Modify: `packages/api/src/routes/index.ts`
- Modify: `packages/api/src/index.ts`
- Create: `packages/api/test/execution-digest-routes.test.js`

**Step 1: Write failing route tests**

Tests for:
1. `GET /api/execution-digests?projectPath=...` → returns digests for project
2. `GET /api/execution-digests?threadId=...` → returns digests for thread
3. `GET /api/execution-digests/:id` → returns single digest
4. `GET /api/execution-digests/:id` with bad id → 404
5. `GET /api/execution-digests` (no filter) → returns all
6. Missing identity → 401

**Step 2: Run tests, verify fail**

**Step 3: Implement routes**

Follow existing pattern from external-projects.ts: `requireUserId()` guard on all routes.

**Step 4: Register routes in index.ts**

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git commit -m "feat(F070): add execution digest API routes with 6 tests"
```

---

## Task 5: Frontend — Zustand Store Extension

**Files:**
- Modify: `packages/web/src/stores/externalProjectStore.ts`
- Modify: `packages/web/src/components/__tests__/external-project-store.test.ts`

**Step 1: Write failing tests**

Tests for:
1. `setDigests(digests)` → updates store
2. Initial state has empty digests array

**Step 2: Run tests, verify fail**

**Step 3: Add `digests: DispatchExecutionDigest[]` + `setDigests` to store**

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat(F070): add execution digests to external project store"
```

---

## Task 6: Frontend — Dispatch Progress Sub-Tab

**Files:**
- Create: `packages/web/src/components/mission-control/DispatchProgress.tsx`
- Modify: `packages/web/src/components/mission-control/ExternalProjectTab.tsx`

**Step 1: Create DispatchProgress component**

Renders list of `DispatchExecutionDigest[]`:
- Status badge (completed=green, partial=yellow, blocked=red)
- Mission summary
- Files changed count + expandable list
- doneWhen checklist (✅/❌ per criterion with evidence)
- Next steps
- Timestamp + cat name

**Step 2: Add 'progress' sub-tab to ExternalProjectTab**

Update sub-tab type: `'audit' | 'health' | 'features' | 'progress'`

Add "派遣进展" tab button + content branch.

Load digests in the existing useEffect (add to Promise.allSettled):
```typescript
fetch(`/api/execution-digests?projectPath=${encodeURIComponent(project.sourcePath)}`)
```

**Step 3: Verify web build passes**

Run: `pnpm --filter @cat-cafe/web build`

**Step 4: Commit**

```bash
git commit -m "feat(F070): add dispatch progress sub-tab to Mission Hub"
```

---

## Task 7: Frontend — Governance Health Integration

**Files:**
- Modify: `packages/web/src/components/mission-control/GovernanceHealth.tsx`

**Step 1: Enhance GovernanceHealth with dispatch stats**

Add summary cards:
- Total dispatches count
- Completed / Partial / Blocked breakdown
- Latest dispatch timestamp
- doneWhen pass rate (% of criteria met across all digests)

Data comes from digests already loaded in ExternalProjectTab.

**Step 2: Verify web build**

**Step 3: Commit**

```bash
git commit -m "feat(F070): add dispatch stats to governance health view"
```

---

## Task 8: Wire Digest Loading in ExternalProjectTab

**Files:**
- Modify: `packages/web/src/components/mission-control/ExternalProjectTab.tsx`

**Step 1: Add digest fetch to useEffect**

Add fourth promise to `Promise.allSettled`:
```typescript
fetch(`/api/execution-digests?projectPath=${encodeURIComponent(project.sourcePath)}`, { headers })
```

Follow existing cancelled guard pattern for the setter.

**Step 2: Pass digests to DispatchProgress and GovernanceHealth**

**Step 3: Verify build**

**Step 4: Commit**

```bash
git commit -m "feat(F070): wire digest loading into external project tab"
```

---

## Task 9: Update F070 Spec + BACKLOG

**Files:**
- Modify: `docs/features/F070-portable-governance.md`
- Modify: `docs/BACKLOG.md`

**Step 1: Update spec**

- Mark Phase 3a + 3c sections as done
- Update AC-17 to `[x]`
- Add Timeline entry for Phase 3a+3c

**Step 2: Commit**

```bash
git commit -m "docs(F070): update spec — Phase 3a+3c done"
```

---

## Checklist Summary

| Task | What | Tests | Files |
|------|------|-------|-------|
| 1 | Shared types | — | 2 |
| 2 | ExecutionDigestStore | 5 | 2 |
| 3 | Digest capture hook | 4+ | 3 |
| 4 | API routes | 6 | 4 |
| 5 | Zustand store ext | 2 | 2 |
| 6 | DispatchProgress UI | — | 2 |
| 7 | GovernanceHealth stats | — | 1 |
| 8 | Wire digest loading | — | 1 |
| 9 | Spec + BACKLOG | — | 2 |
| **Total** | | **17+** | **19** |
