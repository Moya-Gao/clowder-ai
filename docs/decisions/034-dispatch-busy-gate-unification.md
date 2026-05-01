---
decision_id: ADR-034
feature_ids: []
related_features: [F108, F122, F175]
topics: [dispatch, queue, busy-gate, connector, slot, thread, architecture]
doc_kind: decision
created: 2026-05-01
status: draft
decided_by: pending
amends: ADR-018
---

# ADR-034: 入口级判忙策略分层 — 修订 ADR-018 OQ-4

> 状态：draft（2026-05-01，待三猫 review）
> 提案人：布偶猫/宪宪 Opus-46
> 修订目标：ADR-018 OQ-4（"保持 slot 级判忙"）
> 讨论记录：`docs/discussions/2026-05-01-dispatch-queue-architecture/`
> Thread：`thread_mon77kco3beh7pgb`

## 背景

ADR-018 OQ-4（2026-03-15）决定所有入口使用 slot 级判忙（`has(threadId, catId)`）。
设计意图是支持 by-the-way 场景：猫A 在忙时，铲屎官主动给空闲的猫B 发消息可以直接执行。

实际运行中（2026-05-01 铲屎官报告），该决策导致 **系统自动触发的外部事件**（PR tracking、CI failure、review feedback）也绕过队列直接唤醒目标猫，与铲屎官主动 side-dispatch 的语义完全不同：

- PR tracking event 到达 → ConnectorInvokeTrigger 检查 `has(threadId, opus)` → 空闲 → 直接执行
- 此时砚砚在同 thread 上跑 → 两猫并发 → 铲屎官体感"很乱"

四猫独立审计（46/47/54/55）一致认为：ADR-018 OQ-4 把"用户主动协作"和"系统自动通知"混为一谈，需要分层。

## 决策

### KD-1: 入口判忙策略按来源分层 ✅

| 入口来源 | 判忙级别 | 语义 | 代码落点 |
|----------|---------|------|---------|
| 用户 broadcast（无 @mention） | **thread** 级 | 任一猫忙 → 排队 | `messages.ts` — 保持现状 |
| 用户 whisper / 显式 @mention | **slot** 级 | 目标猫忙 → 排队，其他猫忙 → 直接执行 | `messages.ts` — 保持现状 |
| 外部 connector（CI/PR/Review/IM/scheduler/web-digest/generic `/ask`·`/thread`） | **thread** 级 | 任一猫忙 → 排队，idle thread → fast path | `ConnectorInvokeTrigger.trigger()` — **改**（所有经此函数的入口统一适用） |
| A2A agent callback | **slot** 级 | 目标猫忙 → 排队，autoExecute | `callback-a2a-trigger.ts` — 保持现状 |
| multi_mention | **slot** 级 | 同 A2A | `callback-multi-mention-routes.ts` — 保持现状 |
| Steer / force | N/A | 强制抢占 | `messages.ts` — 保持现状 |

**与 ADR-018 OQ-4 的关系**：不废弃 OQ-4，而是增加一个维度。OQ-4 的 slot 级判忙在用户主动和猫间协作场景仍然正确。修订仅针对外部 connector 事件。

### KD-2: ConnectorInvokeTrigger 加原子门控 ✅

当前 `trigger()` 的 `has()` 检查到 `executeInBackground()` 的 `tracker.start()` 之间有异步间隙（`invocationRecordStore.create()` 是 await），存在 TOCTOU race。

修复方向：`trigger()` 中用 `tryStartThread(threadId, catId)` 替代 `has()` + fire-and-forget `start()`，与 `messages.ts` 的 TOCTOU 防护一致（F122 A.1 模式）。tryStartThread 返回 null → 走 `enqueueWhileActive()`。

**实现约束**（R2 砚砚 P1 review）：`tryStartThread` 成功后返回的 controller 必须传入 `executeInBackground()` 并复用——不能在 executeInBackground 内部再调 `start()`，否则会 abort 自己刚占的 controller。`create()` duplicate/throw 路径必须 `complete()` 释放同一个 controller。

### KD-3: 外部消息投递可见性 ✅

四猫审计发现外部消息有 5 个静默 skip 点（Task不存在/automation关闭/Pending状态/Fingerprint去重/Queue full），全部只 log 不向前端反馈。

分层可见性策略（R2 砚砚 P1 review）：

| skip 类型 | 是否 actionable | 可见性 |
|-----------|----------------|--------|
| Queue full | ✅ | thread `system_info` 事件（已有 `queue_full_warning`） |
| automation 关闭 | ✅ | thread `system_info`（用户可修改设置） |
| Task 不存在 | ⚠️ 无 thread 目的地 | admin/metrics log，不发 `system_info` |
| Fingerprint 去重 | ❌ 正常轮询噪声 | rate-limited diagnostics log |
| Pending 状态 | ❌ 正常轮询中间态 | rate-limited diagnostics log |

原则：actionable drop（用户能做什么来修复）→ thread `system_info`；正常轮询噪声 → 仅 metrics/diagnostics。

