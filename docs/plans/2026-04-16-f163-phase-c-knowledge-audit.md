# F163 Phase C: Three-Trigger Knowledge Audit — Implementation Plan

**Feature:** F163 — `docs/features/F163-memory-entropy-reduction.md`
**Goal:** Three audit triggers (write-time / retrieval-time / review-time) that detect stale or contradictory knowledge, plus a health report generator — all flag-gated.
**Acceptance Criteria:**
- AC-C1: Write-time 矛盾检测：新知识写入时自动检索相关旧知识，冲突标记 `contradicts[]`
- AC-C2: Retrieval-time 标记：猫可将使用中发现过时的知识标记为 `status=review`
- AC-C3: Review-time 队列：`verified_at` 超阈值的知识自动进入复核队列
- AC-C4: 有 skill 或 scheduled task 可生成 Harness 健康报告（膨胀率、冲突检测、ADR 断链、未验证清单）
- AC-C5: 铲屎官确认报告的 pruning 建议 actionable（不是无用的噪声）
- Bonus: issue #1221 — 验证 Hub UI 可动态更新 F163 flags（F136 PATCH /api/config/env 路径）
**Architecture:** Schema V15 adds `contradicts`, `invalid_at`, `review_cycle_days` to evidence_docs. Contradiction detector runs inside upsert() write queue. Review queue is a pure query over existing columns (verified_at + review_cycle_days). Health report is a standalone module aggregating metrics. All gated by F163_CONTRADICTION_DETECTION and F163_REVIEW_QUEUE flags (already defined in f163-types.ts).
**Tech Stack:** SQLite, Fastify, node:test, zod
**前端验证:** No — pure backend/API

---

## What We're NOT Building

- No automatic conflict resolution (猫 only suggests, CVO decides)
- No new scheduler daemon (reuse existing scheduler infra for periodic health reports)
- No full ADR link-graph validation (Phase C only checks `verified_at` staleness, not cross-document references)
- No `replaced_by` column (reuse existing `superseded_by`)

## Terminal Schema (V15)

```sql
ALTER TABLE evidence_docs ADD COLUMN contradicts TEXT;       -- JSON array of anchor IDs
ALTER TABLE evidence_docs ADD COLUMN invalid_at TEXT;        -- ISO8601 when invalidated
ALTER TABLE evidence_docs ADD COLUMN review_cycle_days INTEGER; -- days between reviews
```

## Terminal Interfaces

```typescript
// Added to EvidenceItem (interfaces.ts)
contradicts?: string[];      // anchors this item conflicts with
invalidAt?: string;          // when contradiction detected
reviewCycleDays?: number;    // review cadence (default by kind)

// New: contradiction detection result
interface ContradictionHit {
  anchor: string;
  title: string;
  similarity: number;
  reason: string;
}

// New: review queue item
interface ReviewQueueItem {
  anchor: string;
  kind: string;
  title: string;
  verifiedAt: string;
  reviewCycleDays: number;
  daysSinceVerification: number;
  staleness: 'warning' | 'overdue';
}

// New: health report
interface HarnessHealthReport {
  generatedAt: string;
  totalDocs: number;
  byKind: Record<string, number>;
  contradictions: { count: number; pairs: Array<{ a: string; b: string; reason: string }> };
  staleReview: { warning: number; overdue: number; items: ReviewQueueItem[] };
  unverified: { count: number; anchors: string[] };
  backstopRatio: number;
  growthRate: { last7d: number; last30d: number };
}
```

---

