# F245 Phase B — 跨通道 Friction 统一聚合 Implementation Plan

**Feature:** F245 — `docs/features/F245-friction-signal-eval.md`
**Goal:** 4 个采集通道经 Port+Adapter 统一 pull 成 `FrictionSignal`，dedup + rule/embedding cluster 成内存 cluster（含 count + 成员 evidence refs），不建统一 store。
**Acceptance Criteria（抄自 feat doc）:**
- **AC-B1**: 4 通道统一消费 adapter——爪感差(已建) + cancel 引 task-outcome + F222 引 issue 池 + eval 域引 friction_counts；**不重新实现既有三通道采集**（trace Why：A 聚合不搬迁）
- **AC-B2**: dedup + cluster——"rg 噪音 ×N" 折叠成 1 cluster，cluster 含 count + 成员 evidence refs；误聚合率有 fixture 验证
**Architecture cell:** harness-eval
**Map delta:** update required
**Map delta why:** Phase A 已登记 `friction/` 子目录；Phase B 新增 cancel/user-feedback/eval-domain 三 Adapter + FrictionAggregator + FrictionClusterer，需补登 harness-eval cell 的 canonical files。
**Architecture:** Port+Adapter（`IFrictionSignalSource`，Phase A 已定义）。每 Adapter `pull(sinceMs, untilMs)` **只读**引用源数据（KD-4），无写侧改动。Aggregator 合并 4 Adapter + deterministic-id dedup；Clusterer 先 rule 后 embedding（`IEmbeddingService` 注入，fail-open 降级 lexical）。内存聚合，不持久化（KD-5）。
**Tech Stack:** TypeScript, `node --test`（手写 `.js` import `dist/`，对齐 Phase A KD-6①）, IEmbeddingService(HTTP/GPU), SQLite(task-outcome 只读), Redis(F222 只读 scan)
**前端验证:** No（Eval Hub 视图是 Phase D）

---

## Finish Line（A→B，no detour）

输入 `[sinceMs, untilMs)` → 输出 `FrictionRollupInput`：dedup 后的 signal 列表 + cluster 列表（每 cluster 含 channel 分布 / count / 成员 rawRef）+ degraded 标志。这是 **Phase C rollup 的纯函数输入**，可独立测试（给 fixture window → 断言 cluster 数与成员）。

**NOT building（划清边界）：**
- ❌ 持久 store / 中间 store（KD-5：只内存聚合，持久化的是 Phase C verdict artifact）
- ❌ rollup sink / last-run gate / N-day cadence（**Phase C**）
- ❌ domain 注册 / `eval-friction.yaml` / verdict 产出（**Phase C**）
- ❌ `domainId` / `sourceAdapter` / `sourceRefsKind` 枚举扩展（**Phase C**，等 F236+F245 shared Y-lite PR；handoff gotcha① — **绝不在 Phase B 碰**）
- ❌ F128 出口 / code-as-harness 修复链 / Eval Hub 视图（**Phase D**）
- ❌ 改任何 canonical store 的**写侧**（KD-4：只读 read-model，见下方决策）

---

## Terminal Schema

```typescript
// 已有（Phase A，packages/shared/src/types/friction-signal.ts）：
//   FrictionSignal { id, channel, catId?, threadId?, timestamp, tool?, symptom, rawRef, severity, sourceEvidence? }
//   FrictionChannel = 'paw-feel' | 'cancel' | 'user-feedback' | 'eval-domain'
//   FrictionSeverity = 'low' | 'medium' | 'high'
// 已有（Phase A，api/harness-eval/friction/）：
//   interface IFrictionSignalSource { readonly channelId: FrictionChannel; pull(sinceMs, untilMs): Promise<FrictionSignal[]>; }

// === 新增（packages/shared/src/types/friction-signal.ts） ===
interface FrictionClusterMember {
  signalId: string;       // FrictionSignal.id
  rawRef: string;         // 可追溯到源（messageId#idx / issueId / signalRowId / verdictId#metric）
  channel: FrictionChannel;
}
interface FrictionCluster {
  clusterId: string;            // deterministic：sha1(归一化代表文本) 前 12 位
  representative: string;       // 代表 symptom（cluster 标题）
  channels: FrictionChannel[];  // 去重升序；跨通道出现 = 强信号（Phase C 排序用 channel diversity）
  count: number;                // === members.length
  members: FrictionClusterMember[];
  method: 'rule' | 'embedding'; // 此 cluster 由哪层聚出（可观测，便于 误聚合 归因）
}
interface FrictionRollupInput {
  window: { sinceMs: number; untilMs: number };
  signals: FrictionSignal[];    // dedup 后全量（cluster 的并集 ⊆ 此）
  clusters: FrictionCluster[];
  degraded: boolean;            // embedding 服务未就绪 → 仅 rule cluster
}
```

