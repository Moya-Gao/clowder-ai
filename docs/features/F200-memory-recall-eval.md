---
feature_ids: [F200]
related_features: [F102, F153, F163, F188, F192]
topics: [memory, eval, observability, IR]
doc_kind: spec
created: 2026-05-14
---

# F200: Memory Recall Eval — 基于猫真实行为的记忆系统反馈闭环

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P1

## Why

### 问题

Cat Cafe 的记忆系统（F102 存储基座 + F163 治理层 + F188 管护工具链）已经能"记住"和"治理"知识，但**不知道猫用得好不好**。现有 telemetry（F188 三入口分布 + nudge follow + grep fallback rate）已有 adoption/friction 信号，但缺少 **search result → read/use/verify 的正向 consumption 信号**。我们无法回答：

- 搜索结果排第几的被猫真正读了？
- 猫搜了几轮才找到想要的东西？
- 花了多少 token？
- graph 推荐的候选有没有被 follow？
- 一个 anchor 90 天没人读是不是该 sunset？

### 铲屎官启发（2026-05-14 原话摘录）

> "如果猫猫搜了 evidence 然后他决定用任何方式去读了 evidence 去推荐的文档！！是不是可以算真实命中！你想哦！！你们在 agentic search 的时候！！可是要决定要不要往下读！！"

> "有的时候行为能暴露出你们对于这些东西的判断的！！！"

> "比如猫猫目前的任务 xxxx，猫猫搜索了 xxxx 看了 xxx 文档 修改了 xxx 干了啥啥啥，最后产出 yyyy，我倒是觉得这个轨迹很值钱，搜集的多了都能优化我们的系统"

> "这些可是不需要大模型就能做的！！"

### MemOS 对照（2026-05-12 华为研讨会 teardown 启发）

MemOS 2.0 用 LLM 自评（R_human）+ 数学公式（γ/α/V/η/support/gain）给每条记忆打分。砚砚代码级拆解发现根信号有毒：模型自评集中在 0.6-0.85 成功区间，负样本几乎没有，他们在 `gain.ts` 自承认原公式在真实环境塌掉（`apps/memos-local-plugin/core/memory/l2/gain.ts:19-29`）。

**我们的 tradeoff 选择**：不给 truth/authority 打分，只给 **navigation utility** 打分。根信号来自猫的真实 tool call 行为，不是 LLM 自评。consumption 信号只能影响搜索排序和导航优先级，不能影响 authority（authority 仍来自 spec/ADR/review/CVO）。

### 信号层 → Phase 对应关系

| 信号层 | 行为 | 收集 Phase | 使用 Phase |
|--------|------|-----------|-----------|
| L0 | 搜了 | A | B（统计） |
| L1 | 搜了 → 读了某条候选（revealed preference） | A | C（改排序，shadow first） |
| L2 | 搜了 → 读了 → 引用/修改了 | D | D（task trajectory） |
| L3 | 搜了 → 读了 → 用了 → 产出被验证 | D | D+（闭环） |

**Phase C 只吃 L1 信号**。L2/L3 需要 Phase D 的 TaskTrajectory 才能收集。

### 为什么这是独立 Feature 而不是 F192 的子 Phase

F192 是 harness 层面的社会技术评估框架（共创机制 + harness-feedback 文档 + eval contract）。F200 是记忆子系统的专项反馈闭环，需要：新的 event correlation 机制、新的指标族、对 search/graph 排序的实际改进。F192 提供评估框架，F200 在这个框架里建具体的 memory recall eval pipeline。

## What

### Phase A: Search Session Telemetry（打地基）

在 F153 observability 基础上，为每次 memory tool 调用建立 `RecallEvent` 概念：

