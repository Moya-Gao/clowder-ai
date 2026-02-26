# #100 消息排队投递 — 技术实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让猫猫在跑的时候，铲屎官和系统消息可以排队发送，而不是只能取消或强制打断。

**Architecture:** 在 `InvocationTracker`（互斥锁）旁新增 `InvocationQueue`（per-thread FIFO 队列）。POST /api/messages 新增 `deliveryMode` 参数（immediate/queue/force）。Invocation 完成时自动出队处理下一条；Cancel 后暂停等铲屎官管理。前端 ChatInput 从"disabled 时只能 Stop"升级为"Queue Send / Force Send / Stop"三模式，新增 QueuePanel 展示队列状态。

**Tech Stack:** Fastify + TypeScript + Socket.IO (backend), React + Zustand + Tailwind (frontend), node:test (testing)

**产品需求文档:** `docs/plans/2026-02-26-message-queue-delivery.md`

---

## 架构概览

```
用户/Connector 发消息
       │
       ▼
  ┌─────────────────────┐
  │ POST /api/messages   │
  │ deliveryMode 参数    │
  └────┬───────┬────────┘
       │       │
  无猫在跑  有猫在跑
       │       │
       ▼       ├─ mode=queue → InvocationQueue.enqueue()
  直接执行     │                 (同源合并 + WS 广播)
  (现有流程)   │
               ├─ mode=force → InvocationTracker.cancel()
               │                 + 直接执行 (现有流程)
               │
               └─ 默认行为:
                    用户消息 → queue
                    connector → queue

  ┌──────────────────────────┐
  │ Invocation 完成回调       │
  │ InvocationTracker.complete│
  └────┬─────────────────────┘
       │
       ├─ 正常完成(succeeded) → InvocationQueue.dequeue() → 自动执行下一条
       ├─ 取消(canceled)      → 暂停，WS 广播 queue_paused，等铲屎官决定
       └─ 失败(failed)        → 暂停，WS 广播 queue_paused，等铲屎官决定
```

### 关键设计决策

1. **InvocationQueue 是纯内存的**（和 InvocationTracker 一致）。Phase 3c 再考虑 Redis 持久化。
2. **先入队（预留位），再写 MessageStore**。队列是容量守门人，messageId 异步回填。写消息失败则回滚队列条目，不会产生"幽灵消息"。
3. **合并发生在 enqueue 时**：如果队尾是同源未消费消息，追加文本而非新建条目。
4. **Cancel 后队列暂停**：铲屎官通过 QueuePanel 管理（继续/撤回/清空）。
5. **Force 模式 = 现有行为**：abort 旧 + 立即执行新，不经过队列。
6. **队列作用域 = `threadId + userId`**（R5 P1 fix）：InvocationQueue 按 `scopeKey = ${threadId}:${userId}` 存储，天然用户隔离。Default thread (`createdBy='system'`) 下每个用户各自独立队列，互不可见/可删。系统级自动出队（invocation 完成后）通过 `peekOldestAcrossUsers(threadId)` 跨用户 FIFO 选最早的条目执行。

---

## 分 Phase 实施

| Phase | 内容 | 估计测试数 |
|-------|------|-----------|
| A | 后端队列核心 + API | ~25 |
| B | 前端 UI（Queue/Force/QueuePanel） | ~10 |
| C | Connector 集成 + 消息合并 | ~8 |

建议逐 Phase 提 review，不要一次性全做。

---

## Phase A: 后端队列核心

### Task 1: InvocationQueue 数据结构 + 基础操作

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts`
- Test: `packages/api/test/invocation-queue.test.js`

**数据结构:**

```typescript
// InvocationQueue.ts

export interface QueueEntry {
  id: string;                     // randomUUID
  threadId: string;
  userId: string;
  content: string;                // 消息文本（合并后的）
  messageId: string | null;       // 异步回填：enqueue 时为 null，写入 MessageStore 后 backfill
  mergedMessageIds: string[];     // 合并进来的其他消息 ID（用于撤回时级联删除）
  source: 'user' | 'connector';
  targetCats: string[];
  intent: string;
  status: 'queued' | 'processing';
  createdAt: number;
}

export interface EnqueueResult {
  outcome: 'enqueued' | 'merged' | 'full';
  entry?: QueueEntry;             // enqueued/merged 时返回
  queuePosition?: number;         // 1-based
}

const MAX_QUEUE_DEPTH = 5;

export class InvocationQueue {
  /** 按 scopeKey = `${threadId}:${userId}` 存储，天然用户隔离（R5 P1 fix） */
  private queues = new Map<string, QueueEntry[]>();

  private scopeKey(threadId: string, userId: string): string {
    return `${threadId}:${userId}`;
  }

  /** 预留队列位 — 同步操作，messageId 为 null，后续 backfillMessageId 回填。
   *  容量检查在此完成：返回 full 时调用方不应写 MessageStore。 */
  enqueue(entry: Omit<QueueEntry, 'id' | 'status' | 'createdAt' | 'mergedMessageIds' | 'messageId'>): EnqueueResult
  // 注：entry 里已有 threadId + userId，内部用 scopeKey(entry.threadId, entry.userId)

