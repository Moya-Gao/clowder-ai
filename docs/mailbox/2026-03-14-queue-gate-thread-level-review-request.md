# Review Request: Queue gate regression — restore thread-level enqueue check

## What

`messages.ts:291` 的 queue gate 从 thread-level 退化为 slot-level，导致 A2A 进行中用户新消息绕过队列直接执行。

核心改动：
- `packages/api/src/routes/messages.ts` — `has(threadId, primaryCat)` → `has(threadId)`（一行修复）
- `packages/api/test/queue-gate-thread-level.test.js` — 3 个回归测试

## Why

铲屎官 2026-03-14 实测发现：猫 B（A2A）在跑时，用户发给猫 A 的消息不进队列，两猫同时说话。

根因：F108 引入 per-thread-per-cat 多槽后，queue gate 改用 `has(threadId, primaryCat)` 只检查目标猫的 slot。当猫 B 活跃但猫 A 的 slot 空闲时，`hasActive=false`，消息直接 immediate 执行。

## Original Requirements（必填）

> "布偶猫在 at 一只猫走 a2a 的时候我发消息竟然不在消息队列，然后出现了布偶猫和那只猫同时说话"
- 来源：铲屎官 2026-03-14 实时反馈
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 保留 slot-aware 语义在执行层和取消层（`InvocationTracker.has(threadId, catId)` 仍可用于 specific slot check）
- 只在用户消息入队判定处恢复 thread-level gate
- 未修改 `InvocationTracker` 本身，它已经支持两种调用方式

## Open Questions

1. `deliveryMode='queue'` 时 `hasActive` 条件是否多余？当前逻辑 `mode === 'queue' && hasActive`，如果用户显式 queue 但 thread 无活跃调用，会 fall through 到 immediate。这是否符合预期？（本次未改此逻辑，保持现状）

## Next Action

请 review 这一行修复是否正确恢复了 thread-level gate，以及回归测试是否覆盖了关键场景。

## 自检证据

### Spec 合规

缅因猫 (GPT-5.4) 诊断结论即 spec：
- P1: `/api/messages` queue gate 应使用 thread-level check ✅
- P1: 显式 `deliveryMode='queue'` 不应被 slot-level check 降级 ✅

### 测试结果

```
node --test (28 related tests) → 28/28 pass, 0 failed
pnpm check                     → 0 errors
pnpm lint                      → 0 errors
pnpm -r --if-present run build → exit 0
```

### 相关文档

- 缅因猫诊断：session 对话历史 2026-03-14 10:37
- 关联 Feature: F108 (Side-Dispatch)
