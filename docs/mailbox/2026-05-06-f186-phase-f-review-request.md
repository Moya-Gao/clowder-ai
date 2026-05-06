# Review Request: F186 Phase F — Memory Lens + Typed Graph

Review-Target-ID: f186
Branch: feat/f186-phase-f

## What

Phase F of F186 Library Memory Architecture: cross-collection typed graph + sensitivity-aware rendering + persistence-layer redaction.

Core changes (24 files, 1077 insertions):
1. **Edge schema V18 migration** — 5 new columns: `from_collection_id`, `to_collection_id`, `edge_sensitivity`, `provenance`, `created_at`
2. **RecallPersistenceRedactor** — strips private/restricted collection items to metadata-only placeholders (R7 closure)
3. **GraphResolver** — BFS subgraph builder aggregating per-collection edges, sensitivity filtering, cross-collection detection
4. **GET /api/library/graph** — localhost-only endpoint (anchor, depth, collections params)
5. **CollectionGraph viewer** — SVG radial layout in Memory Hub "Graph" tab, click-to-navigate, redacted nodes with lock badge
6. **OQ-3** — `dimension:all` deprecation warning
7. **OQ-4** — `promoted_from` edge type (schema + API, no UI)
8. **IndexBuilder** — collection-aware edge creation with `related_to` + `provenance: 'frontmatter'`

## Why

Phase F completes the "Typed Graph" vision from the GBrain deep-dive: anchor-to-anchor typed edges across collections, visualized in the Memory Hub. Also closes the R7 debt from Phase C (private collection content must not leak into FTS via thread transcripts).

Design Gate constraints (converged with 砚砚 2026-05-05):
1. Graph API at `/api/library/graph`, not parallel memory API
2. Edge storage with collection/sensitivity/provenance
3. Three-tier sensitivity gate: build-time classify + query-time filter + UI metadata-only
4. Catalog-aware RecallPersistenceRedactor (not anchor prefix matching)
5. `related` read-compat, new writes use `related_to`

## Original Requirements

> "你们得朝着图书馆发展……不只是 project，你们查询可以 recall 本 project 以外的知识。"
> — 铲屎官 2026-05-03

> GBrain 亮点："Typed Graph 可视关联 — typed link 不只排序，还让人浏览知识关系"
> — docs/features/F186-library-memory-architecture.md

- 来源: `docs/features/F186-library-memory-architecture.md` (spec) + `docs/discussions/2026-05-03-gbrain-deep-dive/library-architecture.md` (discussion)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- SVG radial layout over heavy graph library (d3-force etc.) — keeps bundle light, sufficient for depth-1/2 subgraphs
- GraphStore as narrow local interface rather than modifying IEvidenceStore — avoids coupling graph concerns into core memory interface
- `related` normalization via SQL CASE at read time rather than migration-time data rewrite — preserves existing data, zero-downtime

## Open Questions

1. **GraphResolver BFS depth limit** — clamped to 0-3 in the API. Is this sufficient or should we allow deeper traversal?
2. **CollectionGraph layout** — radial is simple but may not scale well beyond ~30 nodes. Phase G may need a force-directed alternative.
3. **Edge sensitivity inference** — currently `stricterSensitivity(from, to)`. Should we support edge-level overrides beyond what's stored?

## Pre-retraction: If I'm wrong, I'm most likely wrong about...

1. The `redactGroupsForPersistence` function only redacts title — it preserves anchor/kind/status. If the anchor itself is sensitive (contains PII), this could still leak.
2. The SVG graph viewer does client-side fetch to `/api/library/graph` without auth — the endpoint is localhost-only, but if the API is exposed via tunnel, this could be a vector.
3. The `related` → `related_to` SQL CASE normalization adds per-query overhead. If `getRelated` is called at high frequency, this could matter.

## Next Action

Please review for:
- Security: sensitivity gate correctness (three-tier, no bypass paths)
- Schema: V18 migration safety (ALTER TABLE ADD COLUMN with try/catch)
- API: graph endpoint contract shape
- UI: CollectionGraph rendering correctness (redacted vs non-redacted nodes)

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f186/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规

Quality-gate passed 2026-05-06:
- AC-F1 (Memory Lens cross-collection): GraphResolver + CollectionGraph ✅
- AC-F2 (Typed Evidence Graph): Extended edge schema + 7 relations ✅
- R7 closure: RecallPersistenceRedactor ✅
- OQ-3: dimension:all deprecation warning ✅
- OQ-4: promoted_from edge schema ✅
- Design Gate 5 constraints: all satisfied ✅
- Follow-up tail scan: clean ✅

### 测试结果

```
pnpm --filter @cat-cafe/api test       # 10179 passed, 0 failed
pnpm --filter @cat-cafe/web test       # 2815 passed, 0 failed
pnpm lint                              # 0 errors
pnpm check                             # 0 errors (biome)
pnpm -r --if-present run build         # Pre-existing SSR prerender (17 pages on main, +1 graph page same pattern)
```

### 相关文档

- Plan: `docs/plans/2026-05-05-f186-phase-f-memory-lens-typed-graph.md`
- Feature: `docs/features/F186-library-memory-architecture.md`
- Discussion: `docs/discussions/2026-05-03-gbrain-deep-dive/library-architecture.md`
