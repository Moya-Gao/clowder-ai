# F233 Phase B: 球权事件流 + 死球心跳 + 睡美人探针 Implementation Plan

**Feature:** F233 — `docs/features/F233-ball-custody-observability.md`
**Goal:** 把 Phase A 的「投影时启发式分类」升级为「事件驱动结构化回执」——一条 append-only 球权事件流成为简报与轨迹的单一账本（向前生效），死球/搁置/虚空靠结构化事件判定，不再靠 mention 推断。
**Acceptance Criteria（逐条抄自 feat doc）:**
- **AC-B1**: 复现「invocation 中途死亡」（测试环境模拟），死球在下一次简报被点名，含最后扫描点。
- **AC-B2**: blocked task 带 probe + resolve 字段，探针判定条件满足后：`completes` 型自动完结、`bounces-back` 型 owner 收到真实唤醒投递（fixture：Repo Inbox task 同型场景红→绿）。
- **AC-B3**: 球权状态转移表 + 不变量有测试覆盖（含 crash / 并发 / 重复探针对抗场景）。
**Architecture cell:** `ball-custody`（new）
**Map delta:** new cell required
**Map delta why:** 球权事件流是新 domain（event-log + projector + state-machine + **ingest** 四件），OQ-6 已决照 `community-ops` cell 先例创建；cell 文档随本 Phase 首个 PR 落 `docs/architecture/ownership/`。
**Architecture:** `BallCustodyEventLog`（Redis LIST per subject + Lua 原子幂等 append，1:1 照 `CommunityEventLog`）→ **ingest 层**（`appended:true` 时做外部副作用：唤醒投递 / tracking 注册，照 `community-auto-tracking`）→ `BallCustodyProjector`（`apply`: 纯函数 `transition()` + 幂等 store 写，**零外部副作用**，rebuild=replay，照 `CommunityProjector`）→ 简报从 projection 读球态（替代 Phase A 的 5 源 collect 投影）。事件由现有系统动作旁路写入，**零猫侧手动汇报义务**（KD-2）。
**Tech Stack:** TypeScript / Redis (ioredis) / Fastify / Vitest
**前端验证:** No — Phase B 是数据层；简报卡（`BriefingCard.tsx`）Phase A 已有，Phase B 只切换其数据源。

> **R1 修订（砚砚 gpt52 review，2026-06-14）**：4 处状态机漏边已修——① 外部副作用移出 projector（§E ingest）② bounces_back 停表防反复唤醒（§B/§C）③ 新增 `blocked` 显式状态防切源丢红球（§B）④ 删 `ball.passed` 语义空洞，理清 holder 变更 vs 终结（§B）。

---

## Straight-Line Check（A→B，不绕路）

**Finish line（一句话 B）**：简报横切视图从「每次扫 5 源 + 启发式分类」改为「读球权 projection」；死球（invocation 终态）、虚空（F167 路由守卫事件）、blocked 搁置（task 事件 + probe）全部结构化判定；blocked task 探针满足后按 `resolve` 二态完结或**真实唤醒一次** owner（停表，不反复打扰）。

**NOT building（明确不做）**：
1. **球 ID 新原语**（KD-1）— `subjectKey` 从 thread/task 现有痕迹派生。
2. **workflow engine / 自动转派**（KD-4）— 只读投影 + 唤醒投递；系统不代猫传球（KD-6）。
3. **Phase C 范围** — 安乐死通道、feat 轨迹纵切、历史回填。

**Terminal schema（最终形态）**：

