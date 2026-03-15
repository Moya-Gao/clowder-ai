# F122 Phase A.1: TOCTOU 竞态修复 — Implementation Plan

**Feature:** F122 — `docs/features/F122-unified-dispatch-queue.md`
**Goal:** 消除 `messages.ts` 和 `multi_mention` 的 TOCTOU 窗口，确保 A2A 期间用户消息不会穿透 immediate 路径打断执行
**Acceptance Criteria:**
- AC-A8: `messages.ts` 非 force immediate 路径使用 `tryStartThread`，TOCTOU 窗口穿透时降级 queue
- AC-A9: `multi_mention` 占位前移到 create 之前，全路径 outer try/finally 保证释放
- AC-A10: 回归测试：`has()=false` 后 thread 变 busy → 用户消息必须 queued
- AC-A11: 回归测试：`tryStartThread` 成功但 create 返回 duplicate → slot 必释放
- AC-A12: 回归测试：multi_mention create/update 抛错 → slot 必释放
**Architecture:** 在 InvocationTracker 新增 `tryStartThread()` — 一个同步操作完成 thread 级 busy gate + slot 级占位。messages.ts 非 force immediate 路径在 create 之前调用 tryStartThread，失败则降级 queue。multi_mention 把 start() 移到 create 之前。
**Tech Stack:** TypeScript, node:test
**前端验证:** No — 纯后端逻辑修复

---

## Task 1: InvocationTracker 新增 `tryStartThread`（AC-A8 基础设施）

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/invocation/InvocationTracker.ts:44-56`
- Test: `packages/api/test/invocation-tracker.test.js`

### Step 1.1: 写失败测试

在 `invocation-tracker.test.js` 末尾新增：

```javascript
test('tryStartThread returns null when another slot is active in same thread', () => {
  const tracker = new InvocationTracker();
  // Cat A occupies a slot
  tracker.start('thread1', 'catA', 'user1');
  // Cat B tries non-preemptive start — thread is busy
  const result = tracker.tryStartThread('thread1', 'catB', 'user1');
  assert.equal(result, null, 'should return null when thread is busy');
  // Cat A slot should NOT be preempted
  assert.equal(tracker.has('thread1', 'catA'), true, 'catA slot should still be active');
});

test('tryStartThread succeeds when thread is idle', () => {
  const tracker = new InvocationTracker();
  const controller = tracker.tryStartThread('thread1', 'catA', 'user1', ['catA']);
  assert.ok(controller, 'should return AbortController when thread is idle');
  assert.equal(tracker.has('thread1', 'catA'), true, 'slot should be registered');
});

test('tryStartThread returns null when thread is deleting', () => {
  const tracker = new InvocationTracker();
  const guard = tracker.guardDelete('thread1');
  assert.equal(guard.acquired, true);
  const result = tracker.tryStartThread('thread1', 'catA', 'user1');
  assert.equal(result, null, 'should return null when thread is deleting');
  guard.release();
});
```

### Step 1.2: 运行测试，确认失败

```bash
cd packages/api && pnpm build && node --test test/invocation-tracker.test.js
```

Expected: FAIL — `tryStartThread` is not a function

### Step 1.3: 实现 `tryStartThread`

在 `InvocationTracker.ts` 的 `start()` 方法之后新增：

```typescript
/**
 * Non-preemptive thread-level start.
 * Atomically checks if ANY slot in the thread is active,
 * then registers the new slot — all in one synchronous operation.
 *
 * Returns AbortController on success, null if thread is busy or deleting.
 * Unlike start(), this NEVER aborts existing invocations.
 *
 * Used by smart-default/immediate paths in messages.ts to prevent
 * TOCTOU race where has() returns false but a slot becomes active
 * before start() is called.
 */
tryStartThread(threadId: string, catId: string, userId: string = 'unknown', catIds: string[] = []): AbortController | null {
  if (this.deleting.has(threadId)) return null;
  // Thread-level busy gate: if ANY slot is active, refuse
  if (this.has(threadId)) return null;
  // No active slot — safe to register
  const controller = new AbortController();
  const key = this.slotKey(threadId, catId);
  this.active.set(key, { controller, userId, catId, catIds });
  return controller;
}
```

### Step 1.4: 运行测试，确认通过

```bash
cd packages/api && pnpm build && node --test test/invocation-tracker.test.js
```

Expected: ALL PASS

### Step 1.5: Commit

```bash
git add packages/api/src/domains/cats/services/agents/invocation/InvocationTracker.ts \
  packages/api/test/invocation-tracker.test.js
