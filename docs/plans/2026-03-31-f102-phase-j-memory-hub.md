---
feature_ids: [F102]
doc_kind: plan
created: 2026-03-31
---

# F102 Phase J: Memory Hub — Implementation Plan

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 记忆系统从隐形变为人猫共用的知识中枢——铲屎官能主动探索知识库，也能在猫使用记忆时实时看到检索过程
**Acceptance Criteria:**
- AC-J1: `/memory` 独立路由页面存在，左侧 sidebar 底部有 SVG 按钮（训练营→Memory→IM Hub 顺序），支持 `?from=threadId` 返回链路
- AC-J2: `/memory` 页面包含人类可用的搜索栏，支持 mode/scope/depth 参数调节
- AC-J3: Knowledge Feed（Phase H）从 Workspace 知识模式迁移到 `/memory` Tab 1
- AC-J4: `/memory` Tab 3 展示索引状态（docs/threads/passages 数量、最近 rebuild 时间、TTL 配置、embedding mode）
- AC-J5: Workspace Recall Feed——猫调 `search_evidence` 时，右侧面板实时展示 query + results + scores
- AC-J6: Recall Feed 不需要猫做额外工作——invocation 层自动拦截 tool_use 事件并推送前端
- AC-J7: Hub Group 3（监控与治理）有 Memory 状态 tab，含索引速览 + "打开 Memory" 跳转按钮
- AC-J8: Workspace 原"知识"模式更名为"记忆" / "Recall"，承载 Recall Feed 而非完整 Knowledge Feed

**Architecture:** `/memory` 独立路由（参照 `/signals` 模式）+ Workspace Recall Feed（拦截 search_evidence ToolEvent）。前端 only —— 后端 API 已在 Phase D/H/F-4 全部就位（`/api/evidence/search`、`/api/evidence/status`、`/api/knowledge/feed`）。

**Tech Stack:** Next.js App Router, React, Tailwind CSS, zustand (chatStore), SWR/fetch, existing Socket.IO event stream

**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测全部 AC

**NOT building:**
- 后端 API 改动（全部已有）
- IMaterializationService（Approve = 标 approved，不自动写 docs/）
- 项目切换器（Phase F 范围）
- Knowledge Feed 功能改动（原样迁移）

---

## Terminal Schema

```typescript
// 新增文件清单
// packages/web/src/app/memory/page.tsx              — 路由入口
// packages/web/src/components/memory/MemoryHub.tsx   — 主容器（3 tabs）
// packages/web/src/components/memory/MemoryNav.tsx   — 导航栏（Back to Chat + tabs）
// packages/web/src/components/memory/EvidenceSearch.tsx  — Tab 2: 搜索
// packages/web/src/components/memory/IndexStatus.tsx     — Tab 3: 索引状态
// packages/web/src/components/memory/RecallFeed.tsx      — Workspace Recall Feed
// packages/web/src/components/icons/MemoryIcon.tsx       — SVG 图标
// packages/web/src/hooks/useRecallEvents.ts              — 收集 search_evidence ToolEvents

// 修改文件清单
// packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx  — 加 Memory 按钮
// packages/web/src/components/WorkspacePanel.tsx               — 知识→记忆，路由 RecallFeed
// packages/web/src/stores/chatStore.ts                         — workspaceMode 类型
// packages/web/src/components/CatCafeHub.tsx                   — Hub Group 3 加 Memory tab
// packages/web/src/components/cat-cafe-hub.navigation.tsx      — 导航配置

// 已有后端 API（不改）
// GET  /api/evidence/search   — query, mode, scope, depth, limit
// GET  /api/evidence/status   — docs_count, edges_count, last_rebuild_at
// GET  /api/knowledge/feed    — needsReview, settled, rejected, stats
// POST /api/knowledge/approve — markerId
// POST /api/knowledge/reject  — markerId
// POST /api/knowledge/undo    — markerId
```

---

## Task 1: Route + MemoryNav（AC-J1 路由部分）

**Files:**
- Create: `packages/web/src/app/memory/page.tsx`
- Create: `packages/web/src/components/memory/MemoryNav.tsx`
- Create: `packages/web/src/components/memory/MemoryHub.tsx`

### Step 1: Write failing test — MemoryNav renders Back to Chat link