```ts
// ---- 事件（append-only，照 CommunityEvent）----
interface BallCustodyEvent {
  sourceEventId: string;   // 幂等去重 key（稳定，不含 tick/时间）：如 `route:{messageId}` / `inv:{invocationId}:died` / `probe:{taskId}:{conditionFingerprint}`
  subjectKey: string;      // 派生标识（KD-1 不新建 ID）：`ball:thread:{threadId}` | `ball:task:{taskId}`
  kind: BallEventKind;
  classification: 'state-changing' | 'informational';
  payload: Record<string, unknown>;
  at: number;
}

type BallEventKind =
  | 'ball.handed'         // 行首 @ 路由投递给某猫（holder 变更，球继续；payload: { fromCatId, toCatId })
  | 'ball.handed_cvo'     // @landy（payload: { fromCatId, intent: 'handoff'|'fyi'|'done_notify' })
  | 'ball.void_pass'      // F167 forced-pass guard / 路由守卫：说传了但无系统动作
  | 'ball.held'           // hold_ball 设（payload: { catId, fireAt })
  | 'ball.hold_expired'   // hold fireAt 已过
  | 'invocation.started' | 'invocation.heartbeat' | 'invocation.died'  // F194 liveness / F212 cliDiagnostics
  | 'task.blocked'        // task 进入 blocked（→ blocked 状态，非 active）
  | 'task.unblocked'      // 阻塞解除（owner ack 或外部满足）
  | 'task.idle_long'      // blocked 长期无活动（→ zombie）
  | 'task.done'           // task 完成（→ resolved，唯一正常终结入口）
  | 'probe.evaluated'     // payload: { satisfied, resolveMode: 'completes'|'bounces_back' }（结果翻转才产事件）
  | 'ball.woken';         // bounces_back 唤醒投递已发（ingest 层产，记录事实；→ woken 停表）

// ---- 球状态（projection，照 CommunityObjectProjection）----
type BallState =
  | 'active'    // 在某猫手上正常推进（有心跳/在跑）
  | 'blocked'   // task 阻塞等条件（probe 未满足/无 probe）；简报按 ageMs 分 needsUser(1-7d)/staleBlocked(>7d)  ← R1 新增
  | 'parked'    // 搁置：handoff 给 CVO，晾龄计时
  | 'woken'     // bounces_back 已唤醒待 owner ack（ProbeScheduler 停表）  ← R1 新增
  | 'dead'      // 死球：持有 invocation 死亡，无心跳
  | 'void'      // 虚空传球：说传了无系统动作
  | 'zombie'    // 僵尸：长期无活动放弃
  | 'resolved'; // 终态：task.done / (Phase C)安乐死

interface BallCustodyProjection {
  subjectKey: string;
  state: BallState;
  holder: string | null;                 // 当前持球 catId，或 'cvo'
  intent: 'handoff' | 'fyi' | 'done_notify' | null;  // 仅 holder='cvo' 有意义
  resolveMode: 'completes' | 'bounces_back' | null;  // 仅 blocked/woken 球有意义
  lastStateChangeAt: number;             // 晾龄基准（ageMs = now - lastStateChangeAt，纯派生不存）
  lastEventAt: number;
  lastScanAt: number | null;             // 死球「最后扫描点」(AC-B1)
  wokenAt: number | null;                // bounces_back 唤醒时刻（停表起点，owner ack 后清）  ← R1 新增
  appliedEventCount: number;
  lastRejectedEvent: BallCustodyEvent | null;
  createdAt: number;
  updatedAt: number;
}
```

**派生值规则（F229）**：`ageMs` 及简报区归类（needsUser/staleBlocked 按 blocked 球 ageMs 阈值分）一律纯投影 selector 计算，**禁落独立存储**。`lastStateChangeAt`/`wokenAt` 是状态机维护的事实字段。

---

## Stateful Object Gate — Census（F229 🔴）

| # | 对象 | 唯一 lifecycle owner | 旁路 API 禁忌 | 三件套 |
|---|------|------|------|------|
| 1 | **BallCustodyEventLog** | `eventLog.append()`（Lua 原子）| generic flush/delete 禁触 `ballcustody:events:*`（TTL=0 铁律#5）| §A |
| 2 | **BallCustodyProjection** | `projector.apply()` 唯一写（**零外部副作用**）| 简报/轨迹只读；generic delete 仅 rebuild | §B（核心）|
| 3 | **ProbeScheduler**（blocked 探针 — 新消费侧状态机）| scheduler tick | woken 球**停表**；probe 只读不改 task | §C |
| 4 | **Ingest 层**（外部副作用落点）| `appended:true` guard | rebuild replay 不触（dedup→appended:false）| §E |

> §A（EventLog）/§D（HandoffIntent）照 community 先例 1:1，不赘述；重点 §B/§C/§E。

---

### §B 对象 2：BallCustodyProjection 状态机（核心，AC-B3）

**状态 × 事件 转移表**（`transition(state, event, snapshot) → {ok, next}` 纯函数；未列格 = reject 不改 state，记 `lastRejectedEvent`）：

