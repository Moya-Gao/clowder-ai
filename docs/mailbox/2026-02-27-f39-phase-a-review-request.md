---
feature_ids: [F039]
topics: [message, queue, delivery, review]
doc_kind: review-request
created: 2026-02-27
---

# Review 请求: F39 Message Queue Delivery — Phase A 后端队列核心

## 背景

让猫猫在跑的时候，铲屎官和系统消息可以排队发送，而不是只能取消或强制打断。Phase A 实现后端队列核心：InvocationQueue 数据结构、QueueProcessor 处理管线、POST /api/messages deliveryMode 分流、队列管理 API、WebSocket 定向事件。

## 设计文档

- **技术计划**: `docs/plans/2026-02-26-message-queue-delivery-plan.md` (Phase A)
- **产品需求**: `docs/plans/2026-02-26-message-queue-delivery.md`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1.1 | QueueEntry 数据结构 | ✅ | InvocationQueue.ts:L3-16 |
| 1.2 | enqueue/dequeue FIFO | ✅ | 31 tests |
| 1.3 | 同源合并 (source+targetCats+intent) | ✅ | 3 merge tests |
| 1.4 | MAX_QUEUE_DEPTH=5 | ✅ | capacity test |
| 1.5 | backfillMessageId (null→value) | ✅ | tested |
| 1.6 | appendMergedMessageId | ✅ | tested |
| 1.7 | rollbackMerge (preMergeContent) | ✅ | tested |
| 1.8 | move (up/down reorder) | ✅ | tested |
| 1.9 | scopeKey 用户隔离 | ✅ | 6 isolation tests |
| 1.10 | 跨用户方法 (peekOldestAcrossUsers 等) | ✅ | tested |
| 2.1 | onInvocationComplete succeeded→auto-dequeue | ✅ | chain test (P1 fix) |
| 2.2 | onInvocationComplete canceled/failed→pause | ✅ | 2 tests |
| 2.3 | processNext 用户级入口 | ✅ | tested |
| 2.4 | processingThreads mutex | ✅ | concurrency test |
| 2.5 | executeEntry pipeline | ✅ | idempotency key test |
| 2.6 | executeEntry 返回 status + chain auto-dequeue | ✅ | P1 fix, chain test |
| 2.7 | executeEntry catch marks record failed | ✅ | P1 fix, failure test |
| 3.1 | deliveryMode schema | ✅ | messages.schema.ts |
| 3.2 | 智能默认 (hasActive→queue) | ✅ | tested |
| 3.3 | queue mode: enqueue→write→backfill→202 | ✅ | tested |
| 3.4 | queue full→429 + queue_full_warning | ✅ | tested |
| 3.5 | MessageStore 写失败→rollback | ✅ | tested |
| 3.6 | force mode: cancel→immediate | ✅ | tested |
| 4.1 | guardThreadOwnership (401/404/403/system) | ✅ | 4 auth tests |
| 4.2-4.6 | 5 queue API endpoints | ✅ | 17 tests |
| 4.7 | scopeKey 用户隔离 (API 层) | ✅ | 4 isolation tests |
| 5.1 | messages.ts finally→onInvocationComplete | ✅ | wired |
| 5.2 | invocations.ts finally→onInvocationComplete | ✅ | wired |
| 6.1 | SocketManager.emitToUser | ✅ | Socket.IO rooms |
| 6.2 | queue_updated/queue_paused/queue_full_warning 事件 | ✅ | emitted in all paths |

**P1 issues found and fixed during self-check**:
1. `executeEntry` 不返回 status → chain auto-dequeue 断裂 → Fixed: 返回 `'succeeded' | 'failed'`，`.then()` 替代 `.finally()` 保证 mutex 先释放
2. `executeEntry` catch 不 mark InvocationRecord failed → Fixed: 加 `invocationRecordStore.update(id, { status: 'failed', error })`

## 改动文件

