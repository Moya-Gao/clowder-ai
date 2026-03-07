# F069 Thread Read State — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** F5 刷新后未读 badge 正确恢复 — 后端 read-state 真相源 + 前端 API 恢复

**Architecture:** 新建独立的 `ThreadReadStateStore`（port + Redis 实现），per-user/per-thread 存储 `lastReadMessageId`。`GET /api/threads` hydrate `unreadCount` + `hasUserMention`。新增 `PATCH /api/threads/:id/read` 做 ack。前端初始化从 API 恢复，打开线程时 ack，保留 WebSocket optimistic 更新。

**Tech Stack:** Redis Hash + Sorted Set 查询 | Fastify route | Zustand store | node:test

**NOT building:** 多设备实时同步（WebSocket push ack）、read receipts UI、per-message 已读

---

## Terminal Schema

```typescript
// Port: packages/api/src/domains/cats/services/stores/ports/ThreadReadStateStore.ts
export interface ThreadReadState {
  userId: string;
  threadId: string;
  lastReadMessageId: string;
  updatedAt: number;
}

export interface ThreadUnreadSummary {
  threadId: string;
  unreadCount: number;
  hasUserMention: boolean;
}

export interface IThreadReadStateStore {
  /** Get read cursor for a user+thread. Returns null if never read. */
  get(userId: string, threadId: string): ThreadReadState | null | Promise<ThreadReadState | null>;
  /** Ack: advance cursor (monotonic — only moves forward). Returns true if advanced. */
  ack(userId: string, threadId: string, messageId: string): boolean | Promise<boolean>;
  /** Bulk get unread summaries for all threads of a user. */
  getUnreadSummaries(userId: string, threadIds: string[], messageStore: IMessageStore): ThreadUnreadSummary[] | Promise<ThreadUnreadSummary[]>;
  /** Cleanup: delete read state for a thread (cascade on thread delete). */
  deleteByThread(threadId: string): void | Promise<void>;
}
```

```typescript
// API response shape change for GET /api/threads
interface ThreadWithUnread extends Thread {
  unreadCount?: number;      // 0 when no unread
  hasUserMention?: boolean;  // false when no mention
}
```

---

## Task 1: Port — IThreadReadStateStore interface

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/ports/ThreadReadStateStore.ts`

**Step 1: Create the port file**

```typescript
// ThreadReadStateStore.ts
import type { IMessageStore } from './MessageStore.js';

export interface ThreadReadState {
  userId: string;
  threadId: string;
  lastReadMessageId: string;
  updatedAt: number;
}

export interface ThreadUnreadSummary {
  threadId: string;
  unreadCount: number;
  hasUserMention: boolean;
}

export interface IThreadReadStateStore {
  get(userId: string, threadId: string): ThreadReadState | null | Promise<ThreadReadState | null>;
  ack(userId: string, threadId: string, messageId: string): boolean | Promise<boolean>;
  getUnreadSummaries(
    userId: string,
    threadIds: string[],
    messageStore: IMessageStore,
  ): ThreadUnreadSummary[] | Promise<ThreadUnreadSummary[]>;
  deleteByThread(threadId: string): void | Promise<void>;
}
```

**Step 2: Commit**
```bash
git add packages/api/src/domains/cats/services/stores/ports/ThreadReadStateStore.ts
git commit -m "feat(F069): add IThreadReadStateStore port interface"
```

---

## Task 2: Redis keys

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/redis-keys/read-state-keys.ts`

**Step 1: Create redis key patterns**

```typescript
// read-state-keys.ts
export const ReadStateKeys = {
  /** Hash: read-state:{userId}:{threadId} → { lastReadMessageId, updatedAt } */
  cursor: (userId: string, threadId: string) => `read-state:${userId}:${threadId}`,
  /** Pattern for cleanup: read-state:*:{threadId} */
  threadPattern: (threadId: string) => `read-state:*:${threadId}`,
} as const;
```

**Step 2: Commit**
```bash
git add packages/api/src/domains/cats/services/stores/redis-keys/read-state-keys.ts
git commit -m "feat(F069): add Redis key patterns for read state"
```

---