  /** 回填 messageId — 仅用于 outcome='enqueued' 的新条目（messageId 从 null → 实际值） */
  backfillMessageId(threadId: string, userId: string, entryId: string, messageId: string): void

  /** 追加 mergedMessageId — 仅用于 outcome='merged'（不覆盖首条 messageId） */
  appendMergedMessageId(threadId: string, userId: string, entryId: string, messageId: string): void

  dequeue(threadId: string, userId: string): QueueEntry | null
  peek(threadId: string, userId: string): QueueEntry | null
  remove(threadId: string, userId: string, entryId: string): QueueEntry | null
  list(threadId: string, userId: string): QueueEntry[]

  /** 只统计 status==='queued' 的条目（processing 不占容量） */
  size(threadId: string, userId: string): number

  clear(threadId: string, userId: string): QueueEntry[]    // 返回被清除的条目（用于批量撤回）

  /** 将该用户队首 queued 条目原地改为 processing（不从数组移除，前端仍可见） */
  markProcessing(threadId: string, userId: string): QueueEntry | null

  /** 移除该用户 status=processing 的条目（invocation 完成后调用） */
  removeProcessed(threadId: string, userId: string): QueueEntry | null

  // ── 跨用户方法（仅供 QueueProcessor 系统级调用） ──

  /** 遍历所有 `${threadId}:*` scopeKey，返回 createdAt 最早的 status='queued' 条目 */
  peekOldestAcrossUsers(threadId: string): QueueEntry | null

  /** 同上 + 原地标记为 processing */
  markProcessingAcrossUsers(threadId: string): QueueEntry | null

  /** 同上 + 移除 processing 条目 */
  removeProcessedAcrossUsers(threadId: string): QueueEntry | null

  /** 检查 threadId 下是否有任何用户的排队条目 */
  hasQueuedForThread(threadId: string): boolean
}
```

**合并规则（enqueue 时执行）:**
- 队列按 `scopeKey(threadId, userId)` 存储，所以 `userId` 天然匹配
- 队列尾部条目必须**全部匹配**才合并：`source` + `targetCats`（排序后深比较）+ `intent`，且 `status === 'queued'`
- → 将新消息文本追加到尾部条目的 `content`（`\n` 分隔）
- → 返回 `{ outcome: 'merged', entry: updatedEntry }`
- **不合并的例子**: `@opus 你好` + `@codex 帮忙看看` — targetCats 不同，各自独立入队

**Step 1: 写失败测试（8-10 个）**

```javascript
// test/invocation-queue.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InvocationQueue } from '../src/domains/cats/services/agents/invocation/InvocationQueue.js';

describe('InvocationQueue', () => {
  let queue;
  beforeEach(() => { queue = new InvocationQueue(); });

  it('enqueue + dequeue FIFO order', () => { /* ... */ });
  it('peek does not remove entry', () => { /* ... */ });
  it('returns null when dequeuing empty queue', () => { /* ... */ });
  it('remove specific entry by id', () => { /* ... */ });
  it('remove returns null for non-existent entry', () => { /* ... */ });
  it('list returns shallow copy (not live reference)', () => { /* ... */ });
  it('enqueue returns full when at MAX_QUEUE_DEPTH', () => { /* ... */ });
  it('merges same-source same-target consecutive entries', () => {
    const r1 = queue.enqueue({ threadId: 't1', userId: 'u1', content: '猫猫',
      source: 'user', targetCats: ['opus'], intent: 'execute' });
    assert.equal(r1.outcome, 'enqueued');

    const r2 = queue.enqueue({ threadId: 't1', userId: 'u1', content: '你好',
      source: 'user', targetCats: ['opus'], intent: 'execute' });
    assert.equal(r2.outcome, 'merged');
    assert.equal(r2.entry.content, '猫猫\n你好');
    assert.equal(queue.size('t1'), 1);
  });
  it('does NOT merge different-source entries', () => { /* ... */ });
  it('does NOT merge different-targetCats entries', () => {
    queue.enqueue({ threadId: 't1', userId: 'u1', content: '@opus 你好',
      source: 'user', targetCats: ['opus'], intent: 'execute' });
    const r2 = queue.enqueue({ threadId: 't1', userId: 'u1', content: '@codex 帮忙看看',
      source: 'user', targetCats: ['codex'], intent: 'execute' });
    assert.equal(r2.outcome, 'enqueued'); // NOT merged
    assert.equal(queue.size('t1'), 2);
  });
  it('does NOT merge if tail is processing', () => { /* ... */ });
  it('backfillMessageId sets messageId on new entry (null → value)', () => {
    const r = queue.enqueue({ threadId: 't1', userId: 'u1', content: 'hi',
      source: 'user', targetCats: ['opus'], intent: 'execute' });
    assert.equal(r.entry.messageId, null);
    queue.backfillMessageId('t1', r.entry.id, 'msg-123');
    assert.equal(queue.list('t1')[0].messageId, 'msg-123');
  });
  it('appendMergedMessageId adds to mergedMessageIds (does NOT overwrite messageId)', () => {
    const r1 = queue.enqueue({ threadId: 't1', userId: 'u1', content: 'hi',
      source: 'user', targetCats: ['opus'], intent: 'execute' });
    queue.backfillMessageId('t1', r1.entry.id, 'msg-1');
    const r2 = queue.enqueue({ threadId: 't1', userId: 'u1', content: 'hello',
      source: 'user', targetCats: ['opus'], intent: 'execute' });
    assert.equal(r2.outcome, 'merged');
    queue.appendMergedMessageId('t1', r2.entry.id, 'msg-2');
    const entry = queue.list('t1')[0];
    assert.equal(entry.messageId, 'msg-1');  // NOT overwritten
    assert.deepEqual(entry.mergedMessageIds, ['msg-2']);
  });
  it('clear returns all removed entries', () => { /* ... */ });
  it('markProcessing returns entry with status=processing', () => { /* ... */ });
  it('cross-thread isolation', () => { /* ... */ });
});
```

**Step 2: 运行测试确认红灯**

```bash
cd packages/api && node --test test/invocation-queue.test.js
# Expected: FAIL — InvocationQueue not found
```

**Step 3: 实现 InvocationQueue**

按上面的接口实现。核心是一个 `Map<string, QueueEntry[]>`。

**Step 4: 运行测试确认绿灯**

```bash
cd packages/api && node --test test/invocation-queue.test.js
# Expected: all PASS
```

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts \
       packages/api/test/invocation-queue.test.js
git commit -m "feat(#100): InvocationQueue 数据结构 + 合并 + 基础操作 [布偶猫🐾]"
```

