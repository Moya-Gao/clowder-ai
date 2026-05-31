# F216 routeSerial 重构 Implementation Plan

**Feature:** F216 — `docs/features/F216-route-serial-refactor.md`
**Goal:** 把 routeSerial（2315 行）散在 3 处的路由 guard 统一进可单测的决策函数 + 修 supersede（coalesce bug 主场景）
**Architecture cell:** `routing`
**Map delta:** update required（routeSerial 内部 extension point 变化，owner/boundary 不变）
**Map delta why:** 抽决策层 + worklist mutation 单点化，改 extension point 不改 ownership
**Architecture:** 决策（纯读，算 RoutingDecision[]）/ 副作用（执行层 apply：push/streak-mutate/span/yield）分层。决策函数只读状态算决策，所有 mutation 留执行层。
**Tech Stack:** TypeScript, node:test
**前端验证:** No（纯后端路由层）

**交付形态（铲屎官 directive + 砚砚 refine）：一个 PR，内部 commit 分层 c0-c3。main 不留半成品。**

## Acceptance Criteria（从 feat doc + 三方核验收敛）

- AC-D5/c0 ✅ DONE（commit 8779c23c6）：findInFlightAgentEntry/coalesce 加 callerCatId scope，防跨 caller 串味
- c1：抽 `resolveRoutingDecisions` 决策函数（统一 direct/relay guard），worklist mutation 收口
- c2：统一 deferred 路径 guard + 删 legacy worklist 死代码
- c3：supersede（processing 时 abort+restart）执行层 helper + 测试
- 全程：F215 16 测试 + 全量 route 测试零回归；保 await 点

## ⚠️ 关键设计约束（写代码前必须内化，否则栽）

### 约束 1：streak 不是纯的 —— 决策/副作用边界比 Design 文档画的细
`updateStreakOnPush`（WorklistRegistry.ts:129）**mutate `entry.streakPair`**（count++/reset）。所以：
- **决策函数只读**：算"如果 push 这只猫，streak 会 block 吗" —— 但**不能**真调 updateStreakOnPush（它有副作用）。
- 方案：决策函数返回 `{ action: 'enqueue', cat, willMutateStreak: true }`；执行层 apply 时才调 updateStreakOnPush（mutate）+ 处理 block 的 yield。
- **不要**把 updateStreakOnPush 塞进"纯"函数（砚砚 P1：否则纯函数变上帝函数 + 有副作用名不副实）。

### 约束 2：保 await 点（砚砚硬约束）
两处 `worklist.push`（:1136 relay / :1777 inline）本身不在 await 表达式里（已 grep 证实）。改成"决策+执行层 apply"**不得移动**前后的 await（:763 invokeSingleCat / :1973 messageStore.append）。

### 约束 3：F215 relay guard 极脆（7 轮 review 产物）
:1131-1134 的 `!worklist.slice(index + 1).includes(relay46CatId)` 是 pending-only check。统一进决策函数时**逐字保留** —— 这是我这 thread「改契约漏消费方」最高发区。改前 grep 全部 relay guard 消费方 + 全跑 F215 16 测试。

### 约束 4：caller-scope 已在 c0 落地
c0 已给 findInFlightAgentEntry 加 callerCatId。c1-c3 复用，不重做。

## Terminal Schema（砚砚收敛，决策返回 enum 不做副作用）

```typescript
// 新文件 routing/routing-decision.ts
export type RoutingSignal =
  | { type: 'inline_mention'; cats: CatId[]; content: string; callerCatId: CatId }
  | { type: 'relay_malformed'; cat: CatId; callerCatId: CatId }
  | { type: 'deferred'; cats: CatId[]; content: string; callerCatId: CatId };

export type RoutingDecision =
  | { action: 'enqueue_worklist'; cat: CatId }       // 执行层 push + streak mutate + span
  | { action: 'defer_queue'; cat: CatId }            // 执行层 deferA2AEnqueue
  | { action: 'mark_replyto'; cat: CatId }           // pendingTail 命中：只设 a2aFrom/triggerMsg，不 push
  | { action: 'skip'; cat: CatId; reason: 'depth' | 'dedup_active' | 'aborted' | 'queue_pending' }
  | { action: 'block_pingpong'; cat: CatId; pairCount: number };  // 执行层 yield a2a_pingpong_terminated

// 纯读输入（不 mutate）：worklistEntry 状态快照 + config
export interface RoutingContext {
  a2aCount: number; maxDepth: number; aborted: boolean; queuedMessagesPending: boolean;
  pendingTail: readonly CatId[]; pendingOriginalTargets: readonly CatId[];
  hasActiveAgent: (cat: CatId) => boolean;
  // streak 预判：纯读 streakPair 现状算 would-block，不 mutate（mutate 在执行层）
  peekStreak: (callerCatId: CatId, target: CatId, substantive: boolean, outputLen: number) => { wouldBlock: boolean; count: number };
}
export function resolveRoutingDecisions(signal: RoutingSignal, ctx: RoutingContext): RoutingDecision[];
```

