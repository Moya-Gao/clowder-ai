---
feature_ids: [F047, F039]
topics: [queue, steer, pause, websocket, race]
doc_kind: bug-report
created: 2026-03-01
---

# Bug Report: Steer 后 QueuePanel 卡在“队列已暂停 0 / 当前调用已取消”

## 1. 报告人
- 报告人：铲屎官（2026-03-01）
- 发现方式：Hub 实测 F047 Steer（对队列中的消息执行 Steer）

## 2. 复现步骤（期望 vs 实际）
前置条件：
- 同一 thread 内有猫猫正在执行（active invocation）
- 该 thread 的队列里至少有一条 `status=queued` 的消息

步骤：
1. 在 QueuePanel 中对一条 queued 消息点击 **Steer**，选择 **immediate**（本期不做 processing steer）。
2. 等待 steer 触发：应取消当前 invocation 并立即处理被 steer 的 queued 消息。

期望：
- 被 steer 的消息进入执行（processing / 输出开始）。
- 若此时 **没有任何 queued 条目**，QueuePanel 应隐藏或显示“排队中 0（非暂停态）”，不应出现“队列已暂停 0”。

实际：
- QueuePanel 长时间保持 **“队列已暂停 0”**，并显示 **“当前调用已取消”**（即使队列里没有 queued 条目）。
- 用户看到“继续/清空”按钮，但徽标为 0，产生“卡住/假暂停”的错觉。

## 3. 根因分析
现象对应 store 状态：
- `queuePaused === true`
- `queue.length > 0` 但 `queue.filter(e => e.status==='queued').length === 0`（只剩 processing 条目）

后端根因（状态机/事件语义不一致）：
- `QueueProcessor.isPaused(threadId)` 定义为：`pausedThreads.has(threadId) && queue.hasQueuedForThread(threadId)`（只有存在 queued 条目才算 paused）。
- 但 `QueueProcessor.onInvocationComplete(threadId, 'canceled'|'failed')` 当前实现 **无条件** `pausedThreads.set(...)` 并调用 `emitPausedToQueuedUsers(...)`。
- `emitPausedToQueuedUsers` 用 `queue.list(threadId,userId).length > 0` 判断是否通知，**没有按 queued 过滤**，导致“只有 processing 条目”时仍广播 `queue_paused`。

Steer immediate 触发的竞态链路：
- Steer 会 `cancel()` 当前 invocation，并很快 `promote + processNext()` 启动被 steer 的消息（此时队列可能只剩 processing）。
- 被 cancel 的旧执行的 async cleanup 随后触发 `onInvocationComplete('canceled')`，由于 pause 发射条件过宽，发送了 `queue_paused` → 前端被污染为 paused=true → 形成“队列已暂停 0”。

## 4. 修复方案
目标：让 `queue_paused` 的发射条件与 `isPaused()` 语义一致，避免 paused= true 且 queued=0 的状态。

方案（后端为主）：
1. `QueueProcessor.onInvocationComplete(canceled/failed)`：仅当 `queue.hasQueuedForThread(threadId)` 为 true 时才 `pausedThreads.set(...)` 并 emit；否则清理 `pausedThreads` 并直接返回（不发 pause）。
2. `emitPausedToQueuedUsers`：仅对 **存在 queued 条目** 的用户发 `queue_paused`（`userQueue.some(e.status==='queued')`），避免 processing-only 的通知。

## 5. 验证方式
1. Red：新增回归测试，构造队列仅含 processing 条目时触发 `onInvocationComplete('canceled')`，断言 **不会** emit `queue_paused`，且 `isPaused()` 为 false。
2. Green：实现上述修复后测试转绿。
3. 回归：跑 QueueProcessor / queue API 相关测试，确认无行为回退（尤其是：存在 queued 条目时仍会 pause 并通知）。

