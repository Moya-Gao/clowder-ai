---
feature_ids: [F186]
doc_kind: plan
created: 2026-05-05
---

# F186 Phase F: Memory Lens + Typed Graph Implementation Plan

**Feature:** F186 — `docs/features/F186-library-memory-architecture.md`
**Goal:** Graph viewer in Memory Hub showing cross-collection typed edges with sensitivity-aware rendering, plus persistence-layer redaction for private collections
**Acceptance Criteria:**
- AC-F1: Memory Lens anchor 可跨 collection，输出标注证据来源域
- AC-F2: Typed Evidence Graph 支持跨域 `related_to` edges
- R7 closure: IndexBuilder/session digest persistence-layer redaction for private collections (AC-A9 Phase C debt)
- OQ-3: `dimension: "all"` deprecated (response header + body warning)
- OQ-4: `promoted_from` edge schema + fail-closed API (no UI)
**Architecture:** Extend edges table with collection/sensitivity/provenance columns. New GraphResolver aggregates per-collection edges into unified subgraph. New RecallPersistenceRedactor prevents private content from leaking into FTS via thread transcripts. Graph viewer component in Memory Hub Catalog tab. Three-tier sensitivity gate: build-time classify → query-time filter → UI metadata-only rendering.
**Tech Stack:** SQLite (schema migration), Fastify (graph API), React (graph viewer), existing LibraryCatalog + IEvidenceStore
**前端验证:** Yes — graph viewer in Memory Hub requires Playwright/Chrome verification

**Design Gate constraints (converged with 砚砚 2026-05-05):**
1. Graph API at `/api/library/graph`, not parallel memory API
2. Edge storage with collection/sensitivity/provenance; GraphResolver aggregates per-collection stores
3. Sensitivity gate = build-time classification + query-time filtering + UI metadata-only rendering
4. R7 uses catalog-aware RecallPersistenceRedactor, not anchor prefix pattern matching
5. Naming: `related` read-compat, new writes use `related_to`, API exposes `related_to` only

**What we're NOT building:**
- Promote UI (OQ-4 is schema + API only)
- Full graph editor / manual edge creation UI
- `dimension: "all"` removal (deprecation warning only, behavior unchanged)

---

## Terminal Schema

```typescript
// Extended Edge (interfaces.ts)
interface Edge {
  fromAnchor: string;
  toAnchor: string;
  relation: 'evolved_from' | 'blocked_by' | 'related_to' | 'supersedes' | 'invalidates' | 'promoted_from';
  fromCollectionId?: string;
  toCollectionId?: string;
  edgeSensitivity?: CollectionSensitivity;
  provenance?: 'frontmatter' | 'wikilink' | 'promote' | 'manual';
  createdAt?: string;
}

// GraphResult (GraphResolver.ts)
interface GraphNode {
  anchor: string;
  collectionId: string;
  sensitivity: CollectionSensitivity;
  kind: string;
  title: string;
  redacted: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  crossCollection: boolean;
  edgeSensitivity: CollectionSensitivity;
  provenance: string;
  redacted: boolean;
}

interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  center?: string;
  depth: number;
  deprecationWarnings?: string[];
}
```

---

## Task 1: Edge schema migration + interface extension

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts:136-139`
- Modify: `packages/api/src/domains/memory/schema.ts` (add migration)
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts:887-915`
- Test: `packages/api/test/memory/edge-schema-migration.test.js`

### Step 1: Write failing test for extended edge storage

```javascript
it('stores and retrieves edge with collection/sensitivity/provenance', async () => {
  const edge = {
    fromAnchor: 'project:cat-cafe:doc/f186',
    toAnchor: 'world:lexander:doc/lore-a',
    relation: 'related_to',
    fromCollectionId: 'project:cat-cafe',
    toCollectionId: 'world:lexander',
    edgeSensitivity: 'private',
    provenance: 'frontmatter',
  };
  await store.addEdge(edge);
  const related = await store.getRelated('project:cat-cafe:doc/f186');
  assert.equal(related.length, 1);
  assert.equal(related[0].anchor, 'world:lexander:doc/lore-a');
  assert.equal(related[0].relation, 'related_to');
  assert.equal(related[0].fromCollectionId, 'project:cat-cafe');
  assert.equal(related[0].toCollectionId, 'world:lexander');
  assert.equal(related[0].edgeSensitivity, 'private');
  assert.equal(related[0].provenance, 'frontmatter');
});
```

### Step 2: Run test — expect FAIL (schema missing columns / interface mismatch)

### Step 3: Implement

