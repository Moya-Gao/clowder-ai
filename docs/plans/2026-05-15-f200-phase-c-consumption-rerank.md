# F200 Phase C: Consumption-Weighted Ranking — Implementation Plan

**Feature:** F200 — `docs/features/F200-memory-recall-eval.md`
**Goal:** Adjust search_evidence + graph_resolve ranking using consumption signals (Bayesian shrinkage CTR + fractional recency decay + MMR dedup + graph edge weights), improving ConsumedMRR while protecting constitutional anchors.
**Acceptance Criteria:**
- AC-C1: search_evidence ranking adds consumption_prior (Bayesian shrinkage + 14d grace) + recency_decay (fractional + kind buckets)
- AC-C2: graph_resolve ranking adds edge_weight (type_base + traversal_count × edge_recency_decay) + consumption_recency
- AC-C3: MMR dedup in hybrid mode when pool ≥ 3×limit (λ=0.7 configurable)
- AC-C4: shadow mode — new vs old ranking ConsumedMRR comparison
- AC-C5: constitutional/ADR immune to consumption-based demotion
- AC-C6: consumed_anchor_not_in_pool_rate metric
- AC-C7: graph edge_weight for candidate ranking
- AC-C8: doc sync after shadow confirms improvement (deferred to on-switch)
- AC-C9: Memory Hub UI flag panel for F200_CONSUMPTION_RERANK (CVO directive 2026-05-15)
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** Extending existing SqliteEvidenceStore ranking pipeline + GraphResolver traversal scoring. No new cells — consumption_prior/recency_decay/MMR are ranking transforms inside the existing memory cell boundary.
**Tech Stack:** TypeScript, better-sqlite3, React (Memory Hub panel)
**Front-end verification:** Yes — AC-C9 Memory Hub flag panel must be browser-tested

---

## Terminal Schema

```typescript
// consumption-prior.ts
interface ConsumptionPriorInput {
  consumedCount30d: number;
  exposureCount30d: number;
  daysSinceLastConsumed: number | null;
  docKind: string;
  authority: F163Authority;
  firstIndexedAt: number;
}

interface ConsumptionPriorResult {
  shrunkCtr: number;
  meanCtrKind: number;
  recencyFactor: number;
  rawLift: number;
  prior: number;          // final clamped value
  branch: 'constitutional' | 'cold-start' | 'low-sample' | 'full';
}

// recency-decay.ts
type DecayResult = { factor: number; halfLife: number | null };

// mmr.ts
interface MMROptions { lambda: number; minPool: number; }

// graph edge_weight
interface EdgeWeight {
  typeBase: number;
  traversalBoost: number;
  recencyDecay: number;
  total: number;
}
```

## What We're NOT Building

- L2/L3 signals (Phase D)
- Query-conditioned consumption_prior (OQ-7 — deferred, data insufficient)
- Third RRF recall path (OQ-6 — data-driven, AC-C6 measures first)
- Event-level decay upgrade (v2 path — only if shadow shows day-cliff)
- Cross-cat query recommendations (Phase E — deferred)

---

### Task 1: V21 migration — global_ctr_baseline + first_indexed_at

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts` (bump CURRENT_SCHEMA_VERSION to 21)

**Step 1: Write failing test**

```typescript
// test: V21 migration creates global_ctr_baseline table + first_indexed_at column
it('V21 adds global_ctr_baseline table and evidence_docs.first_indexed_at', () => {
  applyMigrations(db);
  const baseline = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='global_ctr_baseline'").get();
  assert.ok(baseline);
  const cols = db.prepare("PRAGMA table_info(global_ctr_baseline)").all();
  const colNames = cols.map(c => c.name);
  assert.ok(colNames.includes('doc_kind'));
  assert.ok(colNames.includes('mean_ctr'));
  assert.ok(colNames.includes('sample_count'));
  assert.ok(colNames.includes('updated_at'));

  // first_indexed_at on evidence_docs
  const docCols = db.prepare("PRAGMA table_info(evidence_docs)").all();
  assert.ok(docCols.map(c => c.name).includes('first_indexed_at'));
});
```

**Step 2: Run test — expect FAIL**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f200-phase-c-ranking && node --test packages/api/test/memory/recall-metrics-computer.test.js`

**Step 3: Implement V21 migration**

In `schema.ts`, add migration 21:

```sql
CREATE TABLE IF NOT EXISTS global_ctr_baseline (
  doc_kind TEXT PRIMARY KEY,
  mean_ctr REAL NOT NULL DEFAULT 0.2,
  sample_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE evidence_docs ADD COLUMN first_indexed_at INTEGER NOT NULL DEFAULT 0;
```

`first_indexed_at` defaults to 0 (existing docs get no grace period — correct, they've been indexed for weeks).

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/schema.ts packages/api/test/memory/
git commit -m "feat(F200): V21 migration — global_ctr_baseline + first_indexed_at [宪宪/Opus-46🐾]"
```

---

### Task 2: Rank 0-indexed annotation + F200 type extensions

**Files:**
- Modify: `packages/api/src/domains/memory/f200-types.ts`

**Step 1: Add annotation + new types**

```typescript
// In RecallCandidate:
/** @0-indexed — BM25/vector rank from retrieval pipeline. MRR uses rank+1 as position. */
rank: number;
```

Add `ConsumptionPriorResult` and `EdgeWeight` interfaces for Phase C.

**Step 2: Run lint**

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f200-phase-c-ranking && pnpm lint`

**Step 3: Commit**

```bash
git add packages/api/src/domains/memory/f200-types.ts
git commit -m "feat(F200): rank @0-indexed annotation + Phase C type stubs [宪宪/Opus-46🐾]"
```

---

### Task 3: consumption-prior.ts — Bayesian shrinkage CTR

**Files:**
- Create: `packages/api/src/domains/memory/consumption-prior.ts`
- Create: `packages/api/test/memory/consumption-prior.test.js`

**Step 1: Write failing tests**

```typescript
// 5 test cases covering the three-branch logic:
it('cold-start: exposure < 5 returns prior=0');
it('low-sample: exposure 5-19 clamps to max(0, rawLift)');
it('full-data: exposure >= 20 allows negative prior');
it('constitutional anchor: always max(0, rawLift) regardless of exposure');
it('grace period: first_indexed < 14d ago returns prior=0');
```

Key test: full-data with below-average CTR → negative prior (centered lift works):
```typescript
it('full-data: below-average CTR produces negative prior', () => {
  const result = computeConsumptionPrior({
    consumedCount30d: 1,
    exposureCount30d: 30,   // shrunk_ctr ≈ (1+2)/(30+10) = 0.075
    daysSinceLastConsumed: 5,
    docKind: 'feature',     // mean_ctr_kind = 0.2 (default)
    authority: 'observed',
    firstIndexedAt: Date.now() - 30 * 86_400_000,
  }, { feature: 0.2 });
  assert.ok(result.prior < 0, 'below-average CTR should produce negative prior');
  assert.equal(result.branch, 'full');
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement**

```typescript
// consumption-prior.ts
const ALPHA_0 = 2;
const BETA_0 = 8;
const GRACE_PERIOD_MS = 14 * 86_400_000;

const KIND_HALF_LIVES: Record<string, number | null> = {
  'adr': null, 'lesson': null, 'canon': null,  // constitutional — no decay
  'feature': 90, 'decision': 90,
  'plan': 45, 'research': 45, 'phase': 45,
  'discussion': 21, 'reflection': 21,
  'thread': 14, 'session': 14,
};

export function computeConsumptionPrior(
  input: ConsumptionPriorInput,
  globalMeanCtr: Record<string, number>,
): ConsumptionPriorResult {
  // Grace period
  if (input.firstIndexedAt > 0 && Date.now() - input.firstIndexedAt < GRACE_PERIOD_MS) {
    return { shrunkCtr: 0, meanCtrKind: 0, recencyFactor: 0, rawLift: 0, prior: 0, branch: 'cold-start' };
  }

  const shrunkCtr = (input.consumedCount30d + ALPHA_0) / (input.exposureCount30d + ALPHA_0 + BETA_0);
  const meanCtrKind = globalMeanCtr[input.docKind] ?? 0.2;
  const halfLife = KIND_HALF_LIVES[input.docKind] ?? 45;
  const recencyFactor = input.daysSinceLastConsumed == null ? 0.5
    : halfLife == null ? 1.0
    : halfLife / (halfLife + input.daysSinceLastConsumed);
  const rawLift = (shrunkCtr - meanCtrKind) * recencyFactor;

  const isConstitutional = ['constitutional', 'validated'].includes(input.authority);
  if (isConstitutional) {
    return { shrunkCtr, meanCtrKind, recencyFactor, rawLift, prior: Math.max(0, rawLift), branch: 'constitutional' };
  }
  if (input.exposureCount30d < 5) {
    return { shrunkCtr, meanCtrKind, recencyFactor, rawLift, prior: 0, branch: 'cold-start' };
  }
  if (input.exposureCount30d < 20) {
    return { shrunkCtr, meanCtrKind, recencyFactor, rawLift, prior: Math.max(0, rawLift), branch: 'low-sample' };
  }
  return { shrunkCtr, meanCtrKind, recencyFactor, rawLift, prior: rawLift, branch: 'full' };
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/consumption-prior.ts packages/api/test/memory/consumption-prior.test.js
git commit -m "feat(F200): consumption-prior — Bayesian shrinkage CTR with three-branch logic [宪宪/Opus-46🐾]"
```

---

### Task 4: recency-decay.ts — fractional decay per doc kind

**Files:**
- Create: `packages/api/src/domains/memory/recency-decay.ts`
- Create: `packages/api/test/memory/recency-decay.test.js`

**Step 1: Write failing tests**

```typescript
it('constitutional doc: no decay regardless of age');
it('feature doc (T=90): 90d old → factor 0.5');
it('thread doc (T=14): 14d old → factor 0.5');
it('365d old feature doc: factor ≈ 0.198 (long tail preserved)');
it('unknown kind defaults to T=45');
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement**

```typescript
// recency-decay.ts
export function computeRecencyDecay(ageDays: number, docKind: string): DecayResult {
  const halfLife = KIND_HALF_LIVES[docKind] ?? 45;
  if (halfLife == null) return { factor: 1.0, halfLife: null };
  return { factor: halfLife / (halfLife + ageDays), halfLife };
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/recency-decay.ts packages/api/test/memory/recency-decay.test.js
git commit -m "feat(F200): recency-decay — fractional T/(T+age) per doc kind [宪宪/Opus-46🐾]"
```

---

### Task 5: mmr.ts — Maximal Marginal Relevance dedup

**Files:**
- Create: `packages/api/src/domains/memory/mmr.ts`
- Create: `packages/api/test/memory/mmr.test.js`

**Step 1: Write failing tests**

```typescript
it('pool < 3×limit: returns original order unchanged');
it('pool >= 3×limit: MMR reranks for diversity');
it('λ=1.0: pure relevance, no diversity');
it('λ=0.0: pure diversity, minimum similarity to selected set');
it('identical items: MMR penalizes duplicates');
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement**

MMR needs a similarity function. For evidence items, use anchor-level BM25 keyword overlap (cheap — no embedding call needed at rerank time):

```typescript
// mmr.ts
export function applyMMR(
  items: Array<{ item: EvidenceItem; score: number }>,
  limit: number,
  lambda: number = 0.7,
): EvidenceItem[] {
  if (items.length < 3 * limit) return items.slice(0, limit).map(i => i.item);

  const selected: Array<{ item: EvidenceItem; score: number }> = [];
  const remaining = [...items];

  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].score;
      const maxSim = selected.length === 0 ? 0
        : Math.max(...selected.map(s => keywordSimilarity(remaining[i].item, s.item)));
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) { bestScore = mmrScore; bestIdx = i; }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected.map(s => s.item);
}

