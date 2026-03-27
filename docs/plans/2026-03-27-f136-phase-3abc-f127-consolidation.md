---
feature_ids: [F136, F127]
topics: [config, hot-reload, event-bus, cat-catalog, refactor]
doc_kind: plan
created: 2026-03-27
---

# F136 Phase 3A/3B/3C — F127 收编 Implementation Plan

**Feature:** F136 — `docs/features/F136-unified-config-hot-reload.md`
**Goal:** 把 F127 的 ad-hoc 热更新机制（路由里内联 reconcile → callback）收编到 F136 统一 ConfigEventBus 管线，每步产物是终态基座
**Acceptance Criteria:**
- AC-1: 猫猫 CRUD（POST/PATCH/DELETE /api/cats）后，registry 同步通过 event bus subscriber 完成，不再通过 inline callback
- AC-2: `runtime-cat-catalog.ts` 只做 CRUD + 验证，无 side effect 触发逻辑
- AC-3: `cats.ts` 路由不再持有 `onCatalogChanged` callback，route handler 里无 reconcile 调用
- AC-4: 旧 callback 管道的死代码全部删除
- AC-5: 所有现有 `cats-routes-runtime-crud.test.js` 测试继续通过（行为不变）
**Architecture:** 猫猫 CRUD 操作后，路由 emit `ConfigChangeEvent { source: 'cat-config' }` → 新 `CatCatalogSubscriber` 订阅 → 执行 reconcile + syncAgentRegistry。模式与 Phase 2 的 `ConnectorReloadSubscriber` 对称。
**Tech Stack:** Node.js, Fastify, ConfigEventBus (Phase 1)
**前端验证:** No — 纯后端 event 管道重构，API 契约不变

---

## Not Building

- 不改 API 契约（请求/响应 schema 不变）
- 不改 `runtime-cat-catalog.ts` 的 CRUD 函数签名
- 不新增 debounce（猫猫 CRUD 是用户触发的低频操作，不需要防抖）
- 不改前端

## Terminal Schema

```typescript
// 新增 subscriber（终态，Phase 3A 产物）
interface CatCatalogSubscriberOpts {
  projectRoot: string;
  syncAgentRegistry: (cats: Record<string, CatConfig>) => Promise<void>;
  log: { info(...args: unknown[]): void; warn(...args: unknown[]): void };
}
interface CatCatalogSubscriberHandle {
  unsubscribe(): void;
}

// cats.ts 路由 emit 的 event（复用现有 ConfigChangeEvent）
// { source: 'cat-config', scope: 'domain', changedKeys: [catId], changeSetId, timestamp }
```

---

## Phase 3A — Event Bus Subscriber（终态 subscriber）

### Task 1: Write `cat-catalog-subscriber.ts`

**Files:**
- Create: `packages/api/src/config/cat-catalog-subscriber.ts`
- Test: `packages/api/test/cat-catalog-subscriber.test.js`

**Step 1: Write failing test — subscriber triggers reconcile on cat-config event**

```javascript
// test/cat-catalog-subscriber.test.js
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { configEventBus, createChangeSetId } from '../dist/config/config-event-bus.js';

const { createCatCatalogSubscriber } = await import('../dist/config/cat-catalog-subscriber.js');

describe('CatCatalogSubscriber', () => {
  it('calls reconcile on cat-config event', async () => {
    const reconcileCalled = mock.fn(async () => {});
    const sub = createCatCatalogSubscriber({
      onReconcile: reconcileCalled,
      log: { info() {}, warn() {} },
    });
    configEventBus.emitChange({
      source: 'cat-config',
      scope: 'domain',
      changedKeys: ['test-cat'],
      changeSetId: createChangeSetId(),
      timestamp: Date.now(),
    });
    // Give microtask queue time to flush
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(reconcileCalled.mock.callCount(), 1);
    sub.unsubscribe();
  });

  it('ignores non-cat-config events', () => {
    const reconcileCalled = mock.fn(async () => {});
    const sub = createCatCatalogSubscriber({
      onReconcile: reconcileCalled,
      log: { info() {}, warn() {} },
    });
    configEventBus.emitChange({
      source: 'env',
      scope: 'key',
      changedKeys: ['SOME_VAR'],
      changeSetId: createChangeSetId(),
      timestamp: Date.now(),
    });
    assert.equal(reconcileCalled.mock.callCount(), 0);
    sub.unsubscribe();
  });

  it('unsubscribe stops listening', () => {
    const reconcileCalled = mock.fn(async () => {});
    const sub = createCatCatalogSubscriber({
      onReconcile: reconcileCalled,
      log: { info() {}, warn() {} },
    });
    sub.unsubscribe();
    configEventBus.emitChange({
      source: 'cat-config',
      scope: 'domain',
      changedKeys: ['test-cat'],
      changeSetId: createChangeSetId(),
      timestamp: Date.now(),
    });
    assert.equal(reconcileCalled.mock.callCount(), 0);
  });
});
```

