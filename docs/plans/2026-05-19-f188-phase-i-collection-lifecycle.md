# F188 Phase I: Collection Lifecycle Management — Implementation Plan

**Feature:** F188 — `docs/features/F188-library-stewardship.md`
**Goal:** Collection CRUD 全生命周期闭环——铲屎官和猫猫能通过 MCP/UI 创建、管理、归档 Collection
**Acceptance Criteria:** AC-I1 ~ AC-I9（从 feat doc 逐条覆盖）
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** 扩展现有 LibraryCatalog + library routes，不新增架构 cell
**Architecture:** 在 CollectionManifest 上加 `status` 字段实现状态机；`external-collections.ts` 补 update/archive 持久化；MCP tools 包装 REST API；前端扩展现有 CollectionCatalog.tsx
**Tech Stack:** TypeScript, Fastify, React, node:test
**前端验证:** Yes — AC-I5 MemoryHub Collection 管理 UI 必须 Playwright/Chrome 实测

---

## Straight-Line Check

**Finish line:** 铲屎官在 MemoryHub 或通过 MCP 创建 `domain:finance`，绑定 `docs/library/finance/`，rebuild 后 search/graph/catalog 全部能查到 finance 内容。

**NOT building:** hard delete / rename / CLI / 多租户权限 (v1 scope)

## Terminal Schema

```typescript
// collection-types.ts — new
export type CollectionStatus = 'registered' | 'indexing' | 'active' | 'stale' | 'blocked' | 'archived';

// CollectionManifest — add field
status: CollectionStatus;  // default 'registered'

// external-collections.ts — new exports
export function updateExternalCollection(dataDir: string, id: string, updates: Partial<CollectionManifest>): void;
export function archiveExternalCollection(dataDir: string, id: string): CollectionManifest | undefined;

// LibraryCatalog — new methods
archive(id: string): CollectionManifest;
unarchive(id: string): void;
setStatus(id: string, status: CollectionStatus): void;
```

## Existing Infrastructure (extend, don't rewrite)

| Component | Exists | Phase I Action |
|-----------|--------|---------------|
| `CollectionManifest` type | ✅ | Add `status` field |
| `LibraryCatalog.register/unbind/updateSensitivity` | ✅ | Add `archive/unarchive/setStatus` |
| `saveExternalCollection` (append-only) | ✅ | Add `updateExternalCollection` |
| `POST /api/library/register` | ✅ | Extend for managed vault `root` |
| `POST /api/library/bind-dry-run` | ✅ | MCP wrapper only |
| `POST /api/library/:id/rebuild` | ✅ | MCP wrapper only |
| `GET /api/library/catalog` | ✅ | MCP wrapper only |
| `CollectionCatalog.tsx` | ✅ | Extend with status badges + actions |
| MCP library tools | ❌ | New file |
| Archive route | ❌ | New route |
| Sensitivity change route | ❌ | New route (wraps existing method) |
| Managed vault creation | ❌ | New logic in register |

---

## Task 1: Type System + Persistence CRUD (AC-I1 partial)

**Files:**
- Modify: `packages/api/src/domains/memory/collection-types.ts`
- Modify: `packages/api/src/domains/memory/external-collections.ts`
- Test: `packages/api/test/memory/external-collections.test.js`

### Step 1: Write failing test — CollectionStatus type + status field on manifest

```javascript
it('CollectionManifest accepts status field', () => {
  const manifest = {
    id: 'domain:finance', kind: 'domain', name: 'finance',
    displayName: 'Finance', root: '/tmp/finance',
    sensitivity: 'private', scannerLevel: 'auto',
    status: 'registered',
    indexPolicy: { autoRebuild: false },
    reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: true },
    exclude: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  assert.strictEqual(manifest.status, 'registered');
});
```

### Step 2: Add `CollectionStatus` type and `status` field

```typescript
// collection-types.ts
export type CollectionStatus = 'registered' | 'indexing' | 'active' | 'stale' | 'blocked' | 'archived';

// Add to CollectionManifest interface:
status: CollectionStatus;
```

### Step 3: Write failing test — updateExternalCollection

```javascript
it('updateExternalCollection persists status change', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ext-coll-'));
  const manifest = makeManifest('domain:test-update', { status: 'registered' });
  saveExternalCollection(dataDir, manifest);
  updateExternalCollection(dataDir, 'domain:test-update', { status: 'active' });
  const loaded = loadExternalCollections(dataDir);
  assert.strictEqual(loaded[0].status, 'active');
  rmSync(dataDir, { recursive: true, force: true });
});
```

### Step 4: Implement updateExternalCollection