> 终态 schema 即步骤围绕的骨架，非脚手架。每个 Task 的产出 extend-only 进入此 schema。

---

## Stateful Object Gate 普查（F229 教训：Census 先行，不假设豁免）

**普查范围**：Phase B 全部组件，逐个判定有无生命周期状态（特别查"复用现有 API 的新消费侧状态"：游标 / cache / 到达判定器）。

| 候选对象 | 状态机? | 判定依据 |
|---|---|---|
| Cancel/UserFeedback/EvalDomain 三 Adapter | ❌ 无状态 | `pull(window)` 每次按窗口回扫源，无跨调用累积（对齐 PawFeelAdapter 范式） |
| FrictionAggregator | ❌ 无状态 | `collect(window) = flatMap(adapters.pull) + dedup`，**窗口外部传入，无内建消费游标** |
| dedup `Set<id>` | ❌ 局部 | 单次 collect 内创建/销毁，无生命周期 |
| FrictionClusterer | ❌ 无状态 | 单次 `cluster(signals)` 内存聚类，结果返回不留存 |
| embedding 向量 cache | ❌ 不建 | **明确不跨调用 cache**（YAGNI；后台周期任务每次重 embed 窗口内 signal）。若 Phase C 需 cache = Phase C 决策 |
| `IEmbeddingService` 连接态 | ⚠️ 外部已有 | isReady/reprobe 属 memory 域 `EmbeddingService` 生命周期，Phase B **只消费不拥有** |
| EvalDomain snapshot 发现 | ❌ 只读 | 扫 `<feedbackRoot>/bundles/*/snapshot.json` 文件系统只读，无状态 |

**结论**：Phase B 设计为**无状态 pull 管道**，**无新增持久状态对象**。三类消费侧状态候选（游标 / cache / 扫描）均经普查显式排除——窗口外部传入、cache 不建、扫描只读。

> 这是**论证性豁免**（普查证明无状态），非 Phase A 式"纯采集"假设豁免。**Phase C 引入 last-run gate / rollup sink 时必须重做完整三件套**（状态×事件转移表 + INV 编号 + 对抗场景），本 plan 已把这些状态对象划在边界外。

---

## KD-4 只读边界决策（技术 OQ，自决，可逆）

ground 发现 cancel / F222 源无现成"按时间窗 pull"接口，两处需新增。**均严格只读、不碰写侧**以守 KD-4「只读 read-model，不抢 canonical ownership」：

| 源 | 新增 | 动写侧? | KD-4 |
|---|---|---|---|
| cancel（SQLite `task_outcome_signals`） | `TaskOutcomeEpisodeStore.listSignalsInWindow(sinceMs, untilMs, types?)` — 只读 SQL | ❌ 否 | ✅ 只加 read 接口，不改 append 逻辑 |
| F222（Redis） | `RedisFrustrationIssueStore.listConfirmedInWindow(sinceMs, untilMs)` — 内部 `scanStream('frustration-issues:confirmed:*')` 只读聚合 | ❌ 否 | ✅ 不碰 create/confirm 写路径 |

**为何 F222 选 scanStream 而非写侧全局 zset**：写侧加 `zadd confirmed-global` 会改 F222（canonical owner）的写路径，触 KD-4「不抢 ownership」。friction eval 是后台周期任务（3天/weekly），**非热路径**，单次 scan 可接受。可逆（删方法即回滚）→ 技术 OQ 自决，**plan review 时请 reviewer 复核 KD-4 边界判断**。