**interfaces.ts** — extend Edge type:
```typescript
export interface Edge {
  fromAnchor: string;
  toAnchor: string;
  relation: 'evolved_from' | 'blocked_by' | 'related_to' | 'supersedes' | 'invalidates' | 'promoted_from';
  fromCollectionId?: string;
  toCollectionId?: string;
  edgeSensitivity?: CollectionSensitivity;
  provenance?: 'frontmatter' | 'wikilink' | 'promote' | 'manual';
  createdAt?: string;
}
```

**schema.ts** — add migration v8 (check current max version):
```sql
ALTER TABLE edges ADD COLUMN from_collection_id TEXT;
ALTER TABLE edges ADD COLUMN to_collection_id TEXT;
ALTER TABLE edges ADD COLUMN edge_sensitivity TEXT;
ALTER TABLE edges ADD COLUMN provenance TEXT;
ALTER TABLE edges ADD COLUMN created_at TEXT;
```

**SqliteEvidenceStore.ts** — update `addEdge` INSERT to include new columns, update `getRelated` SELECT to return them. Read-compat: if `relation === 'related'`, treat as `related_to` in query results.

### Step 4: Run test — expect PASS

### Step 5: Write test for read-compat (`related` → `related_to`)

```javascript
it('normalizes legacy "related" edges to "related_to" in query results', async () => {
  db.prepare('INSERT INTO edges (from_anchor, to_anchor, relation) VALUES (?, ?, ?)').run('a', 'b', 'related');
  const related = await store.getRelated('a');
  assert.equal(related[0].relation, 'related_to');
});
```

### Step 6: Run test — expect FAIL, implement normalization, verify PASS

### Step 7: Commit

```bash
git commit -m "feat(F186): extend edges table with collection/sensitivity/provenance (Phase F)"
```

---

## Task 2: RecallPersistenceRedactor + IndexBuilder R7 integration

**Files:**
- Create: `packages/api/src/domains/memory/RecallPersistenceRedactor.ts`
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts` (~5 lines: import + call redactor)
- Test: `packages/api/test/memory/recall-persistence-redactor.test.js`

### Step 1: Write failing test for RecallPersistenceRedactor

```javascript
it('redacts private collection content from transcript text', () => {
  const transcript = 'The lexander world has a secret plot about dragons. Also F186 is about memory.';
  const collectionGroups = [
    { collectionId: 'world:lexander', sensitivity: 'private', status: 'ok', durationMs: 1, items: [
      { anchor: 'world:lexander:doc/secret-plot', title: 'Secret Plot', kind: 'lore', status: 'active' }
    ]},
    { collectionId: 'project:cat-cafe', sensitivity: 'internal', status: 'ok', durationMs: 1, items: [
      { anchor: 'project:cat-cafe:doc/f186', title: 'F186', kind: 'feature', status: 'active' }
    ]},
  ];
  const result = redactForPersistence(transcript, collectionGroups);
  assert.ok(!result.includes('secret plot'));
  assert.ok(result.includes('[redacted — private collection world:lexander]'));
  assert.ok(result.includes('F186'));
});
```

### Step 2: Run test — expect FAIL

### Step 3: Implement RecallPersistenceRedactor.ts

Uses catalog sensitivity from `collectionGroups`, replaces text snippets that match private collection item titles/content with `[redacted — {sensitivity} collection {collectionId}]`. For structured recall results (not free text), strip private items entirely and replace with metadata-only placeholder.

```typescript
import type { CollectionGroup } from './interfaces.js';

export function redactForPersistence(
  text: string,
  collectionGroups: CollectionGroup[],
): string {
  let result = text;
  for (const group of collectionGroups) {
    if (group.sensitivity === 'public' || group.sensitivity === 'internal') continue;
    for (const item of group.items) {
      if (item.title && item.title !== `[redacted — ${group.sensitivity} collection]`) {
        result = result.replaceAll(item.title, `[redacted — ${group.sensitivity} collection ${group.collectionId}]`);
      }
    }
  }
  return result;
}

