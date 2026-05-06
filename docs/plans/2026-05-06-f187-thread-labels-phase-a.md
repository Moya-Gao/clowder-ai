---
feature_ids: [F187]
topics: [thread, labels, ux]
doc_kind: plan
created: 2026-05-06
---

# F187 Thread Labels Phase A — Implementation Plan

**Feature:** F187 — `docs/features/F187-thread-labels.md`
**Goal:** 用户可创建自定义标签（名称+颜色），给 thread 打多标签，持久化到 Redis
**Acceptance Criteria:**
- AC-A1: 用户可创建自定义标签（名称 + 颜色）
- AC-A2: 用户可在 thread 详情里给 thread 打多个标签
- AC-A3: 标签数据持久化（Redis），重启不丢失
- AC-A4: Label CRUD API 完整且有类型定义
**Architecture:** 新增 ThreadLabel 实体（Redis Hash + Sorted Set 索引），Thread 新增 `labels: string[]` 字段存 label ID 引用。独立 `/api/labels` CRUD 路由 + threads PATCH 扩展 labels 字段。前端新增 ThreadLabelPicker popover（参照 ThreadCatSettings 模式）。
**Tech Stack:** Fastify + Zod + ioredis + React + Zustand
**前端验证:** Yes — reviewer 必须实测标签创建/打标签/持久化

---

## NOT building (Phase B/C scope)

- Sidebar 标签筛选条 → Phase B
- "未分类"智能视图 → Phase B
- 猫猫一键分类建议 → Phase C
- 组合筛选（AND/OR）→ 后续

## Terminal Schema

```typescript
// ThreadLabel — 新实体
interface ThreadLabel {
  id: string;           // nanoid
  name: string;         // max 20 chars
  color: string;        // hex, e.g. "#5B8C5A"
  sortOrder: number;    // 排序权重
  createdBy: string;    // userId
  createdAt: number;    // timestamp
}

// Thread — 扩展
interface Thread {
  // ...existing fields
  labels?: string[];    // label ID 数组
}
```

## Redis Key Design

```
label:{id}              → Hash (id, name, color, sortOrder, createdBy, createdAt)
labels:user:{userId}    → Sorted Set (member=labelId, score=sortOrder)
```

TTL = 0（铁律 #5：用户数据默认持久化）

---

## Task 1: Type Definitions + Redis Keys

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/redis-keys/label-keys.ts`
- Modify: `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts` — add `labels?: string[]` to Thread + `ThreadLabel` interface + `ILabelStore` port
- Modify: `packages/web/src/stores/chat-types.ts` — add `labels?: string[]` to Thread

**Step 1:** Create `label-keys.ts` with Redis key patterns:
```typescript
export const LabelKeys = {
  detail: (id: string) => `label:${id}`,
  userList: (userId: string) => `labels:user:${userId}`,
};
```

**Step 2:** Add to `ThreadStore.ts` ports:
```typescript
export interface ThreadLabel {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdBy: string;
  createdAt: number;
}

