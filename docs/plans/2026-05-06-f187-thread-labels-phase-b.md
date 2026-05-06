---
feature_ids: [F187]
doc_kind: plan
created: 2026-05-06
---

# F187 Thread Labels Phase B — Sidebar 筛选 + 智能视图

**Feature:** F187 — `docs/features/F187-thread-labels.md`
**Goal:** 让用户通过标签筛选 sidebar thread 列表，减少信息噪声
**Acceptance Criteria:**
- AC-B1: Sidebar 有标签筛选器，点击标签后只显示该标签的 thread
- AC-B2: "未分类"视图显示所有无标签 thread
- AC-B3: Thread 条目上有标签色点指示 ← **已在 Phase A 实现（commit 9bfa33169）**
**Architecture:** 纯前端改动。在 ThreadSidebar 搜索框下方加 LabelFilterBar 组件，单选标签筛选 + "未分类"特殊视图。筛选逻辑链在已有 search filter 之后。V1 单选，不做 AND 组合。
**Tech Stack:** React, Zustand (label-store), Tailwind CSS
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

**What we're NOT building:**
- 组合筛选（AND 多标签）— spec 明确说留后续
- 后端筛选 API — 当前 thread 数量级（< 200）纯前端过滤足够
- 标签排序/重排 UI — Phase A 已有 sortOrder 字段，管理 UI 不在本 Phase scope

---

## Terminal Schema

```typescript
// Filter state — local to ThreadSidebar (ephemeral UI state, not persisted)
type LabelFilter = string | '__uncategorized__' | null;
// string = label ID → show only threads with this label
// '__uncategorized__' = show threads with no labels
// null = show all (no filter active)

// LabelFilterBar component props
interface LabelFilterBarProps {
  labels: ThreadLabel[];
  selectedFilter: LabelFilter;
  onSelect: (filter: LabelFilter) => void;
  uncategorizedCount: number;
}
```

## Straight-Line Check

| Step | Stays in final? | Demovable after? | Cost to skip? |
|------|----------------|-----------------|---------------|
| Task 1: LabelFilterBar component | Yes | Visual: chips render | No filter UI at all |
| Task 2: Filter state + logic in ThreadSidebar | Yes | Click chip → list filters | Feature doesn't work |
| Task 3: Overflow dropdown for 6+ labels | Yes | 10 labels → only 5 shown + "..." | Spec violation (溢出策略) |

---

## Task 1: LabelFilterBar Component

**Files:**
- Create: `packages/web/src/components/ThreadSidebar/LabelFilterBar.tsx`

**Step 1: Create LabelFilterBar**

