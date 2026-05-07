# F188 Phase C: Graph Fidelity — Implementation Plan

**Feature:** F188 — `docs/features/F188-library-stewardship.md`
**Goal:** Fix graph runtime bugs + add new edge sources + 美化 graph visualization, so the graph shows a connected, beautiful network instead of isolated nodes.
**Acceptance Criteria:** AC-C0a, AC-C0b, AC-C0c, AC-C1, AC-C2, AC-C3, AC-C4, AC-C5
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** Extending existing memory cell (GraphResolver + IndexBuilder + CollectionGraph) — no new store/queue/router
**Architecture:** Fix V18 schema migration verification for edges table, fix GraphResolver silent skip for unresolved anchors, add 3 new edge extraction sources (wikilink/doc_link/feature_ref) in IndexBuilder, improve CollectionGraph SVG rendering with better node/edge styling + legend + edge filtering
**Tech Stack:** TypeScript, better-sqlite3, React SVG (custom force layout)
**前端验证:** Yes — AC-C5 (Graph UI美化) requires browser verification

---

## Finish Line

The graph at Hub → Memory → Graph shows a **connected network** for any queried anchor — not isolated nodes. Edges from frontmatter, WikiLinks, markdown links, and F-number references are all visible. The graph looks clean and professional. Unresolvable anchors appear as placeholders instead of being silently dropped.

**What we're NOT building:** D3/react-force-graph migration, real-time edge streaming, graph editing UI, edge weight/confidence scoring.

## Root Cause Analysis (Pre-Plan Diagnosis)

Three bugs cause "isolated nodes":

1. **Schema mismatch** — Root `evidence.sqlite` edges table has 3 columns (V1 schema). `getRelated()` queries 6 columns (expects V18). Query throws `no such column` → no edges returned → isolated nodes. V18 migration exists in `schema.ts:506-523` but hasn't been applied to the running database yet (server restart needed after F186 Phase F merge).

2. **Silent skip** — `GraphResolver.ts:116`: `if (!collectionId) continue` drops anchors that exist as edge targets but not as docs in any store. No log, no node — they vanish.

3. **Sparse edges** — Only frontmatter `related_features` creates edges. Documents with WikiLinks, markdown cross-references, and F-number mentions have no edges.

## Terminal Interfaces

```typescript
// Edge types after Phase C
type EdgeRelation = 'related_to' | 'wikilink' | 'doc_link' | 'feature_ref';
type EdgeProvenance = 'frontmatter' | 'content' | 'manual';

// GraphNode gains 'unresolved' kind for anchors not in any store
interface GraphNode {
  anchor: string;
  collectionId: string;  // '' for unresolved
  sensitivity: CollectionSensitivity;
  kind: string;           // 'unresolved' for missing anchors
  title: string;
  redacted: boolean;
}
```

---

## Task 1: Schema Migration Verification Test (AC-C0a)

V18 migration already adds the 5 columns. This task verifies it works on a database that starts with V1 schema, and that `getRelated()` + `addEdge()` function correctly after migration.

**Files:**
- Test: `packages/api/test/memory/schema-v18-edges-verify.test.js`

**Step 1: Write verification test**

```javascript
// Test that V18 migration adds columns to a V1 edges table
// 1. Create DB with V1 schema only (3-column edges)
// 2. Insert a legacy edge (3 columns)
// 3. Run applyMigrations (should apply V18)
// 4. Verify edges table now has 8 columns
// 5. Verify getRelated() works (returns null for new columns)
// 6. Verify addEdge() works (inserts 8-column row)
```

**Step 2: Run test to verify it passes**

Run: `cd packages/api && node --test test/memory/schema-v18-edges-verify.test.js`
Expected: PASS — V18 migration exists and works

**Step 3: Commit**

```bash
git add packages/api/test/memory/schema-v18-edges-verify.test.js
git commit -m "test(F188): verify V18 edges schema migration [布偶猫🐾]"
```

---

## Task 2: Fix GraphResolver Silent Skip (AC-C0b, AC-C0c)