function keywordSimilarity(a: EvidenceItem, b: EvidenceItem): number {
  // Jaccard similarity on keywords arrays
  const setA = new Set(a.keywords ?? []);
  const setB = new Set(b.keywords ?? []);
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter(k => setB.has(k)).length;
  return intersection / (setA.size + setB.size - intersection);
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/mmr.ts packages/api/test/memory/mmr.test.js
git commit -m "feat(F200): MMR dedup — Maximal Marginal Relevance with keyword similarity [宪宪/Opus-46🐾]"
```

---

### Task 6: Wire consumption_prior + recency_decay + MMR into SqliteEvidenceStore.search()

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (after L384 authority boost)
- Create: `packages/api/test/memory/f200-consumption-rerank.test.js`

**Step 1: Write failing integration test**

```typescript
it('shadow mode: computes new scores but preserves original order');
it('on mode: reranks results by consumption_prior + recency_decay');
it('constitutional anchor immune to demotion (AC-C5)');
it('grace period: 14d anchor not affected by consumption_prior');
it('MMR applied when pool >= 3*limit in hybrid mode (AC-C3)');
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement**

Add `applyConsumptionRerank(results)` after `applyAuthorityBoost(results)` at `SqliteEvidenceStore.ts:387`:

```typescript
// After line 387:
try {
  applyConsumptionRerank(results, this.db!);
} catch {
  // Kill-switch: rerank failure → continue with authority-boosted ranking
}
```

`applyConsumptionRerank` function (same pattern as `applyAuthorityBoost`):

```typescript
function applyConsumptionRerank(results: EvidenceItem[], db: Database.Database): void {
  const f200Flags = freezeF200Flags();
  if (f200Flags.consumptionRerank === 'off' || results.length < 2) return;

  // Load anchor metrics + global baselines from DB
  const anchorMetrics = loadAnchorMetrics(db, results.map(r => r.anchor));
  const globalMeanCtr = loadGlobalCtrBaseline(db);

  const K = 60;
  const BETA = 0.15; // consumption_prior weight (tunable)
  const GAMMA = 0.10; // recency_decay weight (tunable)

  const scored = results.map((item, i) => {
    const metrics = anchorMetrics.get(item.anchor);
    const prior = computeConsumptionPrior({
      consumedCount30d: metrics?.consumed_count_30d ?? 0,
      exposureCount30d: metrics?.exposure_count_30d ?? 0,
      daysSinceLastConsumed: metrics?.dormancy_days ?? null,
      docKind: item.kind ?? 'unknown',
      authority: (item.authority as F163Authority) ?? 'observed',
      firstIndexedAt: item.firstIndexedAt ?? 0,
    }, globalMeanCtr);

    const ageDays = item.updatedAt
      ? (Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000
      : 365;
    const decay = computeRecencyDecay(ageDays, item.kind ?? 'unknown');

    const positionalScore = 1 / (i + K);
    const newScore = positionalScore + BETA * prior.prior + GAMMA * (decay.factor - 0.5);

    return { item, oldRank: i, newScore, prior, decay };
  });

  scored.sort((a, b) => b.newScore - a.newScore);

  if (f200Flags.consumptionRerank === 'on') {
    for (let i = 0; i < results.length; i++) {
      results[i] = scored[i].item;
    }
  }
  // shadow: order unchanged, comparison logged via RecallEvent
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/SqliteEvidenceStore.ts packages/api/test/memory/f200-consumption-rerank.test.js
git commit -m "feat(F200): wire consumption_prior + recency_decay into search_evidence ranking [宪宪/Opus-46🐾]"
```

---

### Task 7: Graph edge_weight + consumption_recency in GraphResolver

**Files:**
- Modify: `packages/api/src/domains/memory/GraphResolver.ts` (traversal scoring at L224-283)
- Create: `packages/api/src/domains/memory/graph-edge-weight.ts`
- Create: `packages/api/test/memory/graph-edge-weight.test.js`

**Step 1: Write failing tests**

```typescript
// graph-edge-weight.test.js
it('wikilink base weight = 1.0');
it('feature_ref base weight = 1.1');
it('traversal_count boost scales with 30d count');
it('edge recency decay: recent traversal → higher weight');
it('zero traversals: weight = type_base only');
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement edge_weight computation**

```typescript
// graph-edge-weight.ts
const TYPE_BASE: Record<string, number> = {
  wikilink: 1.0,
  doc_link: 0.9,
  feature_ref: 1.1,
  related_to: 0.8,
};
const LAMBDA_EDGE = 0.05;

export function computeEdgeWeight(
  relation: string,
  traversalCount30d: number,
  daysSinceLastTraversal: number | null,
): EdgeWeight {
  const typeBase = TYPE_BASE[relation] ?? 1.0;
  const recencyDecay = daysSinceLastTraversal == null ? 0
    : 30 / (30 + daysSinceLastTraversal);
  const traversalBoost = LAMBDA_EDGE * traversalCount30d * recencyDecay;
  return { typeBase, traversalBoost, recencyDecay, total: typeBase + traversalBoost };
}
```

**Step 4: Wire into GraphResolver**

Phase A already added `traversal_count` + `last_traversed_at` to the edges table (PG-3). GraphResolver currently pushes edges to `edgesArr` at L263 — extend each edge object with computed weight. When F200_CONSUMPTION_RERANK is 'on' or 'shadow', sort frontier nodes by `Σ incoming_edge_weight × source_relevance` before adding to `nextFrontier`.

Also add `consumption_recency` to node scoring: query `anchor_recall_metrics` for dormancy/recency of target nodes.

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```bash
git add packages/api/src/domains/memory/graph-edge-weight.ts packages/api/src/domains/memory/GraphResolver.ts packages/api/test/memory/graph-edge-weight.test.js
git commit -m "feat(F200): graph edge_weight — type_base + traversal boost + recency decay [宪宪/Opus-46🐾]"
```

---

### Task 8: consumed_anchor_not_in_pool_rate metric (AC-C6)

**Files:**
- Modify: `packages/api/src/domains/memory/RecallMetricsComputer.ts`
- Modify: `packages/api/test/memory/recall-metrics-computer.test.js`

**Step 1: Write failing test**

```typescript
it('consumed_anchor_not_in_pool_rate: counts anchors consumed but not in candidates', () => {
  // Event where consumed anchor "X" was NOT in candidates list
  insertEvent(db, {
    recall_id: 'r-miss',
    candidates_json: JSON.stringify([{ anchor: 'A', rank: 0 }]),
    consumed_json: JSON.stringify([{ anchor: 'X', rank: -1, method: 'Read' }]),
  });
  // Event where consumed anchor WAS in candidates
  insertEvent(db, {
    recall_id: 'r-hit',
    candidates_json: JSON.stringify([{ anchor: 'B', rank: 0 }]),
    consumed_json: JSON.stringify([{ anchor: 'B', rank: 0, method: 'Read' }]),
  });
  const report = computer.computeMetrics({ days: 1 });
  assert.equal(report.extended.consumedAnchorNotInPoolRate, 0.5);
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

In `computeMetrics`, for each event with consumed entries, check if consumed anchor appears in candidates. Track `notInPool / totalConsumed`.

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/RecallMetricsComputer.ts packages/api/test/memory/recall-metrics-computer.test.js
git commit -m "feat(F200): consumed_anchor_not_in_pool_rate metric (AC-C6) [宪宪/Opus-46🐾]"
```

---

### Task 9: Shadow comparison logging (AC-C4)

**Files:**
- Modify: `packages/api/src/domains/memory/recall-correlation-hook.ts`
- Modify: `packages/api/src/domains/memory/RecallMetricsComputer.ts`

**Step 1: Write failing test**

```typescript
it('shadow mode: RecallEvent records both old_rank and new_rank for ConsumedMRR comparison');
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

When `consumptionRerank === 'shadow'`, the `RecallEventCorrelator` already captures candidates with their original ranks. Extend to also capture `shadowRank` — the rank each candidate would have under the new scoring. Store in a `shadow_ranking_json` column (V21 migration extends `recall_events`).

In `RecallMetricsComputer.computeMetrics`, add `shadowConsumedMRR` alongside existing `consumedMRR` — computed from `shadowRank` when available.

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/recall-correlation-hook.ts packages/api/src/domains/memory/RecallMetricsComputer.ts packages/api/test/memory/
git commit -m "feat(F200): shadow comparison logging — old vs new rank for ConsumedMRR A/B [宪宪/Opus-46🐾]"
```

---

### Task 10: refreshGlobalCtrBaseline + wire into search pipeline

**Files:**
- Modify: `packages/api/src/domains/memory/RecallMetricsComputer.ts`
- Modify: `packages/api/test/memory/recall-metrics-computer.test.js`

**Step 1: Write failing test**

```typescript
it('refreshGlobalCtrBaseline computes per-kind mean CTR from anchor_recall_metrics', () => {
  // Insert anchor metrics for different kinds
  // Verify global_ctr_baseline table updated with correct mean_ctr values
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

Add `refreshGlobalCtrBaseline()` to `RecallMetricsComputer`. Called after `refreshAnchorMetrics()`. Groups anchors by `doc_kind`, computes `mean(consumed_count / max(exposure_count, 1))` per kind, upserts into `global_ctr_baseline`.

Wire into `recall-correlation-hook.ts` to refresh after each invocation batch.

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/ packages/api/test/memory/
git commit -m "feat(F200): refreshGlobalCtrBaseline — per-kind mean CTR for centered lift [宪宪/Opus-46🐾]"
```

---

### Task 11: Memory Hub flag panel (AC-C9)

**Files:**
- Create: `packages/web/src/components/memory/MemoryFlagPanel.tsx`
- Modify: `packages/web/src/components/memory/MemoryHub.tsx` (add tab/section)
- Modify: `packages/api/src/routes/recall-metrics.ts` (add GET /api/recall/flags)

**Step 1: Write failing test**

```typescript
// packages/web/src/__tests__/memory-flag-panel.test.ts
it('MemoryFlagPanel renders F200_CONSUMPTION_RERANK status');
it('MemoryFlagPanel shows off/shadow/on toggle');
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement API endpoint**

```typescript
// In recall-metrics.ts — GET /api/recall/flags
router.get('/api/recall/flags', (_req, res) => {
  const f200 = freezeF200Flags();
  const f163 = freezeFlags();
  res.json({
    f200: { consumptionRerank: f200.consumptionRerank },
    f163: {
      authorityBoost: f163.authorityBoost,
      retrievalRerank: f163.retrievalRerank,
    },
  });
});
```

**Step 4: Implement frontend panel**

`MemoryFlagPanel.tsx`: fetches `/api/recall/flags`, displays each flag with current state badge (off=gray, shadow=amber, on=green). Links to env editor for toggling. CVO directive: must show F200_CONSUMPTION_RERANK prominently.

Wire into `MemoryHub.tsx` as a section in the Status or Health tab.

**Step 5: Run tests — expect PASS**

**Step 6: Commit**

```bash
git add packages/web/src/components/memory/ packages/api/src/routes/recall-metrics.ts packages/web/src/__tests__/
git commit -m "feat(F200): Memory Hub flag panel — F200_CONSUMPTION_RERANK visibility (AC-C9) [宪宪/Opus-46🐾]"
```

---

### Task 12: Integration test + V21 shadow_ranking_json column

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts` (add shadow_ranking_json to recall_events in V21)
- Create: `packages/api/test/memory/f200-phase-c-integration.test.js`

**Step 1: Write integration test**

```typescript
it('end-to-end: search_evidence with shadow mode produces RecallEvent with shadowRank');
it('end-to-end: constitutional anchor never demoted even with zero consumption');
it('end-to-end: MMR activates only when pool threshold met');
it('end-to-end: graph_resolve uses edge_weight for frontier ordering');
```

**Step 2: Run full test suite**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f200-phase-c-ranking
pnpm test
pnpm lint
pnpm check
pnpm -r --if-present run build
```

**Step 3: Commit**

```bash
git add packages/api/test/memory/ packages/api/src/domains/memory/schema.ts
git commit -m "feat(F200): Phase C integration tests + shadow_ranking_json column [宪宪/Opus-46🐾]"
```

---

## Open Questions (Phase C scope)

| # | Question | Status | Decision Path |
|---|----------|--------|---------------|
| OQ-C1 | β/γ weights for consumption_prior/recency_decay | Start β=0.15, γ=0.10 | Shadow data → tune |
| OQ-C2 | λ_edge for graph traversal boost | Start 0.05 | Shadow data → tune |
| OQ-C3 | MMR λ fine-tuning | Start 0.7 | Shadow: compare 0.6/0.7/0.8 |
| OQ-6 | Third RRF recall path needed? | AC-C6 data first | If consumed_anchor_not_in_pool > 15% → add |
| OQ-7 | Query-conditioned prior | Deferred | 3 cats insufficient data |

## Commit Summary

| # | Message | AC |
|---|---------|-----|
| 1 | V21 migration — global_ctr_baseline + first_indexed_at | infra |
| 2 | rank @0-indexed annotation + Phase C type stubs | infra |
| 3 | consumption-prior — Bayesian shrinkage CTR | AC-C1 |
| 4 | recency-decay — fractional T/(T+age) | AC-C1 |
| 5 | MMR dedup | AC-C3 |
| 6 | Wire into search_evidence ranking | AC-C1, AC-C4, AC-C5 |
| 7 | Graph edge_weight | AC-C2, AC-C7 |
| 8 | consumed_anchor_not_in_pool_rate | AC-C6 |
| 9 | Shadow comparison logging | AC-C4 |
| 10 | refreshGlobalCtrBaseline | AC-C1 |
| 11 | Memory Hub flag panel | AC-C9 |
| 12 | Integration tests | all |