---

### Task 2: Queue 处理管线 — 完成回调 + 自动出队

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts`
- Test: `packages/api/test/queue-processor.test.js`
- Modify: `packages/api/src/routes/messages.ts` — complete 回调接入

**设计:**

```typescript
// QueueProcessor.ts
export interface QueueProcessorDeps {
  queue: InvocationQueue;
  invocationTracker: InvocationTracker;
  invocationRecordStore: IInvocationRecordStore;
  router: AgentRouter;
  socketManager: SocketManager;
  messageStore: IMessageStore;
  log: FastifyBaseLogger;
}

export class QueueProcessor {
  /** Per-thread mutex — 防止 onInvocationComplete 和 processNext 并发双启动 */
  private processingThreads = new Set<string>();

  /**
   * 在 invocation 完成后调用（系统级入口）。
   * - succeeded → 跨用户 FIFO 自动出队（markProcessingAcrossUsers）+ 执行
   * - canceled/failed → 暂停，广播 queue_paused 给相关用户
   */
  onInvocationComplete(threadId: string, status: 'succeeded' | 'failed' | 'canceled'): void

  /**
   * 铲屎官手动触发：处理**自己**队列的下一条（用户级入口）。
   * 用于 cancel 后铲屎官决定"继续处理"。
   * 注意：只处理该 userId 的队列，不会触发别人的消息。
   */
  processNext(threadId: string, userId: string): Promise<{ started: boolean; entry?: QueueEntry }>

  /**
   * 系统级内部方法：获取 mutex → markProcessingAcrossUsers → executeEntry。
   * 从所有用户队列中选 createdAt 最早的 queued 条目。
   */
  private tryExecuteNextAcrossUsers(threadId: string): Promise<{ started: boolean; entry?: QueueEntry }>

  /**
   * 用户级内部方法：获取 mutex → markProcessing(threadId, userId) → executeEntry。
   * 只选该用户队列的队首。
   */
  private tryExecuteNextForUser(threadId: string, userId: string): Promise<{ started: boolean; entry?: QueueEntry }>