| state \ event | ball.handed | ball.handed_cvo | task.blocked | task.unblocked | probe.evaluated(sat) | invocation.died | invocation.heartbeat | task.idle_long | task.done |
|---|---|---|---|---|---|---|---|---|---|
| **(new)** | active | parked* | blocked | — | — | — | — | — | — |
| **active** | active(换holder) | parked* | blocked | — | — | dead | active | zombie | resolved |
| **blocked** | active(接手) | parked* | blocked(幂等) | active | resolve‡ | dead | — | zombie | resolved |
| **parked** | active | parked(更新intent) | blocked | — | — | — | — | zombie | resolved |
| **woken** | active | — | — | active(owner ack,清wokenAt) | — | — | — | — | resolved |
| **dead** | active(复活†) | — | — | — | — | dead(幂等) | active(迟到心跳复活†) | — | resolved |
| **void** | active | parked* | blocked | — | — | — | — | zombie | resolved |
| **zombie** | active | parked* | blocked | active | — | — | active | zombie(幂等) | resolved |
| **resolved** | active(reopen) | — | — | — | — | — | — | — | resolved(幂等) |

\* `ball.handed_cvo` 按 `intent` 细化：`handoff`→parked（晾龄计时）；`fyi`→**informational 不产搁置球**（不进简报 needsUser）；`done_notify`→resolved。
† 死球复活：`dead` + 迟到 `invocation.heartbeat`（`heartbeat.at` 在 `died.at` 之后且 ≤ grace window）或 `ball.handed`。对抗场景 4 测边界。
‡ `blocked` + `probe.evaluated(satisfied)` 按 `resolveMode`：`completes`→resolved；`bounces_back`→**不在 projector 投递**，只置 woken + wokenAt（真实唤醒投递由 §E ingest 层在事件 `appended:true` 时做一次）。

**blocked → 简报区映射（纯投影 selector，对齐 Phase A，P1-3 防丢红球）**：`blocked` 球按 `ageMs` 分——`NEEDS_USER_BLOCKED_MIN_MS ≤ age ≤ STALE_BLOCKED_THRESHOLD_MS`（1-7d）→ 简报 `needsUser` 🔴；`age > STALE_BLOCKED_THRESHOLD_MS`（>7d）→ `staleBlocked` 💤。复用 Phase A `constants.ts` 阈值，确保切源后这批结构化红球不消失。

**不变量清单（INV-N，每条标可测方式）**：
- **INV-1**（append-only）：事件永不删/改，replay 得唯一终态。*测*：append→读断言序列；无删除 API。
- **INV-2**（无漂移）：球态 = 事件纯投影；删 projection + rebuild 得**逐字段相同** projection。*测*：rebuild idempotence。
- **INV-3**（幂等去重）：同 `sourceEventId` 二次 append → `{appended:false}`，projection 不变。*测*：并发双写 + 重复 append。
- **INV-4**（结构化替代推断）：`dead`/`void`/`blocked` 必须由结构化事件产生，**不接受 mention 启发式入 projection**。*测*：喂 mention-only 输入 → 不产 dead/void/blocked。
- **INV-5**（resolved 准终态）：`resolved` 后仅接受 `ball.handed`(reopen) 或 informational；其它 state-changing → reject 记录不复活。*测*：resolved 后喂 invocation.died → 仍 resolved。
- **INV-6**（唤醒=ingest 一次性，**P1-1 修**）：`bounces_back` satisfied 的真实唤醒投递由 **ingest 层**在 `probe.evaluated` 事件 `appended:true` 时做一次（产 messageId）；`projector.apply()` **零外部副作用**；rebuild replay（appended:false）**不重投**。*测*：rebuild 后断言无新投递；crash-after-send 不重投（ball.woken 事件已落则停表）。
- **INV-7**（CVO intent 三态）：`fyi` 不产搁置球；`done_notify` → resolved。*测*：三 intent 各一 fixture。
- **INV-8**（死球留痕）：`invocation.died` → `lastScanAt` = 死前最后心跳点。*测*：died 后 lastScanAt 非空。
- **INV-9**（woken 停表，**P1-2 修**）：球进 `woken` 后 ProbeScheduler 对其**停 probe**，直到 `task.unblocked`（owner ack）才重新激活；`woken` 期间不产新 `ball.woken`。*测*：woken 后连跑 3 tick，断言零新唤醒投递。

