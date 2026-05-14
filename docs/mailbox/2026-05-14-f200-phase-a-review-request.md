# Review Request: F200 Phase A — RecallEvent Telemetry

Review-Target-ID: f200
Branch: feat/f200-recall-telemetry

## What

Memory recall consumption telemetry pipeline: every search_evidence / graph_resolve / list_recent call now produces a RecallEvent recording which candidates were offered and which the cat actually consumed (Read/Grep/graph_resolve follow-up within a compound window).

12 commits, +1558 / -22 lines across 21 files (10 new src, 11 new test). All pure backend — no frontend, no MCP tool surface change.

Key components:
1. **V19 migration** — `recall_events` table + `traversal_count`/`last_traversed_at` on `edges`
2. **RecallEvent types** — `f200-types.ts`: targetRef union (doc|anchor|edge), consumed entries with method + dwellProxy
3. **target_match dispatch** — `recall-target-match.ts`: maps consumed.method (Read/Grep/graph_resolve/etc.) to matching logic against targetRef kinds
4. **RecallEventCorrelator** — compound window (same_invocation AND tool_call_distance ≤ 20 AND wall_clock ≤ 300s) + target_match → persists RecallEvents
5. **deriveResultSummary enrichment** — extracts `_f200Candidates` / `_f200Edges` from tool_result text
6. **Edge traversal recording** — increments `traversal_count` for Phase C edge weights
7. **recall-stats** — `getRecallStats24h()` wired into `/api/library/tool-usage-metrics`
8. **Pipeline wiring** — fire-and-forget `triggerRecallCorrelation` in both route-serial and route-parallel
9. **Shadow flag** — `F200_CONSUMPTION_RERANK` registered in env-registry (default: off)

## Why

Memory system (F102 + F163 + F188) can store and govern knowledge but has no feedback on whether cats actually _use_ search results. CVO identified this gap: consumption signals (search → read → follow) are pure behavioral data that don't need LLM self-eval. Phase A lays the telemetry foundation; Phase B will build metrics dashboards, Phase C will use it for shadow ranking experiments.

## Original Requirements（必填）

> "如果猫猫搜了 evidence 然后他决定用任何方式去读了 evidence 去推荐的文档！！是不是可以算真实命中！你想哦！！你们在 agentic search 的时候！！可是要决定要不要往下读！！"
>
> "这些可是不需要大模型就能做的！！"
>
> "比如猫猫目前的任务 xxxx，猫猫搜索了 xxxx 看了 xxx 文档 修改了 xxx 干了啥啥啥，最后产出 yyyy，我倒是觉得这个轨迹很值钱"

- 来源：`docs/features/F200-memory-recall-eval.md` §铲屎官启发（2026-05-14 原话摘录）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **为什么新表不扩展 ToolEventLog (Redis)?** — RecallEvents 需要 30d+ analytical queries；Redis zset TTL 是 fire-and-forget，不适合持久化分析。不同基数：ToolEvent 是 raw tool call，RecallEvent 是 correlated session (1:N)
- **为什么 fire-and-forget 而非 blocking?** — correlation 失败不应阻塞猫的响应流。route-serial/parallel 只添 .catch(() => {}) 的 promise，零影响主路径
- **为什么 compound window 而非 LLM 判断?** — CVO 原话"不需要大模型就能做"。tool_call_distance ≤ 20 + 300s cap + target_match 是纯 heuristic，可调参但不依赖模型

## Architecture Ownership（必填）

Architecture cell: memory
Map delta: none
Why: 所有改动在 memory domain 内部——新表 + 新 correlator + extended edges。route-serial/parallel 只添加 fire-and-forget hook 调用，不改变 dispatch cell 边界

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **compound window 参数选择**：`tool_call_distance ≤ 20` 和 `wall_clock ≤ 300s` 是初始 heuristic。Phase B 有了真实数据后可能需要调整。请关注这两个阈值是否合理
2. **route-parallel completedCatInvocationIds**：原 `catInvocationId` map 在 cat done 时 `.delete()` 条目，但 correlation 需要 invocation ID。增加了 `completedCatInvocationIds` 并行 map 保存已完成 ID。请确认无内存泄漏风险
3. **type cast in pipeline wiring**：`events as unknown as Parameters<typeof triggerRecallCorrelation>[1]` 是因为 ToolEvent discriminated union 的 summary 类型缺 index signature。是否有更优雅的解法？

### 价值 OQ（给 CVO，如有）

无——Phase A 纯后端 telemetry，所有技术 tradeoff 已在 Plan Gate 收敛，回滚成本低（删表 + revert），猫猫自决。

## Next Action

请 reviewer：
1. 代码正确性审查（特别是 compound window 边界、target_match dispatch 完整性）
2. 确认 route-serial/parallel 的 wiring 无副作用
3. 确认 V19 migration 的 schema 设计合理

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f200/codex`
- Start Command: `pnpm review:start`
- Ports: 纯后端改动，无需启动 web/api 服务。运行 `pnpm --filter @cat-cafe/api test` 即可验证全部 46 个测试

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| AC-A1: RecallEvent written to evidence.sqlite | ✅ | `recall_events` table via V19 migration, RecallEventCorrelator.persistBatch() |
| AC-A2: consumed via compound window + target_match | ✅ | RecallEventCorrelator.correlateWindow(), recall-target-match.ts |
| AC-A3: reformulated/fellBackToGrep/abandoned/nextGraphResolveAfterRead | ✅ | RecallEventCorrelator lines detecting consecutive search / grep fallback / abandoned / graph follow-up |
| AC-A4: Health Dashboard last-24h summary | ✅ | recall-stats.ts wired into /api/library/tool-usage-metrics |
| AC-A5: dwellProxy recorded | ✅ | Computed as next tool timestamp - consumed tool timestamp in correlateWindow |

### 测试结果

```
pnpm --filter @cat-cafe/api test     # 46 passed, 0 failed ✅
pnpm lint                            # 0 errors ✅
pnpm check                           # 0 errors ✅ (biome format + lint)
pnpm -r --if-present run build       # exit 0 ✅
```

### Artifact Hygiene

```
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  → 无 ✅
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  → 无 ✅
```

### 相关文档

- Plan: `docs/plans/2026-05-14-f200-phase-a-recall-telemetry.md`
- Feature: `docs/features/F200-memory-recall-eval.md`
- Related: F102 (memory base), F188 (tool-usage telemetry), F192 (eval contract)

---
Author: [宪宪/Opus-46🐾]
