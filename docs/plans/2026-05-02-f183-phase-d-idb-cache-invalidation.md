---
feature_ids: [F183]
related_features: [F164, F123, F081]
topics: [websocket, idb, offline, cache, invalidation, identity-contract]
doc_kind: plan
created: 2026-05-02
---

# F183 Phase D — IDB Cache Invalidation Contract

**Feature:** F183 — `docs/features/F183-bubble-pipeline-architecture-consolidation.md`
**Goal:** 让 IDB 从"渲染路径上的合并源"降级为"网络断开时的 offline fallback"，并加 schema-version invalidation 防 identity contract 升级后老快照污染界面。
**Acceptance Criteria:** AC-D1（schema 升级 hook）+ AC-D2（在线时 API replace、不参与 merge）。Phase D 落地后剩 AC-Z1 (5 类症状全消)、Phase E (closure + alpha soak) 的事。
**Architecture:** F164 已建好 IDB layer (`offline-store.ts` write-through + cold-start read)。Phase D 不重写架构，只加两件事：(1) `SCHEMA_VERSION` 字段 + DB upgrade hook 检测到 mismatch 直接清两个 store；(2) `useChatHistory` API 成功路径不再走 `mergeReplaceHydrationMessages`，IDB-origin 消息直接被覆盖；live-origin（active stream/draft）通过现有 stable-identity 仍受保护。
**Tech Stack:** TypeScript + Vitest + idb (already in use)
**前端验证:** Yes — Playwright/Chrome 验 (1) 在线 F5 不闪老气泡 (2) 断网 F5 仍走 IDB fallback (3) schema bump 后老 IDB 数据被清

---

## TL;DR — Scope

**做 (in scope)**：
- IDB DB_VERSION bump + schema upgrade hook（删掉 stale stores）
- `messages` 标记 `cachedFrom: 'idb'`（仅当从 `loadCachedMessages` hydrate 时打）
- `mergeReplaceHydrationMessages` 加 IDB-origin filter：API 成功路径，cachedFrom='idb' 的 local 消息不再 preserve（让 history 直接 win）
- F164 AC-A3 instant-render preserved：cold-start 还是先 IDB 渲染，再 API 替换（没 flicker）
- 新增 unit tests + 集成测试覆盖 4 个场景（schema bump / online API replace / offline API failure / live state protection）

**不做 (out of scope)**：
- Service Worker / cache strategy 改动（KD-3 保留 NetworkOnly for `/api/*`）
- IDB LRU 淘汰 / 容量上限（F164 OQ-2 保持开放）
- 离线发消息（F164 KD-4 决定不做）
- mergeReplaceHydrationMessages 全删（live state 仍需保护）
- ADR-033 BubbleEvent enum 升级 hook（schema_version 是 invalidation 触发器，不是 enum diff）

**Open Question (decided)**：
- ~~OQ-D1: 在线 F5 是否保持 instant cache render？~~ **是。** F164 AC-A3 不能退。先 IDB 渲染 → API 来了直接 replace，IDB-origin 不 preserve。

---

## Architecture Decisions

### KD-D1: schema-version 触发器 = `SCHEMA_VERSION` 常量 + DB_VERSION 联动

```ts
const SCHEMA_VERSION = 2;  // bump on identity contract changes
const DB_VERSION = 2;      // sync with SCHEMA_VERSION
```

DB upgrade hook 直接 clear 两个 store。**不做 migration**——bubble 快照是非真相源 (KD-1: API 是 SoT)，丢就丢，下次 hydration 自动 rebuild。

**为什么不做 enum diff hook**：ADR-033 的 BubbleEvent/BubbleKind 是 server contract，前端 IDB 只存 `ChatMessageData`（id/content/origin/extra）。enum 变了只影响 reducer 行为，不直接污染 IDB schema。SCHEMA_VERSION 留给"我们自己改了 IDB 字段"或"identity 字段语义变了"时手动 bump。

### KD-D2: live state 保留通过 stable-identity，不通过新 origin filter

`mergeReplaceHydrationMessages` 已经按 stable-identity 匹配。IDB-origin filter 只是"local 没 history match 时是否 preserve"那个分支的细化：cachedFrom='idb' → drop；其他（live placeholder / queued draft）→ preserve。

### KD-D3: offline 检测复用 fetch failure，不依赖 navigator.onLine

`navigator.onLine` 不可靠（captive portal 会撒谎）。fetchHistory 已有 try/catch；失败路径就是 offline 信号，IDB 自然作为 fallback 留在 store 里。**不写新的 online state ledger**——加一层不必要的复杂度。

---

## Implementation