**对抗场景（每个一条测试，AC-B3）**：
1. **crash window**：事件 append 成功但 apply 前 crash → 重启 rebuild(replay) 恢复 projection（事件已落账）。
2. **并发双写**：同 subjectKey 两事件并发 → Lua 原子 + `sourceEventId` 去重，无重复 apply。
3. **重复探针（P1-2 重写）**：blocked 球连跑多 tick 都 satisfied → ① `probe.evaluated` 的 `sourceEventId = probe:{taskId}:{conditionFingerprint}`（**不含 tick**，同条件同 ID）→ 幂等去重；② 首次满足即转 `woken`，**ProbeScheduler 停表**（INV-9）不再 probe。两道防线，**不靠 tick 去重**。*断言*：N tick → 恰好 1 次 ball.woken。
4. **死球迟到心跳**：`invocation.died` 后迟到 `invocation.heartbeat` → 按 grace window 判真复活 vs 噪音。
5. **resolved 复活**：已 resolved 球被旁路 generic restore → INV-5 拒绝。

---

### §C 对象 3：ProbeScheduler（blocked 探针定时器）

**状态 × 事件**：`idle → registered(task.blocked 登记) → probing(tick) → {satisfied: emit probe.evaluated → (completes: deregister | bounces_back: 转 woken → 停表) | unsatisfied: 留 registered 等下个 tick}`；`task.unblocked` / `task.done` → deregister。
**不变量**：
- **INV-P1**：probe 只读执行（curl GET / endpoint reachability / redis EXISTS），不改 task、不调 reconcile（KD-4）。*测*：probe 后 task 不变。
- **INV-P2**：probe 命令走白名单 enum（OQ-4），非白名单 → 拒绝 + 记降级不静默。*测*：非白名单被拒。
- **INV-P3**（停表，呼应 INV-9）：`woken` 球 deregister/skip，owner ack（task.unblocked）才重新 register。*测*：woken 后 tick 不 emit probe。
**对抗**：scheduler crash → 从 `blocked` 球（projection 投影）+ 事件流重建登记表（无独立持久态漂移）。

---

### §E Ingest 层（外部副作用落点，P1-1 修，照 community-auto-tracking）

**铁律（抄 `community-auto-tracking.ts:9-13`）**：外部副作用（唤醒投递 / tracking 注册）**只在 `eventLog.append()` 返回 `appended:true` 时做，绝不放 `projector.apply()`**。rebuild replay 同 sourceEventId → dedup → `appended:false` → 不触发副作用 → 投递不重放。

**唤醒流（bounces_back）**：ProbeScheduler 判 satisfied → `appendBallEvent(probe.evaluated)` → 若 `appended:true` → ingest 层 `deliverWake(ownerThreadId)` 真实投递（得 messageId）→ 投递成功 `appendBallEvent(ball.woken, payload:{messageId})`。`projector.apply(probe.evaluated)` 置 woken+wokenAt（纯状态，无投递）。**crash 安全**：若 send 后 ball.woken 未落 → 下次因 probe.evaluated 已 appended（停表未生效）会重试，但 messageId 幂等键防重复 owner 通知（投递层按 `wake:{taskId}:{wokenEpoch}` 去重）。

---

## Tasks（TDD，red→green→commit）

### Task 1: ball-custody cell 骨架
- **Create**: `packages/api/src/domains/ball-custody/`：`BallCustodyEventLog.ts`（照 CommunityEventLog Lua 幂等）、`ball-custody-state-machine.ts`（§B 转移表纯函数）、`BallCustodyProjector.ts`（**零外部副作用**）、`ball-custody-ingest.ts`（§E）、`ball-custody-keys.ts`、`BallCustodyProjectionStore.ts`
- **Create types**: `packages/shared/src/types/ball-custody.ts` → `pnpm --filter @cat-cafe/shared build`
- **Test**: `ball-custody-state-machine.test.ts`（§B 转移表逐格 + INV-1~9）、`ball-custody-eventlog-redis.test.ts`（INV-1/2/3 **Redis-backed**，非 in-memory — feedback_inmemory_store_tests_miss_redis_behavior）
- **Arch doc**: `docs/architecture/ownership/ball-custody.md`

