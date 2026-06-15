# F233 Phase B: 球权事件流 + 死球心跳 + 睡美人探针 Implementation Plan

**Feature:** F233 — `docs/features/F233-ball-custody-observability.md`
**Goal:** 把 Phase A 的「投影时启发式分类」升级为「事件驱动结构化观测」——一条 append-only 球权事件流成为简报的单一账本（向前生效），死球/搁置/虚空/hold/睡美人全部结构化判定，不再靠 mention 推断。
**Acceptance Criteria（逐条抄自 feat doc）:**
- **AC-B1**: 复现「invocation 中途死亡」，死球在下一次简报被点名，含最后扫描点。
- **AC-B2**: blocked task 带 probe + resolve 字段，探针满足后：`completes` 自动完结、`bounces_back` owner 收到**真实唤醒投递**（Repo Inbox 同型红→绿）。
- **AC-B3**: 球权状态转移表 + 不变量有测试覆盖（含 crash / 并发 / 重复探针对抗场景）。
**Architecture cell:** `ball-custody`（new）
**Map delta:** new cell required（照 `community-ops` event-log + projector + ingest，OQ-6 已决）
**Architecture:** `BallCustodyEventLog`（Redis LIST + Lua 幂等 append）→ **ingest 层**（`appended:true` 时做 best-effort 外部副作用：唤醒投递，照 `community-auto-tracking`）→ `BallCustodyProjector`（`transition()` 纯函数 + 幂等 store 写，**零外部副作用**，rebuild=replay）→ 简报读 projection。事件由现有系统动作旁路写入，零猫侧手动义务（KD-2）。
**Tech Stack:** TypeScript / Redis (ioredis) / Fastify / Vitest
**前端验证:** No（数据层；简报卡 Phase A 已有，只切数据源）。

> **修订史**：
> **R1**（砚砚）：副作用移 ingest / 停表 / 新增 blocked / 删 ball.passed。
> **R2**（砚砚，换层系统 audit）：全 event 转移表 + INV-10 穷举 / blockedEpoch / WakeOutbox+wake_pending。
> **R3**（**坐标系 pivot，砚砚验证**）：R1→R3 三轮复杂度螺旋的根因 = **把 best-effort 唤醒过度设计成 exactly-once 引擎**，越过 KD-4「只读观测先行，不做 workflow engine」。spec 只硬要求 ① 真实唤醒投递（AC-B2）② 重复可容忍可收紧（friction metric / 60 天 sunset）。**砍掉** `wake_pending`/`woken`/`ball.woken`/`WakeOutbox`/`blockedEpoch`/crash 矩阵一整套；唤醒改 **best-effort + per-blocked-episode cooldown 去重 + 简报兜底**。砚砚卡点修正：去重锚点用 `blockedSinceAt`（episode identity，非"按天"），防吞跨 episode 第二次合法唤醒。

---

## Straight-Line Check（A→B，不绕路）

**Finish line**：简报横切从「扫 5 源 + 启发式」改为「读球权 projection」；死球/虚空/hold/blocked/睡美人全部结构化事件判定；blocked 探针满足后 `completes` 完结 / `bounces_back` **best-effort 唤醒 owner**（同 episode cooldown 内不重复，漏了简报兜底）。
**NOT building**：① 球 ID 新原语（KD-1）② workflow engine / 自动转派 / **exactly-once 唤醒事务**（KD-4）③ Phase C（安乐死 / 轨迹 / 历史回填）。

**Terminal schema**：

