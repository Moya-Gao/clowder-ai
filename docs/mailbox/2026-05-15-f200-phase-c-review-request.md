# Review Request: F200 Phase C — Consumption-Weighted Ranking

Review-Target-ID: f200-phase-c
Branch: feat/f200-phase-c-ranking

## What

Phase C adds consumption-weighted ranking to memory recall. Core changes:

1. **Bayesian shrinkage CTR** (`consumption-prior.ts`): `shrunk_ctr = (consumed + α₀) / (exposure + α₀ + β₀)` with centered lift against per-kind global mean, three-branch logic (constitutional/cold-start/low-sample/full), 14d grace period for new docs
2. **Fractional recency decay** (`recency-decay.ts`): `T/(T+age)` per doc kind (constitutional=immune, feature=90d, plan=45d, discussion=21d, thread=14d)
3. **MMR dedup** (`mmr.ts`): Maximal Marginal Relevance with keyword Jaccard similarity, λ=0.7, only when pool ≥ 3×limit
4. **Graph edge weight** (`graph-edge-weight.ts`): type_base + λ_edge × traversal_count_30d × edge_recency_decay
5. **Constitutional anchor pinning** (AC-C5): Pinned at original positions, only non-constitutional items sorted
6. **Shadow mode** (AC-C4): Module-level `_lastShadowRanking` exported via `getLastShadowRanking()`, captured in correlation hook, stored in `recall_events.shadow_ranking_json`, `shadowConsumedMRR` computed in RecallMetricsComputer
7. **consumedAnchorNotInPoolRate** (AC-C6): Tracks consumed anchors not in retrieval candidate pool
8. **refreshGlobalCtrBaseline** (AC-C7): Per-kind mean CTR from anchor_recall_metrics joined with evidence_docs
9. **Memory Hub flag panel** (AC-C9, CVO directive): MemoryFlagPanel.tsx shows F200_CONSUMPTION_RERANK state in health tab
10. **V21 migration**: global_ctr_baseline table + evidence_docs.first_indexed_at + recall_events.shadow_ranking_json

## Why

Phase A collected recall telemetry, Phase B computed derived metrics. Phase C closes the loop: use consumption signals to improve ranking quality. Shadow mode lets us compare before committing.

## Original Requirements（必填）

> Phase C: Consumption-Weighted Ranking（改排序）
> Phase C 只用 L1 信号（consumed/not consumed）。L2/L3 信号留给 Phase D。
> consumption_prior 公式：centered Bayesian shrinkage — R2 三猫收敛
> constitutional anchor 永远不降权（砚砚 R3 提案）

CVO directive (2026-05-15):
> "含 shadow→on 切换？又有开关？那你记得要对接到我们的 memory hub 的开关里不然我都不知道到时候哪里打开？"

- 来源: `docs/features/F200-memory-recall-eval.md` (Phase C section, lines 138-169)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Module-level shadow ranking state (`_lastShadowRanking`) vs passing through call chain: chose module-level to avoid cross-cutting MCP handler changes. Trade: global mutable state, but scoped to single request lifecycle and only read in correlation hook.
- Constitutional anchor pinning (separate/reinsert) vs score floor: chose pinning because score floor can still be overwhelmed by high-CTR items (F041-style failure mode confirmed in Task 6 testing).

## Architecture Ownership（必填）

Architecture cell: memory
Map delta: none
Why: All changes extend existing SqliteEvidenceStore + RecallMetricsComputer within the memory cell boundary. No new Store/Queue/Router/Adapter.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. `computeExtended` cognitive complexity is 30 (biome warns at 15). It aggregates 8 metrics in one pass over rows — splitting would mean multiple passes or shared state. Worth refactoring?
2. `triggerRecallCorrelation` complexity is 16 (limit 15) after adding shadow ranking capture. The +1 is from the `if (shadowRanking)` block. Acceptable?

### 价值 OQ（给 CVO，如有）
无 — all ranking parameters (α₀=2, β₀=8, λ=0.7, decay constants) are data-driven defaults that can be tuned via shadow mode comparison without CVO decision.

## Next Action

请 review 以下重点：
1. Constitutional anchor pinning correctness (AC-C5) — subtle ordering logic
2. Shadow ranking capture via module-level state — any race condition concerns?
3. Three-branch consumption prior logic (constitutional/cold-start/low-sample/full)
4. Bayesian shrinkage centered lift formula correctness
5. MemoryFlagPanel.tsx — consistent with other Memory Hub panels?

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f200-phase-c/codex`
- Start Command: `pnpm review:start`
- Ports: review sandbox auto-assigns (3201+)

## 自检证据

### Spec 合规
Quality gate passed — see report above in conversation.

### 测试结果
- F200 Phase C tests: **71/71 pass**, 0 fail (7 suites)
- All memory tests: **974/975 pass** (1 pre-existing always_on failure, unrelated)
- Biome check: **0 errors** (11 pre-existing warnings)
- `pnpm lint`: pre-existing TS7016 only (better-sqlite3/web-push missing @types)

### 相关文档
- Plan: `docs/plans/2026-05-15-f200-phase-c-consumption-rerank.md`
- Feature: `docs/features/F200-memory-recall-eval.md`
- Spec discussion: Phase C section lines 138-169 (OQ-5 resolved via R2 三猫收敛)

### 如果判断错了我最可能错在哪（pre-registered retraction conditions）
1. Constitutional anchor detection logic — relies on `isConstitutional()` using authority + sourcePath + docKind combo, might miss edge cases
2. Module-level shadow state could theoretically serve stale data if two concurrent requests overlap (unlikely in single-process Node but worth verifying)
3. MMR Jaccard similarity uses keyword splitting — might be too coarse for short queries
4. 14d grace period for new docs might be too generous or too short — data will tell in shadow mode