### Task 2: 事件写入接线（旁路系统动作 → 事件）
- **Modify**: 路由层（`a2a-mentions.ts` 投递点 + F167 forced-pass guard）→ `ball.handed`/`ball.handed_cvo`/`ball.void_pass`；hold_ball 设/过期 → `ball.held`/`ball.hold_expired`；task 状态机 → `task.blocked`/`unblocked`/`done`/`idle_long`
- **语义钉死**：`ball.handed` = holder 变更球继续；`task.done` = 唯一正常终结（删原 `ball.passed` 空洞）；接/退/升回执 = 统计 @ 后有无后续 `ball.handed*`/`held`（feature doc ⑤）
- **Test**: 各接线点「真动作 → 事件落账」断言（grep 既有 consumer，feedback_grep_consumers_before_contract_change）

### Task 3: 死球心跳（AC-B1）
- **Modify**: invocation lifecycle（复用 F194 liveness / F212 cliDiagnostics）→ `invocation.died` 含 `lastScanAt`
- **Test**: 模拟 invocation 中途死亡 → 死球进简报含最后扫描点（INV-8）

### Task 4: probe + resolve 二态 + 唤醒（AC-B2，含 P1-1/P1-2 修）
- **Modify**: task schema 增 `probe`（白名单可执行判据）+ `resolveMode`；ProbeScheduler（§C）注册进统一 scheduler；唤醒投递走 §E **ingest 层**
- **Test**: Repo Inbox 同型 fixture——bounces_back probe 满足 → owner 收**一次**真实唤醒（INV-6）；woken 后连跑 3 tick 零重复唤醒（INV-9）；rebuild 不重投（INV-6）

### Task 5: 简报数据源切换（5 源投影 → projection 读，含 P1-3 防丢红球）
- **Modify**: `collectDutyBriefingInput` → 从 `BallCustodyProjectionStore` 读球态；**blocked 球按 ageMs 映射 needsUser/staleBlocked**（保 Phase A 结构化红球）；接入 F167 snapshot（Phase A 降级的 `f167SnapshotProvider`）
- **Test**: 同 runtime 数据新旧简报对比——dead 收敛（339 虚高→结构化死球）、void 非 0（F167 接入）、**needsUser/staleBlocked 不归零**（P1-3 回归）；projection 冷启动空窗期 mention 启发式作 fallback

### Task 6: 状态机不变量回归套（AC-B3）
- **Test**: §B 5 对抗场景 + INV-1~9 + §C INV-P1~3 全覆盖；Redis-backed crash/并发

---

## Open Questions

**技术 OQ（实现中自决，已预决议）**：
- **OQ-2（intent 载体）**：路由层默认推断（消息特征）兜底 + 可选猫侧 MCP 参数显式声明。先上推断（零猫侧负担），MCP 参数 Task 4 顺带。
- **OQ-4（probe 安全）**：白名单 enum = 只读探测（curl GET / reachability / redis EXISTS），**禁任意 shell**（INV-P2），新增走 review。
- **OQ-5（断流聚合）**：`invocation.died.reason==='spend_limit'` 同根因聚合成单条「全家断流」告警，不逐球刷屏。
- **subjectKey 粒度**：`ball:thread:{threadId}` 主轨 + `ball:task:{taskId}` 细分。**理由**：KD-1 不新建 ID，thread 是球流转天然容器。
- **事件写入时机**：**hook**（路由/scheduler/invocation lifecycle 内联同步落账），不做 tail；tail 仅 Phase C 历史回填。

**价值 OQ（→ CVO）**：无新增。Phase B 纯数据层 + 只读简报切源 + 唤醒投递可逆，未触愿景/不可逆边界。

---

## 我最可能错在哪（pre-register retraction，帮 reviewer 定向攻击）

1. **subjectKey 粒度**（CVO 产品视角 + 砚砚未攻）：一个 thread 常有 >1 并行球时 thread 单轨会混轨——查多 task / 多 @ 链并行 thread。
2. **死球迟到心跳 grace window**（砚砚关注边界）：真复活 vs 噪音阈值是我拍的——查对抗场景 4。
3. **唤醒 crash 安全的 wake 幂等键**（R1 新引入）：§E 用 `wake:{taskId}:{wokenEpoch}` 防重复 owner 通知，但 `wokenEpoch` 定义（按什么递增）我还没钉死——若 epoch 选错仍可能重复或漏唤醒，请重点查 §E crash 路径。
4. **blocked→needsUser/staleBlocked 切源等价性**（P1-3 修后）：新投影是否逐条覆盖 Phase A `tasksToNeedsUser`/`tasksToStaleBlocked` 的全部条目（userId 过滤 / 阈值边界）——查 Task 5 切源回归是否真零丢失。
