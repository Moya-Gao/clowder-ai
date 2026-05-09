---
feature_ids: [F194]
related_features: [F048, F117, F173, F183]
topics: [invocation, liveness, redis, runtime-state, observability, message-pipeline]
doc_kind: spec
created: 2026-05-07
---

# F194: Invocation Liveness Canonical Read Model — 后端 invocation 活性真相源收口

> **Status**: in-progress (Phase A done) | **Owner**: 布偶猫(Opus 4.7) | **Priority**: P1
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

### Phase B (Bundle): 消费方迁移 + zombie cleanup + 运行时 diagnostic + alpha 验收

> **Single bundled phase（CVO ack 2026-05-08）**：原 4-phase 拆分（A/B/C/D 各一）调整为 **2-phase 拆分**——Phase A 已独立 merged（PR #1592, squash `4b5edfdd2`）；**消费方迁移 + zombie cleanup + diagnostic + alpha 全部合并为单一 Phase B (Bundle)** 一锅端做完一锅端 review。spec 真相源直接反映"single bundle"，避免子 step 之间的 review iteration 碎片化（详见 KD-12）。

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
- [ ] AC-B14: alpha 实测：active thread 在正常 stream 期间无 `liveness_degraded` 噪音（false positive 检查）
- [ ] AC-B15: alpha 实测：构造 record+tracker missing 场景，`/api/messages` 与 `/queue` 不再矛盾，前端不再裂气泡
- [ ] AC-B16: 愿景守护：非作者非 reviewer 猫输出对照表（铲屎官原话 vs 实际状态），确认 active thread 裂气泡不复现

### 端到端

- [ ] AC-Z1: 铲屎官 2026-05-07 报告的 "现在活跃的线程他们气泡都是裂的" 在 alpha 通道实测全部消失
- [ ] AC-Z2: 后端 `/api/messages` 与 `/api/threads/:threadId/queue` 共用同一 canonical helper，单一规则源
- [ ] AC-Z3: 后续新增 read endpoint（admin observability / debug API）可直接复用 helper，不需要自拼三家 store

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "现在活跃的线程他们气泡都是裂的" | AC-B5, AC-B15, AC-Z1 | paired-route regression + alpha 实测 | [ ] |
| R2 | 让我"讲讲为什么"——根因可解释、可观测 | AC-B11, AC-B12, AC-B13 | structured event schema + log review | [ ] |
| R3 | "找宪宪 46 或者 47…大概看了一下你的方向我觉得 ok" | AC-A1, AC-A2 | helper contract review | [ ] |
| R4 | 不能只在前端打补丁，从根因层（liveness contract）解决 | AC-A1, AC-Z2 | helper 单 contract + 双消费方迁移 | [ ] |

### 覆盖检查
- [ ] 每个需求点都能映射到至少一个 AC
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

## Review Gate

- Phase A: helper contract + 单测 review（砚砚跨 family 必过）
- Phase B: messages + queue 双迁移 review（强守护 F173 hotfix3 行为兼容）
- Phase B (Bundle): 单一 PR review covering AC-B1~B16 一次性闭环；alpha 愿景守护（非作者非 reviewer 猫，对照铲屎官原话出对照表）放在 PR merge 后

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
