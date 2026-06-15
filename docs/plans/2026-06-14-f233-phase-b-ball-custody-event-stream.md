# F233 Phase B: 球权事件流 + 死球心跳 + 睡美人探针 Implementation Plan

**Feature:** F233 — `docs/features/F233-ball-custody-observability.md`
**Goal:** 把 Phase A 的「投影时启发式分类」升级为「事件驱动结构化回执」——一条 append-only 球权事件流成为简报与轨迹的单一账本（向前生效），死球/睡美人/虚空靠结构化事件判定，不再靠 mention 推断。
**Acceptance Criteria（逐条抄自 feat doc）:**
- **AC-B1**: 复现「invocation 中途死亡」（测试环境模拟），死球在下一次简报被点名，含最后扫描点。
- **AC-B2**: blocked task 带 probe + resolve 字段，探针判定条件满足后：`completes` 型自动完结、`bounces-back` 型 owner 收到真实唤醒投递（fixture：Repo Inbox task 同型场景红→绿）。
- **AC-B3**: 球权状态转移表 + 不变量有测试覆盖（含 crash / 并发 / 重复探针对抗场景）。
**Architecture cell:** `ball-custody`（new）
**Map delta:** new cell required
**Map delta why:** 球权事件流是新 domain（event-log + projector + state-machine 三件），OQ-6 已决照 `community-ops` cell 先例创建；cell 文档随本 Phase 首个 PR 落 `docs/architecture/ownership/`。
**Architecture:** `BallCustodyEventLog`（Redis LIST per subject + Lua 原子幂等 append，1:1 照 `CommunityEventLog`）→ `BallCustodyProjector`（`apply`: 纯函数 `transition()` + side-effect + save，rejected 不改 state，rebuild=replay，照 `CommunityProjector`）→ 简报从 projection 读球态（替代 Phase A 的 5 源 collect 投影）。事件由现有系统动作（路由层 / scheduler / invocation lifecycle）旁路写入，**零猫侧手动汇报义务**（KD-2）。
**Tech Stack:** TypeScript / Redis (ioredis) / Fastify / Vitest
**前端验证:** No — Phase B 是数据层；简报卡（`BriefingCard.tsx`）Phase A 已有，Phase B 只切换其数据源。

---

## Straight-Line Check（A→B，不绕路）

**Finish line（一句话 B）**：简报横切视图从「每次扫 5 源 + 启发式分类」改为「读球权 projection」；死球（invocation 终态）、睡美人（probe 判定）、虚空（F167 路由守卫事件）全部结构化判定；blocked task 探针满足后按 `resolve` 二态完结或**真实唤醒** owner。

**NOT building（明确不做）**：
1. **球 ID 新原语**（KD-1）— `subjectKey` 从 thread/task 现有痕迹派生，不引入独立 ball 实体。
2. **workflow engine / 自动转派**（KD-4）— 只读投影 + 唤醒投递；系统不代猫传球（球权是言语行为、只有第一人称，KD-6）。
3. **Phase C 范围** — 安乐死通道、feat 轨迹纵切视图、历史回填（< 事件流上线的 stitched 拼接）全部 Phase C。
4. **mention 启发式的「转正」之外的精度提升** — Phase B 用 intent 字段替代推断，但不追求消灭所有假阳性（friction metric 兜底）。

**Terminal schema（最终形态，steps 围绕它建，非脚手架）**：

