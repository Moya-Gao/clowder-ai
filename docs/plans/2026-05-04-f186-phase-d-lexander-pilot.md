# F186 Phase D: Lexander Pilot Implementation Plan

**Feature:** F186 — `docs/features/F186-library-memory-architecture.md`
**Goal:** Verify the full library pipeline (truth→scan→index→query + Human-Browsable Layer) with a real non-code Collection
**Acceptance Criteria:**
- AC-D1: 至少一个非代码 Collection 完成 truth → scan → index → query 全链路验证
- AC-D2: 非代码 Collection 试点必须同时验证 Human-Browsable Layer（Overview Lens + Health Card 正常展示），不只是 scan/index/query
**Architecture:** Add two API endpoints to library routes — POST /register (dynamic collection creation) and POST /:id/rebuild (trigger scan+index). Persist external collection manifests to `~/.cat-cafe/library/collections.json` so they survive restarts. On factory startup, load persisted collections. Integration tests verify the full pipeline against temp directories with realistic markdown content.
**Tech Stack:** Fastify, better-sqlite3, existing FlatScanner/StructuredScanner/CollectionIndexBuilder from Phase B
**前端验证:** Yes — AC-D2 requires verifying CollectionCatalog.tsx shows the new collection's Overview Lens + Health Card

---

## What we're NOT building