## OQ（开放问题）

### OQ-1: tryAutoExecute 是否加 thread-level 闸门？

当前 `QueueProcessor.tryAutoExecute()` 扫描所有 `autoExecute` 条目，只要目标猫 slot 空闲就启动。这意味着 A2A 产生的 @多猫 会同时拉起多只猫并发执行。

**选项 A**：保持现状（slot 级）。A2A 是猫间协作，并发是 F108 设计意图。
**选项 B**：加 thread-level 上限（如最多同时 1-2 只猫在跑）。降低前端混乱感。

倾向 A（保持现状），理由：铲屎官今天的吐槽主要是 connector 唤醒，不是 A2A 并发。A2A 并发是有意设计，改了会影响 ideate 模式。

**R2 砚砚立场**：选 A。但补充：`tryAutoExecute()` 当前绕过 comparator 直接扫 autoExecute entries，agent entry 可能越过已排队的 user/urgent connector entry。需显式定义 autoExecute 与 priority 的交互规则。

### OQ-2: messages.ts @/whisper 路径的语义矛盾

54/55 指出：`messages.ts` 的 `hasActive` 计算（L439-461）对 @mention 用 cat-level 检查，但后续 `tryStartThreadAll()`（L574）是 thread-level gate。两者可能不一致：

- `hasActive = false`（cat A 忙但 @cat B 空闲） → 走 immediate path
- `tryStartThreadAll` 返回 null（cat A 忙 = thread busy） → 降级 queue

效果是：@空闲猫的消息先判断"可以直接执行"，然后又被 TOCTOU gate 退回队列。用户体验上表现为"发了但进了队列"——不一致但安全（宁可多排队不会多并发）。

**选项 A**：保持现状。tryStartThreadAll 是安全兜底，即使 hasActive 判断偏乐观也不会出错。
**选项 B**：对齐 hasActive 也用 thread 级，消除语义矛盾。但这会取消 side-dispatch 功能。
**选项 C**：tryStartThreadAll 改为 tryStartSlotAll（只检查目标猫 slot），让 @mention 真正实现 side-dispatch。

需要铲屎官定夺：side-dispatch（@空闲猫时绕过队列）到底要不要保留？

**R2 砚砚立场**：选 C。F108 已接受 side-dispatch 能力，选 B 等于废掉 F108，需要 CVO 明确 overturn。补 `tryStartSlotAll`/`tryStartTargets` 原子 slot gate 是正道。

### OQ-3: connector queue entry 的 priority 策略

F175 spec 已设计 priority ordering（urgent 优先出队）。ConnectorInvokeTrigger 改 thread 级判忙后，connector 消息会更多进入队列。需要确认：

状态化 priority 策略（R2 砚砚 P1 修正）：

| 事件类型 | priority | 理由 |
|----------|----------|------|
| CI failure | `urgent` | 阻塞 merge |
| PR conflict | `urgent` | 阻塞 merge |
| Review CHANGES_REQUESTED | `urgent` | 阻塞 merge（实际 `ReviewFeedbackTaskSpec` 已设 urgent） |
| CI pass / Review approved / 普通 comment | `normal` | 信息性通知 |
| 外部 IM | `normal` | 非阻塞 |

实现时需同步写入 `sourceCategory` 到 QueueEntry，否则 QueuePanel 分组和 diagnostics 仍为空。

这与 F175 KD-2 一致，当前 dequeue 部分已实现 priority 排序（`compareEntries`）。

## 影响评估

| 改动 | 风险 | 缓解 |
|------|------|------|
| ConnectorInvokeTrigger 改 thread 级 | CI 通知延迟（当前 invocation 跑完才处理） | connector queue 不限容量 + priority ordering + 75min TTL 兜底 |
| 加 tryStartThread 原子门控 | 需要重构 trigger() 流程 | 与 messages.ts F122 A.1 模式一致，已有成熟参考 |
| 投递可见性 system_info | 前端需要渲染新事件类型 | 可复用现有 system_info 通道 |

## 对现有 Feature 的影响

- **F175**（消息队列统一设计）：KD-1/KD-2 是 F175 的前置条件修正。F175 的 priority ordering 能更好地服务改 thread 级后更多入队的 connector 消息。
- **F108**（side-dispatch）：用户主动 side-dispatch 保留，不受影响。
- **F122**（统一执行通道）：ConnectorInvokeTrigger 的原子门控补齐 F122 A.1 在 connector 入口的缺失。

## Review Trail

| 轮次 | 日期 | 参与 | 状态 |
|------|------|------|------|
| R0 | 2026-05-01 | 46/47/54/55 四猫独立审计 | ✅ 诊断完成 |
| R1 | 2026-05-01 | 46 起草 ADR-034 | ✅ draft |
| R2 | 2026-05-01 | 55 review：修改后放行（5 findings，全部修复） | ✅ |
| R3 | pending | 47/54 review | ⏳ |
