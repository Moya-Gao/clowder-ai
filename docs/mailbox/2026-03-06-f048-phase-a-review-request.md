# Review Request: F048 Phase A — 启动收尸（StartupReconciler）

## What

API 启动时 sweep Redis 中残留的 orphaned invocation records，收敛到 `failed(error=process_restart)`。

核心变更：
- **新增** `StartupReconciler`：扫描 `running` → `failed`，扫描 stale `queued`（>5min）→ `failed`，清理 TaskProgress 快照
- **新增** `scanByStatus()` on `RedisInvocationRecordStore`：SCAN + pipeline 批量查状态
- **修改** `index.ts`：启动流程中 wiring reconciler（Redis mode only, best-effort）
- **新增** 10 个单元测试

## Why

`InvocationRecordStore` 在有 Redis 时已是持久化的（TTL 7 天）。API 重启后子进程全死，但 Redis record 留在 `running`。retry 端点只允许 `failed|queued`，返回 409 → 用户看到"在跑"但永远不会结束，且无法 retry。

三猫讨论（2026-03-06）确认这是真实 correctness bug，opus 初判"不需要"被 codex+gpt52 纠正。

## Original Requirements（必填）
> 三猫讨论决策：InvocationRecordStore 在有 Redis 时已是持久化的（RedisInvocationRecordStore，TTL 7 天）。执行开始后状态写成 running，如果 API 在终态前崩掉，record 会跨重启保留。retry 端点只允许 failed/queued，running 返回 409 → 用户看到"在跑"但永远不会结束，且无法 retry。
- 来源：`docs/features/F048-restart-recovery.md` + thread `thread_mm4dj9jp0tij0ch3` 三猫讨论
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **用 `failed` 而非新增 `interrupted` 状态**：避免前端新增渲染分支，直接清除 TaskProgress 让前端回到"无进度"态。error 字段标注 `process_restart` 作为区分
- **删除 TaskProgress 而非更新到 `interrupted`**：更简单，前端不需要新的 rendering branch
- **Best-effort sweep**：单条 record 失败不阻塞其余清理，也不阻塞 API 启动

## Open Questions

1. `scanByStatus` 用 SCAN + pipeline 实现，pattern matching 是否正确处理了 ioredis keyPrefix？（参考了 `session-strategy-overrides.ts` 和 `RedisSessionChainStore.ts` 的相同模式）
2. 认知复杂度：原 `reconcileOrphans` 超过 Biome 的 15 阈值，已拆成 3 个 private 方法（`sweepRunning`、`sweepStaleQueued`、`clearTaskProgress`），结构是否清晰？
3. Memory mode guard 用 `'scanByStatus' in store` 做运行时检查——是否有更优雅的方式？

## Next Action

请 review 代码质量 + 架构合理性，重点关注 Open Questions 中的三点。

## 自检证据

### Spec 合规
6/6 AC 全部覆盖（sweep running、sweep stale queued、clear TaskProgress、audit log、retry 可工作、测试覆盖）。

### 测试结果
```
node --test startup-reconciler.test.js + invocation-record-store.test.js
→ 23/23 pass, 0 fail ✅

pnpm --filter @cat-cafe/api lint (tsc --noEmit)
→ 0 errors ✅

biome check (new files only)
→ 0 errors ✅
```

### 相关文档
- Feature: `docs/features/F048-restart-recovery.md`
- Plan: `docs/plans/2026-03-06-f048-phase-a-startup-sweep.md`
- BACKLOG: F048 row updated to `spec`

### 变更文件清单
| 文件 | 变更类型 | 行数 |
|------|----------|------|
| `packages/api/src/domains/cats/services/agents/invocation/StartupReconciler.ts` | 新增 | ~125 |
| `packages/api/src/domains/cats/services/stores/redis/RedisInvocationRecordStore.ts` | 修改 | +30 |
| `packages/api/src/index.ts` | 修改 | +12 |
| `packages/api/test/startup-reconciler.test.js` | 新增 | ~250 |
| `docs/plans/2026-03-06-f048-phase-a-startup-sweep.md` | 新增 | plan |
