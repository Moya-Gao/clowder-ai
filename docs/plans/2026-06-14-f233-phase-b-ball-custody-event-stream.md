# F233 Phase B: 球权事件流 + 死球心跳 + 睡美人探针 Implementation Plan

**Feature:** F233 — `docs/features/F233-ball-custody-observability.md`
**Goal:** 把 Phase A 的「投影时启发式分类」升级为「事件驱动结构化回执」——一条 append-only 球权事件流成为简报与轨迹的单一账本（向前生效），死球/搁置/虚空/hold 全部结构化判定，不再靠 mention 推断。
**Acceptance Criteria（逐条抄自 feat doc）:**
- **AC-B1**: 复现「invocation 中途死亡」，死球在下一次简报被点名，含最后扫描点。
- **AC-B2**: blocked task 带 probe + resolve 字段，探针满足后：`completes` 自动完结、`bounces_back` owner 收到真实唤醒投递（Repo Inbox 同型红→绿）。
- **AC-B3**: 球权状态转移表 + 不变量有测试覆盖（含 crash / 并发 / 重复探针对抗场景）。
**Architecture cell:** `ball-custody`（new）
**Map delta:** new cell required（照 `community-ops` event-log + projector + ingest，OQ-6 已决）
**Architecture:** `BallCustodyEventLog`（Redis LIST + Lua 幂等 append）→ **ingest 层 + outbox**（`appended:true` 触发外部副作用 + crash retry，照 `community-auto-tracking`）→ `BallCustodyProjector`（`transition()` 纯函数 + 幂等 store 写，**零外部副作用**，rebuild=replay）→ 简报读 projection。事件由现有系统动作旁路写入，零猫侧手动义务（KD-2）。
**Tech Stack:** TypeScript / Redis (ioredis) / Fastify / Vitest
**前端验证:** No（数据层；简报卡 Phase A 已有，只切数据源）。

> **修订史**：
> **R1**（砚砚 review）：① 副作用移 ingest ② bounces_back 停表 ③ 新增 blocked 状态 ④ 删 ball.passed。
> **R2**（砚砚 review，**换层：补锅匠→系统 audit**）：R1 三条只修表面没修透（同类复发）。本轮对状态机做**完整性/幂等性/crash 安全**三维系统审计：① **转移表全 13 event 显式规格 + 穷举不变量 INV-10**（修 void/held/hold_expired 漏列）② **§F sourceEventId 规范 + blockedEpoch 统一**（修跨轮去重吞没）③ **§E outbox + wake_pending 中间态 + 顺序不变量**（修 crash-after-send 矛盾）。

---

## Straight-Line Check（A→B，不绕路）

**Finish line**：简报横切从「扫 5 源 + 启发式」改为「读球权 projection」；死球/虚空/hold/blocked 全部结构化事件判定；blocked 探针满足后按 `resolve` 二态完结或**真实唤醒一次**（停表）。
**NOT building**：① 球 ID 新原语（KD-1，subjectKey 派生）② workflow engine / 自动转派（KD-4）③ Phase C（安乐死 / 轨迹纵切 / 历史回填）。

**Terminal schema**：

```ts
interface BallCustodyEvent {
  sourceEventId: string;   // 幂等键，规范见 §F（稳定 + 跨轮可分 + 同次去重）
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
  | 'probe.evaluated';
// 注：ball.woken 是 outbox 内部确认事件（§E），不在外部事件 enum——它只由 outbox 在 send 成功后写。

type BallState =                // 全 9 种
  | 'active'        // 正常推进（含 hold 持球等外部，heldUntil 可选）
  | 'blocked'       // task 阻塞等 probe（blockedEpoch 计数）；简报按 ageMs 分 needsUser/staleBlocked
  | 'parked'        // handoff 给 CVO 晾龄
  | 'wake_pending'  // bounces_back probe 满足，唤醒投递未确认（outbox retry 中）  ← R2 新增
  | 'woken'         // 唤醒已确认待 owner ack（停表）
  | 'dead'          // invocation 死 / hold 过期，无心跳
  | 'void'          // 虚空传球
  | 'zombie'        // 长期放弃
  | 'resolved';     // 终态

interface BallCustodyProjection {
  subjectKey: string;
  state: BallState;
  holder: string | null;                 // catId 或 'cvo'
  intent: 'handoff' | 'fyi' | 'done_notify' | null;
  resolveMode: 'completes' | 'bounces_back' | null;
  blockedEpoch: number;                  // task 第几次进 blocked（每 task.blocked +1）——跨轮幂等基准  ← R2 新增
  heldUntil: number | null;              // hold 球的 fireAt（hold_expired 判据）
  lastStateChangeAt: number;             // 晾龄基准（ageMs 纯派生）
  lastEventAt: number;
  lastScanAt: number | null;             // 死球最后扫描点（AC-B1）
  wakeMessageId: string | null;          // outbox 唤醒投递的 messageId（INV-6 可查）
  appliedEventCount: number;
  lastRejectedEvent: BallCustodyEvent | null;
  createdAt: number; updatedAt: number;
}
```