```ts
interface BallCustodyEvent {
  sourceEventId: string;   // 幂等键，规范见 §F
  subjectKey: string;      // `ball:thread:{threadId}` | `ball:task:{taskId}`（KD-1 派生）
  kind: BallEventKind;
  classification: 'state-changing' | 'informational';
  payload: Record<string, unknown>;
  at: number;
}

type BallEventKind =            // 全 13 种，每种在 §B 转移表必有一行（INV-10）
  | 'ball.handed' | 'ball.handed_cvo' | 'ball.void_pass'
  | 'ball.held' | 'ball.hold_expired'
  | 'invocation.started' | 'invocation.heartbeat' | 'invocation.died'
  | 'task.blocked' | 'task.unblocked' | 'task.idle_long' | 'task.done'
  | 'ball.wake_sent';           // informational：唤醒已发，更新 lastWakeAt，不改 state（仅 blocked 接受）
// probe 判定是 ProbeScheduler 内部行为（§C），不入事件流——结果落成 task.done(completes) 或 ball.wake_sent(bounces_back)。

type BallState =                // 全 7 种（R3 删 wake_pending/woken）
  | 'active'        // 正常推进（含 hold 持球，heldUntil 可选）
  | 'blocked'       // task 阻塞等 probe；简报按 ageMs 分 needsUser/staleBlocked；bounces_back 唤醒后**仍 blocked**
  | 'parked'        // handoff 给 CVO 晾龄
  | 'dead'          // invocation 死 / hold 过期，无心跳
  | 'void'          // 虚空传球
  | 'zombie'        // 长期放弃
  | 'resolved';     // 终态：task.done / (Phase C)安乐死

interface BallCustodyProjection {
  subjectKey: string;
  state: BallState;
  holder: string | null;                 // catId 或 'cvo'
  intent: 'handoff' | 'fyi' | 'done_notify' | null;
  resolveMode: 'completes' | 'bounces_back' | null;
  blockedSinceAt: number | null;         // 进入当前 blocked episode 的时刻（= 该次 task.blocked 的 at）——episode identity  ← R3
  lastWakeAt: number | null;             // 当前 episode 最近唤醒时刻；task.blocked(新episode) 清空，ball.wake_sent 更新  ← R3
  lastStateChangeAt: number;             // 晾龄基准（ageMs 纯派生）
  lastEventAt: number;
  lastScanAt: number | null;             // 死球最后扫描点（AC-B1）
  appliedEventCount: number;
  lastRejectedEvent: BallCustodyEvent | null;
  createdAt: number; updatedAt: number;
}
```

---

## Stateful Object Gate — Census（F229 🔴）

| # | 对象 | lifecycle owner | 旁路禁忌 | § |
|---|------|------|------|------|
| 1 | BallCustodyEventLog | `eventLog.append()` Lua | flush/delete 禁触 `ballcustody:*`（TTL=0 铁律#5）| 照 community |
| 2 | BallCustodyProjection | `projector.apply()`（**零外部副作用**）| 只读消费；generic delete 仅 rebuild | §B |
| 3 | ProbeScheduler（消费侧）| scheduler tick | probe 只读不改 task；cooldown 控唤醒频率 | §C |
| 4 | WakeSender（best-effort 副作用）| ingest `appended:true` | rebuild 不触；per-episode cooldown 去重 | §E |

---

### §B 对象 2：状态机（核心，AC-B3）

**转移规格表（全 13 event 显式；未出现的 (state,event) = reject 不改 state；INV-10 穷举钉死 13×7=91 格）**：

| event | from states | → to | 备注 |
|---|---|---|---|
| `ball.handed` | 任何（含 resolved=reopen）| active(换 holder) | holder 变更，球继续 |
| `ball.handed_cvo` | active/blocked/parked/void/zombie/new | parked\|—\|resolved | handoff→parked / fyi→informational不改 / done_notify→resolved |
| `ball.void_pass` | active/blocked/parked/new | void | F167 守卫 |
| `ball.held` | new/active | active(heldUntil=fireAt) | 持球等外部，仍健康（Phase A activeCount）|
| `ball.hold_expired` | active(heldUntil≠null) | dead(detail=hold-expired) | Phase A expired hold→deadBalls |
| `invocation.started` | active/blocked | active | |
| `invocation.heartbeat` | active→active(续) ; dead→active† | | †迟到心跳复活：died.at < hb.at ≤ died.at+`DEAD_BALL_ZOMBIE_GRACE_MS`(600s) |
| `invocation.died` | active/blocked | dead(lastScanAt) | F194/F212 |
| `task.blocked` | active/new/void/zombie/parked | blocked(blockedSinceAt=at, **清 lastWakeAt**) | 新 episode 重置唤醒去重锚 |
| `task.unblocked` | blocked/zombie | active | owner ack / 外部满足 |
| `task.idle_long` | active/blocked/parked/void | zombie | 长期无活动 |
| `task.done` | 任何 | resolved | 唯一正常终结（probe completes 也走这条）|
| `ball.wake_sent` | blocked→blocked(更新 lastWakeAt) ; 其它→informational ignore | | best-effort 唤醒已发的记录（不改 state）|

> **probe 不入事件流**（§C）：ProbeScheduler 判 satisfied&completes → append `task.done`；satisfied&bounces_back → §E 发唤醒 → append `ball.wake_sent`。**球全程留 blocked**，简报照显（R3-1 黑洞根除：没有 wake_pending/woken 这种简报盲区状态）。

**blocked → 简报区映射（纯投影 selector，复用 Phase A `constants.ts`）**：`1d ≤ ageMs ≤ 7d` → `needsUser`🔴；`>7d` → `staleBlocked`💤。active(held)→healthy；void→voidPass；dead(含 hold_expired)→deadBalls。**切源后 Phase A 全 signal 有状态，零回归**（R2-1 已闭环，R3 未动此部分）。

