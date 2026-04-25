---
doc_kind: review-request
created: 2026-04-24
topics: [slot-cancel, queue, a2a, review-request]
author: codex
reviewer: opus
---

# Review Request: slot cancel abort guard and A2A tracker gap

Review-Target-ID: fix-slot-cancel-queue-abort
Branch: fix/slot-cancel-queue-abort

## What
- 在 `QueueProcessor.executeEntry()` 的 queued/A2A 执行循环里补 abort guard，避免用户 cancel 后继续广播旧 producer 产出的 text/done。
- 将 REST per-cat cancel 的 tracker reason 从 `user_stop` 对齐为 `user_cancel`，与 WebSocket cancel 和 `QueueProcessor` 的 `canceled_by_user` 判断一致。
- 给 A2A handoff 的子 slot 注册 `InvocationTracker`，避免父 slot 完成后、子猫仍在跑时，thread-level queue gate 误判为空闲。
- 补回归测试锁住三个点：
  - user cancel during queued execution 之后不再广播 late agent events。
  - REST `/api/threads/:threadId/cancel/:catId` 调用 tracker 时使用 `user_cancel`。
  - A2A child slot 在 parent slot 完成后仍保持 thread busy，no-@ 消息不能绕过队列。

## Why
铲屎官现场看到 slot/queue 行为混乱：

1. 前端显示 cancel，但布偶猫仍在跑。
2. A2A 链上布偶猫仍在跑时，无 @ 消息直接发出，而不是进入队列。

第一个症状根因是 queued/A2A 执行链路缺少 `messages.ts` 那类 mid-loop abort guard，cancel 后仍可能把 stale event 发到前端。

第二个症状根因是 `routeSerial` 将 A2A 子猫加入 worklist 后，没有同步注册 `InvocationTracker` slot。父猫 slot `completeSlot()` 后，tracker 认为 thread 已空闲，导致 no-@ 消息走 immediate 而非 queue。

## Original Requirements（必填）
> 现在slot有很多bug 甚至整个消息乱七八糟的。
> 缅因猫 -> 布偶猫；布偶猫在跑，此时我按cancel，竟然只是前端显示cancel，布偶猫还在跑！？
> 布偶猫在跑；我没有at发消息，按道理除非我steer，不然这消息要在消息队列，但是竟然发出去了？！
- 来源：当前 thread 导航/对话历史 `0001777089478830-000611-9709a6de`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 这次没有重写 queue/router 架构，只补齐已经存在的统一 cancel/queue 不变量：route 层只暴露 lifecycle hook，不直接依赖 `InvocationTracker`。
- A2A 子 slot 复用 parent invocation controller，符合当前 serial route 共享 abort signal 的执行模型；用户 cancel 子 slot 时会 abort 整条 serial route。
- `trackExternalSlot()` 遇到不同 controller 的既有 slot 会拒绝覆盖，后续 cleanup 也受 controller match 保护，避免误删别的 active slot。

## Open Questions
- 请重点 review `QueueProcessor` mid-loop abort guard 的位置：是否还存在 cancel 后会先执行副作用、再 break 的窗口。
- 请确认 REST cancel 改成 `user_cancel` 后，不会破坏原本希望普通失败/canceled 暂停队列的语义。
- 请重点 review A2A child slot 的生命周期：在 `a2a_handoff` 事件前注册、route `finally` 兜底完成，是否覆盖 callback-pushed worklist 和 response-text handoff 两条路径。
- 请看这次是否还需要对 frontend cancel 状态做额外 reconcile；我目前判断核心服务端 late event leak 和 no-@ bypass 都已经被锁住。

## Next Action
- 请 review 这次 API queue/cancel/A2A tracker 修复。重点看 cancel 语义、thread-level queue 不变量、A2A child slot lifecycle、回归测试是否足够。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-slot-cancel-queue-abort/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 相关上下文：F117 delivery status 不变量、F122 unified dispatch queue。
- 修复点符合 F117/F122 要求：
  - cancel/queued/A2A 执行不应继续把未交付或已取消的 agent event 送入前端时间线。
  - active A2A child slot 期间，thread-level queue gate 不能误判为空闲。
- 根目录工件闸门：
  - `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` -> empty
  - `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` -> empty

### 测试结果
- Red: `node --test packages/api/test/route-serial-a2a-tracker.test.js` 曾失败，确认 A2A child slot 在 parent complete 后没有保持 thread busy。
- `pnpm --filter @cat-cafe/api lint` -> exit 0
- `pnpm --filter @cat-cafe/api build` -> exit 0
- `pnpm check` -> exit 0（skills manifest 有 5 条既有 advisory warning，不阻断）
- `git diff --check` -> exit 0
- `node --test packages/api/test/queue-processor.test.js packages/api/test/queue-api.test.js` -> 78 pass, 0 fail
- `node --test packages/api/test/messages-delivery-mode.test.js packages/api/test/messages-f108b-whisper-dispatch.test.js packages/api/test/queue-gate-thread-level.test.js packages/api/test/queue-integration.test.js packages/api/test/infrastructure/socket-cancel-invocation.test.js` -> 38 pass, 0 fail
- `node --test packages/api/test/route-serial-a2a-tracker.test.js packages/api/test/invocation-tracker.test.js packages/api/test/route-strategies.test.js` -> 138 pass, 0 fail
- `node --test packages/api/test/route-serial-a2a-tracker.test.js packages/api/test/invocation-tracker.test.js packages/api/test/route-strategies.test.js packages/api/test/queue-processor.test.js packages/api/test/queue-api.test.js packages/api/test/messages-delivery-mode.test.js packages/api/test/messages-f108b-whisper-dispatch.test.js packages/api/test/queue-gate-thread-level.test.js packages/api/test/queue-integration.test.js packages/api/test/infrastructure/socket-cancel-invocation.test.js` -> 254 pass, 0 fail
- `pnpm --filter @cat-cafe/api test` -> 9352 pass, 0 fail, 3 skipped

### 相关文档
- Feature context: `docs/features/F117-agent-message-delivery-status.md`
- Feature context: `docs/features/F122-unified-dispatch-queue.md`