- No new scanner levels (Phase B delivered L0/L1, sufficient)
- No security scanning / secret gate (Phase C)
- No new UI components (Phase A's CollectionCatalog.tsx already renders any registered collection)
- No vector/embedding pipeline for collections (Phase B scanners produce FTS-indexable content)

## Terminal Schema

No new types. Uses existing:
- `CollectionManifest` (collection-types.ts)
- `CollectionIndexBuilder` + `resolveCollectionScanner` (Phase B)
- `CollectionReadModel` (Phase A)
- `LibraryCatalog` (Phase A)

New persistence format (JSON file):
```typescript
// ~/.cat-cafe/library/collections.json
Array<CollectionManifest>
```

---

### Task 1: Persistent external collection loader

Load external collections from `~/.cat-cafe/library/collections.json` at startup. Save new registrations to the same file.

**Files:**
- Create: `packages/api/src/domains/memory/external-collections.ts`
- Modify: `packages/api/src/domains/memory/factory.ts:152-186`
- Modify: `packages/api/src/domains/memory/index.ts` (barrel export)
- Test: `packages/api/test/memory/external-collections.test.js`

**Step 1: Write failing tests**

```javascript
// external-collections.test.js
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('external-collections', () => {
  let loadExternalCollections, saveExternalCollection;
  let dataDir;

  beforeEach(async () => {
    ({ loadExternalCollections, saveExternalCollection } = await import(
      '../../dist/domains/memory/external-collections.js'
    ));
    dataDir = mkdtempSync(join(tmpdir(), 'ext-col-'));
  });

  it('returns empty array when no collections.json exists', () => {
    const result = loadExternalCollections(dataDir);
    assert.deepEqual(result, []);
  });

  it('loads manifests from collections.json', () => {
    const manifest = {
      id: 'world:test',
      kind: 'world',
      name: 'test',
      displayName: 'Test World',
      root: '/tmp/test',
      sensitivity: 'internal',
      scannerLevel: 1,
      indexPolicy: { autoRebuild: false },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: true },
      createdAt: '2026-05-04',
      updatedAt: '2026-05-04',
    };
    mkdirSync(join(dataDir, 'library'), { recursive: true });
    writeFileSync(join(dataDir, 'library', 'collections.json'), JSON.stringify([manifest]));
    const result = loadExternalCollections(dataDir);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'world:test');
  });

  it('saveExternalCollection appends to existing file', () => {
    mkdirSync(join(dataDir, 'library'), { recursive: true });
    const m1 = { id: 'world:a', kind: 'world', name: 'a', displayName: 'A', root: '/a',
      sensitivity: 'internal', scannerLevel: 0, indexPolicy: { autoRebuild: false },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04' };
    writeFileSync(join(dataDir, 'library', 'collections.json'), JSON.stringify([m1]));
    const m2 = { ...m1, id: 'world:b', name: 'b', displayName: 'B', root: '/b' };
    saveExternalCollection(dataDir, m2);
    const saved = JSON.parse(readFileSync(join(dataDir, 'library', 'collections.json'), 'utf-8'));
    assert.equal(saved.length, 2);
  });

  it('saveExternalCollection creates file when absent', () => {
    const m = { id: 'world:new', kind: 'world', name: 'new', displayName: 'New', root: '/new',
      sensitivity: 'internal', scannerLevel: 0, indexPolicy: { autoRebuild: false },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04' };
    saveExternalCollection(dataDir, m);
    const saved = JSON.parse(readFileSync(join(dataDir, 'library', 'collections.json'), 'utf-8'));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, 'world:new');
  });

  it('skips manifests with non-existent root paths', () => {
    const manifest = { id: 'world:gone', kind: 'world', name: 'gone', displayName: 'Gone',
      root: '/nonexistent/path/that/does/not/exist',
      sensitivity: 'internal', scannerLevel: 0, indexPolicy: { autoRebuild: false },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04' };
    mkdirSync(join(dataDir, 'library'), { recursive: true });
    writeFileSync(join(dataDir, 'library', 'collections.json'), JSON.stringify([manifest]));
    const result = loadExternalCollections(dataDir);
    assert.equal(result.length, 0);
  });
});
```

**Step 2: Run tests — expect FAIL (module not found)**

```bash
node --test packages/api/test/memory/external-collections.test.js
```

**Step 3: Implement external-collections.ts**

```typescript
// packages/api/src/domains/memory/external-collections.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionManifest } from './collection-types.js';

const COLLECTIONS_FILE = 'library/collections.json';

export function loadExternalCollections(dataDir: string): CollectionManifest[] {
  const filePath = join(dataDir, COLLECTIONS_FILE);
  if (!existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as CollectionManifest[];
    return raw.filter((m) => existsSync(m.root));
  } catch {
    return [];
  }
}

export function saveExternalCollection(dataDir: string, manifest: CollectionManifest): void {
  const dirPath = join(dataDir, 'library');
  mkdirSync(dirPath, { recursive: true });
  const filePath = join(dirPath, 'collections.json');
  const existing = existsSync(filePath)
    ? (JSON.parse(readFileSync(filePath, 'utf-8')) as CollectionManifest[])
    : [];
  existing.push(manifest);
  writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

export function resolveCollectionStorePath(dataDir: string, collectionId: string): string {
  const safeId = collectionId.replace(/:/g, '-');
  return join(dataDir, 'library', safeId, 'evidence.sqlite');
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F186): Phase D Task 1 — external collection persistence"
```

---

### Task 2: Register + Rebuild API endpoints

Two new endpoints on the library routes:
- POST /api/library/register — create and persist a collection
- POST /api/library/:collectionId/rebuild — trigger scanner + index build

**Files:**
- Modify: `packages/api/src/routes/library.ts`
- Modify: `packages/api/src/domains/memory/index.ts` (barrel)
- Test: `packages/api/test/memory/library-register-rebuild.test.js`

**Step 1: Write failing tests**

```javascript
// library-register-rebuild.test.js
import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('library register + rebuild endpoints', () => {
  let Fastify, libraryRoutes, LibraryCatalog, SqliteEvidenceStore;
  let catalog, stores, dataDir, app;

  beforeEach(async () => {
    Fastify = (await import('fastify')).default;
    ({ libraryRoutes } = await import('../../dist/routes/library.js'));
    ({ LibraryCatalog } = await import('../../dist/domains/memory/LibraryCatalog.js'));
    ({ SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js'));
    catalog = new LibraryCatalog();
    stores = new Map();
    dataDir = mkdtempSync(join(tmpdir(), 'lib-api-'));
    app = Fastify();
    await app.register(libraryRoutes, { catalog, stores, dataDir });
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  it('POST /register creates a new collection', async () => {
    const contentDir = mkdtempSync(join(tmpdir(), 'col-'));
    writeFileSync(join(contentDir, 'doc.md'), '# Test Doc\n\nSome content.');
    const res = await app.inject({
      method: 'POST', url: '/api/library/register',
      payload: {
        id: 'world:pilot', kind: 'world', name: 'pilot',
        displayName: 'Pilot World', root: contentDir,
        sensitivity: 'internal', scannerLevel: 0,
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.manifest.id, 'world:pilot');
    assert.ok(catalog.get('world:pilot'));
    assert.ok(stores.has('world:pilot'));
  });

  it('POST /register rejects duplicate id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dup-'));
    const payload = {
      id: 'world:dup', kind: 'world', name: 'dup',
      displayName: 'Dup', root: dir, sensitivity: 'internal', scannerLevel: 0,
    };
    await app.inject({ method: 'POST', url: '/api/library/register', payload });
    const res = await app.inject({ method: 'POST', url: '/api/library/register', payload });
    assert.equal(res.statusCode, 409);
  });

  it('POST /register rejects non-existent root', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/library/register',
      payload: {
        id: 'world:bad', kind: 'world', name: 'bad',
        displayName: 'Bad', root: '/no/such/path', sensitivity: 'internal', scannerLevel: 0,
      },
    });
    assert.equal(res.statusCode, 400);
  });

  it('POST /rebuild indexes collection content', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-'));
    writeFileSync(join(dir, 'a.md'), '# Alpha\n\nAlpha content.');
    writeFileSync(join(dir, 'b.md'), '---\ndoc_kind: decision\n---\n# Beta\n\nBeta content.');
    await app.inject({
      method: 'POST', url: '/api/library/register',
      payload: { id: 'domain:rebuild', kind: 'domain', name: 'rebuild',
        displayName: 'Rebuild', root: dir, sensitivity: 'internal', scannerLevel: 1 },
    });
    const res = await app.inject({ method: 'POST', url: '/api/library/domain:rebuild/rebuild' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.indexed, 2);
  });

  it('POST /rebuild returns 404 for unknown collection', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/library/world:unknown/rebuild' });
    assert.equal(res.statusCode, 404);
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement endpoints in library.ts**

Add to `LibraryRoutesOptions`:
```typescript
export interface LibraryRoutesOptions {
  catalog: LibraryCatalog;
  stores: Map<string, IEvidenceStore>;
  dataDir?: string;
}
```

Add two new routes inside the plugin:
```typescript
// POST /api/library/register
app.post('/api/library/register', async (request, reply) => {
  const body = request.body as {
    id: string; kind: string; name: string; displayName: string;
    root: string; sensitivity: string; scannerLevel: number | 'auto';
    exclude?: string[];
  };
  if (!existsSync(body.root)) {
    reply.status(400);
    return { error: `Root path does not exist: ${body.root}` };
  }
  const now = new Date().toISOString();
  const manifest: CollectionManifest = {
    id: body.id,
    kind: body.kind as CollectionKind,
    name: body.name,
    displayName: body.displayName,
    root: body.root,
    sensitivity: (body.sensitivity ?? 'private') as CollectionSensitivity,
    scannerLevel: body.scannerLevel ?? 'auto',
    indexPolicy: { autoRebuild: false },
    reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: true },
    exclude: body.exclude,
    createdAt: now,
    updatedAt: now,
  };
  try {
    opts.catalog.register(manifest);
  } catch (e: any) {
    reply.status(409);
    return { error: e.message };
  }
  const storePath = resolveCollectionStorePath(dataDir, manifest.id);
  mkdirSync(dirname(storePath), { recursive: true });
  const store = new SqliteEvidenceStore(storePath);
  await store.initialize();
  opts.stores.set(manifest.id, store);
  if (dataDir) saveExternalCollection(dataDir, manifest);
  return { manifest };
});

