---
feature_ids: [F185]
related_features: [F108, F122, F175]
topics: [dispatch, queue, busy-gate, connector, slot, thread, fairness]
doc_kind: spec
created: 2026-05-01
---

# F185: 入口级判忙策略分层 — ADR-034 实施

> **Status**: in-progress (Phase B) | **Owner**: 布偶猫/宪宪 | **Priority**: P1
>
> **Decision**: [ADR-034](../../docs/decisions/034-dispatch-busy-gate-unification.md)
> **Discussion**: `docs/discussions/2026-05-01-dispatch-queue-architecture/`

## Why

铲屎官 2026-05-01 报告：PR tracking event 唤醒布偶猫时砚砚在跑，两猫频繁并发，外部 IM/GitHub 消息静默丢弃。

根因：ADR-018 OQ-4 对所有入口统一用 slot 级判忙（`has(threadId, catId)`），把"用户主动 side-dispatch"和"系统自动 connector event"混为一谈。四猫审计一致确认，ADR-034 三猫 review 通过，铲屎官 signoff（2026-05-01）。

## What

三个改动点，不拆 Phase：

**1. ConnectorInvokeTrigger thread 级门控 + TOCTOU 修复（KD-1 + KD-2）**

`ConnectorInvokeTrigger.trigger()` 的 busy gate 改为两层：
1. 先检查 `queueProcessor.isThreadBusy(threadId)` 或等价 thread-level queue/processingSlots gate（覆盖 tracker gap）—— 命中则直接 `enqueueWhileActive()`
2. 未命中则 `tryStartThread(threadId, catId)` 原子获取 slot —— 返回 null 则 `enqueueWhileActive()`，返回 controller 则传入 `executeInBackground()` 复用

现有 `has(threadId, catId) || isCatBusy(threadId, catId)` 两个 cat-level 检查统一升为 thread-level。`tryStartThread` 同时提供 TOCTOU 防护（原子 check-and-acquire，消除 has→start 异步间隙）。

**2. 投递可见性 system_info（KD-3）**

分层产出 skip reason（ADR-034 原则：actionable 才 system_info）：
- **ConnectorInvokeTrigger 层**：queue full → thread `system_info`（用户可清队列）；enqueue duplicate → rate-limited diagnostics log（重试噪声）
- **Router/TaskSpec 层**：automation off → thread `system_info`（用户可修改设置）；task 不存在（无 thread 目的地）→ admin/metrics log
- **轮询噪声**：fingerprint 去重 / pending → rate-limited diagnostics log

**3. Fairness invariant + agent priority 约束（OQ-3 收敛）**

- `InvocationQueue` 增加 `hasQueuedNonAgentForThread(threadId)` 查询
- `QueueProcessor.tryAutoExecute()` 开头加早退门：有 non-agent pending → 直接 return，不启动新 agent
- `InvocationQueue.enqueue()` 校验：source=agent 且 sourceCategory ≠ continuation 时禁止 priority=urgent（continuation 保留 urgent + system-pinned 语义，因为它是同猫接力不是 A2A 新条目）

**4. connector policy 补 sourceCategory（ADR-034 要求）**

CI/review/conflict/scheduled 等 connector trigger policy 必须写入 `sourceCategory`，确保 QueueEntry 有分组信息供 QueuePanel 和 diagnostics 使用。

防止 A2A 链持续产 agent entry 饿死 connector 条目。

## Acceptance Criteria

- [x] AC-1: `ConnectorInvokeTrigger.trigger()` 先检查 thread-level queue/processingSlots gate（`isThreadBusy` 或等价），命中则 `enqueueWhileActive()`
- [x] AC-2: queue gate 未命中时用 `tryStartThread(threadId, catId)` 原子获取 slot，返回 null 则 `enqueueWhileActive()`
- [x] AC-3: `tryStartThread` 返回的 controller 在 `executeInBackground` 中复用，duplicate/throw 路径 `complete()` 释放
- [x] AC-4: ConnectorInvokeTrigger 层：queue full → thread `system_info`（用户可清队列）；enqueue duplicate → info log（rate-limited by idempotency）
- [x] AC-5: Router/TaskSpec 层：automation off → thread `system_info`（用户可修改设置）；task 不存在 → gate 返回 `run: false`；pending/fingerprint → rate-limited diagnostics log
- [x] AC-6: `InvocationQueue.hasQueuedNonAgentForThread(threadId)` 存在且正确查询
- [x] AC-7: `tryAutoExecute()` 在有 non-agent pending 时早退，不启动新 agent
- [x] AC-8: agent entry（sourceCategory ≠ continuation）禁止 urgent priority（enqueue 时校验）；continuation 保留 urgent + system-pinned
- [x] AC-9: CI/review/conflict/scheduled connector policy 写入 `sourceCategory`，QueueEntry 有分组信息
- [x] AC-10: 回归测试：connector 到达 + thread 有猫在忙 → 排队不并发
- [x] AC-11: 回归测试：A2A 链中插入 connector entry → connector 不被后续 agent autoExecute 饿死
- [x] AC-12: 回归测试：continuation entry 仍为 urgent + system-pinned，不被 AC-8 校验拦截

---

## Phase B: routeSerial text-scan fairness gate 扩展至 non-agent

> **Status**: spec-review | **Reopened**: 2026-05-17
> **起因**: 铲屎官报告 A2A @ 链期间外部消息堆积（截图 2026-05-17）。三猫独立诊断（46/47/55）收敛：Phase A 的 fairness gate 覆盖了 `tryAutoExecute` 但**漏了 `routeSerial` text-scan 路径**。

### Why

