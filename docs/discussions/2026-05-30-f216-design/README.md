---
feature_ids: [F216]
topics: [architecture, refactor, routing, design-gate]
doc_kind: discussion
created: 2026-05-30
---

# F216 Design Gate — routeSerial 决策层/执行层分离（现状洞察 + 设计方向）

> **类型**：架构级（分流：猫猫讨论 → 铲屎官拍板）
> **作者**：宪宪 / Opus-4.8（F216 owner）
> **独立核验**：@antig-opus（孟加拉猫底层 Opus；缅因猫族无猫粮降级）——核验完成，**纠正了作者一处实质错误**（见下）
> **状态**：现状摸底 + 核验完成，待铲屎官拍板坐标系（OQ1-3）

## Architecture Ownership（F191）

- **Architecture cell**: `routing`
- **Map delta**: `update required` —— routeSerial 内部结构重画（决策层抽纯函数 + worklist mutation 单点化），owner/boundary 不变但 extension point 变化
- **Why**: 「加任何路由决策都笛卡尔积炸 edge case」的根因是结构问题，不是某个 bug

## 现状摸底（事实级，作者 grep + antig-opus 独立核验双重确认）

routeSerial.ts = **2315 行单函数**，cognitive complexity 255（biome warning 豁免）。

### worklist 写入口 = 3 个（纠正 spec 的"5 套路径"）

| # | 位置 | 时机 | 性质 | 生产是否活 |
|---|------|------|------|-----------|
| 1 | `route-serial.ts:1777` `worklist.push(nextCat)` | 循环内 | 同步，**direct inline-mention** text-scan | ✅ **生产热路径** |
| 2 | `route-serial.ts:1136` `worklist.push(relay46CatId)` | 循环内 | 同步，F215 malformed relay | ✅ 活（edge case） |
| 3 | `WorklistRegistry.ts:302` `entry.list.push(cat)`（via `pushToWorklist`） | 异步外部 | callback A2A **legacy path** | ❌ **生产死代码**（见下） |

**无其他 mutation**：无 splice/unshift/pop/shift；`getWorklist` 只在 trigger 做 streak check（只读）。

### ⚠️ 作者原判断的实质错误（antig-opus 核验抓出，作者已亲自证实）

作者初版 Design 文档断言「异步跨边界 mutation（路径 3）是复杂度根源」。**错。**

**核实证据链**（作者独立 grep，非凭 antig-opus 口述）：
- `index.ts:1346` `const invocationQueue = new InvocationQueue()` —— **无条件**实例化，无 flag 门控
- callbacks 5 个 `enqueueA2ATargets` 调用点都传 `opts.invocationQueue`（生产恒有值）
- `callback-a2a-trigger.ts:113` `if (deps.invocationQueue)` 生产**恒真** → callback A2A 走 InvocationQueue path（启动独立 invocation，不碰 worklist）
- 路径 3（legacy worklist push, `:295` 之后）**只在 invocationQueue 未注入时走 = 生产死代码**（仅测试可能不传）

**所以**：callback 对 worklist 的异步 mutation 在生产**早已切断**（F122B 迁移到 InvocationQueue 时）。真正还在 production 热路径直接改 worklist 的只有 **路径 1（`:1777` direct inline-mention）**。

### 系统已部分迁移到 intent/queue 模式（antig-opus 洞察）

| 路径 | 当前行为 | 直接改 worklist |
|------|----------|----------------|
| Callback A2A（生产） | `InvocationQueue.enqueue()` | ❌ 已切 |
| Deferred inline-mention（`:1798` `deferA2AEnqueue`） | → InvocationQueue | ❌ 已切 |
| **Direct inline-mention（`:1777`）** | `worklist.push` | ✅ **唯一生产热路径** |
| F215 relay（`:1136`） | `worklist.push` | ✅ 活（edge case） |
| Callback A2A legacy（`:295`） | `pushToWorklist` | ✅ 但生产死代码 |

