---
feature_ids: [F185]
topics: [fairness, gate, a2a, deferred, enqueue]
---

# Review Request: F185 Phase B — text-scan fairness gate non-agent + deferred enqueue

Review-Target-ID: f185-phase-b
Branch: feat/f185-phase-b
PR: #1747

## What
4 个 call site 从 `hasQueuedUserMessagesForThread` 切到 `hasQueuedNonAgentForThread`，修复 connector 被 A2A 链路饿死的问题。新增 deferred enqueue：fairness gate 命中时 A2A targets 入队而非静默丢弃，携带完整 8 字段元数据。deferred 路径复用全部 3 guards（maxDepth / dedup / F167 ping-pong streak）。

## Why
ADR-034 OQ-3 设计的 fairness invariant 覆盖 non-agent（user + connector），但 Phase A 实现只在 `tryAutoExecute` 落地，`routeSerial` text-scan 仍用 user-only 检查。结果：connector 消息（CI/review/webhook）堆在 A2A @ 链后面，直到 A2A 链耗尽才出队。

## Original Requirements
> 好像外部消息有可能这样堆积。比如说猫a -> 此时外部消息来了 -> 猫a at猫b 然后消息顺序是不是猫a -> 猫b -> 可能at到天荒地老 直到没at了 外部消息才能进入？
- 来源：铲屎官本次会话消息 + 截图（三猫独立诊断确认）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
考虑过在 fairness gate 命中时直接终止 A2A 链（简单但丢失交接）。选择 deferred enqueue 是因为它保留了 A2A 语义——猫A的工作不白做，猫B在 connector 出队后被 `tryAutoExecute` 拉起。代价是 route-serial 需要注入 enqueue 回调，增加了 RouteOptions 接口。

## Architecture Ownership
Architecture cell: dispatch
Map delta: none
Why: 扩展现有 route-serial fairness gate + InvocationQueue 行为，不改变 dispatch cell 边界

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. AC-B7 要求 integration test 证明 `tryAutoExecute` 拉起 deferred entry。当前用 unit test 验证回调+元数据，`tryAutoExecute` 行为由已有测试覆盖。是否需要补全端到端 integration test？
2. deferred 路径的 `updateStreakOnPush` 共享 worklistEntry 的 streakPair 状态——inline + deferred 路径的 streak 计数是连续的。这是期望行为（同一 routeSerial 调用内的 streak 应该跨路径累积）。请确认。

### 价值 OQ（给 CVO）
无

## Next Action
请 review 代码实现 + 测试覆盖，重点关注：
1. deferred enqueue 元数据合约是否与 spec 一致
2. 3 guards 在 deferred 路径的正确性
3. `hasQueuedNonAgentForThread` 语义是否覆盖所有 non-agent source

## Review Sandbox
- Path: `/tmp/cat-cafe-review/f185-phase-b/codex`
- Start Command: `pnpm review:start`
- Ports: 自动分配（review 隔离端口）

## 自检证据

### Spec 合规
Quality gate PASS — 全部 AC-B1 到 AC-B10 验收通过（AC-B7 unit test 覆盖，见技术 OQ #1）

### 测试结果
- API tests (direct): 11512/11517 pass, 5 fail (pre-existing F203/Antigravity)
- invocation-queue.test.js: 109/109 pass
- route-strategies.test.js: 98/98 pass
- route-serial-pingpong.test.js: 7/7 pass
- pnpm lint: 0 errors
- pnpm check: 0 errors (biome format + lint + feature checks)
- tsc (API): 0 errors

### 相关文档
- Feature: [F185](../features/F185-dispatch-busy-gate-unification.md) Phase B
- ADR: [ADR-034](../decisions/034-dispatch-busy-gate-unification.md)
- Discussion: `docs/discussions/2026-05-01-dispatch-queue-architecture/`
