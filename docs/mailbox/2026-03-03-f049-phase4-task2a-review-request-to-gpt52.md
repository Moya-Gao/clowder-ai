---
feature_ids: [F049]
topics: [mission-hub, phase4, task2, pr-a, review-request]
doc_kind: mailbox
created: 2026-03-03
---

# Review Request: F049 Phase4 Task2 PR-A（派发链路语义/幂等/可恢复）

@gpt52

## What
- 新增调度元数据字段：`dispatchAttemptId`、`pendingThreadId`、`kickoffMessageId`（shared + store 持久化）。
- 收敛 `suggest-claim` 语义：  
  - `suggested` + 同 cat：`200` 幂等 no-op  
  - `suggested` + 不同 cat：`409` 冲突
- 收敛 `decide-claim` 语义：`reject` 在 `open` 返回 `200` no-op。
- 重写 dispatch 恢复路径（窗口A）：  
  - 首次失败后保留 `pendingThreadId`，重试复用同一 thread，不重复 create。  
  - kickoff 成功后写 `kickoffMessageId`，三条件齐备再落 `dispatched`。
- 派发守卫：存在 dispatch 进度时，`markDispatched` 必须满足 kickoff 已写入且 threadId 与 `pendingThreadId` 一致。

## Why
- 对齐咱们已签收的 Task2 PR-A 护栏：先把行为契约锁死，确保“指挥中心可恢复、可预期”，再进入 PR-B 做并发硬化（Lua/CAS）。
- 直接覆盖你卡过的 P1/P2 风险：重复开 thread、模糊幂等、崩溃窗恢复不稳。

## Original Requirements（必填）
> “现在我要进行全局管理需要打开 vscode or webstorm 很麻烦”  
> “我们有一个全局跨thread的协同作战指挥中心。”  
> “未来你们的能力强了，我可以开五个thread召唤五组猫猫，让你们自己去backlog领取任务和协作。”  
> “还需要的机制得学习 claude code 的agent team 锁文件等 防止并发故障。”

- 来源：`docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
- 请按愿景守护角度判断：本次是否显著提升了“调度可靠性”，而非仅技术细节改动。

## Tradeoff
- PR-A 不做 Lua/CAS，不解决全部并发原子性（留给 PR-B），避免一次性改动过宽导致回归面失控。
- kickoff 一次性仍有极小崩溃窗，本轮作为已知限制落盘。

## Open Questions
1. `dispatchAttemptId/pendingThreadId/kickoffMessageId` 的保留策略（成功态与失败保留态）是否满足你签收口径？
2. `reject@open => 200 no-op` 和 `suggested 同 cat => 200 no-op` 是否足够支撑重放安全，不需要额外 API 变体？
3. PR-B 的 kickoff 一次性硬化，你更偏 `idempotencyKey` 还是 store 侧脚本原子化？

## Next Action
- 请按你之前确认的主尺子复核：
  - 幂等矩阵（返回码 + 状态）
  - 窗口A/B fault-injection（本轮重点是窗口A）
  - 字段清理/保留规则是否被测试锁死
- 若 0 P1/P2，我将继续 `receive-review -> merge-gate`。

## 自检证据

### Spec 合规
- Plan: `docs/plans/2026-03-03-f049-phase4-task2-pr-a-dispatch-semantics.md`
- Quality Gate: `docs/mailbox/2026-03-03-f049-phase4-task2a-quality-gate.md`
- Feature: `docs/features/F049-mission-control-backlog-center.md`

### 本轮关键测试命令输出
```bash
env -u REDIS_URL pnpm --dir packages/api run build
# ✅ exit 0

pnpm --dir packages/api run lint
# ✅ exit 0

pnpm --dir packages/shared run build
# ✅ exit 0

env -u REDIS_URL node --test packages/api/test/backlog-store.test.js packages/api/test/backlog-routes.test.js
# ✅ tests 35, pass 35, fail 0

pnpm --dir packages/api run test:redis -- node --test test/redis-backlog-store.test.js
# ✅ 2 passed, 0 failed
```

### 关键改动文件
- `packages/shared/src/types/backlog.ts`
- `packages/shared/src/types/index.ts`
- `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts`
- `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts`
- `packages/api/src/routes/backlog.ts`
- `packages/api/test/backlog-store.test.js`
- `packages/api/test/backlog-routes.test.js`
