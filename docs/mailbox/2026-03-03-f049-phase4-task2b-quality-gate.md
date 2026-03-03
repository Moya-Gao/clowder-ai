---
feature_ids: [F049]
topics: [mission-hub, phase4, task2, pr-b, kickoff-idempotency, quality-gate]
doc_kind: report
created: 2026-03-03
---

# Quality Gate Report ✅ — F049 Phase4 Task2 PR-B（kickoff 一次性硬化）

**Plan**: `docs/plans/2026-03-03-f049-phase4-task2-pr-b-kickoff-idempotency.md`  
**原始需求（Discussion/铲屎官原话）**: `docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`  
**检查时间**: 2026-03-03  
**检查人**: 缅因猫/砚砚（Codex）

## 愿景覆盖度（Step 0）

| # | 铲屎官原始需求（摘录） | Plan 覆盖？ | 实现覆盖？ |
|---|---|---|---|
| 1 | “全局跨thread的协同作战指挥中心” | ✅ | ✅ 派发重试不再重复写 kickoff，执行态更可预期 |
| 2 | “防止并发故障” | ✅ | ✅ dispatch attempt 内 kickoff append 幂等化（messageStore 层） |
| 3 | “不用开 IDE 做全局管理” | ✅ | ✅ Mission Hub 调度可靠性提升，减少异常重试噪音 |

## 功能验收（Task2 PR-B）

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|---|---|---|---|
| 1 | `messageStore.append` 支持 `idempotencyKey` | ✅ | `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts` | `append() with same idempotencyKey returns existing message` |
| 2 | Redis message store 同 key 重试返回同 message | ✅ | `packages/api/src/domains/cats/services/stores/redis/RedisMessageStore.ts` | `append() with same idempotencyKey returns existing message` (redis) |
| 3 | kickoff append 使用 `backlogItemId + dispatchAttemptId` 作为稳定 key | ✅ | `packages/api/src/routes/backlog.ts` | `approve retry does not duplicate kickoff message after progress persistence failure` |
| 4 | 窗口B：append 成功但 progress 持久化失败后，重试不重复追加 kickoff | ✅ | `packages/api/src/routes/backlog.ts` + `backlog-routes` fault injection | 同上 |

## 核心不变量

- 同一个 `(userId, threadId, kickoff:{backlogItemId}:{dispatchAttemptId})` 只会落一条 kickoff message。
- 首次异常后 item 仍在 `approved` 且可重试；重试完成后 `kickoffMessageId` 必须回填并进入 `dispatched`。

## 验证命令输出（本轮真实执行）

```bash
env -u REDIS_URL pnpm --dir packages/api run build
# ✅ pass

env -u REDIS_URL node --test packages/api/test/message-store.test.js packages/api/test/backlog-routes.test.js
# ✅ 43/43 pass

pnpm --dir packages/api run test:redis -- node --test test/redis-message-store.test.js
# ✅ 11/11 pass

pnpm --dir packages/api run lint
# ✅ pass
```

## 影响面与风险

- 影响面：`messageStore.append` 输入新增可选字段，不影响现有调用方（默认行为不变）。
- 风险：Redis idempotency key 在极端写失败时会清理并重试，不会永久卡死；并发强一致硬化（Lua/CAS）继续留在后续 PR-B 深化项中。

## 结论

本轮满足 PR-B 最小目标：把 PR-A 已知“kickoff 重复发送”窗口收敛到 messageStore 幂等语义，且有 fault-injection 回归锁死。可进入本地 `@gpt52` 全量复核流程。

