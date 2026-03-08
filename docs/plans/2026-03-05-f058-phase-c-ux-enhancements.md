---
feature_ids: [F058]
phase: C
doc_kind: plan
created: 2026-03-05
---

# F058 Phase C: UX Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Add Feature bird's eye view (group backlog items by feature tag), query safety limit on backlogItemIds, and absolute time tooltip.

**Architecture:** C2 is a pure backend guard (Zod + post-parse count check). C3 is a one-line frontend `title` attribute. C1 is the only real work: a new `FeatureBirdEyePanel` component that groups existing backlog items by their `tags` field, fetches threads for dispatched items, and shows aggregated status counts per feature.

**Tech Stack:** React (Next.js), Tailwind CSS, Zod, node:test

**Finish line:** Mission Hub shows a collapsible "Feature 鸟瞰" panel grouping items by feature tag with thread status counts; `/api/threads?backlogItemIds=` rejects >50 IDs; relative times show absolute time on hover.

**NOT building:** dependency graph visualization, auto-sync, cross-feature Gantt chart.

---

## Task 1: AC-C2 — Query safety limit on backlogItemIds

Smallest, most isolated change. Pure backend.

**Files:**
- Modify: `packages/api/src/routes/threads.ts:154-156`
- Test: `packages/api/test/threads-endpoint.test.js`

**Step 1: Write the failing test**

In `packages/api/test/threads-endpoint.test.js`, inside the main describe block, add:

```javascript
it('rejects backlogItemIds with more than 50 IDs', async () => {
  const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`).join(',');
  const response = await app.inject({
    method: 'GET',
    url: `/api/threads?backlogItemIds=${encodeURIComponent(ids)}`,
    headers: { 'x-user-id': 'user1' },
  });
  assert.strictEqual(response.statusCode, 400);
  const body = JSON.parse(response.body);
  assert.ok(body.error?.includes('50'));
});

