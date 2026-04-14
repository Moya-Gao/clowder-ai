---
feature_ids: [F160]
topics: [task-board, workspace, ui, frontend]
doc_kind: plan
created: 2026-04-14
---

# F160 Phase B: Task Board UI Upgrade — Implementation Plan

**Feature:** F160 — `docs/features/F160-task-board-upgrade.md`
**Goal:** 毛线球从 ThreadSidebar 底部升级为 Workspace 右面板独立 Tab，四段式布局，铲屎官可手动创建任务
**Acceptance Criteria:**
- AC-B1: 毛线球从 ThreadSidebar 底部移至 Workspace 右面板独立 Tab
- AC-B2: 四段式布局（doing/blocked/todo/done），blocked 高亮，todo/done 默认折叠
- AC-B3: 人工创建入口（`[+]` 按钮 + inline 表单）可用
- AC-B4: 任务卡片展开详情 + 状态切换可用
- AC-B5: 遵循 F056 设计语言（semantic token / 8px grid / warm radius / dark mode）
- AC-B6: 无视觉回归（ThreadSidebar 移除 TaskPanel 后布局正常）
**Architecture:** 扩展 `workspaceMode` 四态（dev/recall/schedule/tasks），新建 `TaskBoardPanel` 替代旧 `TaskPanel`，复用现有 taskStore + socket + REST API
**Tech Stack:** React 18, Zustand, Tailwind CSS, F056 semantic tokens
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## What We're NOT Building

- 拖拽排序（KD-5 三猫共识推迟）
- 任务间依赖关系
- Mission Hub 联动（Phase C 方向）
- 新的后端 API（POST/GET/PATCH/DELETE 全部已存在）

## Terminal Schema

```typescript
// chatStore.ts — 扩展 workspaceMode
workspaceMode: 'dev' | 'recall' | 'schedule' | 'tasks';

// TaskBoardPanel props — 无 props，从 store 读
// 内部状态：
interface TaskBoardState {
  collapsedSections: Record<string, boolean>; // localStorage 持久化
  composerOpen: boolean;
}
```

---

## Task 1: 扩展 workspaceMode 加入 'tasks'

**Files:**
- Modify: `packages/web/src/stores/chatStore.ts` (lines 639-640, 929-930)
- Test: `packages/web/src/stores/__tests__/chatStore-workspace-mode.test.ts` (new)

**Step 1: Write failing test**

```typescript
test('setWorkspaceMode accepts tasks mode', () => {
  const { setWorkspaceMode } = useChatStore.getState();
  setWorkspaceMode('tasks');
  expect(useChatStore.getState().workspaceMode).toBe('tasks');
  expect(useChatStore.getState().rightPanelMode).toBe('workspace');
});
```

**Step 2: Run test → FAIL** (TypeScript error: 'tasks' not assignable)

**Step 3: Extend the union type**

```typescript
// chatStore.ts line 639
workspaceMode: 'dev' | 'recall' | 'schedule' | 'tasks';
setWorkspaceMode: (mode: 'dev' | 'recall' | 'schedule' | 'tasks') => void;
```

**Step 4: Run test → PASS**

**Step 5: Commit** `feat(F160): extend workspaceMode to include 'tasks'`

---

## Task 2: TaskBoardPanel 骨架 — 四段式布局 + 折叠

**Files:**
- Create: `packages/web/src/components/TaskBoardPanel.tsx`
- Test: `packages/web/src/components/__tests__/task-board-panel.test.ts` (new)

**Step 1: Write failing test — four sections render with correct order**

```typescript
test('renders four status sections in order: doing, blocked, todo, done', () => {
  // seed taskStore with tasks of each status
  // render <TaskBoardPanel />
  // assert section headings exist in correct order
});

test('todo and done sections default to collapsed', () => {
  // seed tasks
  // render
  // assert todo/done task items are not visible
  // assert doing/blocked task items are visible
});
```