```typescript
// packages/web/src/__tests__/memory-nav.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryNav } from '@/components/memory/MemoryNav';

// mock next/link
jest.mock('next/link', () => ({ children, href, ...props }: any) =>
  <a href={href} {...props}>{children}</a>);

test('MemoryNav renders back link and 3 tabs', () => {
  // simulate ?from=thread_abc
  Object.defineProperty(window, 'location', {
    value: { search: '?from=thread_abc' }, writable: true
  });
  render(<MemoryNav active="feed" />);
  expect(screen.getByText('返回对话')).toHaveAttribute('href', '/thread/thread_abc');
  expect(screen.getByText('Knowledge Feed')).toBeInTheDocument();
  expect(screen.getByText('Search')).toBeInTheDocument();
  expect(screen.getByText('Index Status')).toBeInTheDocument();
});
```

**Run:** `pnpm --filter @cat-cafe/web test -- --testPathPattern=memory-nav`
**Expected:** FAIL — module not found

### Step 2: Implement MemoryNav

```typescript
// packages/web/src/components/memory/MemoryNav.tsx
// Pattern: copy SignalNav.tsx, adapt tabs to 'feed' | 'search' | 'status'
// - useReferrerThread() hook (same as SignalNav L22-31)
// - Back to Chat link with ?from= support
// - 3 tab buttons: Knowledge Feed, Search, Index Status
// - Styling matches SignalNav: border-[#D8C6AD] bg-[#FCF7EE] text-[#8B6F47]
```

### Step 3: Implement MemoryHub shell

```typescript
// packages/web/src/components/memory/MemoryHub.tsx
// - State: activeTab: 'feed' | 'search' | 'status'
// - Renders MemoryNav + tab content area
// - Tab 1: <KnowledgeFeed /> (existing, import from workspace/)
// - Tab 2: <EvidenceSearch /> (Task 4)
// - Tab 3: <IndexStatus /> (Task 5)
// - Placeholder divs for Tab 2/3 initially
```

### Step 4: Create route page

```typescript
// packages/web/src/app/memory/page.tsx
import { MemoryHub } from '@/components/memory/MemoryHub';
export default function MemoryPage() { return <MemoryHub />; }
```

### Step 5: Run test to verify pass

**Run:** `pnpm --filter @cat-cafe/web test -- --testPathPattern=memory-nav`
**Expected:** PASS

### Step 6: Commit

```bash
git add packages/web/src/app/memory/ packages/web/src/components/memory/ packages/web/src/__tests__/memory-nav.test.tsx
git commit -m "feat(F102-J): /memory route + MemoryNav + MemoryHub shell (AC-J1 partial)"
```

---

## Task 2: Sidebar Memory Button（AC-J1 完成）

**Files:**
- Create: `packages/web/src/components/icons/MemoryIcon.tsx`
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx:467-488`

### Step 1: Write failing test — Memory button exists in sidebar

```typescript
// packages/web/src/__tests__/sidebar-memory-button.test.tsx
test('sidebar renders Memory button between Bootcamp and Hub', () => {
  // render ThreadSidebar with required props
  const { container } = render(<ThreadSidebar ... />);
  const memBtn = screen.getByTestId('sidebar-memory');
  expect(memBtn).toBeInTheDocument();
  // verify order: bootcamp → memory → hub
  const buttons = container.querySelectorAll('[data-testid^="sidebar-"]');
  const ids = Array.from(buttons).map(b => b.getAttribute('data-testid'));
  expect(ids.indexOf('sidebar-memory')).toBeGreaterThan(ids.indexOf('sidebar-bootcamp'));
  expect(ids.indexOf('sidebar-memory')).toBeLessThan(ids.indexOf('sidebar-hub'));
});
```

**Expected:** FAIL — sidebar-memory not found

### Step 2: Create MemoryIcon SVG

```typescript
// packages/web/src/components/icons/MemoryIcon.tsx
// SVG brain/database icon, style: className prop, stroke-based like BootcampIcon
// viewBox="0 0 16 16", strokeWidth 1.5, fill="none" stroke="currentColor"
```

### Step 3: Add Memory button to ThreadSidebar

Insert between Bootcamp button (L477) and Hub button (L478):

```tsx
// After bootcamp button, before {onHubClick && (...)}
<button
  type="button"
  onClick={() => {
    const fromParam = currentThreadId ? `?from=${encodeURIComponent(currentThreadId)}` : '';
    router.push(`/memory${fromParam}`);
    if (typeof window !== 'undefined' && window.innerWidth < 768) onClose?.();
  }}
  className="text-xs px-2 py-1 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
  title="Memory Hub"
  data-testid="sidebar-memory"
