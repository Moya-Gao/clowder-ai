# F057 Phase A: Thread 排序 + 搜索增强 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 让侧边栏 thread 按活跃度排序（最近有消息的在前），未读优先，搜索支持 thread ID。

**Architecture:** 改动集中在前端 `ThreadSidebar/thread-utils.ts` 排序逻辑。所有分组（pinned/project/favorites）内部统一按 `lastActiveAt` 降序排列，未读 thread 在同组内优先。搜索框加 thread ID 匹配。无后端改动。

**Tech Stack:** React, TypeScript, Zustand, Next.js, Vitest

---

## 前置知识

### 文件地图

| 文件 | 作用 |
|------|------|
| `packages/web/src/components/ThreadSidebar/thread-utils.ts` | 排序分组核心逻辑 |
| `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` | 侧边栏组件，含搜索过滤 |
| `packages/web/src/components/ThreadSidebar/ThreadItem.tsx` | 单个 thread 渲染 |
| `packages/web/src/components/ThreadCatStatus.tsx` | 未读计数 badge |
| `packages/web/src/stores/chat-types.ts` | Thread / ThreadState 类型 |
| `packages/web/src/components/__tests__/thread-utils.test.ts` | 排序逻辑测试 |

### 当前排序逻辑（要改的）

```
sortAndGroupThreads():
  1. Pinned → 按 pinnedAt 降序
  2. Regular → 按 project 分组，组内无排序
  3. Favorites → 按 favoritedAt 降序
```

### 目标排序逻辑

```
sortAndGroupThreads(threads, getUnreadCount?):
  1. Pinned → 未读优先，然后按 lastActiveAt 降序
  2. Regular → 按 project 分组，组内未读优先 + lastActiveAt 降序
  3. Favorites → 未读优先，然后按 lastActiveAt 降序
```

---

## Task 1: 排序逻辑 — 按 lastActiveAt 排序（不含未读优先）

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/thread-utils.ts:45-77`
- Modify: `packages/web/src/components/__tests__/thread-utils.test.ts`

**Step 1: 写失败测试 — pinned 按 lastActiveAt 排序**

在 `thread-utils.test.ts` 的 `sortAndGroupThreads` describe 块里新增：

```typescript
it('sorts pinned threads by lastActiveAt descending', () => {
  const threads: Thread[] = [
    { id: 'old', projectPath: 'p', title: 'old', createdBy: 'u', participants: [], lastActiveAt: 1000, createdAt: 1, pinned: true, pinnedAt: 100 },
    { id: 'new', projectPath: 'p', title: 'new', createdBy: 'u', participants: [], lastActiveAt: 5000, createdAt: 2, pinned: true, pinnedAt: 50 },
  ];
  const groups = sortAndGroupThreads(threads);
  const pinned = groups.find((g) => g.type === 'pinned')!;
  expect(pinned.threads[0].id).toBe('new'); // lastActiveAt=5000 在前
  expect(pinned.threads[1].id).toBe('old'); // lastActiveAt=1000 在后
});
```

**Step 2: 跑测试确认失败**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/thread-utils.test.ts`
Expected: FAIL — 当前按 pinnedAt 排序，old 的 pinnedAt=100 > new 的 pinnedAt=50，所以 old 在前。

**Step 3: 实现 — 改 sortAndGroupThreads 排序**

在 `thread-utils.ts` 中，修改 `sortAndGroupThreads`：

```typescript
export function sortAndGroupThreads(threads: Thread[]): ThreadGroup[] {
  const groups: ThreadGroup[] = [];

  // 1. Pinned threads (sorted by lastActiveAt desc)
  const pinned = threads
    .filter((t) => t.pinned && t.id !== 'default')
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  if (pinned.length > 0) {
    groups.push({ type: 'pinned', label: '置顶', threads: pinned });
  }

  // 2. Regular threads grouped by project (each group sorted by lastActiveAt desc)
  const regular = threads.filter((t) => !t.pinned && !t.favorited && t.id !== 'default');
  const projectGroups = groupByProject(regular);
  for (const [projectPath, projectThreads] of projectGroups) {
    groups.push({
      type: 'project',
      label: projectDisplayName(projectPath),
      threads: projectThreads.sort((a, b) => b.lastActiveAt - a.lastActiveAt),
      projectPath,
    });
  }

  // 3. Favorites (sorted by lastActiveAt desc, excluding pinned)
  const favorited = threads
    .filter((t) => t.favorited && !t.pinned && t.id !== 'default')
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  if (favorited.length > 0) {
    groups.push({ type: 'favorites', label: '收藏', threads: favorited });
  }

  return groups;
}
```