## Task 3: Redis implementation — RedisThreadReadStateStore

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/redis/RedisThreadReadStateStore.ts`

**Step 1: Write the failing test**

Create `packages/api/test/redis-read-state-store.test.js`:

```javascript
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRedisIsolationOrThrow,
  cleanupPrefixedRedisKeys,
} from './helpers/redis-test-helpers.js';

const REDIS_URL = process.env['REDIS_URL'];

describe('RedisThreadReadStateStore', { skip: !REDIS_URL ? 'REDIS_URL not set' : false }, () => {
  let RedisThreadReadStateStore;
  let RedisMessageStore;
  let createRedisClient;
  let redis;
  let store;
  let messageStore;
  let connected = false;

  before(async () => {
    assertRedisIsolationOrThrow(REDIS_URL, 'RedisThreadReadStateStore');
    const storeModule = await import('../dist/domains/cats/services/stores/redis/RedisThreadReadStateStore.js');
    RedisThreadReadStateStore = storeModule.RedisThreadReadStateStore;
    const msgModule = await import('../dist/domains/cats/services/stores/redis/RedisMessageStore.js');
    RedisMessageStore = msgModule.RedisMessageStore;
    const redisModule = await import('@cat-cafe/shared/utils');
    createRedisClient = redisModule.createRedisClient;

    redis = createRedisClient({ url: REDIS_URL });
    try {
      await redis.ping();
      connected = true;
    } catch {
      console.warn('[redis-read-state-store.test] Redis unreachable, skipping');
      await redis.quit().catch(() => {});
      return;
    }
    store = new RedisThreadReadStateStore(redis);
    messageStore = new RedisMessageStore(redis, { ttlSeconds: 60 });
  });

  after(async () => {
    if (redis && connected) {
      await cleanupPrefixedRedisKeys(redis, ['read-state:*', 'msg:*']);
      await redis.quit();
    }
  });

  beforeEach(async (t) => {
    if (!connected) return t.skip('Redis not connected');
    await cleanupPrefixedRedisKeys(redis, ['read-state:*', 'msg:*']);
  });

  it('get() returns null for unread thread', async () => {
    const result = await store.get('user1', 'thread1');
    assert.equal(result, null);
  });

  it('ack() sets cursor and get() retrieves it', async () => {
    const advanced = await store.ack('user1', 'thread1', 'msg-001');
    assert.equal(advanced, true);

    const state = await store.get('user1', 'thread1');
    assert.equal(state.userId, 'user1');
    assert.equal(state.threadId, 'thread1');
    assert.equal(state.lastReadMessageId, 'msg-001');
    assert.ok(state.updatedAt > 0);
  });

  it('ack() monotonic: rejects older message ID', async () => {
    await store.ack('user1', 'thread1', 'msg-002');
    const advanced = await store.ack('user1', 'thread1', 'msg-001');
    assert.equal(advanced, false);

    const state = await store.get('user1', 'thread1');
    assert.equal(state.lastReadMessageId, 'msg-002');
  });

  it('ack() monotonic: accepts newer message ID', async () => {
    await store.ack('user1', 'thread1', 'msg-001');
    const advanced = await store.ack('user1', 'thread1', 'msg-003');
    assert.equal(advanced, true);

    const state = await store.get('user1', 'thread1');
    assert.equal(state.lastReadMessageId, 'msg-003');
  });

  it('getUnreadSummaries() counts unread messages', async () => {
    // Append 3 messages to thread1
    const m1 = await messageStore.append({ userId: 'user1', catId: 'opus', content: 'hello', mentions: [], timestamp: Date.now() - 3000, threadId: 'thread1' });
    const m2 = await messageStore.append({ userId: 'user1', catId: 'opus', content: 'world', mentions: [], timestamp: Date.now() - 2000, threadId: 'thread1' });
    await messageStore.append({ userId: 'user1', catId: 'opus', content: 'test', mentions: [], timestamp: Date.now() - 1000, threadId: 'thread1' });

    // Mark first message as read
    await store.ack('user1', 'thread1', m1.id);

    const summaries = await store.getUnreadSummaries('user1', ['thread1'], messageStore);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].threadId, 'thread1');
    assert.equal(summaries[0].unreadCount, 2); // m2 and m3 are unread
    assert.equal(summaries[0].hasUserMention, false);
  });

  it('getUnreadSummaries() detects mentionsUser', async () => {
    const m1 = await messageStore.append({ userId: 'user1', catId: 'opus', content: 'hello', mentions: [], timestamp: Date.now() - 2000, threadId: 'thread2' });
    await messageStore.append({ userId: 'user1', catId: 'opus', content: '@铲屎官 look', mentions: [], mentionsUser: true, timestamp: Date.now() - 1000, threadId: 'thread2' });

    await store.ack('user1', 'thread2', m1.id);

    const summaries = await store.getUnreadSummaries('user1', ['thread2'], messageStore);
    assert.equal(summaries[0].hasUserMention, true);
  });

  it('getUnreadSummaries() returns 0 for fully read thread', async () => {
    const m1 = await messageStore.append({ userId: 'user1', catId: 'opus', content: 'hello', mentions: [], timestamp: Date.now(), threadId: 'thread3' });
    await store.ack('user1', 'thread3', m1.id);

    const summaries = await store.getUnreadSummaries('user1', ['thread3'], messageStore);
    assert.equal(summaries[0].unreadCount, 0);
  });

  it('getUnreadSummaries() treats no cursor as all unread', async () => {
    await messageStore.append({ userId: 'user1', catId: 'opus', content: 'hello', mentions: [], timestamp: Date.now(), threadId: 'thread4' });
    await messageStore.append({ userId: 'user1', catId: 'opus', content: 'world', mentions: [], timestamp: Date.now(), threadId: 'thread4' });

    const summaries = await store.getUnreadSummaries('user1', ['thread4'], messageStore);
    assert.equal(summaries[0].unreadCount, 2);
  });

  it('deleteByThread() cleans up cursor', async () => {
    await store.ack('user1', 'thread5', 'msg-001');
    await store.deleteByThread('thread5');
    const state = await store.get('user1', 'thread5');
    assert.equal(state, null);
  });
});
```

**Step 2: Run test to verify it fails**
```bash
cd packages/api && pnpm build && pnpm --filter @cat-cafe/api test:redis 2>&1 | grep -E "RedisThreadReadStateStore|FAIL|pass|fail"
```
Expected: FAIL — module not found

**Step 3: Write the Redis implementation**

Create `packages/api/src/domains/cats/services/stores/redis/RedisThreadReadStateStore.ts`:

```typescript
import type { RedisClient } from '@cat-cafe/shared/utils';
import type {
  IThreadReadStateStore,
  ThreadReadState,
  ThreadUnreadSummary,
} from '../ports/ThreadReadStateStore.js';
import type { IMessageStore } from '../ports/MessageStore.js';
import { ReadStateKeys } from '../redis-keys/read-state-keys.js';