```typescript
export function updateExternalCollection(
  dataDir: string, id: string, updates: Partial<CollectionManifest>,
): void {
  const filePath = join(dataDir, 'library', 'collections.json');
  const existing = existsSync(filePath)
    ? (JSON.parse(readFileSync(filePath, 'utf-8')) as CollectionManifest[])
    : [];
  const idx = existing.findIndex(m => m.id === id);
  if (idx === -1) throw new Error(`Collection "${id}" not found in collections.json`);
  existing[idx] = { ...existing[idx], ...updates, updatedAt: new Date().toISOString() };
  writeFileSync(filePath, JSON.stringify(existing, null, 2));
}
```

### Step 5: Write failing test — archiveExternalCollection

```javascript
it('archiveExternalCollection marks manifest archived and returns it', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ext-coll-'));
  const manifest = makeManifest('domain:test-archive', { status: 'active' });
  saveExternalCollection(dataDir, manifest);
  const archived = archiveExternalCollection(dataDir, 'domain:test-archive');
  assert.strictEqual(archived.status, 'archived');
  const loaded = loadExternalCollections(dataDir);
  assert.strictEqual(loaded[0].status, 'archived');
  rmSync(dataDir, { recursive: true, force: true });
});
```

### Step 6: Implement archiveExternalCollection

```typescript
export function archiveExternalCollection(dataDir: string, id: string): CollectionManifest {
  const filePath = join(dataDir, 'library', 'collections.json');
  const existing = existsSync(filePath)
    ? (JSON.parse(readFileSync(filePath, 'utf-8')) as CollectionManifest[])
    : [];
  const idx = existing.findIndex(m => m.id === id);
  if (idx === -1) throw new Error(`Collection "${id}" not found`);
  existing[idx] = { ...existing[idx], status: 'archived', updatedAt: new Date().toISOString() };
  writeFileSync(filePath, JSON.stringify(existing, null, 2));
  return existing[idx];
}
```

### Step 7: Fix loadExternalCollections to handle status field migration

Existing manifests without `status` field default to `'active'` on load.

### Step 8: Run tests, verify green, commit

```bash
pnpm --filter @cat-cafe/api test -- --test-name-pattern="external-collections"
git add packages/api/src/domains/memory/collection-types.ts packages/api/src/domains/memory/external-collections.ts packages/api/test/memory/external-collections.test.js
git commit -m "feat(F188-I): add CollectionStatus type + persistence CRUD [布偶猫🐾]"
```

---

## Task 2: LibraryCatalog Lifecycle Methods (AC-I1)

**Files:**
- Modify: `packages/api/src/domains/memory/LibraryCatalog.ts`
- Test: `packages/api/test/memory/library-catalog-lifecycle.test.js`

### Step 1: Write failing test — setStatus with valid transitions

```javascript
it('setStatus transitions registered → indexing → active', () => {
  const catalog = new LibraryCatalog();
  catalog.register(makeManifest('domain:test', { status: 'registered' }));
  catalog.setStatus('domain:test', 'indexing');
  assert.strictEqual(catalog.get('domain:test').status, 'indexing');
  catalog.setStatus('domain:test', 'active');
  assert.strictEqual(catalog.get('domain:test').status, 'active');
});
```

### Step 2: Write failing test — archive/unarchive

```javascript
it('archive marks collection archived, unarchive → registered', () => {
  const catalog = new LibraryCatalog();
  catalog.register(makeManifest('domain:test', { status: 'active' }));
  const archived = catalog.archive('domain:test');
  assert.strictEqual(archived.status, 'archived');
  assert.strictEqual(catalog.get('domain:test').status, 'archived');
  catalog.unarchive('domain:test');
  assert.strictEqual(catalog.get('domain:test').status, 'registered');
});
```

### Step 3: Write failing test — archived not returned by getRoutable

```javascript
it('archived collections excluded from getRoutable', () => {
  const catalog = new LibraryCatalog();
  catalog.register(makeManifest('domain:visible', { status: 'active' }));
  catalog.register(makeManifest('domain:hidden', { status: 'archived' }));
  const routable = catalog.getRoutable('library');
  assert.ok(routable.some(m => m.id === 'domain:visible'));
  assert.ok(!routable.some(m => m.id === 'domain:hidden'));
});
```

### Step 4: Implement setStatus, archive, unarchive on LibraryCatalog

