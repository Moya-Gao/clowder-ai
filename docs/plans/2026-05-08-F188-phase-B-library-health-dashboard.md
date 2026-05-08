# F188 Phase B: Library Health Dashboard — Implementation Plan

**Feature:** F188 — `docs/features/F188-library-stewardship.md`
**Goal:** 将 Memory Health Dashboard 从"有多少东西"升级到"哪里脏了、漏了、坏了"——5 类健康指标 + 可操作列表
**Acceptance Criteria:**
- AC-B1: Health Dashboard 展示 stale anchors 数量 + 列表
- AC-B2: 展示 search miss / low-hit query 统计
- AC-B3: 展示 orphan edges 数量
- AC-B4: 展示 replay drift 趋势（如 Query Replay 已有数据）
- AC-B5: 展示 Knowledge Feed pending + needs_review 积压
- AC-C4: orphan edges 统计接入 Health Dashboard（Phase C 遗留）
**Architecture cell:** `memory`
**Map delta:** none
**Map delta why:** 扩展已有 Health Dashboard，不改 ownership 边界
**Architecture:** Extend existing `generateHealthReport()` with a new `computeLibraryHealth()` function that computes 5 additional metric groups. Same API endpoint returns extended data. Frontend adds a new `LibraryHealthSection` component rendered below the existing dashboard.
**Tech Stack:** better-sqlite3 (DB queries), node:fs (stale anchor check), React (frontend), Vitest + node:test (tests)
**前端验证:** Yes — reviewer 必须用 Playwright/Chrome 实测

---

## Terminal Schema

### Backend: `LibraryHealthMetrics` (new type in `f188-library-health.ts`)

```typescript
export interface LibraryHealthMetrics {
  staleAnchors: {
    count: number;
    items: Array<{ anchor: string; sourcePath: string }>;
  };
  orphanEdges: { count: number };
  searchQuality: {
    totalSearches: number;
    zeroHitCount: number;
    lowHitCount: number;
    recentMisses: Array<{ query: string; resultCount: number; searchedAt: string }>;
  };
  replayDrift: {
    available: boolean;
    sampleCount: number;
    avgSimilarity: number | null;
  };
  knowledgeFeed: {
    pendingCount: number;
    needsReviewCount: number;
  };
}
```

### Frontend: Extended `HealthReportData`

```typescript
export interface HealthReportData {
  // ... existing fields ...
  // Phase B additions (optional for backward compat):
  staleAnchors?: LibraryHealthMetrics['staleAnchors'];
  orphanEdges?: LibraryHealthMetrics['orphanEdges'];
  searchQuality?: LibraryHealthMetrics['searchQuality'];
  replayDrift?: LibraryHealthMetrics['replayDrift'];
  knowledgeFeed?: LibraryHealthMetrics['knowledgeFeed'];
}
```

### Data Sources (no new tables, all queries on existing schema)

| Metric | Source | Query Strategy |
|--------|--------|---------------|
| Stale anchors | `evidence_docs.source_path` + filesystem | SELECT source_path → `existsSync(join(docsRoot, path))` |
| Orphan edges | `edges` + `evidence_docs` | `WHERE from_anchor NOT IN (SELECT anchor ...)` (reuse CollectionReadModel pattern) |
| Search quality | `f163_logs` (log_type='search') | Parse payload JSON → extract `resultCount` |
| Replay drift | `f163_logs` (log_type='search') | Group by query text, compare `topKPerCollection` between first/last occurrence → Jaccard |
| KF pending | `MarkerQueue.list()` | Filter by status ∈ {captured, normalized, needs_review} |

### What We're NOT Building

- No new DB tables or schema migrations
- No automatic stale anchor cleanup (that's IndexBuilder's rebuild job)
- No real-time replay execution (drift computed from historical logs only)
- No search miss alerting/notification

---

## Task 1: Backend — `computeLibraryHealth()` pure function

**Files:**
- Create: `packages/api/src/domains/memory/f188-library-health.ts`
- Test: `packages/api/test/memory/f188-library-health.test.js`

### Step 1: Write failing tests