### Task 1: IDB schema_version invalidation

**Files:**
- Modify: `packages/web/src/utils/offline-store.ts`
- Test: `packages/web/src/utils/__tests__/offline-store.test.ts`

**Step 1: Write failing test**

```ts
it('AC-D1: bumps DB_VERSION drops stale stores', async () => {
  // Seed v1 schema with old data
  await openDB('cat-cafe-offline', 1, { upgrade(db) { db.createObjectStore('threads', { keyPath: 'id' }); } });
  // Bump version → upgrade hook should clear
  _resetDBForTest();
  // Force open at v2 via the production code
  const t = await loadThreads();
  assert.equal(t, null, 'stale v1 data should be cleared after schema bump');
});
```

**Step 2: Run, expect fail (no version bump yet)**

**Step 3: Implement schema bump**

```ts
const DB_VERSION = 2;  // was 1
const SCHEMA_VERSION = 2;  // new const

function getDB() {
  // ...
  upgrade(db, oldVersion, newVersion) {
    // Bump = identity contract changed; drop stale snapshots (rebuilt from API on next hydration)
    if (oldVersion < newVersion && oldVersion > 0) {
      for (const name of Array.from(db.objectStoreNames)) {
        db.deleteObjectStore(name);
      }
    }
    if (!db.objectStoreNames.contains('threads')) {
      db.createObjectStore('threads', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('thread-messages')) {
      db.createObjectStore('thread-messages', { keyPath: 'threadId' });
    }
  },
  // ...
}
```

**Step 4: Re-run test → green**

**Step 5: Commit**
```bash
git commit -m "feat(F183-D): IDB schema-version invalidation hook (AC-D1)"
```

### Task 2: Mark IDB-loaded messages with `cachedFrom: 'idb'`

