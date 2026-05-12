---
feature_ids: [F194]
related_features: [F048, F117, F173, F183]
topics: [invocation, liveness, redis, runtime-state, observability, message-pipeline]
doc_kind: spec
created: 2026-05-07
---

# F194: Invocation Liveness Canonical Read Model — 后端 invocation 活性真相源收口

> **Status**: in-progress (Phase A + B + Z + Z2 + Z3 + Z5 + Z6 + Z7 + Z8 + Z9 + Z9-hotfix + Z10 merged; Z4 was reverted before Z5. **Phase Z10 merged 2026-05-12 01:25 (PR #1640 squash `3e221535`)** — IDB-persist active state for F5 first-paint (R14 fix)。Bug：`offline-store.ts` snapshot 只保存 messages，不保存 activeInvocations → F5 后 store default `false` → first paint 显示"空闲" → fetchQueue async 返回后 re-render。Fix：DB_VERSION 2→3 + `thread-active-state` object store + `saveThreadActiveState`/`loadThreadActiveState` + write-through 在 fetchQueue success + race-safe restore in useChatHistory mount (WeakSet-tracked AbortController prevents reverse race per 砚砚 R1 P1)。Race window 从"直到 /queue 返回 (100ms+)"缩短到"直到 IDB load (10-50ms)"。 **待执行**: alpha re-test by 铲屎官 → 愿景守护 → close F194。 **Z9 hotfix merged 2026-05-11 23:35 (PR #1639 squash `b20ed491`)** — `safeParseExtra` 在 Redis 读路径上 silently strip `turnInvocationId` 字段（参数已写但读出来丢字段），导致 Z9 投影 contract 实际未生效。1-line parser fix + RED roundtrip test。这是 Z9 真正落地的 missing piece。**Phase Z9 merged 2026-05-11 08:30 (PR #1637 squash `49972d42`)** — canonical bubble identity contract + projection observability。Backend always-stamp `turnInvocationId` (9 persist sites + 6 live broadcast sites via `stampVisibleTurn` helper)。Route layer (route-serial + route-parallel) stamp `ownInvocationId` on yielded events (砚砚 R1 P1 fix)。Parallel done yield uses captured `ownInvId` not re-queried map (砚砚 R2 P1 fix)。Fast iteration path 铲屎官 approved — skipped cloud Codex review。**Phase Z10 spec opened**：AC-Z28 liveness identity invariant (R14) split to independent PR scope。**待执行**：alpha re-test by 铲屎官 → 愿景守护猫 sign-off → close F194 OR open Z10。) | **Owner**: 布偶猫/Opus-47 for Z9, reviewer 缅因猫/砚砚 | **Priority**: P1
>
> **AC-Z1 (alpha runtime acceptance) FAILED 2026-05-09 03:35** — 铲屎官实测 runtime 仍裂，根因比 Phase B 修的更深：F194 read-side helper 把 **parent recordStore invocation** 与 **per-cat-turn registry invocation** 当成同一 namespace 处理。bug-report `docs/bug-report/2026-05-09-f194-runtime-bubble-still-split-completion-leak/`，砚砚 2026-05-09 04:51 拍板走 Phase Z（namespace-aware canonical read model），见 KD-21~KD-23 + AC-Z1~Z5。
>
> Reviewer: 缅因猫/砚砚 (GPT-5.5)。立项基于 2026-05-07 thread `thread_mov3a7qva8mtsbs1` post-close diagnosis（F183 close 之后铲屎官报告"现在活跃的线程气泡都是裂的"，砚砚只读诊断捕到 `/api/messages` 与 `/api/threads/:threadId/queue` 对同一 thread 的 liveness 判定矛盾）。Architecture cell：`docs/architecture/ownership/cells/runtime-invocation-state` (待建/复用)。Map delta：none — 复用既有 `domains/cats/services/agents/invocation/` 边界，本 feat 在该 cell 内新增 read-model helper，不改 ownership map。

## Why

### 铲屎官原话（2026-05-07 19:14 / 19:21）

> "我发现现在 f184 183 改完之后好像气泡还是有问题…说实话只要是现在活跃的线程他们气泡都是裂的你好像可以自己去找个活跃的线程看？ 然后和我讲讲为什么捏？"
>
> "可以哦 你可以在 f183 记录一下这个 issue 和你的修复方案？然后找宪宪 46 或者 47 你看看谁合适讨论看看如何解决？ 因为这里太代码细节了 我对代码没你们了解 大概看了一下你的方向我觉得 ok"

### 现场症状（砚砚只读诊断）

F183 全 phase merged 后，铲屎官报告 active thread 气泡仍偶发裂成两条。砚砚在 3 个不同 thread 都采到同一型号 split-brain：

- `thread_mou6i2v6jpgo7utj`: `/api/messages` 返回 `draft-4a31dc69-…`/`draft-ffaa19de-…`，`/api/threads/:threadId/queue` 返回 `activeInvocations: []`
- `thread_mov3a7qva8mtsbs1`: `/api/messages` 返回 `draft-3270e743-…`，queue endpoint 返回 `activeInvocations: []`
- `thread_movcg5v7226tmg0q`: `/api/messages` 返回 `draft-bca7ca54-…`，queue endpoint 返回 `activeInvocations: []`

PR #1586 已修了一类局部 identity gap（local invocationless live bubble 与 server `draft-{invocationId}` 的 late-bind merge），但只要后端两个读模型对 liveness 的判定本身互相矛盾，前端 reconcile 仍会进入 "draft exists, active slot absent" 的 split-brain。

### 根因：后端三家 liveness store 语义不平权但被各自当真相源用

代码核对（`InvocationTracker.ts:43-65` / `messages.ts:1372-1499` / `queue.ts:97-110` / `DraftStore.ts:1-114`）：

| Store | 性质 | 语义 | 失败模式 |
|-------|------|------|----------|
| `InvocationTracker` | 进程内 `Map<slotKey, ActiveInvocation>` | 控制面（提供 AbortController、cancel/preempt） | 进程重启清空、跨实例不可见、非 lifecycle 真相源 |
| `InvocationRecordStore` (Redis) | 跨进程持久化 lifecycle record（status='running'/'done'/'error'，TTL 7d） | lifecycle 真相源 | 进程崩溃没 markDone → record 永远 stuck `running` = zombie |
| `DraftStore` (Redis 300s TTL) | per-invocation 内容缓存，stream/touch 刷 `updatedAt` | 内容 freshness 信号 | 不是 liveness 真相源；TTL 内可能 record 已死 |

`messages.ts:1407-1465` 的 draft merge 已经用 `recordActive || trackerActive` 双源 gate（F173 hotfix3 加的）。`queue.ts:108` 的 `activeInvocations` 只看 `invocationTracker.getActiveSlots(threadId)`。两边判定规则不一致 → 同一 invocation 在 messages 路径被认为 live、在 queue 路径被认为 idle。前端拿到两份打架的 truth，无论怎么 reconcile 都会出现裂气泡。

砚砚现场最像的失败路径：**API 进程重启过 → tracker 清空但 RedisInvocationRecordStore.status 还停在 'running'（进程崩溃时没机会 markDone）→ messages.ts gate 通过 `recordActive=true` 返回 live draft，queue.ts 因 tracker 空返回 `activeInvocations: []`**。F048 Phase A 的 startup sweep 已经处理了启动那一刻的 zombie，但有 race window，且不覆盖运行时新发生的（例如执行链跨进程／回调窗口期）残留。

### 不能只在前端补丁

PR #1586 修的是前端 reconcile 层，从根因上属于止血。后端 read 一致性不修好，前端再怎么 late-bind 都会偶发漏。F183 是消息管线架构收敛 + identity contract，scope 边界明确，不该 reopen 加 R2；F173 已 close 且范围是前端 thread-runtime state（spec line 78 audit 过 tracker vs record 但当时只做 cli-resolve cache invalidation）。F194 独立立项收口 **后端 invocation 活性 canonical read model + zombie detection + cleanup contract**。

## What

### 设计核心：分层语义 + 单 helper canonical view

不让 `messages.ts` 和 `queue.ts` 各自把三家 store inline 拼答案。新增一个 thread-scoped read-model helper，由两个消费方共用：

```ts
// packages/api/src/domains/cats/services/agents/invocation/getThreadLiveInvocations.ts
// （位置和 InvocationTracker / InvocationRecordStore / DraftStore 同 cell）

type LivenessSource = 'record+tracker' | 'record+draft' | 'record-only' | 'tracker+draft';
type LivenessReason =
  | 'tracker_present'
  | 'record_running_with_fresh_draft'
  | 'liveness_pending'
  | 'tracker_active_missing_record';

interface LiveInvocation {
  catId: CatId | null;
  invocationId: string;
  startedAt: number;
  source: LivenessSource;
  degraded: boolean;
  reason: LivenessReason;
}

interface ZombieRecord {
  invocationId: string;
  catId: CatId | null;
  recordStatus: 'running';
  recordUpdatedAt: number;
  reason: 'no_tracker_no_fresh_draft_age_exceeded';
}

interface LivenessReadResult {
  active: LiveInvocation[];
  /** 检测到的 zombie；不暴露给用户层 read endpoint，由 cleanup pathway 异步收尸 */
  zombies: ZombieRecord[];
}

interface LivenessReadDeps {
  /** Enumerate running records for (threadId, userId) — required so zombies are visible
   *  even when their drafts have already been TTL-reaped. */
  listRunningRecords: (threadId: string, userId: string) => Promise<InvocationRecord[]> | InvocationRecord[];
  /** InvocationTracker.getActiveSlots(threadId) */
  getActiveSlots: (threadId: string) => ActiveSlotInfo[];
  /** InvocationTracker.getUserId(threadId, catId) — guards cross-user collisions */
  getTrackerUserId: (threadId: string, catId: string) => string | null;
  /** DraftStore.getByThread(userId, threadId) */
  getDrafts: (userId: string, threadId: string) => Promise<DraftRecord[]> | DraftRecord[];
}

interface LivenessReadOptions {
  /** Override Date.now() (tests / deterministic replay) */
  now?: number;
  /** Window where draft.updatedAt counts as fresh (default 300_000ms = DraftStore TTL) */
  freshDraftWindowMs?: number;
  /** Grace past which a record-only running record (no tracker, no fresh draft) is judged
   *  zombie (default 600_000ms = 2× DraftStore TTL). Applies ONLY to no-fresh-draft case. */
  zombieGraceMs?: number;
}

async function getThreadLiveInvocations(
  threadId: string,
  userId: string,
  deps: LivenessReadDeps,
  opts?: LivenessReadOptions,
): Promise<LivenessReadResult>;
```

### Canonical 判定规则（砚砚 push back + R1 P1-1/P1-2 + R2 P1 后版本）

#### 决策表（按 candidate=(record?, draft?) 分类）

候选集 = `running records ∪ drafts`（双源 enumeration，R1 P1-1 fix）。对每个 candidate invocationId：

| record | tracker | draft fresh? | 判定 | source / degraded / 诊断 |
|--------|---------|-------------|------|-----------------------|
| running | active 且关联 | — | **live** | `source='record+tracker'`, `degraded=false`, `reason='tracker_present'` |
| running | missing 或无关联 | yes | **live (degraded)** | `source='record+draft'`, `degraded=true`, `reason='record_running_with_fresh_draft'`，emit `liveness_degraded` |
| running | — | no, age ≤ grace | **live (degraded)** | `source='record-only'`, `reason='liveness_pending'`（grace 期间继续暴露，避免误杀刚断链的合法 invocation） |
| running | — | no, age > grace | **zombie** | 不暴露 active；emit `record_zombie_detected`；进 `zombies[]` 供 cleanup |
| absent | active 且单射关联到此 draft | yes | **live (degraded)** | `source='tracker+draft'`, `reason='tracker_active_missing_record'`（messages.ts hotfix3 行为兼容，AC-B5） |
| absent | 其他 | — | **drop** | orphan filter |
| not running / wrong scope | — | — | **drop** | helper 不输出 |

#### Tracker association rules（R1 P1-2 + R2 P1 fix）

一个 tracker slot 只能"证明"一个 record/draft，依据：

- **STRONG**: `slot.startedAt ≤ draft.createdAt`（slot 在 draft 第一次创建时已经在跑——是它产出了这个 draft）
- **WEAK**: `sameCatRecords.length === 1 AND record.createdAt ≤ slot.startedAt AND !slotClaimedByOtherDraft`（同 cat 仅一条 running record，无歧义，且 slot 未被另一个 draft 强关联）

**R2 P1 cross-check**: 预计算 `slotClaimedByDraft: Map<catId, draft>`（earliest-anchored 那个赢）；当 candidate 的 catId 上 slot 已被另一个 draft 强关联，weak record-tracker 和 tracker+draft fall-back **都**会 fail。这避免了 cat slot 被回收时（旧 zombie record + 新 record-missing draft 共存）一个 slot 同时"证明"两个不相关 invocation 的 false positive。

> **关键点**：`record.updatedAt` **不是** heartbeat（record 写完后只在 markDone/markError/状态变化时再更新）；用 `draft.updatedAt`（stream chunk + touch 触发刷新）作 freshness 主信号。threshold 默认 `2 × DraftStore TTL ≈ 600s`，**仅适用于 no fresh draft 场景**，永远不杀 fresh draft。

### Phase A: Helper API + 单元测试（先定义 contract）

- 新增 `getThreadLiveInvocations.ts` + 单测覆盖上表 5 类组合 + helper 返回结构 stable
- 不接任何消费方
- contract 通过 review 后才进 Phase B

### Phase B (Bundle): 消费方迁移 + zombie cleanup + 运行时 diagnostic + alpha 验收 ⚠️ ALPHA FAILED → Phase Z

> **Single bundled phase（CVO ack 2026-05-08）**：原 4-phase 拆分（A/B/C/D 各一）调整为 **2-phase 拆分**——Phase A 已独立 merged（PR #1592, squash `4b5edfdd2`）；**消费方迁移 + zombie cleanup + diagnostic + alpha 全部合并为单一 Phase B (Bundle)** 一锅端做完一锅端 review。spec 真相源直接反映"single bundle"，避免子 step 之间的 review iteration 碎片化（详见 KD-12）。
>
> ⚠️ Phase B merged (PR #1603, squash `5c1ab366`) 但 **alpha runtime acceptance 失败**：铲屎官 2026-05-09 03:35 实测气泡仍裂。砚砚 04:51 拍板：F194 没 close，进 Phase Z 修 namespace 模型缺口（read-side helper 把 parent recordStore invocation 与 per-cat-turn registry invocation 当成同 namespace），Z 阶段不 close 不准 alpha 通过。

### Phase Z: Namespace-aware canonical read model（alpha runtime acceptance failure recovery）

> **Why this phase exists**：Phase B alpha 验收失败暴露 F194 一开始就坐在错坐标系上做的判断——`recordStore.invocationId`（parent，整条 multi-cat 链共享）与 `draftStore/tracker.invocationId`（child，per-cat-turn）不在同一 namespace，但 helper 把它们当一个空间处理。导致：parent record 还在跑（chain 未结束）+ 当前 cat turn 有 fresh draft + 它们 invocationId 不同 → helper 把它们当作两个 ghost identity → /queue dedup 取最早 startedAt（parent）→ slot 计时陈旧但内容是新的 → "气泡裂"。
>
> 砚砚 2026-05-09 04:51 直接拍板（rejecting both A=全量统一 namespace 和 C=helper 加 hotfix rule）：**走 B = canonical read model 加 namespace awareness，draft/tracker/formal-message 的现有 stamping 不动，helper 学会 parent↔child 映射**。

**namespace model（KD-21 spec'd）**：

```
parent invocation (recordStore namespace)
  ├─ id 来源: routes/messages.ts → invocationRecordStore.create()
  ├─ 生命周期: 整条 multi-cat 链（用户消息→所有 cat 串联→链结束 status=succeeded）
  ├─ 持久层: invoc:{id} hash + invoc:running:{tid}:{uid} set
  └─ 终态: 由 routes/messages.ts background async 在链 done 时写入

child turn invocation (registry namespace)
  ├─ id 来源: invoke-single-cat.ts → registry.create() (callback auth)
  ├─ 生命周期: 单 cat 单轮回复（一个 streaming 周期）
  ├─ 持久层: 无 — 只在 InvocationRegistry 短期保存（callback auth 用）
  ├─ 关联: route-serial 把 ownInvocationId 写进 draftStore + 作为某些 formal message 的 stream invocationId
  └─ 与 parent 的关系: 通过 routes/messages.ts:878 `parentInvocationId` 传入；child 不显式记录 parent 反向指针

draft (registry namespace)
  ├─ key: (userId, threadId, ownInvocationId)  ← child id
  └─ 同 parent invocation 不同轮 → 不同 child id → 不同 draft

formal message (parent namespace)
  ├─ extra.stream.invocationId = options.parentInvocationId ?? ownInvocationId（**parent 优先**）
  └─ 同 parent 多个 cat turns 的 formal message 共享 parent id

tracker (cat-level only)
  └─ 不记 invocationId，只记 catId+startedAt+controller
```

**Z 子任务**：

**Z1 — Spec namespace model + AC-Z 编号化（先于代码）**：
- 加 KD-21（parent/turn invocation namespace）+ KD-22（namespace-aware helper 设计）+ KD-23（runtime acceptance hard gate）
- AC-Z1~Z5 入 spec
- bug-report 链入 Links

**Z2 — RED tests 四类（先红，砚砚 R1 P2 加 parallel）**：
- Z2-α: parent recordStore invocation P1 status=running + 同 thread 同 cat 有 child fresh draft（child registry id ≠ parent record id，但 `child.parentInvocationId == parent.id`）+ tracker slot present → helper 输出 1 个 active source=`parent+child+tracker`，startedAt 优先取 child draft/turn 时间不取 parent.updatedAt
- Z2-β: 同 α 但 tracker missing → helper 输出 1 个 degraded active source=`parent+child-draft`，依然算 live（**不能因为 tracker 丢就漏掉合法恢复，砚砚 R1 P1-2**）
- Z2-γ: parent record 已经 emit 过 formal message（即使 multi-cat chain 中途）+ 该 parent 没活 child draft + 同 cat tracker slot 已被新 parent record 占用（通过 `getLatestTurnInvocationId` 反向定位） + **没有** `hasParentRouteCompleted(parent.id)` 信号 → helper **不**做 instant succeeded（砚砚 R1 P1-3：formal message 不能当 chainDone 证据），只 suppress ghost slot + 输出 namespace diagnostic event；这条 record 留给 producer Z4 finally 处理或后续 zombie sweep
- Z2-δ: route-parallel 场景（砚砚 R1 P2）— 同 parent 串多 cat（opus + codex）各自有活 child draft，每个 cat 独立映射；helper 输出 2 个 active（catId opus + codex），不互相挤掉；不同 parent 但同 catId 时取 latest turn 的 parent

**Z3 — Helper namespace-aware 实现（砚砚 R1 P1-1 修正：dep 不能黑盒 boolean）**：
- 新增 dep（read-only，复用 InvocationRegistry 既有能力，验证 `parentInvocationId` 字段已存在 + `getLatestId(threadId, catId)` 已存在）：
  - `getTurnInvocation(invocationId): Promise<{ parentInvocationId, threadId, catId, createdAt } | null>` — 包装 `registry.getRecord(invocationId)`
  - `getLatestTurnInvocationId(threadId, catId): Promise<string | null>` — 包装 `registry.getLatestId`
- helper 入口先 build namespace index：遍历 `getDrafts()` 返回的 drafts，对每个 draft 通过 `getTurnInvocation(draft.invocationId)` 拿 parentInvocationId，构 `parentToChildren: Map<parentRecordId, Array<{childTurnId, draft, turnCreatedAt}>>`
- helper `tryRecordGraceOrZombie` 加前置（按砚砚 R1 P1-2 修正）：
  - parent record running + parent 有 mapped child fresh draft + tracker slot present → active source=`parent+child+tracker` startedAt=earliest child turn createdAt（**P1-2: tracker present 也保留 parent classification，不退到 child-only**）
  - parent record running + parent 有 mapped child fresh draft + tracker slot missing → degraded active source=`parent+child-draft` startedAt=earliest child turn createdAt（**P1-2: tracker 丢不漏 live**）
  - parent record running + 无 mapped child draft + 同 catId tracker slot 已被其他 parent 占用（`getLatestTurnInvocationId(thread, cat)` 反查 parentInvocationId ≠ self）+ **本 parent 自己**没 emit formal message → instant zombie failed（cat slot reused + 没产出 = dead）
  - parent record running + 无 mapped child draft + 同 catId tracker slot 已让位 + 本 parent **emit 过** formal message → 不 instant succeeded（**砚砚 R1 P1-3 否决**），只 suppress ghost slot + 输出 namespace diagnostic event；succeeded 终态由 Z4 producer finally 决定，read-side 不背锅
- 同 thread+cat 输出最多 1 个 UI slot（dedup by catId 现有规则继续生效，但 startedAt 来源换成 child turn createdAt 优先）

**Z4 — Producer defensive try/finally（CAS-aware，砚砚 R1 P1-3 修正：read-side 不擅自终态化）**：
- `routes/messages.ts` background async 的最外层 finally：
  - 用本 reqId scope 的 `invocationRecordStore.get(parentId)` 拿当前 status；若已经 terminal（CAS 守护），跳过
  - 若仍 running：**新增 dep `hasParentRouteCompleted(parentId)`**（routeExecution 自己设置一个 in-memory map：start 时 set('pending')，正常 done 时 set('succeeded')，error 时 set('failed')；finally 里读这个 map 决定 succeeded 还是 failed），CAS expectedStatus=running 写终态
  - 没 chainDone 证据时（map 缺失/超时） → 兜底 failed(error='producer_left_running_no_terminal') + 加 warn log（防止状态机卡死，但用 expectedStatus 守护避免覆盖任何已 terminal）
- 加 trace log 每个 status update：`reqId/invocationId/from→to/source(success|abort|fail|fallback)`
- routeParallel 同样改

**Z5 — Runtime regression + alpha + 愿景守护**：
- 整合测试用 fastify 真启动 + 真 Redis（test:redis isolation）+ 真 streaming mock，复现 Z2-α/β/γ
- alpha 通道（`pnpm alpha:start` 6398 隔离）实测：复现 thread + 多轮 multi-cat 串联，气泡不再裂
- 愿景守护：非作者非 reviewer 猫（暹罗猫 / 孟加拉猫）拉一遍 alpha，对照铲屎官原话出对照表

**Z 阶段必须三层都过 + alpha 证据齐备 才能 close F194**——砚砚 hard gate（spec 之外不接受 partial close）。

**B1 — 双消费方迁移（messages + queue）**：
- `messages.ts:1407-1465` 现有 inline `recordActive || trackerActive` gate 迁移到 helper（保留现有过滤行为：active drafts 只保留 helper 认为 live 的，但接受 `degraded` flag）
- `queue.ts:108` 的 `activeInvocations` 替换为 `helper(threadId, userId).active`，语义升级为 "服务端 canonical live view"
- 双源 enumeration 由 `IInvocationRecordStore.listRunningByThread(threadId, userId)` 支持（in-memory filter / Redis index Set）

**B2 — Zombie cleanup pathway**：
- helper 输出的 `zombies[]` 由独立 cleanup pathway 异步消费（不阻塞 read 路径）
- 复用 F048 Phase A 的 `StartupReconciler` 加入运行时 sweep 接口（cron 或 demand-triggered）
- zombie 收尸语义沿用 F048：标 `failed(error='zombie_record_detected')` + 清 TaskProgress

**B3 — Runtime diagnostic + fallback metric**：
- 结构化事件 schema：`liveness_degraded` / `liveness_pending` / `record_zombie_detected` / `liveness_fallback`（fail-open 频率），字段含 `threadId`/`catId`/`invocationId`/`recordStatus`/`recordUpdatedAt`/`trackerSlotPresent`/`draftFresh`/`draftAge`/`reason`
- 接 logger（参照 F183 Phase C `broadcast_rate_warn` 的范式）
- helper 暴露 optional `onLog?` callback，callsite 注入 logger 写结构化事件

**B4 — API regression + alpha 验收**：
- API regression（route-level paired tests）：构造三类 split-brain 场景，断言 `/api/messages` 与 `/api/threads/:threadId/queue` 返回一致
- alpha 通道实测：record+tracker missing+fresh draft 场景验证 degraded 暴露；record+tracker missing+no fresh draft+age 超阈值场景验证 zombie cleanup
- 愿景守护：非作者非 reviewer 的猫确认"裂气泡"症状在 active thread 不再复现

## Acceptance Criteria

### Phase A（Helper API + 单测）

- [x] AC-A1: `getThreadLiveInvocations.ts` 落地，签名含 `(threadId, userId, deps, opts?)` → `LivenessReadResult`
- [x] AC-A2: 返回结构含 `active[]`（`source`/`degraded`/`reason`）+ `zombies[]`，类型导出供消费方 import
- [x] AC-A3: 单测覆盖判定表 5 类组合（normal live / degraded with fresh draft / zombie / pending grace / not running）
- [x] AC-A4: 单测断言 `zombies[]` 与 `active[]` 互斥（同一 invocationId 不能同时在两个数组）
- [x] AC-A5: helper 不写 store（read-only），cleanup 由 Phase B (Bundle) 独立 pathway 消费 `zombies[]`
- [x] AC-A6: threshold 走 opts 注入（默认 `2 × DraftStore TTL = 600s`）便于测试 / alpha 调参

### Phase B (Bundle)（消费方迁移 + cleanup + diagnostic + alpha 一锅端）

> 单一 bundled phase 内的所有 AC 共同决定 PR 是否可 close（编号连续，不分 sub-phase）。

- [x] AC-B1: `IInvocationRecordStore.listRunningByThread(threadId, userId)` 接口 + in-memory + Redis index-backed Set 实现 + 单测覆盖（B1 prerequisite for double-source enumeration）
- [x] AC-B2: `messages.ts` 现有 `recordActive || trackerActive` inline gate 迁移到 helper；保留 P1-2 dedup（formal invocationId set）+ wider window + fail-open + AC-B5 hotfix3 兼容
- [x] AC-B3: `queue.ts` 的 `activeInvocations` 改为 helper 输出（`active.filter(catId != null).map(s => ({ catId, startedAt }))`，保持现有 schema 不破前端契约；null catId 过滤防 phantom UI cat slot）
- [x] AC-B4: queue-side route regression（canonical path / record-missing recovery / helper fail-open / legacy fallback / null catId filter）
- [x] AC-B5: paired-route consistency regression：构造 record running + tracker missing + fresh draft → `/api/messages` 与 `/queue` set-equality 一致；构造 zombie 场景 → 两端都 filter
- [x] AC-B6: 既有 `messages.ts` F173 hotfix3 orphan-draft filter 行为不退化（`draft-messages-merge.test.js` 20/20 pass，含 4 个 hotfix3 测试；R6 P1 把 gate 收敛到 only-recordStore-required）
- [x] AC-B7: cleanup pathway（`reconcileZombies`）落地，标 `failed(error='zombie_record_detected')` + 清 TaskProgress + audit log；messages.ts/queue.ts callsite 在 helper 返回 zombies 后 fire-and-forget 调用，route-level integration test 验证 record 真的从 running → failed
- [x] AC-B8: cleanup 不阻塞 read 路径——helper 永远 read-only；callsite 用 `void reconcileZombies(...).catch(log.warn)` 异步消费 zombies[]
- [x] AC-B9: cleanup 单测 6 个：reconciled + TaskProgress cleared + audit log (B7) / idempotent state-machine guard (B10) / missing record / mixed batch / TaskProgress error tolerance / empty input
- [x] AC-B10: cleanup 幂等——state machine guard `expectedStatus='running'` 让 `failed → failed` self-transition 失败，第二次调用返回 `alreadyTerminal=1`，无 duplicate audit 也无错误 status
- [x] AC-B11: `LivenessEvent` schema 落地（`liveness_degraded` / `liveness_pending` / `record_zombie_detected`），fallback 用 `liveness_fallback` log kind 标记；字段含 threadId/userId/invocationId/catId/source/reason/recordStatus/recordUpdatedAt/trackerSlotPresent/draftFresh/draftAge
- [x] AC-B12: helper `onLog?` callback dep 落地，emitLivenessEvent 在 degraded live + zombie 决策点 emit；sink throw swallowed 不中断 read；7 个 onLog 单测（degraded/pending/zombie 各 1 + healthy 不 emit + 多事件 + sink throw + 无 onLog backward compat）
- [x] AC-B13: fallback frequency metric — messages/queue callsite catch 路径写 `kind: 'liveness_fallback'` + endpoint 字段；onLog event 也用 `feature: 'F194'` 标记（不覆盖 helper.source）便于查询
- [ ] AC-B14: alpha 实测：active thread 在正常 stream 期间无 `liveness_degraded` 噪音（false positive 检查） ⚠️ FAILED 2026-05-09 — 见 Phase Z
- [ ] AC-B15: alpha 实测：构造 record+tracker missing 场景，`/api/messages` 与 `/queue` 不再矛盾，前端不再裂气泡 ⚠️ FAILED 2026-05-09 — 见 Phase Z
- [ ] AC-B16: 愿景守护：非作者非 reviewer 猫输出对照表（铲屎官原话 vs 实际状态），确认 active thread 裂气泡不复现 ⚠️ 因 B14/B15 fail 推迟到 Phase Z 完成后

### Phase Z（namespace-aware canonical read model + alpha 复测）

- [x] AC-Z1: spec 落地 namespace model（KD-21）：parent recordStore invocation vs per-cat-turn registry invocation 在 helper / store / draft / tracker / formal message 各层的语义边界写清楚 ✅ PR #1614 (commit `7443d049e`)
- [x] AC-Z2: helper 加 namespace-aware dep（**砚砚 R1 P1-1 修正：结构化数据不黑盒 boolean**）：`getTurnInvocation(invocationId): {parentInvocationId, threadId, catId, createdAt} | null` + `getLatestTurnInvocationId(threadId, catId): string | null`（复用 registry 既有 parentInvocationId 字段 + getLatestId）。Helper 四类前置规则（**砚砚 R1 P1-2/P1-3 修正**）：(α) parent running + mapped child fresh draft + tracker present → 1 active source=`parent+child+tracker` startedAt=earliest child turn createdAt；(β) 同 α 但 tracker missing → 1 degraded active source=`parent+child-draft`；(γ) parent running + 无 child draft + 同 cat slot 已被新 parent 占用 + 本 parent **没** emit formal message → instant zombie failed；(γ') 同 γ 但本 parent emit 过 formal message → **不**做 instant succeeded（formal message 不能当 chainDone 证据），仅 suppress ghost slot + 输出 namespace diagnostic event ✅ PR #1614 (含 cloud R1+R2 P1 修正：iterate ALL targetCats + gate on fresh-draft activity)
- [x] AC-Z3: producer defensive try/finally（routes/messages.ts background async 最外层）：新增 `hasParentRouteCompleted(parentId)` 信号（routeExecution 内部 in-memory map：start→pending, done→succeeded, error→failed），finally 读这个 map 决定终态；CAS expectedStatus=running 守护避免覆盖；map 缺/超时 → 兜底 failed(error='producer_left_running_no_terminal')。trace log 记录 reqId/from→to/source。routeParallel 同样改 ✅ `ensureTerminalStatus.ts` + `RouteChainCompletionTracker`
- [x] AC-Z4: RED tests 四类（**砚砚 R1 P2 加 parallel**）：Z2-α/β/γ + Z2-δ（parallel 同 parent 多 child drafts / 多 cat active 不互挤）各 1 个 unit + 1 个 routes integration test 覆盖 namespace race；producer try/finally 覆盖正常 / 异常 / abort + chainDone signal 缺失三路径 ✅ 95/95 namespace + ensure-terminal + routes-integration（含 R4/R5 cloud P2 + cross-parent same-cat dedup + parent-level zombie aggregation）
- [x] AC-Z5: alpha 通道实测复现 thread + 多轮 multi-cat 串联气泡不再裂；F194 close 前必须有 alpha runtime 截图/日志 evidence + 愿景守护猫对照表（hard gate by 砚砚 2026-05-09） ✅ 愿景守护猫对照表 by 宪宪/Opus-46 2026-05-09（runtime HEAD `0807f4165`，含 Phase Z merge `7443d049e`；铲屎官 05:11 重启 runtime 后 visual confirm 不裂 + opus-47 API diagnosis `/queue` = 1 active no ghost split + 宪宪/Opus-46 代码审计 + 26/26 unit tests pass）⚠️ 17:09 砚砚发现 acceptance 漏 ideate/parallel 场景 → Z2 重做
- [x] AC-Z6 (Z2 extension): `route-parallel.ts` 调 `invokeSingleCat` 必须传 `options.parentInvocationId`，与 `route-serial.ts:725` 对齐。RED test 覆盖 ideate 多猫场景：parallel chain 的 child registry record 必须有 `parentInvocationId === 当前 parent record.id`；helper 不能再把 parallel parent + child 误判为 `tracker+draft_missing_record` ✅ PR #1617 squash `1fa6ed229` (砚砚 R APPROVE + 云端 LGTM "Can't wait for the next one!")
- [ ] AC-Z7 (Z2 extension): KD-23 四件套重做（含 ideate 场景）— 单测 + 集成测 + alpha runtime + 守护猫对照表新增"ideate 双猫并行 parent/child namespace bridge"行 ⏳ pending Z3 完结后一起做
- [ ] AC-Z8 (Z3 spec): 双 id 边界文档化 — `chainInvocationId(parent)` 负责 liveness/queue/cancel，`turnInvocationId(child/bubble)` 负责前端 hydrate/merge/cache stable key。formal/live/draft message schema 同时带 parent + turn id；legacy 消息 fallback parent，但新路径不得继续污染
- [x] AC-Z9 (Z3 implementation): 后端 `messages.ts` / `route-serial.ts` / `route-parallel.ts` formal message 持久化加 `extra.stream.turnInvocationId`；前端 `mergeReplaceHydrationMessages` / `getBubbleInvocationId` / reducer stable key 至少各一层锁，优先用 turn id；RED test 覆盖：(a) 同 parent 下 `opus → codex → opus` 两个 opus bubble 不合并；(b) refresh 后仍三条 bubble；(c) 第三个 opus 的 active/cancel 状态不挂到第一个 opus 上 ✅ PR #1619 squash `79d53ada7` (含 R15-R21 cloud Codex 7 轮 P1：13 suppression callsites + 4 deriveBubbleId callsites + active invocation_created turn-extract + boundary cleanup turn-aware + local placeholder fallback turn-priority + invocationless callback fallback turn id)

### Phase Z4（live ≡ hydrate canonical state — alpha runtime acceptance failure recovery）

- [ ] AC-Z10 (Z4 spec): live event replay 出来的 bubble 列表必须收敛到 `/messages` hydrate canonical 状态。具体：bg path 的 web_search/rich_block/thinking 三处 placeholder 创建路径必须用 `deriveBubbleId(turnInvocationId ?? invocationId, catId, fallback)`，跟 Z3 后端 persist 用同一 deterministic id 公式，hydrate 后 server canonical id (`msg-{turn}-{cat}`) 直接命中现有 placeholder → 单一 bubble 不分裂。背景：铲屎官 2026-05-10 02:30 alpha 实测 F5 后正常但 F5 前多余气泡 + at 顺序错；砚砚 02:30 root cause analysis：live event 没带对 turnInvocationId，placeholder id 是 live-only `bg-X-${Date.now()}-...`，hydrate 时 server canonical id 是 `msg-{turn}-{cat}` → 两个 bubble 共存于 live。
- [ ] AC-Z11 (Z4 implementation): `useAgentMessages.ts:505` (web_search) + `:571` (rich_block) + `:681` (thinking) 三处 placeholder 创建改用 `deriveBubbleId(turnInvocationId ?? invocationId, catId, () => fallback-bg-X)`。当 invocationId 已知（catInvocations 里有），返回 `msg-{turn}-{cat}` deterministic id；只有 invocationId 完全未知时（罕见 race，在 invocation_created 之前）才用 fallback non-deterministic id。RED test 覆盖：thinking event 在 first text 之前到达，placeholder 用 deterministic id，subsequent text chunk 命中同一 bubble，hydrate 后无分裂。

### Phase Z5（state coherence reconciliation — 4 bug 一锅端）

> **背景**：2026-05-10 04:42~05:01 铲屎官 alpha 实测 + opus-47 / GPT-5.5 / opus-46 三猫独立诊断，发现 Z3/Z4 合入后 4 个新/加剧问题。铲屎官原话："前后端根本不一致了！" "你们这两个z3 z4之前以前就算有裂开的两个气泡不需要f5就能合并 现在不能了！" "我并发at 47和55但是观点采样竟然是独立观点 只有47？" "结果竟然是46 你们的上个pr 和上上个pr可能都有问题"
>
> **共同根因模式**（砚砚归纳）：系统某一层（reducer / activeInvocations / participantsActivity）的"事实"语义，跟用户在 UI 上看到的/操作时心智模型，**没对齐**。不是 4 个独立 bug，是同一 canonical contract 缺失的 4 种表现。
>
> **KD-24（revert decision）**：opus-47 strong 建议 revert Z4 squash `0648b597`（保留 Z3）—— Z4 的 `deriveBubbleId` id 公式方向错误（`msg-{turn}-{cat}` 不带 kind suffix，与 reducer `msg-{turn}-{cat}-{kind}` 不对齐），留在 main 会持续制造 Bug A + Bug B。铲屎官拍板后执行。⏳ pending

#### Bug A — bubble id 方言冲突

**症状**：同一 turn 里 Thinking + CLI Output 分裂成两个 bubble。F5 后正常（hydrate 用 server canonical id 重建）。
**根因**（opus-47 诊断）：
1. Z4 `deriveBubbleId()` 创建 placeholder at `msg-{turn}-{cat}`（**无 kind suffix**）
2. thinking event 进 → bubble 初始为 `assistant_text`
3. tool_use event 进 → `appendToolEvent` 把 toolEvent 加到 bubble → `deriveBubbleKindFromMessage` 漂移成 `tool_or_cli`
4. text event 进 → reducer `findExistingByStableKey` (bubble-reducer.ts:191) 比 kind：`tool_or_cli ≠ assistant_text` → 不 match → 创建新 bubble at `msg-{turn}-{cat}-assistant_text`
5. 两个 bubble 共存 = 截图完全匹配

**同时**：后端 hydrate id 是 nanoid（`generateId()`），不是 `msg-{turn}-{cat}` → Z4 假设的"live id == hydrate id 字面相等"**根本不成立**。

- [x] AC-Z12: 统一 bubble id 公式。**Decision: Option A — Roll back Z4 helper `deriveBubbleId` 改动**（opus-47 R1 review on Z5 spec 2026-05-10 12:07 commit）：✅ PR #1622 squash `3b3c6b33` (Z4 已 revert in `e2eacd0e9`，helper 不再创建 placeholder id；reducer 单写者)
  - **Option A 选定** — helper 只 lookup existing bubble（用 stable key match `getBubbleInvocationId`），bubble 创建+id 让位给 reducer 单写者
  - **为什么 reject Option B** — helper 创建 placeholder 时不一定知 eventKind（empty placeholder 可能在第一个 event 之前就建好），即使 helper 带 kind suffix，也会出现"placeholder kind = assistant_text 但后续 tool_use event 的 reducer fallback id 是 tool_or_cli"的同一类不对齐
  - **为什么 reject "不动 helper"** — Z4 helper 改动留在 main 会持续制造 Bug A + Bug B，必须撤回（KD-24 revert decision pending @landy）
  - RED test 必须覆盖：thinking → tool_use → text 事件链下，始终只有 1 个 bubble；id 来源是 reducer 而非 helper
- [x] AC-Z13: hydrate canonical id（server nanoid）与 live placeholder id 的对齐机制文档化。Z4 假设两者字面相等是错的；正确机制是 `mergeReplaceHydrationMessages` 用 `(catId, getBubbleInvocationId)` stable key 做 **语义 match**，不是 id 字面比较 ✅ Phase Z5 spec section 已记录

#### Bug B — live reconcile 缺失

**症状**：Z3/Z4 之前裂了的两个气泡能自动合并回来（不需要 F5）；Z3/Z4 之后只能靠 F5。
**根因**（砚砚诊断）：Z3/Z4 收紧了 `findExistingByStableKey`（要求 turn id 一致 + bubbleKind 一致）和 `findUpgradableLocalPlaceholders`（只升级无 stream invocationId 的 local placeholder）。一旦两个裂开的 bubble 都带了 `extra.stream`、或 kind 不同，就不再是"可升级/可合并"的候选。

- [x] AC-Z14: 加 live reconcile pass。同 `threadId + catId + turnInvocationId` 下的分裂候选可安全合并回单一 assistant container。✅ PR #1622 squash `3b3c6b33` — bubble-reducer findExistingByStableKey 优先级：(1) 严格 (actor, turn, kind) 匹配 (2) empty assistant_text placeholder 吸收 (gate `event.bubbleKind !== 'system_status'`，R5 cloud Codex P1 修)。规则必须比旧 heuristic 严格：
  - 不能跨 turn
  - 不能跨 cat
  - 不能跨 parent chain
  - 不能吞掉 callback final
  - **kind 漂移处理**（opus-47 R1 add）：bubble 一旦绑定 stable invocationId，`deriveBubbleKindFromMessage` 漂移**不应**触发新 bubble 创建；reconcile pass 必须能把 kind-misclassified 的 split 合回主容器（除非 ADR-033 明确要求独立 bubble，例如 callback final 的独立 origin）
  - RED test：(1) 先制造两个 live bubble（thinking + text 各一个），不 F5，后续 callback/done 到达后必须自动收敛成一个；(2) thinking → tool_use → text 串起来后，bubble kind 漂移期间不能产生新 bubble id

#### Bug C — 采样面板缺猫

**症状**：并发 @ opus-47 和 GPT-5.5，"独立观点采样"面板只显示 opus-47。
**根因**（opus-46 诊断 + 砚砚补充）：`deriveActiveCats()` (`status-helpers.ts:48-71`) 只看 `activeInvocations` slots。猫完成后 `markThreadInvocationComplete` → `removeActiveInvocation` 清 slot → 面板从"两只猫采样"塌成"一只还在跑的猫"。

- [x] AC-Z15: ideate mode 下 `ParallelStatusBar` 保留本轮 `targetCats` 全集 + 每猫最终状态（done ✓ / streaming / error ✗），不因 slot 移除而丢失卡片。✅ PR #1622 squash `3b3c6b33` — `deriveActiveCats` 在 `intentMode === 'ideate'` 且 `hasActiveInvocation` 时 fallback 到 `targetCats ∪ snapshotCats` UNION。R7 还覆盖了 RightStatusPanel + MobileStatusSheet (cloud Codex P2: 跨 panel coherence)。实现：`deriveActiveCats` 在 ideate mode 下 fallback 到 `targetCats` union（不只看 active slots）。RED test 覆盖：猫 A 完成后猫 B 仍在 streaming → 面板仍显示两张卡片

#### Bug D — 无 @ 留言 fallback 错猫

**症状**：铲屎官最后 @ 的是 opus-47 和 GPT-5.5，但下一条无 @ 留言 fallback 召唤了 opus-46。
**根因**（opus-47 诊断 + 代码定位）：`AgentRouter.resolveTargets` 无 @ fallback 走 `participantsWithActivity` 按 `lastMessageAt desc` 排序，`find` 拿最近发言的健康猫。opus-46 刚发了 vision guard 对照表 → `lastMessageAt` 最大 → 被 fallback 选中。
**用户心智模型**：fallback = "我上一条消息 @ 的最后那只猫"，不是"thread 里最近发言的猫"。

- [x] AC-Z16: 无 @ fallback 优先使用"上一条 user message 的 `mentions` 列表"作为候选集。只有 mentions 为空（从未 @ 过）时才 fallback 到 `participantsWithActivity`。✅ PR #1622 squash `3b3c6b33` — `findRecentUserMentionFallback` 分页 loop (R4) + SYSTEM_USER_IDS 排除 (R5+R6, scheduler+system) + 1h cutoff 仅对 user msg (R8) + effective score (deliveredAt ?? timestamp) cursor (R9, 砚砚 R8 P1) + page-level cutoff early-stop (R11, 砚砚 R10 P2) + 去掉 Z5_MAX_PAGES (R10, cloud Codex P2)。8 轮 cloud + 4 轮砚砚 review 共 14 个 P1/P2/nit 收敛。
  - **user message 严格定义**（opus-47 R1 add）：`message.userId !== null && message.catId === null`。Cat-to-cat handoff（A2A 转场 chip）+ vision guard 等 cat 自发消息**不计**，否则同样会被"最近发言猫"语义污染
  - **时间窗口**（opus-47 R1 add）：只回看最近 N 条 user messages（建议 N=5 或时间窗口 1h），防止远古 mentions 主导 fallback；可走 `messageStore.getRecent(threadId, { limit: N })` 反序列扫
  - RED test 覆盖：(1) user msg1 @ A+B → cat C 发言 → user msg2 无 @ → fallback 应选 A 或 B，不选 C；(2) user msg1 @ A → 远古 user msg N 个迭代后无 @ → fallback 不能拿 N 步前的 A（除非时间窗口允许）

> **scope 边界说明**：Bug D 严格来说是 `AgentRouter` 路由语义问题，不是 invocation liveness read model。但铲屎官明确说"这就是 f194 的遗留而不是新增一个 feat"，且 D 是在 F194 acceptance 场景中暴露的，归入 F194 scope 避免碎片化。

### Phase Z6（acceptance residue — live rich self-heal + single-cat fallback）

Phase Z5 合入后的 alpha re-test 又抓到两个剩余边界：

1. **Bug A2 / R9**：rich/audio `system_info` 可能在 `done` 已 finalize 主 stream bubble、active refs 被清掉之后到达。active rich-block fallback 没查 just-finalized stream ref，导致 live 侧新建一个临时小气泡；F5 后 hydrate 只返回 canonical 单消息，所以小气泡消失。
2. **Bug D2 / R10**：Phase Z5 把 no-@ fallback 改成上一条 user mentions 的完整集合。铲屎官澄清实际语义：上一条 @ 了 47 + 55 时，下一条无 @ 应该从这两只里确定性选 **一只**，不是重新并发两只。

- [x] AC-Z17: invocationless rich/audio block after `done` attaches to the just-finalized stream bubble, not a new placeholder. ✅ PR #1623 squash `24eb56e3` — active path uses `findInvocationlessStreamPlaceholder` before creating a new assistant bubble; background path reuses `finalizedBgRefs` before `bg-rich-*` creation. Cloud review P1s narrowed both fallbacks to invocationless late events only so explicit new-turn rich/audio cannot splice into the prior bubble. RED tests: `useAgentMessages-richblock-correlation` AC-Z17 (`done` → late rich_block) stays one bubble + explicit rich_block does not attach to previous finalized bubble; background system-info test covers the same guard.
- [x] AC-Z18: no-@ fallback returns a deterministic **single** cat from the previous user message mentions. ✅ PR #1623 squash `24eb56e3` — `findRecentUserMentionFallback` keeps Z5 paging / system filtering / effective-score semantics but returns `[routable[0]]` instead of the whole set. RED tests update F078 superseded case + AC-Z16 no-mention case.

### Phase Z7（live-only provisional duplicate cleanup）

Phase Z6 后 alpha re-test 继续抓到 live-only residue：同一 assistant response 在 live state 中可见为 canonical stream bubble + local-only provisional duplicate；F5 后 `/messages` hydrate 只保留 canonical bubble。根因是 reducer 的 terminal path 只 finalize canonical bubble，没有在 canonical sibling 已存在时清理同猫、更早的 local-only stream sibling。

- [x] AC-Z19: terminal completion reconciles local-only stream siblings. 当 `done` / exact-key `callback_final` 已命中 canonical bubble 时，删除同 cat、同 terminal 时间之前的 local-only `origin='stream'` provisional siblings；没有 canonical sibling 时不删；timestamp 晚于 terminal event 的 local-only bubble 视为下一轮，不删；terminal event 缺 timestamp 时不执行 sibling cleanup（云端 Codex R1 P1，避免误删下一轮 placeholder）。✅ PR #1625 squash `96c76bad` — RED→GREEN: `bubble-reducer.test.ts` F194 Z7 三个 case（drop older duplicate / preserve newer next-turn local placeholder / missing timestamp guard）。

### Phase Z8（unified canonical bubble projection — Z1-Z7 终止符）✅ PR #1632 squash `49814778`

Z7 alpha re-test 后 (2026-05-10 19:55~20:30) 铲屎官 catch："F5 后变 1 个 这是同一次回复 thread id 好像你就得随便打开浏览器去找一个thread 看看 大概率都是裂开的？" — 普遍现象，不是边缘 race。

**根因（opus-47 + 砚砚 + opus-46 三猫独立诊断收敛）**：
1. Backend `/messages` 真的存了多条 raw assistant records 共享同一 `extra.stream.invocationId`、`turnInvocationId` 全部为空。例如 thread `thread_moyfjyjc0662weit` opus 同 invocation `2fe279aa` 有 3 条 records (2 stream + 1 callback)，对应 3 段独立内容。
2. Hydrate (`mergeReplaceHydrationMessages`) 用 `(catId, invocationId)` streamKey + last-wins 收敛 → F5 后只显示 1 个 bubble。
3. Live reducer 用 ADR-033 kind 隔离 + stable key match 创建独立 bubble，多个 raw records → 多个 live bubble，跟 hydrate 投影规则不一致。

**KD-27（Phase Z8 方向选择，三猫共识）**：
- ❌ **bottom-up**：给 backend 每条 raw record stamp 新 turnInvocationId — 会让 hydrate 也按 turn id 拆 → 失去 F5 后收敛行为，副作用更糟（opus-47 R0 提案，砚砚 + 46 push back）
- ✅ **top-down**：定义统一 canonical bubble projection contract，**raw records 不动**，让 live reducer 跟 hydrate **共享同一 projection 规则**。一处改、两处效果一致

**Z8 不是"再补一个 reducer 小洞"——是给 Z1-Z7 7 轮 patch 画上句号的 contract 层修法。**

- [x] AC-Z20: 定义 canonical bubble projection function（pure，无副作用）：✅ PR #1632 squash `49814778` — `packages/web/src/stores/bubble-projection.ts` 实现 `projectCanonicalBubbles({ records })`，group by `(catId, getBubbleInvocationId(msg))`，callback 优先 origin/canonical id，content 按 ts asc concat，toolEvents/rich blocks 去重，contentBlocks merge，callback-aware isStreaming。Alpha 真实 3-record fixture (`z8-alpha-3-records.json`) RED→GREEN 9 tests。
  - 输入：raw `ChatMessageData[]` (assistant only)
  - 输出：canonical `ChatMessage[]`（每个 (catId, invocationId) 一个 bubble）
  - 合并规则：
    - **Group**: by `(catId, getBubbleInvocationId(msg))`（与 hydrate streamKey 同口径）
    - **Order**: group 内按 `timestamp asc`
    - **Content**: 按时间顺序拼接非空 content 段；origin priority `callback > stream`（callback 是 cat 自己 finalize 的最终态）
    - **toolEvents**: 合并去重 by `event.id`，按时间排序
    - **Rich blocks** (`extra.rich.blocks`): 合并去重 by `block.id`
    - **Thinking**: 合并 reduce
    - **isStreaming**: 任一 raw record `isStreaming === true` → bubble streaming
    - **canonical id**: 选 group 内最早 callback record id 优先；没 callback 则取最早 stream record id
  - RED test: alpha 真实 thread `thread_moyfjyjc0662weit` opus invocation `2fe279aa` 的 3 条 records → projection 后必须 1 个 bubble，content/toolEvents/rich blocks 完整合并

- [x] AC-Z21: live reducer 改用 projection（writer boundary integration per 砚砚 R1 OQ-3）。✅ PR #1632 squash `49814778` — `applyBubbleEventWithRecovery` 在 `useAgentMessages.ts` wraps reducer，project `result.nextMessages` 后 store.setMessages。Destructive callback path 用 synthetic `id::z8-raw-pre-callback` 注入 pre-reducer stream content 保留 Z7 cleanup baseline。Cloud R3 P1 fix：lookup 用 `getBubbleInvocationId(m)` (turn-priority stable key) 匹配 Z3 dual-id event canonicalInvocationId。

- [x] AC-Z22: hydrate path 改用同一 projection function。✅ PR #1632 squash `49814778` — `useChatHistory.ts` `hydrateThread` + `prependHistory` 替换 streamKey last-wins，调用 `projectCanonicalBubbles`。

- [x] AC-Z23: replay fixture 回归 — alpha 真实 thread `thread_moyfjyjc0662weit` opus invocation `2fe279aa` 3-records (2 stream + 1 callback) fixture。✅ PR #1632 squash `49814778` — `bubble-projection-alpha-replay.test.ts` 证明 hydrate full-batch projection ≡ live incremental projection (byte-identical) + R2 P1 destructive callback test。`useAgentMessages-z8-dual-id-callback.test.ts` 覆盖 Z3 dual-id + legacy single-id 回归。

### Phase Z9（canonical bubble identity contract + projection observability — backend stamp 补漏）

Z8 合入后 (2026-05-11 06:51) 铲屎官 alpha re-test 仍裂："我发现还是裂开的，🤔 好像修这个你们总修不全怎么办呢？ 有没有好办法？" — Z1-Z8 八轮 frontend patch 仍未收敛，铲屎官 push back 方法论。

**只读诊断证据**（thread `thread_mp0o2lf7d2gu5j3y`，runtime preflight Z8 squash `49814778` 之后启动）：
- parent invocation `7e1c4435-1d3e-4b97-b79c-bdd5bb0108fc` 跨 3 个 visible turn 共享：codex turn1 (05/10 20:54) → sonnet turn2 (05/10 21:01) → codex turn3 (05/10 21:02)
- 三条 raw record 的 `extra.stream.invocationId` 全部等于 parent；`extra.stream.turnInvocationId` **全部为 null**
- top-level `invocationId / turnInvocationId` 也都是 null（参考用，不参与 frontend bubble identity）
- 现有 `getBubbleInvocationId` 优先级：`turnInvocationId ?? invocationId` → 退化到 parent → Z8 group key `(catId, parent)` 把 codex turn1 + codex turn3 误并

**KD-28（Phase Z9 方向收敛，47 + 砚砚共识，2026-05-11）**：
- Z8 KD-27 选了 top-down projection contract，方向正确但**接口前提错了**：projection 假定 raw records 已经带稳定的 per-bubble identity，但 backend 大多数路径并没有 stamp `extra.stream.turnInvocationId` → frontend 投影规则被迫退化到 parent → 错并多 turn
- 砚砚原话："我同意 Z9 不能再只补 frontend reducer/projection / 但仍然反对每条 raw record mint 新 turnInvocationId / 这会把同一次可见回复里的 stream / callback / rich 分成多个 key, hydrate 也会跟着拆"
- 47 推进的"backend stamp" 表述要修正为：**per visible assistant turn 生成一个 canonical bubble key，同 turn 内 stream / tool / rich / callback raw records 全部共享它**。不是 per raw record；不是 per callback event
- Z9 实施分两段：先加诊断观测（AC-Z24）确认问题分类，再做 backend stamp + frontend group key 收口（AC-Z25/Z26）+ replay fixture 回归（AC-Z27）

**Z9 不是 Z8 的修补，是把 Z8 投影规则缺失的输入前提补齐——backend identity contract 是 projection 的输入合同，Z8 没明确写、Z9 写清楚并强制落地。**

- [x] AC-Z24: **诊断观测** — 添加只读 probe，把指定 thread 的每条 assistant raw record 打出 `recordId / catId / origin / extra.stream.invocationId (parent) / extra.stream.turnInvocationId (turn) / projection key (turn ?? parent) / contentHash / missingTurnStamp`。✅ PR #1637 squash `49972d42` — `packages/web/src/stores/bubble-projection-diagnostic.ts` 实现 `buildProjectionDiagnostic({records})`，5/5 tests including R13 reproduction fixture。
  - 目的：alpha 失败时一眼分类——是 **(a) 同 key 仍裂**（projection 漏接入路径，如 cached threadStates / IDB first paint / live writer direct store write）还是 **(b) 同 turn 不同 key**（backend stamp 缺失）
  - RED test: probe 输出格式稳定（snapshot test），同 fixture 输入 → 同 hash 输出

- [x] AC-Z25: **backend canonical bubble identity stamp** — 所有 assistant raw record 落地时（recordStore.append / message store / callback-final 路径），必须在 `extra.stream.turnInvocationId` 写入 **per visible cat turn** 的稳定标识。✅ PR #1637 squash `49972d42` — 9 个 persist sites (route-serial × 4 + route-parallel × 3 + callbacks.ts + messages.ts draft + BoundSessionHistoryImporter) unconditional stamp + 6 个 live broadcast sites 通过 `stampVisibleTurn` helper 统一。砚砚 R1 P1 fix: route-serial + route-parallel stamp `ownInvocationId` on yielded events (CLI text/done/tool 不带 invocationId)。砚砚 R2 P1 fix: parallel done yield 用 captured `ownInvId` 不再 re-query 已删除 map。原 AC 描述：
  - 同 parent + 同 cat + 同一 visible response（含 stream / tool / rich / callback / done 所有 raw record）→ 共享一个 turnInvocationId
  - 同 parent + 同 cat + 多个 visible response（连续两次或 a2a handoff 回到同 cat）→ 每个 visible response 一个独立 turnInvocationId
  - 同 parent + 不同 cat → 各自一个 turnInvocationId（已有 Z3 行为）
  - 实施位点：先 audit 所有写 raw record 的入口（routes: chat, callback, mcp post_message, a2a handoff, A2A chain）；任何漏掉的入口都要补 stamp
  - **不影响 hydrate 收敛**：group key 改为 `(catId, turnInvocationId ?? invocationId)`，turn 优先 fallback parent；同 turn 多 record 仍是同一 group → hydrate 仍 1 bubble；多 turn 同 parent → 不同 group → hydrate 多 bubble（这是对的）
  - RED test: 三个写 raw record 入口的 unit test — 给定 visible turn 输入 → stamp 出稳定 turn id

- [x] AC-Z26: **frontend group key 已正确** — `getBubbleInvocationId` 已经实现 `turnInvocationId ?? invocationId` 优先级（packages/web/src/debug/bubbleIdentity.ts:28）。AC-Z25 backend stamp 落地后所有新 record 都带 turn → 投影使用 turn key 不再 fallback。✅ AC-Z27 fixture F1 (multi-turn same parent) 实证：3 cat-turn 每个有自己 turn id → 投影出 3 distinct bubbles（codex t1+t3 不合并）。
  - **Telemetry warn 非本 phase 范围**（observability-only, behavior 不变）。Z9 backend stamp 现在 unconditional，新 record 都带 turn；legacy record 仍走 parent fallback，与 Z8 行为一致。Telemetry 作为防回归探测，由其他 phase 处理（不影响 Z9 close gate）。

- [x] AC-Z27: **replay fixture 全覆盖** — 至少三个 fixture。✅ PR #1637 squash `49972d42` — `packages/web/src/stores/__tests__/bubble-projection-z9-replay.test.ts` 4/4 GREEN (F1/F2/F3 + F1+F3 mixed)。原 AC 描述：
  - F1（multi-turn same parent）: `codex turn1 → sonnet turn2 → codex turn3` 共享 parent + 各自 turn id → 投影应产出 3 bubbles（不是 Z8 当前的 2 bubbles 合并 codex 两次）
  - F2（single turn multi-record）: stream + tool + rich + callback 全部共享同一 turn id → 投影应产出 1 bubble（Z8 alpha fixture 升级版）
  - F3（legacy no turn）: 旧 raw record 无 turnInvocationId 只有 parent → 投影 fallback 到 parent group，行为与 Z8 一致（向后兼容）
  - RED→GREEN: 三个 fixture 都跑 hydrate + live 两条路径，结果 byte-identical

### Phase Z10（liveness identity invariant — F5 hydrate active/cancel 一致性）

Phase Z9 进 review 期间铲屎官 catch 一个相邻但独立子系统的问题（R14, 2026-05-11 07:15）："f5字后一切消失了 猫猫状态什么都是空闲... 没cancel按钮 然后我刚打完这些字 你冒出来了"。砚砚识别为 bubble identity 的姐妹问题：**bubble identity (Z9) 和 liveness identity (Z10) 本质都是前后端没有共享同一份 invocation/turn 真相源**。

**Phase Z10 scope（与 Z9 解耦的独立 PR）**：
- 现状审计（已做）：`useChatHistory.ts:813` `fetchQueue` 已经有完整的 `/queue` 消费逻辑（读 activeInvocations + setThreadHasActiveInvocation + addActiveInvocation + replaceThreadTargetCats）— 代码路径已存在
- 现象根因（待诊断）：**timing/race**，不是缺路径。可能是 (a) render 早于 fetchQueue 返回（initial paint 时 activeInvocations 还没拉到），(b) 后端 `/queue` 在 invocation 启动的某个 window 内不报（生产者侧 race），(c) abortRef 在 thread switch 时取消了正在进行中的 fetchQueue

- [x] AC-Z28: F5 hydrate 后 active state + cancel button 与后端 `/queue` 一致。
  - 诊断（2026-05-12 00:20 47）：runtime preflight HEAD `45204abdc`，API PID 73892。`useChatHistory.ts:813` `fetchQueue` 已存在，runtime log 显示 `/queue` 请求正常触发。**真根因**：`offline-store.ts` IDB snapshot 只保存 messages，**不保存 activeInvocations / hasActiveInvocation**。F5 后 store 从 default `false` 开始 → first paint 显示"空闲" → fetchQueue 异步返回（10-100ms+）→ 重新 render 显示 active → 用户看到"假空闲"窗口
  - Fix：扩展 IDB schema 加 `thread-active-state` object store (DB_VERSION 2→3，自动 invalidate 旧 snapshot)；`saveThreadActiveState` write-through 在 fetchQueue 成功后写入；`loadThreadActiveState` 在 useChatHistory mount 时 restore（race-safe: skip if store 已被 fetchQueue/socket 更新过）
  - RED tests (4/4)：`offline-store-active-state.test.ts` — save/load roundtrip / unknown thread null / overwrite latest / idle snapshot
  - 范围：race window 缩短从"直到 /queue 返回"到"直到 IDB load"（典型 10-50ms vs 100ms+）。Server 仍是 authoritative source，IDB 仅作 first-paint 优化

- [ ] AC-E1: 铲屎官 2026-05-07 报告的 "现在活跃的线程他们气泡都是裂的" 在 alpha 通道实测全部消失（并发 multi-cat handoff 也不裂） ⚠️ 2026-05-10 04:42 回归——Z3/Z4 合入后 live 仍裂（Bug A + Bug B），F5 后正常但 live 不收敛 ⚠️ 2026-05-11 06:51 再次回归——Z8 合入后铲屎官 alpha 仍裂，进 Phase Z9 (canonical bubble identity contract)
- [x] AC-E2: 后端 `/api/messages` 与 `/api/threads/:threadId/queue` 共用同一 canonical helper，单一规则源 ✅ 代码审计：`getThreadLiveInvocations` imported by `messages.ts:1466` + `queue.ts:143`
- [x] AC-E3: 后续新增 read endpoint（admin observability / debug API）可直接复用 helper，不需要自拼三家 store ✅ helper 导出 async function + types，无 route 耦合
- [ ] AC-E4: 并发 ideate 场景 UI 一致性——采样面板全程显示本轮所有 targetCats（Bug C）+ 无 @ fallback 回到上轮 @ 的猫（Bug D）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "现在活跃的线程他们气泡都是裂的" | AC-B5, AC-B15, AC-Z1 | paired-route regression + runtime 实测 | [ ] |
| R2 | 让我"讲讲为什么"——根因可解释、可观测 | AC-B11, AC-B12, AC-B13 | structured event schema + code audit | [x] |
| R3 | "找宪宪 46 或者 47…大概看了一下你的方向我觉得 ok" | AC-A1, AC-A2 | helper contract review | [x] |
| R4 | 不能只在前端打补丁，从根因层（liveness contract）解决 | AC-A1, AC-Z2 | helper 单 contract + 双消费方迁移 | [x] |
| R5 | "前后端根本不一致了！明明 at两只猫只显示一只" (2026-05-10 04:51) | AC-Z15, AC-E4 | sampling panel ideate mode 保留全部 targetCats | [x] (PR #1622 squash `3b3c6b33`) |
| R6 | "明明at的最后一只猫是47 or 55但是召唤出来的却是46" (2026-05-10 04:51) | AC-Z16 | fallback 使用上一条 user message mentions | [x] (PR #1622 squash `3b3c6b33`) |
| R7 | "以前就算有裂开的两个气泡不需要f5就能合并 现在不能了！" (2026-05-10 04:57) | AC-Z14 | live reconcile pass 不 F5 自动收敛 | [x] (PR #1622 squash `3b3c6b33`) |
| R8 | "你们的上一个pr一定有问题！" — Z4 引入 deriveBubbleId 公式冲突 (2026-05-10 04:51) | AC-Z12, AC-Z13 | 统一 id 公式 + hydrate match 机制文档化 | [x] (PR #1622 squash `3b3c6b33`) |
| R9 | "f5之前 我们47多了个小气泡！f5之后就没了" (2026-05-10 10:13) | AC-Z17 | late rich/audio after done 复用 finalized stream bubble | [x] (PR #1623 squash `24eb56e3`) |
| R10 | "上一次at了两只猫 这次没有任何at fallback应该是一只猫" (2026-05-10 10:17) | AC-Z18 | no-@ fallback 从上一条 user mentions 里确定性选一只 | [x] (PR #1623 squash `24eb56e3`) |
| R11 | "live state 残留 f5之后就正常了…opus46 变成两个了，而且你自己现在也是裂开的" (2026-05-10 18:12) | AC-Z19 | done/callback terminal path 清理 local-only provisional duplicate | [x] |
| R12 | "F5 后变 1 个 这是同一次回复 thread id 好像你就得随便打开浏览器去找一个thread 看看 大概率都是裂开的？" (2026-05-10 19:55) | AC-Z20/Z21/Z22/Z23 | 统一 canonical projection contract — live 与 hydrate byte-identical | [x] (PR #1632 squash `49814778`) |
| R13 | "我发现还是裂开的，🤔 好像修这个你们总修不全怎么办呢？ 有没有好办法？" (2026-05-11 06:51) + "布偶猫1+布偶猫3 合并 / 缅因猫2+缅因猫4 合并" (07:12) | AC-Z24/Z25/Z26/Z27 | backend canonical bubble identity stamp + diagnostic probe + multi-turn replay regression | [x] (PR #1637 squash `49972d42`) |
| R14 | "f5字后一切消失了 猫猫状态什么都是空闲... 没cancel按钮" (2026-05-11 07:15) | AC-Z28 | F5 hydrate 后 active state / cancel button 与后端 `/queue` 真相源一致 | [x] (Phase Z10 待 merge) |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求映射表 N/A（本 feat 无前端 UI 改动；前端只通过 API 行为变化间接受益）

## Dependencies

- **Evolved from**:
  - F048（Restart Recovery — Phase A startup sweep 处理启动时刻的 zombie；F194 是其运行时补集，不重复 sweep 入口）
  - F173（Frontend Thread-Runtime State Unification — spec 已 audit 出后端 tracker vs record 不一致但当时只做 cli-resolve cache invalidation；F194 收口后端这一侧）
  - F183（Bubble Pipeline Architecture Consolidation — Post-close issue 即本 feat 触发点；F183 已 close 不重 reopen，把 split-brain 根因独立立项）
- **Blocked by**: 无硬阻塞
- **Related**:
  - F117（Message Delivery Lifecycle — `/api/messages` 是 delivery 真相源消费方）
  - F108（Side Dispatch Concurrent Invocation — InvocationTracker 多槽语义）

## Risk

| 风险 | 缓解 |
|------|------|
| zombie 阈值过严，误杀刚断链的长任务（codex 长 invocation 几分钟没 stream chunk） | 默认阈值用 `2 × DraftStore TTL = 600s` 偏长一点；只在 no fresh draft 场景才 zombie；threshold 走 opts 注入，alpha 实测 calibrate |
| zombie 阈值过松，治不了 zombie | Phase B (Bundle) 内 AC-B11 加 `liveness_degraded`/`liveness_pending` 事件计数，alpha 实测看真实 zombie 比例 |
| messages.ts 现有 inline gate 迁移引入 regression（既有 hotfix3 行为兼容） | Phase B 强制保留 P1-2 dedup + wider window 行为，AC-B5 显式守护 |
| helper 引入跨 store 调用 latency 增加 read endpoint 响应时间 | helper 内部并行 fetch（tracker O(1) + record by id + draft by thread）；cache 不在本 feat scope |
| 多实例部署后跨进程 tracker 不可见会被误判 zombie | 阈值 + draft freshness 兜底，进程重启后 startup sweep 兜底；多实例正式支持留 F048 Phase B 解决 |
| cleanup 路径与 F048 startup sweep 行为漂移 | AC-B7 直接复用 F048 现有 sweep helper，不另写一套；cleanup audit log 用同一 schema |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | helper 是否需要 cache 层？高频 endpoint 每次 read 都跨 3 store 拉数据 | ⬜ Phase B 跑出 baseline latency 后定 |
| OQ-2 | cleanup pathway 入口选 cron / demand-trigger / startup sweep 三种哪种作主？ | ⬜ AC-B7 设计阶段拍板，建议 demand-trigger（read endpoint 检测到 zombie 时异步发起）+ startup sweep 双保险 |
| OQ-3 | `liveness_degraded` 事件是否要做 dedup（同 invocation 短时间多次触发） | ⬜ AC-B11 定，参考 F183 `broadcast_rate_warn` 5s warn dedup 范式 |
| OQ-4 | helper 返回结构是否要扩 `pending` 类型（degraded 但 age 在 grace 期）作显式状态 | ✅ 决定加 `liveness_pending` 事件，但 helper 返回值仍归并到 degraded（避免消费方 schema 三分叉），Phase A 落地时确认 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 立项 F194 而非 F183-R2 / F173 reopen | F183 close 后 scope 是 message pipeline，不该污染；F173 close 且 scope 是前端；后端 liveness contract 是独立 owner | 2026-05-07 |
| KD-2 | 用 helper 而非 inline 扩展 queue endpoint | 一处定义两处复用，避免 messages/queue 规则继续漂；后续新增 read endpoint 直接复用 | 2026-05-07 |
| KD-3 | freshness 主信号用 `draft.updatedAt` 而非 `record.updatedAt` | record.updatedAt 不是 heartbeat（长任务可能早超阈值）；draft.updatedAt 随 stream/touch 刷新，是真活性 proxy（砚砚 push back 2026-05-07） | 2026-05-07 |
| KD-4 | zombie 阈值 = `2 × DraftStore TTL ≈ 600s`，仅 no fresh draft 场景生效 | DraftStore TTL 是已经过 alpha 验证的 stream freshness 上界，`2x` 留 grace；不杀 fresh draft 是恢复能力底线 | 2026-05-07 |
| KD-5 | helper 返回值含 `source`/`reason`/`degraded`，不只是 slot 数组 | 不丢诊断上下文，未来 split-brain 复发可直接定位（砚砚 push back 2026-05-07） | 2026-05-07 |
| KD-6 | record running 是 lifecycle SoT，tracker 是控制面，draft 是 freshness 信号——三家不平权 | 代码核对结论：tracker 是进程内 Map（`InvocationTracker.ts:45`），record 是 Redis 持久化（`RedisInvocationRecordStore`），draft 是 300s TTL 内容缓存（`DraftStore.ts:46`）；语义本质不同，不能 union | 2026-05-07 |
| KD-7 | cleanup pathway 复用 F048 sweep 语义，不另写一套 | F048 Phase A 已经定义 `failed(error=process_restart)` + 清 TaskProgress 的语义；F194 zombie 走同一管道避免分裂 | 2026-05-07 |
| KD-8 | scope 显式排除 InvocationQueue 持久化、跨实例分布式协调 | 前者归 F048 Phase B，后者属于多实例部署演进；本 feat 只做 read 一致性 + 运行时 zombie | 2026-05-07 |
| KD-9 | candidate 双源 enumeration（records ∪ drafts）+ tracker association guard 含 cross-check `slotClaimedByOtherDraft` | 砚砚 R1 P1-1：record 缺失但 tracker+draft 仍能证明 live 的合法路径必须保留（messages.ts hotfix3 + AC-B5）。砚砚 R1 P1-2：tracker slot key 是 (threadId, catId) 没 invocationId，cat slot 重用时新 slot 不能反向证明旧 record。砚砚 R2 P1：weak association 还得排除 slot 已被其他 draft 强关联的歧义场景，否则 zombie record + 新 record-missing draft 共存会让一个 slot "证明"两个 invocation。修复：buildSlotClaimedByDraft 预计算 earliest-anchored 那个 draft 的 slot ownership；weak record-tracker 和 tracker+draft 都加 `!slotClaimedByOtherDraft` 守护 | 2026-05-07 |
| KD-10 | strong tracker-backed path（record+tracker / tracker+draft）由 ownership 而非 timing 决定——只有 slot owner（earliest-anchored draft 的主人）能用 | 砚砚 R3 P1：单 slot 同时 timing-anchor 两个 candidate 的 draft（A.createdAt = -90_000 earliest-owner, B.record+B.draft.createdAt = -85_000 也 timing-anchor），原 `slotAssocWithDraft` 只看时间是否能 anchor，B 仍走 strong path 拿 record+tracker。修复：ctx 加 `slotClaimedByThisDraft = slotClaimingDraft?.invocationId === candidate.invocationId`；`tryRecordTracker` 用 `slotClaimedByThisDraft || slotAssocWithRecordSingle`，`tryTrackerDraft` 改用 `slotClaimedByThisDraft`。非 owner 的 record+draft 仍可走 fresh-draft fallback (record+draft) 保持 active，只是不获得 tracker-backed 强证据。Hard 不变量：每个 cat slot 至多 back 一个 tracker-backed source | 2026-05-07 |
| KD-11 | slot ownership map 必须排除 stale drafts（freshness guard） | 云端 codex review P1（PR #1592 commit 135f00635）：`buildSlotClaimedByDraft` 没检查 freshness，stale draft（`updatedAt > freshDraftWindowMs` 但 DraftStore TTL 还没 reap，例如 caller 注入更短 freshDraftWindow）能 claim cat slot 当 owner，导致 `slotClaimedByOtherDraft=true` 错误 disable 真正 running invocation 的 weak `record+tracker` path——live record 被错降为 `record-only` pending。修复：`buildSlotClaimedByDraft` 预先 filter `drafts` 只保留 fresh 的（`now - updatedAt ≤ freshDraftWindowMs`）；helper 主入口把 `now` / `freshDraftWindowMs` 透传给 buildIndexes/buildSlotClaimedByDraft | 2026-05-08 |
| KD-12 | F194 phase scope 重新规划：原 4-phase 拆分（A/B/C/D 各一）合并为 **2-phase**——Phase A 独立 + **Phase B (Bundle)** 单一 phase（消费方迁移 + cleanup + diagnostic + alpha 全在一起）。spec 真相源直接反映"single bundle"，AC 改为连续编号 AC-B1~B16 不再分 sub-phase | 铲屎官 2026-05-08 第二次 push back："我当时喊你把 phase bcd 都合成一个，然后先改 feat md，这样你才不会飘"——我第一次只在 KD-12 写"3 phase 合 1 PR"但 spec phase 章节保留 3 段，导致做实现时仍按 step 1/2a/2b 拆碎，commits 出现 9 个（4 feat + 5 fix review iteration）。第二次纠正：spec phase **章节本身**合并成单一 Phase B (Bundle)，AC 也合并连续编号，让做实现时不再有"按 phase 分步思考"的飘动空间。Phase A 仍独立保留作 contract foundation；Phase B (Bundle) 内部按 B1~B16 子 AC 连续验收，但作为同一 phase 同一 PR 一锅端 close | 2026-05-08 |
| KD-13 | running 索引必须有 backfill 路径——SMEMBERS-only 读路径不能假设 Set 已经 populate，必须能恢复 pre-deploy / 漏写 transition 的 orphan running records | 云端 codex review R13 P1（PR #1603 commit 472da890f）：R3 P1 fix 把 `listRunningByThread` 从 SCAN-based 切到 SMEMBERS-only，但 `invoc:running:{tid}:{uid}` Set 只在 `update()` 的 ATOMIC_UPDATE_LUA 里 populate。任何在新 build 部署时已经 `running` 的 record（或漏写 transition 的 record）都 absent from set，read 路径会把活的 invocation 误判为"消失" → /messages 丢 live draft + /queue 显示无 active slot，直到 record 再次 transition。修复：per-process lazy backfill（`runningIndexBackfilled` 标志位 + in-flight promise 共享），首次 listRunningByThread 调用时 SCAN 所有 invoc:* hashes，把 running records SADD 到对应的 (threadId, userId) Set，然后 flag = true 后续读纯 SMEMBERS。SADD idempotent，多进程 startup 最坏只是重复工作。On scan error: clear in-flight promise → 下次重试；error propagate 让 caller 决定 fail-open | 2026-05-08 |
| KD-14 | update() 的 KEYS[2] 必须 CAS 防御 reassignUserId 漂移——JS 端 snapshot 推导出的 setKey 在 EVAL 之前可能因并发 reassignUserId 而失效 | 云端 codex review R13 P1 #2（PR #1603 inline comment 3209482070，与 P1 #1 同 R13 iteration）：`update()` 拉取 `before = await this.get(id)` 后用 `(threadId, userId)` 推 setKey 传给 Lua KEYS[2]。如果在 get() 与 eval() 之间 reassignUserId() 把 record migrate 到新 userId，Lua 的 SADD/SREM 就打到了错的 set——queued→running 漂移会把 record 加到 stale "T:A" 但 record.userId 已经是 B，listRunningByThread('T','B') 看不到 → 直接破坏 canonical liveness。修复（同一原子事务内 CAS 校验）：Lua 加 ARGV[3]/ARGV[4] = expectedThreadId/UserId，CAS 检查后立即 HGET 当前 threadId/userId，不匹配返回 -3；JS 端 update() wrap 在 retry loop（MAX_RETRIES=3），-3 触发 re-snapshot + 重发 EVAL 用 fresh setKey。设计权衡：Lua 内构造 setKey 需要 keyPrefix（ioredis EVAL 内的 raw 字符串不会自动 prefix），不如 CAS retry 简洁；reassignUserId 是稀有操作（scheduler backfill），3 次 retry 足够收敛 | 2026-05-08 |
| KD-15 | reassignUserId 的 ownership 迁移必须 atomic——HSET userId + SREM oldSet + SADD newSet 不能拆 3 个 await | 云端 codex review R14 P1（PR #1603 inline comment 3211498998，rebased HEAD 75b55e14e）：原本 reassignUserId 三步独立 await，crash 落在 SREM 和 SADD 中间会让 running record 既不在 oldSet 也不在 newSet —— defensive filter 在 read 端兜底但 set 状态错。修复 `REASSIGN_USERID_LUA`：HSET userId + SREM + SADD 折成一个 Lua eval；status 在 Lua 内（post-HSET）读取，避免捕获 stale snapshot——并发 update() 把 status 转 terminal 时跳过 Set 迁移（terminal records 不该在 running set）。Idempotency key migration 留在 Lua 外（不在 hot read path，原本 multi/exec 已 atomic enough） | 2026-05-08 |
| KD-16 | /queue.activeInvocations 必须 dedup by catId——helper 可以同 catId 多 LiveInvocation，但 frontend 只能消费 cat-level state | 云端 codex review R15 P2（PR #1603 inline comment 3211748989，HEAD e9dd22ff8）：getThreadLiveInvocations 在 recovery window（并发 running records）能为同一 catId 产 1+ LiveInvocation。queue.ts:153 旧 mapping 1:1，frontend `replaceThreadTargetCats` 把 activeInvocations[].catId 当 cat-level 身份（hydrated-{threadId}-{catId}）—— 重复 catId 会渲染同一 cat 两次 + startedAt 在 sources 间跳动。修复：resolveActiveInvocations 用 Map<catId, slot> dedup，tiebreaker = earliest startedAt（canonical slot age：最老的 active invocation 是 cat 的真"slot 开始时间"）| 2026-05-08 |
| KD-17 | reconcileZombies 必须为 terminal records 也尝试 deleteSnapshot——不止 newly-reconciled records | 云端 codex review R15 P1（PR #1603 inline comment 3211783767，HEAD a4c303661）：CAS update 失败（record 已被并发 reconcile 转 terminal）走 `!updated` 分支不再 attempt deleteSnapshot。如果 winner 的 deleteSnapshot 暂时失败，loser 也跳过 → 后续 zombie sweep 只 enumerate running records 永远不会再 pick up → phantom progress bar 永驻（TaskProgress 默认 TTL persistent）。修复：`!updated` 分支 get() current status，若 terminal（succeeded/failed/canceled）继续 clearTaskProgress（idempotent，并发 reconcile 间提供冗余）；若 missing（current=null）跳过 cleanup（无 canonical threadId）| 2026-05-08 |
| KD-18 | backfill SCAN 必须过滤掉 running-set keys——`invoc:*` prefix 同时覆盖 record hashes (`invoc:{uuid}`) 和 running 索引 sets (`invoc:running:{tid}:{uid}`)，HGETALL on set keys 浪费 round trips | 云端 codex review R16 P2（PR #1603 inline comment 3211824356，HEAD 331b18aa8）：scanAndPopulateRunningIndex 用 MATCH=invoc:* 找 record hashes，但 R3 P1 fix 引入的 running 索引 sets 也住 `invoc:*` 下面，SCAN 返回 both。defensive filter 在 result loop 里捞 WRONGTYPE error 兜底但 round trips 还是付出去了。修复：post-scan 过滤 `invoc:running:` 前缀（不需 Redis TYPE filter 版本依赖），保留现有 SCAN MATCH pattern。Test 通过 wrap pipeline().hgetall 捕获 key 集合，断言 NO `invoc:running:*` 出现在 HGETALL targets | 2026-05-08 |
| KD-19 | /messages 必须无条件 invoke helper（zombie 检测不依赖 draft 列表非空）——zombie 的本质就是"record running + no fresh draft"，drafts.length>0 gate 直接漏掉这一类 | 云端 codex review R17 P1（PR #1603 inline comment 3211853817，HEAD 46a735250）：messages.ts 旧逻辑把 helper invocation 嵌套在 `if (drafts.length > 0)` 里，empty draft thread 永远不触发 reconcile。修复 KD-19：重构 messages.ts 的 draft-merge 块，helper invocation 只 gate `opts.invocationRecordStore`，drafts 数组（可空）作为 helper 输入；activeDrafts 初始化前移；sort+push 出 `drafts.length>0` 内层条件。/messages 与 /queue 双路径都能触发 reconcileZombies，no-draft thread 的 phantom progress 不再永驻 | 2026-05-08 |
| KD-20 | reconcileZombies 必须区分 missing / terminal / 仍 alive 三种 CAS-null 子情况——把"still running"误归 alreadyTerminal 等于丢失真 zombie | 云端 codex review R17 P2（PR #1603 inline comment 3211853819，HEAD 46a735250）：R15 P1 fix 把 `!updated` 分支拆成 terminal-cleanup vs missing 但还是把 still-running 也归 alreadyTerminal，Redis store CAS-drift retry exhaustion 时会丢 zombie。修复 KD-20：fresh get() 后三分支：(1) current=null missing → alreadyTerminal+no cleanup；(2) terminal → alreadyTerminal+retry cleanup（R15 P1 行为）；(3) 仍 alive (queued/running) → errors=1 + alreadyTerminal=false + warn log "transient failure"。下个 sweep 会 re-try。监控可基于 errors 指标 flag 真问题 | 2026-05-08 |
| KD-21 | F194 helper 必须把 invocation 视为**双 namespace**：`recordStore.invocationId`（parent，整条 multi-cat 链共享）vs `draftStore/registry.invocationId`（child，per-cat-turn）。drafts/tracker stamping 不变，helper 学会 parent↔child 映射 | Phase B alpha 验收失败根因（铲屎官 2026-05-09 03:35 + 砚砚 04:51 拍板）：runtime thread `thread_moxnb78ckc36xhga` 仍裂——98d2949c 是 parent（用户消息"你说说我们的现状"，opus→codex→opus 链 4 分钟没结束），a58a8757 是 child（当前 opus 第三轮 streaming）。helper 把它们当同 namespace → record-only/pending + tracker+draft no-record 两个 ghost identity → /queue dedup 取最早 startedAt → slot 计时陈旧但内容是新的。架构上：drafts 必须 per-turn 唯一（DraftStore key 含 invocationId 不能复用 parent），formal message 用 parentInvocationId stamp（已正确），tracker 干脆不存 invocationId（ambiguous）。helper 不能假设 namespace 相等。砚砚 reject 方案 A（全量统一 schema 迁移风险大）+ reject 方案 C（"同 cat 有 draft 就特殊处理" 是孤立 patch）→ 走方案 B（namespace-aware helper） | 2026-05-09 |
| KD-22 | helper namespace-aware 实现走"加 dep 不改 stamping"路线，**dep 必须返回结构化数据不能黑盒 boolean**（砚砚 R1 P1-1）：复用 InvocationRegistry 已有 `parentInvocationId` 字段 + `getLatestId(threadId, catId)` 接口；helper 入口 build namespace index `parentToChildren: Map<parentRecordId, Array<{childTurnId, draft, turnCreatedAt}>>` 后再做分类 | KD-21 决策后的实现路线选择：A 全量 namespace 统一会触动 callback auth + DraftStore key + 历史兼容三处 schema migration（高风险大半天起）；C "同 cat 有 draft" hotfix rule 短期变好但下次会在别的 parent/child 边界继续裂。B = canonical helper 加 namespace awareness。砚砚 R1 P1-1 reject 黑盒 boolean dep（`hasFreshChildDraft(parentId)` 只返 true/false，helper 拿不到 child id/catId/createdAt 做 startedAt 与 diagnostic）→ 改用结构化 dep：`getTurnInvocation(invocationId)` 返 `{ parentInvocationId, threadId, catId, createdAt }`（包装 `registry.getRecord`） + `getLatestTurnInvocationId(threadId, catId)`（包装 `registry.getLatestId`）。砚砚 R1 P1-2 reject "parent 有 child draft → parent 不进 active 让 child 走 tracker+draft"（tracker 丢就漏 live）→ 改成"parent + child draft 是同一 execution chain"分类，tracker present → `parent+child+tracker`，tracker missing → degraded `parent+child-draft`。startedAt 优先取 child turn createdAt 不取 parent.updatedAt。砚砚 R1 P1-3 reject "formal message exists → instant succeeded"（multi-cat chain 中途就有 formal message）→ read-side 只 suppress ghost slot + 输出 namespace diagnostic，**succeeded 终态由 producer Z4 finally 决定**，read-side 不擅自终态化（缺 chainDone 证据） | 2026-05-09 |
| KD-23 | F194 close hard gate：alpha runtime acceptance（AC-Z5）必须有 **截图/日志 evidence** + **愿景守护猫对照表**——spec / unit test / integration test 全过 ≠ close 资格，必须 runtime 真实场景验证不裂 | 砚砚 2026-05-09 04:51 拍板原话："不是'代码 merge 了就算完'，而是 active runtime thread 不裂才算 F194 过关"+ "Z 阶段验收必须包含 runtime 复现用例和 alpha 截图/日志证据"。Phase B 失败根因就是单测全过、API regression 全过、cloud LGTM "Bravo"，但没在 alpha 真实 multi-cat 串联场景压一遍。Phase Z 不重蹈：unit test + integration test + alpha runtime + 守护猫四个证据齐才允许 status: done | 2026-05-09 |
| KD-25 | Phase Z5 走"一锅端 single-PR"，不再拆 sub-phase | 4 个 bug 根因都是同一 canonical contract 缺失（id 公式 / live reconcile / sampling 投影 / fallback 语义），分 4 个 PR 修会让 reducer / status-helpers / AgentRouter 跨 PR 跨 review 拆碎，重蹈 Phase A→B 拆分时"按 phase 分步思考飘动"的覆辙。一个 PR 同时验证 4 个 bug 互不冲突 + 跨 helper 边界一致性。代价：PR 大，review iteration 可能多，但 alpha 验收一次到位 | 2026-05-10 (opus-47 R1) |
| KD-26 | 愿景守护 SOP 漏检 "live state ≡ reducer canonical state" 不变量——Phase Z3/Z4 守护对照表（宪宪/Opus-46 跨 family）2 次都全绿但 Bug A+B 没 catch。守护 checklist 必须加："同 turn 多 event kind 链下 live UI bubble 数 ≡ hydrate canonical bubble 数" 的 alpha 实测脚本 | Z3 守护对照表只对照"刷新前后气泡数一致"（铲屎官最初 catch 的 Z3 失败场景），没考虑 Z3/Z4 自己引入的"helper id vs reducer id 公式不一致"。Z4 守护对照表也只看"placeholder id == hydrate id"假设的字面相等，没考虑 reducer kind suffix 路径。这是元-级 lesson：守护 SOP 不能只对照"上一次 catch 的症状"，要主动审 "你这次改的 contract 有没有跟周边 contract 漂"。Self-evolution 候选 → 待 close 后蒸馏到 vision guard skill | 2026-05-10 (opus-47 + 砚砚 共识) |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-07 | F183 post-close issue 报告（铲屎官 19:14 发现 active thread 气泡仍裂） |
| 2026-05-07 | 砚砚只读诊断捕到 split-brain（3 个 thread 同型号 messages vs queue 矛盾） |
| 2026-05-07 | 砚砚记录入 F183 spec post-close section（commit 96209ae2b）|
| 2026-05-07 | 砚砚 → opus-47 架构判断 handoff |
| 2026-05-07 | opus-47 给方向（helper-based unified read model + zombie detection），砚砚 push back（draft freshness 主信号 + degraded vs zombie 二分 + helper 返回带 source/reason/degraded） |
| 2026-05-07 | 立项 F194，opus-47 author / 砚砚 reviewer |
| 2026-05-08 | **Phase A merged (PR #1592, squash `4b5edfdd2`)** — 5 轮本地 review (R1→R5 APPROVE) + 2 轮云端 review (R1 P1 → R5 LGTM) 收敛 6 P1 + 1 P2：dual-source enumeration / cat-slot-reuse weak guard / slot-ownership single-injectivity / spec contract sync / stale-draft freshness guard。helper + 26/26 单测落地，contract 通过，准备进 Phase B (Bundle) |
| 2026-05-08 | **Spec phase scope 第二次纠正（KD-12 强化）**：第一次只在 KD-12 写"3 phase 合 1 PR"但 spec phase 章节保留 3 段，导致做实现时仍按 step 1/2a/2b 拆碎，commits 出现 9 个（4 feat + 5 fix review iteration）。铲屎官 push back：spec phase **章节本身**合并成单一 Phase B (Bundle)，AC 改为连续 AC-B1~B16，让 spec 真相源直接反映"single bundle"。spec 修正版于 main commit push 后，回到 worktree 继续 cleanup + diagnostic + alpha 实施 |
| 2026-05-08 | **Phase B (Bundle) cloud R13 P1 backfill fix**（commit `10c283540`）— 云端 codex review 触发新一轮 P1：SMEMBERS-only 读路径无 backfill = pre-deploy running records 隐形。修复 KD-13：per-process lazy backfill（首次调用 SCAN+SADD populate，flag 后纯 SMEMBERS）。2 个新单测：pre-deploy record 注入 → 第一次 listRunningByThread 触发 backfill → record 浮现；one-time 验证（post-backfill orphan 不再 resurrect）。等待 cloud review re-trigger LGTM 后进入 merge gate |
| 2026-05-08 | **Phase B (Bundle) cloud R13 P1 #2 reassignUserId race fix**（commit `98b0d4c2c`）— 第二轮 inline P1（comment 3209482070，与 P1 #1 同 R13 iteration，LL-033 教训：cloud P1 在 inline code comments 不在 review body）。`update()` 的 setKey 来自 JS 端 snapshot，与 reassignUserId 并发会打到错 Set。修复 KD-14：Lua 加 (threadId, userId) CAS guard 返回 -3；JS retry loop MAX_RETRIES=3 重发 EVAL。1 个新单测：wrap redis.eval 注入 reassign-equivalent ops 在 get/eval 之间，验证 update(running→succeeded) 后 record 正确从当前 owner set 中 SREM。等待新一轮 cloud LGTM 进入 merge gate |
| 2026-05-08 | **Phase B (Bundle) rebase + cloud R14 P1 atomic reassignUserId fix**（commit `4319cf0d0`）— rebase 到最新 origin/main（包含 `2fad783b6` test stabilization），force-push 后 cloud R14 在 rebased HEAD `75b55e14e` 上发现新 P1：`reassignUserId` 内 HSET + SREM + SADD 是 3 个独立 await，crash 落 SREM/SADD 之间会让 running record 既不在 oldSet 也不在 newSet。修复 KD-15：新 `REASSIGN_USERID_LUA` 把 HSET + SREM + SADD 折成单 Lua eval；status 在 Lua 内 (post-HSET) 读取，并发 terminal 转换正确跳过 Set 迁移。2 个新单测：atomic invariant（pre/post state in single eval）+ concurrent terminal drift（status 漂到 succeeded 时 Lua 跳过 Set ops）|
| 2026-05-08 | **Phase B (Bundle) cloud R15 P2 catId dedup fix**（commit `aa88f555b`）— cloud R15 在 HEAD `e9dd22ff8` 上发现新 P2：getThreadLiveInvocations 在 recovery windows 可同 catId 产多 LiveInvocation，queue.ts:153 旧 mapping 1:1 让 frontend cat-level state 渲染同一 cat 两次。修复 KD-16：resolveActiveInvocations 用 Map dedup by catId，tiebreaker = earliest startedAt。1 个新单测：2 个 running records 同 targetCats=['opus'] → activeInvocations 1 个 opus slot + startedAt 是 earliest。F194 focused 77/77 ✅ |
| 2026-05-08 | **Phase B (Bundle) cloud R15 P1 terminal-cleanup retry fix**（commit `1938b25d3`）— cloud R15 在 HEAD `a4c303661` 上发现新 P1：reconcileZombies 的 CAS update 失败时直接 return，不 attempt deleteSnapshot；并发 reconcile race + winner 的 deleteSnapshot 暂时失败 = phantom progress 永驻。修复 KD-17：`!updated` 分支 get() current status，terminal record 仍 clearTaskProgress（idempotent 冗余）；missing record skip。2 新单测 + 1 既有 batch 测试 assertion update（terminal records 现在也触发 cleanup）。F194 focused 79/79 ✅ |
| 2026-05-08 | **Phase B (Bundle) cloud R16 P2 backfill SCAN filter fix**（commit `073b7a518`）— cloud R16 在 HEAD `331b18aa8` 上发现新 P2：scanAndPopulateRunningIndex 的 MATCH=invoc:* 同时匹配 record hashes 和 running 索引 sets。HGETALL on set keys 走 WRONGTYPE 路径但仍付出 round trips。修复 KD-18：post-scan 过滤 `invoc:running:` 前缀，保留 SCAN MATCH pattern 不依赖 Redis TYPE filter 版本。1 新单测 wrap pipeline.hgetall 捕获 key 集合验证。F194 focused 79/79 ✅ |
| 2026-05-08 | **Phase B (Bundle) cloud R17 P1+P2 dual fix**（commit `815039ff0`）— cloud R17 在 HEAD `46a735250` 上发现 P1+P2：(P1 messages.ts) drafts.length>0 gate 让 empty-draft thread 永不触发 reconcile；(P2 reconcileZombies.ts) `!updated` 把 still-running 误归 alreadyTerminal 丢 zombie。修复 KD-19+KD-20：messages.ts 重构 helper invocation 只 gate recordStore；reconcileZombies fresh get() 后三分支区分 missing/terminal/still-alive。2 新单测：empty-draft thread reconcile + CAS-null still-running 计 errors。F194 focused 81/81 ✅ |
| 2026-05-09 | **Phase B (Bundle) merged (PR #1603, squash `5c1ab366`)** — 18 个 commits 收敛 8 轮 cloud review (R13 P1×2 + R14 P1 + R15 P2/P1 + R16 P2 + R17 P1+P2)：backfill running index + reassignUserId 漂移 CAS retry + atomic Set migration Lua + queue catId dedup + zombie 终态 cleanup retry + SCAN filter exclude set keys + helper-always-invoke + 三分支 transient classification。最终 cloud LGTM "Bravo" on `d24f407f5`。merge gate test 步骤遭遇 parallel test pollution flake（与 F194 无关，每次跑 fail 不同 unrelated test，isolation 全 pass），写 bug-report `2026-05-08-pnpm-gate-parallel-test-pollution-flake/` 后铲屎官拍板走 option B：信任 F194 focused 81/81 + cloud LGTM + 非测试 gate 全绿，squash merge。alpha 实测 + 愿景守护 入待办 |
| 2026-05-09 | **Phase B alpha 验收失败 + 进 Phase Z** — 铲屎官 03:35 实测 runtime 仍裂（thread `thread_moxnb78ckc36xhga`），写 bug-report `2026-05-09-f194-runtime-bubble-still-split-completion-leak/`。挖出根因：F194 helper 把 parent recordStore invocation 与 per-cat-turn registry invocation 当成同 namespace。砚砚 04:51 拍板：reject A（全量统一 schema）+ reject C（hotfix rule），走 B（namespace-aware helper）。spec 加 KD-21~KD-23 + AC-Z1~Z5；Z 阶段不 close 不准 alpha 通过；F194 close hard gate = unit + integration + alpha runtime + 守护猫 四件齐 |
| 2026-05-09 | **Phase Z code merged (PR #1614, squash `7443d049e`)** — 14 个 commits 收敛 6 轮本地 review (R1→R6 砚砚 APPROVE) + 6 轮 cloud review (R1 P1 iterate ALL targetCats → R2 P1 gate on fresh-draft activity → R3 LGTM → R4 P2 zombie event trackerSlotPresent actual state → R5 P2 degraded event trackerSlotPresent actual state → R6 LGTM "Swish!")：namespace-aware helper + parent recordStore vs per-cat-turn registry 结构化 dep + RouteChainCompletionTracker + ensureTerminalStatus producer try/finally + cross-parent same-cat dedup via latest pointer + parent-level zombie aggregation (multi-cat partial reuse safe) + tracker presence reflects actual physical state。F194/Z focused 95/95 + biome clean。pnpm gate 两次都遇 1 个 pre-existing timing flake（api-instance-lease + workspace-file-watcher，单独跑均 3/3 稳定，非 PR 责任）。AC-Z5 alpha 验收 + 愿景守护四件套待执行 — close hard gate by 砚砚 KD-23 |
| 2026-05-09 | **F194 close (commit `d433b8dc3`)** — KD-23 hard gate 4 件套全过：95/95 unit + integration + runtime acceptance（铲屎官 05:11 重启 runtime + visual confirm 不裂 + opus-47 API 诊断 `/queue` 单 active no ghost）+ 愿景守护对照表 by 宪宪/Opus-46（跨 4.6 视角）4 行 R1-R4 全 ✅。Status: completed |
| 2026-05-09 17:09 | **F194 close 退回（砚砚 catch acceptance gap）** — 砚砚在新 thread `thread_moz0i3l9mya45fnx` 发现 ideate 双猫并行场景仍裂：runtime 日志 codex child 被判 `tracker+draft / tracker_active_missing_record`。代码核对：`route-parallel.ts:399` 调 `invokeSingleCat` 漏传 `options.parentInvocationId`（`route-serial.ts:725` 已传）→ parallel 场景 child registry record 缺 parentInvocationId → helper namespace bridge 失效。砚砚原话："F194 close gate 要退回，不该包装成新 hotfix"。Status 改回 in-progress + 加 AC-Z6 (parallel route 修补) + AC-Z7 (KD-23 重做含 ideate 场景)。开 Phase Z2 worktree |
| 2026-05-09 17:32 | **Phase Z2 merged (PR #1617, squash `1fa6ed229`)** — 4 行实现 + 84 行 RED test：spy `registry.create` 第 4 参数（parentInvocationId），before fix `actual=undefined, expected='cat-cafe-outer-z2-parent'`。砚砚 R APPROVE "Findings: none" + 云端 LGTM "Can't wait for the next one!"。同时铲屎官报告**第二个问题**（不同根因）：刷新后同 parent chain 里同 cat 多 turn 气泡被合并（`opus → codex → opus` 两个 opus bubble 强行合并 → cancel 按钮消失 + 第三个 opus 失踪）。砚砚根因：formal message `extra.stream.invocationId` 当前盖 parent id，前端 `mergeReplaceHydrationMessages` 用 `(catId, invocationId)` 当 stable key → 同 cat 多 turn 同一 key 被合并。砚砚口径："PR #1617 可以单独合，但绝不能拿它做 F194 close"。F194 acceptance failure 继续 → Phase Z3 收口（双 id 拆分） |
| 2026-05-10 16:40 | **Phase Z5 merged (PR #1622, squash `3b3c6b33`)** — 单 PR 收口铲屎官 alpha 实测 4 bug (A 气泡裂 / B 不自愈 / C 采样缺猫 / D fallback 错猫)。砚砚 R1→R11 跨 11 轮 review 收敛 5 P1 + 2 nit (await + UI-compat 白名单 + 50 thread-msg cap → pagination → effective score cursor → page-level cutoff)；云端 codex R1→R8 跨 8 轮 review 收敛 4 P1 + 2 P2 (system msg user count + placeholder 吸收 kind gate + scheduler 排除 + 1h cutoff 顺序 + 跨 panel coherence + 去掉 page cap)；最后 2 轮 cloud LGTM "Didn't find any major issues 🎉"。Bug A+B 修法：bubble-reducer findExistingByStableKey empty placeholder 吸收 (gate 非 system_status incoming kind)。Bug C 修法：deriveActiveCats ideate mode UNION + 三 panel 都传 intentMode。Bug D 修法：findRecentUserMentionFallback 分页扫 effective score (deliveredAt ?? timestamp) + SYSTEM_USER_IDS 排除 + 1h cutoff 仅对 user msg + page-level cutoff early-stop。15 commits squash 1。AC-Z12/Z13/Z14/Z15/Z16 全 ✅。**Status: alpha re-test by 铲屎官 待执行** → 守护猫 sign-off → close F194。 |
| 2026-05-10 18:36 | **Phase Z6 merged (PR #1623, squash `24eb56e3`)** — 砚砚接手修 alpha re-test 剩余 2 个问题：R9 late rich/audio after done 造成临时小气泡（F5 后消失）和 R10 no-@ fallback 误扩成上一轮 mentions 全集。Opus-47 review APPROVE，云端 Codex R1 退回 2 P1（active/background finalized fallback 必须只限 invocationless rich/audio，不能把新 invocation rich_block 拼进旧 bubble），砚砚补 RED→GREEN 后重新触发，云端 LGTM "Breezy!"。AC-Z17/AC-Z18 全 ✅。**Status: alpha re-test by 铲屎官待执行** → 守护猫 sign-off → close F194。 |
| 2026-05-10 18:12~18:36 | **Phase Z7 opened** — 铲屎官确认 F5 后正常、live state 残留：Opus-46 与 Codex 在 live 期间出现 duplicate bubble，hydrate 后消失。砚砚 runtime preflight：runtime 含 Z6 (`ab77f6880`)，`/messages` hydrate 对 `thread_mp0i4nfau5hz0mr6` 只返回 canonical stream bubbles，证明不是后端持久化双写。根因：terminal reducer path 没有在 canonical bubble 已存在时清理 older local-only stream sibling。新增 AC-Z19。 |
| 2026-05-10 19:08 | **Phase Z7 merged (PR #1625, squash `96c76bad`)** — 砚砚 author，Opus-47 review APPROVE。修 live-only canonical bubble + local-only provisional duplicate residue：`dropLocalOnlyStreamSiblings` 只在 canonical sibling 存在且 terminal timestamp 可判定 older/newer 时删除同 cat local-only `origin='stream'` sibling。云端 Codex R1 退回 1 P1（terminal timestamp optional，缺 timestamp 时会误删 next-turn local placeholder），砚砚补 RED→GREEN missing timestamp guard 后 `pnpm gate` 全绿，云端第二轮 LGTM "You're on a roll."。AC-Z19 ✅。**Status: alpha re-test by 铲屎官待执行** → 守护猫 sign-off → close F194。 |
| 2026-05-10 19:55~20:41 | **Phase Z8 spec opened — Z1-Z7 终止符 (KD-27)** — 铲屎官 Z7 合后 alpha 实测："F5 后变 1 个 这是同一次回复 大概率都是裂开的"。runtime preflight (Opus-47) 实测 thread `thread_moyfjyjc0662weit` opus invocation `2fe279aa` backend 真存 3 条 raw records (2 stream + 1 callback) 共享 invocationId、turnInv 全空 — 不是 live state 残留，是 backend record 多条 + frontend live/hydrate 投影规则不一致 (hydrate streamKey last-wins 收敛 1 个，live reducer ADR-033 kind 隔离创建多个)。三猫独立诊断收敛 (47 + 砚砚 + 46): 不能再 patch reducer 局部 (Z5/Z6/Z7 三轮 patch 已是局部止血循环)，47 R0 提案 backend stamp turnInvocationId 被砚砚 + 46 push back (会让 hydrate 也拆，副作用更糟)。KD-27: 改为 top-down 统一 canonical bubble projection contract — raw records 不动，让 live reducer 与 hydrate **共享同一 projection 规则**。新增 AC-Z20 (projection function 定义) + AC-Z21 (live reducer 改用) + AC-Z22 (hydrate 改用) + AC-Z23 (replay fixture 用 alpha 真实 thread)。Spec by Opus-47 (commit pending)。 |
| 2026-05-11 03:13 | **Phase Z8 merged (PR #1632, squash `49814778`)** — 11 个 commits 收敛砚砚本地 R1→R3 review (B1.8 reducer assertion + R2 P1 destructive callback raw-stream synthesis + R3 6-test concat-contract rewrite) + cloud Codex R1→R4 review (R1 P1 metadata/replyTo/replyPreview/visibility preserve via base spread + R2 P1 Z7 cleanup baseline preservation + R2 P2 contentBlocks merge across records + R3 P1 stable invocation key lookup for Z3 dual-id → R4 LGTM "Didn't find any major issues. More of your lovely PRs please")。`projectCanonicalBubbles({ records })` pure function：group by `(catId, getBubbleInvocationId)`，callback wins canonical id+origin，content concat ts asc，toolEvents/rich blocks dedupe，contentBlocks merge，callback-aware isStreaming。Wrapper integration at writer boundary: `applyBubbleEventWithRecovery` (live) + `hydrateThread/prependHistory` (hydrate)。Destructive callback path uses synthetic `id::z8-raw-pre-callback` to inject pre-reducer stream content while preserving Z7 `dropLocalOnlyStreamSiblings` cleanup. Alpha 3-record fixture (`z8-alpha-3-records.json`) replay test 证明 hydrate ≡ live byte-identical. AC-Z20/Z21/Z22/Z23 全 ✅。**Status: alpha re-test by 铲屎官待执行** → 守护猫 sign-off → close F194。 |
| 2026-05-11 06:51~07:00 | **Phase Z9 spec opened — canonical bubble identity contract + projection observability** — 铲屎官 Z8 合后 alpha 实测："我发现还是裂开的，🤔 好像修这个你们总修不全怎么办呢？" 方法论 push back (R13)。47 「数学之美」自审：Z1-Z8 八轮 frontend 投影 patch，每轮只解决"那一种"裂法，坐标系本身错——frontend 一直在猜 backend records 该怎么 group。Runtime preflight (47, thread `thread_mp0o2lf7d2gu5j3y`) 实证：parent invocation `7e1c4435` 跨 3 个 visible turn (codex t1 → sonnet t2 → codex t3) 共享，全部 `extra.stream.turnInvocationId=null`，Z8 group key `(catId, parent)` 把 codex 两个 turn 误并。砚砚 R0 push back 表述："不是每条 raw record mint 新 turnInvocationId，是 per visible assistant turn 一个 canonical bubble key，同 turn 内 stream/tool/rich/callback raw records 共享"。47 接受表述修正。Z9 spec by 47：AC-Z24 诊断 probe + AC-Z25 backend stamp + AC-Z26 frontend group key 强化（缺 turn telemetry 告警） + AC-Z27 replay fixture 全覆盖（multi-turn same parent / single turn multi-record / legacy no turn 三场景）。KD-28 落地。|
| 2026-05-11 23:35 | **Z9 hotfix merged (PR #1639, squash `b20ed491`)** — Z9 alpha re-test (16:08 PST 4-turn chengyu game by 47 + codex) failed: 4 records 全部 share parent invocation 无 turn stamp。诊断（47）发现根因：`safeParseExtra` (packages/api/src/domains/cats/services/stores/redis/redis-message-parsers.ts:94) 在 Redis 读路径 rebuild `result.stream = { invocationId }` only — **silently strips turnInvocationId**。Z9 backend stamp 100% 正确写入，但每次 Redis 读时丢字段 → 前端 `getBubbleInvocationId` fallback parent → 多 turn 同 cat 合并（R13/R14 真根因）。1-line parser fix + RED test 3/3 (parent≠turn / legacy only invocationId / first-in-chain own=parent)。砚砚 R1 LGTM after rebase。**Status: alpha re-test by 铲屎官**。|
| 2026-05-11 08:30 | **Phase Z9 merged (PR #1637, squash `49972d42`)** — Fast iteration path (铲屎官 07:18 approved) — 跳过 cloud Codex review，本地砚砚 R1→R3 review converged 2 P1 fixed：R1 P1 (broadcast turn fallback to parent + 5+ live broadcast sites old conditional)；R2 P1 (parallel done yield re-queries deleted catInvocationId map → undefined → fallback to parent)。最终交付：AC-Z24 诊断 probe + AC-Z25 backend always-stamp turnInvocationId (9 persist + 6 live broadcast via stampVisibleTurn helper) + AC-Z26 frontend group key 已正确 (existing helper turn-priority) + AC-Z27 replay fixtures 4/4。Phase Z10 spec opened (AC-Z28 liveness identity invariant for R14)。 **Status: alpha re-test by 铲屎官待执行** → 守护猫 sign-off → close F194 or continue Z10。|
| 2026-05-11 07:23~07:30 | **Phase Z9 实施完毕 (待 review)** — AC-Z24 诊断 probe (`buildProjectionDiagnostic`, 5/5 GREEN) + AC-Z25 backend always-stamp turnInvocationId 9 sites (route-serial 4 + route-parallel 3 + callbacks.ts 1 + messages.ts broadcast 1 + draft 1 + BoundSessionHistoryImporter 1) RED→GREEN 2/2 + 14/14 regression GREEN + AC-Z27 replay fixtures 4/4 GREEN (F1 multi-turn / F2 single-turn-multi-record / F3 legacy / F1+F3 mixed) + AC-Z26 deferred (frontend `getBubbleInvocationId` 已正确，telemetry follow-up) + AC-Z28 推迟 Phase Z10 (审计发现 `useChatHistory.ts:813` `fetchQueue` 已消费 `/queue`，铲屎官 R14 报告是 timing/race，需独立 runtime 诊断)。Branch `feat/f194-phase-z9` HEAD `9cb567468`。pending: 砚砚 local review + cloud Codex review。|

## Review Gate

- Phase A: helper contract + 单测 review（砚砚跨 family 必过）
- Phase B: messages + queue 双迁移 review（强守护 F173 hotfix3 行为兼容）
- Phase B (Bundle): 单一 PR review covering AC-B1~B16 一次性闭环；alpha 愿景守护（非作者非 reviewer 猫，对照铲屎官原话出对照表）放在 PR merge 后

## Close Gate Report

**Closed**: 2026-05-09 by 布偶猫/Opus-47 (author)
**Hard gate**: KD-23 satisfied — unit + integration tests + alpha runtime + 愿景守护对照表 全过。

### 愿景守护对照表

**守护猫**: 宪宪/Opus-46（非 author、非 reviewer，跨 4.6 视角）
**Runtime HEAD**: `0807f4165`（含 Phase Z merge `7443d049e`）

| 铲屎官原话 | AC | 验证方式 | 状态 | Evidence |
|---|---|---|---|---|
| R1 "现在活跃的线程他们气泡都是裂的" | AC-Z1+B5+B15 | runtime API + visual | ✅ | `/queue` = 1 active no ghost；铲屎官 05:11 重启后 visual confirm |
| R2 "讲讲为什么"（根因可解释、可观测） | AC-B11~B13 | structured events audit | ✅ | 3 event kinds, 10-field schema, `trackerSlotPresent` = actual presence |
| R3 "宪宪 47 方向 ok"（helper-based unified read model） | AC-A1+A2 | single helper audit | ✅ | `getThreadLiveInvocations` in both `messages.ts:1466` + `queue.ts:143` |
| R4 "不能只在前端打补丁，根因层解决" | AC-A1+Z2 | dual migration + producer | ✅ | 双消费方迁移完成 + `RouteChainCompletionTracker` + `ensureTerminalStatus` |

### 验收 evidence 三件套

1. **Spec/Unit/Integration tests** — F194/Z focused 95/95 + biome clean + wider regression（messages/draft-merge/record-store/reconcileZombies）一并过
2. **Alpha runtime acceptance** — 铲屎官 2026-05-09 05:11 重启 runtime（HEAD `0807f4165` PID `43143`）+ 多轮 active multi-cat thread visual confirm 不裂；opus-47 只读诊断 `/queue.activeInvocations[0].startedAt` 反映 child 真实启动时间（不再是 parent.updatedAt 旧时间）
3. **愿景守护对照表** — 见上表（4 行全 ✅）

### Review chain

- 本地 review: 砚砚/codex GPT-5.5 — R1→R6 APPROVE
- 云端 review: chatgpt-codex-connector — 6 轮（R1 P1 → R2 P1 → R3 LGTM → R4 P2 → R5 P2 → R6 LGTM "Swish!"）
- 愿景守护: 宪宪/Opus-46（孟加拉猫家族）— 跨族 + 4.6 视角

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F048-restart-recovery.md` | startup sweep 已落地；F194 是运行时补集 |
| **Feature** | `docs/features/F173-frontend-message-pipeline-unification.md` | 前端 thread-runtime state；spec line 78 已 audit 后端 tracker vs record 不一致 |
| **Feature** | `docs/features/F183-bubble-pipeline-architecture-consolidation.md` | Post-close Issue section（line 45-82）记录现场症状与初步修复方向 |
| **Code** | `packages/api/src/routes/messages.ts:1372-1499` | 既有 `recordActive || trackerActive` inline gate（F173 hotfix3）|
| **Code** | `packages/api/src/routes/queue.ts:97-110` | 既有 `activeInvocations` = `tracker.getActiveSlots()`，本 feat 待迁移 |
| **Code** | `packages/api/src/domains/cats/services/agents/invocation/InvocationTracker.ts` | 进程控制面 |
| **Code** | `packages/api/src/domains/cats/services/stores/redis/RedisInvocationRecordStore.ts` | lifecycle 真相源 |
| **Code** | `packages/api/src/domains/cats/services/stores/ports/DraftStore.ts` | 内容 freshness 信号 |
| **Bug Report** | `docs/bug-report/2026-05-09-f194-runtime-bubble-still-split-completion-leak/` | Phase Z 立项 root cause |
| **Code** | `packages/api/src/routes/messages.ts:695,878,1050` | parent invocation create + parentInvocationId 传入 + 终态写入 |
| **Code** | `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts:300,336` | per-turn registry invocation create |
| **Code** | `packages/api/src/domains/cats/services/agents/routing/route-serial.ts:765,891,1662` | ownInvocationId 捕获 + draft stamp + formal message stamp（用 parent 优先）|
| **Code** | `packages/api/src/domains/cats/services/agents/invocation/InvocationTracker.ts:224` | tracker startAll 不存 invocationId |
