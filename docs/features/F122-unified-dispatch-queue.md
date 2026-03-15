---
feature_ids: [F122]
related_features: [F108, F117, F027]
topics: [a2a, queue, dispatch, steer, multi_mention, architecture]
doc_kind: spec
created: 2026-03-14
---

# F122: 执行通道统一 — A2A/multi_mention 入 Dispatch Queue

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官原话（2026-03-14 19:25）：

> "你们在 a2a 按道理我发的消息进 channel 然后我点 steer 才能强制推送 现在整个系统乱七八糟的"
> "原本的行为是就算你们在 a2a 我看到的也是这个界面！现在是你们 a2a 我看到的是另一个我可以发消息的界面！"

**核心问题**：当前系统有三套执行分发平面并存，语义不统一：

1. **用户/connector 消息**走 `InvocationQueue`（有 queue/steer 语义）
2. **callback A2A**（post_message + targetCats/@mention）走 `WorklistRegistry` 自动推进，不受 steer 管控
3. **multi_mention** 有自己的 dispatch 系统（`MultiMentionOrchestrator`），热修前连 `InvocationTracker` 都没接

铲屎官期望的行为很简单：**猫猫在忙（不管怎么忙起来的），我发的消息就排队，只有我点 steer 才能强推。** 这要求所有执行路径都接入统一的 active/queue 状态语义。

## 现状分析（基于代码审查 2026-03-14）

### 五条消息入口的真实行为

| # | 入口 | 走 InvocationQueue? | steer 管得到? | 代码位置 |
|---|------|---------------------|---------------|----------|
| ① | 用户/前端 POST `/api/messages` | ✅ smart-default queue | ✅ | `messages.ts:306-307` |
| ② | Connector（飞书/GitHub/iMessage） | ✅ `enqueueWhileActive()` | ✅ | `ConnectorInvokeTrigger.ts:106-112` |
| ③ | 猫 post_message A2A（worklist） | ❌ 直接 pushToWorklist | ❌ | `callback-a2a-trigger.ts:67-116` |
| ④ | 猫 multi_mention | ❌ 直接 dispatchToTarget | ❌ | `callback-multi-mention-routes.ts:138-184` |
| ⑤ | Steer（用户手动） | — | 它就是控制入口 | `queue.ts:199-225` |

### 热修后已解决的问题（不在 F122 scope 内）

- `parentInvocationId` 链路断裂 → A2A worklist key 不匹配 → targets 掉裂缝（commit `a95e02ef`）
- multi_mention 没接 InvocationTracker → 前端不锁输入 → 用户消息 immediate 打断 A2A（commit `1d2b2ce6`）
- QueueProcessor queued execution 不发 `intent_mode`（commit `1d2b2ce6`）
- 前端乐观 bubble 与 server queued 回包不对齐（commit `1d2b2ce6`）

### 仍存在的问题

#### P1: 执行平面分裂

callback A2A（③）和 multi_mention（④）虽然热修后接了 InvocationTracker，但执行本身不走 InvocationQueue，steer 管不到。

**用户视角的影响**：猫猫 A2A 自动接力时，你只能看着等，不能 steer 插队。如果你要的是"猫猫之间 handoff 也能被我 steer 管到"，当前做不到。

#### P1: pushToWorklist 返回空时无结构化 reason

`hasWorklist=true && pushToWorklist=[]` 时只有一行日志（`callback-a2a-trigger.ts:107-114`），没有区分是 depth limit / duplicate / caller 不匹配 / key 找不到，排查困难。

#### P2: multi_mention 没传 parentInvocationId

`dispatchToTarget` 调用 `routeExecution` 时只传了 `{ signal }`，没有 `parentInvocationId`（`callback-multi-mention-routes.ts:163`）。如果 multi_mention 目标猫在回复中 @mention 发起猫，A2A push 可能进错 worklist。

#### P2: QueuePanel 不显示 processing 状态

QueuePanel 只显示 `status='queued'` 的条目（`QueuePanel.tsx:142`），条目进入 processing 后从面板消失，体感像"没进队列直接跑了"。

### 可靠的部分（不需要改）

- **用户消息** → smart-default queue ✅
- **Connector 消息** → `ConnectorInvokeTrigger.enqueueWhileActive()` ✅ 完整走 InvocationQueue
- **Worklist 内部串行 A2A** → route-serial 的 while 循环 + depth limit ✅
- **Anti-cascade guard** → multi_mention 不能互相回环（`callback-multi-mention-routes.ts:331-336`）✅
- **Slot-aware InvocationTracker** → 不同猫在同一 thread 不互相 abort（`InvocationTracker.ts:50-54`）✅

## What

### 铲屎官期望的行为

1. **猫猫在忙时（不论原因），我发的消息必须排队** — 已实现 ✅
2. **只有 steer 才能强推** — 对用户/connector 消息已实现 ✅，对 A2A/multi_mention 不适用（它们是猫猫自动接力，不应该被 steer 管控，见 OQ-1）
3. **前端必须正确显示"忙/排队"状态** — 热修后基本 OK，QueuePanel processing 可见性待改善
4. **Connector 来的消息和用户消息一样可靠** — 已实现 ✅（走同一套 InvocationQueue）