  /**
   * 执行一个队列条目（内部方法）。
   * 创建 InvocationRecord → tracker.start() → background routeExecution
   */
  private executeEntry(entry: QueueEntry): Promise<void>
}
```

**关键行为:**
- `onInvocationComplete('succeeded')` → `tryExecuteNextAcrossUsers(threadId)` → 获取 mutex → `queue.markProcessingAcrossUsers` → `executeEntry` → 定向广播 `queue_updated` 给该条目的 userId
- `onInvocationComplete('canceled')` → 定向广播 `queue_paused` 给有排队条目的用户（铲屎官看到暂停状态）
- `onInvocationComplete('failed')` → 同 canceled，暂停等铲屎官决定
- `processNext(threadId, userId)` → `tryExecuteNextForUser(threadId, userId)` → 获取 mutex，只处理该用户的队首
- **并发安全**: `tryExecuteNext*` 通过 `processingThreads` Set 串行化，保证同一 thread 不会同时启动两个出队执行

**markProcessing 语义（P2-2 fix）:**
- `markProcessing` 将队首 `status='queued'` 条目**原地改为** `status='processing'`，**不从数组移除**
- `list()` 返回所有条目（含 processing），前端可展示"正在处理"状态
- `size()` 只统计 `status==='queued'`（processing 不占容量位）
- Invocation 完成后，`removeProcessed(threadId)` 移除 `status='processing'` 的条目

**executeEntry 流程** 与 `POST /api/messages` 的 background 部分几乎一致：
1. `invocationRecordStore.create({ ..., idempotencyKey: 'queue-' + entry.id })`
2. `invocationTracker.start(threadId, userId, targetCats)`
3. `invocationRecordStore.update(id, { userMessageId: entry.messageId })`
4. Background: heartbeat + running + routeExecution + ack cursors + succeeded/failed
5. Finally: `invocationTracker.complete()` → `queue.removeProcessedAcrossUsers(threadId)` → `processingThreads.delete(threadId)` → `onInvocationComplete()`

**Step 1: 写失败测试（6-8 个）**

```javascript
// test/queue-processor.test.js
describe('QueueProcessor', () => {
  it('succeeded → auto-dequeues and executes next entry', async () => { /* ... */ });
  it('succeeded → empty queue → no action', async () => { /* ... */ });
  it('canceled → pauses queue, broadcasts queue_paused', () => { /* ... */ });
  it('failed → pauses queue, broadcasts queue_paused', () => { /* ... */ });
  it('processNext → starts next entry when paused', async () => { /* ... */ });
  it('processNext → returns started=false when queue empty', async () => { /* ... */ });
  it('concurrent tryExecuteNext on same thread → only one starts (mutex)', async () => { /* ... */ });
  it('executeEntry creates InvocationRecord with queue idempotency key', async () => { /* ... */ });
  it('executeEntry failure → marks record failed + broadcasts error', async () => { /* ... */ });
});
```

**Step 2-4: Red → Green**

**Step 5: Commit**

```bash
git commit -m "feat(#100): QueueProcessor — 完成回调自动出队 + 暂停管理 [布偶猫🐾]"
```

---

### Task 3: POST /api/messages 接入 deliveryMode

**Files:**
- Modify: `packages/api/src/routes/messages.schema.ts` — 新增 deliveryMode 字段
- Modify: `packages/api/src/routes/messages.ts` — 队列分流逻辑
- Test: `packages/api/test/messages.test.js` — 新增队列相关用例

**Schema 变更:**

```typescript
// messages.schema.ts
export const sendMessageSchema = z.object({
  // ... existing fields ...
  deliveryMode: z.enum(['immediate', 'queue', 'force']).optional(),
  // undefined = 智能默认：无猫在跑→immediate，有猫在跑→queue
});
```

**messages.ts 分流逻辑（插入在 resolveTargetsAndIntent 之后、invocationRecordStore.create 之前）:**

```typescript
// 确定投递模式
const hasActive = opts.invocationTracker?.has(resolvedThreadId) ?? false;
const mode = body.deliveryMode
  ?? (hasActive ? 'queue' : 'immediate');

if (mode === 'queue' && hasActive) {
  // ① 先入队预留位（同步，容量守门人）— 此时 messageId 为 null
  const enqueueResult = opts.invocationQueue.enqueue({
    threadId: resolvedThreadId,
    userId,
    content: cleanContent,
    source: 'user',
    targetCats,
    intent: intent.intent,
  });

  // 队列满 → 429，不写 MessageStore，无幽灵消息
  if (enqueueResult.outcome === 'full') {
    reply.status(429);
    return { error: '消息队列已满', code: 'QUEUE_FULL', queueSize: opts.invocationQueue.size(resolvedThreadId, userId) };
  }

  // ② 写入用户消息（消息前端可见）
  try {
    const userMessage = await opts.messageStore.append(resolvedThreadId, {
      role: 'user', content: cleanContent, userId, /* ... */
    });
    // ③ 回填/追加 messageId — 区分 enqueued 和 merged 路径
    if (enqueueResult.outcome === 'enqueued') {
      // 新条目：backfill messageId（null → 实际值）
      opts.invocationQueue.backfillMessageId(resolvedThreadId, userId, enqueueResult.entry!.id, userMessage.id);
    } else {
      // merged：追加到 mergedMessageIds（不覆盖首条 messageId）
      opts.invocationQueue.appendMergedMessageId(resolvedThreadId, userId, enqueueResult.entry!.id, userMessage.id);
    }
  } catch (err) {
    // 写消息失败 → 回滚队列条目（enqueued 时移除；merged 时回退文本需更复杂处理，暂简单移除）
    if (enqueueResult.outcome === 'enqueued') {
      opts.invocationQueue.remove(resolvedThreadId, userId, enqueueResult.entry!.id);
    }
    // merged 失败：文本已追加但消息未写入 — 可接受的不一致（下次 dequeue 时内容完整但少一条 mergedMessageId）
    throw err;
  }

  // 定向广播队列更新（只发给该用户，不泄露给其他用户）
  opts.socketManager.emitToUser(userId, 'queue_updated', {
    threadId: resolvedThreadId,
    queue: opts.invocationQueue.list(resolvedThreadId, userId),
    action: enqueueResult.outcome, // 'enqueued' | 'merged'
  });

  reply.status(202);
  return {
    status: 'queued',
    queuePosition: enqueueResult.queuePosition,
    entryId: enqueueResult.entry?.id,
    merged: enqueueResult.outcome === 'merged',
  };
}