```ts
// ---- 事件（append-only，照 CommunityEvent 结构）----
interface BallCustodyEvent {
  sourceEventId: string;   // 幂等去重 key：来源系统事件的稳定唯一 id（如 `route:{messageId}` / `inv:{invocationId}:died`）
  subjectKey: string;      // 球的派生标识（KD-1 不新建 ID）：`ball:thread:{threadId}` | `ball:task:{taskId}`
  kind: BallEventKind;
  classification: 'state-changing' | 'informational';
  payload: Record<string, unknown>;
  at: number;              // 事件时刻（ms）
}

type BallEventKind =
  | 'ball.handed'         // 行首 @ 路由投递给某猫（payload: { fromCatId, toCatId })
  | 'ball.handed_cvo'     // @landy（payload: { fromCatId, intent: 'handoff'|'fyi'|'done_notify' })
  | 'ball.void_pass'      // F167 forced-pass guard / 路由守卫：说传了但无系统动作
  | 'ball.held'           // hold_ball 设（payload: { catId, fireAt })
  | 'ball.hold_expired'   // hold fireAt 已过
  | 'invocation.started'  // 持有者起 invocation
  | 'invocation.heartbeat'// draft 更新（F194 真心跳）
  | 'invocation.died'     // error / spend-limit / timeout（payload: { reason, lastScanAt })
  | 'task.blocked' | 'task.unblocked'
  | 'task.idle_long'      // blocked 长期无活动（→ zombie 候选）
  | 'probe.evaluated'     // payload: { satisfied: boolean, resolveMode: 'completes'|'bounces_back' }
  | 'ball.woken'          // bounces_back 唤醒投递成功（真实投递，非改状态）
  | 'ball.passed';        // 接/退/升 三选一发生，本球完结

// ---- 球状态（projection，照 CommunityObjectProjection）----
type BallState =
  | 'active'    // 在某猫手上正常推进（有心跳）
  | 'parked'    // 搁置：名义在某 agent（尤其 CVO）手上，晾龄计时中
  | 'dead'      // 死球：持有 invocation 死亡，无心跳
  | 'sleeping'  // 睡美人：blocked 条件满足但未唤醒
  | 'void'      // 虚空传球：说传了无系统动作
  | 'zombie'    // 僵尸：心理已放弃未显式杀
  | 'resolved'; // 终态：传下一棒成功 / 完成 / (Phase C)安乐死

interface BallCustodyProjection {
  subjectKey: string;
  state: BallState;
  holder: string | null;                 // 当前持球 catId，或 'cvo'
  intent: 'handoff' | 'fyi' | 'done_notify' | null;  // 仅 holder='cvo' 时有意义
  resolveMode: 'completes' | 'bounces_back' | null;  // 仅 blocked/sleeping 球有意义
  lastStateChangeAt: number;             // 晾龄基准（ageMs = now - lastStateChangeAt，纯派生不存）
  lastEventAt: number;
  lastScanAt: number | null;             // 死球「最后扫描点」(AC-B1)
  appliedEventCount: number;
  lastRejectedEvent: BallCustodyEvent | null;
  createdAt: number;
  updatedAt: number;
}
```

**派生值规则（F229）**：`ageMs` / counts 一律纯投影（selector）计算，**禁止落独立存储**——无同步即无失同步。`lastStateChangeAt` 是状态机维护的事实字段（非派生），`ageMs` 由它派生。

---

## Stateful Object Gate — Census（F229 🔴 先普查再三件套）

| # | 生命周期对象 | 唯一 lifecycle owner | 旁路 API 禁忌 | 三件套 |
|---|------|------|------|------|
| 1 | **BallCustodyEventLog**（append-only 账本）| `projector.append()` | generic redis flush/delete 禁触 `ballcustody:events:*`（TTL=0 铁律#5/LL-048）| §A |
| 2 | **BallCustodyProjection**（球态投影）| `projector.apply()` 唯一写 | 简报/轨迹**只读** projection，禁写；generic store delete 仅 rebuild 用 | §B（核心）|
| 3 | **ProbeScheduler**（blocked 探针定时器 — 新消费侧状态机）| scheduler tick | 重复探针经 `sourceEventId` 去重；probe 只读不改 task | §C |
| 4 | **HandoffIntent**（@landy intent 维度）| 路由层写 `ball.handed_cvo` 事件 | 无独立存储——intent 进事件 payload，不落 message 旁字段 | §D |
| 5 | DeadBall 心跳判定 | 复用 F194 liveness（`invocation.died` 事件源）| 复用不新建，不调 `reconcileZombies`（KD-4 只读）| 见 Task 3 |

