---
feature_ids: [F163]
doc_kind: plan
created: 2026-04-16
phase: B
---

# F163 Phase B: Non-Replacement Compression + Source Backlinks — Implementation Plan

**Feature:** F163 — `docs/features/F163-memory-entropy-reduction.md`
**Goal:** Reduce memory entropy by generating canonical summaries that compress duplicate/related knowledge entries, while preserving originals as backstop — never delete, only rerank.
**Acceptance Criteria:**
- AC-B1: Tool/script scans LL and feedback memories, outputs "suspected duplicate/mergeable" suggestions
- AC-B2: Generate canonical summary layer, originals become `activation=backstop`, summary carries `source_ids[]` backlinks
- AC-B3: Retrieval prefers summaries, originals still reachable via backstop
- AC-B4: shared-rules completes one condensation round, ≥15% line reduction with `source_ids` traceability
- AC-B5: Cascade compression architecturally blocked (summary-of-summary cannot be created)
**Architecture:** Schema V14 adds `source_ids` + `summary_of_anchor` columns. A duplicate scanner uses TF-IDF similarity on existing evidence_docs. Compression runs through the single-writer queue with flag gating (`off | suggest | apply`). Backstop activation suppresses originals in normal retrieval but keeps them accessible at high-relevance thresholds.
**Tech Stack:** SQLite (evidence.sqlite), better-sqlite3, existing EvidenceWriteQueue, f163-types flag system
**前端验证:** No — pure backend/memory pipeline

---

## Terminal Schema (what exists after Phase B)

### New columns on `evidence_docs` (Schema V14)

```sql
ALTER TABLE evidence_docs ADD COLUMN source_ids TEXT;       -- JSON array of source anchors, e.g. '["LL-001","LL-003"]'
ALTER TABLE evidence_docs ADD COLUMN summary_of_anchor TEXT; -- if this doc IS a summary, points to a summary group ID
ALTER TABLE evidence_docs ADD COLUMN compression_rationale TEXT; -- why these sources were merged
```

### Key invariant

- A doc with `summary_of_anchor IS NOT NULL` is a canonical summary
- Its `source_ids` is a JSON array of the original anchors it covers
- Those originals get `activation = 'backstop'` (not deleted)
- A doc that already has `summary_of_anchor IS NOT NULL` CANNOT be used as a source for another summary (cascade block)

## What We're NOT Building