if (mode === 'force' && hasActive) {
  // 取消当前 invocation（和 WS cancel 一样的逻辑）
  const cancelResult = opts.invocationTracker?.cancel(resolvedThreadId, userId);
  if (cancelResult?.cancelled) {
    const cancelMsgs = buildCancelMessages(cancelResult);
    for (const m of cancelMsgs) {
      opts.socketManager.broadcastAgentMessage(m, resolvedThreadId);
    }
  }
  // fall through to immediate execution below
}

// immediate 或 force(已 cancel) → 现有流程
// ... existing invocationRecordStore.create → tracker.start → background ...
```

**测试（新增 4-6 个）:**

```javascript
describe('POST /api/messages deliveryMode', () => {
  it('queue mode → writes message + enqueues + returns 202 queued', async () => { /* ... */ });
  it('queue mode → merges same-user consecutive messages', async () => { /* ... */ });
  it('queue mode → returns 429 when queue full (no ghost message written)', async () => { /* ... */ });
  it('queue mode → messageStore failure rolls back queue entry', async () => { /* ... */ });
  it('force mode → cancels active invocation then executes', async () => { /* ... */ });
  it('immediate mode when no active → normal execution', async () => { /* ... */ });
  it('default mode with active invocation → falls back to queue', async () => { /* ... */ });
});
```

**Step 1-4: Red → Green**

**Step 5: Commit**

```bash
git commit -m "feat(#100): POST /api/messages deliveryMode 队列分流 [布偶猫🐾]"
```

---

### Task 4: 队列管理 API

**Files:**
- Create: `packages/api/src/routes/queue.ts`
- Test: `packages/api/test/queue-api.test.js`
- Modify: `packages/api/src/index.ts` — 注册路由

**API 端点:**

```
GET    /api/threads/:threadId/queue          → 列出队列条目
DELETE /api/threads/:threadId/queue/:entryId  → 撤回条目（从队列移除 + 可选删除消息）
POST   /api/threads/:threadId/queue/next     → 手动触发处理下一条
DELETE /api/threads/:threadId/queue           → 清空队列
```

**鉴权（所有端点强制执行，硬性步骤）:**

每个端点的第一步必须是：
1. `resolveUserId(request)` → 401 if missing
2. `threadStore.get(threadId)` → 404 if not found
3. Thread ownership check: `thread.createdBy !== 'system' && thread.createdBy !== userId` → 403 if mismatch（默认 thread 的 `createdBy` 为 `'system'`，视为公共 thread，允许访问）

```typescript
// 提取为复用 helper
async function guardThreadOwnership(request, reply, threadStore, threadId) {
  const userId = resolveUserId(request);
  if (!userId) { reply.status(401); return null; }
  const thread = await threadStore.get(threadId);
  if (!thread) { reply.status(404); return null; }
  // ownership check — Thread 模型用 createdBy（和 DELETE /api/threads、thread-export.ts 保持一致）
  // 默认 thread (id='default') 的 createdBy='system'，视为公共 thread，任何人可操作
  if (thread.createdBy !== 'system' && thread.createdBy !== userId) { reply.status(403); return null; }
  return { userId, thread };
}
```

**用户隔离策略（R5 P1 fix — scopeKey 方案）:**

队列按 `scopeKey = ${threadId}:${userId}` 存储，**存储层天然隔离**，API/WS 无需额外 filter：
- 所有 API 端点在 `guardThreadOwnership` 拿到 `userId` 后，直接用 `(threadId, userId)` 参数调用 InvocationQueue — 物理上只能操作自己的队列
- `processNext` 也是用户级（只处理自己的队列），系统级跨用户出队仅在 `onInvocationComplete` 内部自动触发
- WebSocket 用 `emitToUser(userId, ...)` 定向发送，不经过 room 广播

**GET /api/threads/:threadId/queue:**
- 鉴权 → 返回 `{ queue: list(threadId, userId), paused: boolean }`
- scopeKey 天然隔离，用户只看到自己的队列
- `paused` = 上次 invocation 是 canceled/failed 且 `hasQueuedForThread(threadId)`

**DELETE /api/threads/:threadId/queue/:entryId:**
- 鉴权 → `remove(threadId, userId, entryId)` — scopeKey 天然隔离（别人的 entryId 在自己队列里找不到 → 404）
- 如果 `entry.status === 'processing'` → 拒绝（409: 已在处理中）
- 从队列移除；可选：删除对应的 MessageStore 消息（`?deleteMessage=true`）
- `emitToUser(userId, 'queue_updated', ...)`

**POST /api/threads/:threadId/queue/next:**
- 鉴权 → 调用 `queueProcessor.processNext(threadId, userId)` — **用户级**，只处理自己的下一条
- 返回 `{ started: boolean, entry?: QueueEntry }`
- 如果自己的队列空 → 200 `{ started: false }`

**DELETE /api/threads/:threadId/queue:**
- 鉴权 → `clear(threadId, userId)` — scopeKey 天然隔离，只清空自己的
- 返回被清除的条目列表
- `emitToUser(userId, 'queue_updated', ...)`

**测试（14 个）:**

```javascript
describe('Queue Management API', () => {
  // Auth
  it('returns 401 when userId header missing', async () => { /* ... */ });
  it('returns 404 when thread not found', async () => { /* ... */ });
  it('returns 403 when userId does not match thread owner', async () => { /* ... */ });
  it('allows access when createdBy is system (default thread)', async () => {
    // 默认 thread 的 createdBy='system'，任何已认证用户都可操作队列
    // Setup: threadStore.get returns { id: 'default', createdBy: 'system', ... }
    // Assert: 不返回 403，正常执行
  });
  // User isolation via scopeKey (R5 P1 fix)
  it('GET /queue returns only requesting user entries (scopeKey isolation)', async () => {
    // Setup: default thread, userA 和 userB 各入队 1 条
    // Assert: userA GET → 只看到自己的; userB GET → 只看到自己的
  });
  it('DELETE /queue/:entryId returns 404 for another user entry (scopeKey isolation)', async () => {
    // Setup: default thread, userA 入队 1 条
    // Assert: userB DELETE 该 entryId → 404（在 userB 的 scopeKey 下找不到）
  });
  it('DELETE /queue clears only requesting user entries (scopeKey isolation)', async () => {
    // Setup: default thread, userA 2 条 + userB 1 条
    // Assert: userA DELETE /queue → 返回 2 条, userB 的条目不受影响
  });
  it('POST /queue/next only processes requesting user queue', async () => {
    // Setup: default thread, userA 和 userB 各入队 1 条
    // Assert: userA POST /next → 只处理 userA 的队首, userB 不受影响
  });
  // Functional
  it('GET /queue returns entries and paused state', async () => { /* ... */ });
  it('DELETE /queue/:entryId removes entry and broadcasts', async () => { /* ... */ });
  it('DELETE /queue/:entryId rejects processing entry (409)', async () => { /* ... */ });
  it('POST /queue/next triggers next entry processing', async () => { /* ... */ });
  it('POST /queue/next returns started=false when empty', async () => { /* ... */ });
  it('DELETE /queue clears all entries for user', async () => { /* ... */ });
});
```

**Step 1-4: Red → Green**

**Step 5: Commit**

```bash
git commit -m "feat(#100): 队列管理 API — GET/DELETE/next [布偶猫🐾]"
```

---

### Task 5: 接线 — InvocationTracker.complete() 挂钩 QueueProcessor

**Files:**
- Modify: `packages/api/src/routes/messages.ts` — finally block 调用 queueProcessor
- Modify: `packages/api/src/routes/invocations.ts` — retry 的 finally block 同理
- Modify: `packages/api/src/index.ts` — 创建并注入 QueueProcessor 实例
- Test: 修改现有测试确认无 regression

**核心变更:**

在 `messages.ts` 和 `invocations.ts` 的 background execution `finally` block 中，现有的 `invocationTracker.complete()` 之后加：

```typescript
// finally block 末尾
invocationTracker.complete(resolvedThreadId, controller);
// ↓ 新增：通知队列处理器
const finalStatus = /* ... 根据上面的 try/catch 确定 */;
opts.queueProcessor?.onInvocationComplete(resolvedThreadId, finalStatus);
```

**注意：** `executeEntry` 内部的 finally 也会调用 `onInvocationComplete`，形成链式自动出队。需要防止递归死循环——如果 `executeEntry` 立即失败，`onInvocationComplete('failed')` 不会再自动出队（暂停）。

**测试:**
- 确认现有 messages.test.js 不 break
- 新增：invocation succeeded → queue auto-dequeues（集成级测试）

**Step 1-4: Red → Green**

**Step 5: Commit**

```bash
git commit -m "feat(#100): 接线 — complete() 回调触发队列出队 [布偶猫🐾]"
```

---

### Task 6: WebSocket 事件 — queue_updated / queue_paused（定向发送）

**Files:**
- Modify: `packages/api/src/infrastructure/websocket/SocketManager.ts` — 新增 `emitToUser(userId, event, payload)` helper
- 需要维护 `userId → Set<socketId>` 映射（socket connect 时注册，disconnect 时移除）

**emitToUser 实现要点:**
- Socket 连接时通过 handshake auth / query 拿到 userId → `userSockets.get(userId).add(socket.id)`
- `emitToUser(userId, event, payload)` → 遍历该 userId 的所有 socket 发送
- 这样同一用户多 tab 都能收到，但不会泄露给其他用户

**事件格式:**

```typescript
// queue_updated — 定向发给该条目的 userId
{
  threadId: string;
  queue: QueueEntry[];       // 该用户的完整快照（不含其他用户的条目）
  action: 'enqueued' | 'merged' | 'removed' | 'cleared' | 'processing';
}