**Step 4: 跑测试确认通过**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/thread-utils.test.ts`
Expected: ALL PASS

**Step 5: 提交**

```bash
git add packages/web/src/components/ThreadSidebar/thread-utils.ts packages/web/src/components/__tests__/thread-utils.test.ts
git commit -m "feat(F057): sort threads by lastActiveAt instead of pinnedAt/favoritedAt"
```

---

## Task 2: 排序逻辑 — 未读优先

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/thread-utils.ts`
- Modify: `packages/web/src/components/__tests__/thread-utils.test.ts`

**Step 1: 写失败测试 — 未读 thread 排在已读前面**

```typescript
it('sorts unread threads before read threads within pinned group', () => {
  const threads: Thread[] = [
    { id: 'read-new', projectPath: 'p', title: 'read-new', createdBy: 'u', participants: [], lastActiveAt: 9000, createdAt: 1, pinned: true },
    { id: 'unread-old', projectPath: 'p', title: 'unread-old', createdBy: 'u', participants: [], lastActiveAt: 1000, createdAt: 2, pinned: true },
  ];
  const unreadSet = new Set(['unread-old']);
  const groups = sortAndGroupThreads(threads, unreadSet);
  const pinned = groups.find((g) => g.type === 'pinned')!;
  expect(pinned.threads[0].id).toBe('unread-old');  // 未读优先
  expect(pinned.threads[1].id).toBe('read-new');     // 已读在后
});

it('within unread threads, still sorts by lastActiveAt desc', () => {
  const threads: Thread[] = [
    { id: 'unread-old', projectPath: 'p', title: 'uo', createdBy: 'u', participants: [], lastActiveAt: 1000, createdAt: 1, pinned: true },
    { id: 'unread-new', projectPath: 'p', title: 'un', createdBy: 'u', participants: [], lastActiveAt: 5000, createdAt: 2, pinned: true },
  ];
  const unreadSet = new Set(['unread-old', 'unread-new']);
  const groups = sortAndGroupThreads(threads, unreadSet);
  const pinned = groups.find((g) => g.type === 'pinned')!;
  expect(pinned.threads[0].id).toBe('unread-new');  // 都未读时按活跃排
  expect(pinned.threads[1].id).toBe('unread-old');
});
```

**Step 2: 跑测试确认失败**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/thread-utils.test.ts`
Expected: FAIL — `sortAndGroupThreads` 还不接受第二个参数。

**Step 3: 实现 — 加 unreadIds 参数**

修改 `thread-utils.ts`：

```typescript
/**
 * Sort comparator: unread first, then by lastActiveAt descending.
 */
function sortByUnreadThenActive(a: Thread, b: Thread, unreadIds?: Set<string>): number {
  if (unreadIds) {
    const aUnread = unreadIds.has(a.id) ? 1 : 0;
    const bUnread = unreadIds.has(b.id) ? 1 : 0;
    if (aUnread !== bUnread) return bUnread - aUnread; // unread first
  }
  return b.lastActiveAt - a.lastActiveAt;
}

export function sortAndGroupThreads(threads: Thread[], unreadIds?: Set<string>): ThreadGroup[] {
  const groups: ThreadGroup[] = [];

  const pinned = threads
    .filter((t) => t.pinned && t.id !== 'default')
    .sort((a, b) => sortByUnreadThenActive(a, b, unreadIds));
  if (pinned.length > 0) {
    groups.push({ type: 'pinned', label: '置顶', threads: pinned });
  }

  const regular = threads.filter((t) => !t.pinned && !t.favorited && t.id !== 'default');
  const projectGroups = groupByProject(regular);
  for (const [projectPath, projectThreads] of projectGroups) {
    groups.push({
      type: 'project',
      label: projectDisplayName(projectPath),
      threads: projectThreads.sort((a, b) => sortByUnreadThenActive(a, b, unreadIds)),
      projectPath,
    });
  }

  const favorited = threads
    .filter((t) => t.favorited && !t.pinned && t.id !== 'default')
    .sort((a, b) => sortByUnreadThenActive(a, b, unreadIds));
  if (favorited.length > 0) {
    groups.push({ type: 'favorites', label: '收藏', threads: favorited });
  }

  return groups;
}
```

**Step 4: 跑测试确认通过**

Run: `cd packages/web && pnpm vitest run src/components/__tests__/thread-utils.test.ts`
Expected: ALL PASS（旧测试不传 unreadIds 也兼容）

**Step 5: 提交**

```bash
git add packages/web/src/components/ThreadSidebar/thread-utils.ts packages/web/src/components/__tests__/thread-utils.test.ts
git commit -m "feat(F057): unread threads sort first within each group"
```

---

## Task 3: ThreadSidebar 接入 — 传 unreadIds 到排序

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx:219-230`

