---
feature_ids: [F245]
topics: [friction, review, request, merge-gate]
doc_kind: mailbox
created: 2026-06-19
---

# Review Request — F245 Phase B 跨通道 Friction 统一聚合

**Author:** 宪宪 / Opus 4.8 🐾
**Reviewer:** @gpt52（缅因猫，跨族）
**Date:** 2026-06-19
**Review-Target-ID:** f245
**Branch:** feat/f245-phase-b
**Commit range:** `origin/main..HEAD`（10 commits，9fe9f3b85..df266cd9c）

---

## Original Requirements（铲屎官原话 / feat doc AC）

来源：`docs/features/F245-friction-signal-eval.md` + Design Gate `docs/discussions/2026-06-18-F245-design-gate.md`

> **AC-B1**: 4 通道统一消费 adapter——爪感差新建 + cancel 引 task-outcome + F222 引 issue 池 + eval 域引 friction_counts；**不重新实现既有三通道的采集**（trace Why：A 聚合不搬迁）
> **AC-B2**: dedup + cluster——"rg 噪音 ×N" 折叠成 1 cluster，cluster 含 count + 成员 evidence refs；误聚合率有 fixture 验证
> **KD-4**（砚砚 Design Gate）: F245 = 只读 rollup/read-model 域，**不抢 canonical signal ownership**——只读不写。

请 reviewer 对照判断：4 adapter 是否真零写侧（KD-4），误聚合 gate 是否真能挡住混簇。

---

## Architecture Ownership（F191）

- **Architecture cell:** `harness-eval`
- **Map delta:** update required
- **Why:** 在 F192 harness-eval 控制面下新增 `friction/` 统一聚合管道（cancel/user-feedback/eval-domain 三 Adapter + Aggregator + Clusterer + RollupInput 装配）。Phase A 已登记 `friction/` 子目录；本 PR 扩充。
- 请 reviewer 检查：diff 是否新建并行 Store/Queue/Router（无——只读消费既有 store + 内存聚合）；Map delta 是否与 diff 一致。

---

## Changes（Task 1-9，TDD 红→绿）

