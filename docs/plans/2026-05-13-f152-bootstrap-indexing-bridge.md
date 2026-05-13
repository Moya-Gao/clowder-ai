---
feature_ids: [F152]
related_features: [F186, F188, F102]
topics: [memory, bootstrap, collection, indexing, pipeline-bridge]
doc_kind: plan
created: 2026-05-13
---

# F152 Bootstrap → Collection Pipeline Bridge

**Feature:** F152 — `docs/features/F152-expedition-memory.md`
**Goal:** Make `rebuildIndex` callback actually index external project knowledge via the F186 CollectionIndexBuilder pipeline, instead of only generating a structural summary.
**Acceptance Criteria:** External project bootstrap produces real `evidence_docs` records in a collection store, searchable via existing memory tools.
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** Bridges two existing subsystems (F152 bootstrap + F186 collection pipeline) — no new Store/Queue/Router/Adapter.
**前端验证:** No — pure backend fix.

---

## Context

Issue: clowder-ai#693. F152 Phase B's `rebuildIndex` callback calls `buildStructuralSummary()` only — generates directory metadata but writes zero `evidence_docs`. F186's CollectionIndexBuilder has the full pipeline but is only exposed via REST API, not wired into bootstrap.

## Tasks

### Task 1: Bridge rebuildIndex → CollectionIndexBuilder

**Files:**
- Modify: `packages/api/src/index.ts:641-647`
- Create: `packages/api/src/domains/memory/bootstrap-collection-bridge.ts`
- Test: `packages/api/test/memory/bootstrap-collection-bridge.test.js`

Extract a `ensureProjectCollection(projectPath, catalog, stores, dataDir)` function that:
1. Derives collection ID: `project:{sanitized-basename}`
2. Creates `CollectionManifest` if not registered (kind=project, scannerLevel=auto, sensitivity=private, authorityCeiling=candidate)
3. Creates/opens `SqliteEvidenceStore` at `~/.cat-cafe/library/project-{name}/evidence.sqlite`
4. Persists manifest via `saveExternalCollection(dataDir, manifest)`
5. Registers in runtime catalog + stores map
6. Calls `resolveCollectionScanner(manifest)` → `CollectionIndexBuilder.rebuild()`
7. Returns `{ docsIndexed, durationMs }`

Replace stub `rebuildIndex` in `index.ts` with call to this function.

### Task 2: Fix library.ts rebuild route force passthrough

**Files:**
- Modify: `packages/api/src/routes/library.ts:208`
- Test: `packages/api/test/memory/library-graph-query-route.test.js` (add force test)

Pass `force` from request body to `builder.rebuild({ force })`.

### Task 3: Harden FlatScanner SKIP_DIRS

**Files:**
- Modify: `packages/api/src/domains/memory/FlatScanner.ts:7-23`
- Test: existing FlatScanner tests

Add common non-documentation directories to SKIP_DIRS: `src`, `lib`, `packages`, `workspace`, `.worktrees`, `.vscode`, `.idea`, `coverage`, `.cache`, `.turbo`, `tmp`, `.tmp`, `.output`, `venv`, `.venv`, `env`, `.env`.

### Task 4: Improve detectScannerLevel

**Files:**
- Modify: `packages/api/src/domains/memory/scanner-resolver.ts:17-39`
- Test: `packages/api/test/memory/scanner-resolver.test.js`

Add docs/ subdirectory check: if `docs/` exists and contains ≥3 markdown files → return 1 (even if root .md files lack frontmatter).