### Phase A: 可靠性加固（最小闭环）

**不改架构，只补漏洞和可观测性。**

1. **multi_mention parentInvocationId 透传**
   - `dispatchToTarget` 的 `routeExecution` 调用补传 `parentInvocationId: createResult.invocationId`
   - 防止 A2A @mention 回路进错 worklist

2. **pushToWorklist 结构化 reason**
   - 返回值从 `CatId[]` 扩展为 `{ added: CatId[], reason?: 'depth_limit' | 'duplicate' | 'caller_mismatch' | 'not_found' }`
   - `enqueueA2ATargets` 基于 reason 决定是否降级 fallback
   - `reason: 'not_found'` 时降级到 standalone invocation（防御性）

3. **QueuePanel 显示 processing 态**
   - QueuePanel filter 从 `status === 'queued'` 改为 `status === 'queued' || status === 'processing'`
   - processing 条目显示为"正在处理中"（灰色/动画区分）

### Phase B: 语义收敛（待讨论，见 OQ-1）

**如果产品确认 A2A handoff 也要受 steer 管控**：

1. callback targetCats 改为产出 queue entry（`source: 'agent'`），不直接 pushToWorklist
2. multi_mention 改为产出 queue entry，不直接 dispatchToTarget
3. QueueProcessor 统一处理 user / connector / agent 三种 source
4. steer 可以管控所有 queue entry（含 agent-sourced）

**如果产品确认 A2A 是自动接力、用户只管自己的消息**：

1. Phase A 就是终态
2. UI 明确区分"猫猫自动接力中"和"有排队消息"两种状态
3. steer 只管用户/connector 消息，A2A 继续走 worklist

## Acceptance Criteria

### Phase A（可靠性加固）
- [ ] AC-A1: multi_mention 的 routeExecution 传递 parentInvocationId
- [ ] AC-A2: pushToWorklist 返回结构化 reason，不再只返回空数组
- [ ] AC-A3: reason='not_found' 时降级到 standalone invocation
- [ ] AC-A4: QueuePanel 显示 processing 态条目
- [ ] AC-A5: 回归测试覆盖：A2A 期间用户发消息 → 必须 queued；steer → 必须 immediate

### Phase B（语义收敛，待 OQ-1 决策后定义）
- [ ] AC-B1: TBD（取决于产品方向决策）

## Dependencies

- **Evolved from**: F108（slot-aware InvocationTracker 是 F122 的基础设施）
- **Related**: F117（message delivery lifecycle — 用户消息的投递生命周期）
- **Related**: F027（A2A worklist pattern 的原始设计）

## Risk

| 风险 | 缓解 |
|------|------|
| Phase B 如果把 A2A 入 queue，猫猫自动接力会变慢（每步要过 queue） | 可以给 agent-source entry 设置 auto-execute（跳过排队，但在 queue 里有记录） |
| pushToWorklist API 变更影响现有调用方 | 返回值做 backward-compatible 扩展（`{ added, reason }` 兼容原 `CatId[]`） |
| multi_mention parentInvocationId 引入新的 worklist key 冲突 | 用 multi_mention 自己的 invocationId 作为 parentInvocationId，和主 invocation 的 worklist 天然隔离 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | A2A handoff 应该走 queue（用户可 steer）还是保持自动推进（用户只管自己的消息）？铲屎官 2026-03-14 确认的期望是"A2A 跑完再处理我的消息"（排队语义），但没明确说"我要 steer A2A"。 | ⬜ 待铲屎官定 |
| OQ-2 | multi_mention 是否也应入 queue？当前 anti-cascade guard 已防止无限回环，但语义上它仍是一个独立的分发平面。 | ⬜ 待讨论 |
| OQ-3 | QueuePanel processing 态的 UI 设计——是和 queued 混在一起，还是单独区域？ | ⬜ 待设计 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 热修优先，架构统一后做 | 铲屎官现场 bug 需要立即止血 | 2026-03-14 |
| KD-2 | Connector 消息不需要改（已正确走 queue） | `ConnectorInvokeTrigger` 已有完整的 `enqueueWhileActive` 逻辑 | 2026-03-14 |
| KD-3 | Phase A 不改 A2A 调度模型，只补漏洞 | 降低风险，先稳后收敛 | 2026-03-14 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-14 | 立项。热修 `a95e02ef` + `1d2b2ce6` 已合入 main |

## Review Gate

- Phase A: 跨家族 review（缅因猫优先，codex 或 gpt52）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F108-concurrent-cat-isolation.md` | slot-aware InvocationTracker（F122 基础设施） |
| **Feature** | `docs/features/F117-message-delivery-lifecycle.md` | 用户消息投递生命周期 |
| **Bug Report** | `docs/bug-report/f051-a2a-queue-fairness-starvation/` | A2A queue 公平性（历史相关） |
| **Hot Fix** | commit `a95e02ef` | parentInvocationId 链路闭环 |
| **Hot Fix** | commit `1d2b2ce6` | multi_mention 接 InvocationTracker + queued intent_mode |