```javascript
// packages/api/test/memory/f188-library-health.test.js
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { computeLibraryHealth } from '../../dist/domains/memory/f188-library-health.js';
import { applyMigrations } from '../../dist/domains/memory/schema.js';

function createTestDb() {
  const db = new Database(':memory:');
  applyMigrations(db);
  return db;
}

describe('F188 Phase B: computeLibraryHealth', () => {
  describe('staleAnchors', () => {
    it('detects anchors whose source files are missing', () => {
      const docsRoot = mkdtempSync(join(tmpdir(), 'f188-'));
      writeFileSync(join(docsRoot, 'existing.md'), '# exists');

      const db = createTestDb();
      const ins = db.prepare(
        `INSERT INTO evidence_docs (anchor, kind, status, title, updated_at, source_path)
         VALUES (?, ?, 'active', ?, '2026-01-01', ?)`,
      );
      ins.run('doc-1', 'feature', 'Existing Doc', 'existing.md');
      ins.run('doc-2', 'feature', 'Deleted Doc', 'deleted.md');

      const result = computeLibraryHealth(db, { docsRoot, markers: [] });
      assert.equal(result.staleAnchors.count, 1);
      assert.equal(result.staleAnchors.items[0].anchor, 'doc-2');
    });

    it('skips docs without source_path', () => {
      const docsRoot = mkdtempSync(join(tmpdir(), 'f188-'));
      const db = createTestDb();
      db.prepare(
        `INSERT INTO evidence_docs (anchor, kind, status, title, updated_at)
         VALUES ('no-path', 'thread', 'active', 'No Path', '2026-01-01')`,
      ).run();

      const result = computeLibraryHealth(db, { docsRoot, markers: [] });
      assert.equal(result.staleAnchors.count, 0);
    });
  });

  describe('orphanEdges', () => {
    it('counts edges referencing non-existent anchors', () => {
      const db = createTestDb();
      db.prepare(
        `INSERT INTO evidence_docs (anchor, kind, status, title, updated_at)
         VALUES ('A', 'feature', 'active', 'A', '2026-01-01')`,
      ).run();
      db.prepare("INSERT INTO edges (from_anchor, to_anchor, relation) VALUES ('A', 'GONE', 'related')").run();
      db.prepare("INSERT INTO edges (from_anchor, to_anchor, relation) VALUES ('A', 'A', 'self')").run();

      const docsRoot = mkdtempSync(join(tmpdir(), 'f188-'));
      const result = computeLibraryHealth(db, { docsRoot, markers: [] });
      assert.equal(result.orphanEdges.count, 1);
    });
  });

  describe('searchQuality', () => {
    it('counts zero-hit and low-hit searches', () => {
      const db = createTestDb();
      const ins = db.prepare(
        `INSERT INTO f163_logs (log_type, variant_id, effective_flags, payload, created_at)
         VALUES ('search', 'v1', '{}', ?, ?)`,
      );
      ins.run(JSON.stringify({ query: 'missing', resultCount: 0 }), '2026-05-01');
      ins.run(JSON.stringify({ query: 'low', resultCount: 1 }), '2026-05-02');
      ins.run(JSON.stringify({ query: 'good', resultCount: 10 }), '2026-05-03');

      const docsRoot = mkdtempSync(join(tmpdir(), 'f188-'));
      const result = computeLibraryHealth(db, { docsRoot, markers: [] });
      assert.equal(result.searchQuality.totalSearches, 3);
      assert.equal(result.searchQuality.zeroHitCount, 1);
      assert.equal(result.searchQuality.lowHitCount, 1);
      assert.equal(result.searchQuality.recentMisses.length, 1);
      assert.equal(result.searchQuality.recentMisses[0].query, 'missing');
    });
  });

  describe('replayDrift', () => {
    it('computes Jaccard drift for repeated queries', () => {
      const db = createTestDb();
      const ins = db.prepare(
        `INSERT INTO f163_logs (log_type, variant_id, effective_flags, payload, created_at)
         VALUES ('search', 'v1', '{}', ?, ?)`,
      );
      ins.run(
        JSON.stringify({ query: 'memory', topKPerCollection: { project: { anchors: ['A', 'B', 'C'] } } }),
        '2026-05-01',
      );
      ins.run(
        JSON.stringify({ query: 'memory', topKPerCollection: { project: { anchors: ['B', 'C', 'D'] } } }),
        '2026-05-02',
      );

      const docsRoot = mkdtempSync(join(tmpdir(), 'f188-'));
      const result = computeLibraryHealth(db, { docsRoot, markers: [] });
      assert.equal(result.replayDrift.available, true);
      assert.equal(result.replayDrift.sampleCount, 1);
      assert.equal(result.replayDrift.avgSimilarity, 0.5); // {B,C} / {A,B,C,D} = 2/4
    });

    it('returns unavailable when no search logs', () => {
      const db = createTestDb();
      const docsRoot = mkdtempSync(join(tmpdir(), 'f188-'));
      const result = computeLibraryHealth(db, { docsRoot, markers: [] });
      assert.equal(result.replayDrift.available, false);
      assert.equal(result.replayDrift.avgSimilarity, null);
    });
  });

  describe('knowledgeFeed', () => {
    it('counts pending and needs_review markers', () => {
      const markers = [
        { id: '1', content: 'a', source: 'x', status: 'captured', createdAt: '' },
        { id: '2', content: 'b', source: 'x', status: 'needs_review', createdAt: '' },
        { id: '3', content: 'c', source: 'x', status: 'approved', createdAt: '' },
        { id: '4', content: 'd', source: 'x', status: 'normalized', createdAt: '' },
      ];

      const db = createTestDb();
      const docsRoot = mkdtempSync(join(tmpdir(), 'f188-'));
      const result = computeLibraryHealth(db, { docsRoot, markers });
      assert.equal(result.knowledgeFeed.pendingCount, 3);
      assert.equal(result.knowledgeFeed.needsReviewCount, 1);
    });
  });
});
```