// queue_paused — 定向发给有排队条目的用户
{
  threadId: string;
  reason: 'canceled' | 'failed';
  queue: QueueEntry[];       // 该用户的剩余队列
}
```

这些事件在 Task 2-4 中通过 `socketManager.emitToUser()` 发出（不再用 `broadcastToRoom`），本 Task 实现 `emitToUser` helper，并在前端 useSocket.ts 中注册监听（Phase B）。

**Commit:**

```bash
git commit -m "docs(#100): WebSocket queue 事件格式定义 [布偶猫🐾]"
```

---

## Phase B: 前端 UI

### Task 7: useChatStore 新增队列状态

**Files:**
- Modify: `packages/web/src/stores/chatStore.ts` — 新增 queue 相关 state/actions
- Modify: `packages/web/src/hooks/useSocket.ts` — 监听 queue_updated / queue_paused

**Store 新增:**

```typescript
// chatStore.ts ThreadState 扩展
interface ThreadState {
  // ... existing ...
  queue: QueueEntry[];
  queuePaused: boolean;
  queuePauseReason?: 'canceled' | 'failed';
}

// actions
setQueue(threadId: string, queue: QueueEntry[]): void
setQueuePaused(threadId: string, paused: boolean, reason?: string): void
```

**useSocket.ts 新增监听:**

```typescript
socket.on('queue_updated', (data) => {
  chatStore.setQueue(data.threadId, data.queue);
});
socket.on('queue_paused', (data) => {
  chatStore.setQueue(data.threadId, data.queue);
  chatStore.setQueuePaused(data.threadId, true, data.reason);
});
```

**Commit:**

```bash
git commit -m "feat(#100): 前端 queue state + WebSocket 监听 [布偶猫🐾]"
```

---

### Task 8: ChatInput — 猫在跑时启用输入

**Files:**
- Modify: `packages/web/src/components/ChatInput.tsx`
- Modify: `packages/web/src/components/ChatInputActionButton.tsx`

**当前行为:** `disabled={isLoading}` → textarea disabled

**新行为:**
- textarea **不再 disabled**（猫在跑也能打字）
- `ChatInputActionButton` 状态机扩展：

```
优先级（从高到低）:
1. disabled && onStop && hasActiveInvocation && !hasText → Stop 按钮（现有）
2. hasActiveInvocation && hasText → 「排队发送」按钮（新）
   - 主按钮: 排队发送 (queue mode)
   - 下拉/长按: 强制发送 (force mode)