// POST /api/library/:collectionId/rebuild
app.post<{ Params: { collectionId: string } }>(
  '/api/library/:collectionId/rebuild', async (request, reply) => {
    const manifest = opts.catalog.get(request.params.collectionId);
    if (!manifest) { reply.status(404); return { error: 'Collection not found' }; }
    const store = opts.stores.get(manifest.id);
    if (!store) { reply.status(404); return { error: 'Store not found' }; }
    const scanner = resolveCollectionScanner(manifest);
    const builder = new CollectionIndexBuilder(store as SqliteEvidenceStore, manifest, scanner);
    const result = await builder.rebuild();
    return result;
  },
);
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -m "feat(F186): Phase D Task 2 — register + rebuild API endpoints"
```

---

### Task 3: End-to-end pipeline integration test (AC-D1)

Register a collection with realistic content → rebuild → search via KnowledgeResolver → verify results.

**Files:**
- Test: `packages/api/test/memory/collection-pipeline-e2e.test.js`

**Step 1: Write failing test**

```javascript
// collection-pipeline-e2e.test.js
import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('Collection pipeline E2E (AC-D1)', () => {
  let SqliteEvidenceStore, LibraryCatalog, CollectionIndexBuilder, resolveCollectionScanner, KnowledgeResolver;
  let store, catalog, stores, dbPath;

  beforeEach(async () => {
    ({ SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js'));
    ({ LibraryCatalog } = await import('../../dist/domains/memory/LibraryCatalog.js'));
    ({ CollectionIndexBuilder } = await import('../../dist/domains/memory/CollectionIndexBuilder.js'));
    ({ resolveCollectionScanner } = await import('../../dist/domains/memory/scanner-resolver.js'));
    ({ KnowledgeResolver } = await import('../../dist/domains/memory/KnowledgeResolver.js'));
    catalog = new LibraryCatalog();
    stores = new Map();
    dbPath = join(mkdtempSync(join(tmpdir(), 'e2e-')), 'test.sqlite');
    store = new SqliteEvidenceStore(dbPath);
    await store.initialize();
  });

  afterEach(() => { try { unlinkSync(dbPath); } catch {} });

  it('full pipeline: register → scan → index → search returns results', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'world-'));
    writeFileSync(join(dir, 'lore.md'), '# World Lore\n\nThe ancient civilization built towers.');
    writeFileSync(join(dir, 'character.md'),
      '---\ndoc_kind: feature\ntopics: [protagonist, backstory]\n---\n# Alexander\n\nA warrior from the northern realm.');
    mkdirSync(join(dir, 'places'));
    writeFileSync(join(dir, 'places', 'citadel.md'), '# The Citadel\n\nA fortress overlooking the valley.');

    const manifest = {
      id: 'world:test-lore', kind: 'world', name: 'test-lore',
      displayName: 'Test Lore', root: dir, sensitivity: 'internal',
      scannerLevel: 1,
      indexPolicy: { autoRebuild: false },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: true },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };
    catalog.register(manifest);
    stores.set('world:test-lore', store);

    const scanner = resolveCollectionScanner(manifest);
    const builder = new CollectionIndexBuilder(store, manifest, scanner);
    const result = await builder.rebuild();
    assert.equal(result.indexed, 3);

    const resolver = new KnowledgeResolver({ projectStore: store, catalog, stores });
    const searchResult = await resolver.search('ancient civilization', {
      dimension: 'collection', collections: ['world:test-lore'],
    });
    assert.ok(searchResult.results.length > 0, 'should find results for "ancient civilization"');
    assert.ok(searchResult.results.some((r) => r.title?.includes('World Lore')));
  });

  it('structured scanner enriches frontmatter docs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'struct-'));
    writeFileSync(join(dir, 'char.md'),
      '---\ndoc_kind: feature\ntopics: [warrior, backstory]\nanchor: CHAR-001\n---\n# Character\n\nSee [[World Lore]].');
    const manifest = {
      id: 'world:struct', kind: 'world', name: 'struct',
      displayName: 'Struct', root: dir, sensitivity: 'internal', scannerLevel: 1,
      indexPolicy: { autoRebuild: false },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: true },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };
    catalog.register(manifest);
    stores.set('world:struct', store);
    const scanner = resolveCollectionScanner(manifest);
    const builder = new CollectionIndexBuilder(store, manifest, scanner);
    await builder.rebuild();

    const doc = await store.getByAnchor('world:struct:CHAR-001');
    assert.ok(doc, 'frontmatter anchor should be indexed');
    assert.equal(doc.kind, 'feature');
    assert.ok(doc.keywords?.includes('warrior'));
    assert.ok(doc.keywords?.includes('World Lore'), 'WikiLink target should be in keywords');
  });

  it('paths with spaces work correctly', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'space dir-'));
    writeFileSync(join(dir, 'note.md'), '# Spaced Path\n\nContent in a spaced directory.');
    const manifest = {
      id: 'domain:spaced', kind: 'domain', name: 'spaced',
      displayName: 'Spaced', root: dir, sensitivity: 'internal', scannerLevel: 0,
      indexPolicy: { autoRebuild: false },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };
    catalog.register(manifest);
    stores.set('domain:spaced', store);
    const scanner = resolveCollectionScanner(manifest);
    const builder = new CollectionIndexBuilder(store, manifest, scanner);
    const result = await builder.rebuild();
    assert.equal(result.indexed, 1);
  });
});
```

**Step 2: Run — expect FAIL (KnowledgeResolver search method signature)**

**Step 3: No implementation needed — uses existing infra. Fix any integration gaps found by running tests.**

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git commit -m "test(F186): Phase D Task 3 — end-to-end pipeline integration test (AC-D1)"
```