**Step 1: 构建 unreadIds Set 并传入 sortAndGroupThreads**

在 `ThreadSidebar.tsx` 中，修改 `threadGroups` 的 useMemo：

```typescript
// 现有代码（~line 219-230）:
const normalizedQuery = searchQuery.trim().toLowerCase();
const filteredThreads = useMemo(() => { ... }, [threads, normalizedQuery]);

// ---- 新增: 构建 unreadIds ----
const unreadIds = useMemo(() => {
  const ids = new Set<string>();
  for (const thread of threads) {
    const state = getThreadState(thread.id);
    if (state && state.unreadCount > 0) {
      ids.add(thread.id);
    }
  }
  return ids;
}, [threads, getThreadState]);

// 修改这行:
const threadGroups = useMemo(() => sortAndGroupThreads(filteredThreads, unreadIds), [filteredThreads, unreadIds]);
```

**Step 2: 跑 build 确认编译通过**

Run: `cd packages/web && pnpm build`
Expected: BUILD SUCCESS

**Step 3: 提交**

```bash
git add packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx
git commit -m "feat(F057): wire unreadIds into thread sorting"
```

---

## Task 4: 搜索增强 — 支持 Thread ID 搜索

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx:220-228`

**Step 1: 修改搜索过滤逻辑**

在 `ThreadSidebar.tsx` 的 `filteredThreads` useMemo 里，加一行 `thread.id` 匹配：

```typescript
const filteredThreads = useMemo(() => {
  if (!normalizedQuery) return threads;
  return threads.filter((thread) => {
    const title = (thread.title ?? '').toLowerCase();
    const fallback = (thread.id === 'default' ? '大厅' : '未命名对话').toLowerCase();
    const project = (thread.projectPath ?? '').toLowerCase();
    const threadId = thread.id.toLowerCase(); // ← 新增
    return (
      title.includes(normalizedQuery) ||
      fallback.includes(normalizedQuery) ||
      project.includes(normalizedQuery) ||
      threadId.includes(normalizedQuery) // ← 新增
    );
  });
}, [threads, normalizedQuery]);
```

同时更新 placeholder 文案：

```typescript
placeholder="搜索对话、项目或 ID..."
```

**Step 2: 跑 build 确认编译通过**

Run: `cd packages/web && pnpm build`
Expected: BUILD SUCCESS

**Step 3: 提交**

```bash
git add packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx
git commit -m "feat(F057): search supports thread ID matching"
```

---

## Task 5: 未读计数 badge 确认（已有，验证即可）

**Files:**
- Read only: `packages/web/src/components/ThreadCatStatus.tsx`
- Read only: `packages/web/src/components/ThreadSidebar/ThreadItem.tsx:247-249`

**Step 1: 确认现有未读 badge**

`ThreadItem.tsx:247-249` 已经渲染 `ThreadCatStatus`：
```tsx
{threadState && (
  <ThreadCatStatus threadState={threadState} unreadCount={threadState.unreadCount} />
)}
```

`ThreadCatStatus.tsx` 已经显示未读计数 badge（amber 背景，99+ 封顶）。

**结论**：AC-A3 的未读计数 badge 已有实现，无需新增代码。只需确认 `getThreadState` 正确返回 `unreadCount`。

**Step 2: 提交（仅测试验证，无代码改动则跳过）**

---

## Task 6: 整体验证 + 类型检查

**Step 1: 跑全量测试**

```bash
cd packages/web && pnpm vitest run
```

**Step 2: 跑类型检查**

```bash
cd packages/web && pnpm lint
```

**Step 3: 跑 Biome**

```bash
pnpm check
```

---

## Acceptance Criteria 映射

| AC | 实现 Task | 验证方式 |
|----|-----------|----------|
| AC-A1: 置顶按最后消息时间排序 | Task 1 | 单元测试 |
| AC-A2: 非置顶按最后消息时间排序 | Task 1 | 单元测试 |
| AC-A3: 未读 thread 同组内优先排前 | Task 2 + Task 5 | 单元测试 + 已有 badge |
| 搜索支持 thread ID（bonus） | Task 4 | 手动验证 |

## 不在 Phase A 范围

- Phase B: badge 增强（thread ID + 名称 + 可点击跳转）
- Phase C: `list_threads` MCP 工具 + @ 铲屎官
- F056 design token 集成（Phase A 用现有样式）