### Step 2: Run tests — verify red

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/memory/f188-library-health.test.js`
Expected: FAIL — module not found

### Step 3: Write implementation

```typescript
// packages/api/src/domains/memory/f188-library-health.ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { Marker } from './interfaces.js';

export interface LibraryHealthMetrics {
  staleAnchors: { count: number; items: Array<{ anchor: string; sourcePath: string }> };
  orphanEdges: { count: number };
  searchQuality: {
    totalSearches: number;
    zeroHitCount: number;
    lowHitCount: number;
    recentMisses: Array<{ query: string; resultCount: number; searchedAt: string }>;
  };
  replayDrift: { available: boolean; sampleCount: number; avgSimilarity: number | null };
  knowledgeFeed: { pendingCount: number; needsReviewCount: number };
}

const PENDING_STATUSES = new Set(['captured', 'normalized', 'needs_review']);

export function computeLibraryHealth(
  db: Database.Database,
  opts: { docsRoot: string; markers: Marker[] },
): LibraryHealthMetrics {
  return {
    staleAnchors: computeStaleAnchors(db, opts.docsRoot),
    orphanEdges: computeOrphanEdges(db),
    searchQuality: computeSearchQuality(db),
    replayDrift: computeReplayDrift(db),
    knowledgeFeed: computeKnowledgeFeed(opts.markers),
  };
}

function computeStaleAnchors(db: Database.Database, docsRoot: string) {
  const rows = db
    .prepare('SELECT anchor, source_path FROM evidence_docs WHERE source_path IS NOT NULL')
    .all() as Array<{ anchor: string; source_path: string }>;
  const items: Array<{ anchor: string; sourcePath: string }> = [];
  for (const row of rows) {
    if (!existsSync(join(docsRoot, row.source_path))) {
      items.push({ anchor: row.anchor, sourcePath: row.source_path });
    }
  }
  return { count: items.length, items };
}

function computeOrphanEdges(db: Database.Database) {
  try {
    const r = db
      .prepare(
        `SELECT count(*) AS c FROM edges
         WHERE from_anchor NOT IN (SELECT anchor FROM evidence_docs)
            OR to_anchor NOT IN (SELECT anchor FROM evidence_docs)`,
      )
      .get() as { c: number } | undefined;
    return { count: r?.c ?? 0 };
  } catch {
    return { count: 0 };
  }
}

function computeSearchQuality(db: Database.Database) {
  try {
    const rows = db
      .prepare(
        "SELECT payload, created_at FROM f163_logs WHERE log_type = 'search' ORDER BY created_at DESC LIMIT 200",
      )
      .all() as Array<{ payload: string; created_at: string }>;
    let zeroHitCount = 0;
    let lowHitCount = 0;
    const recentMisses: Array<{ query: string; resultCount: number; searchedAt: string }> = [];
    for (const row of rows) {
      try {
        const p = JSON.parse(row.payload);
        const rc = p.resultCount ?? 0;
        if (rc === 0) {
          zeroHitCount++;
          if (recentMisses.length < 10) {
            recentMisses.push({ query: p.query ?? '', resultCount: rc, searchedAt: row.created_at });
          }
        } else if (rc <= 2) {
          lowHitCount++;
        }
      } catch { /* skip */ }
    }
    return { totalSearches: rows.length, zeroHitCount, lowHitCount, recentMisses };
  } catch {
    return { totalSearches: 0, zeroHitCount: 0, lowHitCount: 0, recentMisses: [] };
  }
}

