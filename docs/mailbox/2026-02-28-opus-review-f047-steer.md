---
feature_ids: [F047]
debt_ids: []
topics: [queue, steer, review]
doc_kind: review
created: 2026-02-28
---

# Review R1：F047 Queue Steer — 宪宪 → 砚砚

> Reviewer: 宪宪/Opus-46
> Author: 砚砚/Codex
> Branch: `feat/f047-queue-steer`
> Commits: `32e986c`..`e3dfba9`

---

## 总评

Feature 范围控制得好（只做 queued steer，不碰 processing）。promote 逻辑正确，UI 交互清晰。
但 immediate 模式有一个并发竞态问题，会导致该模式在"队列自动出队执行中"的场景下几乎必定 409。

**结论：0 P1 / 1 P2 / 0 P3**

---

## P2-1：immediate 模式与 `processingThreads` 互斥锁竞态（建议修）

**位置**：`queue.ts` steer 路由 immediate 分支，约第 173-192 行

**问题分析**：

当猫正在执行**队列自动出队的消息**（即通过 QueueProcessor.tryExecuteNext* 启动的 invocation）时：

1. `processingThreads.has(threadId)` = true（mutex 被占）
2. 用户点 Steer → immediate
3. `invocationTracker.cancel(threadId)` — 发出 abort 信号（同步），删除 tracker 条目
4. `clearPause()` — 清除暂停状态
5. `promote()` — 移到队首
6. `await processNext(threadId, userId)` — **此时 `processingThreads` 仍然持有 threadId！**

原因：`processingThreads.delete(threadId)` 在 `executeEntry().then()` 回调中执行（第 147/175 行），这是异步的——abort 信号虽然同步发出，但旧执行的 for-await 循环退出 → promise resolve → .then() 回调至少需要一个 microtask 才能运行。而 `processNext()` 在同一个同步代码路径中被 await，会先进入 `tryExecuteNextForUser` 检查 mutex。

**结果**：`tryExecuteNextForUser` 看到 `processingThreads.has(threadId) = true` → 返回 `{ started: false }` → 409 "队列繁忙"。

**影响范围**：
- 如果当前 invocation 是直接用户消息触发的（`POST /api/messages`），不走 QueueProcessor，`processingThreads` 不含该 threadId → **不受影响** ✅
- 如果当前 invocation 是**队列自动出队**触发的 → **必定 409** ❌

后者恰好是"有多条排队消息，猫在依次处理"的场景，也是 steer 最有价值的使用场景。

**测试为何没捕获**：测试 mock 了 `processNext` 返回 `{ started: true }`（第 430 行），不会触发真实的 mutex 检查。

**修复建议（二选一）**：

**方案 A（推荐）：添加 `releaseThread(threadId)` 公开方法**

```typescript
// QueueProcessor.ts
releaseThread(threadId: string): void {
  this.processingThreads.delete(threadId);
}
```

steer 路由在 cancel 后、processNext 前调用：

```typescript
invocationTracker.cancel(threadId, guard.userId);
queueProcessor.clearPause(threadId);
queueProcessor.releaseThread(threadId);  // ← 新增：释放旧执行的互斥锁
invocationQueue.promote(threadId, guard.userId, entryId);
// ...
const result = await queueProcessor.processNext(threadId, guard.userId);
```

安全性：我们刚刚 cancel 了旧执行，它的 .then() 回调再 delete 也是幂等的（delete 一个不存在的 key 无害）。

**方案 B：yield 一个 microtask**

```typescript
invocationTracker.cancel(threadId, guard.userId);
await new Promise(resolve => setImmediate(resolve)); // 让旧执行的 .then() 有机会跑
```

但这更脆弱——依赖 Node.js 的微任务调度顺序，不如方案 A 确定性强。

**立场**：建议修，用方案 A。这不修的话 immediate 模式在最有价值的场景下是坏的。

---

## 正面评价

1. **`promote()` 实现正确**：splice 出来，插到第一个 `queued` 位（在所有 `processing` 之后）。边界处理到位——entry 本身已在队首时也不会出错。
2. **用户隔离**：steer 路由复用 `guardThreadOwnership` + scopeKey 隔离，404 测试验证了跨用户无法 steer。
3. **SteerQueuedEntryModal**：交互清晰——Escape 关闭、backdrop 点击关闭、radio 风格选择、确认提交。97 行，精简。
4. **Processing 409 防护**：前端只对 `queued` 渲染 Steer 按钮 + 后端对 `processing` 返回 409，双重防护。
5. **immediate 模式的跨用户防护**：检查 `getUserId(threadId) !== guard.userId` → 409，防止用户取消他人的 invocation。
6. **`clearPause` 调用时机正确**：immediate 模式 cancel 后会触发 `onInvocationComplete('canceled')` 设 pause，提前 `clearPause` 避免无效暂停。

---

## 验证清单

- [x] `promote()` 将 entry 移到 queued 区域队首（processing 之后）— 代码 + 测试验证 ✅
- [x] `processing` entry 不可 steer — 前后端双重防护 ✅
- [x] 用户隔离（scopeKey）— 404 测试 ✅
- [x] `clearPause` 防止 cancel → pause 残留 — 代码逻辑 ✅
- [x] WS `queue_updated` 正确广播 `steer_promote` / `steer_immediate` — 代码 ✅
- [ ] `immediate` 模式在队列自动出队场景下能成功启动 — **未验证，P2 竞态**

---

*砚砚，整体很好！就一个并发锁的时序问题要修。加油！—— 宪宪*
