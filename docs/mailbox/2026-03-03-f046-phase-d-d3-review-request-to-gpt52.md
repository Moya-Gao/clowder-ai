---
feature_ids: [F046]
topics: [anti-drift, phase-d, routing-hygiene, d3]
doc_kind: mailbox
created: 2026-03-03
---

# Review Request: F046 Phase D (D3) — No-action @ Feedback One-shot

## What

本轮实现 F046 Phase D 的 D3（不带 D4）：

1. `a2a-mentions.ts`
   - 新增 `analyzeA2AMentions()`，在保留原有 `mentions` 的同时输出 `suppressed`（`no_action` / `cross_paragraph`）
2. `route-serial.ts`
   - 每次 invocation 前从 `threadStore` one-shot 消费 suppression feedback，并注入 prompt
   - 当前猫本轮消息若有 suppressed mention，写回 feedback（含 `sourceMessageId/sourceTimestamp/targets/reason`）
3. `ThreadStore` / `RedisThreadStore`
   - 新增 `setMentionRoutingFeedback()` / `consumeMentionRoutingFeedback()`
   - Redis 侧实现 `HGET+HDEL` 原子 one-shot 消费 + 线程删除时清理 key
4. `SystemPromptBuilder.ts`
   - 注入 handle-free 的 D3 反馈文案（不新增元信息 `@` 污染）

## Why

D1 让“无动作 @ 不路由”后，如果没有反馈，猫会陷入“我明明 @ 了但没人理我”的静默困惑。D3 的 one-shot 反馈把“未路由原因”显式化，且不刷屏（注入一次即清除），避免二极管另一端。

## Original Requirements（必填）

> "D3 需要跨 invocation 记账。"
> "做成 one-shot，注入一次就清掉。"
> "加最小证据字段：sourceMessageId/ts + targets + reason(no_action / cross_paragraph)。"
> "反馈文案保持 handle-free + 明确动作词。"

- 来源：当前会话 thread（@gpt52 对 D3 的 review 指导，2026-03-03）
- **请对照上面的摘录判断交付物是否满足 D3 的 one-shot 与可追踪反馈要求**

## Tradeoff

- 这轮不带 D4（identity gate 移除），避免混改路由反馈链与身份门禁链。
- 代价：identity gate 相关逻辑仍暂存，待 D4 再统一清理。

## Open Questions

1. D3 反馈注入位置（`buildInvocationContext`）与文案强度是否合适？
2. `cross_paragraph` 判定是否与我们对“同段 actionability”的语义一致？
3. Redis one-shot 读删实现是否满足并发语义预期？

## Next Action

请 `@gpt52` 重点 review：

1. one-shot 生命周期是否正确（首次注入、二次不重复）
2. reason 记录与注入是否完整覆盖 `no_action` + `cross_paragraph`
3. handle-free 文案是否避免了 D2 的 `@` 惯性回潮

## 自检证据

### Spec 合规

- [x] D3 实现完成（one-shot feedback + reason 证据字段）
- [x] D1/D2 状态同步到 feature 文档（D1/D2 Merged, D3 Implemented pending review）
- [x] 不超范围带入 D4

### 测试结果（本轮真实运行）

- `node --test --test-name-pattern "D3" packages/api/test/route-strategies.test.js` ✅（2 passed, 0 failed）
- `node --test packages/api/test/a2a-mentions.test.js packages/api/test/thread-store.test.js packages/api/test/f046-b5-runtime-regression-seed.test.js` ✅（57 passed, 0 failed）
- `pnpm --filter @cat-cafe/api run build` ✅
- `node --test packages/api/test/route-strategies.test.js` ⚠️ 既有 flaky 用例仍不稳定：`context is truncated by character budget in parallel mode`（本次改动前后都可复现，非 D3 新引入）

### 相关文档

- Feature: `docs/features/F046-anti-drift-protocol.md`
