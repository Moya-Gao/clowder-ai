---
feature_ids: [F185]
related_features: [F108, F122, F175]
topics: [dispatch, queue, busy-gate, connector, slot, thread, fairness]
doc_kind: spec
created: 2026-05-01
---

# F185: 入口级判忙策略分层 — ADR-034 实施

> **Status**: spec | **Owner**: 布偶猫/宪宪 | **Priority**: P1
>
> **Decision**: [ADR-034](../../docs/decisions/034-dispatch-busy-gate-unification.md)
> **Discussion**: `docs/discussions/2026-05-01-dispatch-queue-architecture/`

## Why

铲屎官 2026-05-01 报告：PR tracking event 唤醒布偶猫时砚砚在跑，两猫频繁并发，外部 IM/GitHub 消息静默丢弃。

根因：ADR-018 OQ-4 对所有入口统一用 slot 级判忙（`has(threadId, catId)`），把"用户主动 side-dispatch"和"系统自动 connector event"混为一谈。四猫审计一致确认，ADR-034 三猫 review 通过，铲屎官 signoff（2026-05-01）。

## What

三个改动点，不拆 Phase：

**1. ConnectorInvokeTrigger thread 级门控 + TOCTOU 修复（KD-1 + KD-2）**

`ConnectorInvokeTrigger.trigger()` 中 `has(threadId, catId)` → `tryStartThread(threadId, catId)`。一个替换同时实现：
- thread 级判忙（`tryStartThread` 内部调 `has(threadId)` 不带 catId）
- TOCTOU 防护（原子 check-and-acquire，消除 has→start 异步间隙）

`tryStartThread` 返回的 controller 传入 `executeInBackground()` 复用，不在内部再 `start()`。返回 null → 走 `enqueueWhileActive()`。

**2. 投递可见性 system_info（KD-3）**

`trigger()` 中 skip 路径加 `system_info` 事件：
- Queue full / automation 关闭 → thread `system_info`（用户可修复）
- Task 不存在（无 thread 目的地）→ admin log
- Fingerprint 去重 / Pending → rate-limited diagnostics log

**3. Fairness invariant + agent priority 约束（OQ-3 收敛）**

- `InvocationQueue` 增加 `hasQueuedNonAgentForThread(threadId)` 查询
- `QueueProcessor.tryAutoExecute()` 开头加早退门：有 non-agent pending → 直接 return，不启动新 agent
- `InvocationQueue.enqueue()` 校验：source=agent 时禁止 priority=urgent

防止 A2A 链持续产 agent entry 饿死 connector 条目。

## Acceptance Criteria

- [ ] AC-1: `ConnectorInvokeTrigger.trigger()` 使用 `tryStartThread(threadId, catId)` 替代 `has(threadId, catId)` + fire-and-forget `start()`
- [ ] AC-2: thread 有任一猫在忙时，connector event 走 `enqueueWhileActive()` 而非直接执行
- [ ] AC-3: `tryStartThread` 返回的 controller 在 `executeInBackground` 中复用，duplicate/throw 路径 `complete()` 释放
- [ ] AC-4: skip 路径产出 `system_info` 事件（queue full + automation off），诊断噪声走 rate-limited log
- [ ] AC-5: `InvocationQueue.hasQueuedNonAgentForThread(threadId)` 存在且正确查询
- [ ] AC-6: `tryAutoExecute()` 在有 non-agent pending 时早退，不启动新 agent
- [ ] AC-7: agent entry 禁止 urgent priority（enqueue 时校验）
- [ ] AC-8: 回归测试：connector 到达 + thread 有猫在忙 → 排队不并发
- [ ] AC-9: 回归测试：A2A 链中插入 connector entry → connector 不被后续 agent autoExecute 饿死

## Dependencies

- **Evolved from**: F122（统一执行通道 — 补齐 connector 入口的原子门控）
- **Related**: F175（消息队列统一设计 — Phase A priority dequeue 已落地，本 Feature 直接利用）
- **Related**: F108（side-dispatch — 用户 @mention 保留 slot 级，不受影响）

## Risk

| 风险 | 缓解 |
|------|------|
| thread 级改动导致 A2A 链饿死 connector | Fairness invariant（AC-5/6）+ agent priority 禁 urgent（AC-7）|
| tryStartThread controller 复用出错导致 slot 泄漏 | AC-3 明确 complete() 释放路径 + 回归测试 |
| system_info 事件前端未渲染 | 复用现有 system_info 通道（与 queue_full_warning 同） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不拆 Phase，三个改动一起上 | 改动集中在 2-3 个文件、~3h 工作量，拆开反增协调成本 | 2026-05-01 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-01 | 四猫审计 → ADR-034 → 三猫 review → 铲屎官 signoff → 立项 |

## Review Gate

- 跨家族 review（砚砚/GPT-5.5）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Decision** | `docs/decisions/034-dispatch-busy-gate-unification.md` | ADR-034（本 Feature 的设计源） |
| **Discussion** | `docs/discussions/2026-05-01-dispatch-queue-architecture/` | 四猫审计讨论记录 |
| **Feature** | `docs/features/F122-unified-dispatch-queue.md` | F122 统一执行通道 |
| **Feature** | `docs/features/F175-unified-message-queue.md` | F175 消息队列统一设计 |
| **Feature** | `docs/features/F108-side-dispatch-concurrent-invocation.md` | F108 side-dispatch |
