---
feature_ids: []
related_features: [F108, F122, F175, F117, F133, F140, F173, F183, F184]
topics: [dispatch, queue, invocation, slot, busy-gate, connector, architecture, concurrency]
doc_kind: discussion
created: 2026-05-01
participants: [布偶猫/宪宪 (Opus-46), 布偶猫/宪宪 (Opus-47), 缅因猫/砚砚 (GPT-5.4), 缅因猫/砚砚 (GPT-5.5)]
status: open
thread_link: thread_mon77kco3beh7pgb
---

# 后端消息调度架构 — 四猫只读审计收敛

> 牵头：布偶猫/宪宪 Opus-46（铲屎官投票选定 leader）
>
> 讨论模式：比赛（Mode C — 并行独立分析 → 收敛）
>
> 触发：铲屎官 2026-05-01 报告 — PR tracking event 唤醒布偶猫时砚砚还在跑、两猫频繁并发、外部 IM/GitHub 消息不到达。

## 铲屎官原话

> "你们好像有点奇怪了 我看到云端r2的时候他就给你过了然后你当时改了一堆东西 后面又出现新的问题...而且好像经常出现你和砚砚并发在干活的情况，你们这弄了好像很乱。"
>
> "比如说 你 挂了pr tracking → 你被 event唤醒，按道理这个时候如果砚砚在干活你应该在队列里！但是这时候你似乎会被唤醒！"
>
> "外部 IM 和 GitHub 来的消息永远不会被推送到猫猫那边"

## 四猫诊断收敛

### 共识（4/4 一致）

1. **根因是入口级判忙语义不一致**
   - 用户消息 broadcast：thread 级（`invocationTracker.has(threadId)` — 任一猫忙则排队）
   - ConnectorInvokeTrigger：slot 级（`has(threadId, catId)` — 只看目标猫）
   - 铲屎官期望是 thread 级，实际走的是 slot 级 → 两猫并发
   - 这不是 bug，是 ADR-018 OQ-4 的设计行为，但该决策没区分"用户主动 side-dispatch"和"系统自动 connector event"

2. **ADR-018 OQ-4 需要修订**
   - 原决策："保持 slot 级判忙"（2026-03-15）
   - 原因："支持 by-the-way 场景（猫A忙时给猫B发消息）"
   - 问题：把"铲屎官主动给空闲猫发消息"和"GitHub CI 自动通知"混为一谈
   - 四猫一致建议：外部事件改 thread 级，用户主动保留 slot 级

3. **ConnectorInvokeTrigger 缺少原子门控**
   - `trigger()` 用 `has()` 检查 → fire-and-forget `executeInBackground()` → 中间有异步间隙
   - 对比 `messages.ts` 用 `tryStartThreadAll()` 原子门控（F122 A.1）
   - ConnectorInvokeTrigger 没有这层保护

### 各猫独有贡献

| 猫 | 独有发现 |
|----|---------|
| **46** | TOCTOU race（has→start 异步间隙）、onInvocationComplete 出队竞态、前端 done timeout 多猫共享、optimistic write race、P0/P1/P2 优先级矩阵 |
| **47** | 5 入口判忙对照表、外部消息 5 个静默 skip 点（Task不存在/automation关闭/Pending/Fingerprint去重/Queue full）、"两个独立维度被当同一概念用"总结 |
| **54** | EP-001 review-head continuity 区分"流程病"vs"队列病"、messages.ts 内部语义矛盾（@check 用 cat 级 vs tryStartThreadAll 用 thread 级）、已有 bug report 交叉引用（draft-merge liveness mismatch / stream event delivery lag） |
| **55** | SessionMutex/cancel 不是硬 kill 细节、spec/test/code 三者未收敛（同一行为有相反预期的测试）、"保留 side-dispatch 但改 UI 命名" vs "严格 thread-global queue" 二选一框架 |

### 分歧与开放问题

| 问题 | 立场 | ADR-034 对应 |
|------|------|-------------|
| 外部 connector event 改 thread 级判忙 | 4/4 一致 | ✅ KD-1 收敛 |
| tryAutoExecute 是否加 thread-level 闸门 | 46 保留 slot 级 + fairness gate；47 保留 slot 级 + 加遥测观测期；55 保持 slot 级但补 priority 交互规则 | ❓ OQ-1 |
| messages.ts @/whisper 路径的语义矛盾 | 54/55 指出 spec/test/code 不一致；55 选 C（保留 side-dispatch + tryStartSlotAll） | ❓ OQ-2 |
| connector queue entry priority 策略 | 55 修正：CHANGES_REQUESTED = urgent | ❓ OQ-3 |

## 后续

→ ADR-034（本讨论的决策输出）
→ 决策通过后立项 Feature（消息调度架构统一）
