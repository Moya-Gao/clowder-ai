# Review Request: F073 P1 — Mission Hub 告示牌 (WorkflowSop)

## What

Mission Hub 增加 `workflow.sop` 告示牌，让所有猫共享 SOP 执行上下文：
- **Types**: `WorkflowSop` — stage, batonHolder, resumeCapsule, checks, CAS version
- **Redis Store**: `RedisWorkflowSopStore` — JSON per key, CAS via expectedVersion
- **API Routes**: `GET/PUT /api/backlog/:itemId/workflow-sop`
- **MCP Tool**: `cat_cafe_update_workflow` — 猫通过 callback 更新 SOP 状态
- **Thread Context**: `get_thread_context` 返回 workflowSop（当 thread 有 linked backlog item）

7 commits, 26 new tests (12 Redis store + 7 route + 4 callback + 3 thread-context).

## Why

铲屎官反复手动提醒猫猫 SOP 步骤。根因：SOP 上下文没有外化到共享系统，猫冷启动/压缩后失忆。告示牌让猫读 resume capsule 自己恢复，不需要铲屎官当复读机。

## Original Requirements

> "特别是上下文压缩之后。" — 铲屎官 2026-03-07
> "所有猫都能用的综合机制" — 铲屎官追问
> "我不想让你们变成一个 workflow 的 node，这样没有灵魂。" — 铲屎官定调

- 来源：`docs/features/F073-sop-auto-guardian.md` (R5-R7)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 选择 | 放弃 | 理由 |
|------|------|------|
| JSON string per Redis key | Redis Hash fields | WorkflowSop 是小对象，整体读写比字段级操作更简单 |
| CAS via expectedVersion | Redis WATCH/MULTI | 业务层 CAS 更透明，不依赖 Redis 事务语义 |
| updatedBy from invocation context | 从 request body 取 | 防伪造，用 callback auth 的 catId |

## Open Questions

1. **AC-17 降级策略**：P1 暂未实现 Mission Hub 不可用时的降级（属于 P2 范围）。当前 Redis 断连 = workflowSop 为 null = 猫正常工作但无恢复上下文。这个降级行为是否可接受？
2. **Resume capsule 自动填充**：目前需要猫主动调用 `cat_cafe_update_workflow` 更新。P4 计划让 hook 自动更新。P1 先做手动调用是否合理？

## Next Action

请 review 代码质量、类型设计、CAS 实现、告示牌哲学是否贯彻。

## 自检证据

### Spec 合规
- AC-5 (workflow.sop + 冷启动恢复) ✅
- AC-6 (所有猫 MCP 读写) ✅
- AC-7 (告示牌不是控制器) ✅
- AC-15 (baton 唯一句柄) ✅
- AC-16 (CAS 冲突检测) ✅

### 测试结果
```
Non-Redis tests → 89/89 pass, 0 failed ✅
Redis store tests (isolated) → 12/12 pass, 0 failed ✅
MCP server tests → 50/50 pass, 0 failed ✅
pnpm lint → 0 errors ✅
pnpm -r build → exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F073-sop-auto-guardian.md`
- Plan: `docs/plans/2026-03-07-f073-p1-bulletin-board.md`
- Research: `docs/research/2026-03-07-f073-gptpro-response.md`
