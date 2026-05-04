# F186 Phase A: Collection Manifest + LibraryResolver 契约

**Feature:** F186 — `docs/features/F186-library-memory-architecture.md`
**Goal:** Define Collection abstraction, generalize KnowledgeResolver to N-collection federation, register 2 built-in collections, extend search API with collection-aware routing, add Human-Browsable Layer skeleton + privacy boundary + lifecycle CRUD.
**Acceptance Criteria:** AC-A1 ~ AC-A11 (11 items)
**Architecture:** Extend existing `IKnowledgeResolver` with `LibraryCatalog` (collection registry) backing. Each Collection wraps an `IEvidenceStore` + metadata manifest. KnowledgeResolver fan-out generalizes from 2-store (project/global) to N-store. Results grouped per collection. No new DB — each Collection has its own SQLite, existing `evidence.sqlite` and `global_knowledge.sqlite` become the first two collections.
**Tech Stack:** TypeScript, better-sqlite3, Fastify, React (Hub skeleton)
**前端验证:** Yes — Hub Catalog skeleton (AC-A8) needs browser test

---

## Terminal Schema (final form, not scaffolding)

```typescript
// ── interfaces.ts additions ────────────────────────────────────

type CollectionKind = 'project' | 'world' | 'domain' | 'research' | 'global';
type CollectionSensitivity = 'public' | 'internal' | 'private' | 'restricted';
type ReviewStatus = 'unreviewed' | 'partial' | 'reviewed' | 'stale';

interface CollectionManifest {
  id: string;                          // format: <kind>:<name> (KD-8)
  kind: CollectionKind;
  name: string;
  displayName: string;
  root: string;                        // absolute path to truth source
  sensitivity: CollectionSensitivity;  // default: 'private' for external
  scannerLevel: 0 | 1 | 2 | 3 | 'auto';
  indexPolicy: {
    autoRebuild: boolean;
    rebuildIntervalMs?: number;
  };
  reviewPolicy: {
    authorityCeiling: F163Authority;   // max authority a candidate can reach
    requireOwnerApproval: boolean;
  };
  exclude?: string[];                  // glob patterns to skip
  createdAt: string;
  updatedAt: string;
}

// SearchOptions extends existing (lines 146-175 of interfaces.ts)
// dimension gains: 'library' | 'collection' (alongside existing project|global|all)
// new field: collections?: string[]

// KnowledgeResult extends with collection groups
interface CollectionGroup {
  collectionId: string;
  sensitivity: CollectionSensitivity;
  status: 'ok' | 'timeout' | 'skipped' | 'error';
  whyIncluded?: string;
  durationMs: number;
  items: EvidenceItem[];
}

interface KnowledgeResult {
  results: EvidenceItem[];                    // flat (backwards compat)
  sources: Array<'project' | 'global'>;       // legacy compat
  query: string;
  collectionGroups?: CollectionGroup[];        // new: per-collection breakdown
}

// CollectionOverview / CollectionHealth (AC-A7)
interface CollectionOverview {
  collectionId: string;
  displayName: string;
  sensitivity: CollectionSensitivity;
  docCount: number;
  topKinds: Array<{ kind: EvidenceKind; count: number }>;
  recentAnchors: Array<{ anchor: string; title: string; updatedAt: string }>;
  indexable: false;     // derived read-model, never indexed
  sourceAnchors: string[];
}

interface CollectionHealth {
  collectionId: string;
  indexFreshness: string;   // ISO8601 of last rebuild
  pendingReviewCount: number;
  secretFindingsCount: number;
  orphanedAnchorCount: number;
  indexable: false;
  sourceAnchors: string[];
}

// Marker extension (AC-A10)
interface Marker {
  // ... existing fields ...
  sourceCollectionId?: string;
  sourceSensitivity?: CollectionSensitivity;
  targetCollectionId?: string;
  promoteReviewStatus?: ReviewStatus;
  secretScanFingerprint?: string;
}
```

## Not building

- Scanner framework (Phase B) — Phase A uses Level 0 only for built-in collections
- Security pipeline full impl (Phase C) — Phase A defines API shapes, no actual secret scanner
- Non-code Collection trial (Phase D) — Phase A registers code-based collections only
- Query Replay (Phase E) — no capture changes
- Typed Graph (Phase F) — no cross-collection edges
- LLM-based summaries in Overview — Phase A is deterministic stats only

