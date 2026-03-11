# F095 Phase B: Active Workspace Implementation Plan

**Feature:** F095 — `docs/features/F095-sidebar-collapse-memory.md`
**Goal:** Sidebar only shows active projects; inactive auto-archived to collapsed "其他项目" section. 50 projects still usable.
**Acceptance Criteria:**
- AC-B1: Sidebar 展示"最近对话"段（跨项目，≤8 条，按 lastActiveAt）
- AC-B2: 项目分为"活跃项目"和"其他项目"两个区域
- AC-B3: 近 7 天无活动的项目自动收纳到"其他项目"
- AC-B4: 用户可 pin/unpin 项目到活跃区（localStorage 持久化）
- AC-B5: 活跃区内 pinned 项目在前，其余按最新活动时间排序
- AC-B6: "其他项目"折叠区点击可展开完整列表
- AC-B7: 50 个项目时 sidebar 仍然可用（活跃区仅展示 3-5 个活跃项目）
**Architecture:** Pure-function layer (`active-workspace.ts`) for workspace logic + project pin persistence. `sortAndGroupThreads` extended with new group types. ThreadSidebar renders new layout sections.
**Tech Stack:** React, localStorage, Vitest
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Not building

- 后端 API 变更（纯前端 localStorage）
- 拖拽排序
- Phase C 新建对话增强

## Terminal Schema

```typescript
// ThreadGroup.type extended
type ThreadGroupType = 'pinned' | 'recent' | 'project' | 'archived-container' | 'favorites';

// New: project pin persistence
const PROJECT_PIN_KEY = 'cat-cafe:sidebar:pinned-projects';

// active-workspace.ts exports
interface WorkspaceConfig {
  activeCutoffMs: number;  // default: 7 * 86400_000
  recentLimit: number;     // default: 8
}

function getRecentThreads(threads: Thread[], limit: number): Thread[];
function getProjectLatestActivity(threads: Thread[], projectPath: string): number;
function splitIntoActiveAndArchived(
  projectGroups: ThreadGroup[],
  threads: Thread[],
  pinnedProjects: Set<string>,
  cutoffMs: number,
): { active: ThreadGroup[]; archived: ThreadGroup[] };
function readPinnedProjects(storage: StorageLike): Set<string>;
function writePinnedProjects(projects: Set<string>, storage: StorageLike): void;
```

## Tasks

### Task 1: Pure functions — active-workspace.ts + tests

**Files:**
- Create: `packages/web/src/components/ThreadSidebar/active-workspace.ts`
- Create: `packages/web/src/components/__tests__/active-workspace.test.ts`

**Step 1: Write failing tests**

Test cases:
- `getRecentThreads`: returns ≤8 threads sorted by lastActiveAt desc, excludes default/pinned
- `getProjectLatestActivity`: returns max lastActiveAt across project's threads, 0 for empty
- `splitIntoActiveAndArchived`: pinned projects always active; 7-day cutoff; active sorted (pinned first, then by activity)
- `readPinnedProjects/writePinnedProjects`: localStorage round-trip, graceful fallback on invalid data

**Step 2: Run tests to verify Red**

**Step 3: Implement pure functions**

- `getRecentThreads`: filter out default/pinned → sort by lastActiveAt desc → slice(0, limit)
- `getProjectLatestActivity`: threads.filter(t => t.projectPath === path).reduce(max lastActiveAt)
- `splitIntoActiveAndArchived`: for each project group, check if pinned OR latest activity within cutoff → active; else → archived. Sort active: pinned first, then by latest activity desc.
- `readPinnedProjects/writePinnedProjects`: same StorageLike pattern as collapse-state.ts

**Step 4: Run tests to verify Green**

**Step 5: Commit**

### Task 2: Extend sortAndGroupThreads for workspace layout

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/thread-utils.ts`
- Modify: `packages/web/src/components/__tests__/thread-utils.test.ts`

**Step 1: Write failing tests**

New test: `sortAndGroupThreadsWithWorkspace` produces groups in order:
pinned → recent → active projects → archived-container → favorites

Test with mix of active/inactive projects, pinned projects, recent threads.

**Step 2: Run tests to verify Red**

**Step 3: Implement**

Add `sortAndGroupThreadsWithWorkspace(threads, unreadIds, pinnedProjects, config)` that:
1. Extracts pinned threads (existing)
2. Builds "recent" group from `getRecentThreads`
3. Builds project groups (existing `groupByProject`)
4. Splits via `splitIntoActiveAndArchived`
5. Wraps archived groups in a container group
6. Extracts favorites (existing)
7. Returns ordered array

Update `ThreadGroup.type` union to include `'recent' | 'archived-container'`.

**Step 4: Run tests to verify Green**

**Step 5: Commit**

### Task 3: Project pin hook + persistence

**Files:**
- Create: `packages/web/src/components/ThreadSidebar/use-project-pins.ts`

**Step 1-5:** Simple React hook wrapping `readPinnedProjects/writePinnedProjects`:
- `usePinnedProjects()` → `{ pinnedProjects, toggleProjectPin }`
- Reads from localStorage on init, writes on change

**Commit**

### Task 4: ThreadSidebar integration

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx`

**Changes:**
1. Import `usePinnedProjects` + `sortAndGroupThreadsWithWorkspace`
2. Replace `sortAndGroupThreads` call with workspace version, passing pinnedProjects
3. Render "最近对话" group with `type === 'recent'` — flat list, no project header
4. Render "archived-container" as a collapsible section with count badge
5. Add project pin/unpin action to SectionGroup context menu (for project groups)
6. Integrate with existing collapse state (Phase A hook handles it automatically via group keys)

**Commit**

### Task 5: Full test suite + regression check

Run `pnpm --filter @cat-cafe/web test`, `pnpm check`, `pnpm lint`. Fix any issues.

**Commit: feat(F095): Phase B — active workspace**