> 反例警告（F229 A3a 教训）：对象 3 `ProbeScheduler` 是「复用现有 scheduler 但新增消费侧状态」——最易漏普查的一类。已显式纳入。

---

### §B 对象 2：BallCustodyProjection 状态机（核心，AC-B3）

**状态 × 事件 转移表**（`transition(state, event, snapshot) → {ok, next}` 纯函数；表中未列 = reject 不改 state，记 `lastRejectedEvent`）：

| 当前 state \ event | ball.handed | ball.handed_cvo | ball.void_pass | invocation.died | invocation.heartbeat | probe.evaluated(satisfied) | task.idle_long | ball.woken | ball.passed |
|---|---|---|---|---|---|---|---|---|---|
| (无/new) | active | parked* | void | — | — | — | — | — | — |
| **active** | active(换 holder) | parked* | void | dead | active(续心跳) | — | zombie | — | resolved |
| **parked** | active | parked(更新 intent) | — | — | — | — | zombie | parked | resolved |
| **dead** | active(复活†) | — | — | dead(幂等) | active(迟到心跳复活†) | — | — | — | resolved |
| **sleeping** | active | — | — | — | — | resolve‡ | zombie | parked | resolved |
| **void** | active | parked* | void(幂等) | — | — | — | zombie | — | resolved |
| **zombie** | active | parked* | — | — | active | — | zombie(幂等) | — | resolved |
| **resolved** | active(reopen) | — | — | — | — | — | — | — | resolved(幂等) |

\* `parked` 由 `ball.handed_cvo` 的 `intent` 细化：`handoff`→parked（晾龄计时）；`fyi`→**不产球/informational**（不进简报）；`done_notify`→resolved。
† 死球复活：`dead` + `invocation.heartbeat`(迟到) 或 `ball.handed` → active。**对抗场景测试点**（迟到心跳 vs 真复活的判别 = heartbeat.at > died.at 且 < grace window）。
‡ `probe.evaluated(satisfied)` 按 `resolveMode`：`completes`→resolved；`bounces_back`→触发 `ball.woken`（真实唤醒投递）→ 落 `parked`(holder=owner)。

**blocked task 进 sleeping 的判定**：`task.blocked` 事件落 active；ProbeScheduler 周期对 blocked 球跑 probe，`probe.evaluated(satisfied=true)` 才转 sleeping→resolve 分支。`task.idle_long`（blocked 无活动超阈值且 probe 未满足）→ zombie。

**不变量清单（INV-N，每条标可测方式）**：
- **INV-1**（append-only）：事件 facts 永不删/改；`read(subjectKey)` replay 得唯一终态。*测*：append→读→断言序列完整；删除尝试无 API 暴露。
- **INV-2**（无漂移）：球态 = 事件纯投影；删 projection + rebuild(replay) 得**逐字段相同** projection。*测*：rebuild idempotence。
- **INV-3**（幂等去重）：同 `sourceEventId` 二次 append → `{appended:false}`，projection 不变。*测*：并发双写 + 重复 append。
- **INV-4**（结构化替代推断）：`dead`/`void`/`sleeping` 必须由结构化事件（invocation 终态 / F167 守卫 / probe）产生，**不接受 mention 启发式入 projection**。*测*：喂 mention-only 输入 → 不产 dead/void。
- **INV-5**（resolved 准终态）：`resolved` 后仅接受 `ball.handed`(reopen) 或 informational；其它 state-changing event → reject 记 `lastRejectedEvent` 不复活。*测*：resolved 后喂 invocation.died → state 仍 resolved。
- **INV-6**（唤醒=真实投递）：`bounces_back` 满足 → 必产 `ball.woken` 事件 + 一条真实唤醒投递（messageId 可查），**不是只改 state**。*测*：probe 满足后断言投递 side-effect 发生。
- **INV-7**（CVO intent 三态）：`ball.handed_cvo` 的 `fyi` 不产搁置球（不进简报 needsUser）；`done_notify` 直接 resolved。*测*：三 intent 各一条 fixture。
- **INV-8**（死球留痕）：`invocation.died` → projection.`lastScanAt` = 死前最后心跳点（AC-B1 简报要显示）。*测*：died 后 projection.lastScanAt 非空。

