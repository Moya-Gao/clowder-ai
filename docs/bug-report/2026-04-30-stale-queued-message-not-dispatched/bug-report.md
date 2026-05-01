---
feature_ids: [F117, F175]
topics: [bug-report, queue, message-delivery, connector, invocation]
doc_kind: bug-report
created: 2026-04-30
---

# Bug Report: stale queued messages are not dispatched after invocation completion

## 1. 报告人

Landy 在 2026-04-30 runtime dogfood 时发现：猫猫执行期间发送的消息会进入消息队列，但猫猫跑完后不会再推送；外部 GitHub / IM connector 进入的消息也有同样现象。

## 2. 复现步骤

1. 某 thread 有 active invocation。
2. 在 active invocation 期间发送 user message 或 connector message，使其进入 `InvocationQueue`。
3. queued entry 等待超过 `InvocationQueue.STALE_QUEUED_THRESHOLD_MS`。
4. active invocation 完成并调用 `QueueProcessor.onInvocationComplete(...)`。

期望行为：queued entry 仍是 pending work，completion 后应自动出队并执行。

实际行为：entry 留在 `queued` 状态，不触发后续 invocation。

## 3. 根因分析

`InvocationQueue.hasQueuedForThread()` 同时承担了两种语义：

1. 路由公平性 / freshness gate：旧 user / connector entry 不应永久强制 thread-wide queue mode。
2. 队列调度 gate：invocation 完成后是否还有 dispatchable queued work 需要唤醒。

F175 为了避免旧交互消息永久影响新路由，在 `hasQueuedForThread()` 中给 user / connector entry 加了 60s stale guard；agent entry 由于 A2A continuation 需要被豁免。`QueueProcessor.onInvocationComplete()` 复用了这个 freshness gate，导致 user / connector queued entry 超过 60s 后虽然还在队列里，却被 completion path 当成“无队列”跳过。

## 4. 修复方案

拆分判断语义：

- `hasQueuedForThread()` 保留 freshness/fairness 语义，继续忽略 stale user / connector entry，避免旧消息永久影响新消息路由。
- 新增 `hasDispatchableQueuedForThread()`，只判断是否存在 `status === 'queued'` 的 pending work，不按年龄过期。
- `QueueProcessor` 内部调度、pause、thread busy 与 auto-recovery gate 改用 dispatchable 语义。

## 5. 验证方式

新增回归覆盖：

- stale user entry：freshness gate 忽略，但 dispatch gate 必须可见。
- stale connector entry：freshness gate 忽略，但 dispatch gate 必须可见。
- invocation succeeded 后 stale user queued entry 自动出队执行。
- invocation succeeded 后 stale connector queued entry 自动出队执行。
- invocation failed / canceled 后 stale queued entry 仍进入 paused / #595 auto-recovery。
- `isThreadBusy()` 在只有 stale queued entry 时仍返回 busy，避免 delivery-batch-done 提前关闭。

验证命令见 review request：`docs/mailbox/2026-04-30-stale-queued-message-dispatch-review-request.md`。