export class RedisThreadReadStateStore implements IThreadReadStateStore {
  constructor(private readonly redis: RedisClient) {}

  async get(userId: string, threadId: string): Promise<ThreadReadState | null> {
    const key = ReadStateKeys.cursor(userId, threadId);
    const data = await this.redis.hgetall(key);
    if (!data || !data['lastReadMessageId']) return null;
    return {
      userId,
      threadId,
      lastReadMessageId: data['lastReadMessageId'],
      updatedAt: Number(data['updatedAt'] ?? 0),
    };
  }

  async ack(userId: string, threadId: string, messageId: string): Promise<boolean> {
    const key = ReadStateKeys.cursor(userId, threadId);
    const existing = await this.redis.hget(key, 'lastReadMessageId');

    // Monotonic: only advance
    if (existing && messageId <= existing) return false;

    await this.redis.hset(key, {
      lastReadMessageId: messageId,
      updatedAt: String(Date.now()),
    });
    return true;
  }

  async getUnreadSummaries(
    userId: string,
    threadIds: string[],
    messageStore: IMessageStore,
  ): Promise<ThreadUnreadSummary[]> {
    const summaries: ThreadUnreadSummary[] = [];

    for (const threadId of threadIds) {
      const state = await this.get(userId, threadId);
      const afterId = state?.lastReadMessageId;

      // Get all messages after cursor
      const unreadMessages = await messageStore.getByThreadAfter(threadId, afterId);
      const unreadCount = unreadMessages.length;
      const hasUserMention = unreadMessages.some((m) => !!m.mentionsUser);

      summaries.push({ threadId, unreadCount, hasUserMention });
    }

    return summaries;
  }