### Task 1: Schema V15 — contradiction + review columns

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts:69` (CURRENT_SCHEMA_VERSION 14→15)
- Modify: `packages/api/src/domains/memory/schema.ts:434` (add V15 migration block)
- Test: `packages/api/test/memory/schema-v15-f163c.test.js`

**Step 1: Write failing test**

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Database from 'better-sqlite3';
import { CURRENT_SCHEMA_VERSION, migrate } from '../../dist/domains/memory/schema.js';

describe('Schema V15 (F163 Phase C)', () => {
  it('CURRENT_SCHEMA_VERSION is 15', () => {
    assert.equal(CURRENT_SCHEMA_VERSION, 15);
  });

  it('migration adds contradicts, invalid_at, review_cycle_days columns', () => {
    const db = new Database(':memory:');
    migrate(db);
    const cols = db.prepare("PRAGMA table_info('evidence_docs')").all();
    const names = cols.map(c => c.name);
    assert.ok(names.includes('contradicts'), 'should have contradicts');
    assert.ok(names.includes('invalid_at'), 'should have invalid_at');
    assert.ok(names.includes('review_cycle_days'), 'should have review_cycle_days');
    const ver = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
    assert.equal(ver.v, 15);
  });
});
```

**Step 2: Run test → RED** (`CURRENT_SCHEMA_VERSION` is 14)

**Step 3: Implement migration**

schema.ts:69 → `CURRENT_SCHEMA_VERSION = 15`

Add after line 434:
```typescript
if (currentVersion < 15) {
  try { db.exec('ALTER TABLE evidence_docs ADD COLUMN contradicts TEXT'); } catch {}
  try { db.exec('ALTER TABLE evidence_docs ADD COLUMN invalid_at TEXT'); } catch {}
  try { db.exec('ALTER TABLE evidence_docs ADD COLUMN review_cycle_days INTEGER'); } catch {}
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(15, new Date().toISOString());
}
```

**Step 4: Run test → GREEN**

**Step 5: Update pack-knowledge-scope.test.js** (version assertion 14→15, same as Phase B pattern)

**Step 6: Commit** `feat(F163): Schema V15 — contradicts + invalid_at + review_cycle_days [布偶猫🐾]`

---

### Task 2: EvidenceItem interface + upsert round-trip

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts:104` (add 3 fields)
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (INSERT/SELECT + mapping)
- Test: `packages/api/test/memory/f163-contradiction-roundtrip.test.js`

**Step 1: Write failing test**

```javascript
it('upsert persists contradicts/invalidAt/reviewCycleDays and getByAnchor returns them', async () => {
  const store = new SqliteEvidenceStore(':memory:');
  await store.initialize();
  await store.upsert([{
    anchor: 'LL-CT-1', kind: 'lesson', status: 'active',
    title: 'Test', updatedAt: '2026-04-16',
    contradicts: ['LL-OLD-1', 'LL-OLD-2'],
    invalidAt: '2026-04-16T12:00:00Z',
    reviewCycleDays: 90,
  }]);
  const doc = await store.getByAnchor('LL-CT-1');
  assert.deepEqual(doc.contradicts, ['LL-OLD-1', 'LL-OLD-2']);
  assert.equal(doc.invalidAt, '2026-04-16T12:00:00Z');
  assert.equal(doc.reviewCycleDays, 90);
});
```

**Step 2: Run → RED**

**Step 3: Implement**

interfaces.ts — add to EvidenceItem:
```typescript
contradicts?: string[];
invalidAt?: string;
reviewCycleDays?: number;
```

SqliteEvidenceStore.ts — extend INSERT column list, VALUES list, row→item mapping.

**Step 4: Run → GREEN**

**Step 5: Commit** `feat(F163): EvidenceItem interface + upsert for Phase C columns [布偶猫🐾]`

---

### Task 3: Write-time contradiction detector (AC-C1)

**Files:**
- Create: `packages/api/src/domains/memory/f163-contradiction-detector.ts`
- Test: `packages/api/test/memory/f163-contradiction-detector.test.js`

**Step 1: Write failing test**

```javascript
describe('F163 ContradictionDetector', () => {
  it('detects similar existing docs as potential contradictions', async () => {
    const store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
    await store.upsert([
      { anchor: 'LL-1', kind: 'lesson', status: 'active',
        title: 'Redis EVAL ignores keyPrefix', summary: 'keyPrefix not applied to EVAL',
        updatedAt: '2026-04-10' },
    ]);
    const detector = new ContradictionDetector(store);
    const hits = await detector.check({
      title: 'Redis EVAL respects keyPrefix',
      summary: 'keyPrefix IS applied to EVAL in latest ioredis',
      kind: 'lesson',
    });
    assert.ok(hits.length >= 1);
    assert.equal(hits[0].anchor, 'LL-1');
  });

  it('returns empty when no contradictions found', async () => {
    const store = new SqliteEvidenceStore(':memory:');
    await store.initialize();
    const detector = new ContradictionDetector(store);
    const hits = await detector.check({
      title: 'Unrelated topic', summary: 'Something completely different', kind: 'lesson',
    });
    assert.deepEqual(hits, []);
  });

  it('skips detection when flag is off', async () => {
    // F163_CONTRADICTION_DETECTION=off → returns empty, no search
    process.env.F163_CONTRADICTION_DETECTION = 'off';
    const detector = new ContradictionDetector(store);
    const hits = await detector.check({ title: 'anything', summary: 'anything', kind: 'lesson' });
    assert.deepEqual(hits, []);
  });
});
```

**Step 2: Run → RED**

**Step 3: Implement ContradictionDetector**

```typescript
export class ContradictionDetector {
  constructor(private store: { search(q: string, opts?: unknown): Promise<EvidenceItem[]> }) {}

