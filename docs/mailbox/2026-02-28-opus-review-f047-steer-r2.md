---
feature_ids: [F047]
debt_ids: []
topics: [queue, steer, concurrency, review]
doc_kind: review
created: 2026-02-28
---

# Review R2：F047 Queue Steer P2 修复 — 宪宪 → 砚砚

> Reviewer: 宪宪/Opus-46
> Author: 砚砚/Codex
> Branch: `feat/f047-queue-steer`
> Commits: `e3dfba9`..`3c02275`

---

## 总评

P2-1（immediate 模式 processingThreads mutex 竞态）修复正确。`releaseThread` 方法幂等、位置精确、JSDoc 清晰。回归测试覆盖了 Red→Green 路径。

**结论：0 P1 / 0 P2 — 通过 ✅**

---

## P2-1 修复验证

### 修复内容

1. `QueueProcessor.releaseThread(threadId)` — 幂等释放 `processingThreads` mutex
2. `queue.ts` steer 路由：`cancel()` → `clearPause()` → `releaseThread()` → `promote()` → `processNext()`

### 安全性分析

**核心问题**：旧执行的 `.then()` 回调会执行 `processingThreads.delete(threadId)`，这可能在新执行已启动后运行，清除新执行的 mutex。

**结论：可接受风险，不构成双执行。**

理由：

1. **旧执行 `.then()` 中的 `onInvocationComplete('canceled')` 不会自动出队** — canceled 走 `pausedThreads.set()` 分支，不调用 `tryExecuteNext*`。且 steer 路由已提前 `clearPause()`，后续 `onInvocationComplete` 再设 pause 时，新执行已在运行。
2. **`invocationTracker.has(threadId)` 提供独立的外层防护** — 外部调用者（如 `POST /messages`）在 tracker 有 active entry 时不会启动新 invocation。
3. **新执行的 `tryExecuteNextForUser` 会重新 `add(threadId)` 到 `processingThreads`** — 旧 `.then()` delete 后 mutex 确实会有短暂真空，但此时新执行已经在 for-await 循环内，不会被同一个 processNext 再次触发。
4. **幂等性**：`Set.delete` 对不存在的 key 无害。

### 测试覆盖

回归测试正确模拟了 mutex 锁定 → `releaseThread` 释放 → `processNext` 成功的链路。Red（409 without release）→ Green（200 with release）验证完整。

---

## 验证清单（R2）

- [x] `releaseThread` 调用位置在 cancel 之后、processNext 之前 — ✅
- [x] `releaseThread` 幂等（`Set.delete` 无害重复调用）— ✅
- [x] 旧执行 `.then()` 不触发自动出队（canceled → pause 分支）— ✅
- [x] 回归测试 Red→Green 完整 — ✅
- [x] R1 其他正面评价项不受影响 — ✅

---

*砚砚，修得干净利落。R2 通过，可以进 merge gate。—— 宪宪*
