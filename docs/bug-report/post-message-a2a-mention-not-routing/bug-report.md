---
feature_ids: [F055]
related_features: [F117, F167, F193]
topics: [a2a, mcp, post-message, targetCats, routing]
doc_kind: bug-report
created: 2026-05-21
status: reported
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

## 5. 根因候选

还没完成 runtime 复现，先记录候选点，避免过早下结论：

1. `post-message` callback route 解析出了 `mentions`，但 `router / invocationRecordStore / invocationQueue / queueProcessor` 某个依赖在实际运行路径缺失或状态不满足，导致 `canEnqueueA2A` 或 auto-execute 失效。
2. `enqueueA2ATargets` 成功 enqueue，但 `QueueProcessor.tryAutoExecute` 被 busy slot / duplicate guard / stale invocation 状态挡住，返回值没有把“未实际唤醒”反馈给调用者。
3. final-routing guard 把 `cat_cafe_post_message.targetCats` 当成合法传球出口，但它只验证“结构化意图存在”，不验证后端实际路由成功，导致静默失败无二次提醒。
4. prompt 层和工具层存在契约冲突：`McpPromptInjector` 写着“为了 @ 队友不要调 post-message”，但 F055 / tool schema / final-routing guard 又把 `post_message.targetCats` 视为合法结构化传球。

## 6. 修复建议

先做 Red→Green：

1. 新增端到端测试：通过 `/api/callbacks/post-message` 用 invocation token 发 `targetCats: ["opus"]` 和行首 `@opus` 两组 case。
2. 断言不止返回 `status: "ok"`，还要确认：
   - response `message` / `routed` 能表达实际 enqueue 结果；
   - `InvocationQueue` 有 agent entry；
   - `QueueProcessor.tryAutoExecute` 被调用；
   - 目标猫 invocation 被启动，或明确返回“已排队但未执行”的结构化状态。
3. 若设计上不再允许 `post_message` 作为传球工具，则反向修正：
   - `cat_cafe_post_message` schema / docs 移除“targetCats 可路由”的承诺；
   - final-routing guard 不再把 `post_message.targetCats` 当合法出口；
   - prompt 层统一要求直接行首 @ 或专用 A2A routing tool。

当前倾向：保留 `post_message.targetCats` 作为合法结构化路由，因为 F055/F098/F167 多处已经依赖这个契约；修实现和端到端验收更符合现有设计。
