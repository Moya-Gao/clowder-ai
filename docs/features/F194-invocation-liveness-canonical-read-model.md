---
feature_ids: [F194]
related_features: [F048, F117, F173, F183]
topics: [invocation, liveness, redis, runtime-state, observability, message-pipeline]
doc_kind: spec
created: 2026-05-07
---

# F194: Invocation Liveness Canonical Read Model — 后端 invocation 活性真相源收口

> **Status**: spec | **Owner**: 布偶猫(Opus 4.7) | **Priority**: P1
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

interface LiveInvocation {
  catId: CatId;
  invocationId: string;
  startedAt: number;
  /** 这条 live 由哪些 source 共同支撑 */
  source: 'tracker' | 'record+tracker' | 'record+draft';
  /** true = record running + tracker missing + fresh draft（恢复优先暴露 active），前端 reconcile 兜底 */
  degraded: boolean;
  /** 诊断字段：'tracker_present' | 'record_running_with_fresh_draft' | … */
  reason: string;
}

interface ZombieRecord {
  invocationId: string;
  catId: CatId | null;
  recordStatus: 'running';
  recordUpdatedAt: number;
  /** 检测到的原因：'no_tracker_no_fresh_draft_age_exceeded' | … */
  reason: string;
}

interface LivenessReadResult {
  active: LiveInvocation[];
  /** 检测到的 zombie；不暴露给用户层 read endpoint，由 cleanup pathway 异步收尸 */
  zombies: ZombieRecord[];
}