**Files:**
- Modify: `packages/web/src/utils/offline-store.ts` (return type) — actually NO field on persisted record (don't pollute IDB), inject at load time
- Modify: `packages/web/src/hooks/useChatHistory.ts` (where `loadCachedMessages` result is fed into store)
- Modify: `packages/web/src/stores/chat-types.ts` (add optional field on `ChatMessageData`)

**Step 1: Add field to ChatMessageData**

```ts
interface ChatMessageData {
  // ...existing
  /** F183 Phase D — set when message was loaded from IDB cache. Used by
   *  hydration merge to differentiate cache-derived vs live state. Stripped
   *  on next save so it doesn't pollute the IDB. */
  cachedFrom?: 'idb';
}
```

**Step 2: Stamp on load** (in `useChatHistory.ts` IDB cold-start path)

```ts
const cached = await loadCachedMessages(threadId);
if (cached) {
  const stamped = cached.messages.map((m) => ({ ...m, cachedFrom: 'idb' as const }));
  setReplaceMessages(stamped, cached.hasMore);
}
```

**Step 3: Strip on save** (in `offline-store.ts saveThreadMessages`)

```ts
const persistable = messages
  .filter((m) => !m.isStreaming)
  .map(({ cachedFrom: _drop, ...rest }) => rest);  // strip transient marker
```

**Step 4: Tests**

```ts
it('AC-D2: cachedFrom flag stripped before persisting', async () => {
  await saveThreadMessages('t1', [{ id: '1', cachedFrom: 'idb', /* ... */ }], false);
  const reloaded = await loadThreadMessages('t1');
  assert.equal(reloaded.messages[0].cachedFrom, undefined);
});
```

**Step 5: Commit**
```bash
git commit -m "feat(F183-D): cachedFrom marker for IDB-origin messages"
```

### Task 3: `mergeReplaceHydrationMessages` skips preserve for IDB-origin

**Files:**
- Modify: `packages/web/src/hooks/useChatHistory.ts` (mergeReplaceHydrationMessages function)
- Test: `packages/web/src/hooks/__tests__/useChatHistory-idb-fallback.test.ts` (new)

**Step 1: Write 3 failing tests**

```ts
describe('AC-D2 IDB downgrade — online API authoritative', () => {
  it('cachedFrom=idb message dropped when history does not contain it (server deleted)', () => {
    const history = [];
    const current = [{ id: 'msg-cached', cachedFrom: 'idb', /* ... */ }];
    const result = mergeReplaceHydrationMessages(history, current, {});
    assert.equal(result.messages.length, 0, 'IDB cache message should not survive when history clean');
    assert.equal(result.stats.preservedLocalCount, 0);
  });

  it('live placeholder (no cachedFrom) preserved when not in history', () => {
    const history = [];
    const current = [{ id: 'live-1', isStreaming: true, /* no cachedFrom */ }];
    const result = mergeReplaceHydrationMessages(history, current, {});
    assert.equal(result.messages.length, 1, 'live placeholder must survive hydration');
    assert.equal(result.stats.preservedLocalCount, 1);
  });

  it('cachedFrom=idb with id-match in history → reconciled to history (existing behavior)', () => {
    const history = [{ id: 'm1', content: 'fresh from server' }];
    const current = [{ id: 'm1', content: 'stale from IDB', cachedFrom: 'idb' }];
    const result = mergeReplaceHydrationMessages(history, current, {});
    assert.equal(result.messages[0].content, 'fresh from server');
  });
});
```

**Step 2: Implement filter**

In the `else` branch (no match → preserve as local), add:
```ts
} else {
  // F183 Phase D: IDB-origin (cachedFrom='idb') messages are NOT preserved
  // when history doesn't contain them. They're cache copies; let server
  // truth (history) be authoritative. Only live state (no cachedFrom) gets
  // the preserve-local treatment.
  if (msg.cachedFrom === 'idb') {
    continue;  // drop — history wins
  }
  preservedLocalCount++;
  // ...existing preserve-local logic
}
```

**Step 3: Run all 3 tests → green**

**Step 4: Commit**
```bash
git commit -m "feat(F183-D): mergeReplaceHydrationMessages drops IDB-origin on no-match (AC-D2)"
```

### Task 4: Integration test — full IDB → API → replace flow

**Files:**
- Test: `packages/web/src/hooks/__tests__/useChatHistory-idb-fallback.test.ts` (extend)

**Step 1: Write integration tests**

```ts
it('AC-D2 online: IDB cache rendered first, then API replaces without merge artifacts', async () => {
  // 1. Seed IDB with a message that backend has since deleted
  await saveThreadMessages('t1', [{ id: 'deleted-msg', /* ... */ }], false);
  // 2. Mock API to return empty history
  mockFetchOnce({ messages: [], hasMore: false });
  // 3. Render hook + trigger hydration
  // 4. After API resolves, current state should NOT contain deleted-msg
  assert.equal(getMessages().filter((m) => m.id === 'deleted-msg').length, 0);
});

it('AC-D2 offline: API failure preserves IDB cache as fallback', async () => {
  await saveThreadMessages('t1', [{ id: 'msg-1', /* ... */ }], false);
  mockFetchOnce(() => { throw new Error('network down'); });
  // After API fails, IDB-loaded message should remain visible
  assert.equal(getMessages().filter((m) => m.id === 'msg-1').length, 1);
});
```

**Step 2: Run, fix, green, commit**

```bash
git commit -m "test(F183-D): integration coverage for IDB online-replace + offline-fallback"
```

### Task 5: F183 spec sync + plan close

**Files:**
- Modify: `docs/features/F183-bubble-pipeline-architecture-consolidation.md`

**Step 1: Mark AC-D1, AC-D2 [x] in Phase D AC section**

**Step 2: Add Timeline entry**

```
| 2026-05-02 | **Phase D done** — PR #XXXX squash merged (`<sha>`). IDB schema-version invalidation + cachedFrom marker + mergeReplaceHydrationMessages drops IDB-origin on no-match. F164 AC-A3 instant-render preserved. |
```

**Step 3: Commit + push**

---

## Risks

| 风险 | 缓解 |
|------|------|
| F164 AC-A3 退化（instant render 闪一下又消失） | 保留 cold-start IDB → 渲染路径；API 成功只是 replace 不是先 clear。视觉上看到的依然是"先有内容再更新"，不是"先空白再有内容"。 |
| cachedFrom 字段污染 IDB（持久化后下次 load 又带回来） | `saveThreadMessages` strip 时显式过滤；测试覆盖 round-trip 不带 cachedFrom |
| schema bump 误删用户活跃数据 | DB_VERSION 已经从 1→2 的 hook 安全：onUpgrade 只在版本不匹配时触发；同一版本 reload 不删 |
| Live state 误判被丢（漏 cachedFrom 标记） | live state 来源 (active stream / queued draft / WebSocket event) **从不** 经过 `loadCachedMessages` 路径，所以不会被打 cachedFrom；测试覆盖 live placeholder 必须 survive |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-D1 | F164 AC-A3 instant-render 是否保留？ | ✅ 保留（铲屎官 2026-04-16 立 F164 时的核心需求） |
| OQ-D2 | SCHEMA_VERSION 何时 bump？ | 由后续 PR 修改 IDB 字段语义时主动 bump，现在初始 1→2 一次（落地 hook） |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-02 | Plan landed; 铲屎官 "走起" 拍板 Phase D 方向 |