3. voice 相关状态 → 现有逻辑
4. hasText → Send 按钮（现有）
5. default → Mic 按钮（现有）
```

**关键:** 当 `hasActiveInvocation && hasText` 时，Stop 按钮移到 `QueuePanel` 或作为二级按钮保留。

**Commit:**

```bash
git commit -m "feat(#100): ChatInput 猫在跑时启用输入 + 排队/强制发送按钮 [布偶猫🐾]"
```

---

### Task 9: QueuePanel — 队列可视化 + 管理

**Files:**
- Create: `packages/web/src/components/QueuePanel.tsx`
- Modify: `packages/web/src/components/ChatContainer.tsx` — 挂载 QueuePanel

**QueuePanel 展示（在消息列表和输入框之间）:**

```
┌─────────────────────────────────────────┐
│ 📋 消息队列 (2 条排队中)                 │
│                                         │
│ 1. 🧑 铲屎官: "猫猫你好"    [撤回]      │
│    排队中 · 12:34                       │
│                                         │
│ 2. 🔗 Connector: "Review #79..."  [撤回] │
│    排队中 · 12:35                       │
│                                         │
│ ── 队列已暂停（当前调用已取消）──        │
│ [继续处理下一条]  [清空队列]             │
└─────────────────────────────────────────┘
```

**功能:**
- 显示队列条目（来源 icon + 内容预览 + 状态 + 时间）
- 每条有「撤回」按钮 → `DELETE /api/threads/:threadId/queue/:entryId`
- 暂停状态下显示「继续处理下一条」→ `POST /api/threads/:threadId/queue/next`
- 暂停状态下显示「清空队列」→ `DELETE /api/threads/:threadId/queue`
- 队列为空时不渲染（零侵入）

**Commit:**

```bash
git commit -m "feat(#100): QueuePanel — 队列可视化 + 撤回/继续/清空 [布偶猫🐾]"
```

---

### Task 10: useSendMessage 接入 deliveryMode

**Files:**
- Modify: `packages/web/src/hooks/useSendMessage.ts` (或 ChatContainer 中的 handleSend)
- Modify: `packages/web/src/utils/apiFetch.ts` — 如需要

**变更:**

```typescript
// handleSend 扩展
async function handleSend(content: string, mode?: 'queue' | 'force') {
  const body = {
    content,
    threadId,
    deliveryMode: mode, // undefined = 后端智能默认
  };
  const res = await apiFetch('/api/messages', { method: 'POST', body });

  if (res.status === 'queued') {
    // 不需要额外处理 — queue_updated WS 事件会更新 QueuePanel
    return;
  }
  // ... existing handling for 'processing' status ...
}
```

**排队发送按钮:** `onSend(content, 'queue')`
**强制发送按钮:** `onSend(content, 'force')`
**普通发送按钮（无猫在跑）:** `onSend(content)` → 后端默认 immediate

**Commit:**

```bash
git commit -m "feat(#100): useSendMessage 接入 deliveryMode [布偶猫🐾]"
```

---

## Phase C: Connector 集成 + 收尾

### Task 11: ConnectorInvokeTrigger 改为队列模式

**Files:**
- Modify: `packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts`
- Modify: `packages/api/test/connector-invoke-trigger.test.js`

**变更:**

```typescript
// ConnectorInvokeTrigger.trigger() 改造
trigger(threadId, catId, userId, message, messageId) {
  const hasActive = this.opts.invocationTracker.has(threadId);

  if (hasActive) {
    // 有猫在跑 → 入队，不打断
    const result = this.opts.queue.enqueue({
      threadId, userId, content: message, messageId,
      source: 'connector', targetCats: [catId], intent: 'execute',
    });
    // 广播 queue_updated
    this.opts.socketManager.broadcastToRoom(`thread:${threadId}`, 'queue_updated', {
      threadId, queue: this.opts.queue.list(threadId), action: result.outcome,
    });
    this.opts.log.info({ threadId, catId, outcome: result.outcome },
      '[ConnectorInvokeTrigger] Queued (active invocation running)');
    return;
  }

  // 无猫在跑 → 直接执行（现有 executeInBackground 逻辑）
  this.executeInBackground(threadId, catId, userId, message, messageId)
    .catch((err) => { /* ... existing ... */ });
}
```

**新增测试:**

```javascript
it('queues when active invocation exists (does not abort)', async () => { /* ... */ });
it('executes directly when no active invocation', async () => { /* ... */ });
```

**Commit:**

```bash
git commit -m "feat(#100): ConnectorInvokeTrigger 改为队列模式 — 不打断猫猫 [布偶猫🐾]"
```

---

### Task 12: 集成测试 + 全量验证

**Files:**
- Test: `packages/api/test/queue-integration.test.js`

**端到端场景测试:**

```javascript
describe('Queue Integration', () => {
  it('E2E: user sends while cat running → queued → invocation completes → auto-dequeue', async () => {
    // 1. 启动一个 mock invocation
    // 2. 发送 queue 模式消息
    // 3. 完成 mock invocation
    // 4. 验证队列消息被自动处理
  });

  it('E2E: cancel → queue paused → processNext → resumes', async () => {
    // 1. 启动 invocation + queue a message
    // 2. Cancel invocation
    // 3. 验证 queue_paused 被广播
    // 4. 调用 processNext
    // 5. 验证队列消息被处理
  });

  it('E2E: connector message arrives during active invocation → queued', async () => {
    // 1. 启动 invocation
    // 2. ConnectorInvokeTrigger.trigger()
    // 3. 验证消息入队而非 abort
  });

  it('E2E: force mode aborts + executes immediately', async () => {
    // 1. 启动 invocation
    // 2. 发送 force 模式消息
    // 3. 验证旧 invocation 被 abort
    // 4. 验证新消息立即执行
  });
});
```

**全量验证:**

```bash
cd packages/api && pnpm run build
cd packages/api && pnpm test
cd packages/web && pnpm run build
```

**Commit:**

```bash
git commit -m "test(#100): 队列集成测试 — 4 个 E2E 场景 [布偶猫🐾]"
```

---

## Shared 类型（如需要）

如果 `QueueEntry` 需要在前端使用，在 `packages/shared/src/types.ts` 中定义：

```typescript
export interface QueueEntry {
  id: string;
  threadId: string;
  userId: string;
  content: string;
  messageId: string | null;       // null until backfilled after MessageStore write
  mergedMessageIds: string[];
  source: 'user' | 'connector';
  targetCats: string[];
  intent: string;
  status: 'queued' | 'processing';
  createdAt: number;
}
```

---

## 不在本 Feature 范围的

- **Redis 持久化队列**：#97 Phase 3c 范围，本 Feature 只做内存队列
- **队列条目重排序**：V2 考虑，V1 只支持 FIFO + 撤回
- **多线程队列联动**：每个 thread 队列独立
- **前端队列拖拽排序**：V2 考虑

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 内存队列丢失（进程重启） | 队列中的消息丢失 invoke 机会 | 消息已写入 MessageStore，用户可手动 @ 猫。Phase 3c 做 Redis 持久化 |
| 链式自动出队死循环 | 连续失败不断触发 onInvocationComplete | failed/canceled 时暂停队列，不自动出队 |
| 队列满时 connector 消息被拒 | review 邮件的 invoke 被丢弃 | 429 返回后 connector 可记录日志；消息本身已在 thread 中 |
| 前端 queue state 与后端不同步 | 显示错误 | 每次 `queue_updated` 发送完整快照（非增量） |
| ~~幽灵消息（消息可见但不在队列）~~ | ~~已修复~~ | 先入队预留位，再写 MessageStore；写失败则回滚队列 |
| ~~自动出队与 processNext 双启动~~ | ~~已修复~~ | QueueProcessor per-thread mutex (`processingThreads` Set) |
| ~~default thread 跨用户队列泄露~~ | ~~已修复~~ | scopeKey = `threadId:userId`，存储层天然隔离；WS 用 `emitToUser` 定向发送 |