>
  <MemoryIcon className="w-3.5 h-3.5 inline-block -mt-0.5" />
</button>
```

### Step 4: Run test to verify pass + manual browser check

**Run:** `pnpm --filter @cat-cafe/web test -- --testPathPattern=sidebar-memory`
**Expected:** PASS

### Step 5: Commit

```bash
git add packages/web/src/components/icons/MemoryIcon.tsx packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx packages/web/src/__tests__/sidebar-memory-button.test.tsx
git commit -m "feat(F102-J): sidebar Memory button with SVG icon (AC-J1)"
```

---

## Task 3: Knowledge Feed Migration（AC-J3）

**Files:**
- Modify: `packages/web/src/components/memory/MemoryHub.tsx`

### Step 1: Write failing test — Tab 1 renders KnowledgeFeed

```typescript
// packages/web/src/__tests__/memory-hub-feed-tab.test.tsx
test('MemoryHub Tab 1 renders KnowledgeFeed component', () => {
  render(<MemoryHub />);
  // KnowledgeFeed renders "待确认" tab label
  expect(screen.getByText('待确认')).toBeInTheDocument();
});
```

**Expected:** FAIL — KnowledgeFeed not mounted yet (placeholder)

### Step 2: Import and mount KnowledgeFeed in Tab 1

```tsx
// In MemoryHub.tsx, replace placeholder with:
import { KnowledgeFeed } from '@/components/workspace/KnowledgeFeed';
// ...
{activeTab === 'feed' && <KnowledgeFeed />}
```

### Step 3: Run test

**Run:** `pnpm --filter @cat-cafe/web test -- --testPathPattern=memory-hub-feed`
**Expected:** PASS

### Step 4: Commit

```bash
git commit -am "feat(F102-J): mount KnowledgeFeed in /memory Tab 1 (AC-J3)"
```

---

## Task 4: Evidence Search Tab（AC-J2）

**Files:**
- Create: `packages/web/src/components/memory/EvidenceSearch.tsx`
- Modify: `packages/web/src/components/memory/MemoryHub.tsx`

### Step 1: Write failing test — search form and mode selector

```typescript
// packages/web/src/__tests__/evidence-search.test.tsx
test('EvidenceSearch has search input and mode selector', () => {
  render(<EvidenceSearch />);
  expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  expect(screen.getByText('hybrid')).toBeInTheDocument(); // default mode chip
});

