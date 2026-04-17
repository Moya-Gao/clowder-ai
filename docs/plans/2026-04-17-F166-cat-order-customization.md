---
feature_ids: [F166]
doc_kind: plan
created: 2026-04-17
author: opus-47
---

# F166 Cat Order Customization Implementation Plan

**Feature:** F166 — `docs/features/F166-cat-order-customization.md`
**Goal:** 让铲屎官在 Hub 总揽页拖拽猫卡片自定义顺序，@ mention picker 自动跟随，顺序持久化到磁盘。
**Acceptance Criteria:**
- AC-A1: 总揽页面猫卡片可拖拽重新排序
- AC-A2: 排序结果通过 `/api/config/cat-order` 持久化，刷新后保持
- AC-A3: @ mention picker 排序与总揽页面一致
- AC-A4: 新增猫（catOrder 中不存在的 catId）自动追加到末尾
- AC-A5: 无 catOrder 配置时保持现有 cat-template.json 顺序

**Architecture:**
- 新建 `.cat-cafe/user-preferences.json` 文件作为 UI 偏好持久化载体（未来可扩展其他偏好）；不用 `ConfigStore`（catOrder 是数组不是 scalar，schema 不匹配），也不塞 `cat-catalog.json`（catalog 是配置不是偏好）。
- 后端新增 `GET/PUT /api/config/cat-order`（endpoint 路径紧跟现有 `default-cat` 风格，owner-gated）。
- 前端 `useCatData` hook 在导出 `cats` 前调用纯函数 `sortCatsByOrder(cats, catOrder)` —— 单一注入点，`ChatInput` 的 @ picker 和 `CatOverviewTab` 自动联动。
- 拖拽用 HTML5 原生 DnD，不引入 `@dnd-kit` 等库。

**Tech Stack:** Fastify + Zod（后端）、React + Tailwind（前端）、Node `--test` + Vitest（测试）
**前端验证:** Yes — reviewer 必须用 Playwright / Chrome 实测拖拽 + @ picker 联动。

---

## Straight-Line Check

**Finish line:** 铲屎官在总揽页拖 opus-47 到第一位，松手即保存；刷新页面顺序还在；打开 @ picker，opus-47 是第一个候选。

**NOT building:** touch 事件（移动端）、per-user 顺序（单用户场景）、breed 分组模式、pin-top 单独分区。

**Terminal schema:**
```ts
// packages/shared/src/types/user-preferences.ts（新文件）
export interface UserPreferences {
  catOrder: string[]; // catId 列表，顺序即展示顺序
}
```

```ts
// packages/api/src/config/cat-order-store.ts（新文件）
export function loadCatOrder(projectRoot: string): string[];
export function saveCatOrder(projectRoot: string, catIds: string[]): void;
```

```ts
// packages/web/src/lib/sort-cats-by-order.ts（新文件，纯函数）
export function sortCatsByOrder<T extends { id: string }>(cats: T[], catOrder: string[]): T[];
```

---

## Task 1: 后端 — catOrder 持久化 store

**Files:**
- Create: `packages/api/src/config/cat-order-store.ts`
- Create: `packages/api/test/config/cat-order-store.test.js`
- Create: `packages/shared/src/types/user-preferences.ts`（schema 共享）
- Modify: `packages/shared/src/index.ts`（导出 `UserPreferences`）

**Step 1.1: 写失败测试**

```js
// packages/api/test/config/cat-order-store.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCatOrder, saveCatOrder } from '../../src/config/cat-order-store.js';

test('loadCatOrder returns [] when file does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cat-order-'));
  try {
    assert.deepEqual(loadCatOrder(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('saveCatOrder then loadCatOrder roundtrips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cat-order-'));
  try {
    saveCatOrder(dir, ['opus-47', 'gpt52', 'gemini', 'opus']);
    assert.deepEqual(loadCatOrder(dir), ['opus-47', 'gpt52', 'gemini', 'opus']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('saveCatOrder preserves other user preferences', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cat-order-'));
  try {
    // 手写一个包含其他字段的 preferences 文件
    const { writeFileSync, mkdirSync } = require('node:fs');
    mkdirSync(join(dir, '.cat-cafe'), { recursive: true });
    writeFileSync(
      join(dir, '.cat-cafe', 'user-preferences.json'),
      JSON.stringify({ catOrder: [], futureField: 'keep-me' }),
    );
    saveCatOrder(dir, ['opus']);
    const raw = JSON.parse(require('node:fs').readFileSync(join(dir, '.cat-cafe', 'user-preferences.json'), 'utf-8'));
    assert.equal(raw.futureField, 'keep-me');
    assert.deepEqual(raw.catOrder, ['opus']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

**Step 1.2: 跑测试确认失败**

```bash
cd packages/api && node --test test/config/cat-order-store.test.js
# Expected: FAIL — module not found
```

**Step 1.3: 写最小实现**

```ts
// packages/shared/src/types/user-preferences.ts
export interface UserPreferences {
  catOrder?: string[];
}
```

```ts
// packages/api/src/config/cat-order-store.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { UserPreferences } from '@cat-cafe/shared';

