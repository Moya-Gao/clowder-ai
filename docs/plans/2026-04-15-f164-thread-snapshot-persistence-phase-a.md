---
feature_ids: [F164]
topics: [frontend, persistence, offline, IndexedDB]
doc_kind: phase
created: 2026-04-15
---

# F164 Phase A: IndexedDB Snapshot + Cache-First Hydration — Implementation Plan

**Feature:** F164 — `docs/features/F164-thread-snapshot-persistence.md`
**Goal:** F5 after disconnect shows cached threads + messages from IndexedDB, not blank page.
**Acceptance Criteria:** AC-A1 ~ AC-A6（详见 feat doc）
**Architecture:** Add `idb` library, create `offline-store.ts` for IndexedDB CRUD, wire write-through into `chatStore` save points, change `ThreadSidebar` and `useChatHistory` to cache-first hydration, add offline badge.
**Tech Stack:** `idb` (~1.2KB gzip), IndexedDB (`cat-cafe-offline` database), Vitest
**前端验证:** Yes — must manually test F5 + disconnect scenario

---

## Straight-Line Check

**Finish line:** User presses F5 while offline → sees thread list + recent messages from IndexedDB snapshot → offline badge visible. When network returns, API fetch replaces snapshot seamlessly.

**Not building:** Full offline chat, Service Worker API caching, connection state indicators (Phase B), send degradation (Phase B), CDN self-hosting (Phase B).

**Terminal schema:**

```typescript
// IndexedDB: cat-cafe-offline, version 1
// Store: "threads"    — keyPath: "id"
//   { id: "thread-list", threads: Thread[], updatedAt: number }
//
// Store: "thread-messages" — keyPath: "threadId"
//   { threadId: string, messages: ChatMessageData[], hasMore: boolean, updatedAt: number }
```

**Integration points (write-through):**
1. `chatStore.setThreads()` → save thread list to IDB
2. `chatStore.setCurrentThread()` → save outgoing thread's messages to IDB (piggyback on existing `snapshotActive`)
3. `useChatHistory.fetchHistory()` success → save fetched messages to IDB

**Integration points (cache-first read):**
1. `ThreadSidebar` mount → read IDB threads first, then kick off API
2. `useChatHistory` bootstrap → read IDB messages if no `threadStates` cache, then kick off API

---

## Task 1: Add `idb` dependency

**Files:**
- Modify: `packages/web/package.json`

**Step 1: Install idb**

```bash
cd packages/web && pnpm add idb
```

**Step 2: Verify install**

```bash
pnpm ls idb
```

Expected: `idb` version listed

**Step 3: Commit**

```bash
git add packages/web/package.json pnpm-lock.yaml
git commit -m "chore(F164): add idb dependency for IndexedDB offline snapshot [宪宪/Opus-46🐾]"
```

---

## Task 2: Create `offline-store.ts` — IndexedDB CRUD

**Files:**
- Create: `packages/web/src/utils/offline-store.ts`

**Step 1: Write the failing test**

