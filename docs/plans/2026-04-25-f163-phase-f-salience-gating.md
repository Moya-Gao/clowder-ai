# F163 Phase F: Task-scoped Salience Gating — Implementation Plan

**Feature:** F163 — `docs/features/F163-memory-entropy-reduction.md`
**Goal:** Runtime context-aware reranking: demote search results irrelevant to the cat's current task, without hurting recall
**Acceptance Criteria:** AC-F1 ~ AC-F6 (copied below for traceability)
**Architecture:** Pure `salience()` scoring function (≤30 line body) in `f163-types.ts` + glue in `evidence.ts` search route. Soft demotion for `search_evidence`; hard cutoff deferred to F148 spotlight surface. Reuses `F163_RETRIEVAL_RERANK` flag.
**Tech Stack:** TypeScript, node:test, better-sqlite3 (shadow logging)
**前端验证:** No — pure backend search reranking

---

## AC Checklist (from spec)

- [ ] AC-F1: `salience(doc, taskContext)` pure function exists (scoring body ≤30 lines), outputs 0.0-1.0 demotion factor, has unit tests
- [ ] AC-F2: `criticality=high` knowledge not gated (salience ≡ 1.0, aligns KD-7 + ADR-009)
- [ ] AC-F3: Runtime — in feat X thread, feat Y unrelated decisions rank lower (soft demotion, still returned)
- [ ] AC-F4: Reversible — same doc gets different salience under different task context
- [ ] AC-F5: Gold set NDCG@10 no regression vs Phase E baseline
- [ ] AC-F6: Reuse `F163_RETRIEVAL_RERANK` flag (off/shadow/on), shadow logs before/after ranking diff + `boostSource` tag

## Terminal Schema

```typescript
// ── Types (in f163-types.ts) ──────────────────────────────────────

export interface SalienceTaskContext {
  activeFeatureIds: string[];       // e.g. ['F163', 'F148']
  truthSourceRef: string | null;    // e.g. 'docs/features/F163-memory-entropy-reduction.md'
  recentArtifactRefs: string[];     // e.g. ['docs/decisions/ADR-009.md']
}

// ── Pure scoring (in f163-types.ts, ≤30 line body) ────────────────

export function salience(
  doc: SalienceDoc,
  ctx: SalienceTaskContext,
): number;  // 0.0 (irrelevant) – 1.0 (fully relevant / exempt)

// ── Rerank glue (in f163-types.ts, shared helper for F148 reuse) ──

export function applySalienceRerank<T extends SalienceDoc>(
  items: T[],
  ctx: SalienceTaskContext,
): { items: T[]; scores: number[] };

// ── Search route additions (evidence.ts) ──────────────────────────

// searchSchema gains optional task context params:
//   activeFeatureIds: z.string().optional()    — comma-separated
//   truthSourceRef:   z.string().optional()
//   recentArtifactRefs: z.string().optional()  — comma-separated

// Pipeline: items → [salience rerank] → rankToConfidence(newIndex)
// Shadow log payload: { query, resultCount, salienceRerank: { before, after, scores, taskContext } }
```

## What We're NOT Building

- No query co-occurrence / embedding similarity for salience (v1 = deterministic signals only)
- No hard cutoff in `search_evidence` (only soft demotion — hard cutoff is spotlight/reflex surface)
- No new env flag (reuse `F163_RETRIEVAL_RERANK`)
- No MCP tool changes (callers pass optional params; MCP integration is caller-side)
- No framework / base class / plugin system (LL-051)

---

## Task 1: `SalienceTaskContext` type + `salience()` pure function

**Files:**
- Modify: `packages/api/src/domains/memory/f163-types.ts`
- Modify: `packages/api/test/memory/f163-types.test.js`

### Step 1: Write failing tests for `salience()`

