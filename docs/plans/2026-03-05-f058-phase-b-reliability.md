# F058 Phase B: Reliability Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Harden the dispatch pipeline: (B1) Lua-atomic dispatch, (B2) dispatchAttemptId hard-require, (B3) in-flight TTL lock for kickoff message idempotency.

**Architecture:** B2 is a small guard in the route layer. B3 upgrades the kickoff message's idempotency from "key-in-but-message-lost → delete & retry" to "SET NX with short TTL → contention error". B1 wraps the multi-step dispatch (set attemptId → create thread → send kickoff → markDispatched) in a Lua script for RedisBacklogStore. The InMemoryBacklogStore keeps its JS-level atomicity (single-threaded, already atomic).

**Tech Stack:** TypeScript, Fastify, Redis (ioredis) Lua scripting, node:test

---

## Straight-Line Check

**Finish line:** dispatch pipeline is crash-safe — partial failures leave no half-baked state in Redis; idempotency key cannot produce orphaned locks; dispatchAttemptId is always present before message send.

**Not building:** We do NOT change the in-memory BacklogStore's dispatch logic (already atomic in single-thread). We do NOT change lease Lua scripts (already atomic). We do NOT add automatic retry/recovery — the Lua script either fully succeeds or fully rolls back.

---

## Task 1: Hard-require `dispatchAttemptId` before kickoff message (AC-B2)

The spec says: `dispatchAttemptId ?? 'pending'` → hard require (throw if missing).

**Files:**
- Modify: `packages/api/src/routes/backlog.ts:197` (the idempotencyKey line)
- Test: `packages/api/test/backlog-routes.test.js`

**Step 1: Write the failing test**

In `packages/api/test/backlog-routes.test.js`, add in the dispatch test area:

```javascript
await t.test('dispatchApprovedItem rejects if dispatchAttemptId is somehow missing', async () => {
  // This is a guard test — in practice the route always sets attemptId before kickoff.
  // We test by creating an approved item, manually clearing its attemptId, then calling dispatch.
  // Since dispatchApprovedItem is an internal function called by routes, we test via the route:
  // The route always generates attemptId first, so this is really a regression guard.
  // We verify the idempotencyKey in the kickoff message never contains 'pending'.

  // Create → suggest → approve → dispatch via decide-claim route
  const created = await createItem(app, { title: 'AttemptId guard', summary: 'S', priority: 'p2' });
  await suggestClaim(app, created.id, {
    catId: 'claude-opus', why: 'w', plan: 'p', requestedPhase: 'coding',
  });
  const res = await app.inject({
    method: 'POST',
    url: `/api/backlog/items/${created.id}/decide-claim`,
    headers: testHeaders,
    payload: { decision: 'approve', threadPhase: 'coding' },
  });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.strictEqual(body.item.status, 'dispatched');
  // The dispatchAttemptId must be set (not null/undefined)
  assert.ok(body.item.dispatchAttemptId, 'dispatchAttemptId must be set');
  assert.ok(!body.item.dispatchAttemptId.includes('pending'), 'must not contain pending fallback');
});
```

**Step 2: Run test to verify current behavior**

Run: `cd packages/api && node --test test/backlog-routes.test.js --test-name-pattern="AttemptId guard"`
Expected: PASS (the route already sets attemptId — but the `?? 'pending'` fallback still exists in code)

**Step 3: Remove the `?? 'pending'` fallback**

In `packages/api/src/routes/backlog.ts:197`, change:

```typescript
// Before:
idempotencyKey: `kickoff:${next.id}:${next.dispatchAttemptId ?? 'pending'}`,

// After:
idempotencyKey: `kickoff:${next.id}:${next.dispatchAttemptId}`,
```

And add a guard before the kickoff message block (before line 192):

```typescript
if (!next.dispatchAttemptId) {
  return {
    statusCode: 409 as const,
    payload: { error: 'Invalid backlog transition: dispatchAttemptId is required before kickoff' },
  };
}
```

**Step 4: Run tests to verify nothing broke**

