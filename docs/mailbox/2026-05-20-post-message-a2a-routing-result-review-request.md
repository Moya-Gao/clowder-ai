# Review Request: post_message A2A 实际路由结果回传

Review-Target-ID: fix-post-message-a2a-routing
Branch: fix/post-message-a2a-routing

## What

- 修正 `/api/callbacks/post-message` 的成功响应：`routed` 现在表示实际新增 enqueue 的目标，不再用请求里的 `mentions` 冒充执行结果。
- `MessageDeliveryService` 保留 `enqueueA2A()` 的实际结果：`enqueued` / `enqueueAttempted` / `enqueueFailed`。
- `InvocationQueue` duplicate/no-op 路径不再返回“消息已路由给 @cat”，而是返回“未新增唤醒”。
- `callback-a2a-trigger.ts` 日志区分 `enqueued.length > 0` 和没有新增 queue entry。
- 更新 bug report：`docs/bug-report/post-message-a2a-mention-not-routing/bug-report.md`。

## Why

铲屎官现场报告：`post_message` 里正确 `@` 下一只猫但不生效。运行时日志确认 parser 已识别 `@codex`，但 duplicate queued guard 让 `enqueueA2ATargets` 返回 `enqueued: []`；旧响应仍用 requested `mentions` 生成“已路由”，造成静默掉球。

## Original Requirements（必填）

> report 一个bug 在post msg里正确的at 下一只猫不生效
> 哈哈哈那你赶紧修！ 开wktree修了就好！

- 来源：当前 thread 铲屎官消息（2026-05-20）+ `docs/bug-report/post-message-a2a-mention-not-routing/bug-report.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

没有新增 harness 层重调度机制。duplicate queued entry 仍按既有逻辑调用 `tryAutoExecute()` nudged 队列；这次只修“API/日志不能谎称已新增路由”的契约。这样避免把一个响应真实性 bug 扩大成 QueueProcessor 行为重构。

## Architecture Ownership（必填）

Architecture cell: dispatch
Map delta: none
Why: 只扩展现有 callback A2A/InvocationQueue 结果回传，不新增 Store / Queue / Router / Adapter / Dispatcher / Binding。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- `check:architecture-ownership` warning 中的 InvocationQueue 命中是否只是字符串/文档 noun，而不是边界变化

## Open Questions

### 技术 OQ（给 reviewer）

1. `routed` 语义改成“实际 enqueued”是否会影响现有调用方对 `status: ok` 的兼容性？
2. duplicate/no-op 时 message 写“未新增唤醒（可能已有待处理队列或当前不可调度）”是否足够明确，还是应该拆出结构化 `notEnqueued` 字段？
3. `enqueueFailed` 目前只作为返回契约保留给 route 层，当前未进入响应；是否需要直接暴露给 MCP caller？

### 价值 OQ（给 CVO，如有）

无。

## Next Action

请 review 这次 bug fix，重点看 A2A 结果契约、duplicate queued 路径、以及是否需要进一步修 final-routing guard 对 `post_message.targetCats` 的理解。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-post-message-a2a-routing/opus`
- Start Command: `pnpm review:start`
- Ports: backend-only review；无需启动 web/api。如需启动，使用 `pnpm review:start` 自动分配，禁止 3001/3002/3011/3012/4111。

## 自检证据

### Spec 合规

- 原始需求：post_message 正确 @ 下一只猫不生效。
- 修复结果：duplicate/no-op 时不再报告“已路由”，响应 `routed: []`，并保留既有 `tryAutoExecute()` nudged 行为。
- Bug report 已从 `reported` 更新为 `fixed-in-branch`，并写入真实根因。

### 测试结果

- `pnpm --filter @cat-cafe/api build` ✅
- `pnpm --filter @cat-cafe/api exec node --test test/callback-a2a-postmsg.test.js test/callback-delivery.test.js test/callback-routes.test.js test/callback-routes-agent-key.test.js test/callbacks-f182-c.test.js test/auto-reply-to-worklist.test.js` → 136/136 ✅
- `pnpm biome check packages/api/src/domains/cats/services/agents/invocation/MessageDeliveryService.ts packages/api/src/routes/callback-a2a-trigger.ts packages/api/src/routes/callbacks.ts packages/api/test/callback-a2a-postmsg.test.js packages/api/test/callback-delivery.test.js --diagnostic-level=error` → 0 errors ✅
- `node scripts/check-hotfix-pattern.mjs` → hotfix=false ✅
- `node scripts/check-fallback-layers.mjs` → no fallback pattern changes ✅
- `pnpm check:architecture-ownership` → exit 0，warning-only：existing feature-doc warnings + diff noun warning for `InvocationQueue`
- `mention-ack.test.js` 有 2 个 `@opus` worklist 旧失败；已在 main 复现，同本改动无关。

### 相关文档

- Bug Report: `docs/bug-report/post-message-a2a-mention-not-routing/bug-report.md`