```javascript
// Append to packages/api/test/memory/f163-types.test.js
import { salience } from '../../dist/domains/memory/f163-types.js';

describe('salience()', () => {
  const baseDoc = { anchor: 'docs/features/F088-chat-gateway.md', authority: 'validated', keywords: ['F088', 'chat'] };
  const alwaysOnDoc = { anchor: 'docs/SOP.md', activation: 'always_on', authority: 'constitutional' };
  const ctx = {
    activeFeatureIds: ['F163'],
    truthSourceRef: 'docs/features/F163-memory-entropy-reduction.md',
    recentArtifactRefs: ['docs/decisions/ADR-009.md'],
  };

  it('returns 1.0 for always_on docs (AC-F2: criticality=high exempt)', () => {
    assert.equal(salience(alwaysOnDoc, ctx), 1.0);
  });

  it('returns 1.0 when no task context provided (graceful no-op)', () => {
    const emptyCtx = { activeFeatureIds: [], truthSourceRef: null, recentArtifactRefs: [] };
    assert.equal(salience(baseDoc, emptyCtx), 1.0);
  });

  it('returns lower score for doc unrelated to active task', () => {
    const score = salience(baseDoc, ctx);
    assert.ok(score < 0.5, `expected < 0.5, got ${score}`);
  });

  it('returns higher score for doc matching active feature ID', () => {
    const matchDoc = { anchor: 'docs/features/F163-memory-entropy-reduction.md', authority: 'validated', keywords: ['F163'] };
    const score = salience(matchDoc, ctx);
    assert.ok(score >= 0.7, `expected >= 0.7, got ${score}`);
  });

  it('boosts doc matching truthSourceRef', () => {
    const truthDoc = { anchor: 'docs/features/F163-memory-entropy-reduction.md', authority: 'validated', keywords: ['F163'] };
    const score = salience(truthDoc, ctx);
    // Should get feature match + truth source match
    assert.ok(score >= 0.9, `expected >= 0.9, got ${score}`);
  });

  it('boosts doc matching recent artifact', () => {
    const artifactDoc = { anchor: 'docs/decisions/ADR-009.md', authority: 'validated', keywords: ['ADR-009'] };
    const score = salience(artifactDoc, ctx);
    assert.ok(score > 0.4, `expected > 0.4, got ${score}`);
  });

  it('caps at 1.0 even with all matches', () => {
    const perfectDoc = { anchor: 'docs/features/F163-memory-entropy-reduction.md', authority: 'constitutional', activation: undefined, keywords: ['F163'] };
    const fullCtx = { activeFeatureIds: ['F163'], truthSourceRef: 'docs/features/F163-memory-entropy-reduction.md', recentArtifactRefs: ['F163'] };
    const score = salience(perfectDoc, fullCtx);
    assert.ok(score <= 1.0, `expected <= 1.0, got ${score}`);
  });

  it('same doc gets different salience under different context (AC-F4)', () => {
    const doc = { anchor: 'docs/features/F088-chat-gateway.md', authority: 'validated', keywords: ['F088'] };
    const ctxA = { activeFeatureIds: ['F088'], truthSourceRef: null, recentArtifactRefs: [] };
    const ctxB = { activeFeatureIds: ['F163'], truthSourceRef: null, recentArtifactRefs: [] };
    const scoreA = salience(doc, ctxA);
    const scoreB = salience(doc, ctxB);
    assert.ok(scoreA > scoreB, `expected scoreA(${scoreA}) > scoreB(${scoreB})`);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/api && pnpm build && node --test test/memory/f163-types.test.js`
Expected: FAIL — `salience` is not exported from f163-types

### Step 3: Write implementation

Add to `packages/api/src/domains/memory/f163-types.ts`:

```typescript
export interface SalienceTaskContext {
  activeFeatureIds: string[];
  truthSourceRef: string | null;
  recentArtifactRefs: string[];
}

interface SalienceDoc {
  anchor: string;
  authority?: F163Authority;
  activation?: F163Activation;
  keywords?: string[];
}

/** Phase F: task-scoped salience — 0.0 (irrelevant) to 1.0 (fully relevant / exempt) */
export function salience(doc: SalienceDoc, ctx: SalienceTaskContext): number {
  if (doc.activation === 'always_on') return 1.0;
  const hasCtx =
    ctx.activeFeatureIds.length > 0 || ctx.truthSourceRef != null || ctx.recentArtifactRefs.length > 0;
  if (!hasCtx) return 1.0;

  let score = 0.3;
  const anchor = doc.anchor.toLowerCase();
  const kws = (doc.keywords ?? []).map((k) => k.toLowerCase());

  for (const fid of ctx.activeFeatureIds) {
    const f = fid.toLowerCase();
    if (anchor.includes(f) || kws.some((k) => k.includes(f))) {
      score += 0.4;
      break;
    }
  }

  if (ctx.truthSourceRef && anchor === ctx.truthSourceRef.toLowerCase()) {
    score += 0.25;
  }

  for (const ref of ctx.recentArtifactRefs) {
    if (anchor.includes(ref.toLowerCase())) {
      score += 0.15;
      break;
    }
  }

  if (doc.authority === 'constitutional' || doc.authority === 'validated') {
    score += 0.05;
  }

  return Math.min(score, 1.0);
}
```

