---
feature_ids: [F209]
related_features: [F102, F188, F200]
topics: [memory, evidence-recall, passage-vector, raw-search, implementation-plan]
doc_kind: plan
created: 2026-05-22
---

# F209 Phase A Passage Recall Implementation Plan

**Feature:** F209 — `docs/features/F209-evidence-recall-optimization.md`
**Goal:** Make `search_evidence(depth=raw)` support lexical, semantic, and hybrid passage-level retrieval with explicit fail-open degradation.
**Acceptance Criteria:** AC-A1 through AC-A6 from F209 Phase A.
**Architecture cell:** memory
**Map delta:** done
**Map delta why:** `docs/architecture/ownership/cells/memory.md` and `identity-session.md` now record F209 retrieval-anchor ownership and the roster-truth boundary.
**Architecture:** Add passage-level vectors beside existing passage FTS, keep raw results anchored to original passages, and route semantic/hybrid raw search through passage NN / RRF instead of document vectors. Degradation stays explicit at the API/MCP envelope when passage embeddings are unavailable.
**Tech Stack:** SQLite FTS5, sqlite-vec vec0, `better-sqlite3`, existing `IEmbeddingService`, `search_evidence` API/MCP.
**前端验证:** No.

---

## Finish Line

Phase A is done when raw retrieval has three real legs:

- `depth=raw&mode=lexical` uses `passage_fts` BM25.
- `depth=raw&mode=semantic` uses passage-level NN and can find a message that does not contain the query's literal tokens.
- `depth=raw&mode=hybrid` fuses passage BM25 and passage NN with RRF, returning anchored passage windows.

Not building in Phase A: entity registry, Perspective UI/runtime, typed reader tools beyond the existing passage context window, summary memory, or F200's golden-set runner.

## Terminal Schema

- `passage_vectors` vec0 table:
  - `passage_key TEXT PRIMARY KEY`
  - `embedding float[dim]`
- `passage_key = JSON.stringify([doc_anchor, passage_id])`; parsing is centralized so callers never split ad hoc strings.
- `EmbedDeps` gains `passageVectorStore`.
- `EvidenceItem.passages[]` keeps `passageId`, `speaker`, `createdAt`, `context`; adds optional parsed anchors:
  - `docAnchor?: string`
  - `threadId?: string`
  - `messageId?: string`
- Raw search metadata:
  - `degraded: boolean`
  - `degradeReason?: 'passage_embedding_unavailable' | 'passage_vector_search_error' | 'evidence_store_error'`
  - `effectiveMode?: 'lexical' | 'semantic' | 'hybrid'`

## Task 1: Passage Vector Storage

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts`
- Create: `packages/api/src/domains/memory/PassageVectorStore.ts`
- Test: `packages/api/test/memory/passage-vector-store.test.js`

**Step 1: Write failing storage tests**

Cover:
- `ensurePassageVectorTable(db, dim)` creates a separate vec0 table.
- `passageVectorKey()` round-trips arbitrary `doc_anchor` and `passage_id`.
- `PassageVectorStore.upsert/search/delete/count/clearAll` works without touching `evidence_vectors`.

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/memory/passage-vector-store.test.js
```

Expected first run: FAIL because the table/helper/class do not exist.

**Step 2: Implement storage**

Add:
- `ensurePassageVectorTable(db, dim)` next to `ensureVectorTable`.
- `PassageVectorStore` mirroring `VectorStore`, but using `passage_vectors`.
- `passageVectorKey(docAnchor, passageId)` and `parsePassageVectorKey(key)`.

Do not overload `evidence_vectors`; document-level vector hydration and passage-level vector hydration have different targets.

**Step 3: Verify storage**

Run the same test and `pnpm --filter @cat-cafe/api run lint`.

## Task 2: Passage Embedding Index Path

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts`
- Modify: `packages/api/src/domains/memory/factory.ts`
- Modify: `packages/api/src/domains/memory/embed-utils.ts`
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts`
- Test: `packages/api/test/memory/passage-embedding-index.test.js`

**Step 1: Write failing indexing tests**

Cover:
- New thread messages inserted into `evidence_passages` also get passage vectors when embedding is ready.
- Existing `evidence_passages` rows missing vectors are backfilled during rebuild.
- Embedding failure leaves lexical passage indexing intact.
- Model metadata mismatch clears and rebuilds both document and passage vector stores.

Expected first run: FAIL because `EmbedDeps` has no `passageVectorStore` and passages are not embedded.

**Step 2: Implement embedding utilities**

Add an `embedPassages()` utility that:
- reads rows from `evidence_passages` missing a `passage_vectors` entry,
- embeds `content` in batches using the existing `IEmbeddingService`,
- writes vectors by `passageVectorKey(doc_anchor, passage_id)`,
- shares the existing embedding model metadata check.

Keep existing `INSERT OR IGNORE` passage persistence; Phase A should not rewrite passage lifecycle semantics.

**Step 3: Wire factory and indexer**

In `factory.ts`, after sqlite-vec load:
- call both `ensureVectorTable()` and `ensurePassageVectorTable()`,
- construct `VectorStore` and `PassageVectorStore`,
- pass both through `EmbedDeps`.

In `IndexBuilder.ts`:
- after dirty-thread `indexPassages()`, embed new/missing passage rows if ready;
- after transcript backfill, embed missing transcript passages;
- during full rebuild embedding, backfill all missing passage vectors.