function computeReplayDrift(db: Database.Database) {
  try {
    const rows = db
      .prepare(
        "SELECT payload, created_at FROM f163_logs WHERE log_type = 'search' ORDER BY created_at DESC LIMIT 500",
      )
      .all() as Array<{ payload: string; created_at: string }>;
    if (rows.length === 0) return { available: false, sampleCount: 0, avgSimilarity: null };

    const byQuery = new Map<string, Array<Record<string, { anchors?: string[] }>>>();
    for (const row of rows) {
      try {
        const p = JSON.parse(row.payload);
        if (!p.query || !p.topKPerCollection) continue;
        let list = byQuery.get(p.query);
        if (!list) { list = []; byQuery.set(p.query, list); }
        list.push(p.topKPerCollection);
      } catch { /* skip */ }
    }

    let totalSim = 0;
    let sampleCount = 0;
    for (const [, entries] of byQuery) {
      if (entries.length < 2) continue;
      const oldest = entries[entries.length - 1];
      const newest = entries[0];
      const setA = new Set(Object.values(oldest).flatMap((v) => v.anchors ?? []));
      const setB = new Set(Object.values(newest).flatMap((v) => v.anchors ?? []));
      const union = new Set([...setA, ...setB]);
      const inter = [...setA].filter((a) => setB.has(a));
      totalSim += union.size === 0 ? 1 : inter.length / union.size;
      sampleCount++;
    }
    return {
      available: true,
      sampleCount,
      avgSimilarity: sampleCount > 0 ? Math.round((totalSim / sampleCount) * 1000) / 1000 : null,
    };
  } catch {
    return { available: false, sampleCount: 0, avgSimilarity: null };
  }
}

function computeKnowledgeFeed(markers: Marker[]) {
  let pendingCount = 0;
  let needsReviewCount = 0;
  for (const m of markers) {
    if (PENDING_STATUSES.has(m.status)) {
      pendingCount++;
      if (m.status === 'needs_review') needsReviewCount++;
    }
  }
  return { pendingCount, needsReviewCount };
}
```

### Step 4: Run tests — verify green

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/memory/f188-library-health.test.js`
Expected: all 7 tests PASS

### Step 5: Commit

```bash
git add packages/api/src/domains/memory/f188-library-health.ts packages/api/test/memory/f188-library-health.test.js
git commit -m "feat(F188): add computeLibraryHealth — stale anchors, orphan edges, search quality, replay drift, KF pending"
```

---

## Task 2: API route — Wire extended health report

**Files:**
- Modify: `packages/api/src/routes/f163-audit-routes.ts:31-45,138-150`
- Modify: `packages/api/src/index.ts:1800-1804`

### Step 1: Modify `AuditRoutesOptions` interface

Add `markerQueue` and `docsRoot` to the options:

```typescript
// f163-audit-routes.ts — extend interface
interface AuditRoutesOptions {
  evidenceStore: { /* ...existing... */ };
  knowledgeResolver?: IKnowledgeResolver;
  markerQueue?: IMarkerQueue;  // NEW
  docsRoot?: string;           // NEW
}
```

### Step 2: Modify health-report route handler

```typescript
// f163-audit-routes.ts — import + modify GET /api/f163/health-report handler
import { computeLibraryHealth } from '../domains/memory/f188-library-health.js';
import type { IMarkerQueue } from '../domains/memory/interfaces.js';

// In the health-report handler:
app.get('/api/f163/health-report', async (request, reply) => {
  if (!isLocalhost(request.ip)) {
    reply.status(403);
    return { error: 'only allowed from localhost' };
  }

  const db = opts.evidenceStore.getDb();
  const report = generateHealthReport(db as Parameters<typeof generateHealthReport>[0]);

  if (opts.markerQueue && opts.docsRoot) {
    const markers = await opts.markerQueue.list();
    const libraryHealth = computeLibraryHealth(
      db as Parameters<typeof generateHealthReport>[0],
      { docsRoot: opts.docsRoot, markers },
    );
    return { ...report, ...libraryHealth };
  }

  return report;
});
```