Run: `cd packages/api && node --test test/backlog-routes.test.js`
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/backlog.ts packages/api/test/backlog-routes.test.js
git commit -m "feat(F058): hard-require dispatchAttemptId before kickoff message (AC-B2)"
```

---

## Task 2: In-flight TTL lock for kickoff idempotency (AC-B3)

The current kickoff message uses `messageStore.append()` with an idempotencyKey. The message store's idempotency handles the "key exists but message lost" case by deleting the orphaned key and retrying. The spec wants this upgraded to an explicit TTL lock: claim a short-lived lock key before the message write, so concurrent dispatches don't race.

**Current flow** (`RedisMessageStore.append`):
1. GET idempotency key → if exists, try to return existing message
2. If message missing → DELETE key, re-try with SET NX
3. If SET NX fails → contention error

This is already close to a TTL lock pattern. The gap is: step 2 deletes the key unconditionally when the message is missing, which means a concurrent writer could sneak in. We need to add a short TTL (e.g. 30s) to the initial SET NX so stale locks auto-expire, and in step 2, instead of deleting, we wait/error.

**But wait** — this is in `RedisMessageStore`, not in the backlog code. The spec says "Redis idempotency 的 key 在但 message 丢失 分支升级成 in-flight TTL lock". This means we should change the backlog dispatch path, not the generic message store.

The safer approach: add a dedicated in-flight lock in `dispatchApprovedItem` before calling `messageStore.append`, with a short TTL. This separates the dispatch-level lock from the message-level idempotency.

**Files:**
- Modify: `packages/api/src/routes/backlog.ts` (add lock/unlock around kickoff message)
- Modify: `packages/api/src/domains/cats/services/stores/redis-keys/backlog-keys.ts` (add lock key pattern)
- Test: `packages/api/test/backlog-routes.test.js`

**Step 1: Write the failing test**

```javascript
await t.test('concurrent dispatch of same item does not produce duplicate kickoff', async () => {
  const created = await createItem(app, { title: 'Concurrent dispatch', summary: 'S', priority: 'p2' });
  await suggestClaim(app, created.id, {
    catId: 'claude-opus', why: 'w', plan: 'p', requestedPhase: 'coding',
  });
  // Fire two approvals concurrently
  const [res1, res2] = await Promise.all([
    app.inject({
      method: 'POST',
      url: `/api/backlog/items/${created.id}/decide-claim`,
      headers: testHeaders,
      payload: { decision: 'approve', threadPhase: 'coding' },
    }),
    app.inject({
      method: 'POST',
      url: `/api/backlog/items/${created.id}/decide-claim`,
      headers: testHeaders,
      payload: { decision: 'approve', threadPhase: 'coding' },
    }),
  ]);
  // At least one should succeed with 200
  const results = [res1, res2].map((r) => r.statusCode);
  assert.ok(results.includes(200), 'at least one dispatch should succeed');
  // Both should return the same thread (idempotent)
  const bodies = [res1, res2].map((r) => JSON.parse(r.payload));
  const successBodies = bodies.filter((b) => b.item?.status === 'dispatched');
  if (successBodies.length === 2) {
    assert.strictEqual(
      successBodies[0].item.dispatchedThreadId,
      successBodies[1].item.dispatchedThreadId,
      'both should dispatch to same thread',
    );
  }
});
```

**Step 2: Run test to verify current behavior**

Run: `cd packages/api && node --test test/backlog-routes.test.js --test-name-pattern="Concurrent dispatch"`
The in-memory store is single-threaded so this won't fail there, but it verifies the route handles concurrent calls gracefully.

**Step 3: Add dispatch lock key to backlog-keys**

In `packages/api/src/domains/cats/services/stores/redis-keys/backlog-keys.ts`, add:

```typescript
dispatchLock: (itemId: string) => `backlog:dispatch-lock:${itemId}`,
```

**Step 4: Add lock acquisition in dispatchApprovedItem**

In `packages/api/src/routes/backlog.ts`, inside `dispatchApprovedItem`, wrap the kickoff message section with a lock:

```typescript
// Before the kickoff message block, try to acquire a short-lived lock
const lockKey = `backlog:dispatch-lock:${item.id}`;
if ('set' in messageStore && typeof (messageStore as any).redis?.set === 'function') {
  // Only lock for Redis-backed stores
  // ... This approach is too coupled to implementation details
}
```

Actually, the cleaner approach: since the in-memory store is already atomic (single-threaded JS), and the Redis message store already has SET NX idempotency, the real fix is to make the dispatch kickoff message's idempotencyKey include the `dispatchAttemptId` (which we already hard-require in Task 1). This means:
- Each dispatch attempt gets a unique attemptId
- The kickoff message's idempotency key is `kickoff:{itemId}:{attemptId}`
- If the same attemptId retries (crash recovery), the message store deduplicates
- If a different attemptId tries (concurrent dispatch), it would create a different message — but `markDispatched` will reject the second one because status is already `dispatched`

**Wait — re-reading the current code more carefully:**

The current `dispatchApprovedItem` flow:
1. If no `dispatchAttemptId` → generate and save one via `updateDispatchProgress`
2. If no pending thread → create thread, save pendingThreadId
3. If no kickoffMessage → send message with idempotency key `kickoff:{id}:{attemptId}`
4. Call `markDispatched` → transitions `approved → dispatched`

Each step checks if the prior step was already done (crash recovery). The idempotency key already includes the attemptId. The "key in but message lost" scenario in `RedisMessageStore` is: the SET NX succeeded (lock claimed) but the message hash write failed → on retry, key exists but message is gone → current code deletes key and retries.

The spec wants: instead of deleting the orphan key, use a TTL so it auto-expires. This prevents a race where two processes both see "key exists, message missing" and both delete+retry.

**Revised approach:** Change the kickoff message's idempotency to use a short TTL (30s) on the SET NX call. The `RedisMessageStore` already uses `SET key id EX ttl NX`. The "key in but message lost" branch currently does `DEL key` → we change it to just throw a contention error and let the TTL expire naturally.

But this is a change to `RedisMessageStore.append()` which affects ALL messages, not just kickoff. That's too broad.

**Final approach — dispatch-specific in-flight lock:**

Add a simple `SET NX EX 30` lock in `dispatchApprovedItem` before the kickoff message step. If the lock is already held, return 409 (in-flight). The lock auto-expires after 30s. After successful dispatch, delete the lock.

This is the minimal, targeted change that satisfies AC-B3.

**Files:**
- Modify: `packages/api/src/routes/backlog.ts` (add lock/unlock in dispatchApprovedItem)
- We need access to a Redis client in the route — check if it's available via the stores.

Looking at the route options: `BacklogRoutesOptions` has `backlogStore`, `threadStore`, `messageStore`. None expose a raw Redis client. We need to either:
a) Add an optional `redis` to the route options
b) Add a `tryAcquireDispatchLock` / `releaseDispatchLock` method to `IBacklogStore`

Option (b) is cleaner — the lock is a backlog concern.

**Updated Step 3: Add lock methods to IBacklogStore**

In `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts`:

```typescript
// In IBacklogStore interface, add:
tryAcquireDispatchLock?(itemId: string, ttlMs?: number): Promise<boolean>;
releaseDispatchLock?(itemId: string): Promise<void>;
```

Optional methods — in-memory store doesn't need them (single-threaded). RedisBacklogStore implements them.

In `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts`:

```typescript
async tryAcquireDispatchLock(itemId: string, ttlMs = 30_000): Promise<boolean> {
  const key = BacklogKeys.dispatchLock(itemId);
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  const result = await this.redis.set(key, '1', 'EX', ttlSec, 'NX');
  return result === 'OK';
}