Phase A（AC-7）给 `tryAutoExecute()` 加了 non-agent fairness gate——有 connector/user 排队时不启动新 agent。但 `routeSerial` 里的 A2A text-scan（猫输出含 `@猫B` 时决定是否扩展 worklist）走的是另一个 predicate：`hasQueuedUserMessagesForThread`，只看 `source === 'user'`，**不看 connector**。

这意味着：猫A 在跑 → connector 消息来了（CI fail / review feedback）→ 入队 → 猫A 跑完输出 `@猫B` → text-scan 检查 `hasQueuedUserMessagesForThread` → false（connector 不算）→ worklist 扩展，猫B 继续跑 → connector 继续等。

ADR-034 OQ-3 的设计结论是 "non-agent（user + connector）都应阻止 A2A 扩展"，但实现只在 `tryAutoExecute` 落地了，`routeSerial` text-scan 没跟上。`InvocationQueue.hasQueuedUserMessagesForThread` 的注释（L752-756）甚至显式写了 "connector must NOT block"，测试（`invocation-queue.test.js:924`）也断言了这个错误行为。

### What

一个改动点：将 `routeSerial` text-scan 的 fairness predicate 从 `hasQueuedUserMessagesForThread`（只看 user）改为 `hasQueuedNonAgentForThread`（看 user + connector），与 `tryAutoExecute` 的 fairness gate 对齐。

**改动范围（4 个 call site + 1 个 wrapper + 注释/测试）：**

| 文件 | 行 | 改动 |
|------|-----|------|
| `routes/messages.ts` | 887 | `hasQueuedUserMessagesForThread` → `hasQueuedNonAgentForThread` |
| `routes/invocations.ts` | 199 | 同上（走 QueueProcessor wrapper） |
| `ConnectorInvokeTrigger.ts` | 365 | 同上（直接调 queue） |
| `QueueProcessor.ts` | 912 | 同上（dequeue 路径） |
| `QueueProcessor.ts` | 265-268 | wrapper 方法重命名 + 改委托目标 |
| `InvocationQueue.ts` | 752-757 | 更新注释，移除"connector must NOT block" |
| `invocation-queue.test.js` | 924 | 断言改为 `true`（connector 应阻止 text-scan） |

**新增回归测试：**
- connector queued + 猫A 输出 `@猫B` → `routeSerial` 不扩展 worklist，当前 invocation 收敛后由 `onInvocationComplete` 出队 connector

### Acceptance Criteria (Phase B)

- [ ] AC-B1: `routeSerial` text-scan fairness gate 使用 `hasQueuedNonAgentForThread`（检查 user + connector）
- [ ] AC-B2: 4 个注入 call site 全部从 `hasQueuedUserMessagesForThread` 切换到 `hasQueuedNonAgentForThread`
- [ ] AC-B3: `QueueProcessor` wrapper 方法重命名，注释更新
- [ ] AC-B4: `InvocationQueue.hasQueuedUserMessagesForThread` 注释移除 "connector must NOT block" 误导文案
- [ ] AC-B5: 回归测试：connector entry queued + A2A text-scan → gate 阻止 worklist 扩展
- [ ] AC-B6: 回归测试：纯 agent entries queued（无 user/connector）→ text-scan 正常扩展（不误阻）
- [ ] AC-B7: Phase A 已有测试全绿（AC-10/11/12 不回归）

### Risk (Phase B)

| 风险 | 缓解 |
|------|------|
| connector 排队时 A2A 链被过度打断（正常 review ping-pong 被 CI pass 通知截断） | CI pass 是 `normal` priority，出队后 A2A 链通过 `tryAutoExecute` 自动恢复。只是当轮 text-scan 不扩展，不是永久阻断 |
| `hasQueuedUserMessagesForThread` 被其他路径使用 | grep 确认只有 text-scan fairness gate 使用，无其他 caller |

---

## Dependencies

- **Evolved from**: F122（统一执行通道 — 补齐 connector 入口的原子门控）
- **Related**: F175（消息队列统一设计 — Phase A priority dequeue 已落地，本 Feature 直接利用）
- **Related**: F108（side-dispatch — 用户 @mention 保留 slot 级，不受影响）

## Risk

| 风险 | 缓解 |
|------|------|
| thread 级改动导致 A2A 链饿死 connector | Fairness invariant（AC-6/7）+ agent priority 禁 urgent（AC-8）|
| tryStartThread 单独不够，漏掉 processingSlots gap | AC-1 先检查 thread-level queue gate，AC-2 再 tryStartThread（R1 55 review）|
| tryStartThread controller 复用出错导致 slot 泄漏 | AC-3 明确 complete() 释放路径 + 回归测试 |
| agent 禁 urgent 误伤 continuation | AC-8 显式豁免 sourceCategory=continuation + AC-12 回归测试（R1 55 review）|
| system_info 事件前端未渲染 | 复用现有 system_info 通道（与 queue_full_warning 同） |
| connector policy 缺 sourceCategory 导致 QueuePanel 分组为空 | AC-9 要求 policy 写入 sourceCategory（R1 55 review）|

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不拆 Phase，三个改动一起上 | 改动集中在 2-3 个文件、~3h 工作量，拆开反增协调成本 | 2026-05-01 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-01 | 四猫审计 → ADR-034 → 三猫 review → 铲屎官 signoff → 立项 |
| 2026-05-02 | Phase A 实现完成，砚砚 R3 放行 + 云端 R2 放行，merged (PR #1531) |
| 2026-05-17 | 铲屎官报告 A2A @ 链外部消息堆积 → 三猫诊断收敛 → Phase B 立项 |

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