### Step 3: Wire deps at registration site

```typescript
// packages/api/src/index.ts — add markerQueue and docsRoot to f163AuditRoutes registration
const docsRoot = process.env.DOCS_ROOT ?? resolve(repoRoot, 'docs');
await app.register(f163AuditRoutes, {
  evidenceStore: memoryServices.evidenceStore as unknown as Parameters<typeof f163AuditRoutes>[1]['evidenceStore'],
  knowledgeResolver: memoryServices.knowledgeResolver,
  markerQueue: memoryServices.markerQueue,   // NEW
  docsRoot,                                   // NEW
});
```

Note: `docsRoot` may already be computed earlier in this function body. Reuse the existing computation or re-derive from `repoRoot`.

### Step 4: Build + test

Run: `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/memory/f188-library-health.test.js`
Expected: PASS (no regression)

### Step 5: Commit

```bash
git add packages/api/src/routes/f163-audit-routes.ts packages/api/src/index.ts
git commit -m "feat(F188): wire library health metrics into /api/f163/health-report"
```

---

## Task 3: Frontend — `LibraryHealthSection` component

**Files:**
- Create: `packages/web/src/components/memory/LibraryHealthSection.tsx`
- Modify: `packages/web/src/components/memory/HealthReport.tsx:6-16,182-260`
- Test: `packages/web/src/components/memory/__tests__/HealthReport.test.ts` (extend)

### Step 1: Write frontend test for new getActionItems behavior

```typescript
// Extend existing HealthReport.test.ts
// Add to getActionItems describe block:

it('flags stale anchors', () => {
  const items = getActionItems({
    ...baseReport,
    staleAnchors: { count: 3, items: [] },
  });
  expect(items.some((i) => i.includes('stale'))).toBe(true);
});

it('flags orphan edges', () => {
  const items = getActionItems({
    ...baseReport,
    orphanEdges: { count: 5 },
  });
  expect(items.some((i) => i.includes('orphan'))).toBe(true);
});

it('flags knowledge feed pending', () => {
  const items = getActionItems({
    ...baseReport,
    knowledgeFeed: { pendingCount: 7, needsReviewCount: 2 },
  });
  expect(items.some((i) => i.includes('pending'))).toBe(true);
});
```

### Step 2: Run tests — verify red

Run: `pnpm --filter @cat-cafe/web test`
Expected: FAIL — staleAnchors/orphanEdges/knowledgeFeed properties don't exist on HealthReportData

### Step 3: Extend `HealthReportData` interface and `getActionItems`

```typescript
// HealthReport.tsx — extend interface (add optional fields)
export interface HealthReportData {
  // ...existing fields...
  staleAnchors?: { count: number; items: Array<{ anchor: string; sourcePath: string }> };
  orphanEdges?: { count: number };
  searchQuality?: {
    totalSearches: number;
    zeroHitCount: number;
    lowHitCount: number;
    recentMisses: Array<{ query: string; resultCount: number; searchedAt: string }>;
  };
  replayDrift?: { available: boolean; sampleCount: number; avgSimilarity: number | null };
  knowledgeFeed?: { pendingCount: number; needsReviewCount: number };
}

// Extend getActionItems:
export function getActionItems(report: HealthReportData): string[] {
  const items: string[] = [];
  // ...existing items...
  if (report.staleAnchors && report.staleAnchors.count > 0) {
    items.push(`${report.staleAnchors.count} stale anchor(s) — source files deleted, rebuild recommended`);
  }
  if (report.orphanEdges && report.orphanEdges.count > 0) {
    items.push(`${report.orphanEdges.count} orphan edge(s) — references to non-existent documents`);
  }
  if (report.knowledgeFeed && report.knowledgeFeed.pendingCount > 0) {
    items.push(`${report.knowledgeFeed.pendingCount} knowledge candidate(s) pending review`);
  }
  return items;
}
```

### Step 4: Run tests — verify green

Run: `pnpm --filter @cat-cafe/web test`
Expected: PASS

### Step 5: Create `LibraryHealthSection.tsx`