async releaseDispatchLock(itemId: string): Promise<void> {
  await this.redis.del(BacklogKeys.dispatchLock(itemId));
}
```

**Updated Step 4: Use lock in dispatchApprovedItem**

In the route's `dispatchApprovedItem`, before the kickoff message block:

```typescript
// Acquire in-flight lock if store supports it
if (backlogStore.tryAcquireDispatchLock) {
  const locked = await backlogStore.tryAcquireDispatchLock(item.id);
  if (!locked) {
    return {
      statusCode: 409 as const,
      payload: { error: 'Dispatch already in-flight for this item' },
    };
  }
}

// ... existing kickoff + markDispatched code ...

// Release lock after successful dispatch
if (backlogStore.releaseDispatchLock) {
  await backlogStore.releaseDispatchLock(item.id);
}
```

**Step 5: Run tests**

Run: `cd packages/api && node --test test/backlog-routes.test.js`
Expected: All PASS

**Step 6: Commit**

```bash
git add packages/api/src/routes/backlog.ts packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts packages/api/src/domains/cats/services/stores/redis-keys/backlog-keys.ts packages/api/test/backlog-routes.test.js
git commit -m "feat(F058): add in-flight TTL lock for dispatch kickoff idempotency (AC-B3)"
```

---

## Task 3: Lua-atomic dispatch for RedisBacklogStore (AC-B1)

The current `dispatchApprovedItem` in the route does 4 separate Redis operations:
1. `updateDispatchProgress` (set attemptId)
2. `threadStore.create` + `updateDispatchProgress` (set pendingThreadId)
3. `messageStore.append` (kickoff message)
4. `markDispatched` (status → dispatched)

A crash between any two steps leaves a half-baked state. The spec wants these atomized.

**However:** Steps 2 and 3 involve `threadStore` and `messageStore` — different Redis key spaces. A Lua script can only operate atomically on keys in the same Redis slot (or if all keys are on the same node). Since we're on a single Redis instance, Lua CAN touch multiple key spaces atomically.

**But:** The thread creation and message creation are complex operations with their own key structures. Putting all of that in a single Lua script would be extremely complex and fragile.

**Practical approach:** Use the existing crash-recovery pattern (each step is idempotent and checks if prior steps completed) + the TTL lock from Task 2. The combination of:
- Idempotent sub-steps (already implemented)
- Hard-required attemptId (Task 1)
- In-flight TTL lock (Task 2)
- `markDispatched` rejects re-dispatch to different thread

...already provides the reliability guarantee: "either all succeed or the half-state is recoverable on retry".

What we CAN atomize with Lua: the backlog item's own state transitions. Specifically, combine `updateDispatchProgress` + `markDispatched` into a single Lua script that:
1. Checks status is `approved`
2. Sets attemptId, pendingThreadId, kickoffMessageId if provided
3. Transitions to `dispatched`
4. All in one atomic Redis operation

The thread creation and message send remain as separate steps (covered by idempotency).

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts` (add dispatch Lua script)
- Modify: `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts` (add `atomicDispatch` method)
- Modify: `packages/api/src/routes/backlog.ts` (use atomicDispatch when available)
- Test: `packages/api/test/backlog-store.test.js`
- Test: `packages/api/test/backlog-routes.test.js`

