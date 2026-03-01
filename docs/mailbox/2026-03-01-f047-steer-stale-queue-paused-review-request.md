---
feature_ids: [F047, F039]
topics: [queue, steer, pause, websocket]
doc_kind: review-request
created: 2026-03-01
---

# Review Request: F047 Steer 后“队列已暂停 0”假暂停修复

## What
- 修复 `QueueProcessor.onInvocationComplete(canceled/failed)` 在 **无 queued 条目**时仍广播 `queue_paused`，导致前端 QueuePanel 卡在“队列已暂停 0 / 当前调用已取消”。
- 行为调整：
  - canceled/failed **仅当 thread 仍有 queued 条目**时才进入 paused，并发 `queue_paused`
  - `queue_paused` 仅发给 **存在 queued 条目**的用户（不再对 processing-only 发）
- 增加回归测试覆盖 steer immediate 的典型竞态面（processing-only queue）。

## Why
Steer immediate 会 cancel 当前 invocation 并快速把 queued 条目 promote 到 processing。旧 invocation 的 async cleanup 可能晚到触发 `onInvocationComplete('canceled')`，而我们当前 pause 发射条件过宽，导致前端被“暂停态”污染，出现 paused badge=0 的假暂停。

## Original Requirements（必填）
> “Steer后会一直保持这种队列已经取消”（QueuePanel 显示：队列已暂停 0 / 当前调用已取消）
- 来源：`docs/bug-report/2026-03-01-f047-steer-stale-queue-paused/bug-report.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 选择后端修复（对齐 `isPaused()` 语义）而不是前端“遇到 paused+0 就强行隐藏”：
  - ✅ 后端作为真相源，避免 WS 事件把 store 污染成不可能状态
  - ✅ 同时修复 connector/force/steer 等共享链路
  - ❌ 行为变化：当 canceled/failed 发生但当下无 queued 条目时，不再“记住 paused”留待未来入队显现（但 `isPaused()` 本来也不可见，且更容易制造 stale）

## Open Questions
1. `onInvocationComplete(canceled/failed)` 在 `hasQueuedForThread=false` 时直接清 paused 并 return：语义是否符合我们“paused 只用于管理 queued”的定义？
2. `emitPausedToQueuedUsers` 只按 queued 条目筛选是否足够？是否需要在 payload 中也裁剪 queue（我保留了全量 userQueue，以便 UI 仍能看到 processing 状态）。

## Next Action
请你 review 这次修复是否正确、是否有遗漏的 pause 事件发射路径。

## 自检证据

### Spec 合规
- Bug report（5 件套）：`docs/bug-report/2026-03-01-f047-steer-stale-queue-paused/bug-report.md`
- 修复点：对齐 `QueueProcessor.isPaused()` 语义（paused ⇒ must-have queued）

### 测试结果
- `node --test packages/api/test/queue-processor.test.js` → 15/15 pass ✅
- `node --test packages/api/test/queue-api.test.js packages/api/test/queue-integration.test.js` → 32/32 pass ✅
- `REDIS_URL= pnpm --filter @cat-cafe/api test` → 2250 pass / 0 fail / 1 skipped ✅
- `REDIS_URL= pnpm -r --if-present run build` → success ✅
- `pnpm --filter @cat-cafe/api lint` → 0 errors ✅

### 相关信息
- Branch: `fix/f047-steer-paused`
- Commit: `7b122637`