---

## Task 1: Foundation Types (AC-A1, AC-A6)

### Files:
- Modify: `packages/api/src/domains/memory/interfaces.ts`
- Create: `packages/api/src/domains/memory/__tests__/collection-contract.test.ts`

### Step 1: Write contract test for CollectionManifest

```typescript
// collection-contract.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  CollectionManifest,
  CollectionKind,
  CollectionSensitivity,
  ReviewStatus,
  SearchOptions,
  KnowledgeResult,
} from '../interfaces.js';

describe('F186 Collection contract', () => {
  it('CollectionManifest has required fields', () => {
    const manifest: CollectionManifest = {
      id: 'project:cat-cafe',
      kind: 'project',
      name: 'cat-cafe',
      displayName: 'Cat Café Project',
      root: '/path/to/docs',
      sensitivity: 'internal',
      scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-03',
      updatedAt: '2026-05-03',
    };
    assert.equal(manifest.id, 'project:cat-cafe');
    assert.equal(manifest.kind, 'project');
  });

  it('CollectionKind is a closed enum', () => {
    const kinds: CollectionKind[] = ['project', 'world', 'domain', 'research', 'global'];
    assert.equal(kinds.length, 5);
  });

  it('SearchOptions.dimension includes library and collection', () => {
    const opts: SearchOptions = { dimension: 'library' };
    assert.equal(opts.dimension, 'library');
    const opts2: SearchOptions = { dimension: 'collection', collections: ['world:lexander'] };
    assert.deepEqual(opts2.collections, ['world:lexander']);
  });

  it('SearchOptions.dimension preserves legacy values', () => {
    const legacy: SearchOptions['dimension'][] = ['project', 'global', 'all'];
    assert.equal(legacy.length, 3);
  });

  it('scope and dimension are orthogonal', () => {
    const opts: SearchOptions = {
      scope: 'docs',
      dimension: 'library',
      collections: ['project:cat-cafe'],
    };
    assert.equal(opts.scope, 'docs');
    assert.equal(opts.dimension, 'library');
  });

  it('KnowledgeResult.collectionGroups is optional for compat', () => {
    const legacy: KnowledgeResult = {
      results: [],
      sources: ['project'],
      query: 'test',
    };
    assert.equal(legacy.collectionGroups, undefined);
  });

  it('ReviewStatus does not collide with ProvenanceTier or F163Authority', () => {
    const review: ReviewStatus[] = ['unreviewed', 'partial', 'reviewed', 'stale'];
    // ProvenanceTier: authoritative | derived | soft_clue
    // F163Authority: constitutional | validated | candidate | observed
    // No overlap
    const provenance = ['authoritative', 'derived', 'soft_clue'];
    const authority = ['constitutional', 'validated', 'candidate', 'observed'];
    for (const r of review) {
      assert.ok(!provenance.includes(r), `ReviewStatus "${r}" collides with ProvenanceTier`);
      assert.ok(!authority.includes(r), `ReviewStatus "${r}" collides with F163Authority`);
    }
  });
});
```

**Run:** `pnpm --filter @cat-cafe/api node --test src/domains/memory/__tests__/collection-contract.test.ts`
**Expected:** FAIL — types don't exist yet

### Step 2: Add Collection types to interfaces.ts

Add after `ProvenanceTier` block (~line 48):

```typescript
// ── F186 Phase A: Collection types ──────────────────────────────

export const COLLECTION_KINDS = ['project', 'world', 'domain', 'research', 'global'] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

export type CollectionSensitivity = 'public' | 'internal' | 'private' | 'restricted';

export type ReviewStatus = 'unreviewed' | 'partial' | 'reviewed' | 'stale';

export interface CollectionManifest {
  id: string;
  kind: CollectionKind;
  name: string;
  displayName: string;
  root: string;
  sensitivity: CollectionSensitivity;
  scannerLevel: 0 | 1 | 2 | 3 | 'auto';
  indexPolicy: { autoRebuild: boolean; rebuildIntervalMs?: number };
  reviewPolicy: { authorityCeiling: F163Authority; requireOwnerApproval: boolean };
  exclude?: string[];
  createdAt: string;
  updatedAt: string;
}

export const ILibraryCatalogSymbol = Symbol.for('ILibraryCatalog');
```

