---
feature_ids: [F216]
topics: [architecture, refactor, routing]
doc_kind: spec
created: 2026-05-30
---

# F216: routeSerial 决策层/执行层分离重构

> **Status**: in-progress (Phase D queued-merge 已交付 PR #1971；Phase B c0–c1.3 已交付 PR #1987；剩 c2 deferred 接线 + c3 supersede) | **Owner**: @opus48（本 F216 thread = 设计 from F215-thread handoff + 执行 owner，同一只猫继续持有） | **Priority**: P1 | **Source**: internal (F215 引爆点)

Architecture cell: `routing`
Map delta: routeSerial 从 2302 行单函数拆为决策层(纯函数) + 执行层(for-await yield)

## Why

routeSerial 是 Cat Cafe 的核心路由引擎——所有 A2A 串行调度、mention 路由、callback、F215 relay 都经过这个函数。当前状态：

- **2302 行单函数**，cognitive complexity 255（biome noExcessiveCognitiveComplexity 报 warning 但被豁免）
- **5 套并行路由路径**（inline mention / deferred mention / callback A2A / F215 malformed relay / executed-relay dedup）共享同一个可变 `worklist`
- **15+ 可变状态变量**（`attemptHasContentOutput`、`suppressedMalformedError`、`shouldRetryWithoutSession` 等）在同一个作用域互相影响
- 加任何路由决策都笛卡尔积式炸 edge case——F215 relay 是引爆点（r5→r6→r7 补丁引补丁，7 轮 review）

**不重构的代价**：后续每个路由相关 feature 都会重演 F215 的 7 轮 review 循环。脆弱度已 6/10。

## What

### Phase A: 执行单元化（降脆弱度）

把 routeSerial 的 for-await 循环中的每个路由决策（mention / relay / deferred / callback）抽成独立函数，各自返回"worklist 扩展清单"而非直接 mutate worklist。

**Before**: 5 处 `worklist.push(...)` 散落在 for-await 循环的不同分支里
**After**: `resolveNextCats(signal, context) → CatId[]`，for-await 循环只负责 `worklist.push(...resolved)`

### Phase B: 决策/执行分离

将路由决策逻辑提取为**纯函数**（输入：当前 signal + context + config → 输出：routing decision），可独立单测。执行层（for-await invokeSingleCat + yield）保持不变。

### Phase C: 状态机化（如需）

如果 Phase B 后状态变量仍然耦合过深，考虑显式状态机（state enum + transition table）。这是 Phase C 是否需要做的判断依据——Phase B 后如果够了就不做。

## 硬约束（F215 踩坑知识，必须遵守）

1. **F215 relay 行为零回归**——有 16 测试 + 真实 runtime 守护过的兜底链（seal→fresh→46 接力 + partial-output 诚实文案），重构不能破任何一个
2. **坐标变换不是堆补丁**——这正是 F215 栽进雷区处（r5→r6→r7 都是局部补丁，最后 sonnet 开干了 route-serial 的真接力才解决）；routeSerial 重构必须做到"一次改对坐标系"
3. **真实 runtime 验证（LL-064）**——routeSerial 比 F215 更核心，merge 前必须真 runtime + 真截图 + 刻意触发多路由场景，绝不只信单测
4. **跨族 review 强制**——5 套路由耦合最易出 edge case，必须缅因猫族 review

## Context 卫生安排（CVO directive）

> ⚠️ "fresh" 的语义（铲屎官 2026-05-30 纠正，防后人重蹈）：**fresh = 相对 F215 的纯粹，NOT 再开空白 thread**。
> handoff 的初心是「接 F216 的猫不背 F215 重构的 context 包袱」——F215-thread 的 opus-48 立项后把 spec
> 交给一只 **context 是 F216 而非 F215** 的 opus-48。**承接 coalesce bug 的本 thread 就是那只 fresh 猫**：
> 从头到尾 context 都是 F216（coalesce bug = Phase D 引爆现象），零 F215 污染。再开 thread = fresh 到失忆，
> 丢掉 F216 自己积累的宝贵上下文（abort-resume 雷区 / 3 个回归教训 / reviewer nit）= 违背初心。
> **owner 持续是承接它的 opus-48，不换猫。**

- **立项**：F215 thread 的 opus-48（亲历 F215 踩坑知识最全 → spec 最准）→ handoff 给 context 纯 F216 的 opus-48
- **执行**：context 纯 F216、无 F215 污染的 opus-48（= 初心所指的 "fresh"；coalesce bug 的全部上下文是 routeSerial 重构的资产，不是污染）
- **双向防污染**：F215 回归时不被 routeSerial 重构 context 干扰，反之亦然

## Risk

- **高风险**：改比 F215 更核心的路由路径
- **缓解**：Phase A 先降脆弱度（不改行为），Phase B 再分离（有 Phase A 保护），渐进式不一步到位
- **兜底**：16 个 F215 测试 + 全量 route 测试 + LL-064 真实 runtime 验证

## Dependencies

- F215 close 后开始（runtime 守护验证完）
- 不依赖其他 feature

## AC（验收标准）

### Phase A
- [ ] AC-A1: 每个路由决策点提取为独立函数
- [ ] AC-A2: worklist.push 只出现在一处（for-await 循环主体）
- [ ] AC-A3: F215 16 测试 + 全量 route 测试零回归

### Phase B
- [x] AC-B1: 路由决策是纯函数，可独立单测（无 side effect）— c1.2 `resolveRoutingDecisions`（`routing-decision.ts`）+ `routing-decision.test.js` / `routing-decision-streak.test.js`（PR #1987）
- [ ] AC-B2: cognitive complexity 降到 biome 默认阈值以下（或显著下降）— c2/c3 接完所有路径后测量
- [~] AC-B3: 真实 runtime 验证——mention / relay / callback 三路由场景各验一次（inline-mention 已接线 c1.3 + deferred/queue-pending 已接线 c2，共 330 测试覆盖；relay 留独立 battle-tested 块，全路径接完后做 runtime 验证）

> **PR #1987（c0–c1.3）已合入 main（squash `32f88814e`，2026-05-31）**。砚砚 GPT-5.5 跨族 review 两轮（R1 三个 P1 全修 red→green：caller-scope 生产 lookup 漏接 / multi-target streak 陈旧快照 / pnpm check import-sort；R2 Findings: none 放行）+ 云端 codex review（1 个 P2 docs frontmatter，已修）。
> **本 PR 落地**：c0 caller-scope（`findInFlightAgentEntry` 第 3 参）+ c1.1 `peekStreakOnPush` 纯读预判 + c1.2 `resolveRoutingDecisions` 纯决策函数 + c1.3 inline-mention 接线（副作用留执行层）。
> **PR #1991（c2）已合入 main（squash `d3966c85d`，2026-05-31）**：queue-pending（deferred）A2A 路径接入 `resolveRoutingDecisions`（逐 cat resolve+apply，非 batch，避免 P1-2 stale-streak），三条路径（inline/relay/queue-pending）统一决策层。砚砚跨族 review 三轮（R1 3 P1：followup-tails subject / defer_queue 未计 depth / P2 fix 漏提交；R2-3 Findings: none 放行）+ 云端 codex review（0 findings）。
> **剩余**：c3（supersede 执行层 = Phase D processing 主场景 — 铲屎官报的"at 两次同猫，第一条已 processing 时 abort 重启"那个 bug 的主场景）。

### Phase C（conditional）
- [ ] AC-C1: Phase B 后评估——如果状态变量耦合已解，标 "不需要" 跳过

### Phase D: A2A same-turn handoff supersede（driven by 2026-05-30 coalesce bug）
> 来源：铲屎官报 bug「post msg at 了两次同一只猫 → 第一条先执行（可能错误行动），第二条又独立执行」。
> 期望：去重 / 合并，后续那条才是真实意图。详见 `docs/bug-report/a2a-same-turn-handoff-coalesce/`。
>
> **已独立交付（不依赖 F216）**：queued-merge —— 第一条还 queued（没开跑）时，同 turn 重复 handoff
> 合并进同一 entry（`coalesceContentIntoQueuedAgent`），并把后续 handoff coalesce 进 queued follow-up，
> 不再丢 caller 真实意图。见 `InvocationQueue.findInFlightAgentEntry/coalesceContentIntoQueuedAgent`
> + `callback-a2a-trigger.ts` Guard 2。
>
> **为何 supersede 归 F216**：主场景（第一条已 `processing`）唯一正确解是 abort 正在跑的 handoff +
> 用 follow-up 重启。这条 abort→slot cleanup→pause→resume 时序与 routeSerial / QueueProcessor 的
> abort-resume 坐标系同源，独立硬接会和后台 `executeEntry` cleanup 抢 `processingSlots` mutex
> = 硬约束 #2 警告的 LL-064 式堆补丁。在干净坐标系上一次做对。

- [ ] AC-D1: processing 中的 target 收到同 turn follow-up → abort 正在跑的 + 用 follow-up（last-wins）重启，不重跑被 supersede 的第一条
- [ ] AC-D2: abort+restart 不引入 `processingSlots` mutex race（复用 force-send 的 cancelInvocation+clearPause+releaseSlot 已验证模式）
- [ ] AC-D3: 真实 runtime 验证——猫连发两条矛盾 handoff 给同一只猫，目标猫只执行最终意图，不先跑错第一步
- [ ] AC-D4: queued-merge（已交付）零回归——18 个 a2a-coalesce/callback-a2a-trigger 测试全绿

#### Review nits 收口（PR #1971 已交付后的 reviewer 建议，归 Phase D 一并清理）
> 来源：antig-opus（孟加拉猫 Opus，云端 codex 额度耗尽替补）completed review of `3654ea9d9`，3 个 non-blocking。
- [ ] AC-D5: vote 路径（`callbacks.ts` `/start-vote` 的 `enqueueA2ATargets` 调用 ~L2314）`missed` check 同时考虑 `coalesced`——目前 coalesced 的 voter 被算作 missed → 走 `triggerA2AInvocation` direct dispatch fallback（vs pre-PR 一致，但 post-PR 多了一次 content append 到 pre-existing entry）。supersede 重构时一并修。
- [ ] AC-D6: `MessageDeliveryService` 在 coalesce（enqueued=[]）时走 `recoverQueuedMessage` 的 `zeroEnqueuedWarnMessage` warn 日志语义误导（功能正确，content 已 coalesced = 已处理，只是日志措辞）。
- [ ] AC-D7: `callback-a2a-trigger.ts` emit `queue_updated` 的 `action: 'enqueued'` 在纯 coalesce 时语义不准（pre-existing；前端大概率只用 `queue` 字段重渲染不依赖 `action`，确认后清理）。

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-30 | 立项（CVO signoff + opus-48 设计，F215 引爆点） |
| 2026-05-30 | Phase D 追加：A2A same-turn handoff bug（queued-merge 独立交付，supersede 归 F216） |
| 2026-05-31 | Phase B c0–c1.3 merged（PR #1987 squash `32f88814e`）：c0 caller-scope + c1.1 peekStreakOnPush + c1.2 resolveRoutingDecisions 纯函数 + c1.3 inline-mention 接线。砚砚跨族 review 2 轮（3 P1 修复）+ 云端 review（1 P2 修复） |
| 2026-05-31 | Phase B c2 merged（PR #1991 squash `d3966c85d`）：queue-pending（deferred）路径接入 resolveRoutingDecisions（逐 cat，非 batch）+ defer_queue 计入 depth budget。砚砚跨族 review 3 轮（3 P1 修复）+ 云端 review（0 findings） |

## Review Gate

- Phase A/B: 跨族 review（缅因猫族 reviewer，改核心路由路径强制）

## Links

- F215（引爆点）：[F215](F215-malformed-toolcall-recovery.md)
- LL-064（元教训）：[lessons-learned.md](../lessons-learned.md#ll-064)
- routeSerial 源文件：`packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