test('EvidenceSearch fetches and displays results', async () => {
  // mock /api/evidence/search
  fetchMock.mockResponseOnce(JSON.stringify({
    results: [{
      title: 'ADR-005', anchor: 'adr-005',
      snippet: 'Local-first memory', confidence: 'high',
      sourceType: 'decision'
    }],
    degraded: false
  }));
  render(<EvidenceSearch />);
  await userEvent.type(screen.getByPlaceholderText(/search/i), 'memory{enter}');
  await waitFor(() => expect(screen.getByText('ADR-005')).toBeInTheDocument());
});
```

**Expected:** FAIL — module not found

### Step 2: Implement EvidenceSearch

```tsx
// packages/web/src/components/memory/EvidenceSearch.tsx
// - Search form: text input + mode selector (lexical/semantic/hybrid) + scope chips
// - On submit: GET /api/evidence/search?q=...&mode=...&scope=...
// - Result cards: title, snippet, confidence badge, sourceType badge
// - Empty state: "输入关键词搜索知识库"
// - Error state: degraded badge when results.degraded
// API response type: EvidenceSearchResponse from evidence.ts
```

### Step 3: Mount in MemoryHub Tab 2

```tsx
{activeTab === 'search' && <EvidenceSearch />}
```

### Step 4: Run tests

**Run:** `pnpm --filter @cat-cafe/web test -- --testPathPattern=evidence-search`
**Expected:** PASS

### Step 5: Commit

```bash
git commit -am "feat(F102-J): Evidence Search tab with mode/scope selectors (AC-J2)"
```

---

## Task 5: Index Status Tab（AC-J4）

**Files:**
- Create: `packages/web/src/components/memory/IndexStatus.tsx`
- Modify: `packages/web/src/components/memory/MemoryHub.tsx`

### Step 1: Write failing test

```typescript
// packages/web/src/__tests__/index-status.test.tsx
test('IndexStatus fetches and displays doc count', async () => {
  fetchMock.mockResponseOnce(JSON.stringify({
    backend: 'sqlite', healthy: true,
    docs_count: 427, edges_count: 1203, last_rebuild_at: '2026-03-31T08:00:00Z'
  }));
  render(<IndexStatus />);
  await waitFor(() => expect(screen.getByText('427')).toBeInTheDocument());
  expect(screen.getByText(/sqlite/i)).toBeInTheDocument();
});
```

**Expected:** FAIL

### Step 2: Implement IndexStatus

```tsx
// packages/web/src/components/memory/IndexStatus.tsx
// - Fetch GET /api/evidence/status on mount
// - Metric cards: Documents count, Edges count, Last Rebuild
// - Health indicator: green dot if healthy, red if not
// - Backend badge: "SQLite"
// - Styling: metric cards use cafe-surface bg, cocreator-primary for numbers
```

### Step 3: Mount in MemoryHub Tab 3

```tsx
{activeTab === 'status' && <IndexStatus />}
```

### Step 4: Run tests + Commit

**Run:** `pnpm --filter @cat-cafe/web test -- --testPathPattern=index-status`

```bash
git commit -am "feat(F102-J): Index Status tab with health dashboard (AC-J4)"
```

---

## Task 6: Recall Feed + Workspace Mode Update（AC-J5, AC-J6, AC-J8）

**Files:**
- Create: `packages/web/src/components/memory/RecallFeed.tsx`
- Create: `packages/web/src/hooks/useRecallEvents.ts`
- Modify: `packages/web/src/stores/chatStore.ts:605-606` — 类型扩展
- Modify: `packages/web/src/components/WorkspacePanel.tsx:660-704` — 模式切换 + 路由

### Step 1: Write failing test — useRecallEvents extracts search_evidence events

```typescript
// packages/web/src/__tests__/use-recall-events.test.ts
test('useRecallEvents filters search_evidence from toolEvents', () => {
  const events: ToolEvent[] = [
    { id: '1', type: 'tool_use', label: 'opus → cat_cafe_search_evidence', detail: '{"query":"Redis pitfall"}', timestamp: Date.now() },
    { id: '2', type: 'tool_use', label: 'opus → Read', detail: '{"file_path":"/foo"}', timestamp: Date.now() },
    { id: '3', type: 'tool_result', label: 'opus → cat_cafe_search_evidence', detail: '{"results":[...]}', timestamp: Date.now() },
  ];
  const recalls = filterRecallEvents(events);
  expect(recalls).toHaveLength(2); // tool_use + tool_result for search_evidence
  expect(recalls[0].query).toBe('Redis pitfall');
});
```

**Expected:** FAIL

### Step 2: Implement useRecallEvents hook

```typescript
// packages/web/src/hooks/useRecallEvents.ts
// - filterRecallEvents(toolEvents: ToolEvent[]): RecallEvent[]
// - Matches labels containing 'search_evidence'
// - Parses detail JSON to extract query, mode, scope
// - Pairs tool_use with tool_result by id prefix
// - Returns: { id, query, mode?, scope?, results?, scores?, timestamp }
//
// - useRecallEvents() hook:
//   reads current thread's messages from chatStore
//   collects toolEvents from streaming/active messages
//   returns RecallEvent[] for the current invocation
```

### Step 3: Implement RecallFeed component

```tsx
// packages/web/src/components/memory/RecallFeed.tsx
// - Header: "Recall Feed" + LIVE badge (green dot + text)
// - Maps RecallEvent[] to cards:
//   - Query section: search icon + query text + mode/scope chips
//   - Results: collapsible list (▸ collapsed / ▾ expanded)
//     - Each result: kind badge + title + RRF score
//     - Expanded: full snippet + source file link
//   - "Show N more" if > 3 results
// - Empty state: "猫猫还没搜索记忆" with brain icon
// - Auto-scrolls when new events arrive
```

### Step 4: Update chatStore type

```typescript
// packages/web/src/stores/chatStore.ts L605-606
// Change:
//   workspaceMode: 'dev' | 'knowledge' | 'schedule';
// To:
//   workspaceMode: 'dev' | 'recall' | 'schedule';
// (knowledge → recall, since KnowledgeFeed moved to /memory)
```

### Step 5: Update WorkspacePanel mode switcher

```tsx
// packages/web/src/components/WorkspacePanel.tsx
// L672-681: Change "知识" button to "记忆", route to 'recall' mode
// L700-701: Change KnowledgeFeed → RecallFeed
//   workspaceMode === 'recall' ? <RecallFeed /> : ...
// Keep import of RecallFeed, remove KnowledgeFeed import from this file
```

### Step 6: Run tests

**Run:** `pnpm --filter @cat-cafe/web test -- --testPathPattern=recall`
**Expected:** PASS

### Step 7: Commit

```bash
git commit -am "feat(F102-J): Recall Feed + workspace mode knowledge→recall (AC-J5, AC-J6, AC-J8)"
```

---

## Task 7: Hub Memory Status Tab（AC-J7）

**Files:**
- Modify: `packages/web/src/components/cat-cafe-hub.navigation.tsx` — 加 tab 配置
- Modify: `packages/web/src/components/CatCafeHub.tsx` — 加 tab 渲染

### Step 1: Write failing test

```typescript
// packages/web/src/__tests__/hub-memory-tab.test.tsx
test('Hub Group 3 has Memory Status tab', () => {
  render(<CatCafeHub />);
  // expand Group 3 (监控与治理)
  fireEvent.click(screen.getByText('监控与治理'));
  expect(screen.getByText('记忆状态')).toBeInTheDocument();
});
```

**Expected:** FAIL

### Step 2: Add "记忆状态" tab to Hub navigation config

```typescript
// In cat-cafe-hub.navigation.tsx, Group 3 array, add:
{ id: 'memory-status', label: '记忆状态', icon: '🧠' }
// (或 SVG icon，和 sidebar 一致)
```

### Step 3: Add tab content in CatCafeHub

```tsx
// Lightweight content: fetch /api/evidence/status → show counts + health
// + "打开 Memory Hub" button → router.push('/memory')
// Reuse IndexStatus component or inline a minimal version
```

### Step 4: Run test + Commit

```bash
git commit -am "feat(F102-J): Hub Group 3 Memory Status tab (AC-J7)"
```

---

## Task 8: Integration Test + Quality Gate

### Step 1: Run full test suite

**Run:** `pnpm --filter @cat-cafe/web test`
**Expected:** All pass, no regressions

### Step 2: Type check

**Run:** `pnpm lint`
**Expected:** 0 errors

### Step 3: Biome format check

**Run:** `pnpm check`
**Expected:** 0 errors

### Step 4: Manual browser verification

1. Sidebar: 3 buttons visible (训练营 → Memory → IM Hub)
2. Click Memory → navigates to `/memory?from=threadId`
3. `/memory` page: 3 tabs work, KnowledgeFeed shows data, Search returns results, Status shows metrics
4. Back to Chat → returns to correct thread
5. Workspace: "记忆" mode shows Recall Feed
6. When cat searches evidence, Recall Feed shows events in real-time
7. Hub → 监控与治理 → 记忆状态 tab → "打开 Memory Hub" button works

### Step 5: Final commit + quality-gate skill

```bash
git commit -am "test(F102-J): integration tests for Memory Hub"
```

Then load `quality-gate` skill for self-check before requesting review.

---

## AC Coverage Matrix

| AC | Task | Verification |
|----|------|-------------|
| AC-J1 | Task 1 + 2 | Route exists + sidebar button + ?from= |
| AC-J2 | Task 4 | Search tab with mode/scope/depth |
| AC-J3 | Task 3 | KnowledgeFeed renders in /memory Tab 1 |
| AC-J4 | Task 5 | Index Status tab with metrics |
| AC-J5 | Task 6 | Recall Feed shows search_evidence events |
| AC-J6 | Task 6 | ToolEvent interception, no cat-side work |
| AC-J7 | Task 7 | Hub Group 3 has Memory tab |
| AC-J8 | Task 6 | Workspace "知识"→"记忆", RecallFeed replaces KnowledgeFeed |
