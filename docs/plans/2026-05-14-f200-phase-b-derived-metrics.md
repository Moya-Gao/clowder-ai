# F200 Phase B: Derived Metrics — Implementation Plan

**Feature:** F200 — `docs/features/F200-memory-recall-eval.md`
**Goal:** Compute all 12 spec metrics from Phase A's `recall_events` data; expose via API; persist anchor popularity/dormancy to sqlite.
**Acceptance Criteria:**
- AC-B1: Consumed@3 / ConsumedMRR / Reformulation Rate / SearchAbandonRate queryable via API
- AC-B2: Anchor Popularity and Anchor Dormancy persisted to evidence.sqlite
- AC-B3: Token Cost per Hit aggregatable by cat/tool/time period
- AC-B4: GraphNonFirstSelectionRate and GraphTraversalCompletion queryable via API
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** Extends existing memory domain with metrics computation; no new Store/Queue/Router
**Architecture:** Pure computation layer over Phase A's `recall_events` table. `RecallMetricsComputer` reads rows, computes metrics in JS (not complex SQL JSON — volume is ~100-200 events/day). V20 migration adds `anchor_recall_metrics` table for AC-B2 persistence. New Fastify route `/api/recall/metrics` follows `tool-usage.ts` pattern.
**Tech Stack:** better-sqlite3, Fastify, node:test
**前端验证:** No — pure API, no UI changes

---

## What we're NOT building

- No ranking changes (Phase C)
- No dashboard UI (API only — dashboard can consume the API later)
- No task trajectories (Phase D)
- No real-time streaming (batch computation, cached 60s)
- No query-cluster conditioning (OQ-7, deferred)

## Terminal Types

```typescript
export interface RecallMetricsReport {
  period: { fromMs: number; toMs: number; days: number };
  filters: { catId?: string; toolName?: string };
  totalEvents: number;
  core: {
    consumedAt3: number;       // P(at least one top-3 candidate consumed)
    consumedMRR: number;       // mean(1 / first_consumed_rank)
    reformulationRate: number; // P(reformulated)
    searchAbandonRate: number; // P(abandoned)
  };
  extended: {
    readthroughAt3: number;              // consumed_in_top3 / 3
    firstConsumedRankMedian: number;     // median(first_consumed_rank)
    reformulationsBeforeConsumption: number; // mean(search_count_before_first_consumed)
    reformulateAfterExposure: number;    // P(reformulate + no consumed + distance≤3)
    grepFallbackRate: number;            // P(grep_fallback | candidates exposed)
    tokenCostPerHit: number;             // total_tokens / consumed_count
  };
  graph: {
    nonFirstSelectionRate: number;       // P(consumed rank > 1 | graph_resolve)
    traversalCompletion: number;         // P(graph→Read→graph)
  };
}

export interface AnchorMetric {
  anchor: string;
  consumedCount30d: number;
  exposureCount30d: number;
  lastConsumedAt: string | null;
  dormancyDays: number | null;
}
```

---

## Task 1: V20 Migration — anchor_recall_metrics table

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts:564` (after V19 block)
- Test: `packages/api/test/memory/recall-metrics-computer.test.js` (created in Task 2)

**Step 1: Add V20 migration**

```typescript
// After the V19 block (line 564):
if (currentVersion < 20) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS anchor_recall_metrics (
        anchor TEXT PRIMARY KEY,
        consumed_count_30d INTEGER NOT NULL DEFAULT 0,
        exposure_count_30d INTEGER NOT NULL DEFAULT 0,
        last_consumed_at TEXT,
        dormancy_days INTEGER,
        updated_at TEXT NOT NULL
      )
    `);
  } catch {}
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_anchor_metrics_dormancy ON anchor_recall_metrics(dormancy_days)');
  } catch {}
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(20, new Date().toISOString());
}
```

**Step 2: Verify migration applies**

Run: `pnpm --filter @cat-cafe/api run build`
Expected: exit 0

**Step 3: Commit**

```bash
git add packages/api/src/domains/memory/schema.ts
git commit -m "feat(F200): V20 migration — anchor_recall_metrics table"
```