**不变量（INV-N）**：
- **INV-1** append-only：永不删/改，replay 唯一终态。
- **INV-2** 无漂移：删 projection + rebuild 逐字段相同（含 lastWakeAt 由 ball.wake_sent 重建）。
- **INV-3** 幂等去重：同 sourceEventId 二次 append→`appended:false`。
- **INV-4** 结构化替代推断：dead/void/blocked 必由结构化事件产生，不接受 mention 启发式。
- **INV-5** resolved 准终态：仅接受 ball.handed(reopen)/informational，其它 reject。
- **INV-6**（**best-effort 唤醒，R3 改**）：`bounces_back` 唤醒是 best-effort——同一 blocked episode（`blockedSinceAt` 不变）内，仅当 `lastWakeAt==null` 或 `now-lastWakeAt>WAKE_COOLDOWN_MS` 才发；发在 ingest（`appended:true`），rebuild 不重发；漏发由每日简报兜底。*测* 同 episode N tick → cooldown 内仅 1 次；跨 episode（task.unblocked→blocked 清 lastWakeAt）→ 第二次可发（**砚砚卡点**）；rebuild 无新投递。
- **INV-7** CVO intent 三态：fyi 不产搁置球；done_notify→resolved。
- **INV-8** 死球留痕：died→lastScanAt 非空。
- **INV-10**（**完整性**）：全 13 event × 7 state = **91 格**穷举测试，每格转移 or 显式 reject，断言无未定义。

**对抗场景（每个一测）**：
1. crash window：append 成功 apply 前 crash → rebuild 恢复。
2. 并发双写：同 subjectKey 并发 → Lua + sourceEventId 去重。
3. 重复探针：同 episode 多 tick satisfied → cooldown 去重，**N tick → cooldown 内 1 次唤醒**（不靠 epoch counter，靠 lastWakeAt+cooldown）。
4. 跨 episode 唤醒（**砚砚卡点**）：task 两轮 blocked（中间 unblocked 清 lastWakeAt）→ 第二轮独立可唤醒，不被吞。
5. 死球迟到心跳：died 后 hb，按 `DEAD_BALL_ZOMBIE_GRACE_MS`(600s) 判真复活 vs 噪音。

---

### §C ProbeScheduler（blocked 探针，**不停表**）

`idle → registered(task.blocked) → probing(每 tick)`；`task.unblocked`/`task.done` → deregister。每 tick 对 blocked 球跑 probe：
- satisfied & completes → append `task.done` → resolved → deregister。
- satisfied & bounces_back → 交 §E WakeSender（cooldown 判 + best-effort 发）。**球留 blocked，继续 registered**（cooldown 控频率，不停表——R3 删停表概念）。
- unsatisfied → 留 registered。
- **INV-P1** probe 只读（curl GET / reachability / redis EXISTS），不改 task、不调 reconcile（KD-4）。
- **INV-P2** probe 白名单 enum（OQ-4），非白名单拒绝 + 记降级。
- **对抗**：scheduler crash → 从 blocked projection 重建登记表（无独立持久态）。

---

### §E WakeSender（best-effort 副作用，R3 替代 outbox）

照 `community-auto-tracking:9-13`：外部投递只在 ingest（`eventLog.append` 返回 `appended:true`）做，**绝不放 projector.apply()**，rebuild replay（`appended:false`）不重发。

**唤醒流（bounces_back，best-effort，无 exactly-once）**：
```
ProbeScheduler 判 satisfied&bounces_back
  → 读 projection：若 lastWakeAt==null 或 now-lastWakeAt>WAKE_COOLDOWN_MS   [per-episode cooldown 去重]
      → deliverWake(ownerThreadId)                                          [真实投递，AC-B2；失败仅 log]
      → append ball.wake_sent(informational, at=now)
      → projector.apply → lastWakeAt=now（state 不变，仍 blocked）
  → 否则 skip（cooldown 内已唤醒过）
```
**为什么不要 exactly-once**：① 漏发（send 失败 / crash）→ 下个 tick 同 episode 过 cooldown 自动重试 + 每日简报兜底 ② 偶尔重发（cooldown 边界 / rebuild 后首 tick）→ spec friction metric「无效打扰 ≥3 次收紧」已容忍。`WAKE_COOLDOWN_MS` 进 `constants.ts`（默认建议 12h，OQ）。

---

### §F sourceEventId 幂等键规范