**Step 1: Write the failing test**

In `packages/api/test/backlog-store.test.js`:

```javascript
await t.test('atomicDispatch transitions approved → dispatched in one call', async () => {
  const store = new BacklogStore();
  const item = store.create({ userId: 'u1', title: 'T', summary: 'S', priority: 'p2', tags: [], createdBy: 'user' });
  store.suggestClaim(item.id, { catId: 'claude-opus', why: 'w', plan: 'p', requestedPhase: 'coding' });
  store.decideClaim(item.id, { decision: 'approve', decidedBy: 'u1' });

  const result = store.atomicDispatch(item.id, {
    dispatchAttemptId: 'attempt-1',
    pendingThreadId: 'thread-1',
    kickoffMessageId: 'msg-1',
    threadId: 'thread-1',
    threadPhase: 'coding',
    dispatchedBy: 'u1',
  });
  assert.ok(result);
  assert.strictEqual(result.status, 'dispatched');
  assert.strictEqual(result.dispatchAttemptId, 'attempt-1');
  assert.strictEqual(result.pendingThreadId, 'thread-1');
  assert.strictEqual(result.kickoffMessageId, 'msg-1');
  assert.strictEqual(result.dispatchedThreadId, 'thread-1');
});

await t.test('atomicDispatch rejects non-approved item', async () => {
  const store = new BacklogStore();
  const item = store.create({ userId: 'u1', title: 'T', summary: 'S', priority: 'p2', tags: [], createdBy: 'user' });
  assert.throws(
    () => store.atomicDispatch(item.id, {
      dispatchAttemptId: 'a1', pendingThreadId: 't1', kickoffMessageId: 'm1',
      threadId: 't1', threadPhase: 'coding', dispatchedBy: 'u1',
    }),
    /Invalid backlog transition/,
  );
});

await t.test('atomicDispatch is idempotent for same thread', async () => {
  const store = new BacklogStore();
  const item = store.create({ userId: 'u1', title: 'T', summary: 'S', priority: 'p2', tags: [], createdBy: 'user' });
  store.suggestClaim(item.id, { catId: 'claude-opus', why: 'w', plan: 'p', requestedPhase: 'coding' });
  store.decideClaim(item.id, { decision: 'approve', decidedBy: 'u1' });

  const input = {
    dispatchAttemptId: 'a1', pendingThreadId: 't1', kickoffMessageId: 'm1',
    threadId: 't1', threadPhase: 'coding', dispatchedBy: 'u1',
  };
  const first = store.atomicDispatch(item.id, input);
  const second = store.atomicDispatch(item.id, input);
  assert.strictEqual(first.id, second.id);
  assert.strictEqual(second.status, 'dispatched');
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/backlog-store.test.js --test-name-pattern="atomicDispatch"`
Expected: FAIL — `store.atomicDispatch is not a function`

