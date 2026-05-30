---
feature_ids: [F216]
topics: [architecture, refactor, routing, design-gate]
doc_kind: discussion
created: 2026-05-30
---

# F216 Design Gate — routeSerial 决策层/执行层分离（现状洞察 + 设计方向）

> **类型**：架构级（分流：猫猫讨论 → 铲屎官拍板）
> **作者**：宪宪 / Opus-4.8（F216 owner）
> **核验请求**：@antig-opus（孟加拉猫底层 Opus；缅因猫族无猫粮，降级孟加拉做并发时序核验）
> **状态**：现状摸底完成，待独立核验 + 铲屎官拍板坐标系

## Architecture Ownership（F191）

- **Architecture cell**: `routing`
- **Map delta**: `update required` —— routeSerial 内部结构重画（决策层抽纯函数 + worklist mutation 单点化），owner/boundary 不变但 extension point 变化
- **Why**: 当前"加任何路由决策都笛卡尔积炸 edge case"的根因是结构问题，不是某个 bug

## 现状摸底（事实级，clean grep 验证）

routeSerial.ts = **2315 行单函数**，cognitive complexity 255（biome warning 豁免）。

### 纠正 spec 的关键发现：worklist 写入口是 3 个，不是 spec 说的"5 套路径"

spec 原文「5 套并行路由路径共享同一个可变 worklist」把"**读** worklist 做决策"的点也算进去了。实际 **写** 入口只有 3 个：

| # | 位置 | 时机 | 性质 |
|---|------|------|------|
| 1 | `route-serial.ts:1777` `worklist.push(nextCat)` | 循环内 | **同步**，inline-mention text-scan A2A 扩展 |
| 2 | `route-serial.ts:1136` `worklist.push(relay46CatId)` | 循环内 | **同步**，F215 malformed relay（46 接力） |
| 3 | `WorklistRegistry.pushToWorklist`（registry 持 `list: worklist` 引用） | 异步外部 | **跨边界异步**，callback A2A 从 `callback-a2a-trigger` 往同一数组 push |

### 真正的复杂度根源（不是"5 套路径"）

**第 3 个入口是脆弱性的真因**：`registerWorklist` 把 routeSerial 的 `worklist` 数组**引用**存进 registry（`WorklistEntry.list = worklist`，同一对象）。callback-a2a-trigger 在**异步外部**通过 `pushToWorklist` 往这个**正在被同步 `while (index < worklist.length)` 循环消费**的数组里 push —— **无锁共享可变状态，跨同步/异步边界**。

这就是「加路由决策笛卡尔积炸 edge case」的物理来源，也是我修 coalesce bug 时撞的同一个 abort-resume 时序雷区的同源（coalesce 的 supersede 难，正因为 worklist 这种跨边界共享让 abort 时序无处安放）。

### 附带结构债（Phase A 一并消除）

- **2 处 handoff-emit 循环**（`:1892` 和 `:2134`，`for (let wi = handoffEmitted; ...)`）—— 重复尾逻辑，应合一。
- **15+ 可变状态变量**在同一作用域（`yieldedFinalDone` / `handoffEmitted` / `malformedRelayPending` 等）互相影响。

## 设计方向（坐标变换，非堆补丁）

**不是** spec 原描述的"把 5 处 push 收敛到一处"（那是把同步的 2 处合并，没碰真问题）。

**真正的坐标变换 = 切断异步跨边界 mutation**：

```
现状（无锁共享可变数组）：
  callback-a2a-trigger ──async push──> worklist[] <──sync push── routeSerial loop
                                         ↑ 同一引用，无锁

目标（单点消费 + 意图队列）：
  callback-a2a-trigger ──投递意图──> pendingRoutingIntents (queue)
  routeSerial loop ──单点消费──> resolveNextCats(signal, ctx) → worklist.push
                                   ↑ 所有扩展决策收口到这个纯函数
```

- **决策层**：`resolveNextCats(signal, context, config) → CatId[]` 纯函数——inline-mention / relay / callback-intent 三种来源都先变成"意图"，由这个纯函数统一裁决（含 depth / dedup / ping-pong / coalesce-vs-supersede）。可独立单测。
- **执行层**：`while` 循环只做 `worklist.push(...resolveNextCats(...))` + invokeSingleCat + yield。worklist 不再被外部异步直接改。
- **callback 不再持 worklist 引用**：改投递 intent，循环在安全点消费 —— 这同时解掉 coalesce bug 的 supersede（Phase D），因为 abort 时序有了单一安放点。

## 渐进式 Phase（硬约束：一次改对坐标系，不堆补丁）

- **Phase A**：执行单元化——3 个 mutation 入口都返回"扩展清单"，`worklist.push` 收口到循环主体一处；2 个 handoff-emit 循环合一。**不改行为**，纯结构。F215 16 测试 + 全量 route 测试零回归。
- **Phase B**：决策/执行分离——抽 `resolveNextCats` 纯函数；切断 callback 的 worklist 引用，改 intent 投递。
- **Phase C**（conditional）：状态机化（Phase B 后评估，够了就不做）。
- **Phase D**：A2A supersede（coalesce bug 主场景）——在 Phase B 的单点消费坐标系上做，abort-resume 有了安放点。

## 给核验猫的攻击点（@antig-opus）

1. **"3 个 mutation 入口"判断对吗**？我是否漏了别的间接 worklist mutation（我这个 thread 反复栽"只看一处"，请独立 grep 核验：`worklist.push` / `pushToWorklist` / 任何 `.list.push` / 数组引用泄漏）。
2. **"切断异步 mutation"是真坐标变换还是我又在堆抽象**？intent 队列会不会只是把共享状态换了个地方？
3. **Phase A "不改行为纯结构" 可行吗**？还是 worklist 的同步/异步共享本身就让"纯结构重构"不可能、必须连行为一起改（那 Phase A/B 就不该分）。
4. **F215 relay（line 1136）那条路径**最脆，重构时最容易破——你觉得它该并进 resolveNextCats 还是单独保留？

## Open Questions（待铲屎官拍板坐标系）

- OQ1: Phase A/B 分还是合？（取决于核验猫对攻击点 3 的判断）
- OQ2: intent 队列 vs 直接重构 worklist 消费——哪个更"数学美"少堆项？
- OQ3: Phase D supersede 是并进 Phase B 一起做，还是 B 完成后单独 Phase？

## Eval / Tracking Contract（F192，harness 类必填）

- **Primary Users**: 所有走 A2A 串行路由的猫（即全部跨猫协作）
- **Activation Signal**: routeSerial 路由决策正确率（mention/relay/callback 三路由场景各触发一次无 edge-case 错误）
- **Friction Metric**: 路由相关 feature 的 review 轮次（F215 是 7 轮、coalesce 是本次多轮——重构后应显著下降）
- **Regression Fixture**: F215 16 测试 + a2a-coalesce/callback-a2a-trigger/pingpong/postmsg 全量 route 测试
- **Sunset Signal**: 若重构后路由 feature review 轮次没下降 / edge-case 反增 → 坐标系选错，回退重新设计