| event | sourceEventId |
|---|---|
| ball.handed / handed_cvo / void_pass | `route:{messageId}` |
| ball.held / hold_expired | `hold:{threadId}:{catId}:{fireAt}` / `holdexp:{…}:{fireAt}` |
| invocation.* | `inv:{invocationId}:started\|hb:{draftUpdatedAt}\|died` |
| task.blocked/unblocked/idle_long/done | `task:{taskId}:blocked:{blockedSinceAt}` / `:unblocked:{at}` / `:idle:{at}` / `:done` |
| ball.wake_sent | `wake:{taskId}:{blockedSinceAt}:{at}`（at 唯一标识这次唤醒；发频率由 §E `lastWakeAt` 滑动窗口控，故 sourceEventId 只需唯一、不再叠固定槽去重——避免两套去重打架）|

> `blockedSinceAt` 是 `task.blocked` 事件的 `at`（**有持久来源 = 事件时刻**，R3-2 闭环：不再需要凭空的 epoch counter）。

---

## Tasks（TDD，red→green→commit）

### Task 1: ball-custody cell 骨架
- **Create** `packages/api/src/domains/ball-custody/`：`BallCustodyEventLog.ts`、`ball-custody-state-machine.ts`（§B 全规格）、`BallCustodyProjector.ts`（零副作用）、`WakeSender.ts`（§E）、`ball-custody-keys.ts`、`BallCustodyProjectionStore.ts`；types→`packages/shared/src/types/ball-custody.ts`；`WAKE_COOLDOWN_MS`→`duty-briefing/constants.ts`
- **Test** state-machine（**INV-10 穷举 91 格** + INV-1~8）、eventlog-redis（**Redis-backed**）
- **Arch doc** `docs/architecture/ownership/ball-custody.md`

### Task 2: 事件写入接线（全 13 event 源）
- **Modify** 路由层（`a2a-mentions.ts` + F167 forced-pass guard）→ handed/handed_cvo/void_pass；hold_ball → held/hold_expired；task 状态机 → blocked/unblocked/idle_long/done；invocation lifecycle → started/heartbeat/died
- **语义**：`ball.handed`=holder 变更球继续；`task.done`=唯一正常终结；接/退/升回执=统计 @ 后有无后续 `ball.handed*`/`held`
- **Test** 各源「真动作→事件落账」+ grep consumer

### Task 3: 死球心跳（AC-B1）— invocation.died 含 lastScanAt（复用 F194/F212）

### Task 4: probe + resolve + WakeSender（AC-B2；§C/§E）
- **Modify** task schema 加 `probe`(白名单)+`resolveMode`；ProbeScheduler 入统一 scheduler；WakeSender best-effort（无 outbox）
- **Test** Repo Inbox fixture bounces_back→唤醒（INV-6）；同 episode cooldown 内 N tick 1 次（对抗 3）；**跨 episode 第二次独立唤醒**（对抗 4，砚砚卡点）；rebuild 不重投；completes→task.done→resolved

### Task 5: 简报数据源切换（5 源→projection，零回归）
- **Modify** `collectDutyBriefingInput`→读 `BallCustodyProjectionStore`；blocked→needsUser/staleBlocked；active(held)→healthy；void→voidPass；hold_expired→dead；接 F167 snapshot
- **Test** 新旧简报对比：dead 收敛、void 非 0、**needsUser/staleBlocked/activeCount 不归零**；冷启动 mention fallback

### Task 6: 不变量回归套（AC-B3）— §B 5 对抗 + INV-1~8/10 + §C INV-P1~2，Redis-backed

---

## Open Questions

**技术 OQ（自决预决议）**：OQ-2 intent=路由推断兜底+MCP / OQ-4 probe 白名单禁 shell / OQ-5 spend_limit 同根因聚合 / subjectKey=thread 主轨+task 细分 / 写入=hook / **WAKE_COOLDOWN_MS 默认 12h**（friction 调）。
**价值 OQ（→CVO）**：无新增（纯数据层 + 只读切源 + best-effort 唤醒可逆）。

---

## 我最可能错在哪（pre-register，R3 pivot 后）

> R3 砍掉 exactly-once 引擎、换 best-effort + per-episode cooldown（砚砚验证坐标系 + 卡点已纳入）。剩余风险：
1. **subjectKey 粒度**（CVO 产品视角，砚砚三轮未攻）：thread 单轨 vs 多球并行。
2. **WAKE_COOLDOWN_MS 取值**：12h 是拍的——太短 owner 被频繁提醒（friction），太长睡美人醒得慢。靠 friction metric 实测调。
3. **ball.wake_sent 在非 blocked state 的 ignore 语义**：INV-10 第 91 格里 wake_sent×{active/parked/dead/…} 都 ignore，但理论上 wake_sent 只该在 blocked 产生——若实现误在其它 state append，是静默吞还是该报？倾向 informational ignore（不污染），但请 review 判。
> （原第 4 条「wakeSlot 固定槽 vs 滑动窗口」我自审时发现与 §E 滑动窗口打架，已自决统一为滑动窗口 + at-唯一 id，见 §F。）