> ⚠️ **scanStream keyPrefix 坑**（`reference_redis-pitfalls` + `RedisSessionChainStore.scanKeys` 先例）：ioredis `keyPrefix` 不自动作用于 `SCAN MATCH`，需手动拼前缀。Task 3 测试必须用 Redis-backed（非 in-memory，feedback_inmemory_store_tests_miss_redis_behavior）。

---

## 系统性收口候选（handoff gotcha③ — 显式处理 vs defer）

| 候选 | 决策 | 理由 |
|---|---|---|
| cat-authored 引用 intent 过滤（讨论里写"爪感差"字样≠真报摩擦） | **Phase B 处理**（Clusterer 前 intent filter） | handoff：rollup 层非采集层 → 属聚合层。Task 6 加 filter |
| in-memory `getBefore` 对齐 effective time | **defer**（不 widen） | gpt52 已确认不在采集层改；Phase B 只读消费 PawFeelAdapter 既有行为 |
| test-infra Redis key 隔离 | **defer**（既有 debt，R4 pushback 既定 pattern） | 非 Phase B 引入；Task 3/4 沿用既有 test pattern |
| merge-gate 临时 worktree 依赖 | **merge 时处理** | 砚砚解药：`CI=1 NODE_ENV=development pnpm install --frozen-lockfile --ignore-scripts --prod=false` |

---

## Tasks（TDD：每 Task 红→绿→commit）

### Task 1: cancel 源只读时间窗查询
**Files:**
- Modify: `packages/api/src/infrastructure/harness-eval/task-outcome/task-outcome-store.ts`
- Test: `packages/api/test/harness-eval/task-outcome-store-window.test.js`

**签名:** `listSignalsInWindow(sinceMs: number, untilMs: number, types?: string[]): TaskOutcomeSignalRecord[]`
**SQL:** `SELECT * FROM task_outcome_signals WHERE createdAt >= ? AND createdAt < ? [AND type IN (?...)] ORDER BY createdAt ASC`
**测试点（红→绿）:** ① 窗口 `[sinceMs, untilMs)` 半开（边界：untilMs 当刻不含）② type 过滤 `['permission_cancel','cancel_burst']` ③ 空窗返回 `[]` ④ 升序。
**验证:** `node --test packages/api/test/harness-eval/task-outcome-store-window.test.js`
**Commit:** `feat(F245): task-outcome signals 只读时间窗查询（Phase B cancel 源）`

### Task 2: CancelAdapter
**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/friction/cancel-adapter.ts`
- Test: `packages/api/test/harness-eval/cancel-adapter.test.js`

**实现:** `class CancelAdapter implements IFrictionSignalSource`，`channelId='cancel'`，构造依赖 `Pick<TaskOutcomeEpisodeStore,'listSignalsInWindow'>`。`pull(sinceMs,untilMs)` → 调 listSignalsInWindow(types=['permission_cancel','cancel_burst']) → map 到 FrictionSignal：
- `id = 'cancel:' + signalRowId`（deterministic 幂等）
- `channel='cancel'`, `threadId`, `timestamp=ISO(createdAt)`, `severity`：cancel_burst→'high' / permission_cancel→'medium'
- `symptom`：`record.type` + 关键 detail（如 `cancel_burst×{count}`）, `rawRef=signalRowId`
**测试点:** ① N 条 signal → N 条 FrictionSignal ② 幂等（同源两次 pull 同 id）③ severity 映射 ④ 窗口透传。
**Commit:** `feat(F245): CancelAdapter（cancel 通道，只读 task-outcome）`

### Task 3: F222 只读全局时间窗扫描
**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisFrustrationIssueStore.ts`
- Test: `packages/api/test/.../redis-frustration-issue-store-window.test.js`（Redis-backed，用 test:redis）