```typescript
interface RecallEvent {
  recallId: string;
  catId: string;
  invocationId: string;
  toolName: 'search_evidence' | 'graph_resolve' | 'list_recent';
  query: string;
  mode?: string;
  scope?: string;
  candidates: Array<{
    anchor: string;
    rank: number;
    score?: number;
    targetRef:                  // 砚砚 R2：union ref 覆盖所有 drill-down 目标
      | { kind: 'doc'; sourcePath: string; anchor?: string }  // anchor fallback for sourcePath-empty candidates (Phase A P1-1)
      | { kind: 'thread'; threadId: string }
      | { kind: 'session'; sessionId: string }
      | { kind: 'invocation'; sessionId: string; invocationId: string }
      | { kind: 'passage'; passageId: string; threadId?: string; sessionId?: string };
    docKind?: string;           // feature/decision/lesson/discussion/...
    resultSetId?: string;
  }>;
  consumed: Array<{
    anchor: string;
    rank: number;
    method:                     // 砚砚 R2：覆盖全部 drill-down 工具
      | 'Read' | 'Grep' | 'graph_resolve'
      | 'read_session_events' | 'read_session_digest'
      | 'read_invocation_detail' | 'get_thread_context';
    dwellProxy?: number;        // 47：Read 后到下一个 tool call 的间隔(ms)
  }>;
  reformulated: boolean;
  fellBackToGrep: boolean;
  abandoned: boolean;
  nextGraphResolveAfterRead: boolean;  // 47：graph 深度导航信号
  tokenCost: number;
  timestamp: number;
}
```

**Consumption Window 定义**（OQ-1 resolved, 三猫收敛）：

```
consumed := same_invocation
            AND (tool_call_distance ≤ 20 OR wall_clock ≤ 300s)
            AND target_match(tool_call, candidate.targetRef)
```

- **target_match**（砚砚 R2 扩展）：不只是 `Read.file_path ↔ sourcePath`，还覆盖 `read_session_events ↔ sessionId`、`get_thread_context ↔ threadId`、`read_invocation_detail ↔ invocationId` 等 drill-down 匹配
- **invocation 边界**优于纯 wall-clock（LLM thinking/A2A callback 波动大）
- **tool_call_distance**比时间更稳定（20 步覆盖"搜→想→读"的典型链）
- **300s 兜底**防止超长 thinking 丢信号
- **Grep 分类**：grep 路径命中 candidate.targetRef.sourcePath → drill-down consumption；全仓 `rg` → fallback，不算 consumed
- v1 上 shadow mode，跑 1 周后看 P95 再 finalize 参数

### Phase B: Derived Metrics（无模型指标族）

核心指标（注：这里不是标准 IR relevance judgment，是 consumption 信号，命名区分）：

| 指标 | 公式 | 揭示什么 |
|------|------|----------|
| **Consumed@K** | `P(至少一个 top-K 候选被 consumed)` | 搜索召回质量 |
| **Readthrough@K** | `consumed_in_topK / K`（fraction） | 排序密度（top-K 里有几个值得读） |
| **ConsumedMRR** | `mean(1 / first_consumed_rank)` | 排序质量 |
| **FirstConsumedRank** | `median(first_consumed_rank)` | 排序中位数表现 |
| **Reformulation Rate** | `P(同 invocation 连续搜索)` | query/index 匹配度 |
| **ReformulationsBeforeConsumption** | `mean(search_count_before_first_consumed)` | 几轮才找到 |
| **SearchAbandonRate** | `P(搜了但没 consumed 也没 reformulate)` | 候选全不对 |
| **ReformulateAfterExposure** | `P(reformulate within compound_window AND no consumed AND tool_call_distance_to_next_search ≤ 3)` | 看了候选但觉得不对，立刻又搜（区别于 Abandon：Abandon 是静默放弃，这里是主动换 query） |
| **GrepFallbackRate** | `P(grep fallback \| candidates exposed)` | 摘要/标题不可信（Phase C 加 topConfidence 后可细化为 high-confidence 版） |
| **Token Cost per Hit** | `total_tokens / consumed_count` | 搜索效率 |
| **Anchor Popularity** | `consumed_count(anchor) over 30d` | boost 信号 |
| **Anchor Dormancy** | `days_since_last_consumed(anchor)` | sunset 候选信号 |
| **GraphNonFirstSelectionRate** | `P(consumed candidate rank > 1 \| graph_resolve)` | graph 排序质量 |
| **GraphTraversalCompletion** | `P(graph_resolve → Read → another graph_resolve)` | graph 深度导航价值 |

### Phase C: Consumption-Weighted Ranking（改排序）

**前提**：Phase C 只用 L1 信号（consumed/not consumed）。L2/L3 信号留给 Phase D。