  async deleteByThread(threadId: string): Promise<void> {
    // Scan for all read-state keys matching this thread
    const pattern = ReadStateKeys.threadPattern(threadId);
    let cursor = '0';
    do {
      const result = await this.redis.scan(Number(cursor), { MATCH: pattern, COUNT: 100 });
      cursor = String(result.cursor);
      if (result.keys.length > 0) {
        await this.redis.del(result.keys);
      }
    } while (cursor !== '0');
  }
}
```

**Step 4: Run tests to verify they pass**
```bash
cd packages/api && pnpm build && pnpm --filter @cat-cafe/api test:redis
```
Expected: all RedisThreadReadStateStore tests PASS

**Step 5: Commit**
```bash
git add packages/api/src/domains/cats/services/stores/redis/RedisThreadReadStateStore.ts \
       packages/api/test/redis-read-state-store.test.js
git commit -m "feat(F069): RedisThreadReadStateStore — cursor + unread summaries"
```

---

## Task 4: Factory + DI wiring

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/factories/ReadStateStoreFactory.ts`
- Modify: `packages/api/src/index.ts` (~line 136, add store creation)
- Modify: `packages/api/src/routes/threads.ts` (add to options interface)

**Step 1: Create factory**

```typescript
// ReadStateStoreFactory.ts
import type { RedisClient } from '@cat-cafe/shared/utils';
import type { IThreadReadStateStore } from '../ports/ThreadReadStateStore.js';
import { RedisThreadReadStateStore } from '../redis/RedisThreadReadStateStore.js';

export function createReadStateStore(redis?: RedisClient): IThreadReadStateStore | undefined {
  if (!redis) return undefined;
  return new RedisThreadReadStateStore(redis);
}
```

**Step 2: Wire into index.ts**

After line ~136 (`const draftStore = createDraftStore(redis);`), add:
```typescript
const readStateStore = createReadStateStore(redis);
```

In the `threadsRoutes` registration (~line 333), add `readStateStore`:
```typescript
await app.register(threadsRoutes, {
  threadStore,
  messageStore,
  // ...existing...
  readStateStore,
});
```

**Step 3: Add to ThreadsRoutesOptions**

In `threads.ts`, add import and option:
```typescript
import type { IThreadReadStateStore } from '../domains/cats/services/stores/ports/ThreadReadStateStore.js';

// In ThreadsRoutesOptions:
readStateStore?: IThreadReadStateStore;
```

**Step 4: Commit**
```bash
git add packages/api/src/domains/cats/services/stores/factories/ReadStateStoreFactory.ts \
       packages/api/src/index.ts \
       packages/api/src/routes/threads.ts
git commit -m "feat(F069): wire ReadStateStore into DI + route options"
```

---

## Task 5: PATCH /api/threads/:id/read — ack endpoint

**Files:**
- Modify: `packages/api/src/routes/threads.ts`
- Create: `packages/api/test/thread-read-state-api.test.js`

**Step 1: Write the failing test**

```javascript
// test/thread-read-state-api.test.js — HTTP-level test for PATCH /api/threads/:id/read
// Use Fastify inject pattern (see existing test files for reference)
```

Test cases:
1. `PATCH /api/threads/:id/read` with `{ upToMessageId }` → 200 + `{ advanced: true }`
2. Same message again → 200 + `{ advanced: false }` (monotonic)
3. Missing `upToMessageId` → 400
4. Unknown thread → 404

**Step 2: Add the route**