Create `packages/web/src/utils/__tests__/offline-store.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We'll use fake-indexeddb for testing
import 'fake-indexeddb/auto';

describe('offline-store', () => {
  let offlineStore: typeof import('../offline-store');

  beforeEach(async () => {
    vi.resetModules();
    // Delete any leftover DB
    indexedDB.deleteDatabase('cat-cafe-offline');
    offlineStore = await import('../offline-store');
  });

  afterEach(() => {
    indexedDB.deleteDatabase('cat-cafe-offline');
  });

  describe('threads', () => {
    it('returns null when no threads saved', async () => {
      const result = await offlineStore.loadThreads();
      expect(result).toBeNull();
    });

    it('saves and loads threads', async () => {
      const threads = [
        { id: 'thread_1', title: 'Test Thread', projectPath: 'default' },
      ] as any[];
      await offlineStore.saveThreads(threads);
      const loaded = await offlineStore.loadThreads();
      expect(loaded).toHaveLength(1);
      expect(loaded![0].id).toBe('thread_1');
    });

    it('overwrites previous threads on re-save', async () => {
      await offlineStore.saveThreads([{ id: 't1' }] as any[]);
      await offlineStore.saveThreads([{ id: 't2' }, { id: 't3' }] as any[]);
      const loaded = await offlineStore.loadThreads();
      expect(loaded).toHaveLength(2);
      expect(loaded![0].id).toBe('t2');
    });
  });

  describe('thread messages', () => {
    it('returns null when no messages saved', async () => {
      const result = await offlineStore.loadThreadMessages('thread_1');
      expect(result).toBeNull();
    });

    it('saves and loads messages for a thread', async () => {
      const messages = [
        { id: 'msg_1', content: [{ type: 'text', text: 'hello' }] },
        { id: 'msg_2', content: [{ type: 'text', text: 'world' }] },
      ] as any[];
      await offlineStore.saveThreadMessages('thread_1', messages, true);
      const result = await offlineStore.loadThreadMessages('thread_1');
      expect(result).not.toBeNull();
      expect(result!.messages).toHaveLength(2);
      expect(result!.hasMore).toBe(true);
    });

    it('trims to last MAX_SNAPSHOT_MESSAGES', async () => {
      const messages = Array.from({ length: 80 }, (_, i) => ({
        id: `msg_${i}`,
        content: [{ type: 'text', text: `msg ${i}` }],
      })) as any[];
      await offlineStore.saveThreadMessages('thread_1', messages, true);
      const result = await offlineStore.loadThreadMessages('thread_1');
      expect(result!.messages).toHaveLength(50);
      // Should keep the LAST 50 (most recent)
      expect(result!.messages[0].id).toBe('msg_30');
    });

    it('stores messages per-thread independently', async () => {
      await offlineStore.saveThreadMessages('t1', [{ id: 'm1' }] as any[], false);
      await offlineStore.saveThreadMessages('t2', [{ id: 'm2' }] as any[], true);
      const r1 = await offlineStore.loadThreadMessages('t1');
      const r2 = await offlineStore.loadThreadMessages('t2');
      expect(r1!.messages[0].id).toBe('m1');
      expect(r2!.messages[0].id).toBe('m2');
    });
  });

  describe('clearAll', () => {
    it('removes all cached data', async () => {
      await offlineStore.saveThreads([{ id: 't1' }] as any[]);
      await offlineStore.saveThreadMessages('t1', [{ id: 'm1' }] as any[], false);
      await offlineStore.clearAll();
      expect(await offlineStore.loadThreads()).toBeNull();
      expect(await offlineStore.loadThreadMessages('t1')).toBeNull();
    });
  });
});
```

**Step 2: Install test dependency + run test to verify it fails**

```bash
cd packages/web && pnpm add -D fake-indexeddb
pnpm vitest run src/utils/__tests__/offline-store.test.ts
```

Expected: FAIL — module `../offline-store` not found.

**Step 3: Write the implementation**

Create `packages/web/src/utils/offline-store.ts`:

```typescript
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Thread, ChatMessage } from '../stores/chat-types';

const DB_NAME = 'cat-cafe-offline';
const DB_VERSION = 1;
const MAX_SNAPSHOT_MESSAGES = 50;

interface CatCafeOfflineDB extends DBSchema {
  threads: {
    key: string;
    value: { id: string; threads: Thread[]; updatedAt: number };
  };
  'thread-messages': {
    key: string;
    value: {
      threadId: string;
      messages: ChatMessage[];
      hasMore: boolean;
      updatedAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<CatCafeOfflineDB>> | null = null;

function getDB(): Promise<IDBPDatabase<CatCafeOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CatCafeOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('threads')) {
          db.createObjectStore('threads', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('thread-messages')) {
          db.createObjectStore('thread-messages', { keyPath: 'threadId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveThreads(threads: Thread[]): Promise<void> {
  const db = await getDB();
  await db.put('threads', {
    id: 'thread-list',
    threads,
    updatedAt: Date.now(),
  });
}

export async function loadThreads(): Promise<Thread[] | null> {
  const db = await getDB();
  const record = await db.get('threads', 'thread-list');
  return record?.threads ?? null;
}

export async function saveThreadMessages(
  threadId: string,
  messages: ChatMessage[],
  hasMore: boolean,
): Promise<void> {
  const db = await getDB();
  const trimmed = messages.slice(-MAX_SNAPSHOT_MESSAGES);
  await db.put('thread-messages', {
    threadId,
    messages: trimmed,
    hasMore,
    updatedAt: Date.now(),
  });
}

export async function loadThreadMessages(
  threadId: string,
): Promise<{ messages: ChatMessage[]; hasMore: boolean; updatedAt: number } | null> {
  const db = await getDB();
  const record = await db.get('thread-messages', threadId);
  return record ?? null;
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['threads', 'thread-messages'], 'readwrite');
  await Promise.all([
    tx.objectStore('threads').clear(),
    tx.objectStore('thread-messages').clear(),
    tx.done,
  ]);
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/utils/__tests__/offline-store.test.ts
```

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add packages/web/src/utils/offline-store.ts packages/web/src/utils/__tests__/offline-store.test.ts packages/web/package.json pnpm-lock.yaml
git commit -m "feat(F164): add offline-store IndexedDB CRUD for thread/message snapshots [宪宪/Opus-46🐾]"
```

---

## Task 3: Wire write-through into `chatStore.ts`

**Files:**
- Modify: `packages/web/src/stores/chatStore.ts:1238` (setThreads)
- Modify: `packages/web/src/stores/chatStore.ts:1284-1301` (setCurrentThread)

Write-through is fire-and-forget (async, no await in set callback). Errors are swallowed — IDB write failure should never break the main app.

**Step 1: Add write-through to `setThreads`**

In `chatStore.ts`, change `setThreads` (line 1238) from:

```typescript
setThreads: (threads) => set({ threads }),
```

to:

```typescript
setThreads: (threads) => {
  set({ threads });
  void saveThreadsSnapshot(threads);
},
```

Add at top of file (after other imports):

```typescript
import { saveThreads as saveThreadsSnapshot, saveThreadMessages as saveMessagesSnapshot } from '../utils/offline-store';
```

**Step 2: Add write-through to `setCurrentThread`**

In `chatStore.ts`, inside `setCurrentThread` (lines 1284-1301), after `snapshotActive()` saves to threadStates, add IDB write for the outgoing thread's messages:

Change:

```typescript
setCurrentThread: (threadId) =>
  set((state) => {
    if (threadId === state.currentThreadId) return state;

    // Save current flat state to map
    const saved = snapshotActive(state);
```

to:

```typescript
setCurrentThread: (threadId) =>
  set((state) => {
    if (threadId === state.currentThreadId) return state;

    // Save current flat state to map
    const saved = snapshotActive(state);
    // F164: Write-through to IndexedDB (fire-and-forget)
    if (saved.messages.length > 0) {
      void saveMessagesSnapshot(state.currentThreadId, saved.messages, saved.hasMore);
    }
```

**Step 3: Run existing chatStore tests to verify no regression**

```bash
pnpm --filter @cat-cafe/web vitest run --reporter=verbose 2>&1 | head -80
```

Expected: All existing tests pass; no regressions.

**Step 4: Commit**

```bash
git add packages/web/src/stores/chatStore.ts
git commit -m "feat(F164): wire write-through to IndexedDB on setThreads + setCurrentThread [宪宪/Opus-46🐾]"
```

---

## Task 4: Wire write-through from `useChatHistory` fetch success

**Files:**
- Modify: `packages/web/src/hooks/useChatHistory.ts:490-525` (after replaceMessages/prependHistory)

After a successful history fetch writes messages to the store, also snapshot to IDB.

**Step 1: Add IDB save after successful fetch**

Add import at top of `useChatHistory.ts`:

```typescript
import { saveThreadMessages as saveMessagesSnapshot } from '../utils/offline-store';
```

In `fetchHistory` (around line 525), just before the final `return` at the end of the try block, after `prependHistory`/`replaceMessages`, add:

```typescript
// F164: Snapshot fetched messages to IndexedDB (fire-and-forget)
const snapshotState = useChatStore.getState();
if (snapshotState.currentThreadId === fetchForThread) {
  void saveMessagesSnapshot(fetchForThread, snapshotState.messages, data.hasMore ?? false);
}
```

**Step 2: Verify no regression**

```bash
pnpm --filter @cat-cafe/web vitest run --reporter=verbose 2>&1 | head -80
```

**Step 3: Commit**

```bash
git add packages/web/src/hooks/useChatHistory.ts
git commit -m "feat(F164): snapshot messages to IndexedDB after successful history fetch [宪宪/Opus-46🐾]"
```

---

## Task 5: Cache-first hydration in `ThreadSidebar.tsx`

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx:105-131`

Change `loadThreads` to: read IDB first → render → then fetch API → replace.

**Step 1: Modify loadThreads for cache-first**

Add import:

```typescript
import { loadThreads as loadCachedThreads } from '../../utils/offline-store';
```

Replace the `loadThreads` callback (lines 105-125) with:

```typescript
const loadThreads = useCallback(async () => {
  setLoadingThreads(true);

  // F164: Cache-first — show IndexedDB snapshot immediately
  try {
    const cached = await loadCachedThreads();
    if (cached && cached.length > 0) {
      setThreads(cached);
      // Restore unread state from cached threads
      const { initThreadUnread } = useChatStore.getState();
      for (const thread of cached) {
        if (thread.unreadCount > 0 || thread.hasUserMention) {
          initThreadUnread(thread.id, thread.unreadCount ?? 0, !!thread.hasUserMention);
        }
      }
    }
  } catch {
    // IDB read failure — continue to API
  }

  // Then fetch fresh data from API (replace snapshot if successful)
  try {
    const res = await apiFetch('/api/threads');
    if (!res.ok) return;
    const data = await res.json();
    const threads = data.threads ?? [];
    setThreads(threads); // This also triggers IDB write-through via chatStore
    const { initThreadUnread } = useChatStore.getState();
    for (const thread of threads) {
      if (thread.unreadCount > 0 || thread.hasUserMention) {
        initThreadUnread(thread.id, thread.unreadCount ?? 0, !!thread.hasUserMention);
      }
    }
  } catch {
    // API failed — IDB snapshot already displayed (if available)
  } finally {
    setLoadingThreads(false);
  }
}, [setThreads, setLoadingThreads]);
```

**Step 2: Verify no regression**

```bash
pnpm --filter @cat-cafe/web vitest run --reporter=verbose 2>&1 | head -80
```

**Step 3: Commit**

```bash
git add packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx
git commit -m "feat(F164): cache-first thread loading from IndexedDB snapshot [宪宪/Opus-46🐾]"
```

---

## Task 6: Cache-first hydration in `useChatHistory.ts`

**Files:**
- Modify: `packages/web/src/hooks/useChatHistory.ts:695-770` (bootstrap logic)

When `threadStates` has no cache AND IDB has a snapshot, use it before fetching API.

**Step 1: Add IDB read to bootstrap**

Add import (if not already from Task 4):

```typescript
import { loadThreadMessages as loadCachedMessages } from '../utils/offline-store';
```

In the `bootstrap` function (around line 728), modify the `!hasCachedMessages` branch:

Change:

```typescript
const bootstrap = async () => {
  if (!hasCachedMessages) {
    if (isThreadSynced) {
      clearMessages();
    }
    await fetchHistory();
  } else if (hasActiveInvocation || (cached && cached.unreadCount > 0) || hasUnstableBubbleIdentity) {
```

to:

```typescript
const bootstrap = async () => {
  if (!hasCachedMessages) {
    // F164: Try IndexedDB snapshot before API fetch
    try {
      const idbSnapshot = await loadCachedMessages(threadId);
      if (idbSnapshot && idbSnapshot.messages.length > 0) {
        replaceMessages(idbSnapshot.messages, idbSnapshot.hasMore);
      } else if (isThreadSynced) {
        clearMessages();
      }
    } catch {
      if (isThreadSynced) clearMessages();
    }
    // Always fetch fresh data from API (replace snapshot)
    await fetchHistory(undefined, { replace: true });
  } else if (hasActiveInvocation || (cached && cached.unreadCount > 0) || hasUnstableBubbleIdentity) {
```

**Step 2: Verify no regression**

```bash
pnpm --filter @cat-cafe/web vitest run --reporter=verbose 2>&1 | head -80
```

**Step 3: Commit**

```bash
git add packages/web/src/hooks/useChatHistory.ts
git commit -m "feat(F164): cache-first message loading from IndexedDB snapshot [宪宪/Opus-46🐾]"
```

---

## Task 7: Offline snapshot badge

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` (add badge state)
- Modify: `packages/web/src/hooks/useChatHistory.ts` (expose snapshot source)

Lightweight approach: add a `isOfflineSnapshot` state that's true when displaying IDB data, cleared when API succeeds.

**Step 1: Add snapshot source tracking to chatStore**

In `packages/web/src/stores/chatStore.ts`, add to the ChatState interface (around line 460):

```typescript
/** F164: True when messages are from offline snapshot, not fresh API data */
isOfflineSnapshot: boolean;
```

Initial value (around line 687):

```typescript
isOfflineSnapshot: false,
```

Add setter (near setLoadingHistory):

```typescript
setOfflineSnapshot: (v: boolean) => set({ isOfflineSnapshot: v }),
```

**Step 2: Set/clear in ThreadSidebar and useChatHistory**

In `ThreadSidebar.tsx` `loadThreads`:
- After IDB cache applied: `useChatStore.getState().setOfflineSnapshot(true);` (but only for the sidebar's loading indicator — we need a separate `isThreadsOfflineSnapshot` or we can reuse the same flag since messages and threads load together)

Actually, simpler: track at the chat level. In `useChatHistory.ts`:
- After IDB snapshot applied (`replaceMessages(idbSnapshot.messages, ...)`): call `set({ isOfflineSnapshot: true })`
- After API `fetchHistory` succeeds and replaces: call `set({ isOfflineSnapshot: false })`

In `chatStore.ts` `replaceMessages`, no change needed — the flag is set/cleared by the callers.

**Step 3: Render badge in chat area**

In the chat message area component (wherever the message list renders), add a small banner when `isOfflineSnapshot` is true:

```tsx
{isOfflineSnapshot && (
  <div className="offline-snapshot-badge">
    离线快照 · 显示的是上次缓存的内容
  </div>
)}
```

Exact component and styling TBD during implementation — locate the message list wrapper and add there.

**Step 4: Verify and commit**

```bash
pnpm --filter @cat-cafe/web vitest run --reporter=verbose 2>&1 | head -80
git add -A && git commit -m "feat(F164): add offline snapshot badge indicator [宪宪/Opus-46🐾]"
```

---

## Task 8: Integration verification

**Manual test plan:**

1. **Normal flow**: Open app → browse threads → switch threads → verify IDB has data (DevTools → Application → IndexedDB → `cat-cafe-offline`)
2. **Offline F5 (AC-A1, AC-A2)**: DevTools → Network → Offline → F5 → verify thread list + messages visible from snapshot
3. **Online F5 (AC-A3)**: Network → Online → F5 → verify quick flash of cached data then API replaces
4. **Offline badge (AC-A4)**: While offline, verify "离线快照" badge visible; goes away when API succeeds
5. **No stale transient state (AC-A5)**: After offline restore, verify no phantom "typing" indicators or stale queue items
6. **Performance (AC-A6)**: Check that IDB writes don't block message rendering — no visible jank on message send

**Step 1: Run full test suite**

```bash
pnpm --filter @cat-cafe/web vitest run
```

**Step 2: Run Biome check**

```bash
pnpm check
```

**Step 3: Run type check**

```bash
pnpm lint
```

**Step 4: Final commit (if any fixes needed)**

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| IDB write slows main thread | Fire-and-forget (`void`), never `await` in render path |
| IDB unavailable (private browsing) | All IDB calls wrapped in try-catch, degrade to current behavior |
| Stale snapshot shows deleted messages | API fetch always replaces; badge warns user |
| Blob URLs in messages invalid after restore | Acceptable — API refresh replaces them; better than blank page |

## File Change Summary

| File | Change |
|------|--------|
| `packages/web/package.json` | Add `idb`, `fake-indexeddb` (dev) |
| `packages/web/src/utils/offline-store.ts` | **New** — IndexedDB CRUD |
| `packages/web/src/utils/__tests__/offline-store.test.ts` | **New** — Unit tests |
| `packages/web/src/stores/chatStore.ts` | Import + write-through in `setThreads`/`setCurrentThread` + `isOfflineSnapshot` state |
| `packages/web/src/hooks/useChatHistory.ts` | Import + cache-first read in bootstrap + IDB save after fetch |
| `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` | Import + cache-first thread loading |
| Message list component (TBD) | Offline snapshot badge |