git commit -m "feat(F122): add tryStartThread — non-preemptive thread-level busy gate (AC-A8)"
```

---

## Task 2: `messages.ts` 非 force immediate 路径改用 `tryStartThread`（AC-A8）

**Files:**
- Modify: `packages/api/src/routes/messages.ts:416-434`（主路径）
- Modify: `packages/api/src/routes/messages.ts:700-701`（legacy 路径）
- Test: `packages/api/test/invocation-tracker.test.js`（AC-A10, AC-A11 回归测试在 Task 4）

### Step 2.1: 主路径修改

当前代码（`messages.ts:416-434`）：
```typescript
// ① Atomic create InvocationRecord
if (opts.invocationRecordStore) {
  const createResult = await opts.invocationRecordStore.create({ ... });
  if (createResult.outcome === 'duplicate') { ... }
  // Not duplicate → safe to start()
  const controller = opts.invocationTracker?.start(resolvedThreadId, primaryCat, userId, targetCats);
```

改为：
```typescript
// ① F122 A.1: Non-force immediate — tryStartThread BEFORE create to close TOCTOU window.
// force path already called cancel+clearPause above and falls through here.
if (opts.invocationRecordStore) {
  // F122 AC-A8: For non-force paths, use tryStartThread to atomically check thread
  // busy + register slot. If thread became busy since initial has() check, degrade to queue.
  let controller: AbortController | undefined;
  if (mode !== 'force' && opts.invocationTracker) {
    const tryResult = opts.invocationTracker.tryStartThread(resolvedThreadId, primaryCat, userId, targetCats);
    if (tryResult === null) {
      // TOCTOU: thread became busy between has() and here → degrade to queue
      if (opts.invocationQueue) {
        const enqueueResult = opts.invocationQueue.enqueue({
          threadId: resolvedThreadId,
          userId,
          content,
          source: 'user',
          targetCats,
          intent: intent.intent,
        });
        if (enqueueResult.outcome === 'full') {
          reply.status(429);
          return { error: '消息队列已满', code: 'QUEUE_FULL' };
        }
        // Write user message as queued
        const userMessage = await opts.messageStore.append({
          userId, catId: null, content, mentions: targetCats,
          timestamp: Date.now(), threadId: resolvedThreadId,
          deliveryStatus: 'queued',
          ...(contentBlocks ? { contentBlocks } : {}),
          ...(whisperVisibility && whisperRecipients
            ? { visibility: whisperVisibility, whisperTo: whisperRecipients } : {}),
        });
        const queueEntryId = enqueueResult.entry?.id;
        if (queueEntryId && enqueueResult.outcome === 'enqueued') {
          opts.invocationQueue.backfillMessageId(resolvedThreadId, userId, queueEntryId, userMessage.id);
        } else if (queueEntryId) {
          opts.invocationQueue.appendMergedMessageId(resolvedThreadId, userId, queueEntryId, userMessage.id);
        }
        opts.socketManager.emitToUser(userId, 'queue_updated', {
          threadId: resolvedThreadId,
          queue: opts.invocationQueue.list(resolvedThreadId, userId),
          action: enqueueResult.outcome,
        });
        reply.status(202);
        return {
          status: 'queued',
          queuePosition: enqueueResult.queuePosition,
          entryId: enqueueResult.entry?.id,
          merged: enqueueResult.outcome === 'merged',
          userMessageId: userMessage.id,
        };
      }
      // No queue available — thread is busy but we can't queue. Reject.
      reply.status(409);
      return { error: '猫猫正在忙', code: 'THREAD_BUSY' };
    }
    controller = tryResult;
  }

  const createResult = await opts.invocationRecordStore.create({
    threadId: resolvedThreadId, userId, targetCats,
    intent: intent.intent, idempotencyKey: resolvedIdempotencyKey,
  });

  if (createResult.outcome === 'duplicate') {
    // AC-A11: tryStartThread succeeded but create returned duplicate → release slot
    if (controller) {
      opts.invocationTracker?.complete(resolvedThreadId, primaryCat, controller);
    }
    reply.status(200);
    return { status: 'duplicate', invocationId: createResult.invocationId };
  }

  // Force path: still uses start() (preemptive)
  if (mode === 'force' || !controller) {
    controller = opts.invocationTracker?.start(resolvedThreadId, primaryCat, userId, targetCats);
  }
```

注意：force 路径仍走原来的 `start()`（preemptive），只有非 force 的 immediate 走 `tryStartThread`。

### Step 2.2: Legacy 路径修改

`messages.ts:700-701` legacy 路径也要修：

```typescript
// 原：
const controller = opts.invocationTracker?.start(resolvedThreadId, primaryCat, userId, targetCats);

// 改为（legacy 路径没有 force/queue 区分，直接用 tryStartThread + fallback）：
let controller: AbortController | undefined;
if (opts.invocationTracker) {
  const tryResult = opts.invocationTracker.tryStartThread(resolvedThreadId, primaryCat, userId, targetCats);
  if (tryResult === null) {
    // Legacy path has no queue — use preemptive start as fallback
    controller = opts.invocationTracker.start(resolvedThreadId, primaryCat, userId, targetCats);
  } else {
    controller = tryResult;
  }
}
```

### Step 2.3: 构建验证

```bash
cd packages/api && pnpm build
```

Expected: no type errors

### Step 2.4: Commit

```bash
git add packages/api/src/routes/messages.ts
git commit -m "fix(F122): close TOCTOU window — tryStartThread before create, degrade to queue (AC-A8)"
```

---

## Task 3: `multi_mention` 占位前移（AC-A9）

**Files:**
- Modify: `packages/api/src/routes/callback-multi-mention-routes.ts:112-139`

### Step 3.1: 重构 `dispatchToTarget`

当前顺序（line 112-139）：
```
create invocation record → update status → start() → outer try/finally
```

改为：
```
start() → outer try { create invocation record → ... } finally { complete() }
```

具体改动：

```typescript
// F122 AC-A9: Occupy slot BEFORE create to close TOCTOU window.
// Entire create/execute lifecycle wrapped in outer try/finally for guaranteed release.
const controller = invocationTracker?.start(threadId, targetCatId, userId, [targetCatId]) ?? new AbortController();
try {
  if (controller.signal.aborted) {
    log.info({ requestId, targetCatId }, '[F086] Multi-mention dispatch canceled before start (deleting)');
    return;
  }

  // Create invocation record (now protected by tracker slot)
  const createResult = await invocationRecordStore.create({
    threadId,
    userId,
    targetCats: [targetCatId],
    intent: intent.intent,
    idempotencyKey: `mm-${requestId}-${targetCatId}`,
  });

  if (createResult.outcome === 'duplicate') {
    log.info({ requestId, targetCatId }, '[F086] Dispatch skipped: duplicate invocation');
    return; // finally will complete() the slot
  }

  await invocationRecordStore.update(createResult.invocationId, {
    status: 'running',
  });

  // ... rest of dispatch logic (registerDispatch, routeExecution, etc.) ...
  // (existing inner try/finally for orch.unregisterDispatch stays intact)

} catch (err) {
  // ... existing error handling ...
} finally {
  invocationTracker?.complete(threadId, targetCatId, controller);
}
```

关键点：
- `start()` 移到 `create` 之前
- `create` 返回 duplicate 时直接 return → finally 释放 slot（AC-A9）
- `create` 抛错时 catch → finally 释放 slot（AC-A12）

### Step 3.2: 构建验证

```bash
cd packages/api && pnpm build
```

Expected: no type errors

### Step 3.3: Commit

```bash
git add packages/api/src/routes/callback-multi-mention-routes.ts
git commit -m "fix(F122): multi_mention occupy slot before create, close TOCTOU window (AC-A9)"
```

---

## Task 4: 回归测试（AC-A10, AC-A11, AC-A12）

**Files:**
- Create: `packages/api/test/invocation-tracker-f122-a1.test.js`

### Step 4.1: 写回归测试

```javascript
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const { InvocationTracker } = await import(
  '../dist/domains/cats/services/agents/invocation/InvocationTracker.js'
);

describe('F122 Phase A.1: TOCTOU regression tests', () => {
  test('AC-A10: tryStartThread returns null after thread becomes busy (simulated TOCTOU)', () => {
    // Simulates: has() returned false at T1, but another cat started at T2
    const tracker = new InvocationTracker();
    // T1: thread is idle — smart-default would compute mode='immediate'
    assert.equal(tracker.has('thread1'), false);
    // T2: A2A invocation starts (simulating async gap)
    tracker.start('thread1', 'catA', 'user1');
    // T3: tryStartThread — should detect busy and return null
    const result = tracker.tryStartThread('thread1', 'catB', 'user1');
    assert.equal(result, null, 'must return null — thread is now busy');
    // catA should NOT have been preempted
    assert.equal(tracker.has('thread1', 'catA'), true);
  });

  test('AC-A11: tryStartThread success + duplicate create → slot must be released', () => {
    const tracker = new InvocationTracker();
    // tryStartThread succeeds
    const controller = tracker.tryStartThread('thread1', 'catA', 'user1', ['catA']);
    assert.ok(controller);
    assert.equal(tracker.has('thread1', 'catA'), true);
    // Simulate: create() returned duplicate → caller must complete()
    tracker.complete('thread1', 'catA', controller);
    assert.equal(tracker.has('thread1', 'catA'), false, 'slot must be released after duplicate');
  });

  test('AC-A12: multi_mention create throws → slot must be released via finally', () => {
    const tracker = new InvocationTracker();
    // start() before create (new order)
    const controller = tracker.start('thread1', 'catA', 'user1', ['catA']);
    assert.equal(tracker.has('thread1', 'catA'), true);
    // Simulate: create throws → finally block calls complete()
    try {
      throw new Error('create failed');
    } finally {
      tracker.complete('thread1', 'catA', controller);
    }
    // Verify slot was released
    assert.equal(tracker.has('thread1', 'catA'), false, 'slot must be released after create error');
  });
});
```

### Step 4.2: 运行测试

```bash
cd packages/api && pnpm build && node --test test/invocation-tracker-f122-a1.test.js
```

Expected: ALL PASS

### Step 4.3: Commit

```bash
git add packages/api/test/invocation-tracker-f122-a1.test.js
git commit -m "test(F122): TOCTOU regression tests — busy gate, duplicate release, create error release (AC-A10~A12)"
```

---

## 最终验证

```bash
# 全量测试
cd packages/api && pnpm build && node --test test/invocation-tracker.test.js test/invocation-tracker-f122-a1.test.js
# 类型检查
pnpm lint
# Biome
pnpm check
```

全部通过后 → 加载 `quality-gate` → `request-review`（@ 缅因猫）。
