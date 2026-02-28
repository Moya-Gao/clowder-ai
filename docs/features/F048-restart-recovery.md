---
feature_ids: [F048]
topics: [restart, recovery, invocation, queue, redis]
doc_kind: note
created: 2026-02-28
---

# F048: Restart Recovery — 重启自愈（Invocation/Queue 恢复）

> **Status**: idea  
> **Owner**: 三猫  
> **Created**: 2026-02-28  
> **Priority**: P1

---

## Why

当前 Cat Café 的执行模型依赖外部子进程（例如 `codex` CLI）进行流式输出。API/runtime 一旦重启：
- **in-flight invocation 基本等于挂掉**（子进程/管道断开）
- 队列（InvocationQueue）目前是内存态，重启会丢失排队条目

这会导致用户体验不确定（“重启后发生了什么？”），也让后续做队列 Redis 持久化变成“只做一半会更诡异”的半能力。

## What

把“重启后的体验”做成一个**完整能力包**：
- Orphan recovery：重启后对 in-flight invocation 做一致性的收敛（cancel/failed + reason）
- Queue persistence：队列条目在 Redis 持久化，重启后恢复并继续消费
- 语义约定：processing 条目如何处理（回滚重试 / 失败提示 / 人工介入）

## Acceptance Criteria

- [ ] 重启后：所有旧的 in-flight invocation 会被标记为 `canceled` 或 `failed`（带 `reason: 'restart'` 或等价字段）
- [ ] 重启后：队列不丢（queued 条目可恢复）；且能继续消费（不会永久卡住 mutex/paused）
- [ ] 不出现“双执行”或不可解释的重复执行（至少给出可接受的 at-least-once 语义 + 去重策略）
- [ ] 前端清晰可见：哪些因重启被中断、哪些仍在队列、是否需要手动继续
- [ ] 有最小可观测性：启动自愈日志 + 指标（orphan 数量、回滚数量、恢复耗时）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| Discussion | `docs/discussions/2026-02-28-restart-recovery/README.md` | 立项来源（铲屎官口述） |
| Evolved from | `docs/features/F039-message-queue-delivery.md` | 队列交付后的自然演进 |
| Plan | （待创建） | 拆分 Orphan/Queue/UX 三部分实现 |

## Key Decisions

- “要做就做完整体验”：不做“只持久化队列但不处理 in-flight”这种半能力

## Risk / Blast Radius

- 风险：错误的恢复语义可能造成重复执行、状态错乱、用户困惑
- 缓解：明确语义（restart = cancel old + replay new），并用去重键/幂等保护

## Dependencies

- Redis（持久化、CAS、启动 reconcile）

## Open Questions

1. 对 Codex/Claude/Gemini provider，是否有可用的 “resume 原 session” 能力？如果没有，统一采用“重启后重新执行（replay）”语义。
2. `processing` 队列项的默认处理：回滚为 queued 重试，还是直接 failed + toast？
3. 重启自愈的触发点：仅启动时一次性 reconcile，还是后台周期性清理 stale invocation？

## Review Gate

| 轮次 | Reviewer | 结果 | 日期 |
|------|----------|------|------|
| — | — | — | — |

## Timeline

- 2026-02-28: Kickoff（立项）