### Step 4: Run test to verify green

Run: `cd packages/api && pnpm build && node --test test/memory/f163-types.test.js`
Expected: All salience tests PASS

### Step 5: Commit

```bash
git add packages/api/src/domains/memory/f163-types.ts packages/api/test/memory/f163-types.test.js
git commit -m "feat(F163-F): salience() pure function + tests — AC-F1, AC-F2, AC-F4 [宪宪/Opus-46🐾]"
```

---

## Task 2: `applySalienceRerank()` shared helper

**Files:**
- Modify: `packages/api/src/domains/memory/f163-types.ts`
- Modify: `packages/api/test/memory/f163-types.test.js`

### Step 1: Write failing tests

```javascript
import { applySalienceRerank } from '../../dist/domains/memory/f163-types.js';

describe('applySalienceRerank()', () => {
  const ctx = {
    activeFeatureIds: ['F163'],
    truthSourceRef: null,
    recentArtifactRefs: [],
  };

  it('preserves order when no task context (all scores 1.0)', () => {
    const items = [
      { anchor: 'docs/features/F088.md', authority: 'validated' },
      { anchor: 'docs/features/F042.md', authority: 'validated' },
    ];
    const emptyCtx = { activeFeatureIds: [], truthSourceRef: null, recentArtifactRefs: [] };
    const result = applySalienceRerank(items, emptyCtx);
    assert.deepEqual(result.items.map(i => i.anchor), ['docs/features/F088.md', 'docs/features/F042.md']);
    assert.deepEqual(result.scores, [1.0, 1.0]);
  });

  it('moves matching doc ahead of non-matching', () => {
    const items = [
      { anchor: 'docs/features/F088-chat-gateway.md', authority: 'validated', keywords: ['F088'] },
      { anchor: 'docs/features/F163-memory-entropy.md', authority: 'validated', keywords: ['F163'] },
    ];
    const result = applySalienceRerank(items, ctx);
    assert.equal(result.items[0].anchor, 'docs/features/F163-memory-entropy.md');
  });

  it('always_on docs stay at top regardless of context', () => {
    const items = [
      { anchor: 'docs/SOP.md', activation: 'always_on', authority: 'constitutional' },
      { anchor: 'docs/features/F088.md', authority: 'validated', keywords: ['F088'] },
    ];
    const result = applySalienceRerank(items, ctx);
    assert.equal(result.items[0].anchor, 'docs/SOP.md');
    assert.equal(result.scores[0], 1.0);
  });

  it('stable sort: equal scores preserve original order', () => {
    const items = [
      { anchor: 'docs/a.md', authority: 'observed' },
      { anchor: 'docs/b.md', authority: 'observed' },
    ];
    const result = applySalienceRerank(items, ctx);
    assert.deepEqual(result.items.map(i => i.anchor), ['docs/a.md', 'docs/b.md']);
  });

  it('returns scores array matching reranked order', () => {
    const items = [
      { anchor: 'docs/features/F088.md', authority: 'validated', keywords: ['F088'] },
      { anchor: 'docs/features/F163.md', authority: 'validated', keywords: ['F163'] },
    ];
    const result = applySalienceRerank(items, ctx);
    assert.equal(result.scores.length, 2);
    assert.ok(result.scores[0] >= result.scores[1]);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/api && pnpm build && node --test test/memory/f163-types.test.js`
Expected: FAIL — `applySalienceRerank` is not exported

### Step 3: Write implementation

Add to `packages/api/src/domains/memory/f163-types.ts`:

```typescript
/** Phase F: rerank items by salience score. Stable sort — equal scores preserve input order. */
export function applySalienceRerank<T extends SalienceDoc>(
  items: T[],
  ctx: SalienceTaskContext,
): { items: T[]; scores: number[] } {
  const indexed = items.map((item, i) => ({ item, score: salience(item, ctx), i }));
  indexed.sort((a, b) => b.score - a.score || a.i - b.i);
  return {
    items: indexed.map((e) => e.item),
    scores: indexed.map((e) => e.score),
  };
}
```

### Step 4: Run test to verify green

Run: `cd packages/api && pnpm build && node --test test/memory/f163-types.test.js`
Expected: All tests PASS

### Step 5: Commit

```bash
git add packages/api/src/domains/memory/f163-types.ts packages/api/test/memory/f163-types.test.js
git commit -m "feat(F163-F): applySalienceRerank() shared helper [宪宪/Opus-46🐾]"
```