In `threads.ts`, after the reveal route, add:
```typescript
// F069: PATCH /api/threads/:id/read — mark thread as read up to messageId
const readAckSchema = z.object({
  upToMessageId: z.string().min(1).max(100),
});

app.patch<{ Params: { id: string } }>('/api/threads/:id/read', async (request, reply) => {
  const userId = resolveUserId(request, {});
  if (!userId) {
    reply.status(401);
    return { error: 'Identity required' };
  }

  if (!opts.readStateStore) {
    reply.status(501);
    return { error: 'Read state store not available' };
  }

  const { id } = request.params;
  const thread = await threadStore.get(id);
  if (!thread) {
    reply.status(404);
    return { error: 'Thread not found' };
  }

  const parseResult = readAckSchema.safeParse(request.body);
  if (!parseResult.success) {
    reply.status(400);
    return { error: 'Invalid request body', details: parseResult.error.issues };
  }

  const advanced = await opts.readStateStore.ack(userId, id, parseResult.data.upToMessageId);
  return { advanced };
});
```

**Step 3: Run tests**
```bash
cd packages/api && pnpm build && node --test test/thread-read-state-api.test.js
```

**Step 4: Commit**
```bash
git commit -m "feat(F069): PATCH /api/threads/:id/read — ack endpoint"
```

---

## Task 6: GET /api/threads — hydrate unreadCount + hasUserMention

**Files:**
- Modify: `packages/api/src/routes/threads.ts` (GET /api/threads handler, ~line 141)

**Step 1: Write the failing test**

Add to `thread-read-state-api.test.js`:
- Append messages to a thread, ack partially → `GET /api/threads` returns `unreadCount` and `hasUserMention` on each thread

**Step 2: Implement hydration**

In `GET /api/threads`, after the current return, add unread hydration:

```typescript
// After filtering, before return:
if (opts.readStateStore && messageStore) {
  const threadIds = threads.map((t) => t.id);
  const summaries = await opts.readStateStore.getUnreadSummaries(userId, threadIds, messageStore);
  const summaryMap = new Map(summaries.map((s) => [s.threadId, s]));
  const threadsWithUnread = threads.map((t) => {
    const summary = summaryMap.get(t.id);
    return {
      ...t,
      unreadCount: summary?.unreadCount ?? 0,
      hasUserMention: summary?.hasUserMention ?? false,
    };
  });
  return { threads: threadsWithUnread };
}

return { threads };
```

**Important:** This goes in the non-featureIds, non-backlogItemIds path. The `featureIds` path returns a different shape, skip hydration there.

**Step 3: Run tests**
```bash
cd packages/api && pnpm build && node --test test/thread-read-state-api.test.js
```

**Step 4: Commit**
```bash
git commit -m "feat(F069): hydrate unreadCount + hasUserMention in GET /api/threads"
```

---

## Task 7: Cascade delete — clean up read state on thread delete

**Files:**
- Modify: `packages/api/src/routes/threads.ts` (DELETE handler, ~line 283)

**Step 1: Add to cascade delete**

In the `Promise.allSettled` array in DELETE handler, add:
```typescript
opts.readStateStore?.deleteByThread(id),
```

**Step 2: Test — delete thread, verify read state is gone**

**Step 3: Commit**
```bash
git commit -m "feat(F069): cascade delete read state on thread deletion"
```

---

## Task 8: Frontend — restore unread from API on load

**Files:**
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` (~line 68)
- Modify: `packages/web/src/stores/chatStore.ts` (add `initThreadUnread` action)
- Modify: `packages/web/src/stores/chat-types.ts` (add action type if needed)

**Step 1: Add `initThreadUnread` action to chatStore**

In `chatStore.ts`, add a new action that bulk-sets unread state from API:

```typescript
// In the actions interface:
initThreadUnread: (threadId: string, unreadCount: number, hasUserMention: boolean) => void;

// Implementation:
initThreadUnread: (threadId, unreadCount, hasUserMention) =>
  set((state) => {
    if (threadId === state.currentThreadId) return state; // Active thread = always 0
    const existing = state.threadStates[threadId] ?? { ...DEFAULT_THREAD_STATE };
    if (existing.unreadCount === unreadCount && existing.hasUserMention === hasUserMention) return state;
    return {
      threadStates: {
        ...state.threadStates,
        [threadId]: { ...existing, unreadCount, hasUserMention },
      },
    };
  }),
