---
feature_ids: [F187]
doc_kind: plan
created: 2026-05-07
---

# F187 Thread Labels Phase C — 猫猫辅助分类 Implementation Plan

**Feature:** F187 — `docs/features/F187-thread-labels.md`
**Goal:** 让用户一键触发猫猫分类建议，在浮层面板中批量给未分类 thread 打标签
**Acceptance Criteria:**
- AC-C1: sidebar "未分类" pill 旁有 ✨ 按钮，点击触发分类流程
- AC-C2: 猫猫基于 thread 元数据建议标签，用浮层面板展示建议卡片（不写入 thread 消息流）
- AC-C3: 用户可在面板中逐条确认/修改建议后批量应用标签
**Architecture:** ✨ 按钮打开 ThreadOrganizerModal 浮层 → 从 store 读取未分类 thread + 已有 labels → 客户端建议引擎匹配标签 → 用户确认后批量 PATCH 应用
**Tech Stack:** React, Zustand (useChatStore, useLabelStore), existing label PATCH API
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Straight-Line Check

**Finish line:** 用户点 ✨ → 浮层面板显示未分类 thread 带建议标签 → 确认 → 标签已应用、sidebar 已更新。

**What we're NOT building:**
- 不引入 FunctionRun 数据模型
- 不写入 thread 消息流（纯前端浮层）
- 不新建 API 端点（V1 用客户端建议引擎 + 已有 PATCH API）
- 不做 LLM 调用（V1 用关键词匹配，V2 可接 LLM）

**Tradeoff:** AC-C2 说"猫猫建议"，V1 用客户端关键词匹配引擎（基于 thread title ↔ label name），不涉及真正的猫猫 AI 分析。真正的 AI 建议需要 sideband 通信机制（cat 处理但不写消息），留 V2。V1 的建议已足够覆盖"feature ID 匹配 + 关键词匹配"这两个最常见场景。

## Terminal Schema

```typescript
// 建议引擎输入/输出
interface LabelSuggestion {
  threadId: string;
  suggestedLabelIds: string[];
}

// Modal 状态
interface OrganizerState {
  threads: Thread[];           // 未分类 threads（from store）
  labels: ThreadLabel[];       // 可用标签（from store）
  selections: Map<string, string[]>;  // threadId → selected labelIds
  applying: boolean;
}
```

---

### Task 1: 建议引擎（纯函数）

**Files:**
- Create: `packages/web/src/utils/label-suggest.ts`
- Test: `packages/web/src/utils/__tests__/label-suggest.test.ts`

**Step 1: Write failing test**

```typescript
// label-suggest.test.ts
import { describe, it, expect } from 'vitest';
import { suggestLabels } from '../label-suggest';

describe('suggestLabels', () => {
  const labels = [
    { id: 'l1', name: '开发', color: '#FF0000', sortOrder: 0, createdBy: 'u1', createdAt: 0 },
    { id: 'l2', name: '设计', color: '#00FF00', sortOrder: 1, createdBy: 'u1', createdAt: 0 },
    { id: 'l3', name: '运维', color: '#0000FF', sortOrder: 2, createdBy: 'u1', createdAt: 0 },
  ];

  it('matches label name substring in thread title', () => {
    const result = suggestLabels({ title: 'F187 开发计划', labels });
    expect(result).toEqual(['l1']);
  });

  it('returns empty for no match', () => {
    const result = suggestLabels({ title: '闲聊', labels });
    expect(result).toEqual([]);
  });

  it('handles null title', () => {
    const result = suggestLabels({ title: null, labels });
    expect(result).toEqual([]);
  });

  it('matches multiple labels', () => {
    const result = suggestLabels({ title: '开发和设计讨论', labels });
    expect(result).toEqual(['l1', 'l2']);
  });
});
```

**Step 2: Run test to verify red**

```bash
pnpm --filter @cat-cafe/web test -- src/utils/__tests__/label-suggest.test.ts
```

**Step 3: Implement**

```typescript
// label-suggest.ts
import type { ThreadLabel } from '@/stores/label-store';

interface SuggestInput {
  title: string | null;
  labels: ThreadLabel[];
}

export function suggestLabels({ title, labels }: SuggestInput): string[] {
  if (!title) return [];
  const titleLower = title.toLowerCase();
  return labels
    .filter((l) => titleLower.includes(l.name.toLowerCase()))
    .map((l) => l.id);
}
```

**Step 4: Run test to verify green**

**Step 5: Commit**

