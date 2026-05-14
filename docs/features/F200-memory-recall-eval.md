---
feature_ids: [F200]
related_features: [F102, F153, F163, F188, F192]
topics: [memory, eval, observability, IR]
doc_kind: spec
created: 2026-05-14
---

# F200: Memory Recall Eval — 基于猫真实行为的记忆系统反馈闭环

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

### 问题

Cat Café 的记忆系统（F102 存储基座 + F163 治理层 + F188 管护工具链）已经能"记住"和"治理"知识，但**不知道猫用得好不好**。现有 eval（F192）只看负面信号（empty result rate / latency / false recall），没有正面命中信号。我们无法回答：

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

**我们的 tradeoff 选择**：不给记忆打分，给"找记忆和用记忆的过程"打分。根信号来自猫的真实 tool call 行为，不是 LLM 自评。

### 为什么这是独立 Feature 而不是 F192 的子 Phase

F192 是 harness 层面的社会技术评估框架（共创机制 + harness-feedback 文档 + eval contract）。F200 是记忆子系统的专项反馈闭环，需要：新的 event correlation 机制、新的指标族、对 search/graph 排序的实际改进。F192 提供评估框架，F200 在这个框架里建具体的 memory recall eval pipeline。

## What

### 核心概念：信息价值实现链

```
任务(task) → 搜索(search) → 阅读(read) → 使用(use) → 产出(output) → 验证(verify)
```

每一环都是无模型、可观测的行为信号。链越长，信号越强：

| 信号层 | 行为 | 强度 | 需要 LLM？ |
|--------|------|------|-----------|
| L0 | 搜了 | 最弱（只说明有需求） | 否 |
| L1 | 搜了 → 读了某条候选 | 中（revealed preference） | 否 |
| L2 | 搜了 → 读了 → 引用/修改了 | 强（信息被使用） | 否 |
| L3 | 搜了 → 读了 → 用了 → 产出被验证（review pass/test pass） | 最强（闭环） | 否 |

### Phase A: Search Session Telemetry（打地基）

在 F153 observability 基础上，为每次 memory tool 调用建立 `SearchSession` 概念：

```typescript
interface SearchSession {
  sessionId: string;
  catId: string;
  toolName: 'search_evidence' | 'graph_resolve' | 'list_recent';
  query: string;
  mode?: string;
  scope?: string;
  candidates: Array<{ anchor: string; rank: number; score?: number }>;
  consumed: Array<{ anchor: string; rank: number; method: 'Read' | 'Grep' | 'graph_resolve' }>;
  reformulated: boolean;        // 同 session 120s 内又搜了一次
  fellBackToGrep: boolean;      // 放弃 memory 工具去用 Grep/Bash
  abandoned: boolean;           // 搜了但没有任何 follow-up
  tokenCost: number;            // search + Read 的总 token
  timestamp: number;
}
```

**关键设计**：`consumed` 通过 event correlation 推断——后续 120s 窗口内同猫同 invocation 的 `Read` tool call，如果文件路径匹配某个 candidate anchor 的源文件，则标记为 consumed。

### Phase B: Derived Metrics（无模型指标族）

| 指标 | 公式 | 揭示什么 |
|------|------|----------|
| **Hit@K** | `P(至少一个 top-K 候选被 consumed)` | 搜索召回质量 |
| **MRR** | `mean(1 / first_consumed_rank)` | 排序质量 |
| **Reformulation Rate** | `P(同 session 连续搜索)` | query/index 匹配度 |
| **Abandon Rate** | `P(搜了但没 consumed 也没 reformulate)` | 候选全不对 |
| **Token Cost per Hit** | `total_tokens / consumed_count` | 搜索效率 |
| **Anchor Popularity** | `consumed_count(anchor) over 30d` | boost 信号 |
| **Anchor Dormancy** | `days_since_last_consumed(anchor)` | sunset 候选信号 |
| **Graph Traversal Depth** | `mean(edges_followed_after_resolve)` | graph 导航价值 |
| **Cross-Cat Effort Variance** | `std(reformulation_count) across cats for similar queries` | 搜索能力差异 |

### Phase C: Consumption-Weighted Ranking（改排序）

用 Phase B 指标改善 search_evidence 和 graph_resolve 的结果排序：

**search_evidence 排序调整**：

```
adjusted_score(anchor, query) =
    rrf_score                               // 现有 BM25+vector RRF (k=60)
  + α · authority_boost(anchor)             // 现有 F163 权威性 (1.0-1.3)
  + β · consumption_prior(anchor)           // 新：历史 consumed 频率
  + γ · recency_decay(anchor, half_life)    // 新：时间衰减
  - δ · stale_penalty(anchor)              // 现有 F163 stale 检测
```

**graph_resolve 候选排序调整**：

```
graph_candidate_score(node) =
    text_match(query, node)
  + authority(node)
  + edge_traversal_frequency(node)          // 新：猫顺着边走的频率
  + consumption_recency(node)               // 新：最近有人读过
  - dormancy_penalty(node)                  // 新：90d 无人读
```

**MMR 去重**（学 MemOS）：search 结果 top-K 内如果多条指向语义高度相似的内容，用 MMR 保证多样性。

### Phase D: Full Trajectory Records（完整轨迹）

铲屎官启发的最深一层。把 Phase A-C 的单次搜索视角扩展到任务级：

```typescript
interface TaskTrajectory {
  taskContext: string;          // 从 thread/mention/task 推断
  searchChain: SearchSession[];
  filesRead: string[];
  filesModified: string[];
  outputVerified: boolean;     // review pass / test pass / CVO accept
  catId: string;
  totalTokenCost: number;
  duration: number;
}
```