export function redactGroupsForPersistence(
  groups: CollectionGroup[],
): CollectionGroup[] {
  return groups.map((g) => {
    if (g.sensitivity === 'public' || g.sensitivity === 'internal') return g;
    return {
      ...g,
      items: g.items.map((item) => ({
        anchor: item.anchor,
        kind: item.kind,
        status: item.status,
        title: `[redacted — ${g.sensitivity} collection]`,
        updatedAt: item.updatedAt,
      })),
    };
  });
}
```

### Step 4: Run test — expect PASS

### Step 5: Write failing test for IndexBuilder integration

```javascript
it('does not index private collection titles in thread summary FTS', async () => {
  // Setup: create a thread summary containing a private collection anchor title
  // After rebuild, search FTS for the private title → expect 0 results
  // Search for non-private content → expect results
});
```

### Step 6: Integrate in IndexBuilder — import RecallPersistenceRedactor, call `redactForPersistence()` on thread summary content before indexing to FTS. Minimal touch: ~5 lines added to IndexBuilder.

### Step 7: Run test — expect PASS

### Step 8: Commit

```bash
git commit -m "feat(F186): RecallPersistenceRedactor + IndexBuilder R7 integration (Phase F)"
```

---

## Task 3: GraphResolver + Library Graph API

**Files:**
- Create: `packages/api/src/domains/memory/GraphResolver.ts`
- Create: `packages/api/src/routes/library-graph-routes.ts`
- Modify: `packages/api/src/index.ts` (register route, ~3 lines)
- Test: `packages/api/test/memory/graph-resolver.test.js`

### Step 1: Write failing test for GraphResolver.buildSubgraph()

```javascript
it('builds subgraph centered on anchor with cross-collection edges', async () => {
  // Setup: two collections with edges between them
  // Call buildSubgraph('project:cat-cafe:doc/f186', { depth: 1, allowedCollections: ['project:cat-cafe', 'world:lexander'] })
  // Assert: nodes from both collections, edge marked crossCollection: true
  // Assert: sensitivity-aware — private node has redacted: true when caller doesn't include it
});
```

### Step 2: Run test — expect FAIL

### Step 3: Implement GraphResolver.ts

```typescript
import type { CollectionSensitivity } from './collection-types.js';
import type { LibraryCatalog } from './LibraryCatalog.js';
import type { IEvidenceStore } from './interfaces.js';
import { COLLECTION_SENSITIVITY_ORDER } from './collection-types.js';

interface GraphNode { anchor: string; collectionId: string; sensitivity: CollectionSensitivity; kind: string; title: string; redacted: boolean; }
interface GraphEdge { from: string; to: string; relation: string; crossCollection: boolean; edgeSensitivity: CollectionSensitivity; provenance: string; redacted: boolean; }
interface GraphResult { nodes: GraphNode[]; edges: GraphEdge[]; center?: string; depth: number; }

export class GraphResolver {
  constructor(
    private catalog: LibraryCatalog,
    private stores: Map<string, IEvidenceStore>,
  ) {}

  async buildSubgraph(anchor: string, opts: { depth?: number; allowedCollections?: string[] }): Promise<GraphResult> {
    // 1. Find anchor's collection from catalog
    // 2. BFS from anchor up to depth, collecting edges from each collection's store
    // 3. For each node, lookup collection sensitivity from catalog
    // 4. For private/restricted nodes not in allowedCollections, set redacted: true, title = metadata-only
    // 5. For edges crossing collection boundary, set crossCollection: true
    // 6. edgeSensitivity = stricter of from/to sensitivity
    // 7. Return { nodes, edges, center, depth }
  }
}
```

### Step 4: Run test — expect PASS

### Step 5: Write failing test for GET /api/library/graph endpoint

```javascript
it('returns subgraph for anchor via GET /api/library/graph', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/library/graph?anchor=project:cat-cafe:doc/f186&depth=1' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(Array.isArray(body.nodes));
  assert.ok(Array.isArray(body.edges));
  assert.equal(body.center, 'project:cat-cafe:doc/f186');
});
```

### Step 6: Implement library-graph-routes.ts

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { GraphResolver } from '../domains/memory/GraphResolver.js';
// localhost-only, same pattern as f163-audit-routes
// GET /api/library/graph?anchor=X&depth=N&collections=a,b
// Returns GraphResult
```

### Step 7: Run test — expect PASS

### Step 8: Write test for sensitivity filtering (private node not in allowedCollections → redacted)

### Step 9: Commit

```bash
git commit -m "feat(F186): GraphResolver + GET /api/library/graph endpoint (AC-F1, AC-F2)"
```

---

## Task 4: OQ-3 dimension:all deprecation + OQ-4 promoted_from + naming

**Files:**
- Modify: `packages/api/src/domains/memory/KnowledgeResolver.ts:~40-50`
- Test: `packages/api/test/memory/dimension-deprecation.test.js`

### Step 1: Write failing test for deprecation warning

```javascript
it('returns deprecationWarning when dimension=all is used', async () => {
  const result = await resolver.resolve('test', { dimension: 'all' });
  assert.ok(result.deprecationWarnings);
  assert.ok(result.deprecationWarnings.some(w => w.includes('dimension: "all"')));
});
```

### Step 2: Run test — expect FAIL

### Step 3: Implement — add `deprecationWarnings` to KnowledgeResult, populate when dimension=all

### Step 4: Run test — expect PASS

### Step 5: Write test for promoted_from edge type acceptance

```javascript
it('accepts promoted_from as valid edge relation', async () => {
  await store.addEdge({
    fromAnchor: 'world:lexander:doc/lesson',
    toAnchor: 'global:methods:doc/promoted-lesson',
    relation: 'promoted_from',
    fromCollectionId: 'world:lexander',
    toCollectionId: 'global:methods',
    edgeSensitivity: 'internal',
    provenance: 'promote',
  });
  const related = await store.getRelated('global:methods:doc/promoted-lesson');
  assert.equal(related[0].relation, 'promoted_from');
});
```