### Step 3: Extend SearchOptions.dimension + add collections

In `SearchOptions` (line 166), change dimension type:

```typescript
dimension?: 'project' | 'global' | 'library' | 'collection' | 'all';
/** F186 Phase A: explicit collection IDs for dimension=collection */
collections?: string[];
```

### Step 4: Extend KnowledgeResult with collectionGroups

Add CollectionGroup interface + extend KnowledgeResult (after line 210):

```typescript
export interface CollectionGroup {
  collectionId: string;
  sensitivity: CollectionSensitivity;
  status: 'ok' | 'timeout' | 'skipped' | 'error';
  whyIncluded?: string;
  durationMs: number;
  items: EvidenceItem[];
}

export interface KnowledgeResult {
  results: EvidenceItem[];
  sources: Array<'project' | 'global'>;
  query: string;
  /** F186 Phase A: per-collection grouped breakdown */
  collectionGroups?: CollectionGroup[];
}
```

### Step 5: Add ReviewStatus to EvidenceItem

In `EvidenceItem` interface, add:

```typescript
/** F186 Phase A: audit maturity level (distinct from provenance.tier and authority) */
reviewStatus?: ReviewStatus;
```

### Step 6: Run contract test — expect PASS

**Run:** `pnpm --filter @cat-cafe/api node --test src/domains/memory/__tests__/collection-contract.test.ts`
**Expected:** PASS

### Step 7: Run existing tests — expect no regressions

**Run:** `pnpm --filter @cat-cafe/api test`
**Expected:** All existing tests pass (new types are additive)

### Step 8: Commit

```bash
git add packages/api/src/domains/memory/interfaces.ts \
       packages/api/src/domains/memory/__tests__/collection-contract.test.ts
git commit -m "feat(F186): add Collection types + extend SearchOptions/KnowledgeResult [宪宪/Opus-46🐾]"
```

---

## Task 2: LibraryCatalog (AC-A1, AC-A3, AC-A11)

### Files:
- Create: `packages/api/src/domains/memory/LibraryCatalog.ts`
- Create: `packages/api/src/domains/memory/__tests__/LibraryCatalog.test.ts`

### Step 1: Write failing test for LibraryCatalog