- No UI for browsing summaries (Phase C / future)
- No auto-apply compression (always `suggest` first, CVO confirms)
- No compression of threads/passages — only evidence_docs (LL, feedback, decisions)
- No real-time duplicate detection at write-time (that's Phase C contradiction detection)

## Tasks

### Task 1: Schema V14 — source_ids + summary columns

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts` — add V14 migration
- Modify: `packages/api/src/domains/memory/interfaces.ts` — extend EvidenceItem
- Test: `packages/api/test/memory/schema-v14-f163b.test.js`

**What:** Add three columns to evidence_docs: `source_ids TEXT`, `summary_of_anchor TEXT`, `compression_rationale TEXT`. Migration V14 applies these via ALTER TABLE. Update EvidenceItem interface to include new optional fields.

**Step 1:** Write test that opens a fresh DB, verifies V14 migration adds the columns and they accept data.

**Step 2:** Add V14 migration to `applyMigrations()` — three ALTER TABLE statements.

**Step 3:** Extend `EvidenceItem` interface with `sourceIds?: string[]`, `summaryOfAnchor?: string`, `compressionRationale?: string`.

**Step 4:** Run tests, verify green. Commit.

---

### Task 2: Cascade compression guard (AC-B5)

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` — guard in upsert
- Test: `packages/api/test/memory/f163-cascade-guard.test.js`

**What:** When upserting a doc with `summaryOfAnchor` set (i.e., it's a summary), verify that none of its `sourceIds` point to docs that already have `summaryOfAnchor IS NOT NULL`. If any do, reject with an error — this is the cascade block.

**Step 1:** Write test: create doc A (original), create summary S1 covering A. Then attempt to create summary S2 covering S1 — must throw "cascade compression prohibited".

**Step 2:** In `SqliteEvidenceStore.upsert()`, add a pre-write check: if `item.summaryOfAnchor` is set, query source anchors for existing `summary_of_anchor`. Any hit → throw.

**Step 3:** Run tests, verify green. Commit.

---

### Task 3: Duplicate scanner — TF-IDF similarity on evidence_docs (AC-B1)

**Files:**
- Create: `packages/api/src/domains/memory/f163-duplicate-scanner.ts`
- Test: `packages/api/test/memory/f163-duplicate-scanner.test.js`

**What:** A scanner that reads all `kind IN ('lesson', 'decision', 'discussion')` docs from evidence_docs, computes pairwise TF-IDF cosine similarity on `title + summary`, and returns clusters of docs above a similarity threshold (default 0.6). Output: array of `{ anchors: string[], similarity: number, suggestedTitle: string }`.

**Step 1:** Write test: seed 5 docs (3 clearly similar about "Redis keyPrefix", 2 unrelated). Scanner should return 1 cluster of 3 docs with similarity > 0.6.

**Step 2:** Implement `DuplicateScanner` class:
- `scan(db, options?)` — reads docs, builds TF-IDF vectors (simple term-frequency / inverse-doc-frequency on whitespace-split tokens), computes cosine similarity matrix, extracts clusters via single-linkage above threshold.
- Returns `DuplicateSuggestion[]`.

**Step 3:** Run tests, verify green. Commit.

---

### Task 4: Compression suggestion API — POST /api/f163/compress/scan (AC-B1)

**Files:**
- Modify: `packages/api/src/routes/f163-admin.ts` — add scan endpoint
- Test: `packages/api/test/memory/f163-compression-api.test.js`

**What:** HTTP endpoint that runs the duplicate scanner and returns suggestions. Flag-gated: only runs when `freezeFlags().compression !== 'off'`. Localhost-only (same guard as promotion API).

**Step 1:** Write test: with `F163_COMPRESSION=suggest`, POST `/api/f163/compress/scan` returns suggestions array. With `F163_COMPRESSION=off`, returns 403.

**Step 2:** Add route to f163-admin.ts. Calls `DuplicateScanner.scan()`, returns results. Logs to f163_suggestions table via writeQueue.

**Step 3:** Run tests, verify green. Commit.

---

### Task 5: Compression apply — POST /api/f163/compress/apply (AC-B2)

**Files:**
- Modify: `packages/api/src/routes/f163-admin.ts` — add apply endpoint
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` — add `createSummary` method
- Test: `packages/api/test/memory/f163-compression-apply.test.js`

**What:** Given a suggestion (source anchors + summary text + rationale), create the canonical summary doc and demote originals to `activation=backstop`. Flag-gated: only when `compression === 'apply'`. All writes through writeQueue.

**Step 1:** Write test: create 3 original docs. Call apply with anchors + summary. Verify:
- New summary doc created with `summaryOfAnchor` set, `source_ids` = JSON array of 3 anchors, `authority = 'validated'`, `activation = 'query'`
- 3 originals now have `activation = 'backstop'`
- Summary doc's `kind` = same as originals (or 'lesson' if mixed)

**Step 2:** Add `createSummary(params)` to SqliteEvidenceStore:
- Validate no cascade (reuse Task 2 guard)
- INSERT summary doc via writeQueue
- UPDATE originals `SET activation = 'backstop'` via writeQueue
- Return summary anchor

**Step 3:** Add POST `/api/f163/compress/apply` route. Requires `compression === 'apply'`. Calls `store.createSummary()`.

**Step 4:** Run tests, verify green. Commit.

---

### Task 6: Retrieval backstop suppression (AC-B3)

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` — adjust search query
- Test: `packages/api/test/memory/f163-backstop-retrieval.test.js`

**What:** In `search()`, when F163 compression is active (`!= 'off'`), add `AND activation != 'backstop'` to the default query. Provide an option `includeBackstop: true` to override (for drill-down / expansion).

**Step 1:** Write test: create summary + 3 backstop originals. Normal search should return summary only. Search with `includeBackstop: true` should return all 4.

**Step 2:** Modify the FTS query in `search()` to filter backstop when compression flag is active.

**Step 3:** Add `includeBackstop` option to `SearchOptions` interface.

**Step 4:** Run tests, verify green. Commit.

---

### Task 7: Source expansion API — GET /api/f163/expand/:anchor (AC-B3)

**Files:**
- Modify: `packages/api/src/routes/f163-admin.ts` — add expand endpoint
- Test: `packages/api/test/memory/f163-expand.test.js`

**What:** Given a summary anchor, return its `source_ids` and the full original docs. This is the "expand to source" drill-down for non-replacement verification.

**Step 1:** Write test: create summary with 2 sources. GET `/api/f163/expand/{summaryAnchor}` returns `{ summary, sources: [doc1, doc2] }`.

**Step 2:** Add route. Read summary's `source_ids`, fetch each original by anchor, return together.

**Step 3:** Run tests, verify green. Commit.

---

### Task 8: Shared-rules condensation script (AC-B4)

**Files:**
- Create: `packages/api/scripts/f163-condense-shared-rules.ts`
- Test: `packages/api/test/memory/f163-condense-shared-rules.test.js`

**What:** A script that:
1. Reads `cat-cafe-skills/refs/shared-rules.md`
2. Identifies rule clusters (same-topic rules within proximity)
3. Outputs a condensed version with `source_ids` comments (e.g., `<!-- source: §3, §7, §12 -->`)
4. Reports line-count reduction percentage

The script produces a PROPOSAL file — it does NOT auto-apply. CVO reviews and applies manually.

**Step 1:** Write test: given a mock shared-rules with 6 redundant rules about "Redis safety", condensation should produce ≤5 rules covering the same ground, with source markers.

**Step 2:** Implement the script:
- Parse markdown sections by heading
- Group by keyword overlap (reuse TF-IDF from Task 3)
- For each cluster, generate a merged section with all unique constraints preserved
- Output to stdout or file, with diff stats

**Step 3:** Run on actual shared-rules.md, verify ≥15% reduction. Commit.

---

### Task 9: Experiment logger integration for compression

**Files:**
- Modify: `packages/api/src/domains/memory/f163-experiment-logger.ts` — add `logCompression` method
- Modify: `packages/api/src/routes/f163-admin.ts` — log compression actions
- Test: `packages/api/test/memory/f163-compression-logging.test.js`

**What:** Every scan and apply action logs to `f163_logs` with `log_type = 'compression_scan'` / `'compression_apply'`, carrying variant_id and effective_flags. This enables A/B comparison of compression strategies.

**Step 1:** Write test: call compress/scan and compress/apply, verify f163_logs entries exist with correct log_type and flags.

**Step 2:** Add `logCompression(variantId, flags, payload)` to F163ExperimentLogger.

**Step 3:** Wire into the scan and apply routes.

**Step 4:** Run tests, verify green. Commit.

---

### Task 10: Zero-behavior regression test (compression off = no side effects)

**Files:**
- Modify: `packages/api/test/f163-zero-behavior.test.js` — add compression-specific assertions
- Test: existing file

**What:** Extend the Phase A zero-behavior test to verify that with `F163_COMPRESSION=off`:
- Backstop suppression does NOT activate (all docs returned regardless of activation)
- Compression API returns 403
- No summary docs can be created through normal upsert path

**Step 1:** Add test cases to existing zero-behavior test file.

**Step 2:** Run tests, verify green. Commit.

---

## Dependency Graph

```
Task 1 (schema V14)
  ├→ Task 2 (cascade guard)
  ├→ Task 3 (duplicate scanner)
  │    └→ Task 4 (scan API)
  │         └→ Task 9 (logging)
  ├→ Task 5 (apply API) — depends on Task 2 + Task 3
  │    └→ Task 9 (logging)
  ├→ Task 6 (backstop suppression)
  │    └→ Task 7 (expand API)
  └→ Task 10 (zero-behavior)

Task 8 (shared-rules condensation) — independent, can run in parallel
```

## Execution Order

1. Task 1 → Task 2 → Task 3 → Task 4
2. Task 5 → Task 6 → Task 7
3. Task 8 (parallel with above)
4. Task 9 → Task 10

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| TF-IDF too noisy for Chinese+English mixed docs | Fallback: use existing FTS BM25 scores as similarity proxy |
| shared-rules condensation loses critical constraints | Script produces proposal only; CVO diff-reviews before apply |
| Backstop suppression breaks existing queries | Flag-gated; off = legacy behavior unchanged |
| Summary creation leaves orphan backstop docs | Cascade guard + source_ids backlinks ensure traceability |