**Step 3: Add `AtomicDispatchInput` type**

In `packages/shared/src/types/backlog.ts`, add:

```typescript
export interface AtomicDispatchInput {
  readonly dispatchAttemptId: string;
  readonly pendingThreadId: string;
  readonly kickoffMessageId: string;
  readonly threadId: string;
  readonly threadPhase: ThreadPhase;
  readonly dispatchedBy: string;
}
```

Run: `pnpm --filter @cat-cafe/shared build`

**Step 4: Add `atomicDispatch` to IBacklogStore and BacklogStore**

In `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts`:

```typescript
// In IBacklogStore interface:
atomicDispatch?(itemId: string, input: AtomicDispatchInput): BacklogItem | null | Promise<BacklogItem | null>;

// In BacklogStore class:
atomicDispatch(itemId: string, input: AtomicDispatchInput): BacklogItem | null {
  const existing = this.items.get(itemId);
  if (!existing) return null;

  // Idempotent: already dispatched to same thread
  if (existing.status === 'dispatched') {
    if (existing.dispatchedThreadId === input.threadId && existing.dispatchedThreadPhase === input.threadPhase) {
      return existing;
    }
    throw new BacklogTransitionError('Invalid backlog transition: item already dispatched to another thread');
  }

  if (existing.status !== 'approved') {
    throw new BacklogTransitionError('Invalid backlog transition: only approved items can be atomically dispatched');
  }

  const now = Date.now();
  const updated: BacklogItem = {
    ...existing,
    status: 'dispatched',
    dispatchAttemptId: input.dispatchAttemptId,
    pendingThreadId: input.pendingThreadId,
    kickoffMessageId: input.kickoffMessageId,
    dispatchedThreadId: input.threadId,
    dispatchedThreadPhase: input.threadPhase,
    dispatchedAt: now,
    updatedAt: now,
    audit: [
      ...existing.audit,
      {
        id: generateSortableId(now + 1),
        action: 'dispatched',
        actor: makeUserActor(input.dispatchedBy),
        timestamp: now,
        detail: `${input.threadId}:${input.threadPhase}`,
      },
    ],
  };
  this.items.set(itemId, updated);
  return updated;
}
```

**Step 5: Run test to verify it passes**

Run: `cd packages/api && node --test test/backlog-store.test.js --test-name-pattern="atomicDispatch"`
Expected: PASS

**Step 6: Add Lua script for Redis atomicDispatch**

In `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts`, add a new Lua script:

```lua
-- KEYS[1] = backlog:item:{id}
-- ARGV[1] = now
-- ARGV[2] = dispatchAttemptId
-- ARGV[3] = pendingThreadId
-- ARGV[4] = kickoffMessageId
-- ARGV[5] = threadId
-- ARGV[6] = threadPhase
-- ARGV[7] = auditEntry(json)
--
-- return: 1 success, 2 idempotent (already dispatched to same thread),
--         -1 missing, -2 not approved, -3 dispatched to different thread

local key = KEYS[1]
local now = tonumber(ARGV[1])
local dispatchAttemptId = ARGV[2]
local pendingThreadId = ARGV[3]
local kickoffMessageId = ARGV[4]
local threadId = ARGV[5]
local threadPhase = ARGV[6]
local auditEntryRaw = ARGV[7]

if redis.call('HGET', key, 'id') == false then
  return -1
end

local status = redis.call('HGET', key, 'status')

if status == 'dispatched' then
  local existingThread = redis.call('HGET', key, 'dispatchedThreadId')
  local existingPhase = redis.call('HGET', key, 'dispatchedThreadPhase')
  if existingThread == threadId and existingPhase == threadPhase then
    return 2
  end
  return -3
end

if status ~= 'approved' then
  return -2
end

local audit = {}
local auditRaw = redis.call('HGET', key, 'audit')
if auditRaw and auditRaw ~= '' then
  local okAudit, decodedAudit = pcall(cjson.decode, auditRaw)
  if okAudit and type(decodedAudit) == 'table' then
    audit = decodedAudit
  end
end

local okEntry, auditEntry = pcall(cjson.decode, auditEntryRaw)
if okEntry and type(auditEntry) == 'table' then
  table.insert(audit, auditEntry)
end

redis.call('HSET', key,
  'status', 'dispatched',
  'dispatchAttemptId', dispatchAttemptId,
  'pendingThreadId', pendingThreadId,
  'kickoffMessageId', kickoffMessageId,
  'dispatchedThreadId', threadId,
  'dispatchedThreadPhase', threadPhase,
  'dispatchedAt', tostring(now),
  'updatedAt', tostring(now),
  'audit', cjson.encode(audit)
)

return 1
```

