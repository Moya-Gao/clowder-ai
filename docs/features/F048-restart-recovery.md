---
feature_ids: [F048]
topics: [restart, recovery, invocation, queue, redis]
doc_kind: note
created: 2026-02-28
---

# F048: Restart Recovery — 重启自愈（Invocation/Queue 恢复）

> **Status**: spec
> **Owner**: 布偶猫
> **Created**: 2026-02-28
> **Priority**: P1
> **Phase**: A/B 分段交付

---

## Why

当前 Cat Café 的执行模型依赖外部子进程（例如 `codex` CLI）进行流式输出。API/runtime 一旦重启：
- **in-flight invocation 基本等于挂掉**（子进程/管道断开）
- 队列（InvocationQueue）目前是内存态，重启会丢失排队条目

这会导致用户体验不确定（“重启后发生了什么？”），也让后续做队列 Redis 持久化变成“只做一半会更诡异”的半能力。

## What

分两段交付（2026-03-06 三猫讨论决策）：

### Phase A — 启动收尸（轻量，correctness fix）

API 重启后，sweep Redis 里残留的 `running`/`queued` invocation records → 标为 `failed(error=process_restart)` → 清理对应 TaskProgress → 写 audit log。

**为什么现在就要做**：`InvocationRecordStore` 在有 Redis 时已是持久化的（`RedisInvocationRecordStore`，TTL 7 天）。执行开始后状态写成 `running`，如果 API 在终态前崩掉，record 会跨重启保留。retry 端点只允许 `failed/queued`，`running` 返回 409 → 用户看到”在跑”但永远不会结束，且无法 retry。

### Phase B — 队列持久化（重型，后做）

- `InvocationQueue` 迁到 Redis
- 重启后恢复排队条目并继续消费
- `processing` 条目回滚语义

## Acceptance Criteria — Phase A

- [ ] 启动时 sweep：扫描 Redis 中 status=`running` 的 invocation records，标为 `failed`（error 含 `process_restart`）
- [ ] 启动时 sweep：扫描 status=`queued` 且创建时间 > 阈值的 records，同样收敛
- [ ] 清理对应的 TaskProgress 快照（避免前端恢复”幽灵进度”）
- [ ] 写 audit log（orphan 数量、收敛结果）
- [ ] retry 端点在 sweep 后能正常工作（status=`failed` → 可 retry）
- [ ] 有测试覆盖：模拟 stale running record → 启动 sweep → 验证状态收敛

## Acceptance Criteria — Phase B（后续）

- [ ] 重启后：队列不丢（queued 条目可恢复）
- [ ] 不出现”双执行”（at-least-once + 去重）
- [ ] 前端清晰可见：哪些因重启被中断、哪些仍在队列

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| Discussion | `docs/discussions/2026-02-28-restart-recovery/README.md` | 立项来源（铲屎官口述） |
| Evolved from | `docs/features/F039-message-queue-delivery.md` | 队列交付后的自然演进 |
| Plan | （待创建） | 拆分 Orphan/Queue/UX 三部分实现 |

## Key Decisions

- **A/B 分段交付（2026-03-06 三猫讨论）**：不再坚持”要做就做完整体验”。Phase A 先补 correctness 缺口（启动收尸），Phase B 再做队列持久化
- **收尸策略用 `failed` 而非新增 `interrupted` 状态**：避免前端新增渲染分支，直接清除 TaskProgress 让前端回到”无进度”态。error 字段标注 `process_restart` 作为区分
- **不扫 ndjson 推断死亡**（否决旧分支 `fix/invocation-restart-guard` 的方案）：直接在启动时 sweep Redis stale records，更直接可靠

## Evidence（三猫讨论关键证据）

| 证据 | 位置 | 说明 |
|------|------|------|
| InvocationRecord 是 Redis 持久化 | `RedisInvocationRecordStore.ts` | 有 Redis 时用 Redis-backed store，TTL 7 天 |
| 执行时写 `running` | `messages.ts:~400` | status update 在执行开始时 |
| 启动无 reconcile | `index.ts:~467` | 启动流程只有 audit log + CLI config regen |
| retry 拒绝 `running` | `invocations.ts:76` | 只允许 `failed\|queued`，running → 409 |
| TaskProgress 也持久化 | `RedisTaskProgressStore.ts` | 前端恢复时会显示”幽灵进度” |
| InvocationQueue 是内存态 | `InvocationQueue.ts:38` | `private queues = new Map()`，重启丢失 |

## Ghost Branch Audit（2026-02-28 幽灵分支盘点）

| 分支 | 结论 | 说明 |
|------|------|------|
| `fix/invocation-restart-guard` | ❌ 不复活 | 方案不合理（扫 ndjson），但能力需要 → F048-A |
| `feat/f92-skills-lifecycle-hardening` | ✅ 已在 main | git cherry 确认等价，远端已删 |
| `feat/f98-session-query-tools` | ✅ 已在 main | 行为级核对确认，远端已删 |
| `feat/f97-connector-invoke` | ✅ 已在 main | 行为级核对确认，远端已删 |
| `feat/f032-agent-plugin-architecture` | ✅ 已在 main | 行为级核对确认，远端已删 |

## Risk / Blast Radius

- 风险：错误的恢复语义可能造成重复执行、状态错乱、用户困惑
- 缓解：明确语义（restart = cancel old + replay new），并用去重键/幂等保护

## Dependencies

- Redis（持久化、CAS、启动 reconcile）

## Open Questions

1. Phase A sweep 阈值：`running` record 的 `updatedAt` 距今多久算 stale？（建议：启动时 **全量 sweep running**，因为重启 = 所有子进程必死；`queued` 则看创建时间 > 5min）
2. Phase A 是否需要 WebSocket 通知前端？（建议：先不做，前端下次 poll 时自然看到 `failed`）
3. Phase B 的触发条件：当 InvocationQueue 有明确的 Redis 迁移需求时再启动

## Review Gate

| 轮次 | Reviewer | 结果 | 日期 |
|------|----------|------|------|
| — | — | — | — |

## Timeline

- 2026-02-28: Kickoff（立项，从幽灵分支盘点中诞生）
- 2026-02-28: Ghost branch audit（codex 盘点 5 条幽灵分支 → 全部确认能力已在 main）
- 2026-03-06: 三猫讨论 → A/B 分段决策（opus 初判"不需要"被 codex+gpt52 纠正：InvocationRecord 已 Redis 持久化，卡 running 是真实 bug）
- 2026-03-06: Status: idea → spec，Phase A ready for implementation

