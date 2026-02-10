# ADR-008 S2: Retry 端点实际执行 — Review Request

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-09
**Subject**: ADR-008 S2 retry 端点从桩接通真实执行，请 review

---

## What

S1 的 retry 端点 (`POST /api/invocations/:id/retry`) 只做了 status 重置到 queued，不触发实际执行。S2 接通完整执行链路：取原始消息 → 重建 intent → 调用 `routeExecution()` → 后台跑猫。

4 个 commit，6 个文件改动，10 个新测试。

### Commit 1: `getById()` on IMessageStore

| 文件 | 改动 |
|------|------|
| `MessageStore.ts` | 接口加 `getById(id): StoredMessage \| null \| Promise<...>`，内存实现用 `find()` |
| `RedisMessageStore.ts` | Redis 实现：`HGETALL msg:{id}` + hydrate（复用已有 hydrate 逻辑提取为内联） |

### Commit 2: AgentRouter 提升为共享实例

| 文件 | 改动 |
|------|------|
| `messages.ts` | `MessagesRoutesOptions` 加 `router: AgentRouter`，删内部 `new AgentRouter(...)` |
| `index.ts` | 路由注册前创建共享 `AgentRouter`，注入到 messages + invocations |

### Commit 3: 接通 retry 执行

| 文件 | 改动 |
|------|------|
| `invocations.ts` | `InvocationsRoutesOptions` 扩展 5 个依赖；retry 端点完整执行流 |
| `index.ts` | 给 `invocationsRoutes` 注入新依赖 |

**Retry 执行流**:
```
① 取 InvocationRecord → 校验 status ∈ {failed, queued}
② userMessageId === null → 400 USER_MESSAGE_NOT_SAVED
③ getById(userMessageId) → 消息过期/删除 → 400 USER_MESSAGE_EXPIRED
④ parseIntent(content, targetCats.length) 重建 intent
⑤ isDeleting() → 409 THREAD_DELETING
⑥ tracker.start() + aborted check → 409
⑦ reply 202 { status: 'retrying', invocationId }
⑧ background: running → routeExecution() → succeeded/failed
```

### Commit 4: 测试

| 文件 | 改动 |
|------|------|
| `invocations-retry.test.js` | 新建，10 个测试覆盖全路径 |
| `s1-review-fixes.test.js` | 补 `router` mock（Step 2 改了 opts 接口） |

## 测试结果

```
API:  604 tests, 603 pass, 0 fail, 1 skip (pre-existing)
MCP:   11 tests, 11 pass, 0 fail
Integration: 42 pass, 0 fail
Total: 657 pass / 0 fail
```

所有 tsc 编译通过，无类型错误。

## Why

ADR-008 原始分期 S4=Retry，但 S2 IdempotencyKey 已在 S1 一起做完了，所以本轮 = 原 S4。Retry 是调用状态机闭环的关键能力 — 没有它，failed 的调用只能让用户重新发消息。

## Tradeoff

1. **不存 content 到 InvocationRecord** — Record 是轻量状态机，不该膨胀成消息存储。通过 `userMessageId` + `getById()` 间接获取。代价：消息 TTL 过期后 retry 会 400，但这是合理的 — 7 天前的调用重试意义不大。

2. **`getById()` 在 RedisMessageStore 是独立 HGETALL** — 没有复用 `hydrateMessages()` pipeline 批量逻辑，因为 retry 一次只取一条。避免为单条消息构建 pipeline 的开销。但 hydrate 逻辑有少量重复（解析 contentBlocks/metadata/mentions）。

3. **AgentRouter 提升为共享实例** — 之前在 `messagesRoutes` 内部 new，invocationsRoutes 无法访问。提升到 `index.ts` 是最小侵入方案。副作用：所有 POST `/api/messages` 的测试现在需要提供 `router` mock。目前只有 `s1-review-fixes.test.js` 需要修（其他测试要么只用 GET，要么在 router 调用前就 early-return 了）。

4. **intent 从消息内容重建** — 没有在 InvocationRecord 里存 `IntentResult`（含 promptTags/explicit），而是用 `parseIntent()` 重新解析。这样 Record 更轻量，但如果 parseIntent 逻辑后续改了，retry 可能产生不同的 intent。当前阶段这是可接受的。

## Open Questions

1. **消息过期后的 retry 体验** — 目前 400 + `USER_MESSAGE_EXPIRED`，前端需要显示引导用户重新发送。前端还没做这个处理。
2. **retry 的幂等性** — 当前 retry 没有自己的幂等键，连续点两次 retry 会创建两次执行。需要吗？
3. **`getById()` 在 Redis hydrate 逻辑重复** — 是否值得提取一个 `hydrateOne()` 私有方法？当前 RedisMessageStore 已经 ~400 行了。

## Review 重点

1. **retry 端点的状态校验** — `failed` 和 `queued` 可 retry，其他 409。是否需要允许 `canceled` 也 retry？
2. **delete guard + tracker.start() 顺序** — 先检查 `isDeleting()`，再 `start()`，和 messages 路由一致。start() 返回 aborted → 标记 canceled。竞态窗口是否充分覆盖？
3. **共享 AgentRouter 的副作用** — 所有服务实例（Claude/Codex/Gemini）共享。retry 和正常发送共用同一个 router 实例，是否有状态泄漏风险？（AgentRouter 内部无可变状态，应该安全）
4. **`getById()` 接口扩展** — 加到 `IMessageStore` 接口是 breaking change（所有实现必须有）。Redis 和内存都加了。其他消费者（如 `AgentRouter` 的 `messageStore` 参数）会被 TS 约束。
5. **测试覆盖** — 8 个 retry 路径 + 2 个 getById 单元。是否需要补 Redis getById 的集成测试？

## 文件清单

| 文件 | 操作 | Step |
|------|------|------|
| `packages/api/src/domains/cats/services/MessageStore.ts` | 修改 | 1 |
| `packages/api/src/domains/cats/services/RedisMessageStore.ts` | 修改 | 1 |
| `packages/api/src/routes/messages.ts` | 修改 | 2 |
| `packages/api/src/index.ts` | 修改 | 2+3 |
| `packages/api/src/routes/invocations.ts` | 修改 | 3 |
| `packages/api/test/invocations-retry.test.js` | 新建 | 4 |
| `packages/api/test/s1-review-fixes.test.js` | 修改 | 4 |

## Next Action

请 review 以上变更，重点关注 review 重点中列出的 5 项。放行后可推进 S3 (cursor 推进) 或其他铲屎官安排的任务。

---

*布偶猫🐾 ADR-008 S2 Retry 端点实际执行*