When `inferCollectionId` returns undefined (anchor not in any store), create an "unresolved" placeholder node instead of silently dropping it.

**Files:**
- Modify: `packages/api/src/domains/memory/GraphResolver.ts:115-116`
- Test: `packages/api/test/memory/graph-resolver.test.js` (add case)

**Step 1: Write failing test for unresolved anchor**

```javascript
it('shows unresolved node instead of silently skipping (AC-C0b)', async () => {
  // Doc A exists, has edge to B, but B is NOT in any store
  await store.upsert([
    { anchor: 'F186', kind: 'feature', status: 'active', title: 'F186', updatedAt: '2026-05-07' },
  ]);
  await store.addEdge({
    fromAnchor: 'F186', toAnchor: 'F999',
    relation: 'feature_ref', provenance: 'content',
  });

  const catalog = {
    list: () => [{ id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' }],
    get: (id) => catalog.list().find((m) => m.id === id),
  };
  const stores = new Map([['project:cat-cafe', store]]);
  const resolver = new GraphResolver(catalog, stores);

  const result = await resolver.buildSubgraph('F186', {
    depth: 1, callerCollections: ['project:cat-cafe'],
  });

  // F999 should appear as unresolved node, not be silently dropped
  assert.equal(result.nodes.length, 2);
  const unresolved = result.nodes.find(n => n.anchor === 'F999');
  assert.ok(unresolved, 'unresolved anchor must appear as node');
  assert.equal(unresolved.kind, 'unresolved');
  assert.equal(result.edges.length, 1);
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm build && node --test test/memory/graph-resolver.test.js`
Expected: FAIL — `result.nodes.length` is 1 (F999 silently dropped)

**Step 3: Fix GraphResolver.ts**

In `buildSubgraph`, replace the silent skip at line 116:

```typescript
// Before (line 115-116):
const collectionId = await inferCollectionId(currentAnchor, this.catalog, this.stores);
if (!collectionId) continue;

// After:
const collectionId = await inferCollectionId(currentAnchor, this.catalog, this.stores);
if (!collectionId) {
  if (!nodesMap.has(currentAnchor)) {
    nodesMap.set(currentAnchor, {
      anchor: currentAnchor,
      collectionId: '',
      sensitivity: 'internal',
      kind: 'unresolved',
      title: currentAnchor,
      redacted: false,
    });
  }
  continue;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm build && node --test test/memory/graph-resolver.test.js`
Expected: ALL tests PASS

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/GraphResolver.ts packages/api/test/memory/graph-resolver.test.js
git commit -m "fix(F188): show unresolved nodes instead of silent skip (AC-C0b) [布偶猫🐾]"
```

---

## Task 3: Edge Extraction — WikiLink, Markdown Link, F-Number (AC-C1, C2, C3)

Add 3 new edge sources to IndexBuilder's rebuild phase, right after the existing frontmatter edge extraction.

**Files:**
- Create: `packages/api/src/domains/memory/edge-extractors.ts`
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts:289` (after frontmatter edges)
- Test: `packages/api/test/memory/edge-extractors.test.js`

**Step 1: Write failing test for edge extraction functions**

```javascript
// Test pure extraction functions:
// extractWikiLinkEdges("see [[F186]] and [[F102]]", "F188")
//   → [{from: "F188", to: "F186", relation: "wikilink"}, {from: "F188", to: "F102", relation: "wikilink"}]
// extractDocLinkEdges("see [spec](../features/F186-library.md)", "F188", pathToAnchorMap)
//   → [{from: "F188", to: "F186", relation: "doc_link"}]
// extractFeatureRefEdges("Related to F186 and F102", "F188")
//   → [{from: "F188", to: "F186", relation: "feature_ref"}, {from: "F188", to: "F102", relation: "feature_ref"}]
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm build && node --test test/memory/edge-extractors.test.js`
Expected: FAIL — module not found

**Step 3: Implement edge-extractors.ts**