| 文件 | 改动类型 | 行数 | 说明 |
|------|----------|------|------|
| `InvocationQueue.ts` | 新增 | 294 | Per-user FIFO 队列，scopeKey 隔离，合并/回滚/reorder |
| `QueueProcessor.ts` | 新增 | 289 | 双入口处理器：系统级 auto-dequeue + 用户级 manual trigger |
| `messages.schema.ts` | 修改 | +2 | deliveryMode enum |
| `messages.ts` | 修改 | +112 | 队列分流逻辑 (queue/force/immediate) |
| `queue.ts` | 新增 | 181 | 5 个队列管理 API endpoints |
| `invocations.ts` | 修改 | +10 | finally block 接入 QueueProcessor |
| `SocketManager.ts` | 修改 | +10 | emitToUser + room join |
| `index.ts` | 修改 | +25 | 实例化 + 注入 |
| `routes/index.ts` | 修改 | +1 | export queueRoutes |
| 4 test files | 新增 | 1129 | 65 tests total |

**Total**: 13 files, +2051/-2 lines

## Git SHA

- Base: `543a484` (main)
- Head: `3b6b4d2` (feat/f39-message-queue, 6 commits)

## Commits

```
8153582 feat(F39): InvocationQueue 数据结构 + 合并 + 基础操作
cc2fd09 feat(F39): QueueProcessor — 完成回调自动出队 + 暂停管理
918793a feat(F39): POST /api/messages deliveryMode 队列分流
d7f45fa feat(F39): 队列管理 API — GET/DELETE/next/move
35f12c7 feat(F39): 接线 — complete() 回调触发队列出队
3b6b4d2 fix(F39): QueueProcessor P1 — chain auto-dequeue + record failure update
```

## 测试状态

```
F39 tests: 65 passed, 0 failed
Unit tests (non-Redis): 2048 passed, 0 failed (2 Redis fault drills skipped — pre-existing, need live Redis)
Build: tsc clean, 0 errors
```

## Review 重点

1. **InvocationQueue scopeKey 隔离**：`${threadId}:${userId}` 是否足够防止跨用户数据泄漏？特别是 `peekOldestAcrossUsers` 遍历所有 scope 的安全性
2. **QueueProcessor chain auto-dequeue 的 mutex 时序**：`.then()` 里先 `processingThreads.delete()` 再 `onInvocationComplete()` — 这个顺序是否正确？会不会有窗口期导致两个 entry 同时 start？
3. **messages.ts 队列分流复杂度**：queue/force/immediate 三路分支加到已有 600 行的 route handler 里，复杂度是否可控？是否需要提取 helper？
4. **QueueProcessor minimal interfaces (as any casts)**：index.ts 里用 `as any` 强转注入 — 是否需要更严格的类型适配？
5. **executeEntry vs messages.ts background pipeline 的重复度**：两者逻辑相似但独立实现，未来维护成本

## 五件套

**What**: F39 Phase A — 后端消息排队投递核心。InvocationQueue (per-user FIFO) + QueueProcessor (auto-dequeue/pause) + deliveryMode API 分流 + 队列管理 5 endpoints + WebSocket 定向事件。

**Why**: 当前猫猫在跑时只能 stop 或等待，不能排队。铲屎官发消息只有"打断"和"等着"两个选择。排队投递让消息先入队、猫跑完自动处理下一条，大幅改善多轮对话体验。

**Tradeoff**:
- 选择纯内存队列（和 InvocationTracker 一致），放弃 Redis 持久化 — Phase C 再考虑
- QueueProcessor.executeEntry 复制了 messages.ts background pipeline 的逻辑而非复用 — 避免耦合，但增加维护成本
- 用 Socket.IO rooms 实现 emitToUser 而非手动维护 userId→socketId 映射 — 更简洁但依赖 socket.io 内部行为
- `as any` casts for minimal interfaces — 快速解耦但丢失类型安全

**Open Questions**:
1. executeEntry 和 messages.ts background pipeline 的重复逻辑是否值得统一提取？
2. `as any` casts 是否需要在 Phase B/C 时补充 proper adapter？
3. 队列满时前端 UX（429 + queue_full_warning）是否足够？Phase B 设计需确认

**Next Action**: 请 review 上述 13 个文件，重点关注 5 个 review 重点。