---

## Stateful Object Gate — Census（F229 🔴）

| # | 对象 | lifecycle owner | 旁路禁忌 | §  |
|---|------|------|------|------|
| 1 | BallCustodyEventLog | `eventLog.append()` Lua | flush/delete 禁触 `ballcustody:*`（TTL=0 铁律#5）| 照 community |
| 2 | BallCustodyProjection | `projector.apply()`（**零外部副作用**）| 只读消费；generic delete 仅 rebuild | §B |
| 3 | ProbeScheduler（消费侧状态机）| scheduler tick | woken/wake_pending 停表 | §C |
| 4 | WakeOutbox（外部副作用 + retry）| `appended:true` + wake_pending 扫描 | rebuild 不触；幂等键防重复通知 | §E |

---

### §B 对象 2：状态机（核心，AC-B3）

**转移规格表（全 13 event 显式；表中未出现的 (state,event) = reject 不改 state，记 `lastRejectedEvent`；INV-10 穷举钉死完整性）**：

| event | from states | → to | 备注 |
|---|---|---|---|
| `ball.handed` | 任何（含 resolved=reopen） | active(换 holder) | holder 变更，球继续 |
| `ball.handed_cvo` | active/blocked/parked/void/zombie/new | parked\|—\|resolved | intent: handoff→parked / fyi→informational不改 / done_notify→resolved |
| `ball.void_pass` | active/blocked/parked/new | void | F167 守卫 |
| `ball.held` | new/active | active(heldUntil=fireAt) | 持球等外部，仍健康（Phase A activeCount）|
| `ball.hold_expired` | active(heldUntil≠null) | dead(detail=hold-expired) | Phase A expired hold→deadBalls |
| `invocation.started` | active/blocked | active | holder 在跑 |
| `invocation.heartbeat` | active | active(续) ; dead→active† | †迟到心跳复活：died.at < hb.at ≤ died.at+`DEAD_BALL_ZOMBIE_GRACE_MS`(600s) |
| `invocation.died` | active/blocked | dead(lastScanAt=死前心跳) | F194 liveness / F212 |
| `task.blocked` | active/new/void/zombie/parked | blocked(blockedEpoch++) | **不落 active**（R1 修）|
| `task.unblocked` | blocked/woken/zombie | active(清 wakeMessageId) | owner ack 入口 |
| `task.idle_long` | active/blocked/parked/void | zombie | 长期无活动 |
| `task.done` | 任何 | resolved | 唯一正常终结 |
| `probe.evaluated(satisfied)` | blocked | resolved(completes) \| wake_pending(bounces_back) | bounces_back **不在此投递**（§E outbox 接管）|

> `ball.woken`（outbox 内部，§E）：`wake_pending → woken`（停表）。`probe.evaluated(unsatisfied)`：通常不产事件（probe 只在结果翻转 emit），留 blocked。

**blocked → 简报区映射（纯投影 selector，复用 Phase A `constants.ts`，P1-3 防丢红球）**：`NEEDS_USER_BLOCKED_MIN_MS(1d) ≤ ageMs ≤ STALE_BLOCKED_THRESHOLD_MS(7d)` → `needsUser`🔴；`> 7d` → `staleBlocked`💤。active(held) 球 → healthy.count（Phase A 一致）；void 球 → voidPass 区；dead 球（含 hold_expired）→ deadBalls 区。**切源后 Phase A 全部结构化 signal 有对应状态，零回归**。