**对抗场景（每个一条测试，AC-B3）**：
1. **crash window**：事件 append 成功但 apply 前进程 crash → 重启 rebuild(replay) 恢复 projection（事件已落账，投影可重建）。
2. **并发双写**：同 subjectKey 两事件并发 append → Lua 原子 + `sourceEventId` 去重，无重复 apply。
3. **重复探针**：scheduler 对同 blocked 球连跑两 tick 都 satisfied → `probe.evaluated` sourceEventId 含 tick 判据，去重后只触发一次 `ball.woken`（不重复打扰，呼应 friction「无效打扰 ≥3 次收紧」）。
4. **死球迟到心跳**：`invocation.died` 后一条迟到 `invocation.heartbeat` → 按 grace window 判别真复活 vs 噪音（防死球假复活刷新）。
5. **resolved 复活**：已 resolved 球被旁路 generic restore → INV-5 拒绝。

---

### §C 对象 3：ProbeScheduler（blocked 探针定时器）

**状态 × 事件**：`idle → scheduled(blocked 球登记) → probing(tick 触发) → {satisfied → emit probe.evaluated → idle | unsatisfied → scheduled(下个 tick)}`；`task.unblocked` / `ball.passed` → deregister。
**不变量**：
- **INV-P1**：probe 只读执行（curl 判据 / endpoint 探测），不改 task、不调 reconcile（KD-4）。*测*：probe 执行后 task 状态不变。
- **INV-P2**：probe 命令走白名单（OQ-4），非白名单 → 拒绝执行 + 记降级，不静默。*测*：非白名单命令被拒。
- **INV-P3**：deregister 后 scheduler 不再对该球跑 probe（防已完结球被反复探）。*测*：passed 后 tick 不 emit。
**对抗**：scheduler crash 后从 blocked 球列表 + 事件流重建登记表（无独立持久态漂移）。

---

### §D 对象 4：HandoffIntent

intent 不落 message 旁字段（无独立存储）→ 进 `ball.handed_cvo` 事件 payload。来源：① 猫侧显式声明（MCP 参数 or 消息标记，OQ-2 定载体）② 路由层默认推断兜底（无显式声明时按消息特征判 handoff/fyi/done_notify）。Phase A 的「候选球区」在本字段落地后转正为「CVO 收件箱」。

---

## Tasks（TDD，red→green→commit）

> 每 Task 先红测后实现。文件路径精确；状态机/log 的具体断言用例见 §B/§C 不变量表。

### Task 1: ball-custody cell 骨架
- **Create**: `packages/api/src/domains/ball-custody/BallCustodyEventLog.ts`（照 `CommunityEventLog`，Lua 幂等 append + read + listSubjects）、`ball-custody-state-machine.ts`（`transition()` 纯函数，§B 转移表）、`BallCustodyProjector.ts`（照 `CommunityProjector`）、`ball-custody-keys.ts`、`BallCustodyProjectionStore.ts`
- **Create types**: `packages/shared/src/types/ball-custody.ts`（terminal schema）→ `pnpm --filter @cat-cafe/shared build`
- **Test**: `ball-custody-state-machine.test.ts`（§B 转移表逐格 + INV-1~8）、`ball-custody-eventlog-redis.test.ts`（INV-1/2/3 Redis-backed，**非 in-memory** — feedback_inmemory_store_tests_miss_redis_behavior）
- **Architecture**: `docs/architecture/ownership/ball-custody.md`（cell 文档，Map delta=new cell）

### Task 2: 事件写入接线（旁路现有系统动作 → 事件，零猫侧义务）
- **Modify**: 路由层（`a2a-mentions.ts` 投递点 + F167 forced-pass guard）→ emit `ball.handed` / `ball.handed_cvo` / `ball.void_pass`；`hold_ball` 设/过期 → `ball.held` / `ball.hold_expired`
- **Test**: 接线点各一条「真动作 → 事件落账」断言（grep 既有 consumer，feedback_grep_consumers_before_contract_change）