> `peekStreak` 是关键：纯读版的 streak 预判（不 count++）。需要 WorklistRegistry 加一个 `peekStreakOnPush`（只读 samePair 逻辑，不写）配对现有 `updateStreakOnPush`。执行层 apply `enqueue_worklist`/`block_pingpong` 时才调真正的 `updateStreakOnPush`（mutate）。

## c1 实施步骤（tests-first，小步）

### Task c1.1: peekStreakOnPush 纯读函数
- **Files**: Create test `test/routing-decision-streak.test.js`; Modify `WorklistRegistry.ts`
- Step 1: 写失败测试——peekStreakOnPush 算 wouldBlock 但不 mutate entry.streakPair（断言调用前后 count 不变）
- Step 2: 跑确认红（函数不存在）
- Step 3: 抽 samePair/threshold 判断为纯读 peekStreakOnPush（updateStreakOnPush 复用它 + 再 mutate）
- Step 4: 跑绿 + 现有 pingpong 测试零回归
- Step 5: commit (amend 进 c1 或独立 c1.1)

### Task c1.2: resolveRoutingDecisions 纯函数 + 单测
- **Files**: Create `routing/routing-decision.ts` + `test/routing-decision.test.js`
- Step 1-N: 逐个 decision 分支写失败测试（depth skip / dedup_active skip / pendingTail mark_replyto / block_pingpong / enqueue_worklist），每个先红后绿
- 覆盖 inline_mention + relay_malformed 两个 signal（relay 的 pending-only guard 逐字搬，约束 3）

### Task c1.3: routeSerial 执行层接线 inline-mention
- **Files**: Modify `route-serial.ts:1703-1797`
- 把 :1703-1797 整段换成：`const decisions = resolveRoutingDecisions({type:'inline_mention',...}, ctx)` + for decision apply（push/updateStreakOnPush/span/yield）
- **保 await 点**（约束 2）；**保 span 懒创建语义**
- 跑全量 route 测试零回归（不是新测试——行为不变）

### Task c1.4: routeSerial 执行层接线 relay
- 把 :1126-1150 relay 块换成 resolveRoutingDecisions({type:'relay_malformed',...}) + apply
- F215 16 测试零回归（约束 3）

## c2 步骤（统一 deferred + 删死代码）
- Task c2.1: deferred 路径（:1798）接 resolveRoutingDecisions({type:'deferred'})
- Task c2.2: 删 callback-a2a-trigger legacy worklist path（:295 之后，生产死代码——Design 文档已证实 invocationQueue 恒注入）。grep 确认无非测试调用方后删 + WorklistRegistry.pushToWorklist 若仅 legacy 用则一并删
- 全量零回归

## c3 步骤（supersede 执行层）
- Task c3.1: 写失败测试——processing 中的 target 收到同 caller 同 turn follow-up → abort 正在跑的 + 用 follow-up 重启
- Task c3.2: supersede 执行层 helper（复用 force-send 已验证的 cancelInvocation+clearPause+releaseSlot，messages.ts:635-666 模式）。**副作用走 InvocationQueue/QueueProcessor/InvocationTracker，不进 resolveRoutingDecisions**（砚砚 OQ3）
- Task c3.3: findInFlightAgentEntry 返回 processing entry 时，决策返回 `supersede_processing`；执行层 apply 调 helper
- 真实 runtime 验证（LL-064）：猫连发两条矛盾 handoff，目标猫只执行最终意图

## 完成后
- 自检 quality-gate → 跨族 review（砚砚 GPT-5.5 回家了，跨族首选）→ merge-gate（一个 PR squash）
- F216 spec AC-D1~D7 打勾 + Phase D close

## Open Questions（技术 OQ，实现中自决；无价值 OQ 需 CVO）
- OQ-tech-1: peekStreak/updateStreak 拆分会不会让 WorklistRegistry 测试改动过大？c1.1 实测，若超预期回退为"决策函数接受 streak 预判结果作参数"
- OQ-tech-2: c2 删 legacy path 前必须 grep 确认 pushToWorklist 无生产调用方（callback 已走 InvocationQueue）—— 若有意外调用方，降级为标 deprecated 不删