**Step 2: Run → FAIL** (component doesn't exist)

**Step 3: Implement TaskBoardPanel skeleton**

Core structure per design:
- Header: "毛线球 · 当前对话任务" + stats badge + `[+ 新任务]` button
- Section: 进行中 (doing) — always expanded
- Section: 阻塞中 (blocked) — always expanded, red highlight bg
- Section: 待办 (todo) — default collapsed
- Section: 已完成 (done) — default collapsed

Each section:
- Status icon + label + count
- Collapsible task list
- Collapse state from `localStorage('taskboard-collapsed')`

Key F056 tokens:
- `bg-cafe-surface` canvas, `bg-cafe-surface-elevated` cards
- `border-cafe rounded-xl` cards, 4px left border for status color
- doing = `text-cafe-crosspost` / `border-l-cafe-crosspost`
- blocked = `text-cafe-accent` / `border-l-cafe-accent` / `bg-red-50 dark:bg-red-950/20`
- todo = `text-cafe-muted`
- done = `text-green-600`

**Step 4: Run → PASS**

**Step 5: Commit** `feat(F160): TaskBoardPanel skeleton with four-section layout`

---

## Task 3: TaskCard 组件 — 展开详情 + 状态切换

**Files:**
- Create: `packages/web/src/components/TaskCard.tsx`
- Test: `packages/web/src/components/__tests__/task-card.test.ts` (new)

**Step 1: Write failing tests**

```typescript
test('renders task title, owner avatar, and status pill', () => { ... });
test('clicking card expands to show why text and created time', () => { ... });
test('clicking status pill cycles status and calls PATCH API', () => { ... });
test('applies blocked highlight background', () => { ... });
```

**Step 2: Run → FAIL**

**Step 3: Implement TaskCard**

Design per spec:
- `bg-cafe-surface-elevated border border-cafe rounded-xl p-3`
- 4px left border in status color
- Title: 14px/500, truncated
- Owner: `<CatAvatar>` 14px + persona color ring
- Status pill: clickable, cycles todo→doing→blocked→done
- Expand: why text 12px/400, createdAt relative time, createdBy
- Hover: `hover:-translate-y-0.5 transition-transform ease-out`

Status pill click → `PATCH /api/tasks/:id { status }` → socket `task_updated` auto-updates store.

**Step 4: Run → PASS**

**Step 5: Commit** `feat(F160): TaskCard with details expand and status toggle`

---

## Task 4: 折叠偏好 localStorage 持久化

**Files:**
- Modify: `packages/web/src/components/TaskBoardPanel.tsx`
- Test: extend `task-board-panel.test.ts`

**Step 1: Write failing test**

```typescript
test('remembers collapsed state in localStorage', () => {
  // render, toggle todo section open
  // unmount, re-render
  // assert todo section is still open
});
```

**Step 2: Run → FAIL**

**Step 3: Implement**

```typescript
const STORAGE_KEY = 'taskboard-collapsed';
const defaultCollapsed = { todo: true, done: true, doing: false, blocked: false };

function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultCollapsed, ...JSON.parse(saved) } : defaultCollapsed;
  });
  const toggle = (section: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };
  return { collapsed, toggle };
}
```

**Step 4: Run → PASS**

**Step 5: Commit** `feat(F160): persist section collapse preference in localStorage`

---

## Task 5: TaskComposer — inline 创建表单

**Files:**
- Create: `packages/web/src/components/TaskComposer.tsx`
- Test: `packages/web/src/components/__tests__/task-composer.test.ts` (new)

**Step 1: Write failing tests**

```typescript
test('renders title and why inputs when open', () => { ... });
test('submits POST /api/tasks with correct payload', () => { ... });
test('closes composer and shows new task after submit', () => { ... });
test('rejects empty title', () => { ... });
```

**Step 2: Run → FAIL**

**Step 3: Implement TaskComposer**

Design per spec:
- Title input (required, max 200)
- Why textarea (optional, max 1000)
- Owner cat selector (dropdown from thread cats, optional)
- 取消 + 创建任务 (primary) buttons
- Submit: `POST /api/tasks { threadId, title, why, createdBy: 'user', ownerCatId }`
- After success: close composer, task appears via socket `task_created`

**Step 4: Run → PASS**

**Step 5: Commit** `feat(F160): TaskComposer inline creation form`

---

## Task 6: 接入 Workspace mode switcher

**Files:**
- Modify: `packages/web/src/components/WorkspacePanel.tsx` (lines 701-761)
- Test: extend existing workspace panel tests or add new

**Step 1: Write failing test**

```typescript
test('workspace mode switcher shows 任务 pill', () => {
  // render WorkspacePanel
  // assert 4 pill buttons: 开发, 记忆, 调度, 任务
});

test('clicking 任务 pill shows TaskBoardPanel', () => {
  // click 任务 pill
  // assert TaskBoardPanel renders
});
```

**Step 2: Run → FAIL**

**Step 3: Add 任务 pill button + conditional render**

In the mode switcher area (line 701-752), add fourth pill:
```tsx
<button onClick={() => setWorkspaceMode('tasks')} className={...}>
  <svg className="w-3 h-3" ...>{/* circle-dot or yarn ball icon */}</svg>
  任务
</button>
```

In the mode routing area (line 755+), add:
```tsx
workspaceMode === 'tasks' ? <TaskBoardPanel /> : ...
```

**Step 4: Run → PASS**

**Step 5: Commit** `feat(F160): wire TaskBoardPanel into Workspace mode switcher`

---

## Task 7: 移除 ThreadSidebar 中的旧 TaskPanel

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` (lines 9, 817)
- Test: existing ThreadSidebar tests (verify no regression)

**Step 1: Write failing test**

```typescript
test('ThreadSidebar does not render TaskPanel (F160 migration)', () => {
  // render ThreadSidebar
  // assert no 🧶 毛线球 text in sidebar
});
```

**Step 2: Run → FAIL** (still renders)

**Step 3: Remove**

- Delete line 9: `import { TaskPanel } from '../TaskPanel';`
- Delete line 817: `<TaskPanel />`

**Step 4: Run all ThreadSidebar tests → PASS, no visual regression**

**Step 5: Commit** `refactor(F160): remove TaskPanel from ThreadSidebar (AC-B6)`

---

## Task 8: 空状态

**Files:**
- Modify: `packages/web/src/components/TaskBoardPanel.tsx`
- Test: extend `task-board-panel.test.ts`

**Step 1: Write failing test**

```typescript
test('shows empty state with guidance when no tasks', () => {
  // clear taskStore
  // render TaskBoardPanel
  // assert "把长期事项挂在线上" text visible
  // assert "创建第一颗毛线球" button visible
});

test('empty state create button opens composer', () => {
  // click "创建第一颗毛线球"
  // assert composer appears
});
```

**Step 2: Run → FAIL**

**Step 3: Implement empty state**

Per design: yarn ball illustration area + "把长期事项挂在线上，不埋回聊天里" headline + guidance text + CTA button + "何时该用毛线球？" help section + "临时步骤继续留给猫猫祟祟" footer.

**Step 4: Run → PASS**

**Step 5: Commit** `feat(F160): TaskBoardPanel empty state with guidance (AC-B2)`

---

## Task 9: F056 设计语言合规 + dark mode

**Files:**
- Modify: `TaskBoardPanel.tsx`, `TaskCard.tsx`, `TaskComposer.tsx`

**Step 1: Visual audit against design file**

- Screenshot each state in light + dark mode
- Check: semantic tokens (no hardcoded colors), 8px grid spacing, rounded-xl, cafe surface hierarchy
- Fix: old `TaskPanel` used hardcoded `text-blue-500`/`text-red-400` → replace with `text-cafe-crosspost`/`text-cafe-accent`

**Step 2: Commit** `style(F160): F056 design language compliance pass`

---

## Task 10: 端到端验证 + 清理

**Step 1:** Start dev server, open browser
**Step 2:** Verify golden path:
- Open Workspace → click 任务 pill → see empty state
- Click "创建第一颗毛线球" → fill title/why → submit → task appears in 待办
- Click status pill → cycles to doing → moves to 进行中 section
- Collapse/expand sections → refresh → collapse state persists
- Check dark mode
- Check ThreadSidebar → no TaskPanel (AC-B6)

**Step 3:** Delete old `TaskPanel.tsx` if fully replaced

**Step 4:** Commit `chore(F160): remove deprecated TaskPanel component`

---

## AC Coverage Map

| AC | Tasks |
|----|-------|
| AC-B1: Workspace Tab | T1 (mode), T6 (switcher), T7 (remove sidebar) |
| AC-B2: 四段式布局 | T2 (sections), T4 (collapse persist), T8 (empty) |
| AC-B3: 创建入口 | T5 (composer) |
| AC-B4: 详情展开 + 状态切换 | T3 (TaskCard) |
| AC-B5: F056 | T9 (audit) |
| AC-B6: 无回归 | T7 (remove), T10 (e2e) |

## Estimated Commit Count: ~10