```bash
git add packages/web/src/utils/label-suggest.ts packages/web/src/utils/__tests__/label-suggest.test.ts
git commit -m "feat(F187): label suggestion engine — keyword matching"
```

---

### Task 2: ThreadOrganizerModal 组件

**Files:**
- Create: `packages/web/src/components/ThreadSidebar/ThreadOrganizerModal.tsx`

**Step 1: Create the modal component**

Props:
```typescript
interface ThreadOrganizerModalProps {
  open: boolean;
  onClose: () => void;
  threads: Thread[];           // uncategorized threads
  labels: ThreadLabel[];
  onApply: (assignments: Map<string, string[]>) => Promise<void>;
}
```

UI structure:
- Overlay backdrop + centered modal panel
- Header: "整理未分类 Thread" + close button
- "全部建议" button → runs `suggestLabels` for all threads
- Thread list: each row = thread title + label multi-select chips
- Footer: "批量应用 (N)" button + "取消"

**Step 2: Run full test suite to verify no regression**

```bash
pnpm --filter @cat-cafe/web test
```

**Step 3: Commit**

```bash
git add packages/web/src/components/ThreadSidebar/ThreadOrganizerModal.tsx
git commit -m "feat(F187): ThreadOrganizerModal — bulk label assignment panel"
```

---

### Task 3: ✨ 按钮 in LabelFilterBar

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/LabelFilterBar.tsx:8-13,36-52`

**Step 1: Add `onOrganize` prop and ✨ button**

Add to `LabelFilterBarProps`:
```typescript
onOrganize?: () => void;
```

Insert ✨ button after the uncategorized pill (line 51), only visible when `uncategorizedCount > 0`:
```tsx
{uncategorizedCount > 0 && onOrganize && (
  <button
    type="button"
    onClick={onOrganize}
    className="text-[10px] px-1 py-0.5 text-cafe-muted hover:text-amber-500 transition-colors"
    title="猫猫帮你分类"
  >
    ✨
  </button>
)}
```

**Step 2: Run full test suite**

**Step 3: Commit**

```bash
git add packages/web/src/components/ThreadSidebar/LabelFilterBar.tsx
git commit -m "feat(F187): add sparkle button to LabelFilterBar for organize trigger"
```

---

### Task 4: Wire up in ThreadSidebar

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx`

**Step 1: Add organizer modal state + handler**

```typescript
const [showOrganizer, setShowOrganizer] = useState(false);

const uncategorizedThreads = useMemo(
  () => liveThreads.filter((t) => !t.labels || t.labels.length === 0),
  [liveThreads],
);

const handleBatchApplyLabels = useCallback(async (assignments: Map<string, string[]>) => {
  const updateLabels = useChatStore.getState().updateThreadLabels;
  await Promise.all(
    Array.from(assignments.entries()).map(([threadId, labelIds]) =>
      updateLabels(threadId, labelIds),
    ),
  );
  setShowOrganizer(false);
}, []);
```

**Step 2: Pass `onOrganize` to LabelFilterBar**

```tsx
<LabelFilterBar
  labels={labels}
  selectedFilter={labelFilter}
  onSelect={setLabelFilter}
  uncategorizedCount={uncategorizedCount}
  onOrganize={() => setShowOrganizer(true)}
/>
```

**Step 3: Render ThreadOrganizerModal**

```tsx
{showOrganizer && (
  <ThreadOrganizerModal
    open={showOrganizer}
    onClose={() => setShowOrganizer(false)}
    threads={uncategorizedThreads}
    labels={labels}
    onApply={handleBatchApplyLabels}
  />
)}
```

**Step 4: Run full test suite**

```bash
pnpm --filter @cat-cafe/web test
pnpm lint
pnpm check
```

**Step 5: Commit**

```bash
git add packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx
git commit -m "feat(F187): wire ThreadOrganizerModal into sidebar"
```

---

### Task 5: 浏览器验证 + 全量门禁

**Step 1: Start dev server and verify in browser**

1. Open sidebar with 6+ labels and some uncategorized threads
2. Verify ✨ button appears next to "未分类" pill
3. Click ✨ → modal opens showing uncategorized threads
4. Click "全部建议" → label chips auto-fill based on keyword match
5. Modify selections manually
6. Click "批量应用" → labels applied, sidebar updates, modal closes
7. Verify uncategorizedCount decreases

**Step 2: Run quality gate**

```bash
pnpm test
pnpm lint
pnpm check
pnpm -r --if-present run build
```

**Step 3: Final commit if any adjustments**