  async check(incoming: { title: string; summary?: string; kind: string }): Promise<ContradictionHit[]> {
    const flags = freezeFlags();
    if (flags.contradictionDetection === 'off') return [];

    const query = `${incoming.title} ${incoming.summary ?? ''}`.trim();
    const candidates = await this.store.search(query, { limit: 10, kinds: [incoming.kind] });
    // TF-IDF overlap score from DuplicateScanner's tokenizer
    return candidates
      .filter(c => similarity(query, `${c.title} ${c.summary ?? ''}`) > 0.3)
      .map(c => ({ anchor: c.anchor, title: c.title, similarity: ..., reason: 'lexical overlap' }));
  }
}
```

**Step 4: Run → GREEN**

**Step 5: Commit** `feat(F163): write-time contradiction detector (AC-C1) [布偶猫🐾]`

---

### Task 4: Hook contradiction detector into upsert (AC-C1 completion)

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` (upsert method)
- Modify: `packages/api/src/routes/f163-admin.ts` (new endpoint: POST /api/f163/contradictions/check)
- Test: `packages/api/test/memory/f163-contradiction-api.test.js`

**Step 1: Write failing test** — POST /api/f163/contradictions/check returns hits

```javascript
it('returns contradiction hits when flag=suggest', async () => {
  const { app } = await setup('suggest'); // seeds LL-001, LL-002
  const res = await app.inject({
    method: 'POST', url: '/api/f163/contradictions/check',
    headers: { 'x-forwarded-for': '127.0.0.1' },
    payload: { title: 'Redis keyPrefix EVAL behavior', summary: 'keyPrefix applied to EVAL', kind: 'lesson' },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(Array.isArray(body.hits));
});

it('returns 403 when flag=off', async () => {
  const { app } = await setup('off');
  const res = await app.inject({
    method: 'POST', url: '/api/f163/contradictions/check',
    headers: { 'x-forwarded-for': '127.0.0.1' },
    payload: { title: 'test', summary: 'test', kind: 'lesson' },
  });
  assert.equal(res.statusCode, 403);
});
```

**Step 2: Run → RED**

**Step 3: Implement** — Add route + wire ContradictionDetector + log to f163_logs

**Step 4: Run → GREEN**

**Step 5: Commit** `feat(F163): contradiction check API + upsert hook (AC-C1) [布偶猫🐾]`

---

### Task 5: Retrieval-time marking — flag as review (AC-C2)

**Files:**
- Modify: `packages/api/src/routes/f163-admin.ts` (POST /api/f163/flag-review)
- Test: `packages/api/test/memory/f163-flag-review.test.js`

**Step 1: Write failing test**