```typescript
// LibraryCatalog.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LibraryCatalog } from '../LibraryCatalog.js';

describe('LibraryCatalog', () => {
  let catalog: LibraryCatalog;

  beforeEach(() => {
    catalog = new LibraryCatalog();
  });

  it('registers a collection', () => {
    catalog.register({
      id: 'project:cat-cafe',
      kind: 'project',
      name: 'cat-cafe',
      displayName: 'Cat Café',
      root: '/tmp/docs',
      sensitivity: 'internal',
      scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-03',
      updatedAt: '2026-05-03',
    });
    assert.equal(catalog.list().length, 1);
    assert.equal(catalog.get('project:cat-cafe')?.displayName, 'Cat Café');
  });

  it('rejects duplicate collection ID', () => {
    const manifest = {
      id: 'project:test', kind: 'project' as const, name: 'test',
      displayName: 'Test', root: '/tmp', sensitivity: 'internal' as const,
      scannerLevel: 0 as const,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated' as const, requireOwnerApproval: false },
      createdAt: '2026-05-03', updatedAt: '2026-05-03',
    };
    catalog.register(manifest);
    assert.throws(() => catalog.register(manifest), /already registered/);
  });

  it('validates collection ID format <kind>:<name>', () => {
    assert.throws(() => catalog.register({
      id: 'invalid-no-colon', kind: 'project', name: 'test',
      displayName: 'Test', root: '/tmp', sensitivity: 'internal',
      scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-03', updatedAt: '2026-05-03',
    } as any), /format/);
  });

  it('unbind archives and removes', () => {
    catalog.register({
      id: 'project:temp', kind: 'project', name: 'temp',
      displayName: 'Temp', root: '/tmp', sensitivity: 'internal',
      scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-03', updatedAt: '2026-05-03',
    });
    const archived = catalog.unbind('project:temp');
    assert.equal(archived.id, 'project:temp');
    assert.equal(catalog.get('project:temp'), undefined);
    assert.equal(catalog.list().length, 0);
  });

  it('rename preserves alias mapping', () => {
    catalog.register({
      id: 'project:old', kind: 'project', name: 'old',
      displayName: 'Old', root: '/tmp', sensitivity: 'internal',
      scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-03', updatedAt: '2026-05-03',
    });
    catalog.rename('project:old', 'project:new');
    assert.ok(catalog.get('project:new'));
    assert.ok(catalog.resolveAlias('project:old'));
    assert.equal(catalog.resolveAlias('project:old'), 'project:new');
  });

  it('getRoutable returns only non-private for library dimension', () => {
    catalog.register({
      id: 'project:pub', kind: 'project', name: 'pub',
      displayName: 'Public', root: '/tmp', sensitivity: 'internal',
      scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-03', updatedAt: '2026-05-03',
    });
    catalog.register({
      id: 'world:secret', kind: 'world', name: 'secret',
      displayName: 'Secret', root: '/tmp', sensitivity: 'private',
      scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-03', updatedAt: '2026-05-03',
    });
    const routable = catalog.getRoutable('library');
    assert.equal(routable.length, 1);
    assert.equal(routable[0].id, 'project:pub');
  });

  it('getRoutable returns explicit collections regardless of sensitivity', () => {
    catalog.register({
      id: 'world:secret', kind: 'world', name: 'secret',
      displayName: 'Secret', root: '/tmp', sensitivity: 'private',
      scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-03', updatedAt: '2026-05-03',
    });
    const routable = catalog.getRoutable('collection', ['world:secret']);
    assert.equal(routable.length, 1);
  });

  it('updateSensitivity tracks direction', () => {
    catalog.register({
      id: 'project:x', kind: 'project', name: 'x',
      displayName: 'X', root: '/tmp', sensitivity: 'private',
      scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-03', updatedAt: '2026-05-03',
    });
    const change = catalog.updateSensitivity('project:x', 'internal');
    assert.equal(change.direction, 'widening');
    assert.equal(catalog.get('project:x')?.sensitivity, 'internal');
  });
});
```