export interface ILabelStore {
  create(label: ThreadLabel): Promise<ThreadLabel>;
  list(userId: string): Promise<ThreadLabel[]>;
  get(id: string): Promise<ThreadLabel | null>;
  update(id: string, fields: Partial<Pick<ThreadLabel, 'name' | 'color' | 'sortOrder'>>): Promise<ThreadLabel | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
```

Add `labels?: string[]` to Thread interface.

**Step 3:** Add `labels?: string[]` to web Thread type in `chat-types.ts`.

**Step 4:** Commit: `feat(F187): add ThreadLabel types + Redis keys [宪宪/Opus-46🐾]`

---

## Task 2: RedisLabelStore

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/redis/RedisLabelStore.ts`
- Create: `packages/api/src/domains/cats/services/stores/factories/LabelStoreFactory.ts`
- Test: `packages/api/test/label-store.test.ts`

**Step 1:** Write failing test — label CRUD operations:
```typescript
test('create + list labels', async () => {
  const label = await store.create({ id: 'lbl_1', name: '开源拆解', color: '#5B8C5A', sortOrder: 0, createdBy: 'user1', createdAt: Date.now() });
  expect(label.name).toBe('开源拆解');
  const labels = await store.list('user1');
  expect(labels).toHaveLength(1);
});

test('update label', async () => {
  await store.create({ ... });
  const updated = await store.update('lbl_1', { name: '源码拆解', color: '#3A7D44' });
  expect(updated?.name).toBe('源码拆解');
});

test('delete label', async () => {
  await store.create({ ... });
  const ok = await store.delete('lbl_1', 'user1');
  expect(ok).toBe(true);
  const labels = await store.list('user1');
  expect(labels).toHaveLength(0);
});
```

**Step 2:** Run test → verify FAIL.

**Step 3:** Implement `RedisLabelStore`:
- `create`: HSET label:{id} fields + ZADD labels:user:{userId} sortOrder labelId
- `list`: ZRANGE labels:user:{userId} 0 -1 → batch HGETALL
- `get`: HGETALL label:{id}
- `update`: HSET label:{id} changed fields (+ ZADD if sortOrder changed)
- `delete`: DEL label:{id} + ZREM labels:user:{userId}

**Step 4:** Implement `LabelStoreFactory` (follow ThreadStoreFactory pattern).

**Step 5:** Run test → verify PASS.

**Step 6:** Commit: `feat(F187): RedisLabelStore + factory + tests [宪宪/Opus-46🐾]`

---

## Task 3: Thread Store Labels Support

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts` — serialize/hydrate labels + updateLabels method
- Test: extend existing thread store tests

**Step 1:** Write failing test:
```typescript
test('thread labels persist', async () => {
  const thread = await store.create({ ...baseThread });
  await store.updateLabels(thread.id, ['lbl_1', 'lbl_2']);
  const fetched = await store.get(thread.id);
  expect(fetched?.labels).toEqual(['lbl_1', 'lbl_2']);
});
```

**Step 2:** Run → FAIL.

**Step 3:** Implement:
- `serializeThread`: add `result.labels = JSON.stringify(thread.labels ?? []);`
- `hydrateThread`: parse labels JSON (follow preferredCats pattern)
- `updateLabels(threadId, labelIds)`: HSET thread:{id} labels JSON.stringify(labelIds)

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(F187): thread labels serialize/hydrate + updateLabels [宪宪/Opus-46🐾]`

---

## Task 4: Label API Routes

**Files:**
- Create: `packages/api/src/routes/labels.ts`
- Modify: `packages/api/src/routes/index.ts` — export labelsRoutes
- Modify: `packages/api/src/index.ts` — register labelsRoutes
- Modify: `packages/api/src/routes/threads.ts` — add `labels` to updateThreadSchema
- Test: `packages/api/test/label-routes.test.ts`

**Step 1:** Write failing route tests (POST/GET/PATCH/DELETE /api/labels + PATCH /api/threads/:id with labels).

**Step 2:** Run → FAIL.

**Step 3:** Create `labels.ts`:
```
POST   /api/labels          — create label (name, color required)
GET    /api/labels          — list user's labels
PATCH  /api/labels/:id      — update name/color/sortOrder
DELETE /api/labels/:id      — delete label + remove from all threads
```

Zod schemas:
```typescript
const createLabelSchema = z.object({
  name: z.string().min(1).max(20),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sortOrder: z.number().int().min(0).optional(),
});
const updateLabelSchema = z.object({
  name: z.string().min(1).max(20).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().min(0).optional(),
}).refine(d => d.name !== undefined || d.color !== undefined || d.sortOrder !== undefined);
```

**Step 4:** Add `labels` to threads.ts `updateThreadSchema`:
```typescript
labels: z.array(z.string().max(50)).max(20).optional(),
```
Add to PATCH handler: `if (labels !== undefined) await threadStore.updateLabels(id, labels);`

**Step 5:** Register in index.ts: `await app.register(labelsRoutes, { labelStore, threadStore });`

**Step 6:** Run → PASS.

**Step 7:** Commit: `feat(F187): label CRUD API + thread labels PATCH [宪宪/Opus-46🐾]`

---

## Task 5: Frontend — Label API Client + Store

**Files:**
- Create: `packages/web/src/stores/label-store.ts`
- Modify: `packages/web/src/stores/chat-store.ts` — add updateThreadLabels action

**Step 1:** Create `label-store.ts` (Zustand):
```typescript
interface LabelState {
  labels: ThreadLabel[];
  isLoading: boolean;
  fetchLabels: () => Promise<void>;
  createLabel: (name: string, color: string) => Promise<ThreadLabel>;
  updateLabel: (id: string, fields: Partial<...>) => Promise<void>;
  deleteLabel: (id: string) => Promise<void>;
}
```

**Step 2:** Add `updateThreadLabels(threadId, labelIds)` to chat-store — calls `PATCH /api/threads/:id { labels }` and updates local thread state.

**Step 3:** Commit: `feat(F187): frontend label store + chat store labels [宪宪/Opus-46🐾]`

---

## Task 6: Frontend — ThreadLabelPicker + ThreadItem Integration

**Files:**
- Create: `packages/web/src/components/ThreadSidebar/ThreadLabelPicker.tsx`
- Modify: `packages/web/src/components/ThreadSidebar/ThreadItem.tsx` — add label dots + picker trigger
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` — pass label props

**Step 1:** Create `ThreadLabelPicker` (follow ThreadCatSettings popover pattern):
- Props: `threadId, currentLabels, onClose`
- Lists all labels with checkboxes (checked = thread has label)
- Toggle = immediate save (optimistic update via chat-store)
- "新建标签" link at bottom opens inline create form (name + color picker)
- SVG icons only (KD-3)

**Step 2:** Add to `ThreadItem`:
- Label color dots next to thread title (max 3 dots, "+N" if more)
- Label icon button in hover action strip (between favorite and cat settings)
- Button opens `ThreadLabelPicker` popover

**Step 3:** ThreadSidebar passes label data down (from label-store).

**Step 4:** Manual verification:
- Create 3-4 labels with different colors
- Assign labels to threads
- Verify dots appear on thread items
- Refresh page → labels persist
- Delete a label → removed from all threads

**Step 5:** Commit: `feat(F187): ThreadLabelPicker + thread item label dots [宪宪/Opus-46🐾]`

---

## Verification Checklist

| AC | How to verify |
|----|---------------|
| AC-A1 | Create labels via API + UI picker "新建标签" |
| AC-A2 | ThreadLabelPicker popover with multi-select checkboxes |
| AC-A3 | Create label → refresh → label still there; assign to thread → restart API → still assigned |
| AC-A4 | POST/GET/PATCH/DELETE /api/labels all work with proper Zod validation + TypeScript types |