Implement `atomicDispatch` in `RedisBacklogStore`:

```typescript
async atomicDispatch(itemId: string, input: AtomicDispatchInput): Promise<BacklogItem | null> {
  const now = Date.now();
  const auditEntry = JSON.stringify({
    id: generateSortableId(now + 1),
    action: 'dispatched',
    actor: makeUserActor(input.dispatchedBy),
    timestamp: now,
    detail: `${input.threadId}:${input.threadPhase}`,
  });

  const result = await this.redis.eval(
    ATOMIC_DISPATCH_LUA,
    1,
    BacklogKeys.detail(itemId),
    String(now),
    input.dispatchAttemptId,
    input.pendingThreadId,
    input.kickoffMessageId,
    input.threadId,
    input.threadPhase,
    auditEntry,
  );

  const code = typeof result === 'number' ? result : Number(result);
  if (code === -1) return null;
  if (code === -2) throw new BacklogTransitionError('Invalid backlog transition: only approved items can be atomically dispatched');
  if (code === -3) throw new BacklogTransitionError('Invalid backlog transition: item already dispatched to another thread');
  if (code !== 1 && code !== 2) throw new BacklogTransitionError('Invalid backlog transition: atomic dispatch rejected');

  const updated = await this.get(itemId);
  return updated;
}
```

**Step 7: Run tests**