```typescript
export interface ExtractedEdge {
  fromAnchor: string;
  toAnchor: string;
  relation: 'wikilink' | 'doc_link' | 'feature_ref';
  provenance: 'content';
}

export function extractWikiLinkEdges(content: string, selfAnchor: string): ExtractedEdge[] {
  const edges: ExtractedEdge[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const target = match[1]!.trim();
    if (target === selfAnchor || seen.has(target.toLowerCase())) continue;
    seen.add(target.toLowerCase());
    edges.push({ fromAnchor: selfAnchor, toAnchor: target, relation: 'wikilink', provenance: 'content' });
  }
  return edges;
}

export function extractFeatureRefEdges(content: string, selfAnchor: string): ExtractedEdge[] {
  const edges: ExtractedEdge[] = [];
  const seen = new Set<string>();
  // Match F followed by 2-4 digits, word boundary, not inside [[...]] or [...](...) or frontmatter
  for (const match of content.matchAll(/(?<!\[\[)\bF(\d{2,4})\b/g)) {
    const fRef = match[0];
    if (fRef === selfAnchor || seen.has(fRef)) continue;
    seen.add(fRef);
    edges.push({ fromAnchor: selfAnchor, toAnchor: fRef, relation: 'feature_ref', provenance: 'content' });
  }
  return edges;
}

export function extractDocLinkEdges(
  content: string,
  selfAnchor: string,
  pathToAnchor: Map<string, string>,
  sourcePath?: string,
): ExtractedEdge[] {
  const edges: ExtractedEdge[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const linkPath = match[1]!;
    if (linkPath.startsWith('http') || linkPath.startsWith('#')) continue;
    // Try direct path match, then basename match
    const targetAnchor = pathToAnchor.get(linkPath)
      ?? pathToAnchor.get(linkPath.replace(/^\.\.\//, '').replace(/^\.\//, ''));
    if (!targetAnchor || targetAnchor === selfAnchor || seen.has(targetAnchor)) continue;
    seen.add(targetAnchor);
    edges.push({ fromAnchor: selfAnchor, toAnchor: targetAnchor, relation: 'doc_link', provenance: 'content' });
  }
  return edges;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && pnpm build && node --test test/memory/edge-extractors.test.js`
Expected: PASS

**Step 5: Write failing integration test for IndexBuilder edge creation**

```javascript
// After rebuild, verify wikilink/feature_ref/doc_link edges exist in store
// Use a test document with all three types of references
```

**Step 6: Wire edge extractors into IndexBuilder.ts**

After the frontmatter edge loop (line 289), add:

```typescript
// Phase C: extract wikilink, doc_link, feature_ref edges from document content
import { extractWikiLinkEdges, extractFeatureRefEdges, extractDocLinkEdges } from './edge-extractors.js';

// Build source_path → anchor lookup for doc_link resolution
const pathToAnchor = new Map<string, string>();
for (const item of indexedItems) {
  if (item.sourcePath) pathToAnchor.set(item.sourcePath, item.anchor);
}

// Clear old content-provenance edges before re-extracting
await this.store.runExclusive(() => {
  this.store.getDb().prepare("DELETE FROM edges WHERE provenance = 'content'").run();
});

for (const scanned of scannedItems) {
  if (!scanned.rawContent) continue;
  const fm = extractFrontmatter(scanned.rawContent);
  const anchor = fm ? extractAnchor(fm) : undefined;
  if (!anchor) continue;

  const bodyContent = scanned.rawContent;
  const wikiEdges = extractWikiLinkEdges(bodyContent, anchor);
  const refEdges = extractFeatureRefEdges(bodyContent, anchor);
  const docEdges = extractDocLinkEdges(bodyContent, anchor, pathToAnchor, scanned.filePath);

  for (const edge of [...wikiEdges, ...refEdges, ...docEdges]) {
    await this.store.addEdge(edge);
  }
}
```

**Step 7: Run integration test to verify it passes**

Run: `cd packages/api && pnpm build && node --test test/memory/edge-extractors.test.js`
Expected: PASS

