# F186 Phase E: Collection-aware Query Replay

**Feature:** F186 — `docs/features/F186-library-memory-architecture.md`
**Goal:** Extend query capture with collection routing metadata and add replay comparison endpoint
**Acceptance Criteria:**
- AC-E1: Query capture 包含 scope/dimension/collections/topK per collection 字段
- AC-E2: Replay 按 collection 分别对比 + 跨域聚合对比
**Architecture:** Extend existing F163 logSearch payload in evidence.ts with routing metadata (scope/dimension/collections/topKPerCollection). Add QueryReplayCompare module + POST endpoint that re-executes a captured query and returns per-collection diff + aggregated Jaccard overlap.
**Tech Stack:** SQLite (f163_logs), Fastify, node:test
**前端验证:** No — pure backend/API

---

## Terminal Schema

```typescript
// Extended capture payload (AC-E1)
interface QueryCapturePayload {
  query: string;
  resultCount: number;
  scope?: string;
  dimension?: string;
  collections?: string[];
  topKPerCollection: Record<string, number>; // collectionId → hit count
}

// Replay comparison result (AC-E2)
interface QueryReplayResult {
  captureId: number;
  capturedAt: string;
  query: string;
  params: { scope?: string; dimension?: string; collections?: string[] };
  perCollection: Array<{
    collectionId: string;
    captured: number;
    replayed: number;
    overlap: string[];    // anchors in both
    added: string[];      // new in replay
    removed: string[];    // gone from replay
  }>;
  aggregated: {
    capturedAnchors: string[];
    replayedAnchors: string[];
    jaccardSimilarity: number;  // |intersection| / |union|
  };
}
```

## What We're NOT Building

- No UI for replay (CLI/API only)
- No automated scheduling of replays
- No diff persistence (ephemeral comparison, not stored)
- No replay of salience_rerank captures (only `search` log_type)

---

### Task 1: Extend Query Capture Payload (AC-E1)

**Files:**
- Modify: `packages/api/src/routes/evidence.ts:186`
- Test: `packages/api/test/memory/query-capture-collection.test.js`

**Step 1: Write failing test**

```javascript
it('capture includes scope/dimension/collections/topKPerCollection', async () => {
  // Set up a mock store with getDb that reads f163_logs
  // Call search with dimension='library', collections='world:lexander'
  // Assert payload in f163_logs row includes all routing fields
});
```

**Step 2: Run test — expect FAIL**

Run: `pnpm --filter @cat-cafe/api exec node --test test/memory/query-capture-collection.test.js`
Expected: FAIL (payload missing routing fields)

**Step 3: Extend logSearch call in evidence.ts**

Change line 186 from:
```typescript
logger.logSearch(variantId, f163Flags, { query: q, resultCount: results.length });
```
To:
```typescript
logger.logSearch(variantId, f163Flags, {
  query: q,
  resultCount: results.length,
  scope,
  dimension,
  collections: parsedCollections,
  topKPerCollection: Object.fromEntries(
    (resolveResult?.collectionGroups ?? []).map((g) => [g.collectionId, g.items.length]),
  ),
});
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F186): extend query capture with collection routing metadata (AC-E1)"
```

---

### Task 2: QueryReplayCompare Module (AC-E2)

**Files:**
- Create: `packages/api/src/domains/memory/QueryReplayCompare.ts`
- Test: `packages/api/test/memory/query-replay-compare.test.js`

**Step 1: Write failing test**

```javascript
it('replays captured query and returns per-collection diff', async () => {
  // Insert a mock f163_logs row with known payload
  // Call QueryReplayCompare.replay(captureId, resolver)
  // Assert perCollection shows overlap/added/removed
  // Assert aggregated.jaccardSimilarity is correct
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement QueryReplayCompare**

```typescript
export class QueryReplayCompare {
  constructor(private db: Database.Database) {}

  async replay(captureId: number, resolver: IKnowledgeResolver): Promise<QueryReplayResult> {
    const row = this.db.prepare('SELECT * FROM f163_logs WHERE id = ? AND log_type = ?').get(captureId, 'search');
    if (!row) throw new Error(`Capture ${captureId} not found`);
    const payload = JSON.parse(row.payload);
    const { query, scope, dimension, collections, topKPerCollection } = payload;

    // Re-execute with same params
    const result = await resolver.resolve(query, { scope, dimension, collections });

    // Per-collection comparison
    const perCollection = (result.collectionGroups ?? []).map((g) => {
      const capturedCount = topKPerCollection?.[g.collectionId] ?? 0;
      const replayedAnchors = g.items.map((i) => i.anchor);
      // We don't have old anchors in capture — only counts.
      // For full anchor comparison, need to also capture anchors.
      return { collectionId: g.collectionId, captured: capturedCount, replayed: replayedAnchors.length, ... };
    });

    // Aggregated Jaccard
    ...
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

---

### Task 2b: Capture Anchors for Replay Comparison

To enable meaningful per-collection diff, the capture must also store the result anchors (not just counts).

**Extend capture payload:**
```typescript
topKPerCollection: Object.fromEntries(
  (resolveResult?.collectionGroups ?? []).map((g) => [
    g.collectionId,
    { count: g.items.length, anchors: g.items.map((i) => i.anchor) },
  ]),
),
```

This gives replay the baseline to diff against.

---

### Task 3: Replay Route Endpoint

**Files:**
- Modify: `packages/api/src/routes/f163-audit-routes.ts` (add POST /api/f163/query-replay)
- Test: extend `test/memory/query-replay-compare.test.js`

**Step 1: Write failing test for endpoint**

**Step 2: Implement route**

```typescript
app.post('/api/f163/query-replay', async (request, reply) => {
  if (!isLocalhost(request.ip)) { reply.status(403); return { error: 'Forbidden' }; }
  const { captureId } = request.body as { captureId: number };
  const compare = new QueryReplayCompare(db);
  return compare.replay(captureId, opts.knowledgeResolver);
});
```

**Step 3: Run test — expect PASS**

**Step 4: Commit**

```bash
git commit -m "feat(F186): add /api/f163/query-replay endpoint (AC-E2)"
```

---

## Summary

| Task | AC | Files | Effort |
|------|-----|-------|--------|
| 1 | AC-E1 | evidence.ts (modify), test (create) | 10 min |
| 2 | AC-E2 | QueryReplayCompare.ts (create), test | 20 min |
| 2b | AC-E1+E2 | evidence.ts (extend anchors in payload) | 5 min |
| 3 | AC-E2 | f163-audit-routes.ts (modify), test | 15 min |