**Step 2: Run test → RED**

```bash
pnpm --filter @cat-cafe/api test -- --test-name-pattern "CatCatalogSubscriber" test/cat-catalog-subscriber.test.js
```
Expected: FAIL — module not found

**Step 3: Implement subscriber**

```typescript
// src/config/cat-catalog-subscriber.ts
import { type ConfigChangeEvent, configEventBus } from './config-event-bus.js';

export interface CatCatalogSubscriberOpts {
  onReconcile: () => Promise<void>;
  log: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
  };
}

export interface CatCatalogSubscriberHandle {
  unsubscribe(): void;
}

function isCatCatalogChange(event: ConfigChangeEvent): boolean {
  return event.source === 'cat-config';
}

export function createCatCatalogSubscriber(opts: CatCatalogSubscriberOpts): CatCatalogSubscriberHandle {
  const listener = (event: ConfigChangeEvent): void => {
    if (!isCatCatalogChange(event)) return;
    opts.log.info('[CatCatalogSubscriber] Cat catalog changed, reconciling registry...');
    opts.onReconcile().catch((err) => {
      opts.log.warn('[CatCatalogSubscriber] Reconcile failed:', err);
    });
  };

  const unsub = configEventBus.onConfigChange(listener);

  return {
    unsubscribe() {
      unsub();
    },
  };
}
```

**Step 4: Run test → GREEN**

```bash
pnpm --filter @cat-cafe/api build && pnpm --filter @cat-cafe/api test -- --test-name-pattern "CatCatalogSubscriber" test/cat-catalog-subscriber.test.js
```

**Step 5: Commit**

```
feat(F136): add CatCatalogSubscriber for cat-config event bus [3A-1]
```

---

### Task 2: Move `reconcileCatRegistry` + emit event from routes

**Files:**
- Modify: `packages/api/src/routes/cats.ts` — remove `onCatalogChanged` callback, emit ConfigChangeEvent after CRUD
- Modify: `packages/api/src/index.ts` — wire subscriber instead of callback, move `reconcileCatRegistry` + `syncAgentRegistry` into subscriber setup
- Test: existing `packages/api/test/cats-routes-runtime-crud.test.js` must stay green

**Step 1: Write failing integration test — route CRUD triggers event bus**

```javascript
// Add to test/cat-catalog-subscriber.test.js
describe('CatCatalogSubscriber integration', () => {
  it('cat-config event carries the changed catId in changedKeys', async () => {
    let receivedEvent = null;
    const unsub = configEventBus.onConfigChange((e) => {
      if (e.source === 'cat-config') receivedEvent = e;
    });
    configEventBus.emitChange({
      source: 'cat-config',
      scope: 'domain',
      changedKeys: ['my-new-cat'],
      changeSetId: createChangeSetId(),
      timestamp: Date.now(),
    });
    assert.ok(receivedEvent);
    assert.deepEqual(receivedEvent.changedKeys, ['my-new-cat']);
    unsub();
  });
});
```

**Step 2: Refactor `cats.ts`**

Key changes:
1. Import `configEventBus` + `createChangeSetId`
2. Remove `CatsRoutesOptions.onCatalogChanged` — routes no longer take a callback
3. Keep `reconcileCatRegistry()` as a **local function** but remove the `onCatalogChanged` param
4. After each `reconcileCatRegistry()` call, emit `ConfigChangeEvent`
5. `reconcileCatRegistry` still reloads catRegistry (it must — routes need the return value for response)

```typescript
// cats.ts changes (conceptual diff):

// REMOVE:
// interface CatsRoutesOptions { onCatalogChanged?: ... }

// ADD imports:
import { configEventBus, createChangeSetId } from '../config/config-event-bus.js';

// CHANGE reconcileCatRegistry — remove onCatalogChanged param:
async function reconcileCatRegistry(projectRoot: string, managedIdsBefore: ReadonlySet<string>) {
  // ... same reload logic, but no callback ...
  const allCats = catRegistry.getAllConfigs();
  // NO: await onCatalogChanged?.(allCats);
  return allCats;
}

// AFTER each reconcileCatRegistry call in POST/PATCH/DELETE, emit event:
const resolved = await reconcileCatRegistry(projectRoot, managedIdsBefore);
configEventBus.emitChange({
  source: 'cat-config',
  scope: 'domain',
  changedKeys: [catId],          // the affected cat's id
  changeSetId: createChangeSetId(),
  timestamp: Date.now(),
});
```