---

## Task 3: Shadow logging extension

**Files:**
- Modify: `packages/api/src/domains/memory/f163-experiment-logger.ts`
- Create: `packages/api/test/memory/f163-experiment-logger.test.js`

### Step 1: Write failing test

```javascript
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import Database from 'better-sqlite3';
import { F163ExperimentLogger } from '../../dist/domains/memory/f163-experiment-logger.js';

describe('F163ExperimentLogger.logSalienceRerank()', () => {
  let db;
  let logger;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE f163_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_type TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      effective_flags TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    logger = new F163ExperimentLogger(db);
  });

  it('records salience_rerank log type with before/after diff', () => {
    const flags = {
      authorityBoost: 'off', alwaysOnInjection: 'off', retrievalRerank: 'shadow',
      compression: 'off', promotionGate: 'off', contradictionDetection: 'off', reviewQueue: 'off',
    };
    const payload = {
      query: 'F102 memory',
      resultCount: 3,
      salienceRerank: {
        taskContext: { activeFeatureIds: ['F163'], truthSourceRef: null, recentArtifactRefs: [] },
        before: ['anchor-a', 'anchor-b', 'anchor-c'],
        after: ['anchor-b', 'anchor-a', 'anchor-c'],
        scores: [0.95, 0.35, 0.3],
      },
    };
    logger.logSalienceRerank('test-variant', flags, payload);

    const row = db.prepare('SELECT * FROM f163_logs WHERE log_type = ?').get('salience_rerank');
    assert.ok(row, 'should have inserted a row');
    const parsed = JSON.parse(row.payload);
    assert.equal(parsed.query, 'F102 memory');
    assert.deepEqual(parsed.salienceRerank.before, ['anchor-a', 'anchor-b', 'anchor-c']);
    assert.deepEqual(parsed.salienceRerank.after, ['anchor-b', 'anchor-a', 'anchor-c']);
    assert.deepEqual(parsed.salienceRerank.scores, [0.95, 0.35, 0.3]);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd packages/api && pnpm build && node --test test/memory/f163-experiment-logger.test.js`
Expected: FAIL — `logSalienceRerank` is not a function

### Step 3: Write implementation

Add to `packages/api/src/domains/memory/f163-experiment-logger.ts`:

```typescript
logSalienceRerank(variantId: string, flags: F163FlagSnapshot, payload: Record<string, unknown>): void {
  this.db
    .prepare(
      'INSERT INTO f163_logs (log_type, variant_id, effective_flags, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run('salience_rerank', variantId, JSON.stringify(flags), JSON.stringify(payload), new Date().toISOString());
}
```

### Step 4: Run test to verify green

Run: `cd packages/api && pnpm build && node --test test/memory/f163-experiment-logger.test.js`
Expected: PASS

### Step 5: Commit

```bash
git add packages/api/src/domains/memory/f163-experiment-logger.ts packages/api/test/memory/f163-experiment-logger.test.js
git commit -m "feat(F163-F): shadow logging for salience rerank before/after diff — AC-F6 [宪宪/Opus-46🐾]"
```

---

## Task 4: Wire salience rerank into evidence.ts search route

**Files:**
- Modify: `packages/api/src/routes/evidence.ts:16-27` (searchSchema)
- Modify: `packages/api/src/routes/evidence.ts:90-94` (boostSource)
- Modify: `packages/api/src/routes/evidence.ts:109-140` (between items and rankToConfidence + logging)

### Step 1: Add task context params to searchSchema

At `evidence.ts:16-27`, add three optional params:

```typescript
const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  scope: z.enum(['docs', 'memory', 'threads', 'sessions', 'all']).optional(),
  mode: z.enum(['lexical', 'semantic', 'hybrid']).optional(),
  depth: z.enum(['summary', 'raw']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  contextWindow: z.coerce.number().int().min(1).max(5).optional(),
  threadId: z.string().optional(),
  dimension: z.enum(['project', 'global', 'all']).optional(),
  // Phase F: task context for salience gating (optional — no-op when absent)
  activeFeatureIds: z.string().optional(),
  truthSourceRef: z.string().optional(),
  recentArtifactRefs: z.string().optional(),
});
```

### Step 2: Assemble SalienceTaskContext + add import

At top of evidence.ts, add import:
```typescript
import { ..., applySalienceRerank, type SalienceTaskContext } from '../domains/memory/f163-types.js';
```