---

## Task 2: RecallMetricsComputer — core metrics

**Files:**
- Create: `packages/api/src/domains/memory/RecallMetricsComputer.ts`
- Create: `packages/api/test/memory/recall-metrics-computer.test.js`

**Step 1: Write failing tests for core metrics (AC-B1)**

```javascript
// packages/api/test/memory/recall-metrics-computer.test.js
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

function insertEvent(db, overrides) {
  const defaults = {
    recall_id: `r-${Math.random()}`,
    cat_id: 'opus',
    invocation_id: 'inv-1',
    tool_name: 'search_evidence',
    query: 'test',
    mode: 'hybrid',
    scope: 'docs',
    candidates_json: '[]',
    consumed_json: '[]',
    reformulated: 0,
    fell_back_to_grep: 0,
    abandoned: 0,
    next_graph_resolve_after_read: 0,
    token_cost: 0,
    timestamp: Date.now(),
  };
  const e = { ...defaults, ...overrides };
  db.prepare(`INSERT INTO recall_events
    (recall_id, cat_id, invocation_id, tool_name, query, mode, scope,
     candidates_json, consumed_json, reformulated, fell_back_to_grep,
     abandoned, next_graph_resolve_after_read, token_cost, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(e.recall_id, e.cat_id, e.invocation_id, e.tool_name, e.query,
         e.mode, e.scope, e.candidates_json, e.consumed_json,
         e.reformulated, e.fell_back_to_grep, e.abandoned,
         e.next_graph_resolve_after_read, e.token_cost, e.timestamp);
}