**search_evidence 排序调整**：

```
adjusted_score(anchor, query) =
    rrf_score                               // 现有 BM25+vector RRF (k=60, 不动)
  + α · authority_boost(anchor)             // 现有 F163 权威性 (1.0-1.3)
  + β · consumption_prior(anchor)           // 新：Bayesian shrinkage CTR
  + γ · recency_decay(anchor)              // 新：fractional decay
  - δ · stale_penalty(anchor)              // 现有 F163 stale 检测
```

**consumption_prior 公式**（OQ-5 resolved, centered Bayesian shrinkage — R2 三猫收敛）：

```
shrunk_ctr     = (consumed_count_30d + α₀) / (exposure_count_30d + α₀ + β₀)
mean_ctr_kind  = global_mean_ctr(anchor.kind)       // 按 doc kind 分桶的全局基线
recency_factor = T_kind / (T_kind + days_since_last_consumed)
raw_lift       = (shrunk_ctr - mean_ctr_kind) × recency_factor

// 三段式分支（47 R2 提案 + 砚砚 R1 "exposure ≥ 20 才允许 punish" 融合）
if isConstitutional(anchor):                // 实现注意（砚砚 R3）：EvidenceKind 没有 ADR/canon 字面值，
                                            // 用 authority + sourcePath + docKind 组合判定，不能按 kind 字面 match
    consumption_prior = max(0, raw_lift)    // 永远不降权
elif exposure_count_30d < 5:                // cold-start
    consumption_prior = 0                   // 中性：不奖不罚
elif exposure_count_30d < 20:               // 低样本
    consumption_prior = max(0, raw_lift)    // 只允许正向 boost
else:                                       // 充分数据
    consumption_prior = raw_lift            // 完整中心化，允许负值
```

- **α₀=2, β₀=8**（先验 mean=0.2，等价于"10 次曝光 2 次 click"）
- **exposure_count 用 30 天滑窗**，不要历史累计
- **中心化是关键**（47+砚砚 R2 收敛）：v2 的纯正向 `shrunk_ctr × recency` 等于半残——"高 BM25 但 30 天 0 read"的过时 anchor 跟"高 BM25 且高 read"的活 anchor 一样排前面。减去 `mean_ctr_kind` 才有负信号
- **grace period**：新 indexed 文档 14 天内不参与 consumption_prior
- **v2 升级路径**（47 R2 #4）：v1 用 30d hard sliding window；若 shadow 发现窗口边界 anchor 排名有 day-by-day cliff，v2 升级到 event-level decay `w_i = 2^(-age_days/half_life)`

**recency_decay 公式**（OQ-2 resolved, fractional decay + 按 kind 分桶）：

```
decay(age_days, T) = T / (T + age_days)
```

| doc kind | T (half_life) | 理由 |
|----------|---------------|------|
| ADR / lesson / canon (constitutional) | **不降权** | 稳定真相源，consumption 低不代表不重要 |
| feature / decision | **90d** | 长效设计文档，半年后仍可能被新猫读 |
| plan / research / phase | **45d** | 阶段性高频，结束后冷却快 |
| discussion / reflection | **21d** | 热度集中在 1-2 周内 |
| thread / session digest | **14d** | 极短时效 |

47 的 fractional decay `T/(T+age)` 优于 exponential `2^(-age/T)`：365d 后 fractional 剩 ~20% vs exponential 剩 ~6%，长尾保护更好。

**MMR 去重**（OQ-3 resolved）：

```
MMR = argmax_i [λ · sim(d_i, query) - (1-λ) · max_j∈S sim(d_i, d_j)]
```

- **λ=0.7 起步**（Carbonell & Goldstein 1998 + TREC robust [0.5, 0.7] 区间，我们偏 precision）
- **只在 pool ≥ 3×limit 时启用**（否则没空间做多样化）
- shadow 对比 λ ∈ {0.6, 0.7, 0.8}，看 ConsumedMRR 和 Consumed@K 变化

**RRF k=60 和 pool size**：k 不动（Cormack 2009 经典值），pool 不动（max(limit×4, 20) cap 100）。先加指标 `consumed_anchor_not_in_pool_rate`，如果被 consumed 的 anchor 经常不在候选池才考虑扩 pool 或加第三路召回。

