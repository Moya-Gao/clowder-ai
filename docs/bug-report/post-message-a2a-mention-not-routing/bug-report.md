---
feature_ids: [F055]
related_features: [F117, F167, F193]
topics: [a2a, mcp, post-message, targetCats, routing]
doc_kind: bug-report
created: 2026-05-21
status: fixed-in-branch
severity: P1
---

# Bug Report: `cat_cafe_post_message` 正确 @ 下一只猫不触发 A2A

## 1. 报告人

- 报告人：铲屎官（会话反馈）
- 定位：缅因猫（砚砚）
- 现象：通过 `cat_cafe_post_message` 发出的消息里包含正确的下一棒 `@`，但下一只猫没有被唤醒。

## 2. 复现步骤（期望 vs 实际）

复现草图：

1. 猫猫在当前 thread 的 invocation 内调用 `cat_cafe_post_message`。
2. `content` 含合法路由信号，例如：
   - 行首 `@opus 请继续处理`
   - 或 `targetCats: ["opus"]`
3. 消息出现在 thread 中。
4. 观察下一只猫是否被自动 invocation / queue auto-execute。

期望：

- `post_message.targetCats` 或内容中的合法行首 `@` 是结构化/文本 A2A 出口。
- route 层应把目标猫加入 `InvocationQueue` 或 parent worklist，并触发下一只猫执行。
- 若无法路由，工具返回值必须显式失败或给出 `routing_warnings`，不能让作者误以为已经传球。

实际：

- 铲屎官观察到消息里正确 `@` 下一只猫后，下一只猫未被唤醒。
- 这会形成静默掉球：作者看到 post 成功，final-routing guard 也可能因为 MCP `targetCats` 认为已传球，但实际没有下一棒执行。

## 3. 已知证据

- `docs/features/F117-message-delivery-lifecycle.md` 已记录同类问题：
  - Bug 3b：猫猫用 `cat_cafe_post_message` 发带 `@gpt52` 的消息，缅因猫 session 未收到。
  - F117 明确把它标为 out of scope，并要求“单开 callback @mention 路由 bug”。
- F055 的原始契约要求 `post-message` callback schema 支持 `targetCats`，且 `targetCats` 非空时直接路由，不依赖文本解析。
- 当前实现面显示路由路径存在但运行面仍可失败：
  - `packages/mcp-server/src/tools/callback-tools.ts`：`targetCats` schema 描述承诺会与内容 @mentions merge。
  - `packages/api/src/routes/callbacks.ts`：`post-message` handler 会解析内容 @mention / explicit `targetCats`，再调用 `enqueueA2ATargets`。
  - `packages/api/src/routes/callback-a2a-trigger.ts`：`enqueueA2ATargets` 在现代路径写入 `InvocationQueue` 并调用 `queueProcessor.tryAutoExecute`。
- 覆盖缺口：
  - 现有测试覆盖了 mention 解析、`enqueueA2ATargets` 局部 enqueue、以及 final-routing guard 对 MCP `targetCats` 的豁免。
  - 缺少端到端回归：真实 `cat_cafe_post_message` 调用 `targetCats` / 行首 @ 后，必须验证目标猫 invocation 实际启动或 queue entry 被 auto-execute。

## 4. 严重度

P1。

理由：这是 A2A 串行协作的核心链路。失败表现不是显式报错，而是“消息可见但下一棒不执行”，会让球权状态和实际运行状态分叉，铲屎官被迫人工转发。

## 5. 根因

确认根因是 **post_message 返回契约用“请求路由目标”冒充“实际新增唤醒目标”**：

1. 运行时日志显示，正确 `@codex` 被解析为 `targetCats: ["codex"]`，但 `InvocationQueue.hasQueuedAgentForCat(threadId, "codex")` 命中已有 queued entry，`enqueueA2ATargets` 返回 `enqueued: []`。
2. `MessageDeliveryService.resolveCallbackDeliveryDecision` 丢弃了 `a2aResult.enqueued`，只返回 `shouldBroadcastNow`。
3. `/api/callbacks/post-message` 成功响应继续用 `mentions` 构造 `message: "消息已路由给 @codex"`，没有暴露实际 `enqueued: []`。
4. `callback-a2a-trigger.ts` 日志在 `enqueued: []` 时仍打印 `A2A callback: enqueued to InvocationQueue`，进一步误导排查。

所以这不是 parser 没识别 `@`，而是 duplicate/no-op 路径没有把“未新增唤醒”反馈给调用者，造成作者和 final-routing guard 都误以为球已经传出。

## 6. 修复

分支：`fix/post-message-a2a-routing`

修复点：

1. `MessageDeliveryService` 返回实际 `enqueued`、`enqueueAttempted`、`enqueueFailed`。
2. `post-message` 成功响应新增 `routed`，并用实际 `enqueued` 构造人类可读 `message`。
3. duplicate/no-op 路径返回 `routed: []`，message 改为 `@codex 未新增唤醒（可能已有待处理队列或当前不可调度）。`
4. `callback-a2a-trigger.ts` 日志区分 `enqueued.length > 0` 和 `no new InvocationQueue entries enqueued`。
5. 新增 Red→Green 回归：`post-message does not claim routed when InvocationQueue skips a duplicate queued target`。

验证：

- `pnpm --filter @cat-cafe/api build` ✅
- `pnpm --filter @cat-cafe/api exec node --test test/callback-a2a-postmsg.test.js test/callback-delivery.test.js test/callback-routes.test.js test/callback-routes-agent-key.test.js test/callbacks-f182-c.test.js test/auto-reply-to-worklist.test.js` → 136/136 ✅
- `pnpm biome check ... --diagnostic-level=error` → 0 errors ✅
- `mention-ack.test.js` 仍有 2 个 `@opus` worklist 旧失败；已在 main 复现，同本修复无关。