### Step 6: Run test — expect PASS (relation already in Edge union type from Task 1)

### Step 7: Commit

```bash
git commit -m "feat(F186): deprecate dimension:all + promoted_from edge type (OQ-3, OQ-4)"
```

---

## Task 5: Graph viewer UI component

**Files:**
- Create: `packages/web/src/components/memory/CollectionGraph.tsx`
- Modify: `packages/web/src/components/memory/MemoryHub.tsx` (~5 lines: add tab)
- Test: `packages/web/test/components/collection-graph.test.tsx`

### Step 1: Write failing component test

```javascript
it('renders graph nodes and edges from API response', async () => {
  // Mock fetch /api/library/graph
  // Render CollectionGraph with anchor prop
  // Assert: SVG/canvas contains node elements with collection labels
  // Assert: redacted nodes show metadata-only badge
});
```

### Step 2: Run test — expect FAIL

### Step 3: Implement CollectionGraph.tsx

Simple force-directed or hierarchical layout using SVG (no heavy dependency). Nodes colored by collection, edges styled by relation type, private nodes show lock badge + metadata-only. Start with a minimal but functional graph viewer (~120-150 lines).

Key behaviors:
- Fetch `/api/library/graph?anchor={anchor}&depth=1` on mount
- Render nodes as circles with collection-colored border
- Render edges as lines with relation labels
- Redacted nodes: dashed border + lock icon + `[private]` label
- Click node → update center anchor → re-fetch subgraph
- Sensitivity badges from existing `SENSITIVITY_BADGE` styles in CollectionCatalog

### Step 4: Run test — expect PASS

### Step 5: Add 'graph' tab to MemoryHub

```typescript
// MemoryHub.tsx — add to MemoryTab type
type MemoryTab = 'feed' | 'search' | 'status' | 'health' | 'catalog' | 'graph';
```

### Step 6: Commit

```bash
git commit -m "feat(F186): CollectionGraph viewer in Memory Hub (AC-F1, AC-F2)"
```

---

## Task 6: IndexBuilder edge collection-awareness during rebuild

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts:252-272` (~10 lines)
- Test: existing edge tests + new test in `packages/api/test/memory/edge-schema-migration.test.js`

### Step 1: Write failing test

```javascript
it('creates edges with fromCollectionId during rebuild', async () => {
  // After rebuild, edges from frontmatter cross-references should have fromCollectionId set
  const edges = db.prepare('SELECT * FROM edges WHERE from_collection_id IS NOT NULL').all();
  assert.ok(edges.length > 0);
});
```

### Step 2: Run test — expect FAIL (current IndexBuilder doesn't set collection metadata on edges)

### Step 3: Modify IndexBuilder rebuild — when creating edges from frontmatter, include `fromCollectionId` from the collection being indexed. Resolve `toCollectionId` by anchor prefix lookup against catalog.

### Step 4: Run test — expect PASS

### Step 5: Commit

```bash
git commit -m "feat(F186): collection-aware edge creation in IndexBuilder rebuild"
```

---

## Task 7: Integration test + R1-R8 spec checkbox sweep

### Step 1: Write end-to-end integration test

```javascript
it('full pipeline: rebuild → graph API → sensitivity filtering', async () => {
  // 1. Register two collections (internal + private)
  // 2. Index content with cross-references
  // 3. Query graph API — internal edges visible, private edges redacted
  // 4. Verify FTS doesn't leak private content (R7)
});
```

### Step 2: Run all Phase F tests + full suite

```bash
pnpm --filter @cat-cafe/api test
pnpm --filter @cat-cafe/web test
```

### Step 3: Update F186 spec — check R1-R8 boxes with PR evidence, mark Phase F ✅

### Step 4: Final commit

```bash
git commit -m "test(F186): Phase F integration test + R1-R8 spec checkbox sweep"
```

---

## Commit sequence summary

| # | Commit | AC coverage |
|---|--------|-------------|
| 1 | Edge schema migration | AC-F2 foundation |
| 2 | RecallPersistenceRedactor + IndexBuilder R7 | R7 closure |
| 3 | GraphResolver + GET /api/library/graph | AC-F1, AC-F2 |
| 4 | OQ-3 deprecation + OQ-4 promoted_from | OQ-3, OQ-4 |
| 5 | CollectionGraph viewer UI | AC-F1, AC-F2 (visual) |
| 6 | IndexBuilder collection-aware edges | AC-F2 (build-time classify) |
| 7 | Integration test + spec sweep | All ACs verified |