**graph edge-level 权重**（R2 砚砚+47 收敛，铲屎官点名"常用路径加权"）：

当前实现（`GraphResolver.ts:224`）遍历时所有 relation 边权重一样。F200 引入 edge-level 信号：

```
edge_weight(A → B) =
    type_base[edge.relation]                    // wikilink=1.0, doc_link=0.9, feature_ref=1.1
  + λ_edge · traversal_count_30d(A → B)        // 具体这条边被猫穿越的频率
  × edge_recency_decay(A → B)                  // 边的 access recency（fractional decay）
```

`type_base` 初始值先 shadow 观察再调。`traversal_count` = graph_resolve 返回 A，猫 Read A 后又 graph_resolve 拿到 B 并 Read B 的次数。

**graph_resolve 候选排序调整**：

```
graph_candidate_score(node) =
    text_match(query, node)
  + authority(node)
  + Σ edge_weight(source → node) · source_relevance  // 入边加权（替换 v2 的 node-level frequency）
  + consumption_recency(node)               // 新：最近有人读过
  - dormancy_penalty(node)                  // 新：90d 无人读（constitutional 免疫）
```

**实现顺序**：先 shadow mode 跑 consumption rerank 两周 → 确认 ConsumedMRR 提升 → 才切 on。

**Phase C shadow → on 切换门禁**（砚砚 + 46 收敛 2026-05-14）：

binary consumed prior 只允许在 shadow 阶段运行。切 `on` 前必须同时满足：
1. ConsumedMRR 提升（相对 shadow baseline）
2. **无 Goodhart 迹象**：短 dwellProxy（<2s）consumed 比例不升高、reformulate rate 不升高、fellBackToGrep rate 不升高
3. **单次 consumed 永远不能直接抬 rank** — 只能通过 Bayesian shrinkage + exposure sliding window 进入统计。这是防"误点一次越排越高"的核心原则

任一条件不满足 → 不切 on，先做 `signal_strength` 加权（v1.1 upgrade path：用 dwellProxy + nextGraphResolveAfterRead 给 consumed entry 分强弱权重）。

### Phase D: Full Trajectory Records（完整轨迹）

铲屎官启发的最深一层。把 Phase A-C 的单次搜索视角扩展到任务级，引入 L2/L3 信号：

```typescript
interface TaskTrajectory {
  taskContext: string;          // 从 thread/mention/task 推断
  searchChain: RecallEvent[];
  filesRead: string[];
  filesModified: string[];
  outputVerified: boolean;     // 候选信号源见下方（47 R2 #5）
  catId: string;
  totalTokenCost: number;
  duration: number;
}
```

**outputVerified 候选信号源**（47 R2 #5，Phase D Design Gate 前 finalize）：

```
outputVerified = signal_or(
    PR_merged_via_squash,                   // gh PR merge event
    CI_check_passed_after_modification,     // GitHub check_run success
    CVO_explicit_accept,                    // 铲屎官"merge"/"好"/"通过"等关键词
    reviewer_approval_with_no_followup,     // @codex/@opus 放行且无后续修改
)
```

用途：
- 成功轨迹复用（"上次做这类任务的猫搜了这些、读了这些"）
- 失败轨迹诊断（搜 5 轮 + 读 8 个文档但 review 退回 → 为什么）
- 跨猫对比找 index 盲点（同样任务，不同猫的 effort 差异——只用于系统诊断，不评价个猫）
- **Cross-Cat Effort Variance**：`std(reformulation_count) across cats for similar queries`，揭示 index/alias 对不同搜索习惯的覆盖差距
- **ConsumedButNotUsedRate**：读了但最终 commit/review/post 中没引用，可能是噪音或探索成本高

### Phase E: Cross-Cat Query Pattern Recommendation（deferred）

> Deferred until Phase A-D stable + ethical framework reviewed.

方向：会搜的猫的 query 模式 → 自动建议给不会搜的猫（"砚砚搜这类问题用了这个 query，Hit@1"）。这是 harness coaching，不是检索排序本体，数据依赖 Phase D 的 TaskTrajectory。