**签名:** `listConfirmedInWindow(sinceMs: number, untilMs: number): Promise<FrustrationIssue[]>`
**实现:** `scanStream({ match: <prefix>+'frustration-issues:confirmed:*', count: 100 })` 收集 key → 每 key `ZRANGEBYSCORE key sinceMs (untilMs`（`(` 排除上界）→ getById hydrate → 合并升序。手动拼 keyPrefix。
**测试点:** ① 跨多 user key 聚合 ② 窗口半开 ③ keyPrefix 正确（红测先暴露 prefix 坑）④ 空结果。
**验证:** `pnpm --filter @cat-cafe/api test:redis`
**Commit:** `feat(F245): F222 confirmed issue 只读全局时间窗扫描（守 KD-4）`

### Task 4: UserFeedbackAdapter
**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/friction/user-feedback-adapter.ts`
- Test: `packages/api/test/harness-eval/user-feedback-adapter.test.js`

**实现:** `channelId='user-feedback'`，依赖 `Pick<RedisFrustrationIssueStore,'listConfirmedInWindow'>`。`pull` → map FrustrationIssue → FrictionSignal：`id='user-feedback:'+issueId`，`tool`=从 signalDetail 提取（如有），`symptom`=signalType + 摘要，`severity` 按 signalType 映射，`rawRef=issueId`。**排除 signalType='cancel_burst'**（避免与 cancel 通道双采——cancel 的全量真相源是 task-outcome，F222 的 cancel_burst 是稀疏采样）。
**测试点:** ① 幂等 ② cancel_burst 类型被排除 ③ 字段映射 ④ 空窗。
**Commit:** `feat(F245): UserFeedbackAdapter（F222 通道，排除 cancel 重叠）`

### Task 5: EvalDomainAdapter
**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/friction/eval-domain-adapter.ts`
- Test: `packages/api/test/harness-eval/eval-domain-adapter.test.js`（用临时 fixture 目录）

**实现:** `channelId='eval-domain'`，依赖 feedbackRoot 路径。`pull(sinceMs,untilMs)`：扫 `<root>/bundles/*/snapshot.json`，按 snapshot 的 generatedAt 落窗口 → 每 component 的 `frictionCounts: Record<string, number|null>` 中**非零非 null** metric → 一条 FrictionSignal：`id='eval-domain:'+verdictId+'#'+domain+'#'+metric`，`tool`=domain 名，`symptom`=`{metric}={count}`，`severity`='low'（聚合 proxy，非单事件），`rawRef=verdictId#metric`。
**测试点:** ① fixture 多 domain snapshot → 正确条数 ② 零/null metric 跳过 ③ 窗口按 generatedAt ④ 幂等。
**Commit:** `feat(F245): EvalDomainAdapter（eval 域 friction_counts，只列出）`

### Task 6: FrictionAggregator（合并 4 Adapter + dedup + intent filter）
**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/friction/friction-aggregator.ts`
- Test: `packages/api/test/harness-eval/friction-aggregator.test.js`

**实现:** 构造注入 `sources: IFrictionSignalSource[]`（4 个）。`collect(sinceMs,untilMs): Promise<FrictionSignal[]>` → `Promise.all(sources.map(pull))` flat → **dedup by `id`**（deterministic id 去重）→ **intent filter**（剔除 cat-authored 非真摩擦引用：纯函数 `isGenuineFriction(signal)`，规则见下）→ 升序。
**intent filter 规则（保守，宁放过不误杀）:** 仅剔除明确的元讨论引用（如 symptom 命中"举例/比如/feedback_/skill 名"且来自讨论 thread）。默认保留。规则化纯函数，单测覆盖。
**测试点:** ① 4 源合并 ② 跨源同 id 去重（构造 dup）③ intent filter 剔除元引用、保留真摩擦 ④ 某源抛错 → 降级跳过不整体失败。
**Commit:** `feat(F245): FrictionAggregator（4 通道合并 + dedup + intent filter）`

### Task 7: FrictionClusterer — rule 层
**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/friction/friction-clusterer.ts`
- Test: `packages/api/test/harness-eval/friction-clusterer-rule.test.js`