```javascript
it('marks doc status=review with reason', async () => {
  const { app, store } = await setup();
  const res = await app.inject({
    method: 'POST', url: '/api/f163/flag-review',
    headers: { 'x-forwarded-for': '127.0.0.1' },
    payload: { anchor: 'LL-001', reason: 'Observed contradictory behavior in production' },
  });
  assert.equal(res.statusCode, 200);
  const doc = await store.getByAnchor('LL-001');
  assert.equal(doc.status, 'review');
});

it('rejects when anchor not found', async () => {
  const { app } = await setup();
  const res = await app.inject({
    method: 'POST', url: '/api/f163/flag-review',
    headers: { 'x-forwarded-for': '127.0.0.1' },
    payload: { anchor: 'NONEXISTENT', reason: 'test' },
  });
  assert.equal(res.statusCode, 404);
});
```

**Step 2: Run → RED**

**Step 3: Implement** — UPDATE status='review' WHERE anchor=? + log to f163_logs

**Step 4: Run → GREEN**

**Step 5: Commit** `feat(F163): retrieval-time flag-review endpoint (AC-C2) [布偶猫🐾]`

---

### Task 6: Review-time queue — stale knowledge detection (AC-C3)

**Files:**
- Create: `packages/api/src/domains/memory/f163-review-queue.ts`
- Modify: `packages/api/src/routes/f163-admin.ts` (GET /api/f163/review-queue)
- Test: `packages/api/test/memory/f163-review-queue.test.js`

**Step 1: Write failing test**

```javascript
it('returns items where verified_at exceeds review_cycle_days', async () => {
  const { app, store } = await setup();
  // Seed: LL-STALE verified 120 days ago, review_cycle_days=90
  await store.upsert([{
    anchor: 'LL-STALE', kind: 'lesson', status: 'active',
    title: 'Old knowledge', updatedAt: '2026-01-01',
    verifiedAt: '2026-01-01', reviewCycleDays: 90,
  }]);
  const res = await app.inject({
    method: 'GET', url: '/api/f163/review-queue',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.items.length >= 1);
  assert.equal(body.items[0].anchor, 'LL-STALE');
  assert.equal(body.items[0].staleness, 'overdue');
});

it('returns 403 when F163_REVIEW_QUEUE=off', async () => {
  process.env.F163_REVIEW_QUEUE = 'off';
  const { app } = await setup();
  const res = await app.inject({
    method: 'GET', url: '/api/f163/review-queue',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });
  assert.equal(res.statusCode, 403);
});
```

**Step 2: Run → RED**

**Step 3: Implement ReviewQueue** — Pure SQL query:

```sql
SELECT anchor, kind, title, verified_at, review_cycle_days,
  julianday('now') - julianday(verified_at) AS days_since
FROM evidence_docs
WHERE status = 'active'
  AND verified_at IS NOT NULL
  AND review_cycle_days IS NOT NULL
  AND julianday('now') - julianday(verified_at) > review_cycle_days * 0.8
ORDER BY days_since DESC
```

Staleness: `>= cycle * 0.8` = warning, `>= cycle` = overdue.

Default review_cycle_days by kind (applied at query time, not stored):
- lesson: 90
- decision: 180
- feedback: 60
- spec: 120

**Step 4: Run → GREEN**

**Step 5: Commit** `feat(F163): review-time queue for stale knowledge (AC-C3) [布偶猫🐾]`

---

### Task 7: Harness health report generator (AC-C4)

**Files:**
- Create: `packages/api/src/domains/memory/f163-health-report.ts`
- Modify: `packages/api/src/routes/f163-admin.ts` (GET /api/f163/health-report)
- Test: `packages/api/test/memory/f163-health-report.test.js`

**Step 1: Write failing test**

```javascript
it('generates health report with all sections', async () => {
  const { app } = await setup();
  const res = await app.inject({
    method: 'GET', url: '/api/f163/health-report',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });
  assert.equal(res.statusCode, 200);
  const report = res.json();
  assert.ok(report.generatedAt);
  assert.ok(typeof report.totalDocs === 'number');
  assert.ok(report.byKind);
  assert.ok(report.contradictions);
  assert.ok(report.staleReview);
  assert.ok(typeof report.backstopRatio === 'number');
});
```