用途：
- 成功轨迹复用（"上次做这类任务的猫搜了这些、读了这些"）
- 失败轨迹诊断（搜 5 轮 + 读 8 个文档但 review 退回 → 为什么）
- 跨猫对比找 index 盲点（同样任务，不同猫的 effort 差异）

## Acceptance Criteria

### Phase A（Search Session Telemetry）
- [ ] AC-A1: SearchSession event 被写入 ToolEventLog，包含 candidates + consumed 字段
- [ ] AC-A2: consumed 通过 120s 窗口内 Read/Grep tool call 的路径匹配自动推断
- [ ] AC-A3: reformulated / fellBackToGrep / abandoned 三个布尔正确标记
- [ ] AC-A4: Health Dashboard 展示最近 24h 的 SearchSession 统计摘要

### Phase B（Derived Metrics）
- [ ] AC-B1: Hit@3 / MRR / Reformulation Rate / Abandon Rate 四个核心指标可通过 API 查询
- [ ] AC-B2: Anchor Popularity 和 Anchor Dormancy 持久化到 evidence.sqlite 元数据
- [ ] AC-B3: Token Cost per Hit 可按猫/按工具/按时间段聚合

### Phase C（Consumption-Weighted Ranking）
- [ ] AC-C1: search_evidence 排序引入 consumption_prior 和 recency_decay 因子
- [ ] AC-C2: graph_resolve 候选排序引入 edge_traversal_frequency
- [ ] AC-C3: MMR 去重在 hybrid mode 生效（λ 参数可配置）
- [ ] AC-C4: A/B 可观测：新排序 vs 旧排序的 MRR 对比（shadow mode 先行）
- [ ] AC-C5: consumption_prior 不影响 authority（读得多 ≠ 真相更高）

### Phase D（Full Trajectory Records）
- [ ] AC-D1: TaskTrajectory 按 invocation/thread 粒度聚合
- [ ] AC-D2: outputVerified 从 review/test/CVO accept 信号自动推断
- [ ] AC-D3: 成功轨迹可被 list_recent 或 search_evidence 召回（scope="trajectories"）

## Eval / Tracking Contract

| 项 | 内容 |
|----|------|
| **Primary Users** | 三猫（search_evidence / graph_resolve / list_recent 使用者） |
| **Activation Signal** | SearchSession event 写入量 > 0 / consumed 命中 > 0 |
| **Friction Metric** | MRR < 0.3（排序太差）/ Abandon Rate > 50%（候选全不对）/ Reformulation Rate > 60%（一次搜不到） |
| **Regression Fixture** | (1) 已知 high-CTR anchor 被新排序降权 (2) authority=constitutional 的 anchor 因低 consumption 被压制 |
| **Sunset Signal** | 6 周后 MRR 无提升 → 回滚 Phase C 排序改动 |

## Dependencies

- **Evolved from**: F153（observability infra 提供底层 trace 机制）
- **Related**: F192（harness eval 提供评估框架 + eval contract 模板）
- **Related**: F188（library stewardship — graph_resolve / list_recent / search_evidence 的 MCP 工具）
- **Related**: F163（authority boost / stale detection — 本 feature 不改 authority 来源，只叠加 consumption 信号）
- **Related**: F102（IEvidenceStore 接口 — 新指标可能需要 schema 扩展）

## Risk

| 风险 | 缓解 |
|------|------|
| consumption ≠ correctness（读了不等于对） | L1(read) < L2(use) < L3(verify) 分层信号强度，Phase C 只用 L1，Phase D 才引入 L2/L3 |
| 冷启动 anchor 不公平（新文档没机会被读） | consumption_prior 和 exposure_count 分开统计；新 anchor 有 grace period |
| Goodhart 风险（猫为了指标好看乱读） | consumption 只影响导航排序，不影响 authority；authority 仍来自 spec/ADR/review/CVO |
| 高 authority 但低 consumption 的关键文档被压制 | criticality=high 的 anchor 免疫 consumption-based 降权（继承 F163 salience gating 的 P0 immunity） |
| 跨猫对比引入"评价猫"的伦理问题 | Phase D 跨猫数据只用于系统诊断（index 盲点），不用于评价个猫能力 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | consumption 窗口 120s 是否合适？猫可能搜完后隔很久才 Read | ⬜ 需要从现有 trace 统计 search→Read 的 P95 间隔 |
| OQ-2 | recency_decay 的 half_life 多少天合适？MemOS 用 30d | ⬜ 需要技术讨论（47 + 砚砚） |
| OQ-3 | MMR 的 λ 参数（relevance vs diversity 平衡）如何初始化？ | ⬜ 需要查 IR 论文 + 实验 |
| OQ-4 | Phase D 的 TaskTrajectory 粒度（invocation vs thread vs task）如何界定？ | ⬜ 需要技术讨论 |
| OQ-5 | consumption_prior 的具体公式：简单计数 vs frequency×recency vs Bayesian？ | ⬜ 需要技术讨论 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 根信号来自猫真实行为（tool call），不用 LLM 自评 | MemOS R_human 根信号有毒（模型自评偏乐观）；猫的 Read 是 revealed preference，跨厂商一致 | 2026-05-14 |
| KD-2 | consumption 只影响导航排序，不影响 authority | 防 Goodhart：读得多 ≠ 真相更高。authority 仍来自 spec/ADR/review/CVO | 2026-05-14 |
| KD-3 | Phase C 新排序必须有 shadow mode（A/B 可观测） | 继承 F163 KD-9：所有能力 gated、observable、A/B-testable | 2026-05-14 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-14 | 立项。铲屎官启发 + 三猫讨论（46/47/55）收敛方向 |

## Review Gate

- Phase A-B: 跨族 review（砚砚 preferred）
- Phase C: 跨族 review + shadow mode 数据确认后才切 on
- Phase D: 待 Design Gate

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