After destructuring parseResult.data (line 77), add:
```typescript
const { ..., activeFeatureIds: rawFeatureIds, truthSourceRef, recentArtifactRefs: rawArtifactRefs } = parseResult.data;
```

### Step 3: Apply salience rerank between items and rankToConfidence

Replace `evidence.ts:113-123` (the `results` mapping) with:

```typescript
// Phase F: assemble task context (no-op when absent)
const salienceCtx: SalienceTaskContext = {
  activeFeatureIds: rawFeatureIds ? rawFeatureIds.split(',').map((s) => s.trim()).filter(Boolean) : [],
  truthSourceRef: truthSourceRef ?? null,
  recentArtifactRefs: rawArtifactRefs ? rawArtifactRefs.split(',').map((s) => s.trim()).filter(Boolean) : [],
};

// Phase F: salience rerank (between static boost and confidence derivation)
const reranked =
  f163Flags.retrievalRerank !== 'off'
    ? applySalienceRerank(items, salienceCtx)
    : { items, scores: items.map(() => 1.0) };

const salienceBoostSource: BoostSource[] =
  f163Flags.retrievalRerank !== 'off'
    ? [...boostSource, 'retrieval_rerank']
    : boostSource;

const results: EvidenceResult[] = reranked.items.map((item, index) => ({
  title: item.title,
  anchor: item.anchor,
  snippet: item.summary ?? '',
  confidence: rankToConfidence(index),
  sourceType: mapKindToSourceType(item.kind),
  boostSource: salienceBoostSource,
  ...(item.authority ? { authority: item.authority } : {}),
  ...(singleSource ? { source: singleSource } : {}),
  ...(item.passages ? { passages: item.passages } : {}),
}));
```

### Step 4: Extend shadow logging payload

Replace `evidence.ts:133-139` (the logging block) with:

```typescript
if (anyF163Active && db) {
  try {
    const logger = new F163ExperimentLogger(db);
    // Base search log
    logger.logSearch(variantId, f163Flags, { query: q, resultCount: results.length });
    // Phase F: salience rerank shadow diff (AC-F6)
    if (f163Flags.retrievalRerank !== 'off') {
      logger.logSalienceRerank(variantId, f163Flags, {
        query: q,
        resultCount: results.length,
        salienceRerank: {
          taskContext: salienceCtx,
          before: items.map((i) => i.anchor),
          after: reranked.items.map((i) => i.anchor),
          scores: reranked.scores,
        },
      });
    }
  } catch {
    /* fail-open: logging failure does not block search */
  }
}
```

### Step 5: Build + run full test suite

Run: `cd packages/api && pnpm build && pnpm test`
Expected: All tests PASS, no regressions

### Step 6: Commit

```bash
git add packages/api/src/routes/evidence.ts
git commit -m "feat(F163-F): wire salience rerank into search route — AC-F3, AC-F6 [宪宪/Opus-46🐾]"
```

---

## Task 5: Gold set NDCG@10 validation (AC-F5)

**Files:**
- Create: `packages/api/test/memory/f163-salience-ndcg.test.js`

### Step 1: Write NDCG@10 comparison test

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rankToConfidence, applySalienceRerank } from '../../dist/domains/memory/f163-types.js';

// Gold set: known-relevant docs for a given task context
const goldRelevant = new Set([
  'docs/features/F163-memory-entropy-reduction.md',
  'docs/decisions/ADR-009.md',
  'docs/discussions/2026-04-15-harness-engineering.md',
]);

const simulatedResults = [
  { anchor: 'docs/features/F088-chat-gateway.md', authority: 'validated', keywords: ['F088'] },
  { anchor: 'docs/features/F163-memory-entropy-reduction.md', authority: 'validated', keywords: ['F163'] },
  { anchor: 'docs/decisions/ADR-009.md', authority: 'validated', keywords: ['ADR-009'] },
  { anchor: 'docs/features/F042-info-arch.md', authority: 'validated', keywords: ['F042'] },
  { anchor: 'docs/discussions/2026-04-15-harness-engineering.md', authority: 'candidate', keywords: ['harness'] },
  { anchor: 'docs/SOP.md', activation: 'always_on', authority: 'constitutional', keywords: [] },
  { anchor: 'docs/features/F101-hub.md', authority: 'validated', keywords: ['F101'] },
  { anchor: 'docs/lessons-learned.md', activation: 'always_on', authority: 'constitutional', keywords: [] },
  { anchor: 'docs/features/F124-apple.md', authority: 'validated', keywords: ['F124'] },
  { anchor: 'docs/research/karpathy.md', authority: 'candidate', keywords: ['karpathy'] },
];