```tsx
'use client';

import { type ThreadLabel } from '@/stores/label-store';
import { useState } from 'react';

const MAX_INLINE = 5;

interface LabelFilterBarProps {
  labels: ThreadLabel[];
  selectedFilter: string | null;
  onSelect: (filter: string | null) => void;
  uncategorizedCount: number;
}

export function LabelFilterBar({ labels, selectedFilter, onSelect, uncategorizedCount }: LabelFilterBarProps) {
  const [showOverflow, setShowOverflow] = useState(false);
  const inlineLabels = labels.slice(0, MAX_INLINE);
  const overflowLabels = labels.slice(MAX_INLINE);

  const handleClick = (filter: string | null) => {
    onSelect(selectedFilter === filter ? null : filter);
  };

  if (labels.length === 0 && uncategorizedCount === 0) return null;

  return (
    <div className="px-3 py-1.5 flex items-center gap-1 flex-wrap border-b border-cafe-subtle">
      {/* Uncategorized pill */}
      {uncategorizedCount > 0 && (
        <button
          type="button"
          onClick={() => handleClick('__uncategorized__')}
          className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
            selectedFilter === '__uncategorized__'
              ? 'border-cafe-muted bg-cafe-surface-elevated text-cafe-black'
              : 'border-transparent text-cafe-muted hover:text-cafe-secondary'
          }`}
        >
          未分类 ({uncategorizedCount})
        </button>
      )}
      {/* Inline label chips */}
      {inlineLabels.map((label) => (
        <button
          key={label.id}
          type="button"
          onClick={() => handleClick(label.id)}
          className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
            selectedFilter === label.id
              ? 'border-cafe-muted bg-cafe-surface-elevated text-cafe-black'
              : 'border-transparent text-cafe-muted hover:text-cafe-secondary'
          }`}
          title={label.name}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
          <span className="truncate max-w-[60px]">{label.name}</span>
        </button>
      ))}
      {/* Overflow "..." button */}
      {overflowLabels.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowOverflow(!showOverflow)}
            className="text-[10px] px-1 py-0.5 text-cafe-muted hover:text-cafe-secondary"
          >
            ...
          </button>
          {showOverflow && (
            <div className="absolute top-full left-0 mt-1 bg-cafe-surface rounded-lg shadow-lg border border-cafe z-50 py-1 min-w-[120px]">
              {overflowLabels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => {
                    handleClick(label.id);
                    setShowOverflow(false);
                  }}
                  className={`w-full text-left text-[10px] px-2 py-1 flex items-center gap-1.5 hover:bg-cafe-surface-elevated ${
                    selectedFilter === label.id ? 'text-cafe-black font-medium' : 'text-cafe-muted'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                  <span className="truncate">{label.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Clear filter indicator */}
      {selectedFilter && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-[10px] px-1 py-0.5 text-red-400 hover:text-red-500 ml-auto"
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/web/src/components/ThreadSidebar/LabelFilterBar.tsx
git commit -m "feat(F187): LabelFilterBar component — inline chips + overflow + uncategorized"
```

---

## Task 2: Wire Filter State + Logic into ThreadSidebar

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx`

**Step 1: Add filter state and label-filtered thread list**

After `const [searchQuery, setSearchQuery] = useState('');` (line ~59), add:

```typescript
const [labelFilter, setLabelFilter] = useState<string | null>(null);
```

Import LabelFilterBar at top:
```typescript
import { LabelFilterBar } from './LabelFilterBar';
```

After `filteredThreads` useMemo (line ~447-461), add a new `labelFilteredThreads` memo:

```typescript
const labelFilteredThreads = useMemo(() => {
  if (!labelFilter) return filteredThreads;
  if (labelFilter === '__uncategorized__') {
    return filteredThreads.filter((t) => !t.labels || t.labels.length === 0);
  }
  return filteredThreads.filter((t) => t.labels?.includes(labelFilter));
}, [filteredThreads, labelFilter]);

const uncategorizedCount = useMemo(
  () => liveThreads.filter((t) => !t.labels || t.labels.length === 0).length,
  [liveThreads],
);
```

Replace `filteredThreads` → `labelFilteredThreads` in the `threadGroups` useMemo input.

**Step 2: Render LabelFilterBar in JSX**

Below the search input section, above the scroll container, insert:

```tsx
<LabelFilterBar
  labels={labels}
  selectedFilter={labelFilter}
  onSelect={setLabelFilter}
  uncategorizedCount={uncategorizedCount}
/>
```

Get `labels` from the existing `useLabelStore`:
```typescript
const { labels } = useLabelStore();
```

(Note: `useLabelStore` is already imported and `fetchLabels` is called on mount — line 143)

**Step 3: Verify and commit**

```bash
pnpm --filter @cat-cafe/web run lint
git add packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx
git commit -m "feat(F187): wire label filter into ThreadSidebar — single-select + uncategorized"
```

---

## Task 3: Close Outside Click for Overflow Dropdown

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/LabelFilterBar.tsx`

**Step 1: Add useEffect for click-outside**

```typescript
import { useEffect, useRef, useState } from 'react';

// Inside component:
const overflowRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!showOverflow) return;
  const handler = (e: MouseEvent) => {
    if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
      setShowOverflow(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [showOverflow]);
```

Wrap the overflow `<div className="relative">` with `ref={overflowRef}`.

**Step 2: Commit**

```bash
git add packages/web/src/components/ThreadSidebar/LabelFilterBar.tsx
git commit -m "fix(F187): close overflow dropdown on outside click"
```

---

## Task 4: Build + Lint + Type Check

**Step 1: Run full verification**

```bash
pnpm --filter @cat-cafe/web run lint
pnpm biome check packages/web/src/components/ThreadSidebar/LabelFilterBar.tsx packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx
pnpm -r --if-present run build
```

**Step 2: Fix any issues, final commit if needed**

---

## Verification Checklist

| AC | How to verify |
|----|---------------|
| AC-B1 | Click a label chip → only threads with that label shown; click again → filter cleared |
| AC-B2 | Click "未分类" → only threads without any labels shown |
| AC-B3 | Already done in Phase A — label color dots visible on thread items |
| Overflow | Create 6+ labels → first 5 inline, rest in "..." dropdown |
| Clear | "✕" button clears active filter |
| Search + filter | Both work together (search narrows first, then label filter applies) |