async function getThreadLiveInvocations(
  threadId: string,
  userId: string,
  deps: { invocationTracker; invocationRecordStore; draftStore },
  opts?: { now?: number; zombieThresholdMs?: number },
): Promise<LivenessReadResult>;
```

### Canonical 判定规则（砚砚 push back 后版本）

按 `(record, tracker, draft.fresh)` 三元组分类：

| record | tracker | draft fresh? | 判定 | source / degraded / 诊断 |
|--------|---------|-------------|------|-----------------------|
| running | active | — | **live** | `source='record+tracker'`, `degraded=false`, `reason='tracker_present'` |
| running | missing | yes | **live (degraded)** | `source='record+draft'`, `degraded=true`, `reason='record_running_with_fresh_draft'`，emit `liveness_degraded` |
| running | missing | no, age > 2×DraftStore TTL | **zombie** | 不暴露 active；emit `record_zombie_detected`；进 `zombies[]` 供 cleanup |
| running | missing | no, age ≤ threshold | **live (degraded)** | grace 期间继续暴露，避免误杀刚断链的合法 invocation；emit `liveness_pending` |
| not running | — | — | **not live** | helper 不输出 |

> **关键点**：`record.updatedAt` **不是** heartbeat（record 写完后只在 markDone/markError/状态变化时再更新）；用 `draft.updatedAt`（stream chunk + touch 触发刷新）作 freshness 主信号。threshold 默认 `2 × DraftStore TTL ≈ 600s`，**仅适用于 no fresh draft 场景**，永远不杀 fresh draft。

### Phase A: Helper API + 单元测试（先定义 contract）

- 新增 `getThreadLiveInvocations.ts` + 单测覆盖上表 5 类组合 + helper 返回结构 stable
- 不接任何消费方
- contract 通过 review 后才进 Phase B

### Phase B: 双消费方迁移（messages + queue 同 PR 收口）

- `messages.ts:1407-1465` 现有 inline `recordActive || trackerActive` gate 迁移到 helper（保留现有过滤行为：active drafts 只保留 helper 认为 live 的，但接受 `degraded` flag）
- `queue.ts:108` 的 `activeInvocations` 替换为 `helper(threadId, userId).active`，语义升级为 "服务端 canonical live view"
- API regression：构造三类 split-brain 场景，断言两个 endpoint 返回一致

### Phase C: Zombie cleanup contract + StartupReconciler 运行时 sweep

- helper 输出的 `zombies[]` 由独立 cleanup pathway 异步消费（不阻塞 read 路径）
- 复用 F048 Phase A 的 `StartupReconciler` 加入运行时 sweep 接口（cron 或 demand-triggered）
- zombie 收尸语义沿用 F048：标 `failed(error='zombie_record_detected')` + 清 TaskProgress

### Phase D: Runtime diagnostic + alpha 验证

- 结构化事件 schema：`liveness_degraded` / `liveness_pending` / `record_zombie_detected`，字段含 `threadId`/`catId`/`invocationId`/`recordStatus`/`recordUpdatedAt`/`trackerSlotPresent`/`draftFresh`/`draftAge`/`reason`
- 接 logger（参照 F183 Phase C `broadcast_rate_warn` 的范式）
- alpha 通道实测：构造 record+tracker missing+fresh draft 场景验证 degraded 暴露；构造 record+tracker missing+no fresh draft+age 超 阈值场景验证 zombie cleanup
- 愿景守护：非作者非 reviewer 的猫确认"裂气泡"症状在 active thread 不再复现

## Acceptance Criteria

### Phase A（Helper API + 单测）

- [ ] AC-A1: `getThreadLiveInvocations.ts` 落地，签名含 `(threadId, userId, deps, opts?)` → `LivenessReadResult`
- [ ] AC-A2: 返回结构含 `active[]`（`source`/`degraded`/`reason`）+ `zombies[]`，类型导出供消费方 import
- [ ] AC-A3: 单测覆盖判定表 5 类组合（normal live / degraded with fresh draft / zombie / pending grace / not running）
- [ ] AC-A4: 单测断言 `zombies[]` 与 `active[]` 互斥（同一 invocationId 不能同时在两个数组）
- [ ] AC-A5: helper 不写 store（read-only），cleanup 由 Phase C 独立 pathway 消费 `zombies[]`
- [ ] AC-A6: threshold 走 opts 注入（默认 `2 × DraftStore TTL = 600s`）便于测试 / alpha 调参

### Phase B（消费方迁移）

- [ ] AC-B1: `messages.ts` 现有 `recordActive || trackerActive` inline gate 迁移到 helper；保留 P1-2 dedup（formal invocationId set）和 wider window 行为
- [ ] AC-B2: `queue.ts` 的 `activeInvocations` 改为 helper 输出（`active.map(s => ({ catId, startedAt }))`，保持现有 schema 不破前端契约）
- [ ] AC-B3: API regression：构造 record running + tracker missing + fresh draft 场景，`/api/messages` 与 `/api/threads/:threadId/queue` 必须返回一致 liveness（同一 invocationId 要么两边都 live 要么两边都不 live）
- [ ] AC-B4: API regression：构造 record running + tracker missing + no fresh draft + age 超阈值，两个 endpoint 都不暴露该 invocation 为 active
- [ ] AC-B5: 既有 `messages.ts` orphan-draft filter 行为不退化（F173 hotfix3 行为兼容）

### Phase C（Zombie cleanup pathway）

- [ ] AC-C1: cleanup pathway（`reconcileZombies(threadId | global)`）落地，复用 F048 sweep 语义：标 `failed(error='zombie_record_detected')` + 清 TaskProgress
- [ ] AC-C2: cleanup 不阻塞 read 路径——helper 永远 read-only，cleanup 走独立 invocation（cron / demand-trigger / startup sweep 三个入口）
- [ ] AC-C3: cleanup 单测：构造 zombie record → 调 reconcileZombies → 断言 record 转 failed + TaskProgress 清空 + audit log
- [ ] AC-C4: cleanup 必须幂等：同一 zombie 重复 reconcile 不应产生 duplicate audit / 错误 status

### Phase D（Diagnostic + alpha 验证）

- [ ] AC-D1: 结构化事件 `liveness_degraded`/`liveness_pending`/`record_zombie_detected` schema 落地，含 `threadId`/`catId`/`invocationId`/`recordStatus`/`recordUpdatedAt`/`trackerSlotPresent`/`draftFresh`/`draftAge`/`reason`
- [ ] AC-D2: helper emit hook 注入到 logger（参照 F183 `broadcast_rate_warn` 范式），不通过 throw 中断 read
- [ ] AC-D3: alpha 实测：active thread 在正常 stream 期间无 `liveness_degraded` 噪音（false positive 检查）
- [ ] AC-D4: alpha 实测：构造 record+tracker missing 场景，`/api/messages` 与 `/queue` 不再矛盾，前端不再裂气泡
- [ ] AC-D5: 愿景守护：非作者非 reviewer 猫输出对照表（铲屎官原话 vs 实际状态），确认 active thread 裂气泡不复现

### 端到端

- [ ] AC-Z1: 铲屎官 2026-05-07 报告的 "现在活跃的线程他们气泡都是裂的" 在 alpha 通道实测全部消失
- [ ] AC-Z2: 后端 `/api/messages` 与 `/api/threads/:threadId/queue` 共用同一 canonical helper，单一规则源
- [ ] AC-Z3: 后续新增 read endpoint（admin observability / debug API）可直接复用 helper，不需要自拼三家 store

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "现在活跃的线程他们气泡都是裂的" | AC-B3, AC-B4, AC-D4, AC-Z1 | API regression + alpha 实测 | [ ] |
| R2 | 让我"讲讲为什么"——根因可解释、可观测 | AC-D1, AC-D2 | structured event schema + log review | [ ] |
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
| zombie 阈值过松，治不了 zombie | Phase D 加 `liveness_degraded`/`liveness_pending` 事件计数，alpha 实测看真实 zombie 比例 |
| messages.ts 现有 inline gate 迁移引入 regression（既有 hotfix3 行为兼容） | Phase B 强制保留 P1-2 dedup + wider window 行为，AC-B5 显式守护 |
| helper 引入跨 store 调用 latency 增加 read endpoint 响应时间 | helper 内部并行 fetch（tracker O(1) + record by id + draft by thread）；cache 不在本 feat scope |
| 多实例部署后跨进程 tracker 不可见会被误判 zombie | 阈值 + draft freshness 兜底，进程重启后 startup sweep 兜底；多实例正式支持留 F048 Phase B 解决 |
| Phase C cleanup 路径与 F048 startup sweep 行为漂移 | Phase C 直接复用 F048 现有 sweep helper，不另写一套；cleanup audit log 用同一 schema |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | helper 是否需要 cache 层？高频 endpoint 每次 read 都跨 3 store 拉数据 | ⬜ Phase B 跑出 baseline latency 后定 |
| OQ-2 | cleanup pathway 入口选 cron / demand-trigger / startup sweep 三种哪种作主？ | ⬜ Phase C 设计阶段拍板，建议 demand-trigger（read endpoint 检测到 zombie 时异步发起）+ startup sweep 双保险 |
| OQ-3 | `liveness_degraded` 事件是否要做 dedup（同 invocation 短时间多次触发） | ⬜ Phase D 定，参考 F183 `broadcast_rate_warn` 5s warn dedup 范式 |
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

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-07 | F183 post-close issue 报告（铲屎官 19:14 发现 active thread 气泡仍裂） |
| 2026-05-07 | 砚砚只读诊断捕到 split-brain（3 个 thread 同型号 messages vs queue 矛盾） |
| 2026-05-07 | 砚砚记录入 F183 spec post-close section（commit 96209ae2b）|
| 2026-05-07 | 砚砚 → opus-47 架构判断 handoff |
| 2026-05-07 | opus-47 给方向（helper-based unified read model + zombie detection），砚砚 push back（draft freshness 主信号 + degraded vs zombie 二分 + helper 返回带 source/reason/degraded） |
| 2026-05-07 | 立项 F194，opus-47 author / 砚砚 reviewer |

## Review Gate

- Phase A: helper contract + 单测 review（砚砚跨 family 必过）
- Phase B: messages + queue 双迁移 review（强守护 F173 hotfix3 行为兼容）
- Phase C: cleanup pathway review（强守护幂等性 + 与 F048 sweep 语义对齐）
- Phase D: alpha 愿景守护（非作者非 reviewer 猫，对照铲屎官原话出对照表）

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