## Acceptance Criteria

### Phase A（Search Session Telemetry）✅
- [x] AC-A1: RecallEvent 被写入 ToolEventLog，包含 candidates（含 targetRef union + docKind）+ consumed 字段
- [x] AC-A2: consumed 通过 compound window（same_invocation + tool_call_distance≤20 + 300s cap）+ target_match 自动推断
- [x] AC-A3: reformulated / fellBackToGrep / abandoned / nextGraphResolveAfterRead 四个布尔正确标记
- [x] AC-A4: Health Dashboard 展示最近 24h 的 RecallEvent 统计摘要
- [x] AC-A5: dwellProxy（Read 后到下一个 tool call 的间隔 ms）被记录

### Phase B（Derived Metrics）
- [ ] AC-B1: Consumed@3 / ConsumedMRR / Reformulation Rate / SearchAbandonRate 四个核心指标可通过 API 查询
- [ ] AC-B2: Anchor Popularity 和 Anchor Dormancy 持久化到 evidence.sqlite 元数据
- [ ] AC-B3: Token Cost per Hit 可按猫/按工具/按时间段聚合
- [ ] AC-B4: GraphNonFirstSelectionRate 和 GraphTraversalCompletion 可通过 API 查询

### Phase C（Consumption-Weighted Ranking）
- [ ] AC-C1: search_evidence 排序引入 consumption_prior（Bayesian shrinkage + 14d grace period）和 recency_decay（fractional + kind 分桶）
- [ ] AC-C2: graph_resolve 候选排序引入入边加权（edge_weight × source_relevance）+ consumption_recency
- [ ] AC-C3: MMR 去重在 hybrid mode + pool≥3×limit 时生效（λ=0.7 可配置）
- [ ] AC-C4: shadow mode 先行：新排序 vs 旧排序的 ConsumedMRR 对比
- [ ] AC-C5: consumption_prior 不影响 authority（constitutional/ADR 免疫降权）
- [ ] AC-C6: `consumed_anchor_not_in_pool_rate` 指标上线，数据驱动 pool 扩展决策
- [ ] AC-C7: graph edge_weight（type_base + traversal_count_30d × edge_recency_decay）用于候选排序
- [ ] AC-C8: shadow 确认排序改进后，同步更新以下软约束文件的记忆系统段：`CLAUDE.md`、`AGENTS.md`、`cat-cafe-skills/refs/memory-routing-partial.md`（愿景守护检查项）

### Phase D（Full Trajectory Records）
- [ ] AC-D1: TaskTrajectory 按 invocation/thread 粒度聚合
- [ ] AC-D2: outputVerified 从候选信号源（PR merge / CI check / CVO accept / reviewer approval）自动推断
- [ ] AC-D3: 成功轨迹可被 list_recent 或 search_evidence 召回（scope="trajectories"）
- [ ] AC-D4: Cross-Cat Effort Variance 和 ConsumedButNotUsedRate 指标上线

## Eval / Tracking Contract

| 项 | 内容 |
|----|------|
| **Primary Users** | 三猫（search_evidence / graph_resolve / list_recent 使用者） |
| **Activation Signal** | RecallEvent 写入量 > 0 / consumed 命中 > 0 |
| **Friction Metric** | ConsumedMRR < shadow_baseline × 0.8（排序劣化）/ SearchAbandonRate > 50%（候选全不对）/ Reformulation Rate > 60%（一次搜不到）。初始 baseline 由 Phase B shadow 1 周后确定 |
| **Regression Fixture** | (1) high-consumption anchor must not be demoted unless authority/stale guard justifies it (2) authority=constitutional 的 anchor 不可因低 consumption 被压制 |
| **Sunset Signal** | 6 周后 ConsumedMRR 无提升 → 回滚 Phase C 排序改动 |

## Dependencies

- **Evolved from**: F153（observability infra 提供底层 trace 机制）
- **Related**: F192（harness eval 提供评估框架 + eval contract 模板）
- **Related**: F188（library stewardship — graph_resolve / list_recent / search_evidence 的 MCP 工具）
- **Related**: F163（authority boost / stale detection — 本 feature 不改 authority 来源，只叠加 consumption 信号）
- **Related**: F102（IEvidenceStore 接口 — 新指标可能需要 schema 扩展）