function ndcgAt10(rankedAnchors, relevant) {
  const dcg = rankedAnchors.slice(0, 10).reduce((sum, anchor, i) => {
    const rel = relevant.has(anchor) ? 1 : 0;
    return sum + rel / Math.log2(i + 2);
  }, 0);
  const idealOrder = rankedAnchors.slice().sort((a, b) => (relevant.has(b) ? 1 : 0) - (relevant.has(a) ? 1 : 0));
  const idcg = idealOrder.slice(0, 10).reduce((sum, anchor, i) => {
    const rel = relevant.has(anchor) ? 1 : 0;
    return sum + rel / Math.log2(i + 2);
  }, 0);
  return idcg === 0 ? 1.0 : dcg / idcg;
}

describe('NDCG@10 regression (AC-F5)', () => {
  const ctx = {
    activeFeatureIds: ['F163'],
    truthSourceRef: 'docs/features/F163-memory-entropy-reduction.md',
    recentArtifactRefs: ['docs/decisions/ADR-009.md'],
  };

  it('salience rerank NDCG@10 >= Phase E baseline', () => {
    const baselineAnchors = simulatedResults.map((r) => r.anchor);
    const baselineNDCG = ndcgAt10(baselineAnchors, goldRelevant);

    const reranked = applySalienceRerank(simulatedResults, ctx);
    const rerankedAnchors = reranked.items.map((r) => r.anchor);
    const rerankedNDCG = ndcgAt10(rerankedAnchors, goldRelevant);

    assert.ok(
      rerankedNDCG >= baselineNDCG,
      `NDCG regression: baseline=${baselineNDCG.toFixed(4)}, reranked=${rerankedNDCG.toFixed(4)}`,
    );
  });

  it('salience rerank does not remove any results (recall preserved)', () => {
    const reranked = applySalienceRerank(simulatedResults, ctx);
    assert.equal(reranked.items.length, simulatedResults.length);
    for (const original of simulatedResults) {
      assert.ok(
        reranked.items.some((r) => r.anchor === original.anchor),
        `missing: ${original.anchor}`,
      );
    }
  });
});
```

### Step 2: Run test

Run: `cd packages/api && pnpm build && node --test test/memory/f163-salience-ndcg.test.js`
Expected: PASS — reranked NDCG@10 ≥ baseline

### Step 3: Commit

```bash
git add packages/api/test/memory/f163-salience-ndcg.test.js
git commit -m "test(F163-F): gold set NDCG@10 regression guard — AC-F5 [宪宪/Opus-46🐾]"
```

---

## Task 6: Full gate + cleanup

### Step 1: Full test suite + lint + build

```bash
pnpm test
pnpm lint
pnpm check
pnpm -r --if-present run build
```

### Step 2: Fix any lint/format issues

```bash
pnpm check:fix   # auto-fix biome issues
```

### Step 3: Final commit if needed

```bash
git commit -m "chore(F163-F): lint/format cleanup [宪宪/Opus-46🐾]"
```

---

## Scoring Rationale

| Signal | Weight | Why |
|--------|--------|-----|
| `activation === 'always_on'` | → 1.0 (exempt) | KD-7 + ADR-009: P0 rules never demoted |
| Empty context | → 1.0 (no-op) | Graceful degradation when caller has no context |
| Baseline (unrelated doc) | 0.30 | Low but non-zero: soft demotion, not removal |
| Feature ID match (anchor or keywords) | +0.40 | Strongest deterministic signal |
| Truth source exact match | +0.25 | Cat should focus on this doc |
| Recent artifact match | +0.15 | Recently touched = probably relevant |
| Authority prior (constitutional/validated) | +0.05 | Weak prior — can't override task mismatch |
| **Cap** | 1.00 | `Math.min(sum, 1.0)` |

Design constraint: authority is deliberately weak (+0.05) so that a "high authority but off-topic" doc gets ~0.35, while an "observed authority but on-topic" doc gets ~0.70. This is the core insight from the Design Gate discussion.

---

## Pipeline Position (visual)

```
     基础检索/融合
          ↓
  static authority boost (Phase D)
          ↓
  ╔══════════════════════════╗
  ║  salience rerank (NEW)   ║  ← applySalienceRerank(items, ctx)
  ║  flag: retrievalRerank   ║
  ╚══════════════════════════╝
          ↓
  rankToConfidence(newIndex)  (Phase E)
          ↓
       response
```