```typescript
private static VALID_TRANSITIONS: Record<CollectionStatus, CollectionStatus[]> = {
  registered: ['indexing', 'archived'],
  indexing: ['active', 'blocked'],
  active: ['stale', 'archived', 'indexing'],
  stale: ['indexing', 'archived'],
  blocked: ['registered', 'archived'],
  archived: ['registered'],
};

setStatus(id: string, newStatus: CollectionStatus): void {
  const manifest = this.collections.get(id);
  if (!manifest) throw new Error(`Collection "${id}" not found`);
  const allowed = LibraryCatalog.VALID_TRANSITIONS[manifest.status];
  if (!allowed?.includes(newStatus))
    throw new Error(`Invalid transition: ${manifest.status} → ${newStatus}`);
  manifest.status = newStatus;
  manifest.updatedAt = new Date().toISOString();
}

archive(id: string): CollectionManifest {
  this.setStatus(id, 'archived');
  return this.collections.get(id)!;
}

unarchive(id: string): void {
  this.setStatus(id, 'registered');
}
```

### Step 5: Update getRoutable to exclude archived

Add early filter: `if (m.status === 'archived') return false;`

### Step 6: Run tests, verify green, commit

```bash
pnpm --filter @cat-cafe/api test -- --test-name-pattern="library-catalog"
git commit -m "feat(F188-I): LibraryCatalog lifecycle state machine + archive/unarchive [布偶猫🐾]"
```

---

## Task 3: REST Routes (AC-I2, I3, I6, I7)

**Files:**
- Modify: `packages/api/src/routes/library.ts`
- Test: `packages/api/test/routes/library-lifecycle.test.js`

### Step 1: Write failing test — POST /archive route

```javascript
it('POST /api/library/:id/archive returns archived manifest', async () => {
  // setup: register a collection first
  const res = await app.inject({ method: 'POST', url: '/api/library/domain:test/archive' });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.status, 'archived');
});
```

### Step 2: Implement archive + unarchive + sensitivity routes

```typescript
// POST /api/library/:collectionId/archive
app.post('/api/library/:collectionId/archive', { preHandler: localhostOnly }, async (req, reply) => {
  const { collectionId } = req.params as { collectionId: string };
  const manifest = catalog.archive(collectionId);
  archiveExternalCollection(dataDir, collectionId);
  reply.send(manifest);
});

// POST /api/library/:collectionId/unarchive
app.post('/api/library/:collectionId/unarchive', { preHandler: localhostOnly }, async (req, reply) => {
  const { collectionId } = req.params as { collectionId: string };
  catalog.unarchive(collectionId);
  updateExternalCollection(dataDir, collectionId, { status: 'registered' });
  reply.send(catalog.get(collectionId));
});

// PUT /api/library/:collectionId/sensitivity
app.put('/api/library/:collectionId/sensitivity', { preHandler: localhostOnly }, async (req, reply) => {
  const { collectionId } = req.params as { collectionId: string };
  const { sensitivity } = req.body as { sensitivity: CollectionSensitivity };
  const change = catalog.updateSensitivity(collectionId, sensitivity);
  updateExternalCollection(dataDir, collectionId, { sensitivity });
  reply.send(change);
});
```

### Step 3: Extend POST /api/library/register for managed vault mode

When `root` is empty/missing, create managed vault directory:

```typescript
// In register handler, before creating manifest:
let root = body.root;
if (!root) {
  const vaultBase = join(homedir(), '.cat-cafe', 'library', 'sources', id);
  mkdirSync(vaultBase, { recursive: true });
  root = vaultBase;
}
```

Set initial status to `'registered'`.

### Step 4: Tests for managed vault creation + sensitivity change + unarchive

### Step 5: Run tests, verify green, commit

```bash
pnpm --filter @cat-cafe/api test -- --test-name-pattern="library"
git commit -m "feat(F188-I): lifecycle REST routes — archive/unarchive/sensitivity/managed-vault [布偶猫🐾]"
```

---

## Task 4: MCP Tools (AC-I4)

**Files:**
- Create: `packages/api/src/domains/memory/library-lifecycle-tools.ts`
- Modify: MCP tool registration (wherever graph-tools.ts / recent-tools.ts are registered)
- Test: `packages/api/test/memory/library-lifecycle-tools.test.js`

### 5 MCP Tools

| Tool Name | Maps To | Parameters |
|-----------|---------|------------|
| `cat_cafe_library_list` | `GET /api/library/catalog` | `status?` (filter) |
| `cat_cafe_library_dry_run` | `POST /api/library/bind-dry-run` | `root`, `exclude?` |
| `cat_cafe_library_create` | `POST /api/library/register` | `kind`, `name`, `displayName`, `root?`, `sensitivity?`, `exclude?` |
| `cat_cafe_library_rebuild` | `POST /api/library/:id/rebuild` | `collectionId` |
| `cat_cafe_library_archive` | `POST /api/library/:id/archive` | `collectionId` |

### Step 1: Write failing test for each tool's MCP handler