function preferencesPath(projectRoot: string): string {
  return resolve(projectRoot, '.cat-cafe', 'user-preferences.json');
}

function readPreferences(projectRoot: string): UserPreferences {
  const path = preferencesPath(projectRoot);
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as UserPreferences) : {};
  } catch {
    return {};
  }
}

function writePreferences(projectRoot: string, prefs: UserPreferences): void {
  const path = preferencesPath(projectRoot);
  mkdirSync(resolve(projectRoot, '.cat-cafe'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(prefs, null, 2)}\n`, 'utf-8');
}

export function loadCatOrder(projectRoot: string): string[] {
  const prefs = readPreferences(projectRoot);
  return Array.isArray(prefs.catOrder) ? prefs.catOrder.filter((id): id is string => typeof id === 'string') : [];
}

export function saveCatOrder(projectRoot: string, catIds: string[]): void {
  const prefs = readPreferences(projectRoot);
  writePreferences(projectRoot, { ...prefs, catOrder: catIds });
}
```

**Step 1.4: 跑测试确认通过**

```bash
cd packages/api && node --test test/config/cat-order-store.test.js
# Expected: 3 passed
```

**Step 1.5: Commit**

```bash
git add packages/api/src/config/cat-order-store.ts \
        packages/api/test/config/cat-order-store.test.js \
        packages/shared/src/types/user-preferences.ts \
        packages/shared/src/index.ts
git commit -m "feat(F166): cat-order persistence store [opus-47🐾]"
```

---

## Task 2: 后端 — GET/PUT /api/config/cat-order 路由

**Files:**
- Modify: `packages/api/src/routes/config.ts:357-400`（紧跟 default-cat block）
- Create: `packages/api/test/routes/cat-order-route.test.js`

**Step 2.1: 写失败测试**

```js
// packages/api/test/routes/cat-order-route.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTestApp } from '../helpers/build-test-app.js';

test('GET /api/config/cat-order returns [] when unset', async () => {
  const app = await buildTestApp();
  const res = await app.inject({ method: 'GET', url: '/api/config/cat-order' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { catOrder: [] });
  await app.close();
});

test('PUT /api/config/cat-order persists owner-provided order', async () => {
  const app = await buildTestApp();
  const put = await app.inject({
    method: 'PUT',
    url: '/api/config/cat-order',
    headers: { 'X-Cat-Cafe-User': 'default-user', 'Content-Type': 'application/json' },
    payload: { catOrder: ['opus-47', 'gpt52', 'opus'] },
  });
  assert.equal(put.statusCode, 200);
  const get = await app.inject({ method: 'GET', url: '/api/config/cat-order' });
  assert.deepEqual(get.json(), { catOrder: ['opus-47', 'gpt52', 'opus'] });
  await app.close();
});

test('PUT /api/config/cat-order rejects non-owner', async () => {
  const app = await buildTestApp();
  const res = await app.inject({
    method: 'PUT',
    url: '/api/config/cat-order',
    headers: { 'X-Cat-Cafe-User': 'intruder', 'Content-Type': 'application/json' },
    payload: { catOrder: ['opus'] },
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test('PUT /api/config/cat-order rejects unknown catId', async () => {
  const app = await buildTestApp();
  const res = await app.inject({
    method: 'PUT',
    url: '/api/config/cat-order',
    headers: { 'X-Cat-Cafe-User': 'default-user', 'Content-Type': 'application/json' },
    payload: { catOrder: ['ghost-cat'] },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});
```

**Step 2.2: 跑测试确认失败**

```bash
cd packages/api && node --test test/routes/cat-order-route.test.js
# Expected: FAIL — 404 / route not found
```

**Step 2.3: 实现路由**

插入到 `packages/api/src/routes/config.ts` 第 400 行之前（`}` 闭合前）：

```ts
// ── F166: Cat display order (owner-gated) ────────────────────────
app.get('/api/config/cat-order', async () => ({
  catOrder: loadCatOrder(projectRoot),
}));

const catOrderPutSchema = z.object({
  catOrder: z.array(z.string().min(1)),
});

app.put('/api/config/cat-order', async (request: FastifyRequest, reply: FastifyReply) => {
  const operator = resolveHeaderUserId(request);
  if (!operator) {
    reply.status(400);
    return { error: 'Identity required (X-Cat-Cafe-User header)' };
  }
  if (operator !== getOwnerUserId()) {
    reply.status(403);
    return { error: 'Only the owner can change cat order' };
  }
  const parsed = catOrderPutSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.status(400);
    return { error: 'Invalid request', details: parsed.error.issues };
  }
  // Validate every catId is registered
  for (const catId of parsed.data.catOrder) {
    if (!catRegistry.has(catId)) {
      reply.status(400);
      return { error: `Unknown catId: ${catId}` };
    }
  }
  saveCatOrder(projectRoot, parsed.data.catOrder);
  return { ok: true, catOrder: parsed.data.catOrder };
});
```

Top-of-file import 加上：`import { loadCatOrder, saveCatOrder } from '../config/cat-order-store.js';`

**Step 2.4: 跑测试确认通过**

```bash
cd packages/api && node --test test/routes/cat-order-route.test.js
# Expected: 4 passed
```

**Step 2.5: Commit**

```bash
git add packages/api/src/routes/config.ts packages/api/test/routes/cat-order-route.test.js
git commit -m "feat(F166): GET/PUT /api/config/cat-order routes [opus-47🐾]"
```

---

## Task 3: 前端 — sortCatsByOrder 纯函数

**Files:**
- Create: `packages/web/src/lib/sort-cats-by-order.ts`
- Create: `packages/web/src/lib/__tests__/sort-cats-by-order.test.ts`

**Step 3.1: 写失败测试**

```ts
// packages/web/src/lib/__tests__/sort-cats-by-order.test.ts
import { describe, expect, it } from 'vitest';
import { sortCatsByOrder } from '../sort-cats-by-order';

describe('sortCatsByOrder', () => {
  const cats = [
    { id: 'opus' },
    { id: 'sonnet' },
    { id: 'opus-45' },
    { id: 'opus-47' },
    { id: 'codex' },
    { id: 'gpt52' },
  ];

  it('returns cats unchanged when catOrder is empty', () => {
    expect(sortCatsByOrder(cats, [])).toEqual(cats);
  });

  it('pins cats in catOrder order first, preserves original order for rest', () => {
    const result = sortCatsByOrder(cats, ['opus-47', 'gpt52']);
    expect(result.map((c) => c.id)).toEqual(['opus-47', 'gpt52', 'opus', 'sonnet', 'opus-45', 'codex']);
  });

  it('ignores catIds in catOrder that do not exist in cats', () => {
    const result = sortCatsByOrder(cats, ['ghost', 'opus-47']);
    expect(result[0]!.id).toBe('opus-47');
    expect(result).toHaveLength(cats.length);
  });

  it('does not mutate input array', () => {
    const original = [...cats];
    sortCatsByOrder(cats, ['opus-47']);
    expect(cats).toEqual(original);
  });
});
```

**Step 3.2: 跑测试确认失败**

```bash
cd packages/web && pnpm vitest run src/lib/__tests__/sort-cats-by-order.test.ts
# Expected: FAIL — module not found
```

**Step 3.3: 实现**

```ts
// packages/web/src/lib/sort-cats-by-order.ts
/** Sort cats: catOrder ids first (in that order), then remaining cats in original order.
 *  Pure — does not mutate input. Silently drops ids in catOrder that don't exist in cats. */
export function sortCatsByOrder<T extends { id: string }>(cats: T[], catOrder: string[]): T[] {
  if (catOrder.length === 0) return cats;
  const byId = new Map(cats.map((c) => [c.id, c]));
  const pinned: T[] = [];
  const pinnedIds = new Set<string>();
  for (const id of catOrder) {
    const cat = byId.get(id);
    if (cat) {
      pinned.push(cat);
      pinnedIds.add(id);
    }
  }
  const rest = cats.filter((c) => !pinnedIds.has(c.id));
  return [...pinned, ...rest];
}
```

**Step 3.4: 跑测试确认通过**

```bash
cd packages/web && pnpm vitest run src/lib/__tests__/sort-cats-by-order.test.ts
# Expected: 4 passed
```

**Step 3.5: Commit**

```bash
git add packages/web/src/lib/sort-cats-by-order.ts packages/web/src/lib/__tests__/sort-cats-by-order.test.ts
git commit -m "feat(F166): sortCatsByOrder pure helper [opus-47🐾]"
```

---

## Task 4: 前端 — useCatData 集成 catOrder

**Files:**
- Modify: `packages/web/src/hooks/useCatData.ts`
- Create: `packages/web/src/hooks/__tests__/use-cat-data-order.test.tsx`

**Step 4.1: 写失败测试**

目标：mock `/api/cats` 和 `/api/config/cat-order`，`useCatData` 返回的 `cats` 应该按 `catOrder` 排序。

```tsx
// packages/web/src/hooks/__tests__/use-cat-data-order.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetCatDataCache, useCatData } from '../useCatData';

function mockFetch(responses: Record<string, unknown>) {
  return vi.fn().mockImplementation((url: string) => {
    const payload = responses[url];
    if (payload == null) return Promise.resolve({ ok: false });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
  });
}

describe('useCatData applies catOrder', () => {
  beforeEach(() => _resetCatDataCache());
  afterEach(() => vi.restoreAllMocks());

  it('reorders cats according to /api/config/cat-order', async () => {
    global.fetch = mockFetch({
      '/api/cats': { cats: [{ id: 'opus' }, { id: 'opus-47' }, { id: 'gpt52' }] },
      '/api/config/cat-order': { catOrder: ['opus-47', 'gpt52'] },
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useCatData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cats.map((c) => c.id)).toEqual(['opus-47', 'gpt52', 'opus']);
  });
});
```

**Step 4.2: 跑测试确认失败**

```bash
cd packages/web && pnpm vitest run src/hooks/__tests__/use-cat-data-order.test.tsx
# Expected: FAIL — order is ['opus','opus-47','gpt52']
```

**Step 4.3: 改 `useCatData`**

在 `useCatData.ts` 中：
1. 加 module-level `_catOrder: string[] = []` 缓存 + fetch
2. `fetchCats` 并行 fetch `/api/cats` 和 `/api/config/cat-order`，把结果 merge
3. 所有 notify/set 路径用 `sortCatsByOrder(cats, catOrder)` 包一层
4. 导出 `refreshCatOrder()` 供拖拽完成后调用

核心 diff（关键片段）：

```ts
import { sortCatsByOrder } from '@/lib/sort-cats-by-order';

let _catOrder: string[] = [];

async function fetchCatOrder(): Promise<string[]> {
  try {
    const res = await apiFetch('/api/config/cat-order');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.catOrder) ? data.catOrder : [];
  } catch {
    return [];
  }
}

async function fetchCats(): Promise<FetchResult> {
  try {
    const [catsRes, orderRes] = await Promise.all([apiFetch('/api/cats'), fetchCatOrder()]);
    _catOrder = orderRes;
    if (!catsRes.ok) return { cats: sortCatsByOrder(buildFallbackCats(), _catOrder), fromApi: false };
    const data = await catsRes.json();
    const normalized = Array.isArray(data?.cats) ? normalizeCats(data.cats) : null;
    const cats = normalized ?? buildFallbackCats();
    return { cats: sortCatsByOrder(cats, _catOrder), fromApi: normalized !== null };
  } catch {
    return { cats: sortCatsByOrder(buildFallbackCats(), _catOrder), fromApi: false };
  }
}

export async function saveCatOrder(catOrder: string[]): Promise<void> {
  const res = await apiFetch('/api/config/cat-order', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catOrder }),
  });
  if (!res.ok) throw new Error(`Failed to save cat order: ${res.status}`);
  _catOrder = catOrder;
  if (_cached) {
    const reordered = sortCatsByOrder(_cached, catOrder);
    _cached = reordered;
    notifyListeners(reordered);
  }
}
```

**Step 4.4: 跑测试确认通过**

```bash
cd packages/web && pnpm vitest run src/hooks/__tests__/use-cat-data-order.test.tsx
# Expected: 1 passed
# 同时跑已有 useCatData 相关测试确认没有 regression
```

**Step 4.5: Commit**

```bash
git add packages/web/src/hooks/useCatData.ts packages/web/src/hooks/__tests__/use-cat-data-order.test.tsx
git commit -m "feat(F166): useCatData applies catOrder preference [opus-47🐾]"
```

---

## Task 5: 前端 — CatOverviewTab 拖拽 UI + 乐观更新

**Files:**
- Modify: `packages/web/src/components/HubMemberOverviewCard.tsx`（加 drag handle + draggable prop）
- Modify: `packages/web/src/components/config-viewer-tabs.tsx`（CatOverviewTab 加 DnD state/handlers）
- Create: `packages/web/src/components/__tests__/cat-overview-drag.test.tsx`

**Step 5.1: 写失败测试**

测试拖放 cat B 到 cat A 之前 → 触发 `saveCatOrder(['B', 'A', 'C'])`，且本地列表立刻更新（乐观）。

```tsx
// packages/web/src/components/__tests__/cat-overview-drag.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatOverviewTab } from '../config-viewer-tabs';

vi.mock('@/hooks/useCatData', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useCatData')>('@/hooks/useCatData');
  return { ...actual, saveCatOrder: vi.fn().mockResolvedValue(undefined) };
});

describe('CatOverviewTab drag & drop', () => {
  afterEach(() => vi.clearAllMocks());

  it('dragging cat B onto cat A calls saveCatOrder with new order', async () => {
    const { saveCatOrder } = await import('@/hooks/useCatData');
    const cats = [
      { id: 'A', displayName: 'A', mentionPatterns: ['@a'], /* ...minimal fields */ } as any,
      { id: 'B', displayName: 'B', mentionPatterns: ['@b'] } as any,
      { id: 'C', displayName: 'C', mentionPatterns: ['@c'] } as any,
    ];
    render(<CatOverviewTab config={{ coCreator: null, cats: {} } as any} cats={cats} />);
    const cardA = screen.getByTestId('cat-card-A');
    const cardB = screen.getByTestId('cat-card-B');
    const dataTransfer = { setData: vi.fn(), getData: vi.fn().mockReturnValue('B') };
    fireEvent.dragStart(cardB, { dataTransfer });
    fireEvent.dragOver(cardA, { dataTransfer });
    fireEvent.drop(cardA, { dataTransfer });
    expect(saveCatOrder).toHaveBeenCalledWith(['B', 'A', 'C']);
  });
});
```

**Step 5.2: 跑测试确认失败**

```bash
cd packages/web && pnpm vitest run src/components/__tests__/cat-overview-drag.test.tsx
# Expected: FAIL — data-testid not present, handlers not wired
```

**Step 5.3: 改 `HubMemberOverviewCard`**

关键改动：
- 新增 `onDragStart/Over/Drop` props
- 外层 `<section>` 加 `draggable`、`data-testid={cat-card-${cat.id}}`
- 左上角加一个 `⠿` 把手（`<span aria-label="拖动排序">⠿</span>`，纯视觉提示；整卡都 draggable）

**Step 5.4: 改 `CatOverviewTab`**

```tsx
const [localOrder, setLocalOrder] = useState<string[] | null>(null);
const displayCats = useMemo(() => (localOrder ? sortCatsByOrder(cats, localOrder) : cats), [cats, localOrder]);
const draggingIdRef = useRef<string | null>(null);

const handleDragStart = (id: string, e: DragEvent) => {
  draggingIdRef.current = id;
  e.dataTransfer?.setData('text/plain', id);
};
const handleDragOver = (e: DragEvent) => e.preventDefault();
const handleDrop = async (targetId: string) => {
  const srcId = draggingIdRef.current;
  if (!srcId || srcId === targetId) return;
  const nextOrder = reorderIds(displayCats.map((c) => c.id), srcId, targetId);
  setLocalOrder(nextOrder); // 乐观更新
  try {
    await saveCatOrder(nextOrder);
  } catch {
    setLocalOrder(null); // 回滚
    setDragError('排序保存失败');
  }
};
```

辅助 `reorderIds(ids, src, target)`：把 src 从 ids 里抽出，插到 target 位置。

**Step 5.5: 跑测试确认通过**

```bash
cd packages/web && pnpm vitest run src/components/__tests__/cat-overview-drag.test.tsx
# Expected: 1 passed
```

**Step 5.6: Commit**

```bash
git add packages/web/src/components/HubMemberOverviewCard.tsx \
        packages/web/src/components/config-viewer-tabs.tsx \
        packages/web/src/components/__tests__/cat-overview-drag.test.tsx
git commit -m "feat(F166): drag-to-reorder cat cards in overview [opus-47🐾]"
```

---

## Task 6: E2E 验证 + 失败回滚测试

**Files:**
- Create: `packages/web/src/components/__tests__/cat-overview-drag-rollback.test.tsx`

**Step 6.1: 写失败测试（回滚场景）**

```tsx
it('rolls back local order when saveCatOrder rejects', async () => {
  const { saveCatOrder } = await import('@/hooks/useCatData');
  (saveCatOrder as Mock).mockRejectedValueOnce(new Error('boom'));
  // ... 同上 fire 拖放事件
  await waitFor(() => expect(screen.getByText(/排序保存失败/)).toBeInTheDocument());
  expect(screen.getAllByTestId(/cat-card-/).map((el) => el.dataset.testid)).toEqual([
    'cat-card-A', 'cat-card-B', 'cat-card-C', // 回滚到初始顺序
  ]);
});
```

**Step 6.2: 补实现确保测试通过**

`CatOverviewTab` 失败回滚分支 `setLocalOrder(null) + setDragError('排序保存失败')` 已在 Task 5 做了；补 UI 显示 `dragError`。

**Step 6.3: Commit**

```bash
git add packages/web/src/components/__tests__/cat-overview-drag-rollback.test.tsx \
        packages/web/src/components/config-viewer-tabs.tsx
git commit -m "test(F166): rollback on saveCatOrder failure [opus-47🐾]"
```

**Step 6.4: 人工 E2E**

Worktree 起服务（6398 Redis、API、web），浏览器打开 Hub：
1. 拖 opus-47 到第一位 → 松手 → 看网络面板 PUT 200
2. 刷新页面 → opus-47 还是第一
3. 打开 @ picker → opus-47 第一个
4. 把它拖回中间 → 顺序跟随
5. 截图三张附 PR

---

## Task 7: Quality Gate 全量自检

```bash
# Biome + types
pnpm check
pnpm lint

# 后端测试（Redis 隔离）
pnpm --filter @cat-cafe/api test:redis

# 前端测试
pnpm --filter @cat-cafe/web test

# 目录尺寸
pnpm check:dir-size

# 文件行数（config.ts 接近上限时考虑抽 cat-order-routes.ts）
```

全绿后加载 `request-review` 发给砚砚 review。

---

## Non-Goals & Future

- **touch 事件**：移动端拖拽目前不支持（Risk 里已列），未来单独 P3 ticket 用 `pointerdown/move/up`
- **per-user 顺序**：单用户架构下没需求，以后多租户再加 userId 维度
- **breed 分组模式 toggle**：可能的后续增强（"按品种分组 vs 自由排序"切换），当前 out-of-scope

---

## File Budget

| 新建 | 行数估计 |
|------|---------|
| `cat-order-store.ts` | 40 |
| `cat-order-store.test.js` | 45 |
| `cat-order-route.test.js` | 60 |
| `user-preferences.ts` | 8 |
| `sort-cats-by-order.ts` | 15 |
| `sort-cats-by-order.test.ts` | 45 |
| `use-cat-data-order.test.tsx` | 40 |
| `cat-overview-drag.test.tsx` | 55 |
| `cat-overview-drag-rollback.test.tsx` | 35 |

| 修改 | 预计 diff |
|------|---------|
| `routes/config.ts` | +35 |
| `hooks/useCatData.ts` | +30 |
| `components/config-viewer-tabs.tsx` | +45 |
| `components/HubMemberOverviewCard.tsx` | +15 |
| `shared/src/index.ts` | +1 |

总体 ~475 行（含测试），全部在各自文件 200 行警告线内。`config.ts` 目前已经 401 行，Task 2 +35 会超 350 硬上限 —— **Task 2 末尾需抽出 `packages/api/src/routes/config-cat-order.ts` 子路由文件**，`config.ts` 里 `app.register(catOrderRoutes)` 挂载。