### Task 3: 死球心跳（AC-B1）
- **Modify**: invocation lifecycle（复用 F194 liveness / F212 cliDiagnostics）→ `invocation.died` 事件含 `lastScanAt`
- **Test**: 模拟 invocation 中途死亡 → 死球进简报含最后扫描点（INV-8）

### Task 4: probe + resolve 二态 + 唤醒投递（AC-B2）
- **Modify**: task schema 增 `probe`（可执行判据）+ `resolveMode` 字段；ProbeScheduler（§C）注册进统一 scheduler
- **Test**: Repo Inbox 同型 fixture——bounces_back 球 probe 满足 → owner 收真实唤醒投递（红→绿，INV-6）

### Task 5: 简报数据源切换（5 源投影 → projection 读）
- **Modify**: `collectDutyBriefingInput` → 从 `BallCustodyProjectionStore` 读球态（替代 5 源 collect）；mention 启发式降级为 fallback（仅 projection 空窗期）；接入 F167 snapshot（Phase A 降级的 `f167SnapshotProvider`）
- **Test**: 同一 runtime 数据，新旧简报对比——dead 数收敛（339 虚高 → 结构化死球）、void 非 0（F167 接入）

### Task 6: 状态机不变量回归套（AC-B3）
- **Test**: §B 5 个对抗场景 + INV-1~8 + §C INV-P1~3 全覆盖；Redis-backed crash/并发场景

---

## Open Questions

**技术 OQ（实现中自决，已预决议）**：
- **OQ-2（intent 载体）**：`ball.handed_cvo` intent 来源 = 路由层默认推断（消息特征）兜底 + 可选猫侧 MCP 参数显式声明。**预决议**：先上路由推断（零猫侧负担），MCP 显式参数 Task 4 顺带。
- **OQ-4（probe 安全）**：probe 白名单 = 只读探测（curl GET / endpoint reachability / redis EXISTS），**禁任意 shell**（INV-P2）。白名单 enum 化，新增走 review。
- **OQ-5（断流聚合）**：account-level spend-limit 同根因聚合成单条「全家断流」告警（不逐球刷屏），按 `invocation.died.reason==='spend_limit'` 分组。
- **subjectKey 粒度（头号决策）**：`ball:thread:{threadId}` 为主轨 + `ball:task:{taskId}` 细分（task 有独立 owner/生命周期时）。**理由**：KD-1 不新建 ID，thread 是球流转的天然容器（对齐第二心愿 feat 轨迹）；多 task 并行 thread 用 task subjectKey 拆分避免混轨。
- **事件写入时机（hook vs tail）**：**预决议 hook**（路由/scheduler/invocation lifecycle 内联 emit，同步落账），不做 tail（日志回扫）——hook 与动作同事务，无回扫漂移窗口；tail 仅作 Phase C 历史回填手段。

**价值 OQ（→ CVO）**：无新增。Phase B scope 已在 feat doc 锁定，本 plan 未触碰愿景/不可逆边界（纯数据层 + 只读简报切源 + 唤醒投递可逆）。

---

## 我最可能错在哪（pre-register retraction，帮 reviewer 定向攻击）

1. **subjectKey 粒度**：若一个 thread 实际常有 >1 并行球而我按 thread 单轨，会混轨——reviewer 重点查「多 task / 多 @ 链并行的 thread」是否需要更细 subject。
2. **死球迟到心跳的 grace window**：真复活 vs 噪音的判别阈值是我拍的，可能误杀真心跳或放过假复活——查对抗场景 4 的边界。
3. **mention→intent 推断兜底**：路由层默认推断仍是启发式，只是从「简报时推断」前移到「写事件时推断」，可能没真消除假阳性、只是换了位置——查 INV-4 是否真把 dead/void 锁死在结构化源。
4. **简报切源的过渡**：Task 5 从 5 源切到 projection，projection 冷启动（事件流刚上线、历史球未入账）会短暂空窗——查冷启动期简报是否退化可接受。
