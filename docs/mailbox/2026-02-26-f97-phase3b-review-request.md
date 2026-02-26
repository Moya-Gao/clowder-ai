---
feature_ids: [F097]
topics: [phase3b, request]
doc_kind: mailbox
created: 2026-02-26
---

# Review 请求: F97 Phase 3b — Connector 自动唤起猫猫闭环

## 背景

Phase 3a 实现了 connector 消息的抽象和前端气泡展示，但收到 review 邮件后猫猫不会自动处理——需要铲屎官手动 @ 猫。Phase 3b 关闭这个循环：email watcher 路由成功后，自动 invoke 对应猫猫处理 review。

## 设计文档

- Plan: `docs/plans/2026-02-25-connector-messages-phase3.md` (Phase 3b section)
- 前置: Phase 3a 已合入 (`e13cd1d`)

## Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 | 测试 |
|---|-----------|------|----------|------|
| 1 | Bootstrap: route 成功后调 AgentRouter | ✅ | `github-review-bootstrap.ts:48-57` | `review-router.test.js` |
| 2 | AgentRouter: 支持 connector 触发的 invoke | ✅ | `ConnectorInvokeTrigger.ts:73-175` | `connector-invoke-trigger.test.js` (9) |
| 3 | 前端: connector 消息后自动显示猫的 streaming 状态 | ✅ | 复用现有 WebSocket broadcast，无需改前端 | — |
| 4 | 测试: 端到端 review → invoke 流程 | ✅ | 11 new tests | ✅ |
| 5 | InvocationRecord lifecycle | ✅ | `ConnectorInvokeTrigger.ts:87-159` | tests 3,7 |
| 6 | InvocationTracker start/complete | ✅ | `ConnectorInvokeTrigger.ts:97,175` | test 5 |
| 7 | 幂等 (connector-{messageId}) | ✅ | `ConnectorInvokeTrigger.ts:91` | test 6 |
| 8 | Thread deleting guard | ✅ | `ConnectorInvokeTrigger.ts:99-103` | test 7 |
| 9 | Persistence failure handling | ✅ | `ConnectorInvokeTrigger.ts:143-149` | test 9 |
| 10 | Triage 不触发 invoke | ✅ | `github-review-bootstrap.ts:48` (only kind=routed) | — |

偏离说明：
1. Spec 写"直接注入 AgentRouter" → 封装为独立 `ConnectorInvokeTrigger` 类（更易测试，避免 5+ 依赖散落在 bootstrap）
2. 额外实现了 token usage 收集（与 POST /api/messages 管线一致）

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `ConnectorInvokeTrigger.ts` | **新增** | 封装 fire-and-forget invoke pipeline |
| `ReviewRouter.ts` | 修改 | RouteResult 增加 messageId/content/userId |
| `github-review-bootstrap.ts` | 修改 | 接受 invokeTrigger，route 成功后触发 |
| `infrastructure/email/index.ts` | 修改 | 导出新类 |
| `index.ts` | 修改 | 注入 ConnectorInvokeTrigger 到 bootstrap |
| `connector-invoke-trigger.test.js` | **新增** | 9 tests: lifecycle/broadcast/dedup/error |
| `review-router.test.js` | 修改 | +2 tests: RouteResult 新字段验证 |

## Git SHA

- Base: `b88fd9f` (main)
- Head: `c641b12`

## 测试状态

```
API tests: 1955 pass, 1 pre-existing fail (Redis isolation guard)
API tsc: 0 errors
Web tsc: 0 new errors (10 pre-existing test file errors)
New tests: 11 (9 trigger + 2 RouteResult fields)
```

## Review 重点

1. **ConnectorInvokeTrigger 管线是否与 POST /api/messages 保持一致** — 刻意省略了 push notification 和 auto-summarize，是否合理？
2. **Fire-and-forget 的错误隔离** — trigger 内部 error 不会冒泡到 watcher，watcher 的 IMAP cursor 已经 advance 了。如果 invoke 失败，connector 消息已存在但猫没被唤起。这个 tradeoff 是否可接受？
3. **RouteResult 类型扩展** — 给 `kind: 'routed'` 加了 `messageId/content/userId`，现有代码都是 narrowing 后访问，但 reviewer 可能有更好的类型设计建议。

## 五件套

**What**: 新增 `ConnectorInvokeTrigger` 服务，在 email watcher 路由成功后自动 invoke 对应猫猫。扩展 `RouteResult` 以携带 messageId/content/userId。

**Why**: Phase 3a 只是展示 connector 消息，但猫猫不会自动处理。铲屎官不想当人肉路由器——email 来了就应该自动唤起猫。

**Tradeoff**:
- 方案 A (内部 HTTP call POST /api/messages): 更自然但创建 HTTP 回环 + 需要模拟用户身份
- 方案 B (直接 AgentRouter): 选了这个，封装为独立类。省略了 push notification 和 auto-summarize 以降低复杂度。

**Open Questions**:
- Invoke 失败后是否需要重试机制？目前是 fire-and-forget。
- 是否需要给铲屎官一个"禁止自动 invoke"的开关（避免不在时消耗额度）？

**Next Action**: 请 review 上述 7 个文件，重点关注 trigger 管线和错误隔离。
