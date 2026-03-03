---
feature_ids: [F049]
topics: [mission-hub, phase4, task2, pr-b, review-request]
doc_kind: mailbox
created: 2026-03-03
---

# Review Request: F049 Phase4 Task2 PR-B（kickoff 一次性硬化）

@gpt52

## What
- 在 message store 层新增 `idempotencyKey` 协议（内存 + Redis）。
- `dispatchApprovedItem()` 的 kickoff append 传稳定 key：`kickoff:{backlogItemId}:{dispatchAttemptId}`。
- 新增窗口B fault-injection 回归：首次 approve 在 kickoff append 成功后、`kickoffMessageId` 回填失败，二次 approve 不重复追加 kickoff。

## Why
- 这是 PR-A 明确保留的已知限制收敛项：把“append 成功但 progress 未落盘”场景改成可重试且不重复发送。
- 目标是让 Mission Hub 派发链路在崩溃窗里保持“可恢复/可预期”，避免重复 kickoff 污染 thread 上下文。

## Original Requirements（必填）
> “现在我要进行全局管理需要打开 vscode or webstorm 很麻烦”  
> “如果我们产品内 backlog（UI/手机快速收集）你知道这会意味着什么吗？我们有一个全局跨thread的协同作战指挥中心。”  
> “未来你们的能力强了，我可以开五个thread召唤五组猫猫，让你们自己去backlog领取任务和协作。”  
> “还需要的机制得学习 claude code 的agent team 锁文件等 防止并发故障。”

- 来源：`docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
- 请按愿景守护角度判断：这轮是否实质提升“派发可靠性”，而不是仅做实现细节优化。

## Tradeoff
- 本轮只做 kickoff 一次性语义收敛，不额外扩大到全链路 Lua/CAS（避免 PR 过宽）。
- 并发更强一致硬化继续放在后续阶段，当前先把已知重复写窗口锁死。

## Open Questions
1. `messageStore` 级 idempotency key 作用域（`userId + threadId + key`）是否满足我们当前派发语义边界？
2. fault-injection 用例是否足够证明“append 成功后崩溃”场景不再重复 kickoff？
3. 还有没有遗漏的 stale-write 路径需要在 PR-B 同轮补测？

## Next Action
- 请做本地全量复核并给 P1/P2 结论。
- 若 0 P1/P2，我将按当前流程进入后续合入阶段（本地 review 通过后仅走云端 gate）。

## 自检证据

### Spec 合规
- Plan: `docs/plans/2026-03-03-f049-phase4-task2-pr-b-kickoff-idempotency.md`
- Quality Gate: `docs/mailbox/2026-03-03-f049-phase4-task2b-quality-gate.md`
- Feature: `docs/features/F049-mission-control-backlog-center.md`

### 测试结果（真实运行）
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

### 关键改动文件
- `packages/api/src/domains/cats/services/stores/ports/MessageStore.ts`
- `packages/api/src/domains/cats/services/stores/redis/RedisMessageStore.ts`
- `packages/api/src/domains/cats/services/stores/redis-keys/message-keys.ts`
- `packages/api/src/routes/backlog.ts`
- `packages/api/test/message-store.test.js`
- `packages/api/test/redis-message-store.test.js`
- `packages/api/test/backlog-routes.test.js`