it('accepts backlogItemIds with exactly 50 IDs', async () => {
  const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`).join(',');
  const response = await app.inject({
    method: 'GET',
    url: `/api/threads?backlogItemIds=${encodeURIComponent(ids)}`,
    headers: { 'x-user-id': 'user1' },
  });
  assert.strictEqual(response.statusCode, 200);
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/api && node --test test/threads-endpoint.test.js -t "rejects backlogItemIds"
```
Expected: FAIL (currently no limit, returns 200)

**Step 3: Implement the limit**

In `packages/api/src/routes/threads.ts`, after line 156 (where `requestedBacklogIds` is constructed), add:

```typescript
if (requestedBacklogIds && requestedBacklogIds.size > 50) {
  reply.status(400);
  return { error: 'Too many backlogItemIds (max 50)' };
}
```

**Step 4: Run tests**

```bash
cd packages/api && pnpm exec tsc && node --test test/threads-endpoint.test.js
```
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/threads.ts packages/api/test/threads-endpoint.test.js
git commit -m "feat(f058): limit backlogItemIds to 50 (AC-C2)"
```

---

## Task 2: AC-C3 — Absolute time tooltip on relative time

One-line frontend change.

**Files:**
- Modify: `packages/web/src/components/mission-control/ThreadSituationPanel.tsx:84`

**Step 1: Add `title` attribute**

In `ThreadSituationPanel.tsx`, change line 84 from:

```tsx
最近活跃：{formatLastActive(thread.lastActiveAt)}
```

to:

```tsx
最近活跃：<span title={new Date(thread.lastActiveAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}>{formatLastActive(thread.lastActiveAt)}</span>
```

**Step 2: Verify build**

```bash
cd packages/web && pnpm exec tsc --noEmit
```
Expected: exit 0

**Step 3: Commit**

```bash
git add packages/web/src/components/mission-control/ThreadSituationPanel.tsx
git commit -m "feat(f058): add absolute time tooltip to relative time display (AC-C3)"
```

---

## Task 3: AC-C1 — Feature Bird's Eye Panel (backend: no new API needed)

Data model analysis: backlog items already have `tags: string[]` containing feature IDs like `['F058']`. The frontend already fetches all items via `GET /api/backlog/items` and all dispatched threads via `GET /api/threads?backlogItemIds=...`. No new API is needed — C1 is purely frontend grouping logic.

**Grouping logic:**
```typescript
// Group items by feature tag (first Fxxx tag, or "Untagged")
function groupByFeature(items: BacklogItem[]): Map<string, BacklogItem[]> {
  const groups = new Map<string, BacklogItem[]>();
  for (const item of items) {
    const featureTag = item.tags.find(t => /^F\d+$/i.test(t)) ?? 'Untagged';
    const list = groups.get(featureTag) ?? [];
    list.push(item);
    groups.set(featureTag, list);
  }
  return groups;
}
```

**Files:**
- Create: `packages/web/src/components/mission-control/FeatureBirdEyePanel.tsx`
- Modify: `packages/web/src/components/mission-control/MissionControlPage.tsx`

**Step 1: Create `FeatureBirdEyePanel.tsx`**

```tsx
'use client';

import type { BacklogItem, BacklogStatus, CatId } from '@cat-cafe/shared';

interface ThreadSituationSummary {
  id: string;
  title?: string;
  lastActiveAt: number;
  participants: CatId[];
  backlogItemId?: string;
}

interface FeatureBirdEyePanelProps {
  items: BacklogItem[];
  threadsByBacklogId: Record<string, ThreadSituationSummary>;
}

const STATUS_LABELS: Record<BacklogStatus, string> = {
  open: '待建议',
  suggested: '待批准',
  approved: '已批准',
  dispatched: '执行中',
  done: '已完成',
};

const STATUS_COLORS: Record<BacklogStatus, string> = {
  open: 'bg-[#E8E0D5] text-[#6B5D4F]',
  suggested: 'bg-[#FFF0D4] text-[#8B6914]',
  approved: 'bg-[#DDEEFF] text-[#1A5FA0]',
  dispatched: 'bg-[#FDE8D0] text-[#A85E00]',
  done: 'bg-[#D4E8D0] text-[#2C5A28]',
};

function groupByFeature(items: BacklogItem[]): [string, BacklogItem[]][] {
  const groups = new Map<string, BacklogItem[]>();
  for (const item of items) {
    const featureTag = item.tags.find((t) => /^F\d+$/i.test(t)) ?? 'Untagged';
    const list = groups.get(featureTag) ?? [];
    list.push(item);
    groups.set(featureTag, list);
  }
  // Sort by feature tag (F001, F002, ..., Untagged last)
  return [...groups.entries()].sort((a, b) => {
    if (a[0] === 'Untagged') return 1;
    if (b[0] === 'Untagged') return -1;
    return a[0].localeCompare(b[0]);
  });
}

function countByStatus(items: BacklogItem[]): Partial<Record<BacklogStatus, number>> {
  const counts: Partial<Record<BacklogStatus, number>> = {};
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  return counts;
}

export function FeatureBirdEyePanel({ items, threadsByBacklogId }: FeatureBirdEyePanelProps) {
  const groups = groupByFeature(items);
  if (groups.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-[#E7DAC7] bg-[#FFFDF8] p-3"
      data-testid="mc-feature-bird-eye"
    >
      <h2 className="mb-2 text-sm font-semibold text-[#2C2118]">Feature 鸟瞰</h2>
      <div className="space-y-2">
        {groups.map(([tag, featureItems]) => {
          const counts = countByStatus(featureItems);
          const dispatchedCount = featureItems.filter(
            (i) => i.status === 'dispatched' && threadsByBacklogId[i.id],
          ).length;

          return (
            <article
              key={tag}
              className="rounded-xl border border-[#EADFCF] bg-[#FFF9F0] px-3 py-2"
              data-testid={`mc-bird-eye-feature-${tag}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#4B3A2A]">{tag}</span>
                <span className="text-[11px] text-[#8B7864]">{featureItems.length} 项</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(Object.entries(counts) as [BacklogStatus, number][]).map(([status, count]) => (
                  <span
                    key={status}
                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[status]}`}
                  >
                    {STATUS_LABELS[status]} {count}
                  </span>
                ))}
              </div>
              {dispatchedCount > 0 && (
                <p className="mt-1 text-[11px] text-[#6E5A46]">
                  {dispatchedCount} 个线程运行中
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

**Step 2: Wire into MissionControlPage**

In `MissionControlPage.tsx`, add import:

```tsx
import { FeatureBirdEyePanel } from './FeatureBirdEyePanel';
```

Then in the right sidebar (after `ThreadSituationPanel`, around line 428), add:

```tsx
<FeatureBirdEyePanel items={items} threadsByBacklogId={threadsByBacklogId} />
```

**Step 3: Verify build**

```bash
pnpm --filter @cat-cafe/web exec tsc --noEmit
```
Expected: exit 0

**Step 4: Commit**

```bash
git add packages/web/src/components/mission-control/FeatureBirdEyePanel.tsx packages/web/src/components/mission-control/MissionControlPage.tsx
git commit -m "feat(f058): add Feature bird's eye panel to Mission Hub (AC-C1)"
```

---

## Task 4: Quality gate + review

**Step 1: Full test suite**

```bash
cd packages/api && pnpm exec tsc && node --test test/threads-endpoint.test.js test/backlog-routes.test.js test/backlog-store.test.js
pnpm lint
pnpm --filter @cat-cafe/web exec tsc --noEmit
```

**Step 2: File size check**

```bash
wc -l packages/web/src/components/mission-control/FeatureBirdEyePanel.tsx
# Must be < 200 lines
```

**Step 3: Update feature doc AC checkboxes**

Mark AC-C1, AC-C2, AC-C3 as done in `docs/features/F058-mission-control-enhancements.md`.

**Step 4: Quality gate + request review + merge gate**