### Step 2: Implement tools — each wraps HTTP call to localhost API

Following existing pattern from `graph-tools.ts` / `recent-tools.ts`:
- Tool definition with JSON schema
- Handler calls internal API URL
- Format response as human-readable text

### Step 3: Tool descriptions must cross-reference memory tool family (KD-8 inherited: no visibility self-grant)

### Step 4: Register tools in MCP server manifest

### Step 5: Run tests, verify green, commit

```bash
pnpm --filter @cat-cafe/api test -- --test-name-pattern="library-lifecycle-tools"
git commit -m "feat(F188-I): MCP tools — list/dry-run/create/rebuild/archive [布偶猫🐾]"
```

---

## Task 5: Frontend UI (AC-I5)

**Files:**
- Modify: `packages/web/src/components/memory/CollectionCatalog.tsx`
- Create: `packages/web/src/components/memory/CreateCollectionDialog.tsx`
- Modify: `packages/web/src/components/memory/MemoryHub.tsx` (if needed for routing)

### Step 1: Add status badge to collection cards

Extend existing CollectionCatalog card rendering:
- Color-coded badge: active=green, registered=blue, indexing=yellow, stale=orange, blocked=red, archived=gray

### Step 2: Add action buttons per collection

- **Rebuild**: calls `POST /api/library/:id/rebuild` (already exists, just needs button)
- **Archive**: calls `POST /api/library/:id/archive` → removes from active list
- **View Detail**: expands to show config (kind/root/sensitivity/exclude/status)

### Step 3: Create "Create Collection" button + dialog

**CreateCollectionDialog flow:**
1. Form: kind (dropdown), name, displayName, root path (optional = managed vault), sensitivity (dropdown), exclude patterns
2. On "Preview" → calls `POST /api/library/bind-dry-run` with root
3. Shows dry-run results (file count, secret findings, safe/unsafe)
4. On "Confirm" → calls `POST /api/library/register`
5. Auto-refreshes catalog

### Step 4: Sensitivity change in detail view

Dropdown to change sensitivity, calls `PUT /api/library/:id/sensitivity`.
Show confirmation dialog for widening changes (private → public).

### Step 5: Build + verify

```bash
pnpm --filter @cat-cafe/web build
```

### Step 6: Commit

```bash
git commit -m "feat(F188-I): MemoryHub Collection management UI — create/rebuild/archive/detail [布偶猫🐾]"
```

---

## Task 6: E2E Verification (AC-I9)

### Step 1: Integration test — full lifecycle

```javascript
it('AC-I9: create domain:finance → bind docs/library/finance/ → rebuild → searchable', async () => {
  // 1. dry-run
  const dryRun = await callAPI('POST', '/api/library/bind-dry-run', {
    root: resolve('docs/library/finance'),
  });
  assert.ok(dryRun.markdownFiles >= 5);
  assert.ok(dryRun.safe);

  // 2. create collection
  const created = await callAPI('POST', '/api/library/register', {
    id: 'domain:finance', kind: 'domain', name: 'finance',
    displayName: 'Finance Knowledge',
    root: resolve('docs/library/finance'),
    sensitivity: 'private',
  });
  assert.strictEqual(created.id, 'domain:finance');

  // 3. rebuild
  const rebuild = await callAPI('POST', '/api/library/domain:finance/rebuild');
  assert.ok(rebuild.taskId);
  // wait for rebuild completion...

  // 4. verify searchable
  const search = await callAPI('GET', '/api/library/domain:finance');
  assert.strictEqual(search.manifest.status, 'active');
  assert.ok(search.overview.totalDocs >= 5);
});
```

### Step 2: Browser verification (AC-I5 visual)

Open MemoryHub → Catalog tab → verify finance collection visible with status badge → click detail → verify config.

### Step 3: Full test suite

```bash
pnpm test && pnpm lint && pnpm check && pnpm -r --if-present run build
```

### Step 4: Final commit

```bash
git commit -m "test(F188-I): E2E lifecycle verification — domain:finance create→rebuild→search [布偶猫🐾]"
```

---

## Phase I → Phase D Dependency (AC-I8)

Phase D (Chat→Collection materialization) must use lifecycle API:
- `cat_cafe_library_list` to show available collections
- `cat_cafe_library_create` if target collection doesn't exist
- Never bypass lifecycle to write manifest directly

This is a design contract, not code in this Phase.

---

## Commit Strategy

6 commits total, all on feature branch `feat/f188-phase-i`:
1. Type system + persistence CRUD
2. LibraryCatalog lifecycle methods
3. REST routes
4. MCP tools
5. Frontend UI
6. E2E verification

Single PR, squash merge (KD-9 precedent from Phase F).