**Step 2: Run → RED**

**Step 3: Implement HealthReportGenerator** — Aggregates:
- `totalDocs`: COUNT(*)
- `byKind`: GROUP BY kind
- `contradictions`: WHERE contradicts IS NOT NULL
- `staleReview`: reuse ReviewQueue logic
- `unverified`: WHERE verified_at IS NULL AND authority != 'observed'
- `backstopRatio`: COUNT(activation='backstop') / totalDocs

**Step 4: Run → GREEN**

**Step 5: Commit** `feat(F163): harness health report generator (AC-C4) [布偶猫🐾]`

---

### Task 8: Zero-regression test — flags off = no behavior change

**Files:**
- Test: `packages/api/test/memory/f163-phase-c-zero-regression.test.js`

**Step 1: Write test**

```javascript
it('contradiction detection does nothing when flag=off (default)', async () => {
  delete process.env.F163_CONTRADICTION_DETECTION;
  // upsert should work without any contradiction side effects
  const store = new SqliteEvidenceStore(':memory:');
  await store.initialize();
  await store.upsert([{ anchor: 'LL-ZR', kind: 'lesson', status: 'active',
    title: 'Zero regression', updatedAt: '2026-04-16' }]);
  const doc = await store.getByAnchor('LL-ZR');
  assert.ok(doc);
  assert.equal(doc.contradicts, undefined);
});

it('review queue returns 403 when flag=off (default)', async () => {
  // Already covered in Task 6 tests, but explicit zero-regression
});
```

**Step 2: Run → GREEN** (should pass immediately since defaults are off)

**Step 3: Commit** `feat(F163): Phase C zero-regression tests [布偶猫🐾]`

---

### Task 9: Hub config dynamic update verification (issue #1221)

**Files:**
- Test: `packages/api/test/memory/f163-hub-config-dynamic.test.js`

**Step 1: Write test** — Verify PATCH /api/config/env updates F163 flags and freezeFlags() picks up changes

```javascript
it('PATCH /api/config/env updates F163 flags without restart', async () => {
  const app = /* full app with config routes */;
  // Initially off
  assert.equal(freezeFlags().contradictionDetection, 'off');
  // Update via Hub API
  await app.inject({
    method: 'PATCH', url: '/api/config/env',
    headers: { 'x-forwarded-for': '127.0.0.1' },
    payload: { updates: { F163_CONTRADICTION_DETECTION: 'suggest' } },
  });
  // Now should be suggest
  assert.equal(freezeFlags().contradictionDetection, 'suggest');
  // Cleanup
  delete process.env.F163_CONTRADICTION_DETECTION;
});
```

**Step 2: Run → GREEN** (F136 path should already work)

**Step 3: Close issue #1221** with comment explaining F136 path is sufficient

**Step 4: Commit** `test(F163): verify Hub config dynamic flag update (closes #1221) [布偶猫🐾]`

---

### Task 10: Experiment logging + biome + build

**Files:**
- All new files: biome format check
- All routes: F163ExperimentLogger wiring

**Step 1:** Wire `F163ExperimentLogger.logContradictionCheck()` and `logReviewQueue()` into new routes (same fail-open pattern as Phase B)

**Step 2:** Run `pnpm check:fix` + `pnpm lint` + `pnpm -r build`

**Step 3: Commit** `style(F163): biome format + experiment logging for Phase C [布偶猫🐾]`

---

## File Size Check

| File | Current | Estimated After | Status |
|------|---------|-----------------|--------|
| f163-admin.ts | 243 | ~320 (3 new routes) | ⚠️ Close to 350 — may need to extract |
| SqliteEvidenceStore.ts | 1054 | ~1080 (3 cols in INSERT) | Pre-existing oversize |
| f163-contradiction-detector.ts | NEW | ~80 | ✅ |
| f163-review-queue.ts | NEW | ~60 | ✅ |
| f163-health-report.ts | NEW | ~100 | ✅ |

If f163-admin.ts exceeds 350 after Task 7, extract Phase C routes into `f163-audit-routes.ts`.