**Step 4: Verify indexing**

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/memory/passage-embedding-index.test.js
```

## Task 3: Raw Semantic and Hybrid Search

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Modify: `packages/api/src/domains/memory/interfaces.ts`
- Test: `packages/api/test/memory/raw-passage-semantic.test.js`
- Test: `packages/api/test/memory/raw-passage-ranking.test.js`

**Step 1: Write failing raw-search tests**

Cover:
- `depth=raw&mode=semantic` finds a passage via vector similarity when literal query tokens are absent.
- `depth=raw&mode=hybrid` returns both lexical-only and semantic-only passage hits, ordered by RRF.
- `threadId`, `dateFrom/dateTo`, `contextWindow`, and `limit` still apply.
- Raw results include passage id, speaker, timestamp, context, `docAnchor`, and parsed `threadId/messageId` when derivable.

Expected first run: FAIL because raw mode short-circuits before semantic/hybrid mode split.

**Step 2: Refactor raw retrieval**

Replace the raw short-circuit with mode-specific passage retrieval:
- lexical: existing `searchPassages()`.
- semantic: `semanticPassageNNSearch()` over `passage_vectors`.
- hybrid: `hybridPassageRRFSearch()` using `passage_fts` ranks + passage NN ranks, with the existing RRF `k=60` and CJK NN weighting.

Extract one hydrator:

```ts
hydratePassageResults(passages, options): EvidenceItem[]
```

It groups by `doc_anchor`, hydrates parent `evidence_docs`, attaches passage windows, and preserves passage-bearing ranking before doc-only results.

**Step 3: Keep document search unchanged**

Document summary search continues to use `evidence_vectors`; raw passage search uses `passage_vectors`. Do not route raw semantic to `semanticNNSearch()` because that hydrates `evidence_docs` and cannot return message-level anchors.

**Step 4: Verify raw retrieval**

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/memory/raw-passage-semantic.test.js packages/api/test/memory/raw-passage-ranking.test.js
```

## Task 4: Degraded / Effective Mode Contract

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts`
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Modify: `packages/api/src/routes/evidence.ts`
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts`
- Test: `packages/api/test/evidence-route.test.js`
- Test: `packages/api/test/memory/evidence-route-di.test.js`

**Step 1: Write failing route tests**

Replace the current `raw_lexical_only` expectation:
- raw semantic/hybrid with passage vectors ready => `degraded=false`, `effectiveMode` omitted or equal to requested mode only if route already emits it consistently.
- raw semantic/hybrid with embedding/vector unavailable => `degraded=true`, `degradeReason='passage_embedding_unavailable'`, `effectiveMode='lexical'`, lexical results still returned.
- raw semantic/hybrid vector search throw => `degraded=true`, `degradeReason='passage_vector_search_error'`, `effectiveMode='lexical'`.

Expected first run: FAIL because `evidence.ts` still computes `isRawDegraded = depth === 'raw' && requestedMode !== 'lexical'`.

**Step 2: Add execution metadata**

Add a backward-compatible store contract:

```ts
interface EvidenceSearchExecution {
  items: EvidenceItem[];
  meta: SearchExecutionMeta;
}

searchWithMeta?(query: string, options?: SearchOptions): Promise<EvidenceSearchExecution>;
```

`SqliteEvidenceStore.search()` remains for existing callers; it delegates to `searchWithMeta().items`.

**Step 3: Update API/MCP envelope**

In `evidence.ts`, prefer `searchWithMeta()` when available and use its `meta` for `degraded/degradeReason/effectiveMode`. Keep `evidence_store_error` behavior unchanged.

In `evidence-tools.ts`, keep the existing degraded banner path; only update reason text so raw semantic/hybrid no longer always displays a degradation banner.

**Step 4: Verify route contract**

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/evidence-route.test.js packages/api/test/memory/evidence-route-di.test.js
pnpm --filter @cat-cafe/mcp-server run build
```

## Task 5: F200 Regression Fixtures

**Files:**
- Create: `docs/eval/f209-phase-a-raw-retrieval-fixtures.md`
- Modify: `docs/features/F209-evidence-recall-optimization.md`

**Step 1: Add two fixtures**

Fixture minimum:
- query, scope, mode, depth, expected anchor pattern, expected drill-down behavior.

Required fixtures:
- raw semantic finds a message whose text does not contain the literal query token.
- raw hybrid preserves a lexical hit and a semantic-only hit, both with passage anchors and context windows.

**Step 2: Link fixture from F209**

Add the fixture doc under Phase E / Eval tracking links without marking Phase A complete.

## Task 6: Quality Gate for Phase A Plan → Implementation

Run before asking for implementation review:

```bash
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/mcp-server run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test \
  packages/api/test/memory/passage-vector-store.test.js \
  packages/api/test/memory/passage-embedding-index.test.js \
  packages/api/test/memory/raw-passage-semantic.test.js \
  packages/api/test/memory/raw-passage-ranking.test.js \
  packages/api/test/evidence-route.test.js \
  packages/api/test/memory/evidence-route-di.test.js
pnpm check:architecture-ownership
pnpm check:features
```

Expected:
- targeted tests PASS;
- architecture ownership check exits 0, with any unrelated pre-existing warnings called out;
- feature truth check PASS.

## Technical Open Questions

- Whether vec0 permits useful metadata columns beyond the key; default plan does not depend on it.
- Whether `KnowledgeResolver.resolve()` should propagate `SearchExecutionMeta` in Phase A or route should bypass resolver meta for project raw search first. Implementation should keep API truth explicit; if resolver cannot propagate meta cleanly, make that a small internal adapter task before route changes.
- Whether old `evidence-route.test.js` mock stores should implement `searchWithMeta()` or keep exercising the legacy `search()` fallback. Prefer one test for each path.

## Value Open Questions

None. CVO already decided Phase A must be the full BM25 / embedding / RRF raw retrieval slice, with explicit degraded/effectiveMode.