---

### Task 4: Catalog display integration test (AC-D2)

Verify that a registered + populated collection appears in GET /api/library/catalog with correct Overview Lens + Health Card data.

**Files:**
- Test: `packages/api/test/memory/collection-catalog-display.test.js`

**Step 1: Write failing test**

```javascript
// collection-catalog-display.test.js
import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('Collection catalog display (AC-D2)', () => {
  let Fastify, libraryRoutes, LibraryCatalog, SqliteEvidenceStore,
    CollectionIndexBuilder, resolveCollectionScanner;
  let app, catalog, stores, dbPath;

  beforeEach(async () => {
    Fastify = (await import('fastify')).default;
    ({ libraryRoutes } = await import('../../dist/routes/library.js'));
    ({ LibraryCatalog } = await import('../../dist/domains/memory/LibraryCatalog.js'));
    ({ SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js'));
    ({ CollectionIndexBuilder } = await import('../../dist/domains/memory/CollectionIndexBuilder.js'));
    ({ resolveCollectionScanner } = await import('../../dist/domains/memory/scanner-resolver.js'));
    catalog = new LibraryCatalog();
    stores = new Map();
    dbPath = join(mkdtempSync(join(tmpdir(), 'disp-')), 'test.sqlite');
  });

  afterEach(async () => {
    if (app) await app.close();
    try { unlinkSync(dbPath); } catch {}
  });

  it('catalog endpoint shows overview + health for populated collection', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cat-disp-'));
    writeFileSync(join(dir, 'arch.md'), '---\ndoc_kind: decision\n---\n# Architecture\n\nWe decided on X.');
    writeFileSync(join(dir, 'story.md'), '# Story\n\nOnce upon a time.');
    writeFileSync(join(dir, 'plan.md'), '---\ndoc_kind: plan\n---\n# Plan\n\nPhase 1 does Y.');

    const manifest = {
      id: 'world:display', kind: 'world', name: 'display',
      displayName: 'Display World', root: dir, sensitivity: 'internal', scannerLevel: 1,
      indexPolicy: { autoRebuild: false },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: true },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };
    catalog.register(manifest);

    const store = new SqliteEvidenceStore(dbPath);
    await store.initialize();
    stores.set('world:display', store);

    const scanner = resolveCollectionScanner(manifest);
    const builder = new CollectionIndexBuilder(store, manifest, scanner);
    await builder.rebuild();

    app = Fastify();
    await app.register(libraryRoutes, { catalog, stores });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/library/catalog' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    const col = body.collections.find((c) => c.manifest.id === 'world:display');
    assert.ok(col, 'collection should appear in catalog');

    // Overview Lens
    assert.equal(col.overview.docCount, 3);
    assert.ok(col.overview.topKinds.length > 0, 'topKinds should be populated');
    assert.ok(col.overview.recentAnchors.length > 0, 'recentAnchors should be populated');
    assert.equal(col.overview.indexable, false);

    // Health Card
    assert.ok(col.health.indexFreshness, 'indexFreshness should be set');
    assert.equal(col.health.indexable, false);
    assert.equal(typeof col.health.orphanedAnchorCount, 'number');
  });

  it('detail endpoint shows single collection overview + health', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'detail-'));
    writeFileSync(join(dir, 'doc.md'), '# Doc\n\nContent.');
    const manifest = {
      id: 'world:detail', kind: 'world', name: 'detail',
      displayName: 'Detail World', root: dir, sensitivity: 'internal', scannerLevel: 0,
      indexPolicy: { autoRebuild: false },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: true },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };
    catalog.register(manifest);
    const store = new SqliteEvidenceStore(dbPath);
    await store.initialize();
    stores.set('world:detail', store);
    const scanner = resolveCollectionScanner(manifest);
    const builder = new CollectionIndexBuilder(store, manifest, scanner);
    await builder.rebuild();

    app = Fastify();
    await app.register(libraryRoutes, { catalog, stores });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/library/world:detail' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.overview.docCount, 1);
    assert.ok(body.health.indexFreshness);
  });
});
```