**不变量（INV-N）**：
- **INV-1** append-only：事件永不删/改，replay 唯一终态。*测* append→读序列。
- **INV-2** 无漂移：删 projection + rebuild 得逐字段相同。*测* rebuild idempotence。
- **INV-3** 幂等去重：同 sourceEventId 二次 append→`appended:false`，projection 不变。*测* 并发双写。
- **INV-4** 结构化替代推断：dead/void/blocked 必由结构化事件产生，不接受 mention 启发式入 projection。*测* mention-only→不产。
- **INV-5** resolved 准终态：仅接受 ball.handed(reopen)/informational，其它 reject 不复活。*测* resolved 后喂 died→仍 resolved。
- **INV-6** 唤醒 effectively-once（§E）：bounces_back 真实投递由 outbox 做、幂等键去重、rebuild 不重投，确认后 wakeMessageId 非空。*测* rebuild 无新投递 + crash-after-send 不重复通知。
- **INV-7** CVO intent 三态：fyi 不产搁置球；done_notify→resolved。*测* 三 intent fixture。
- **INV-8** 死球留痕：died→lastScanAt 非空。*测*。
- **INV-9** woken 停表：wake_pending/woken 期间 ProbeScheduler 停 probe，至 task.unblocked。*测* woken 后 3 tick 零新唤醒。
- **INV-10**（**完整性，R2 新增**）：全 13 BallEventKind × 9 BallState 的笛卡尔积每格行为确定（转移 or 显式 reject），**穷举测试**遍历 117 格断言无未定义。*测* 参数化矩阵测试。
- **INV-11**（**跨轮幂等，R2 新增**）：同 task 跨轮 blocked（unblocked→blocked）的第二次 satisfied 用**不同** blockedEpoch → 不被去重吞没。*测* 两轮 blocked 同条件，断言两次独立 wake。

**对抗场景（每个一测）**：
1. crash window：append 成功 apply 前 crash → rebuild 恢复。
2. 并发双写：同 subjectKey 并发 → Lua + sourceEventId 去重。
3. 重复探针：同轮多 tick satisfied → 同 blockedEpoch 同 sourceEventId 去重 + wake_pending/woken 停表，**N tick → 恰 1 次唤醒**（不靠 tick）。
4. 跨轮唤醒（INV-11）：两轮 blocked 同条件 → blockedEpoch 区分 → 两次独立唤醒不吞。
5. 死球迟到心跳：died 后 hb，按 `DEAD_BALL_ZOMBIE_GRACE_MS`(600s) 判真复活 vs 噪音。
6. crash-after-send（§E）：见 §E crash 矩阵。

---

### §C ProbeScheduler

`idle → registered(task.blocked) → probing(tick) → {satisfied&completes: emit→deregister | satisfied&bounces_back: emit→转 wake_pending→停表 | unsatisfied: 留}`；`task.unblocked`/`task.done` → deregister。
- **INV-P1** probe 只读（curl GET / reachability / redis EXISTS），不改 task、不调 reconcile。
- **INV-P2** probe 白名单 enum（OQ-4），非白名单拒绝 + 记降级。
- **INV-P3** 停表：wake_pending/woken 球 deregister，至 task.unblocked 重 register。
- **对抗**：scheduler crash → 从 blocked projection + 事件流重建登记表（无独立持久态）。

---

### §E WakeOutbox（外部副作用 + crash 安全，R2 核心修）

**顺序不变量（钉死，不可乱序）**：
```
probe.evaluated(bounces_back) append(appended:true)
  → projector.apply → state=wake_pending          [纯状态，零投递]
  → [WakeOutbox 独立循环] 扫 wake_pending 球
  → deliverWake(ownerThreadId, 幂等键 wake:{taskId}:{blockedEpoch})   [外部副作用，at-least-once]
  → append ball.woken(payload:{messageId})
  → projector.apply → state=woken, wakeMessageId=…  [停表]
```
**crash 矩阵（证明不漏不重）**：

| crash 点 | 恢复后状态 | outbox 动作 | 结果 |
|---|---|---|---|
| apply(wake_pending) 前 | probe.evaluated 已落 → rebuild 得 wake_pending | 扫到 → send | 不漏 |
| send 前 | wake_pending 在 | 重 send | 不漏 |
| send 后 / ball.woken 前 | wake_pending 在 | 重 send，**幂等键命中→投递层不重复通知 owner** | 不重 |
| ball.woken 后 | woken（停表）| 不扫 | 终态 |

**effectively-once = outbox at-least-once + 投递层 `wake:{taskId}:{blockedEpoch}` 幂等去重**。projector 全程零外部副作用（rebuild 安全）。照 `community-auto-tracking:9-13`「副作用只在 appended:true，never projector.apply」。

---

### §F sourceEventId 幂等键规范（R2 新增，全事件统一）

原则：**唯一标识「这一次真实发生」——同次重复可去重，跨轮/跨实例可区分**。`blockedEpoch` 是跨轮基准（projection 维护，每 task.blocked +1）。