```tsx
// packages/web/src/components/memory/LibraryHealthSection.tsx
import type { HealthReportData } from './HealthReport';

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex-1 rounded-xl border border-cafe bg-white p-4">
      <div className="text-xs text-cafe-secondary">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-cafe-black">{value}</div>
      <div className="mt-0.5 text-[10px] text-cafe-muted">{sub}</div>
    </div>
  );
}

export function LibraryHealthSection({ report }: { report: HealthReportData }) {
  const hasLibraryMetrics = report.staleAnchors || report.orphanEdges || report.searchQuality;
  if (!hasLibraryMetrics) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-cafe-black">Library Health</h3>

      {/* AC-B1 + AC-B3/C4 + AC-B5: stat cards */}
      <div className="flex gap-3">
        {report.staleAnchors != null && (
          <MetricCard
            label="Stale Anchors"
            value={String(report.staleAnchors.count)}
            sub="source files deleted"
          />
        )}
        {report.orphanEdges != null && (
          <MetricCard
            label="Orphan Edges"
            value={String(report.orphanEdges.count)}
            sub="dangling graph references"
          />
        )}
        {report.knowledgeFeed != null && (
          <MetricCard
            label="Knowledge Feed"
            value={String(report.knowledgeFeed.pendingCount)}
            sub={`${report.knowledgeFeed.needsReviewCount} needs review`}
          />
        )}
      </div>

      {/* AC-B2: search quality */}
      {report.searchQuality && report.searchQuality.totalSearches > 0 && (
        <div className="rounded-xl border border-cafe bg-white p-5">
          <h4 className="mb-3 text-sm font-semibold text-cafe-black">Search Quality</h4>
          <div className="mb-3 flex gap-4 text-xs text-cafe-secondary">
            <span>{report.searchQuality.totalSearches} total searches</span>
            <span>{report.searchQuality.zeroHitCount} zero-hit</span>
            <span>{report.searchQuality.lowHitCount} low-hit (≤2)</span>
          </div>
          {report.searchQuality.recentMisses.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-cafe-muted">Recent misses</div>
              {report.searchQuality.recentMisses.slice(0, 5).map((m) => (
                <div key={`${m.query}-${m.searchedAt}`} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-cafe-black">{m.query}</span>
                  <span className="text-cafe-muted">{new Date(m.searchedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AC-B4: replay drift */}
      {report.replayDrift?.available && (
        <div className="rounded-xl border border-cafe bg-white p-5">
          <h4 className="mb-2 text-sm font-semibold text-cafe-black">Replay Drift</h4>
          <div className="flex gap-4 text-xs text-cafe-secondary">
            <span>{report.replayDrift.sampleCount} repeated queries</span>
            {report.replayDrift.avgSimilarity != null && (
              <span>avg similarity: {(report.replayDrift.avgSimilarity * 100).toFixed(1)}%</span>
            )}
          </div>
        </div>
      )}

      {/* AC-B1: stale anchor details */}
      {report.staleAnchors && report.staleAnchors.items.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="mb-2 text-xs font-semibold text-amber-800">Stale Anchors</h4>
          <div className="space-y-1">
            {report.staleAnchors.items.slice(0, 10).map((item) => (
              <div key={item.anchor} className="flex items-center gap-2 text-xs text-amber-700">
                <span className="font-mono">{item.anchor}</span>
                <span className="text-amber-500">→ {item.sourcePath}</span>
              </div>
            ))}
            {report.staleAnchors.items.length > 10 && (
              <div className="text-[10px] text-amber-500">
                +{report.staleAnchors.items.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 6: Wire into `HealthReport.tsx`

```tsx
// HealthReport.tsx — import and render
import { LibraryHealthSection } from './LibraryHealthSection';

// In the HealthReport component JSX, after ActionItems and before the footer:
<LibraryHealthSection report={report} />
```

### Step 7: Run all frontend tests

Run: `pnpm --filter @cat-cafe/web test`
Expected: PASS

### Step 8: Commit

```bash
git add packages/web/src/components/memory/LibraryHealthSection.tsx \
  packages/web/src/components/memory/HealthReport.tsx \
  packages/web/src/components/memory/__tests__/HealthReport.test.ts
git commit -m "feat(F188): add Library Health section to Memory Health Dashboard UI"
```

---

## Task 4: Full build + integration verification

### Step 1: Build all packages

Run: `pnpm -r --if-present run build`
Expected: exit 0

### Step 2: Run all tests

Run: `pnpm test`
Expected: all pass

### Step 3: Lint + check

Run: `pnpm lint && pnpm check`
Expected: 0 errors

### Step 4: Commit (if any format fixes needed)

```bash
git add -A && git commit -m "chore(F188): format fixes"
```