**rule 算法:** 归一化 key = `lower(tool) + '|' + 归一(symptom 关键词集)`（去标点/停用词/数字）。同 key → 同 cluster。`representative`=最高频成员 symptom，`clusterId`=sha1(归一 key)[:12]，`method='rule'`，`channels`=成员去重。
**测试点:** ① "rg 噪音大"×12（同 tool+关键词）→ 1 cluster count=12 ② 不同 tool 不聚 ③ 跨通道同问题 → channels 含多通道 ④ clusterId deterministic。
**Commit:** `feat(F245): FrictionClusterer rule 层（关键词归一聚类）`

### Task 8: FrictionClusterer — embedding 层 + fail-open 降级
**Files:**
- Modify: `friction-clusterer.ts`（加 embedding pass）
- Test: `packages/api/test/harness-eval/friction-clusterer-embedding.test.js`

**embedding 算法:** rule 层未聚的单例 → 注入 `IEmbeddingService`。`reprobeIfNeeded()` + `isReady()` 守卫：未就绪 → 跳过 embedding pass，`degraded=true`，仅返回 rule cluster。就绪 → `embed(symptoms)` 得 `Float32Array[]` → 贪心聚类（cosine ≥ 阈值 τ≈0.82 归一组，`method='embedding'`）。
**测试点:** ① stub IEmbeddingService isReady=false → degraded=true 且仅 rule cluster（无异常）② isReady=true + 高相似向量 → 聚一组 ③ 低相似 → 不聚（误聚合防护）④ 阈值边界。
**Commit:** `feat(F245): FrictionClusterer embedding 层 + fail-open 降级`

### Task 9: 集成 + FrictionRollupInput 装配 + 误聚合 corpus gate
**Files:**
- Create: `packages/api/src/infrastructure/harness-eval/friction/friction-rollup-input.ts`（装配 collect→cluster→FrictionRollupInput）
- Create: `packages/api/test/harness-eval/__fixtures__/friction-cluster-corpus.js`
- Test: `packages/api/test/harness-eval/friction-rollup-input.integration.test.js`
- Modify: `packages/shared/src/types/friction-signal.ts`（加 FrictionCluster/Member/RollupInput；改后 `pnpm --filter @cat-cafe/shared build`）

**corpus gate（AC-B2 误聚合验证）:** fixture 含 ① 同类噪音 ×N（应聚 1）② 不同问题（不应聚）③ 跨通道同问题（channels 多通道）④ 正常无摩擦（不产 cluster）。断言 cluster 数 + 成员 + 误聚合率=0。
**测试点:** 端到端 4 源 fixture → FrictionRollupInput；degraded 路径；窗口透传。
**验证:** `node --test packages/api/test/harness-eval/friction-*.test.js` + `pnpm check`
**Commit:** `feat(F245): Phase B 集成 + FrictionRollupInput + 误聚合 corpus gate`

---

## Open Questions

| # | 问题 | 类型 | 处理 |
|---|------|------|------|
| OQ-B1 | F222 全局枚举：scanStream(只读) vs 写侧 zadd | 技术（已决） | 选 scanStream 守 KD-4，review 复核 |
| OQ-B2 | embedding cosine 阈值 τ | 技术 | 实现期 corpus 调参，默认 0.82，写进 test |
| OQ-B3 | intent filter 误杀风险 | 技术 | 保守规则（宁放过），corpus 含元引用样本验证 |
| OQ-B4 | cancel severity 映射粒度 | 技术 | burst→high / single→medium，可 Phase C 调 |

无价值 OQ → 不升级 CVO（方向 Design Gate 已收敛）。

---

## 完成定义（可验证）
- [ ] 9 Task 全绿（`node --test friction-*` + `pnpm --filter @cat-cafe/api test:redis` + `pnpm check`）
- [ ] AC-B1：4 Adapter 实现 IFrictionSignalSource，零写侧改动（KD-4）
- [ ] AC-B2：误聚合 corpus gate 绿（同类折叠 + 不同不聚 + 误聚合率 0）
- [ ] Stateful Object Gate：普查无状态结论成立（无新持久状态对象）
- [ ] 跨族 review（砚砚/gpt52）复核 KD-4 只读边界 + intent filter

## 下一步
plan commit + push（main）→ `worktree`（开 Phase B 隔离环境，Redis 6398）→ `tdd`（Task 1 起）。