| event | sourceEventId |
|---|---|
| ball.handed / handed_cvo / void_pass | `route:{messageId}` |
| ball.held / hold_expired | `hold:{threadId}:{catId}:{fireAt}` / `holdexp:{…}:{fireAt}` |
| invocation.started/heartbeat/died | `inv:{invocationId}:started` / `:hb:{draftUpdatedAt}` / `:died` |
| task.blocked/unblocked/idle_long/done | `task:{taskId}:blocked:{blockedEpoch}` / `:unblocked:{blockedEpoch}` / `:idle:{blockedEpoch}` / `:done` |
| probe.evaluated | `probe:{taskId}:{blockedEpoch}:{conditionFingerprint}` ← **含 blockedEpoch 解 R2-2 跨轮吞没** |
| ball.woken（outbox） | `woken:{taskId}:{blockedEpoch}` |
| 投递层幂等键（owner 去重） | `wake:{taskId}:{blockedEpoch}` |

---

## Tasks（TDD，red→green→commit）

### Task 1: ball-custody cell 骨架
- **Create** `packages/api/src/domains/ball-custody/`：`BallCustodyEventLog.ts`、`ball-custody-state-machine.ts`（§B 全规格）、`BallCustodyProjector.ts`（零副作用）、`WakeOutbox.ts`（§E）、`ball-custody-keys.ts`、`BallCustodyProjectionStore.ts`；types→`packages/shared/src/types/ball-custody.ts`
- **Test** state-machine（**INV-10 穷举 117 格** + INV-1~11）、eventlog-redis（**Redis-backed**，非 in-memory）
- **Arch doc** `docs/architecture/ownership/ball-custody.md`

### Task 2: 事件写入接线（全 13 event 源）
- **Modify** 路由层（`a2a-mentions.ts` + F167 forced-pass guard）→ handed/handed_cvo/void_pass；hold_ball 设/过期 → held/hold_expired；task 状态机 → blocked/unblocked/idle_long/done；invocation lifecycle → started/heartbeat/died
- **Test** 各源「真动作→事件落账」+ grep 既有 consumer

### Task 3: 死球心跳（AC-B1）— invocation.died 含 lastScanAt（复用 F194/F212）

### Task 4: probe + resolve + WakeOutbox（AC-B2；含 §E/§F）
- **Modify** task schema 加 `probe`(白名单)+`resolveMode`；ProbeScheduler（§C）；WakeOutbox（§E）入统一 scheduler
- **Test** Repo Inbox fixture bounces_back→一次唤醒（INV-6）；woken 后 3 tick 零重复（INV-9）；**跨轮两次独立唤醒**（INV-11）；rebuild 不重投；crash 矩阵四点

### Task 5: 简报数据源切换（5 源→projection，P1-3 零回归）
- **Modify** `collectDutyBriefingInput`→读 `BallCustodyProjectionStore`；blocked 按 ageMs 映射 needsUser/staleBlocked；active(held)→healthy；void→voidPass；hold_expired→dead；接 F167 snapshot
- **Test** 新旧简报对比：dead 收敛、void 非 0、**needsUser/staleBlocked/activeCount(hold) 不归零**；冷启动 mention fallback

### Task 6: 不变量回归套（AC-B3）— §B 6 对抗 + INV-1~11 + §C INV-P1~3 + §E crash 矩阵，Redis-backed

---

## Open Questions

**技术 OQ（自决预决议）**：OQ-2 intent=路由推断兜底+MCP 显式 / OQ-4 probe 白名单 enum 禁 shell / OQ-5 spend_limit 同根因聚合 / subjectKey=thread 主轨+task 细分 / 写入时机=hook。
**价值 OQ（→CVO）**：无新增（纯数据层 + 只读切源 + 唤醒可逆）。

---

## 我最可能错在哪（pre-register，R2 audit 后剩余风险）

> R2 换层做了完整性/幂等/crash 三维 audit，下列是 audit 后**仍可能**的洞，请 R3 定向：
1. **subjectKey 粒度**（CVO 产品视角，砚砚两轮未攻）：thread 单轨 vs 多球并行——查多 task / 多 @ 链 thread。
2. **blockedEpoch 的来源时序**：projection 维护 epoch，但 append 方（ProbeScheduler）构造 sourceEventId 时读的是**事件应用前还是后**的 epoch？若 ProbeScheduler 与 projector 对 epoch 的读时序不一致，跨轮键仍可能错位——查 §F probe 键的 epoch 读取点。
3. **hold 球 holder=cvo 的交叉**：active(held) 若 holder 后来 handed_cvo，heldUntil 与 parked 晾龄两套计时是否冲突——查 ball.held×ball.handed_cvo 序列。
4. **INV-10 穷举的 reject 语义**：117 格里大量 reject 格，是否有"本该转移却被我归 reject"的——靠穷举测试断言每格符合**意图**（不只是符合表）。