describe('RecallMetricsComputer', () => {
  let RecallMetricsComputer;
  let Database;
  let db;

  beforeEach(async () => {
    Database = (await import('better-sqlite3')).default;
    const schema = await import('../../dist/domains/memory/schema.js');
    const mod = await import(`../../dist/domains/memory/RecallMetricsComputer.js?v=${Date.now()}`);
    RecallMetricsComputer = mod.RecallMetricsComputer;

    db = new Database(':memory:');
    db.exec('PRAGMA journal_mode = WAL');
    db.exec(schema.SCHEMA_V1);
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)')
      .run(1, new Date().toISOString());
    schema.applyMigrations(db);
  });

  it('AC-B1: consumedAt3 = fraction of events where top-3 candidate consumed', () => {
    // Event 1: candidate rank 1 consumed
    insertEvent(db, {
      recall_id: 'r1',
      candidates_json: JSON.stringify([{ anchor: 'A', rank: 1 }]),
      consumed_json: JSON.stringify([{ anchor: 'A', rank: 1, method: 'Read' }]),
    });
    // Event 2: no consumption
    insertEvent(db, {
      recall_id: 'r2',
      candidates_json: JSON.stringify([{ anchor: 'B', rank: 1 }]),
      consumed_json: '[]',
      abandoned: 1,
    });

    const computer = new RecallMetricsComputer(db);
    const report = computer.computeMetrics({ days: 1 });
    assert.equal(report.core.consumedAt3, 0.5); // 1 of 2 events
  });

  it('AC-B1: consumedMRR = mean of 1/first_consumed_rank', () => {
    // Event 1: first consumed at rank 1 → RR = 1.0
    insertEvent(db, {
      recall_id: 'r1',
      candidates_json: JSON.stringify([{ anchor: 'A', rank: 1 }]),
      consumed_json: JSON.stringify([{ anchor: 'A', rank: 1, method: 'Read' }]),
    });
    // Event 2: first consumed at rank 3 → RR = 1/3
    insertEvent(db, {
      recall_id: 'r2',
      candidates_json: JSON.stringify([
        { anchor: 'X', rank: 1 }, { anchor: 'Y', rank: 2 }, { anchor: 'Z', rank: 3 },
      ]),
      consumed_json: JSON.stringify([{ anchor: 'Z', rank: 3, method: 'Read' }]),
    });

    const computer = new RecallMetricsComputer(db);
    const report = computer.computeMetrics({ days: 1 });
    // MRR = (1.0 + 1/3) / 2 = 2/3 ≈ 0.667
    assert.ok(Math.abs(report.core.consumedMRR - 2 / 3) < 0.001);
  });

  it('AC-B1: reformulationRate and searchAbandonRate', () => {
    insertEvent(db, { recall_id: 'r1', reformulated: 1 });
    insertEvent(db, { recall_id: 'r2', abandoned: 1 });
    insertEvent(db, { recall_id: 'r3' }); // neither

    const computer = new RecallMetricsComputer(db);
    const report = computer.computeMetrics({ days: 1 });
    assert.ok(Math.abs(report.core.reformulationRate - 1 / 3) < 0.001);
    assert.ok(Math.abs(report.core.searchAbandonRate - 1 / 3) < 0.001);
  });

  it('AC-B3: tokenCostPerHit aggregated by catId', () => {
    insertEvent(db, { recall_id: 'r1', cat_id: 'opus', token_cost: 500,
      consumed_json: JSON.stringify([{ anchor: 'A', rank: 1, method: 'Read' }]) });
    insertEvent(db, { recall_id: 'r2', cat_id: 'opus', token_cost: 300,
      consumed_json: JSON.stringify([{ anchor: 'B', rank: 1, method: 'Read' }]) });
    insertEvent(db, { recall_id: 'r3', cat_id: 'codex', token_cost: 200,
      consumed_json: '[]', abandoned: 1 });

    const computer = new RecallMetricsComputer(db);
    const opusReport = computer.computeMetrics({ days: 1, catId: 'opus' });
    // opus: 800 tokens / 2 consumed = 400
    assert.equal(opusReport.extended.tokenCostPerHit, 400);
  });

  it('AC-B4: graphNonFirstSelectionRate', () => {
    // graph_resolve where consumed rank > 1
    insertEvent(db, {
      recall_id: 'r1', tool_name: 'graph_resolve',
      candidates_json: JSON.stringify([{ anchor: 'A', rank: 1 }, { anchor: 'B', rank: 2 }]),
      consumed_json: JSON.stringify([{ anchor: 'B', rank: 2, method: 'Read' }]),
    });
    // graph_resolve where consumed rank = 1
    insertEvent(db, {
      recall_id: 'r2', tool_name: 'graph_resolve',
      candidates_json: JSON.stringify([{ anchor: 'C', rank: 1 }]),
      consumed_json: JSON.stringify([{ anchor: 'C', rank: 1, method: 'Read' }]),
    });

    const computer = new RecallMetricsComputer(db);
    const report = computer.computeMetrics({ days: 1 });
    assert.equal(report.graph.nonFirstSelectionRate, 0.5);
  });

  it('AC-B4: graphTraversalCompletion', () => {
    insertEvent(db, {
      recall_id: 'r1', tool_name: 'graph_resolve',
      next_graph_resolve_after_read: 1,
      consumed_json: JSON.stringify([{ anchor: 'A', rank: 1, method: 'Read' }]),
    });
    insertEvent(db, {
      recall_id: 'r2', tool_name: 'graph_resolve',
      next_graph_resolve_after_read: 0,
      consumed_json: JSON.stringify([{ anchor: 'B', rank: 1, method: 'Read' }]),
    });

    const computer = new RecallMetricsComputer(db);
    const report = computer.computeMetrics({ days: 1 });
    assert.equal(report.graph.traversalCompletion, 0.5);
  });

  it('filters by time window', () => {
    const now = Date.now();
    insertEvent(db, { recall_id: 'r1', timestamp: now, abandoned: 1 });
    insertEvent(db, { recall_id: 'r2', timestamp: now - 8 * 86_400_000, abandoned: 1 }); // 8 days ago

    const computer = new RecallMetricsComputer(db);
    const report7d = computer.computeMetrics({ days: 7 });
    assert.equal(report7d.totalEvents, 1);
    const report30d = computer.computeMetrics({ days: 30 });
    assert.equal(report30d.totalEvents, 2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/memory/recall-metrics-computer.test.js`
Expected: FAIL (module not found)

**Step 3: Implement RecallMetricsComputer**

```typescript
// packages/api/src/domains/memory/RecallMetricsComputer.ts
import type Database from 'better-sqlite3';
import type { ConsumedEntry, RecallCandidate } from './f200-types.js';

export interface RecallMetricsReport {
  period: { fromMs: number; toMs: number; days: number };
  filters: { catId?: string; toolName?: string };
  totalEvents: number;
  core: {
    consumedAt3: number;
    consumedMRR: number;
    reformulationRate: number;
    searchAbandonRate: number;
  };
  extended: {
    readthroughAt3: number;
    firstConsumedRankMedian: number;
    reformulationsBeforeConsumption: number;
    reformulateAfterExposure: number;
    grepFallbackRate: number;
    tokenCostPerHit: number;
  };
  graph: {
    nonFirstSelectionRate: number;
    traversalCompletion: number;
  };
}

interface RawRow {
  recall_id: string;
  cat_id: string;
  invocation_id: string;
  tool_name: string;
  query: string;
  candidates_json: string;
  consumed_json: string;
  reformulated: number;
  fell_back_to_grep: number;
  abandoned: number;
  next_graph_resolve_after_read: number;
  token_cost: number;
  timestamp: number;
}

export class RecallMetricsComputer {
  constructor(private readonly db: Database.Database) {}

  computeMetrics(opts: { days?: number; catId?: string; toolName?: string } = {}): RecallMetricsReport {
    const days = opts.days ?? 30;
    const toMs = Date.now();
    const fromMs = toMs - days * 86_400_000;

    const rows = this.fetchRows(fromMs, opts.catId, opts.toolName);
    if (rows.length === 0) return this.emptyReport(fromMs, toMs, days, opts);

    const parsed = rows.map((r) => ({
      ...r,
      candidates: JSON.parse(r.candidates_json) as RecallCandidate[],
      consumed: JSON.parse(r.consumed_json) as ConsumedEntry[],
    }));

    return {
      period: { fromMs, toMs, days },
      filters: { catId: opts.catId, toolName: opts.toolName },
      totalEvents: parsed.length,
      core: this.computeCore(parsed),
      extended: this.computeExtended(parsed),
      graph: this.computeGraph(parsed),
    };
  }

  private fetchRows(fromMs: number, catId?: string, toolName?: string): RawRow[] {
    let sql = 'SELECT * FROM recall_events WHERE timestamp >= ?';
    const params: unknown[] = [fromMs];
    if (catId) {
      sql += ' AND cat_id = ?';
      params.push(catId);
    }
    if (toolName) {
      sql += ' AND tool_name = ?';
      params.push(toolName);
    }
    return this.db.prepare(sql).all(...params) as RawRow[];
  }

  private computeCore(rows: ParsedRow[]): RecallMetricsReport['core'] {
    let consumedAt3Count = 0;
    const reciprocalRanks: number[] = [];
    let reformulatedCount = 0;
    let abandonedCount = 0;

    for (const r of rows) {
      if (r.consumed.some((c) => c.rank <= 3)) consumedAt3Count++;
      if (r.consumed.length > 0) {
        const firstRank = Math.min(...r.consumed.map((c) => c.rank));
        reciprocalRanks.push(1 / firstRank);
      }
      if (r.reformulated) reformulatedCount++;
      if (r.abandoned) abandonedCount++;
    }

    return {
      consumedAt3: consumedAt3Count / rows.length,
      consumedMRR: reciprocalRanks.length > 0
        ? reciprocalRanks.reduce((a, b) => a + b, 0) / rows.length
        : 0,
      reformulationRate: reformulatedCount / rows.length,
      searchAbandonRate: abandonedCount / rows.length,
    };
  }

  private computeExtended(rows: ParsedRow[]): RecallMetricsReport['extended'] {
    let readthroughSum = 0;
    let readthroughDenom = 0;
    const firstConsumedRanks: number[] = [];
    let totalTokens = 0;
    let totalConsumed = 0;

    for (const r of rows) {
      if (r.candidates.length > 0) {
        const topK = Math.min(3, r.candidates.length);
        const consumedInTopK = r.consumed.filter((c) => c.rank <= 3).length;
        readthroughSum += consumedInTopK / topK;
        readthroughDenom++;
      }
      if (r.consumed.length > 0) {
        firstConsumedRanks.push(Math.min(...r.consumed.map((c) => c.rank)));
        totalConsumed += r.consumed.length;
      }
      totalTokens += r.token_cost;
    }

    firstConsumedRanks.sort((a, b) => a - b);
    const median = firstConsumedRanks.length > 0
      ? firstConsumedRanks[Math.floor(firstConsumedRanks.length / 2)]!
      : 0;

    // reformulationsBeforeConsumption: group by invocation, count searches before first consumed
    const byInvocation = new Map<string, ParsedRow[]>();
    for (const r of rows) {
      const arr = byInvocation.get(r.invocation_id) ?? [];
      arr.push(r);
      byInvocation.set(r.invocation_id, arr);
    }
    let reformBeforeSum = 0;
    let reformBeforeCount = 0;
    for (const group of byInvocation.values()) {
      group.sort((a, b) => a.timestamp - b.timestamp);
      let searches = 0;
      for (const r of group) {
        searches++;
        if (r.consumed.length > 0) {
          reformBeforeSum += searches;
          reformBeforeCount++;
          break;
        }
      }
    }

    // reformulateAfterExposure: reformulated + no consumed + fell_back_to_grep=0
    const reformAfterExposure = rows.filter(
      (r) => r.reformulated && r.consumed.length === 0 && !r.fell_back_to_grep,
    ).length;

    // grepFallbackRate: fell_back_to_grep when candidates exist
    const withCandidates = rows.filter((r) => r.candidates.length > 0);
    const grepFallbackCount = withCandidates.filter((r) => r.fell_back_to_grep).length;

    return {
      readthroughAt3: readthroughDenom > 0 ? readthroughSum / readthroughDenom : 0,
      firstConsumedRankMedian: median,
      reformulationsBeforeConsumption: reformBeforeCount > 0
        ? reformBeforeSum / reformBeforeCount
        : 0,
      reformulateAfterExposure: rows.length > 0 ? reformAfterExposure / rows.length : 0,
      grepFallbackRate: withCandidates.length > 0
        ? grepFallbackCount / withCandidates.length
        : 0,
      tokenCostPerHit: totalConsumed > 0 ? totalTokens / totalConsumed : 0,
    };
  }

  private computeGraph(rows: ParsedRow[]): RecallMetricsReport['graph'] {
    const graphRows = rows.filter((r) => r.tool_name === 'graph_resolve');
    const graphWithConsumed = graphRows.filter((r) => r.consumed.length > 0);

    const nonFirst = graphWithConsumed.filter((r) =>
      r.consumed.some((c) => c.rank > 1),
    ).length;

    const traversalComplete = graphRows.filter(
      (r) => r.next_graph_resolve_after_read && r.consumed.length > 0,
    ).length;

    return {
      nonFirstSelectionRate: graphWithConsumed.length > 0
        ? nonFirst / graphWithConsumed.length
        : 0,
      traversalCompletion: graphRows.length > 0
        ? traversalComplete / graphRows.length
        : 0,
    };
  }

  private emptyReport(
    fromMs: number, toMs: number, days: number,
    opts: { catId?: string; toolName?: string },
  ): RecallMetricsReport {
    return {
      period: { fromMs, toMs, days },
      filters: { catId: opts.catId, toolName: opts.toolName },
      totalEvents: 0,
      core: { consumedAt3: 0, consumedMRR: 0, reformulationRate: 0, searchAbandonRate: 0 },
      extended: {
        readthroughAt3: 0, firstConsumedRankMedian: 0,
        reformulationsBeforeConsumption: 0, reformulateAfterExposure: 0,
        grepFallbackRate: 0, tokenCostPerHit: 0,
      },
      graph: { nonFirstSelectionRate: 0, traversalCompletion: 0 },
    };
  }
}

type ParsedRow = RawRow & {
  candidates: RecallCandidate[];
  consumed: ConsumedEntry[];
};
```

**Step 4: Run tests**

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/memory/recall-metrics-computer.test.js`
Expected: 7/7 pass

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/RecallMetricsComputer.ts \
       packages/api/test/memory/recall-metrics-computer.test.js
git commit -m "feat(F200): RecallMetricsComputer — core + extended + graph metrics"
```

---

## Task 3: Anchor Metrics Refresh (AC-B2)

**Files:**
- Modify: `packages/api/src/domains/memory/RecallMetricsComputer.ts` (add methods)
- Add tests: `packages/api/test/memory/recall-metrics-computer.test.js`

**Step 1: Write failing tests**

```javascript
it('AC-B2: refreshAnchorMetrics persists popularity + dormancy', () => {
  const now = Date.now();
  // Anchor A: consumed 3 times in 30d, last consumed today
  for (let i = 0; i < 3; i++) {
    insertEvent(db, {
      recall_id: `r-a-${i}`,
      timestamp: now - i * 86_400_000,
      candidates_json: JSON.stringify([{ anchor: 'A', rank: 1 }]),
      consumed_json: JSON.stringify([{ anchor: 'A', rank: 1, method: 'Read' }]),
    });
  }
  // Anchor B: exposed 2 times, consumed 0 times
  for (let i = 0; i < 2; i++) {
    insertEvent(db, {
      recall_id: `r-b-${i}`,
      timestamp: now - i * 86_400_000,
      candidates_json: JSON.stringify([{ anchor: 'B', rank: 2 }]),
      consumed_json: '[]',
      abandoned: 1,
    });
  }

  const computer = new RecallMetricsComputer(db);
  computer.refreshAnchorMetrics();

  const anchorA = db.prepare('SELECT * FROM anchor_recall_metrics WHERE anchor = ?').get('A');
  assert.ok(anchorA);
  assert.equal(anchorA.consumed_count_30d, 3);
  assert.equal(anchorA.exposure_count_30d, 3);
  assert.equal(anchorA.dormancy_days, 0);

  const anchorB = db.prepare('SELECT * FROM anchor_recall_metrics WHERE anchor = ?').get('B');
  assert.ok(anchorB);
  assert.equal(anchorB.consumed_count_30d, 0);
  assert.equal(anchorB.exposure_count_30d, 2);
  assert.ok(anchorB.dormancy_days === null); // never consumed
});

it('AC-B2: getPopularAnchors returns ranked list', () => {
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    insertEvent(db, {
      recall_id: `r-pop-${i}`,
      timestamp: now,
      candidates_json: JSON.stringify([{ anchor: 'HOT', rank: 1 }]),
      consumed_json: JSON.stringify([{ anchor: 'HOT', rank: 1, method: 'Read' }]),
    });
  }
  insertEvent(db, {
    recall_id: 'r-cold',
    timestamp: now,
    candidates_json: JSON.stringify([{ anchor: 'COLD', rank: 1 }]),
    consumed_json: JSON.stringify([{ anchor: 'COLD', rank: 1, method: 'Read' }]),
  });

  const computer = new RecallMetricsComputer(db);
  computer.refreshAnchorMetrics();
  const popular = computer.getPopularAnchors(10);
  assert.equal(popular[0].anchor, 'HOT');
  assert.equal(popular[0].consumedCount30d, 5);
});
```

**Step 2: Implement refreshAnchorMetrics + getPopularAnchors + getDormantAnchors**

Add to `RecallMetricsComputer`:

```typescript
refreshAnchorMetrics(): void {
  const cutoff = Date.now() - 30 * 86_400_000;
  const rows = this.db.prepare(
    'SELECT candidates_json, consumed_json, timestamp FROM recall_events WHERE timestamp >= ?'
  ).all(cutoff) as Array<{ candidates_json: string; consumed_json: string; timestamp: number }>;

  const anchors = new Map<string, { exposed: number; consumed: number; lastConsumed: number | null }>();

  for (const row of rows) {
    const candidates = JSON.parse(row.candidates_json) as RecallCandidate[];
    const consumed = JSON.parse(row.consumed_json) as ConsumedEntry[];
    const consumedSet = new Set(consumed.map((c) => c.anchor));

    for (const cand of candidates) {
      const entry = anchors.get(cand.anchor) ?? { exposed: 0, consumed: 0, lastConsumed: null };
      entry.exposed++;
      if (consumedSet.has(cand.anchor)) {
        entry.consumed++;
        if (entry.lastConsumed === null || row.timestamp > entry.lastConsumed) {
          entry.lastConsumed = row.timestamp;
        }
      }
      anchors.set(cand.anchor, entry);
    }
  }

  const upsert = this.db.prepare(`
    INSERT INTO anchor_recall_metrics (anchor, consumed_count_30d, exposure_count_30d, last_consumed_at, dormancy_days, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(anchor) DO UPDATE SET
      consumed_count_30d = excluded.consumed_count_30d,
      exposure_count_30d = excluded.exposure_count_30d,
      last_consumed_at = excluded.last_consumed_at,
      dormancy_days = excluded.dormancy_days,
      updated_at = excluded.updated_at
  `);

  const now = Date.now();
  const tx = this.db.transaction(() => {
    for (const [anchor, stats] of anchors) {
      const lastAt = stats.lastConsumed ? new Date(stats.lastConsumed).toISOString() : null;
      const dormancy = stats.lastConsumed !== null
        ? Math.floor((now - stats.lastConsumed) / 86_400_000)
        : null;
      upsert.run(anchor, stats.consumed, stats.exposed, lastAt, dormancy, new Date().toISOString());
    }
  });
  tx();
}

getPopularAnchors(limit = 20): AnchorMetric[] {
  return (this.db.prepare(
    'SELECT * FROM anchor_recall_metrics ORDER BY consumed_count_30d DESC LIMIT ?'
  ).all(limit) as Array<Record<string, unknown>>).map(toAnchorMetric);
}

getDormantAnchors(thresholdDays = 30, limit = 20): AnchorMetric[] {
  return (this.db.prepare(
    'SELECT * FROM anchor_recall_metrics WHERE dormancy_days >= ? ORDER BY dormancy_days DESC LIMIT ?'
  ).all(thresholdDays, limit) as Array<Record<string, unknown>>).map(toAnchorMetric);
}
```

**Step 3: Run tests**

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/memory/recall-metrics-computer.test.js`
Expected: 9/9 pass

**Step 4: Commit**

```bash
git add packages/api/src/domains/memory/RecallMetricsComputer.ts \
       packages/api/test/memory/recall-metrics-computer.test.js
git commit -m "feat(F200): anchor popularity + dormancy persistence (AC-B2)"
```

---

## Task 4: API Route — /api/recall/metrics (AC-B1, B3, B4)

**Files:**
- Create: `packages/api/src/routes/recall-metrics.ts`
- Modify: `packages/api/src/app.ts` (register route)
- Test: `packages/api/test/memory/recall-metrics-computer.test.js` (add route tests if needed, or rely on unit tests)

**Step 1: Create route**

```typescript
// packages/api/src/routes/recall-metrics.ts
import type { FastifyPluginAsync } from 'fastify';
import type Database from 'better-sqlite3';
import { RecallMetricsComputer } from '../domains/memory/RecallMetricsComputer.js';
import { resolveHeaderUserId } from '../utils/request-identity.js';

export interface RecallMetricsRoutesOptions {
  evidenceDb: Database.Database;
}

interface CacheEntry {
  key: string;
  data: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 20;

export function clearRecallMetricsCache(): void {
  cache.clear();
}

export const recallMetricsRoutes: FastifyPluginAsync<RecallMetricsRoutesOptions> = async (app, opts) => {
  const computer = new RecallMetricsComputer(opts.evidenceDb);

  app.get<{
    Querystring: { days?: string; catId?: string; toolName?: string; refresh?: string };
  }>('/api/recall/metrics', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

    const days = Math.min(Math.max(1, parseInt(request.query.days ?? '30', 10) || 30), 90);
    const catId = request.query.catId || undefined;
    const toolName = request.query.toolName || undefined;
    const forceRefresh = request.query.refresh === '1';
    const cacheKey = `recall:${days}:${catId ?? ''}:${toolName ?? ''}`;

    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.data;
    }

    const report = computer.computeMetrics({ days, catId, toolName });

    if (cache.size >= MAX_CACHE) {
      const oldestKey = cache.keys().next().value as string;
      cache.delete(oldestKey);
    }
    cache.set(cacheKey, { key: cacheKey, data: report, expiresAt: Date.now() + CACHE_TTL_MS });
    return report;
  });

  app.get<{
    Querystring: { limit?: string; dormancyThreshold?: string; refresh?: string };
  }>('/api/recall/anchors', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

    const forceRefresh = request.query.refresh === '1';
    if (forceRefresh) computer.refreshAnchorMetrics();

    const limit = Math.min(Math.max(1, parseInt(request.query.limit ?? '20', 10) || 20), 100);
    const threshold = parseInt(request.query.dormancyThreshold ?? '0', 10);

    if (threshold > 0) {
      return { anchors: computer.getDormantAnchors(threshold, limit) };
    }
    return { anchors: computer.getPopularAnchors(limit) };
  });

  app.post('/api/recall/anchors/refresh', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Missing X-Cat-Cafe-User header' });

    computer.refreshAnchorMetrics();
    return { status: 'ok' };
  });
};
```

**Step 2: Register in app.ts**

Find the existing route registration block and add:

```typescript
import { recallMetricsRoutes } from './routes/recall-metrics.js';
// In the route registration section:
app.register(recallMetricsRoutes, { evidenceDb });
```

**Step 3: Build + test**

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/memory/recall-metrics-computer.test.js`
Expected: all pass

**Step 4: Commit**

```bash
git add packages/api/src/routes/recall-metrics.ts packages/api/src/app.ts
git commit -m "feat(F200): /api/recall/metrics + /api/recall/anchors routes (AC-B1/B3/B4)"
```

---

## Task 5: Wire anchor refresh into recall-correlation-hook

**Files:**
- Modify: `packages/api/src/domains/memory/recall-correlation-hook.ts`

After `persistBatch`, trigger `refreshAnchorMetrics()` so anchor stats stay fresh on each invocation completion.

```typescript
// At end of triggerRecallCorrelation, after persistBatch:
correlator.refreshAnchorMetrics?.();
```

Actually, better: create a standalone `refreshAnchorMetrics` function in RecallMetricsComputer that can be called from the hook. The Computer instance needs to be created once per invocation anyway.

**Step 1: Add to hook**

```typescript
const metricsComputer = new RecallMetricsComputer(db);
metricsComputer.refreshAnchorMetrics();
```

**Step 2: Verify existing tests still pass**

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/memory/recall-event-correlator.test.js && node --test packages/api/test/memory/recall-metrics-computer.test.js`
Expected: all pass

**Step 3: Commit**

```bash
git add packages/api/src/domains/memory/recall-correlation-hook.ts
git commit -m "feat(F200): wire anchor metrics refresh into correlation hook"
```

---

## Task 6: Full test suite + build gate

Run: `pnpm test && pnpm lint && pnpm check && pnpm -r --if-present run build`
Expected: all green

**Commit:**

```bash
git commit -m "test(F200): Phase B full suite green"
```

(Only if there were fixups needed.)

---

## Open Questions

None — all Phase B ACs are mechanically derivable from Phase A data. No value OQs.

## Not-in-scope reminder

- `tokenCost` is currently hardcoded to 0 in Phase A's `RecallEventCorrelator`. Phase B computes the aggregation correctly — when token cost gets wired (Phase C or later), the metrics automatically reflect it.
- ReformulateAfterExposure in the spec says "tool_call_distance_to_next_search ≤ 3". Phase A doesn't store this distance on the `recall_events` row. Phase B approximates with `reformulated && consumed.length === 0 && !fell_back_to_grep`. If we need the exact distance, it requires extending RecallEventCorrelator — defer to Phase C.
