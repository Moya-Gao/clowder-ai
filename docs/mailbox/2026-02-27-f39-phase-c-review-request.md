---
feature_ids: [F039]
topics: [message, queue, connector]
doc_kind: mailbox
created: 2026-02-27
---

# Review 请求: F39 Phase C — ConnectorInvokeTrigger 队列模式 + 集成测试

## 背景

F39 Phase A（后端队列核心）和 Phase B（前端 UI）已合入 main。Phase C 是最后一块：让 ConnectorInvokeTrigger（review 邮件等外部消息）在猫猫在跑时走队列，而不是直接 abort 当前猫。

## 铲屎官原始需求

- 需求文档: `docs/plans/2026-02-26-message-queue-delivery.md`
- 铲屎官核心痛点（原话）："你们在跑A2A的时候，我的操作应该有两个选择——取消调用，或者发送消息进入队列。"
- 关于 Connector 的明确要求：**"外部消息（如 review 邮件）到达时，永远排队，永远不打断猫猫当前工作。"**
- **请 Reviewer 对照原始需求判断：交付物是否解决了铲屎官的问题？**

## 设计文档

- 产品需求: `docs/plans/2026-02-26-message-queue-delivery.md`
- 技术 Plan: `docs/plans/2026-02-26-message-queue-delivery-plan.md` (Task 11-12, Phase C)

## Spec Compliance 自检

| # | Spec 要求 | 状态 | 说明 |
|---|-----------|------|------|
| 1 | `has(threadId)` 检查活跃调用 | ✅ | ConnectorInvokeTrigger.ts:L74 |
| 2 | 有猫在跑 → `queue.enqueue()` | ✅ | ConnectorInvokeTrigger.ts:L76-84 |
| 3 | `source: 'connector'` 标记 | ✅ | ConnectorInvokeTrigger.ts:L81 |
| 4 | `queue_full_warning` on full | ✅ | ConnectorInvokeTrigger.ts:L87-93 |
| 5 | `backfillMessageId` (enqueued) | ✅ | ConnectorInvokeTrigger.ts:L99 |
| 6 | `appendMergedMessageId` (merged) | ✅ | ConnectorInvokeTrigger.ts:L101 |
| 7 | `queue_updated` WS emit | ✅ | ConnectorInvokeTrigger.ts:L105-109 |
| 8 | 无猫在跑 → 直接执行 | ✅ | ConnectorInvokeTrigger.ts:L115-119 |
| 9 | `invocationQueue` 加入 Options + index.ts | ✅ | ConnectorInvokeTrigger.ts:L18, index.ts:L428 |
| 10 | E2E: user queue → complete → auto-dequeue | ✅ | queue-integration.test.js |
| 11 | E2E: cancel → pause → processNext → resume | ✅ | queue-integration.test.js |
| 12 | E2E: connector during active → queued | ✅ | queue-integration.test.js |
| 13 | E2E: force mode → abort + immediate | ✅ | queue-integration.test.js |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts` | 修改 | 新增 `InvocationQueue` 依赖 + `trigger()` 中加入队列分流逻辑 |
| `packages/api/src/index.ts` | 修改 | 传入 `invocationQueue` 到 ConnectorInvokeTrigger |
| `packages/api/test/connector-invoke-trigger.test.js` | 修改 | 新增 5 个 queue mode 测试 |
| `packages/api/test/queue-integration.test.js` | 新增 | 4 个 E2E 集成测试 |

## Git SHA

- Base: `075afb5` (main)
- Head: `876a874` (feat/f39-phase-c, 2 commits)
- Branch: `feat/f39-phase-c`
- Worktree: `/Users/lysander/projects/relay-station/cat-cafe-f39c`

## 测试状态

```
packages/api pnpm test: 2141 passed, 0 failed (1 Redis skip)
packages/api pnpm build: clean
packages/web pnpm build: clean
```

## Review 重点

1. **trigger() 队列分流时序**：`has()` 检查和 `enqueue()` 之间是否有竞态窗口？（同一线程同步执行，应该安全，但请确认）
2. **Connector enqueue 不创建 InvocationRecord**：入队时不创建 record，由 QueueProcessor.executeEntry 在出队执行时创建。这和 messages.ts 的 queue 路径一致，但和 ConnectorInvokeTrigger 的直接执行路径不一致（直接执行会立即创建）。是否需要对齐？
3. **queue_full_warning 的 connector 场景**：队列满时 connector 消息被拒，但消息本身已在 MessageStore（铲屎官能看到内容，只是没有 invocation）。这个降级是否合理？

## 五件套

**What**: ConnectorInvokeTrigger 改为队列模式 — 有猫在跑时入队，无猫时直接执行。+ 4 个 E2E 集成测试覆盖全链路。

**Why**: 铲屎官明确要求 Connector 消息永远排队不打断。之前的 fire-and-forget 行为会 abort 正在跑的猫。

**Tradeoff**: 考虑过让 Connector 也创建 InvocationRecord 再入队（和直接执行路径对齐），但队列出队时 QueueProcessor 已经会创建 record，提前创建会导致重复。选择和 messages.ts 的 queue 路径保持一致。

**Open Questions**:
- Connector 消息的 idempotencyKey 在入队路径没有使用（直接执行路径用 `connector-${messageId}`）。入队后由 QueueProcessor 创建 record 时用 `queue-${entryId}`。这个不对称是否需要处理？

**Next Action**: 请 review 以上 4 个文件，重点关注 review 重点 1-3。
