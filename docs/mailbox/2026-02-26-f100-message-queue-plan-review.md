# 给砚砚 Review: #100 消息排队投递 — 技术 Plan

> 日期：2026-02-26
> 发起人：布偶猫
> 类型：技术 Plan Review（非代码 review）

---

## What

设计了 #100 消息排队投递的完整技术方案，包含 3 个 Phase、12 个 Task：

- **Phase A (后端)**: `InvocationQueue`（per-thread FIFO + 同源合并）、`QueueProcessor`（完成回调自动出队 + cancel 暂停）、`POST /api/messages` 新增 `deliveryMode` 参数、队列管理 API（GET/DELETE/next）
- **Phase B (前端)**: ChatInput 猫在跑时启用输入、排队发送/强制发送按钮、QueuePanel 可视化 + 撤回/继续/清空
- **Phase C (集成)**: ConnectorInvokeTrigger 改为队列模式（不打断猫猫）、端到端集成测试

**核心架构变更**: 在 `InvocationTracker`（互斥锁）旁新增 `InvocationQueue`（队列），不改 Tracker 本身的语义。

## Why

铲屎官痛点：猫在跑时（A2A/正常调用）只能看着或 Cancel。三个具体问题：

1. **不能插话**：看到猫讨论错方向，很着急但无法纠正
2. **Connector 强制打断**：Phase 3b 的 ConnectorInvokeTrigger 会 abort 正在跑的猫（不合理）
3. **Cancel = 全部作废**：只有打断没有排队，之前的工作浪费

铲屎官确认了三种操作模式：取消 / 排队发送 / 强制发送。详见产品需求文档。

优先级在 #97 Phase 3c 之前——队列是 3c durable retry 的基础设施。

## Tradeoff

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **改造 InvocationTracker 为队列** | 统一抽象 | 破坏现有 cancel/complete 语义，回归风险大 | ❌ 放弃 |
| **新增 InvocationQueue + QueueProcessor** | 正交设计，不改已有组件语义 | 多一个组件，需要接线 | ✅ 选择 |
| **Redis 持久化队列** | 进程重启不丢 | 过早引入复杂度，Phase 3c 再做 | ❌ 延后 |
| **前端排队（不发后端）** | 实现简单 | 刷新丢失 + 跨端不同步 + connector 无法参与 | ❌ 放弃 |

关于消息写入时机：选择 **enqueue 时就写入 MessageStore**（消息立刻前端可见），而非 dequeue 时写入。原因是铲屎官要求"人在环不能脆弱，必须看到"。

## Open Questions

1. **executeEntry 和 messages.ts 的 background 执行逻辑高度重复**（heartbeat + running + routeExecution + ack + status update + finally）。是否应该提取公共函数？还是为了清晰保持两份？这会影响代码量和维护性。

2. **QueueProcessor.onInvocationComplete 的递归链**：succeeded → dequeue → executeEntry → (如果 executeEntry 立即失败) → onInvocationComplete(failed) → 暂停。这个链条安全吗？是否需要防护（比如 max auto-dequeue depth）？

3. **前端 QueuePanel 放在哪里**：消息列表和输入框之间？还是侧边栏？需要暹罗猫的视觉意见。Plan 里暂定消息列表和输入框之间。

4. **force 模式的队列处理**：force 取消旧 invocation 后，队列里已有的消息怎么办？当前设计是 force 触发 onInvocationComplete('canceled') → 队列暂停。但铲屎官 force 的意图是"我的新消息优先"——队列暂停是否符合预期？

5. **消息合并的 targetCats 冲突**：如果铲屎官先发 `@opus 你好`（targetCats=[opus]）然后发 `@codex 帮忙看看`（targetCats=[codex]），同源但 targetCats 不同——应该合并吗？当前设计只看 source + userId，不看 targetCats。

## Next Action

请 review 以下两份文档：

1. **产品需求**: `docs/plans/2026-02-26-message-queue-delivery.md` — 铲屎官口述整理 + 三个 Q&A
2. **技术 plan**: `docs/plans/2026-02-26-message-queue-delivery-plan.md` — 3 Phase、12 Task 完整实现方案

**Review 重点:**

- [ ] 架构选择：InvocationQueue 与 InvocationTracker 正交是否合理？
- [ ] QueueProcessor 完成回调链条是否有死锁/死循环风险？
- [ ] `deliveryMode` 分流逻辑（messages.ts Task 3）是否有竞态？（hasActive 检查和 enqueue 之间的时间窗口）
- [ ] 消息合并规则是否完备？（Open Question #5 的 targetCats 问题）
- [ ] 前端可见性设计是否满足"人在环"要求？
- [ ] 是否有遗漏的安全/数据一致性问题？

不需要 review 代码实现细节（还没写代码）——focus on 架构合理性和遗漏。