**Step 3: Refactor `index.ts`**

Key changes:
1. Remove `{ onCatalogChanged: syncAgentRegistry }` from `catsRoutes` registration
2. Create `CatCatalogSubscriber` that calls `reconcileAndSync()`
3. `reconcileAndSync` = reload catRegistry from disk + call `syncAgentRegistry`

```typescript
// index.ts changes (conceptual diff):

// ADD import:
import { createCatCatalogSubscriber } from './config/cat-catalog-subscriber.js';

// CHANGE route registration:
// BEFORE: await app.register(catsRoutes, { onCatalogChanged: syncAgentRegistry });
// AFTER:
await app.register(catsRoutes);

// ADD subscriber wiring (after agentRegistry setup):
const catCatalogSubscriber = createCatCatalogSubscriber({
  async onReconcile() {
    app.log.info('[api] F136: Cat catalog changed, syncing agent registry...');
    const allCats = catRegistry.getAllConfigs();
    await syncAgentRegistry(allCats);
  },
  log: app.log,
});
// Add to cleanup
```

**Step 4: Run full CRUD test suite → GREEN**

```bash
pnpm --filter @cat-cafe/api build && pnpm --filter @cat-cafe/api test -- test/cats-routes-runtime-crud.test.js
```

**Step 5: Run subscriber test → GREEN**

```bash
pnpm --filter @cat-cafe/api test -- test/cat-catalog-subscriber.test.js
```

**Step 6: Commit**

```
refactor(F136): route CRUD emits cat-config event, subscriber handles sync [3A-2]
```

---

## Phase 3B — `runtime-cat-catalog` 收敛（终态存储层）

**Analysis:** `runtime-cat-catalog.ts` is **already pure CRUD + validation**. It exports `createRuntimeCat`, `updateRuntimeCat`, `deleteRuntimeCat`, `readRuntimeCatCatalog` — all pure functions that read/write JSON and validate. No side effects, no event emission, no registry calls.

**Conclusion:** Phase 3B requires **zero code changes** to `runtime-cat-catalog.ts`. The "ad-hoc trigger paths" that the spec references are in `cats.ts` (the route layer), not in the catalog module itself. Phase 3A already handles those.

### Task 3: Verify and document

**Step 1: Audit `runtime-cat-catalog.ts` exports**

Verify no function calls `catRegistry`, `agentRegistry`, `configEventBus`, or any side-effect-producing code. Grep results should be empty:

```bash
grep -n 'catRegistry\|agentRegistry\|configEventBus\|eventBus\|reconcile' packages/api/src/config/runtime-cat-catalog.ts
```

**Step 2: If clean, update feature doc Phase 3B → ✅ with "already pure" note**

No commit needed beyond doc sync (which happens at merge).

---

## Phase 3C — Delete Dead Code

### Task 4: Remove old callback plumbing

**Files:**
- Modify: `packages/api/src/routes/cats.ts` — delete `CatsRoutesOptions` interface if empty (or remove `onCatalogChanged` field)
- Modify: `packages/api/src/index.ts` — confirm no dead `onCatalogChanged` references remain
- Test: full suite green

**Note:** If Task 2 already fully removes `CatsRoutesOptions` and the callback, Task 4 is a no-op. This task exists as a safety net to catch any lingering references.

**Step 1: Grep for dead code**

```bash
grep -rn 'onCatalogChanged\|CatsRoutesOptions' packages/api/src/
```

Expected: 0 results (already cleaned in Task 2)

**Step 2: If any remain, delete them**

**Step 3: Run full test suite**

```bash
pnpm --filter @cat-cafe/api build && pnpm --filter @cat-cafe/api test
```

**Step 4: Commit (if changes)**

```
refactor(F136): remove dead callback plumbing from cats routes [3C]
```

---

## Summary

| Task | Phase | What | Est. Lines Changed |
|------|-------|------|-------------------|
| 1 | 3A | New `CatCatalogSubscriber` + tests | +80 new |
| 2 | 3A | Route emit + index.ts subscriber wiring | ~40 changed |
| 3 | 3B | Audit — already pure (no changes expected) | 0 |
| 4 | 3C | Dead code cleanup (likely no-op after Task 2) | ~5 deleted |

**Total:** ~120 lines new/changed. Small, surgical refactor. API contract unchanged.