## Risk

| 风险 | 缓解 |
|------|------|
| consumption ≠ correctness（读了不等于对） | Phase C 只用 L1 信号（consumed/not），L2/L3 留 Phase D。consumption 只影响 navigation utility |
| 冷启动 anchor 不公平（新文档没机会被读） | 14 天 grace period + exposure_count_30d < 5 时用全局 mean_CTR + consumption_prior 允许正向 boost 但低 exposure 不允许惩罚 |
| Goodhart 风险（猫为了指标好看乱读） | consumption 只影响导航排序，不影响 authority；authority 仍来自 spec/ADR/review/CVO |
| 高 authority 但低 consumption 的关键文档被压制 | constitutional/ADR/lesson 类 anchor 免疫 consumption-based 降权 |
| 跨猫对比引入"评价猫"的伦理问题 | Phase D 跨猫数据只用于系统诊断（index 盲点），不用于评价个猫能力。Phase E deferred |
| 热门老文档马太效应（consumption 越高排越前） | Centered lift（减去 mean_ctr_kind）+ Bayesian shrinkage + 30d 滑窗 exposure + fractional decay 四重防线 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | consumption 窗口定义 | ✅ resolved: compound rule（same_invocation + tool_call_distance≤20 + 300s cap），shadow 1 周后 P95 校准 |
| OQ-2 | recency_decay half_life | ✅ resolved: fractional decay + 按 kind 分桶（constitutional 不降权 / feature 90d / plan 45d / discussion 21d / thread 14d） |
| OQ-3 | MMR λ 初始值 | ✅ resolved: λ=0.7（Carbonell 1998 + TREC），pool≥3×limit 才启用，shadow 对比 0.6/0.7/0.8 |
| OQ-4 | Phase D TaskTrajectory 粒度 | ⬜ 待 Phase D Design Gate |
| OQ-5 | consumption_prior 公式 | ✅ resolved: centered Bayesian shrinkage — `(shrunk_ctr - mean_ctr_kind) × recency`，三段式分支（cold-start/低样本/充分数据），constitutional 永远 max(0, lift) |
| OQ-6 | 是否需要第三路 consumption-based RRF 召回？ | ⬜ 先上 `consumed_anchor_not_in_pool_rate` 指标（AC-C6），数据驱动决策 |
| OQ-7 | query-conditioned consumption_prior（按 query_cluster × anchor 统计） | ⬜ v1 不做（3 猫数据量不够撑 pair-level shrinkage）。若 shadow 发现全局热门 anchor 污染无关 query（马太效应实锤），升级到 `consumption_prior(anchor, query_cluster)` + 样本不足 fallback 全局 prior。砚砚提出 2026-05-14 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 根信号来自猫真实行为（tool call），不用 LLM 自评 | MemOS R_human 根信号有毒（模型自评偏乐观）；猫的 Read 是 revealed preference，跨厂商一致 | 2026-05-14 |
| KD-2 | consumption 只影响 navigation utility，不影响 authority | 防 Goodhart：读得多 ≠ 真相更高。authority 仍来自 spec/ADR/review/CVO。constitutional 类 anchor 免疫降权 | 2026-05-14 |
| KD-3 | Phase C 新排序必须有 shadow mode（A/B 可观测） | 继承 F163 KD-9：所有能力 gated、observable、A/B-testable | 2026-05-14 |
| KD-4 | consumption_prior 用 Bayesian shrinkage（不是简单计数） | 简单计数偏热点 + 不防 cold-start。α₀/β₀ 参数 shadow 后可调（三猫收敛 2026-05-14） | 2026-05-14 |
| KD-5 | recency_decay 用 fractional `T/(T+age)` 而非 exponential | 我们是 design doc（长时效），exponential 365d 后剩 6% 太激进。fractional 长尾保护更好（47 提案 2026-05-14） | 2026-05-14 |
| KD-6 | recency_decay 按 doc kind 分桶，constitutional 不降权 | 不同类型文档热度曲线天差地别。constitutional 低 consumption 不代表不重要（砚砚 + 47 收敛 2026-05-14） | 2026-05-14 |
| KD-7 | RRF k=60 不动，pool 不动，第三路召回 data-driven | k=60 是 Cormack 2009 经典值。先测 `consumed_anchor_not_in_pool_rate`，数据说了算才扩（砚砚 2026-05-14） | 2026-05-14 |
| KD-8 | Phase C 只吃 L1 信号，L2/L3 留 Phase D | 分层递进，避免过早引入噪声更大的深层信号（三猫收敛 2026-05-14） | 2026-05-14 |
| KD-9 | consumption_prior 必须 centered（减全局 mean_ctr_kind） | 纯正向 boost = 半残，低于平均的 anchor 永远不被压。47+砚砚 R2 独立收敛同一结论（Wilson 1927 / Empirical Bayes 标准做法） | 2026-05-14 |
| KD-10 | graph 引入 edge-level 权重（不只是 node-level） | 铲屎官点名"常用路径加权"；当前 GraphResolver 所有边一视同仁。type_base + traversal_count × recency 三要素（47+砚砚 R2 收敛） | 2026-05-14 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-14 | 立项。铲屎官启发 + 三猫讨论（46/47/55）收敛方向 |
| 2026-05-14 | 三猫技术讨论：OQ-1/2/3/5 resolved，spec v2 更新 |
| 2026-05-14 | R2 review（47+砚砚）：consumption_prior centered lift + graph edge weights + targetRef union + ReformulateAfterExposure 精确化 → spec v3 |
| 2026-05-14 | Design Gate PASS（纯后端路径，三猫收敛 + CVO "走起"）→ status: in-progress |
| 2026-05-14 | Phase A merged（PR #1671）— RecallEvent telemetry pipeline: V19 migration, RecallEventCorrelator, target_match dispatch, derive-result-summary F200 extensions, shadow flag, 46 tests |

