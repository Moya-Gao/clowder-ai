---
feature_ids: [F049]
topics: [mission-hub, phase4, task2, pr-a, dispatch-semantics, quality-gate]
doc_kind: report
created: 2026-03-03
---

# Quality Gate Report ✅ — F049 Phase4 Task2 PR-A（派发链路语义收敛）

**Plan**: `docs/plans/2026-03-03-f049-phase4-task2-pr-a-dispatch-semantics.md`  
**原始需求（Discussion/铲屎官原话）**: `docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`  
**检查时间**: 2026-03-03  
**检查人**: 缅因猫/砚砚（Codex）

## 愿景覆盖度（Step 0）

| # | 铲屎官原始需求（摘录） | Plan 覆盖？ | 实现覆盖？ |
|---|---|---|---|
| 1 | “全局跨thread的协同作战指挥中心” | ✅ | ✅ 派发链路从“能用”提升到“可恢复/可重试/可预期” |
| 2 | “防止并发故障” | ✅ | ✅ PR-A 完成语义层防重与恢复，PR-B 继续 Lua/CAS 并发硬化 |
| 3 | “不用开 IDE 才能全局管理” | ✅ | ✅ Mission Hub 态势图（Task1）基础上，Task2 保障调度过程稳定 |

## 功能验收（Task2 PR-A）

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|---|---|---|---|
| 1 | `suggested` 同 cat 重试 `suggest-claim` 返回 200 no-op | ✅ | `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts` + `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts` + `packages/api/src/routes/backlog.ts` | `suggest-claim retries from same cat are idempotent no-op` |
| 2 | `suggested` 不同 cat 重试冲突 409 | ✅ | 同上 | `suggest-claim from different cat conflicts when item already suggested` |
| 3 | `reject` 在 `open` 状态 200 no-op | ✅ | `packages/api/src/routes/backlog.ts` | `reject on open item is idempotent no-op` |
| 4 | 窗口A：首次 kickoff 失败后，重试复用同一 `pendingThreadId`，禁止二次创建 thread | ✅ | `packages/api/src/routes/backlog.ts` | `approve retry reuses pending thread id after kickoff failure` |
| 5 | 新增调度元数据字段（`dispatchAttemptId` / `pendingThreadId` / `kickoffMessageId`） | ✅ | `packages/shared/src/types/backlog.ts` + `packages/api/*BacklogStore*` | `updateDispatchProgress stores dispatch metadata on approved item` |
| 6 | 派发前置守卫：已有 dispatch 进度时必须有 kickoff，且 thread 必须匹配 pendingThreadId | ✅ | `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts` + `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts` | `markDispatched requires kickoffMessageId and respects pendingThreadId` |

## 字段清理/保留规则（本轮落地）

| 场景 | `dispatchAttemptId` | `pendingThreadId` | `kickoffMessageId` |
|---|---|---|---|
| `approved → dispatched` 成功 | 保留 | 保留（=最终 threadId） | 必须有值 |
| 失败后停留 `approved`（可重试） | 保留 | 若 thread 已创建则保留 | 为空（待重试补齐） |

## 验证命令输出（本轮真实执行）

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

## 已知限制（P3，留给 PR-B）

- kickoff 的“真正一次性”仍有极小崩溃窗：append 成功但 `kickoffMessageId` 未落盘时，极端重试可能重复发送。  
- PR-B 计划用 idempotencyKey/原子化进一步硬化。

## 结论

PR-A 达到“语义先收敛、测试先锁死”的目标，可进入 `request-review`（先走愿景复核，再进 merge-gate）。
