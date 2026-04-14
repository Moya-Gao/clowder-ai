# Review Request: early cancel 后卡 slot / 无法再次 @

Review-Target-ID: fix-stop-early-cancel-fix
Branch: fix/stop-early-cancel-fix

## What
- 修正聊天输入区 `Stop` 走 WebSocket `cancel_invocation(threadId)` 时，`cancel-all` 只清 `InvocationTracker`、不清 `QueueProcessor` 的不对称
- 补上 cancel-all 的 `system_info + done` 广播，保持与 REST `/cancel/:catId` 收尾一致
- 在 `messages.ts` 主执行链加 abort 前置守卫，避免用户 Stop 先赢 race 后仍迟到广播 `spawn_started`
- 新增 2 个回归测试：WS cancel-all 收尾、abort-before-spawn_started

## Why
- 铲屎官复现到一个稳定现象：消息发出后 1s 内发现 @ 错猫并点击取消，之后再 @ 同一只猫，会表现成“像卡 slot”或“没反应”
- 上次修的是 display 层 `done` 计数；这次是 stop/cancel 生命周期另一处缺口
- 根因是前端和后端对“已取消 invocation 是否彻底收尾”不一致：前端清了，后端没有完整补广播/slot cleanup，且后台协程仍可能迟到发 `spawn_started`

## Original Requirements
> “发出去1s可能cli都没启动起来发现at错了，点了取消，然后再at就at不了他了，或者说at他 他没反应 很像是卡slot？”
- 来源：当前 thread 用户消息 `0001776206772731-000102-eea64619`
- 请对照上面的摘录判断交付物是否真正解决了“早停后再 @ 同一只猫像卡 slot”的问题

## Tradeoff
- 没改前端 heuristics 去掩盖现象，而是把后端 cancel-all 清理链补齐
- `SocketManager` 只新增 `setQueueProcessor()` 注入，不改构造顺序，避免扩大 bootstrap 影响面
- 这轮先钉住用户直达路径（用户消息 -> Stop）；没顺手扩散到所有 callback/queue 分支

## Open Questions
- `cancel_invocation` 现在已与 REST cancel 在广播和 queue cleanup 上对齐，是否还有别的 stop 入口仍然不对称
- `messages.ts` 的 abort 守卫是否足够，还是需要把同类守卫补到其它 invocation 循环里一起收敛

## Next Action
- 请重点 review 这条链：`ChatInput Stop -> SocketManager.cancel_invocation -> messages.ts early abort`
- 请确认这是不是“最小但正确”的修复，而不是只压住表象

## Review Sandbox
- Path: `/tmp/cat-cafe-review/fix-stop-early-cancel-fix/opus`
- Start Command: `pnpm review:start`
- Ports: `web=TBD`, `api=TBD`

## 自检证据

### Spec 合规
- 无独立 feature spec；本轮按用户现象闭环验收
- 目标不是 UI 计数，而是“早停后不再卡住，后续可再次 @”

### 测试结果
- `pnpm run build` (`packages/api`) ✅
- `bash ./scripts/with-test-home.sh node --test test/messages-delivery-mode.test.js test/infrastructure/socket-cancel-invocation.test.js` → `13/13` ✅
- `bash ./scripts/with-test-home.sh node --test test/infrastructure/ws-origin-security.test.js test/invocation-tracker.test.js test/queue-processor-zombie.test.js` → `68/68` ✅

### 相关文档
- Mailbox: `docs/mailbox/2026-04-14-stop-early-cancel-review-request.md`
- 相关代码：
  - `packages/api/src/infrastructure/websocket/SocketManager.ts`
  - `packages/api/src/routes/messages.ts`
  - `packages/api/test/infrastructure/socket-cancel-invocation.test.js`
  - `packages/api/test/messages-delivery-mode.test.js`