## Plan Gate Checklist（writing-plans 前必须解决）

> 来源：47 R3 六细节 + 砚砚 R3 三小修。spec 不阻塞，但 Plan 必须敲定。

- [x] **PG-1**: ✅ 新建 `recall_events` 表（V19 migration）— ToolEventLog windowing 不 reuse，独立 schema 更干净
- [x] **PG-2**: ✅ `recall-target-match.ts` — dispatch table: Read→doc(sourcePath)/passage(passageId), Grep→doc(sourcePath), graph_resolve→thread/session/invocation, read_session_*→session, get_thread_context→thread, anchor fallback
- [x] **PG-3**: ✅ V19 adds `traversal_count` + `last_traversed_at` to edges table（Phase A 开始记，Phase C 用）
- [x] **PG-4**: ✅ `F200_CONSUMPTION_RERANK=off|shadow|on` env flag, defaults to `off`

## Review Gate

- Phase A-B: 跨族 review（砚砚 preferred）
- Phase C: 跨族 review + shadow mode 数据确认后才切 on
- Phase D: 待 Design Gate
- Phase E: deferred

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | 当前 thread（2026-05-14 MemOS teardown → 记忆系统升级讨论） | 铲屎官启发 + 三猫讨论原始过程 |
| **Teardown** | `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/memos-memory/memos-teardown-rapid-2026-05-12.md` | MemOS 2.0 结构扫描级 teardown |
| **Live Notes** | `docs/discussions/2026-05-10-huawei-agent-closed-door-seminar/memos-memory/memos-memory-live-notes-2026-05-12.md` | Memos 分享现场笔记（砚砚） |
| **Feature** | `docs/features/F102-memory-adapter-refactor.md` | 存储基座（IEvidenceStore） |
| **Feature** | `docs/features/F153-observability-infra.md` | 底层 trace/metrics |
| **Feature** | `docs/features/F163-memory-entropy-reduction.md` | 治理层（authority/activation/status） |
| **Feature** | `docs/features/F188-library-stewardship.md` | 管护工具链（graph/recent/search MCP） |
| **Feature** | `docs/features/F192-socio-technical-harness-eval.md` | 评估框架（eval contract） |
| **Reference** | Cormack et al. 2009 — Reciprocal Rank Fusion | RRF k=60 经典来源 |
| **Reference** | Carbonell & Goldstein 1998 — MMR | λ=0.7 起点来源 |
