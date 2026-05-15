# Review Request: F200 Phase B — Derived Metrics (RecallMetricsComputer + API)

Review-Target-ID: f200
Branch: feat/f200-phase-b-metrics

## What

Phase B 在 Phase A 的 `recall_events` 表基础上计算 12 个聚合指标：

1. **RecallMetricsComputer** (`domains/memory/RecallMetricsComputer.ts`) — 核心计算类
   - Core 4: consumedAt3, consumedMRR, reformulationRate, searchAbandonRate
   - Extended 6: readthroughAt3, firstConsumedRankMedian, reformulationsBeforeConsumption, reformulateAfterExposure, fallbackAfterHighHitRate, tokenCostPerHit
   - Graph 2: nonFirstSelectionRate, traversalCompletion
2. **V20 migration** (`schema.ts`) — `anchor_recall_metrics` 表 (popularity + dormancy)
3. **API routes** (`routes/recall-metrics.ts`) — GET /api/recall/metrics, GET /api/recall/anchors, POST /api/recall/anchors/refresh（60s 缓存, max 20 entries）
4. **Correlation hook 集成** (`recall-correlation-hook.ts`) — persistBatch 后自动 refreshAnchorMetrics

## Why

F200 Phase A 落盘了原始 recall events，但没有聚合视角。Phase B 让我们能回答"最近 7 天 memory recall 的命中率是多少？哪些 anchor 最热门/最沉寂？graph_resolve 的非首选率高不高？"

## Original Requirements（必填）

> "Phase B = 在 JS 侧算出 12 个 derived metrics ... 这一步不碰 Hub UI，只产出后端 API + 计算逻辑"
> "AC-B1: consumedAt3 / consumedMRR / reformulationRate / searchAbandonRate"
> "AC-B2: anchor 级热度 + 沉寂度"
> "AC-B3: catId + toolName 过滤 + tokenCostPerHit"
> "AC-B4: graph_resolve nonFirstSelectionRate + traversalCompletion"

- 来源：`docs/features/F200-memory-recall-eval.md` (lines 27-29, 292-296)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 所有聚合在 JS 侧完成（不用 SQL 聚合函数），因为 candidates_json/consumed_json 是 JSON 字符串需要 parse 后逐条比较 rank
- anchor_recall_metrics 表用 30d 滚动窗口，每次 correlation 触发时全量重算（数据量小，recall events 远少于 tool_usage_events）
- 没有引入 cron/定时任务，依赖 correlation hook 触发 + 手动 POST /refresh

## Architecture Ownership（必填）

Architecture cell: memory
Map delta: none
Why: 只扩展现有 memory 域（新增计算类 + V20 迁移 + API 路由），不改变 memory cell 边界

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **tokenCost 目前恒为 0**：Phase A 的 RecallEventCorrelator 写入 `token_cost: 0`（Phase C 才接真实值）。tokenCostPerHit 计算逻辑正确但当前产出 0。请确认这个 placeholder 行为可接受
2. **reformulateAfterExposure 近似**：用 `reformulated && consumed.length === 0 && !fell_back_to_grep` 作为"看到候选但重新查询"的近似。Phase C 可能需要更精确的 session-level 序列分析
3. **refreshAnchorMetrics 全量重算**：每次 correlation 触发都扫全部 30d 事件。当前 recall_events 量级 < 1000/月，可接受。请确认不需要增量更新

### 价值 OQ（给 CVO，如有）

无——纯后端指标计算，回滚成本低，猫猫自决。

## Next Action

请 review 代码正确性，特别关注：
- 12 个指标的计算公式是否与 spec AC 一致
- V20 migration 的 idempotency
- API 路由的 auth + caching 模式
- correlation hook 集成是否有副作用

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f200/codex`
- Start Command: `pnpm review:start`
- Ports: `web=5202`, `api=3202`（review 沙盒默认端口）

## 自检证据

### Spec 合规

Quality Gate PASSED (2026-05-15):
- AC-B1 ✅ consumedAt3 + consumedMRR + reformulationRate + searchAbandonRate — 4 tests cover
- AC-B2 ✅ anchor popularity/dormancy — refreshAnchorMetrics + getPopularAnchors tests
- AC-B3 ✅ catId/toolName filter + tokenCostPerHit — filter test + tokenCostPerHit test
- AC-B4 ✅ graph nonFirstSelectionRate + traversalCompletion — 2 tests cover
- 愿景覆盖：铲屎官要"后端 API + 计算逻辑，不碰 Hub UI" ✅

### 测试结果

```
pnpm --filter @cat-cafe/api test → 10/10 new tests pass, 0 failures (recall-metrics-computer.test.js)
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅ (biome format + lint)
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-05-14-f200-phase-b-derived-metrics.md`
- Feature: `docs/features/F200-memory-recall-eval.md`
- Phase A (merged): PR #1672

### 如果判断错了我最可能错在哪

1. computeExtended 中 reformulationsBeforeConsumption 的 invocation 分组逻辑——可能在多 search 场景下计数不准
2. refreshAnchorMetrics 的 dormancy 计算——`lastConsumed === null` 时 dormancy 为 null 而非 Infinity，可能不符合 reviewer 对"从未被消费"的预期
3. API 路由的 cache eviction 是 FIFO（Map insertion order），不是 LRU——可能在高并发下淘汰热 key