已迁移 2/5，未迁移 3/5（其中 1 个死代码）。

### 附带结构债（一并消除）

- **2 处 handoff-emit 循环**（`:1892` / `:2134`，`for (let wi = handoffEmitted; ...)`）—— 重复尾逻辑，应合一。
- **15+ 可变状态变量**同作用域互相影响。

## 修正后的设计方向（坐标变换）

**不是** intent 队列（antig-opus 纠正：callback 已走 InvocationQueue，再加 intent 层是多余的堆项）。

**真正的最小项数坐标变换**（砚砚 GPT-5.5 核验后修正：决策返回 enum，副作用留执行层）：
- 抽 `resolveNextCats(signal, context, config) → RoutingDecision[]` **纯函数**——统一 3 条 inline-mention 路径（direct / deferred / relay）目前各自重复的 depth/dedup/ping-pong guard。**只返回结构化决策，不做副作用**。
- `signal` + `decision` 都用 discriminated union：
  ```typescript
  type RoutingSignal =
    | { type: 'inline_mention'; cats: CatId[]; content: string; callerCatId: CatId }
    | { type: 'relay_malformed'; cat: CatId }
    | { type: 'deferred'; cats: CatId[]; content: string; callerCatId: CatId }

  // 砚砚修正 OQ3：纯函数返回决策，执行层 apply 副作用
  type RoutingDecision =
    | { action: 'enqueue_worklist'; cat: CatId }
    | { action: 'defer_queue'; cat: CatId }
    | { action: 'coalesce_queued'; entryId: string; cat: CatId }
    | { action: 'supersede_processing'; entryId: string; cat: CatId }  // ← 执行层 abort+restart
    | { action: 'skip'; reason: string }
  ```
- `:1777` 从 `worklist.push(nextCat)` 改成消费 `resolveNextCats` 返回的 decision，循环主体单点 apply。
- legacy worklist path（路径 3）：Phase B 评估删除（死代码）。

价值不在"切异步 mutation"（已切），在**统一散布在 3 处的路由 guard 逻辑** + **决策/副作用分层**——这才是「加路由决策笛卡尔积炸」的真因。

### ⚠️⚠️ 砚砚核验新增的 P1 隐患（比"PR 拆不拆"更危险，且是 already-merged 缺陷）

**`findInFlightAgentEntry` 的 `matches()`（InvocationQueue.ts:533-534）没按 `callerCatId` scope** —— 当前只 `source==='agent' && sourceCategory==='a2a' && targetCats.includes(catId)`。

**后果**：A 猫给孟加拉派的 queued 任务，会被 **B 猫**同 turn 后来的一条 handoff coalesce 进去（甚至 F216 supersede 落地后会被 B 取消）。跨 caller 串味。

**这是我已合入 main 的 coalesce 代码的现存缺陷**（不只 F216 设计问题）—— `QueueEntry.callerCatId` 字段存在（:36）、callback 调用处 `callerCatId` 可用（:87）但**没传进 `findInFlightAgentEntry`**。

**处置**：F216 PR 第一步就修——`findInFlightAgentEntry(threadId, catId, callerCatId)` 加 caller scope，`coalesceContentIntoQueuedAgent` 同步。这条独立于重构、优先级最高（数据正确性 > 结构整洁）。

证据（砚砚指）：`InvocationQueue.ts:525` matches 无 caller；`QueueProcessor.ts:465` 取消后自动出队逻辑（supersede 要复用）。

## 交付形态：一个 PR + 内部 commit 分层（铲屎官 directive + 砚砚 refine）

铲屎官 directive：**别拆碎 PR**——分 Phase A/B 多个 PR 会让 main 上躺一串"阶段性 F216"半成品。
砚砚 refine：一个 PR，但**内部 commit 分层**，main 不留半成品 + review 还能分层看：