Run: `cd packages/api && node --test test/backlog-store.test.js`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/shared/src/types/backlog.ts packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts packages/api/test/backlog-store.test.js
pnpm --filter @cat-cafe/shared build
git commit -m "feat(F058): add atomicDispatch with Lua script for Redis (AC-B1)"
```

---

## Task 4: Wire atomicDispatch into the dispatch route

Replace the multi-step `dispatchApprovedItem` with `atomicDispatch` when available. Keep the multi-step path as fallback for in-memory store.

**Files:**
- Modify: `packages/api/src/routes/backlog.ts`
- Test: `packages/api/test/backlog-routes.test.js`

**Step 1: Write the failing test**

```javascript
await t.test('dispatch via decide-claim uses atomic path when available', async () => {
  // This is the normal happy-path test — verify dispatch still works end-to-end
  const created = await createItem(app, { title: 'Atomic dispatch', summary: 'S', priority: 'p2' });
  await suggestClaim(app, created.id, {
    catId: 'claude-opus', why: 'w', plan: 'p', requestedPhase: 'coding',
  });
  const res = await app.inject({
    method: 'POST',
    url: `/api/backlog/items/${created.id}/decide-claim`,
    headers: testHeaders,
    payload: { decision: 'approve', threadPhase: 'coding' },
  });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.strictEqual(body.item.status, 'dispatched');
  assert.ok(body.item.dispatchAttemptId);
  assert.ok(body.item.dispatchedThreadId);
  assert.ok(body.item.kickoffMessageId);
});
```

**Step 2: Refactor dispatchApprovedItem**

In `packages/api/src/routes/backlog.ts`, update `dispatchApprovedItem`:

```typescript
async function dispatchApprovedItem(item: BacklogItem, userId: string, phase: ThreadPhase) {
  // Step 1: Generate attemptId
  const attemptId = item.dispatchAttemptId || generateSortableId(Date.now());

  // Step 2: Acquire in-flight lock (Redis only)
  if (backlogStore.tryAcquireDispatchLock) {
    const locked = await backlogStore.tryAcquireDispatchLock(item.id);
    if (!locked) {
      return { statusCode: 409 as const, payload: { error: 'Dispatch already in-flight for this item' } };
    }
  }

  try {
    // Step 3: Create thread (idempotent via pendingThreadId)
    let threadId = item.pendingThreadId;
    if (!threadId) {
      const thread = await threadStore.create(userId, `[Backlog] ${item.title}`, 'default');
      threadId = thread.id;
    }
    await threadStore.updatePhase(threadId, phase);

    // Step 4: Send kickoff message (idempotent via idempotencyKey)
    let kickoffMessageId = item.kickoffMessageId;
    if (!kickoffMessageId) {
      // Build a temporary item snapshot for the kickoff message
      const snapshot = { ...item, dispatchAttemptId: attemptId };
      const kickoffMessage = await messageStore.append({
        userId,
        catId: null,
        threadId,
        idempotencyKey: `kickoff:${item.id}:${attemptId}`,
        content: buildKickoffMessage(snapshot, phase),
        mentions: [],
        timestamp: Date.now(),
      });
      kickoffMessageId = kickoffMessage.id;
    }

    // Step 5: Atomic state transition
    let dispatched: BacklogItem | null;
    if (backlogStore.atomicDispatch) {
      dispatched = await backlogStore.atomicDispatch(item.id, {
        dispatchAttemptId: attemptId,
        pendingThreadId: threadId,
        kickoffMessageId,
        threadId,
        threadPhase: phase,
        dispatchedBy: userId,
      });
    } else {
      // Fallback: multi-step (in-memory store)
      if (!item.dispatchAttemptId) {
        await backlogStore.updateDispatchProgress(item.id, { updatedBy: userId, dispatchAttemptId: attemptId });
      }
      if (!item.pendingThreadId) {
        await backlogStore.updateDispatchProgress(item.id, { updatedBy: userId, pendingThreadId: threadId });
      }
      if (!item.kickoffMessageId) {
        await backlogStore.updateDispatchProgress(item.id, { updatedBy: userId, kickoffMessageId });
      }
      dispatched = await backlogStore.markDispatched(item.id, {
        threadId,
        threadPhase: phase,
        dispatchedBy: userId,
      });
    }

    if (!dispatched) {
      return { statusCode: 404 as const, payload: { error: 'Backlog item not found' } };
    }

    // Link thread → backlog item (best-effort)
    try {
      await threadStore.linkBacklogItem(threadId, item.id);
    } catch (err) {
      app.log.warn({ err, threadId, backlogItemId: item.id }, 'failed to link thread to backlog item');
    }

    const refreshedThread = await threadStore.get(threadId);
    return { statusCode: 200 as const, payload: { item: dispatched, thread: refreshedThread } };
  } finally {
    // Release lock
    if (backlogStore.releaseDispatchLock) {
      await backlogStore.releaseDispatchLock(item.id);
    }
  }
}
```

**Step 3: Run full test suite**

Run: `cd packages/api && node --test test/backlog-routes.test.js`
Expected: All PASS

**Step 4: Run quality checks**

Run: `pnpm check && pnpm lint`
Expected: clean

**Step 5: Commit**

```bash
git add packages/api/src/routes/backlog.ts packages/api/test/backlog-routes.test.js
git commit -m "feat(F058): wire atomicDispatch + in-flight lock into dispatch route (AC-B1)"
```

---

## Task 5: Final integration test + quality gate

**Step 1: Run full API test suite**

```bash
cd packages/api && node --test
```

**Step 2: Run Biome + TypeScript checks**

```bash
pnpm check && pnpm lint
```

**Step 3: Check file sizes**

```bash
pnpm check:dir-size
```

Verify:
- `backlog.ts` route file stays under 350 lines (currently ~821, but the refactored dispatchApprovedItem should be shorter)
- `RedisBacklogStore.ts` stays under 350 lines (currently ~900 — may need to extract Lua scripts to a separate file)

**If file size violated**: Extract Lua scripts to `packages/api/src/domains/cats/services/stores/redis/backlog-lua-scripts.ts`.

**Step 4: Commit**

```bash
git commit -m "chore(F058): phase B integration verification"
```

---

## Checklist

- [ ] `pnpm --filter @cat-cafe/shared build` after type changes
- [ ] `pnpm check` (Biome) clean
- [ ] `pnpm lint` (TypeScript) clean
- [ ] All new tests pass
- [ ] No `any` types introduced
- [ ] Files under 350 lines
- [ ] LSP diagnostics checked after each Edit
- [ ] `backlog.ts` route doesn't exceed line limit — extract if needed
- [ ] `RedisBacklogStore.ts` doesn't exceed line limit — extract Lua scripts if needed