**Run:** Expect FAIL (LibraryCatalog doesn't exist)

### Step 2: Implement LibraryCatalog

```typescript
// LibraryCatalog.ts — F186: Collection registry (metadata + routing, no knowledge storage)

import type { CollectionManifest, CollectionKind, CollectionSensitivity, COLLECTION_KINDS } from './interfaces.js';

const SENSITIVITY_ORDER: Record<CollectionSensitivity, number> = {
  restricted: 0, private: 1, internal: 2, public: 3,
};

export interface SensitivityChange {
  direction: 'widening' | 'narrowing' | 'none';
  from: CollectionSensitivity;
  to: CollectionSensitivity;
}

export class LibraryCatalog {
  private readonly collections = new Map<string, CollectionManifest>();
  private readonly aliases = new Map<string, string>(); // oldId → newId

  register(manifest: CollectionManifest): void {
    this.validateId(manifest.id);
    if (this.collections.has(manifest.id)) {
      throw new Error(`Collection "${manifest.id}" already registered`);
    }
    this.collections.set(manifest.id, { ...manifest });
  }

  get(id: string): CollectionManifest | undefined {
    return this.collections.get(id) ?? this.collections.get(this.aliases.get(id) ?? '');
  }

  list(): CollectionManifest[] {
    return [...this.collections.values()];
  }

  unbind(id: string): CollectionManifest {
    const manifest = this.collections.get(id);
    if (!manifest) throw new Error(`Collection "${id}" not found`);
    this.collections.delete(id);
    return manifest;
  }

  rename(oldId: string, newId: string): void {
    this.validateId(newId);
    const manifest = this.collections.get(oldId);
    if (!manifest) throw new Error(`Collection "${oldId}" not found`);
    if (this.collections.has(newId)) throw new Error(`Collection "${newId}" already exists`);
    this.collections.delete(oldId);
    this.collections.set(newId, { ...manifest, id: newId, updatedAt: new Date().toISOString() });
    this.aliases.set(oldId, newId);
  }

  resolveAlias(id: string): string | undefined {
    return this.aliases.get(id);
  }

  updateSensitivity(id: string, newSensitivity: CollectionSensitivity): SensitivityChange {
    const manifest = this.collections.get(id);
    if (!manifest) throw new Error(`Collection "${id}" not found`);
    const from = manifest.sensitivity;
    const direction = SENSITIVITY_ORDER[newSensitivity] > SENSITIVITY_ORDER[from]
      ? 'widening' : SENSITIVITY_ORDER[newSensitivity] < SENSITIVITY_ORDER[from]
      ? 'narrowing' : 'none';
    manifest.sensitivity = newSensitivity;
    manifest.updatedAt = new Date().toISOString();
    return { direction, from, to: newSensitivity };
  }

  getRoutable(
    dimension: 'library' | 'collection' | 'project' | 'global' | 'all',
    explicitCollections?: string[],
  ): CollectionManifest[] {
    if (dimension === 'collection' && explicitCollections?.length) {
      return explicitCollections
        .map(id => this.get(id))
        .filter((m): m is CollectionManifest => m != null);
    }
    if (dimension === 'library') {
      return this.list().filter(m =>
        m.sensitivity === 'public' || m.sensitivity === 'internal'
      );
    }
    if (dimension === 'project') {
      return this.list().filter(m => m.kind === 'project');
    }
    if (dimension === 'global') {
      return this.list().filter(m => m.kind === 'global');
    }
    // 'all' = legacy project + global alias
    return this.list().filter(m => m.kind === 'project' || m.kind === 'global');
  }

  private validateId(id: string): void {
    const match = id.match(/^([a-z]+):([a-z0-9_-]+)$/);
    if (!match) throw new Error(`Collection ID must match format "<kind>:<name>", got "${id}"`);
  }
}
```

### Step 3: Run test — expect PASS

### Step 4: Commit

```bash
git commit -m "feat(F186): add LibraryCatalog — collection registry with lifecycle CRUD [宪宪/Opus-46🐾]"
```

---

## Task 3: Generalize KnowledgeResolver (AC-A2, AC-A5)

### Files:
- Modify: `packages/api/src/domains/memory/KnowledgeResolver.ts`
- Create: `packages/api/src/domains/memory/__tests__/KnowledgeResolver.test.ts`

### Step 1: Write failing test for N-collection resolution

Test KnowledgeResolver with 3 collections (project + global + world), verifying:
- dimension=library routes to non-private collections
- dimension=collection routes to explicit collection list
- dimension=all preserves legacy project+global behavior
- Results have collectionGroups with per-collection status
- Private collections show status='skipped' in groups
- RRF fusion works across N collections

### Step 2: Refactor KnowledgeResolver deps

Change `KnowledgeResolverDeps` from:
```typescript
{ projectStore: IEvidenceStore; globalStore?: IEvidenceStore }
```
to:
```typescript
{
  catalog: LibraryCatalog;
  stores: Map<string, IEvidenceStore>;  // collectionId → store
  legacyProjectId?: string;             // backwards compat: 'project:cat-cafe'
  legacyGlobalId?: string;              // backwards compat: 'global:methods'
}
```

### Step 3: Implement N-collection fan-out in resolve()

- Read dimension + collections from SearchOptions
- Call `catalog.getRoutable(dimension, collections)` to get target manifests
- For each collection: look up store in `stores` Map → call `store.search()` with timeout
- Collect per-collection results into `CollectionGroup[]`
- RRF fusion across all groups → flat `results[]`
- Populate legacy `sources` for backwards compat
- Return `KnowledgeResult` with both flat and grouped

### Step 4: Preserve legacy 2-store behavior

When `dimension` is `project` / `global` / `all` (or undefined), route through `legacyProjectId` / `legacyGlobalId` stores to maintain exact current RRF behavior.

### Step 5: Run test — expect PASS

### Step 6: Run existing memory tests to verify no regression

**Run:** `pnpm --filter @cat-cafe/api test`

### Step 7: Commit

```bash
git commit -m "feat(F186): generalize KnowledgeResolver to N-collection federation [宪宪/Opus-46🐾]"
```

---

## Task 4: Factory Wiring + 2 Built-in Collections (AC-A3)

### Files:
- Modify: `packages/api/src/domains/memory/factory.ts`
- Modify: `packages/api/src/domains/memory/interfaces.ts` (MemoryServices)

### Step 1: Update factory to create LibraryCatalog

In `createMemoryServices()`:
1. Create `LibraryCatalog` instance
2. Register `project:cat-cafe` manifest (root=docsRoot, sensitivity=internal)
3. Register `global:methods` manifest (root=globalStore path, sensitivity=internal, kind=global)
4. Create `stores` Map: `project:cat-cafe` → store, `global:methods` → globalStore
5. Pass catalog + stores to KnowledgeResolver

### Step 2: Expose catalog in MemoryServices

```typescript
export interface MemoryServices {
  // ... existing fields ...
  /** F186 Phase A: Collection registry */
  catalog?: LibraryCatalog;
}
```

### Step 3: Run tests — verify 2 collections registered at startup

### Step 4: Commit

```bash
git commit -m "feat(F186): wire LibraryCatalog into factory, register project + global [宪宪/Opus-46🐾]"
```

---

## Task 5: Evidence Route Extension (AC-A4, AC-A5)

### Files:
- Modify: `packages/api/src/routes/evidence.ts`
- Modify: `packages/api/src/routes/evidence-helpers.ts`

### Step 1: Extend search schema

Add to `searchSchema`:
```typescript
dimension: z.enum(['project', 'global', 'library', 'collection', 'all']).optional(),
collections: z.string().optional(), // comma-separated collection IDs
```

### Step 2: Pass collections to KnowledgeResolver

In the route handler, parse `collections` from comma-separated string to `string[]`, pass to `searchOpts`.

### Step 3: Map collectionGroups to response format

When `resolveResult.collectionGroups` exists, include in response envelope:
```typescript
collectionGroups: resolveResult.collectionGroups?.map(g => ({
  collectionId: g.collectionId,
  sensitivity: g.sensitivity,
  status: g.status,
  itemCount: g.items.length,
  durationMs: g.durationMs,
})),
```

### Step 4: Run evidence route tests

### Step 5: Commit

```bash
git commit -m "feat(F186): extend evidence route with dimension=library/collection [宪宪/Opus-46🐾]"
```

---

## Task 6: CollectionOverview + Health Read-Model (AC-A7, AC-A8)

### Files:
- Create: `packages/api/src/domains/memory/CollectionReadModel.ts`
- Create: `packages/api/src/domains/memory/__tests__/CollectionReadModel.test.ts`
- Modify: `packages/api/src/routes/evidence.ts` (add endpoints)
- Modify: `packages/web/src/components/memory/MemoryHub.tsx` (add catalog tab)
- Create: `packages/web/src/components/memory/CollectionCatalog.tsx`

### Step 1: Write failing test for CollectionReadModel

Test: given a store with known evidence items, `computeOverview()` returns correct docCount, topKinds, recentAnchors. `computeHealth()` returns indexFreshness, pendingReviewCount=0.

### Step 2: Implement CollectionReadModel

```typescript
// CollectionReadModel.ts
export class CollectionReadModel {
  static computeOverview(collectionId: string, displayName: string,
    sensitivity: CollectionSensitivity, store: IEvidenceStore, db: Database.Database
  ): CollectionOverview { /* deterministic SQL queries */ }

  static computeHealth(collectionId: string, store: IEvidenceStore,
    db: Database.Database, markerQueue: IMarkerQueue
  ): CollectionHealth { /* deterministic SQL queries + marker count */ }
}
```

### Step 3: Run test — expect PASS

### Step 4: Add API endpoints

```
GET /api/library/catalog          → list all collections with overview + health
GET /api/library/:collectionId    → single collection overview + health
```

### Step 5: Create CollectionCatalog frontend component

Minimal skeleton: fetch `/api/library/catalog`, render collection cards with:
- displayName + sensitivity badge
- docCount + last updated
- Health indicators (review count, index freshness)
- Placeholder for Overview Lens detail (expands to show topKinds + recentAnchors)

### Step 6: Wire into MemoryHub

Add 'catalog' as fifth tab in MemoryHub (alongside feed/search/status/health), rendering `CollectionCatalog`.

### Step 7: Browser test — verify Hub shows 2 collection cards

### Step 8: Commit

```bash
git commit -m "feat(F186): CollectionOverview/Health read-model + Hub Catalog skeleton [宪宪/Opus-46🐾]"
```

---

## Task 7: Knowledge Feed Target Collection (AC-A10)

### Files:
- Modify: `packages/api/src/domains/memory/interfaces.ts` (Marker)
- Modify: `packages/api/src/domains/memory/MarkerQueue.ts`
- Modify: `packages/api/src/routes/knowledge-feed.ts`
- Create: `packages/api/src/domains/memory/__tests__/marker-collection.test.ts`

### Step 1: Write failing test

Test: approve with `targetCollectionId` different from source → requires sensitivity check. Default target = source collection.

### Step 2: Extend Marker interface

Add to `Marker` in interfaces.ts:
```typescript
sourceCollectionId?: string;
sourceSensitivity?: CollectionSensitivity;
targetCollectionId?: string;
promoteReviewStatus?: ReviewStatus;
secretScanFingerprint?: string;
```

### Step 3: Extend approve route

In `POST /api/knowledge/approve`:
- Accept `targetCollectionId` in body
- If target differs from source AND target has lower sensitivity (widening): return 400 "requires re-scan confirmation"
- Accept `confirmVisibilityWidening: true` to proceed
- Pass `targetCollectionId` to MaterializationService (Phase A stub: still writes to local docs/ but tags with collection metadata in frontmatter)

### Step 4: Run test — expect PASS

### Step 5: Commit

```bash
git commit -m "feat(F186): Marker collection routing + approve target selection [宪宪/Opus-46🐾]"
```

---

## Task 8: RecallFeed Privacy Boundary (AC-A9)

### Files:
- Create: `packages/api/src/domains/memory/privacy-redactor.ts`
- Create: `packages/api/src/domains/memory/__tests__/privacy-redactor.test.ts`
- Modify: `packages/api/src/domains/memory/KnowledgeResolver.ts` (apply redaction)

### Step 1: Write failing test for PrivacyRedactor

Test: given items from a `private` collection, `redactForTranscript()` returns metadata-only items (collectionId + hit_count + sensitivity, no title/summary/passages).

### Step 2: Implement PrivacyRedactor

```typescript
// privacy-redactor.ts
export function redactForTranscript(
  items: EvidenceItem[],
  collectionSensitivity: CollectionSensitivity,
): EvidenceItem[] {
  if (collectionSensitivity === 'public' || collectionSensitivity === 'internal') {
    return items;
  }
  // private/restricted → strip content, keep metadata
  return items.map(item => ({
    anchor: item.anchor,
    kind: item.kind,
    status: item.status,
    title: '[redacted — private collection]',
    updatedAt: item.updatedAt,
    // No summary, no passages, no keywords
  }));
}
```

### Step 3: Apply in KnowledgeResolver

When building `CollectionGroup` for a private collection, run `redactForTranscript()` on items before including in the response. The group `status` is 'ok' but items are redacted.

For the flat `results[]` array: private items still appear (they were explicitly requested) but are redacted.

### Step 4: Run test — expect PASS

### Step 5: Run full test suite

### Step 6: Commit

```bash
git commit -m "feat(F186): private collection recall → metadata-only redaction [宪宪/Opus-46🐾]"
```

---

## Task 9: Schema Migration V17 (supporting columns)

### Files:
- Modify: `packages/api/src/domains/memory/schema.ts`

### Step 1: Add V17 migration

```typescript
if (currentVersion < 17) {
  // F186 Phase A: collection-aware columns
  try { db.exec('ALTER TABLE evidence_docs ADD COLUMN collection_id TEXT'); } catch {}
  try { db.exec('ALTER TABLE evidence_docs ADD COLUMN review_status TEXT'); } catch {}
  db.exec('CREATE INDEX IF NOT EXISTS idx_evidence_docs_collection ON evidence_docs(collection_id)');
  // Marker collection routing columns
  try { db.exec('ALTER TABLE markers ADD COLUMN source_collection_id TEXT'); } catch {}
  try { db.exec('ALTER TABLE markers ADD COLUMN source_sensitivity TEXT'); } catch {}
  try { db.exec('ALTER TABLE markers ADD COLUMN target_collection_id TEXT'); } catch {}
  try { db.exec('ALTER TABLE markers ADD COLUMN promote_review_status TEXT'); } catch {}
  try { db.exec('ALTER TABLE markers ADD COLUMN secret_scan_fingerprint TEXT'); } catch {}
  db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)')
    .run(17, new Date().toISOString());
}
```

Update `CURRENT_SCHEMA_VERSION` to 17.

### Step 2: Update RowShape + rowToItem in SqliteEvidenceStore.ts

Add `collection_id` and `review_status` to RowShape, map in rowToItem.

### Step 3: Update upsert() to persist new columns

### Step 4: Run migration test

### Step 5: Commit

```bash
git commit -m "feat(F186): schema V17 — collection_id + review_status + marker routing columns [宪宪/Opus-46🐾]"
```

---

## Task 10: Integration Test — Full Federated Search (AC-A2, AC-A4, AC-A5)

### Files:
- Create: `packages/api/src/domains/memory/__tests__/federated-search.test.ts`

### Step 1: Write integration test

End-to-end test:
1. Create 2 in-memory SqliteEvidenceStore instances
2. Populate each with different evidence items
3. Register both as collections in LibraryCatalog
4. Create KnowledgeResolver with catalog + stores
5. Search with dimension=library → verify results from both collections, grouped
6. Search with dimension=collection + explicit ID → verify only that collection
7. Search with dimension=all → verify legacy project+global behavior
8. Search with private collection → verify redacted results

### Step 2: Run — expect PASS (all prior tasks implemented)

### Step 3: Commit

```bash
git commit -m "test(F186): federated search integration test [宪宪/Opus-46🐾]"
```

---

## Task 11: LSP + Full Test Gate

### Step 1: Run TypeScript check

**Run:** `pnpm lint` (tsc --noEmit)
**Expected:** 0 errors

### Step 2: Run Biome

**Run:** `pnpm check`
**Expected:** 0 errors

### Step 3: Run full test suite

**Run:** `pnpm --filter @cat-cafe/api test`
**Expected:** All pass

### Step 4: Run check:dir-size

**Run:** `pnpm check:dir-size`
**Expected:** No files exceed 350 line limit (new files are under 200)

### Step 5: Final commit (if any lint fixes)

---

## Commit History (expected)

| # | Message | ACs |
|---|---------|-----|
| 1 | `feat(F186): add Collection types + extend SearchOptions/KnowledgeResult` | A1, A4, A6 |
| 2 | `feat(F186): add LibraryCatalog — collection registry with lifecycle CRUD` | A1, A3, A11 |
| 3 | `feat(F186): generalize KnowledgeResolver to N-collection federation` | A2, A5 |
| 4 | `feat(F186): wire LibraryCatalog into factory, register project + global` | A3 |
| 5 | `feat(F186): extend evidence route with dimension=library/collection` | A4, A5 |
| 6 | `feat(F186): CollectionOverview/Health read-model + Hub Catalog skeleton` | A7, A8 |
| 7 | `feat(F186): Marker collection routing + approve target selection` | A10 |
| 8 | `feat(F186): private collection recall → metadata-only redaction` | A9 |
| 9 | `feat(F186): schema V17 — collection_id + review_status + marker columns` | A1, A10 |
| 10 | `test(F186): federated search integration test` | A2, A4, A5 |
| 11 | lint fixes if any | — |

## AC Coverage Matrix

| AC | Tasks | Verification |
|----|-------|-------------|
| A1 | 1, 2 | CollectionManifest type + LibraryCatalog register |
| A2 | 3, 10 | KnowledgeResolver N-collection + integration test |
| A3 | 2, 4 | 2 collections registered in factory |
| A4 | 1, 5 | dimension=library/collection in SearchOptions + route |
| A5 | 3, 5, 10 | CollectionGroup in KnowledgeResult + route mapping |
| A6 | 1 | Contract test: scope/dimension/provenance/authority orthogonal |
| A7 | 6 | CollectionOverview/Health read-model + derived/indexable:false |
| A8 | 6 | Hub Catalog skeleton rendering 2 collection cards |
| A9 | 8 | PrivacyRedactor: private → metadata-only in all layers |
| A10 | 7 | Marker extension + approve target routing + widening check |
| A11 | 2 | LibraryCatalog unbind/rename/updateSensitivity |