```

**Step 2: Update ThreadSidebar loadThreads**

In `ThreadSidebar.tsx` `loadThreads`, after `setThreads(data.threads ?? [])`:

```typescript
// F069: Restore unread state from API
const { initThreadUnread } = useChatStore.getState();
for (const thread of data.threads ?? []) {
  if (thread.unreadCount || thread.hasUserMention) {
    initThreadUnread(thread.id, thread.unreadCount ?? 0, thread.hasUserMention ?? false);
  }
}
```

**Step 3: Commit**
```bash
git commit -m "feat(F069): frontend restore unread state from API on load"
```

---

## Task 9: Frontend — ack on thread open

**Files:**
- Modify: `packages/web/src/components/ChatContainer.tsx` (~line 193, where `clearUnread` is called)

**Step 1: Add ack API call alongside clearUnread**

In `ChatContainer.tsx`, in the existing `useEffect` that calls `clearUnread(threadId)`:

```typescript
useEffect(() => {
  clearUnread(threadId);

  // F069: Tell server we've read up to the latest message
  const state = useChatStore.getState();
  const threadState = threadId === state.currentThreadId
    ? { messages: state.messages }
    : state.threadStates[threadId];
  const messages = threadState?.messages ?? [];
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.id) {
    apiFetch(`/api/threads/${threadId}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upToMessageId: lastMsg.id }),
    }).catch(() => {}); // Best effort
  }
}, [threadId, clearUnread]);
```

**Step 2: Also ack when new messages arrive on active thread**

In `chatStore.ts` `addMessageToThread`, when `threadId === state.currentThreadId`, the message is immediately "read". We should debounce an ack call. But to keep it simple, we can ack when the user **leaves** the thread (switch to another) — the existing `clearUnread` + `snapshotActive` flow already captures the last message. The ack on thread entry already handles F5 recovery.

**Alternative simpler approach:** Only ack on thread entry (covers the F5 case). Messages arriving while viewing are already "read" and will be acked next time the user switches away and back. This is sufficient for MVP.

**Step 3: Commit**
```bash
git commit -m "feat(F069): ack read cursor on thread open"
```

---

## Task 10: Integration test — F5 recovery scenario

**Files:**
- Modify: `packages/api/test/thread-read-state-api.test.js`

**Step 1: Write end-to-end scenario test**

1. Create thread → append 5 messages
2. Ack up to message 2
3. `GET /api/threads` → verify `unreadCount: 3`, `hasUserMention: false`
4. Append a message with `mentionsUser: true`
5. `GET /api/threads` → verify `unreadCount: 4`, `hasUserMention: true`
6. Ack up to last message
7. `GET /api/threads` → verify `unreadCount: 0`, `hasUserMention: false`

**Step 2: Run full test suite**
```bash
cd packages/api && pnpm build && pnpm --filter @cat-cafe/api test:redis
```

**Step 3: Commit**
```bash
git commit -m "test(F069): integration test for F5 unread recovery scenario"
```

---

## Task 11: Build + lint check

**Step 1: Run build and lint**
```bash
pnpm build && pnpm check && pnpm lint
```

**Step 2: Fix any issues**

**Step 3: Final commit if needed**

---

## Summary of files

| Action | File |
|--------|------|
| Create | `packages/api/src/domains/cats/services/stores/ports/ThreadReadStateStore.ts` |
| Create | `packages/api/src/domains/cats/services/stores/redis-keys/read-state-keys.ts` |
| Create | `packages/api/src/domains/cats/services/stores/redis/RedisThreadReadStateStore.ts` |
| Create | `packages/api/src/domains/cats/services/stores/factories/ReadStateStoreFactory.ts` |
| Create | `packages/api/test/redis-read-state-store.test.js` |
| Create | `packages/api/test/thread-read-state-api.test.js` |
| Modify | `packages/api/src/index.ts` (add store creation + inject) |
| Modify | `packages/api/src/routes/threads.ts` (options + PATCH read + GET hydrate + DELETE cascade) |
| Modify | `packages/web/src/stores/chatStore.ts` (add initThreadUnread) |
| Modify | `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` (restore from API) |
| Modify | `packages/web/src/components/ChatContainer.tsx` (ack on open) |