**Step 8: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

**Step 9: Commit**

```bash
git add packages/api/src/domains/memory/edge-extractors.ts \
       packages/api/src/domains/memory/IndexBuilder.ts \
       packages/api/test/memory/edge-extractors.test.js
git commit -m "feat(F188): add wikilink/doc_link/feature_ref edge extraction (AC-C1~C3) [布偶猫🐾]"
```

---

## Task 4: Graph UI 美化 (AC-C5)

Redesign CollectionGraph.tsx for visual quality. Keep custom SVG approach (no library swap), improve: node styling, edge curves, color palette, legend, edge type filtering.

**Files:**
- Modify: `packages/web/src/components/memory/CollectionGraph.tsx`
- Test: `packages/web/src/components/memory/__tests__/CollectionGraph.test.tsx` (keep existing tests green, add legend test)

### Sub-step 4a: Node styling improvement

**Step 1: Update node rendering**

- Filled circles with kind-based colors (feature=blue, spec=teal, session=amber, lore=purple, unresolved=gray)
- Larger radius (24 center, 20 others)
- Drop shadow filter
- Two-line label: kind above (smaller), title below
- Better truncation (24 chars)

**Step 2: Update edge rendering**

- Quadratic bezier curves instead of straight lines
- SVG arrowhead marker definition
- Relation label only on hover (not always visible)
- Thicker strokes with better opacity

**Step 3: Improve force layout**

- Increase simulation iterations (120)
- Increase spring distance (160)
- Increase repulsion (5000)
- Canvas responsive: use container width, min-height 500px

**Step 4: Add legend + edge type filter**

- Legend component showing node kind colors
- Checkbox filter for edge relation types (wikilink, doc_link, feature_ref, related_to)
- Filter applied client-side (filter edges array before layout)

**Step 5: Run tests + verify in browser**

Run: `pnpm test`
Run: Start dev server, navigate to Hub → Memory → Graph, test with anchor "F188"

Expected: Graph shows connected nodes with colored fills, curved edges, legend visible, filter checkboxes work.

**Step 6: Commit**

```bash
git add packages/web/src/components/memory/CollectionGraph.tsx \
       packages/web/src/components/memory/__tests__/CollectionGraph.test.tsx
git commit -m "feat(F188): graph UI美化 — node fills, edge curves, legend, filters (AC-C5) [布偶猫🐾]"
```

---

## Task 5: Orphan Edges Stats Verification (AC-C4)

`CollectionReadModel.computeHealth()` already counts orphan edges at lines 106-118. Verify the stat is correct and add a test.

**Files:**
- Test: `packages/api/test/memory/collection-read-model.test.js` (add orphan edge test)

**Step 1: Write test verifying orphan edge counting**

```javascript
// Create edges where one anchor doesn't exist in evidence_docs
// Verify computeHealth returns correct orphanedAnchorCount
```

**Step 2: Run test**

Run: `cd packages/api && pnpm build && node --test test/memory/collection-read-model.test.js`
Expected: PASS — implementation already exists

**Step 3: Commit**

```bash
git add packages/api/test/memory/collection-read-model.test.js
git commit -m "test(F188): verify orphan edge counting in health stats (AC-C4) [布偶猫🐾]"
```

---

## Task 6: End-to-end verification (AC-C0c)

Verify the full pipeline: rebuild → edges created (frontmatter + content) → graph query returns connected nodes.

**Step 1: Run rebuild via API**

```bash
curl -X POST http://localhost:3102/api/library/project:cat-cafe/rebuild
```

**Step 2: Query graph for a known feature**

```bash
curl "http://localhost:3102/api/library/graph?anchor=F188&depth=1"
```

Expected: Response contains nodes AND edges (not just isolated center node)

**Step 3: Verify in browser**

Open Hub → Memory → Graph → enter "F188" → see connected graph with multiple node types and edge types.

**Step 4: Final commit**

Run full test suite and lint:
```bash
pnpm test && pnpm lint && pnpm check
```
