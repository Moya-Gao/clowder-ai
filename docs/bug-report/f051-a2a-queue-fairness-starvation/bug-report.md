---
feature_ids: [F051]
debt_ids: []
topics: [a2a, queue, fairness, scheduling]
doc_kind: bug-report
created: 2026-03-01
---

# F051 A2A 链路压制用户队列（公平性缺失）

## 报告人

铲屎官，2026-03-01 在真实使用中观察到：较早排队的用户消息长期得不到执行，A2A 互相调用持续延长。

## 复现步骤

1. 线程内先有一条用户消息进入队列（`deliveryMode=queue`）。
2. 当前运行中的猫触发一轮 A2A 链式调用（mentions 扩展 worklist）。
3. A2A 链继续扩展到多跳（直到 `MAX_A2A_DEPTH`）。

### 期望 vs 实际

| 场景 | 期望 | 实际 |
|---|---|---|
| 存在等待中的用户队列消息 | A2A 不应无限延长，应尽快让出执行机会给队列 | A2A 链可持续扩展，多条历史队列消息被长期延后 |

## 根因分析

1. `route-serial.ts` 在命中 mentions 时会继续扩展 worklist，扩展判定只受深度限制（`MAX_A2A_DEPTH`）约束。
2. 该扩展逻辑不感知线程中是否存在 `status=queued` 的待处理用户队列消息。
3. `QueueProcessor` 只有在当前 invocation 完成后才会进入 `processNext()`，因此长 A2A 链会占满当前 invocation 生命周期。
4. 默认深度配置较大（当前为 15），放大了饥饿体感。

结论：不是单点 bug，而是调度公平性缺失——A2A 扩展在“有等待队列”时没有降级策略。

## 修复方案

在 A2A 扩展判定增加公平性门禁：

- 当线程存在等待队列（`queueHasQueuedMessages(threadId) === true`）时，禁止继续扩展 A2A worklist；
- 当前 invocation 处理到当前猫输出结束即可收敛，由 `QueueProcessor.onInvocationComplete` 触发队列自动出队；
- 不改变无队列时的既有 A2A 行为，避免破坏正常协作深度。

实现方式：

1. 为 `RouteOptions` 增加可选回调 `queueHasQueuedMessages?: (threadId: string) => boolean`；
2. `AgentRouter.routeExecution` 透传该回调给 `routeSerial`；
3. `route-serial.ts` 在 `canExtend` 判定中增加 `!queueHasQueuedMessages(threadId)` 条件；
4. `messages.ts` 与 `ConnectorInvokeTrigger.ts` 在调用 `routeExecution` 时注入 `queueHasQueuedMessages: (tid) => invocationQueue.hasQueuedForThread(tid)`；
5. 用 TDD 补两类测试：有队列时不扩展 / 无队列时保持扩展。

## 验证方式

1. **失败测试（Red）**
   - 有队列时：验证 worklist 不扩展，A2A 不继续链式调用。
2. **通过测试（Green）**
   - 无队列时：原有 A2A 扩展行为不变。
3. **回归**
   - 运行 routing/queue 相关测试，确认无行为回退。