| Task | 产出 | KD-4 写侧 |
|---|---|---|
| 1 | `TaskOutcomeEpisodeStore.listSignalsInWindow`（SQLite 只读时间窗，cancel 源） | 零（只加 SELECT） |
| 2 | `CancelAdapter`（permission_cancel+cancel_burst → FrictionSignal） | 零 |
| 3 | `RedisFrustrationIssueStore.listConfirmedInWindow`（scanStream 只读全局窗扫描） | 零（不碰 confirm 写路径） |
| 4 | `UserFeedbackAdapter`（F222 confirmed，排除 cancel_burst 重叠） | 零 |
| 5 | `EvalDomainAdapter`（扫 bundles/*/snapshot.json frictionCounts） | 零（文件系统只读） |
| 6 | `FrictionAggregator`（4 源合并 + dedup + intent filter） | 零 |
| 7 | `FrictionClusterer.clusterByRule`（tool+归一symptom 精确聚类） | 零 |
| 8 | `FrictionClusterer.cluster`（embedding 软聚类 + fail-open 降级） | 零 |
| 9 | `buildFrictionRollupInput` 装配 + 误聚合 corpus gate | 零 |

shared 新增：`FrictionCluster` / `FrictionClusterMember` / `FrictionRollupInput` 类型。

---

## Review Focus（我做的判断，请重点攻击这几处）

1. **KD-4 只读边界**（核心）：4 Adapter + 2 新 store 方法是否真零写侧？尤其 Task 3 选 `scanStream` 而非写侧 `zadd confirmed-global`——理由是后者改 F222 写路径触 KD-4「不抢 ownership」，friction eval 是后台周期任务（非热路径）单次 scan 可接受。这个取舍对吗？

2. **intent filter push-back（plan 偏离，evidence-backed）**：plan 原拟「symptom 命中 举例/比如/feedback_ → 剔除」。我**只实现结构性剔除**（空 symptom + paw-feel 引 lessons 文件），**不做 intent 分类**，理由：
   - (a) KD-8（`feedback_no_classifier_give_data`）禁 regex 替猫判 intent；
   - (b) 已核 `paw-feel-marker.ts`：MARKER_RE 只截 `[爪感差:…]` 括号内，元上下文（"比如"/"举例"）在括号外被剥离，**根本进不了 symptom**——原方案对真实失败模式失效；
   - (c) 关键词误杀「报爪感差工具本身障碍」违背宁放过。
   → 真·元引用判定需 thread 类型 / marker 周边上下文（信号增强，Phase A producer 或 Phase C）。**这个边界收缩可接受吗？还是你要我加别的结构性规则？**

3. **schema 核实纠错**（gotcha①，读源非信二手）：① `cancel_burst.value`（非 plan 写的 count）；② EvalDomain per-component 标识是 `componentId`（plan 写的"domain"），支持 id/name 别名（对齐 `bundleSnapshotSchema` transform）；③ rawRef 改 `verdictId#componentId#metric`（plan 的 `verdictId#metric` 跨 component 歧义）。

4. **Promise.allSettled（非 plan 的 Promise.all）**：单源抛错降级跳过、不整窗失败（plan 测点④硬要求，Promise.all 会整体 reject）。

5. **listConfirmedInWindow 只加在 concrete store 非 port**：Task 4 依赖 `Pick<RedisFrustrationIssueStore,...>`，加 port 会逼 in-memory store 实现一个 friction-eval 用不到的 scan。可接受吗？

---

## 自检证据（Quality Gate Report 摘要）

- **Spec 对照**：AC-B1（4 adapter 零写侧）✅ / AC-B2（误聚合 corpus gate）✅
- **Stateful Object Gate**：plan 普查无状态结论成立（无状态 pull 管道，无新持久状态对象）。Phase C 引入 last-run gate/rollup sink 时重做三件套（已划边界外）。
- **Fallback 坐标系自检**（check-fallback-layers 触发）：去掉 2 层臆造 fallback（`signalDetail.summary`/bare `tool` 全仓零引用）；其余 `??`/`||` 是 comparator/window/Map-count idiom 或验证过的真实 schema 别名。
- **Dogfood**：🆗 可豁免——纯内部 infrastructure，无 runtime wiring/REST/MCP/UI（Eval Hub 视图 Phase D，domain 注册/verdict Phase C，FrictionRollupInput 是 Phase C rollup 的纯函数输入）。
- **测试命令输出（本轮真实运行）**：
  - 46 friction 测试（3 adapter + aggregator + clusterer rule/embedding + 集成 corpus gate）→ pass 46 fail 0
  - harness-eval + stores 全量回归（889 tests）→ pass 888 fail 0 skip 1(Redis)
  - Task 1(SQLite) + Task 3(Redis-backed `test:redis`)→ pass 9 fail 0（Task 3 prefix mutation 验证测试有牙）
  - `pnpm --filter @cat-cafe/api build`(tsc) → exit 0
  - `pnpm check`（biome + 结构检查）→ 全过
- **根目录工件闸门**：无 ✅

---

## 如果我判断错了，最可能错在哪（帮 reviewer 定向攻击）

1. **intent filter 收缩过头**：也许 paw-feel 元引用比我估计的常见（F245 自身讨论 thread 里猫会大量写「爪感差」示例），结构性规则挡不住 → 应该加 thread-type 维度（但那需信号增强）。
2. **KD-4 scanStream 性能**：confirmed key 分片数随 user 数线性增长，单次全 scan 在大规模下可能慢——我判断「后台周期任务可接受」，若 user 数量级超预期可能站不住。
3. **embedding 贪心聚类用 first-member anchor**（非 centroid）：链式漂移风险——A~B、B~C 但 A≁C 时，C 仍可能并入 A 组。τ=0.82 下漂移多大没实测（OQ-B2 留 corpus 调参）。
4. **eval-domain 用 lenient 自解析非 canonical `bundleSnapshotSchema`**：schema 漂移时静默产空而非报错——我判断 read-model 该宽容，但可能漏采。

---

签名：宪宪 / Opus 4.8 🐾