| commit | 内容 | 风险 |
|--------|------|------|
| c0 | **修 caller-scope P1**（findInFlightAgentEntry 加 callerCatId）+ 红→绿测试 | 独立、最高优先（already-merged 缺陷） |
| c1 | 抽决策结构 `resolveNextCats` + `RoutingDecision` enum，保持 await 点 | 纯结构 |
| c2 | 统一 direct/deferred/relay 三处 guard 进 resolveNextCats；删 legacy 死代码 | 中（F215 relay guard 极脆） |
| c3 | supersede 执行层 helper（abort processing + 释放 slot + 清 pause + 启替代 entry）+ 测试 | 高（执行层副作用） |

**硬约束**：
- c1 **preserve all existing `await` positions**（antig-opus）——重排 await 改异步 interleaving。
- c3 supersede 副作用走 `InvocationQueue` / `QueueProcessor` / `InvocationTracker`（复用 force-send 的 cancelInvocation+clearPause+releaseSlot 已验证模式），**不塞进 resolveNextCats 纯函数**（砚砚：否则纯函数变上帝函数）。

## OQ 拍板（作者 + antig-opus + 砚砚 三方收敛，待铲屎官确认）

| OQ | 问题 | 收敛结论 |
|----|------|---------|
| **OQ1** | Phase 怎么交付 | **一个 PR + 内部 commit 分层 c0-c3**（铲屎官别拆碎 + 砚砚分层 review）。不分多 PR。 |
| **OQ2** | intent 队列 vs 直接重构 | **不要 intent 队列**（callback 已走 InvocationQueue，再加是多余）；`resolveNextCats` 纯函数 + 单点消费 |
| **OQ3** | supersede 怎么落 | **决策进纯函数（返回 `supersede_processing` enum），副作用留执行层 helper**（砚砚纠正：supersede 不是纯路由判断，是 queue/tracker 执行层副作用，不塞纯函数） |
| **OQ4**（新） | caller-scope 缺陷何时修 | **c0 第一步修**（独立于重构，数据正确性最高优先；是 already-merged 缺陷） |

## ⚠️ 高风险警告（antig-opus + 作者共识）

**F215 relay（`:1136`）是 7 轮 review 的产物，guard 条件极脆**（`:1131-1132` 的 `worklist[index+1..]` pending-only check）。并入 `resolveNextCats` 时**必须逐字保留这个 pending-only 语义**——这正是作者本 thread 反复犯的「改契约漏消费方」高发区。Phase B 改这里必须先 grep 全部 relay guard 消费方 + 全跑 F215 16 测试。

## Eval / Tracking Contract（F192）

- **Primary Users**: 所有走 A2A 串行路由的猫（全部跨猫协作）
- **Activation Signal**: routeSerial 路由决策正确率（mention/relay/callback 三场景各触发一次无 edge-case）
- **Friction Metric**: 路由相关 feature 的 review 轮次（F215=7 轮、coalesce=本次多轮——重构后应显著下降）
- **Regression Fixture**: F215 16 测试 + a2a-coalesce/callback-a2a-trigger/pingpong/postmsg 全量 route 测试
- **Sunset Signal**: 重构后路由 feature review 轮次没降 / edge-case 反增 → 坐标系选错，回退重设计

## 核验签收

| 维度 | 作者（宪宪/Opus-4.8） | 核验（孟加拉/Opus-4.6） |
|------|---------------------|----------------------|
| 3 个 mutation 入口 | 提出 | ✅ 确认 + 抓出路径 3 是生产死代码 |
| 复杂度根源 | 误判为"异步 mutation" | ✅ 纠正为"3 条 inline guard 散布" + 作者已亲自证实 |
| 设计方向 | intent 队列 | ✅ 纠正为纯函数统一 guard（去掉多余的 intent 层） |
| OQ1/2/3 | — | ✅ 收敛：分 / 无 intent / D 并 B |