**Step 2: Run — expect PASS (no new implementation needed, just verifies existing infra)**

**Step 3: Commit**

```bash
git commit -m "test(F186): Phase D Task 4 — catalog display integration test (AC-D2)"
```

---

### Task 5: Wire factory + visual verification

Wire external collection loading into factory.ts startup. Then manually register lexander and verify the UI.

**Files:**
- Modify: `packages/api/src/domains/memory/factory.ts:152-186`

**Step 1: Add external collection loading after built-in registration**

```typescript
// After global:methods registration (line 186), add:
const dataDir = config.dataDir ?? join(homedir(), '.cat-cafe');
const externals = loadExternalCollections(dataDir);
for (const manifest of externals) {
  try {
    catalog.register(manifest);
    const storePath = resolveCollectionStorePath(dataDir, manifest.id);
    mkdirSync(dirname(storePath), { recursive: true });
    const extStore = new SqliteEvidenceStore(storePath);
    await extStore.initialize();
    stores.set(manifest.id, extStore);
  } catch {
    // fail-open: skip broken external collections
  }
}
```

**Step 2: Wire dataDir into libraryRoutes registration (in server setup)**

Pass `dataDir` to libraryRoutes options so register endpoint can persist.

**Step 3: Build + manual verification**

```bash
# 1. Build
pnpm --filter @cat-cafe/api build

# 2. Register lexander via curl (after starting dev server)
curl -X POST http://localhost:3102/api/library/register \
  -H 'Content-Type: application/json' \
  -d '{"id":"world:lexander","kind":"world","name":"lexander","displayName":"Lexander 逐峰宇宙","root":"/Users/lysander/projects/Bound by Calestial Grow/lexander","sensitivity":"internal","scannerLevel":"auto","exclude":[".venv/**","code/**","R1-TMP/**","废弃/**","clean/**"]}'

# 3. Trigger rebuild
curl -X POST http://localhost:3102/api/library/world:lexander/rebuild

# 4. Verify search
curl 'http://localhost:3102/api/library/catalog' | jq '.collections[] | select(.manifest.id == "world:lexander") | {docCount: .overview.docCount, topKinds: .overview.topKinds}'

# 5. Open Memory Hub Catalog in browser — verify lexander card shows
```

**Step 4: Commit**

```bash
git commit -m "feat(F186): Phase D Task 5 — wire factory + external collection startup loading"
```
