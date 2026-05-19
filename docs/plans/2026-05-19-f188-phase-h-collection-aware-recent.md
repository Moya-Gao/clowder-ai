# F188 Phase H: Collection-Aware Recent Selection — Implementation Plan

**Feature:** F188 — `docs/features/F188-library-stewardship.md`
**Goal:** Fix collection overlap privacy leak + make list_recent fair across collections via guaranteed-minimum selection
**Acceptance Criteria:**
- AC-H1: Collection overlap cleanup — parent scanner excludes child collection roots; private child docs don't leak through parent
- AC-H2: Guaranteed Minimum selection — each eligible collection gets ≥1 slot; best-of-rest fills remainder
- AC-H3: Return `groups: SelectionGroup[]` metadata
- AC-H4: MCP text footer shows collection distribution
- AC-H5: Regression fixtures — cross-collection burst + overlap privacy
- AC-H6: RecentBrowsePanel UI → N/A (only consumes tool-usage-metrics aggregates)
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** Extends existing RecentBrowseResolver + factory registration; no new Store/Queue/Router
**Architecture:** Modify factory.ts to compute child collection root excludes before registering project:cat-cafe. Modify RecentBrowseResolver.list() to use guaranteed-minimum + best-of-rest selection instead of global sort+slice. Add SelectionGroup to response type.
**Tech Stack:** TypeScript, better-sqlite3, Fastify
**前端验证:** No — RecentBrowsePanel doesn't consume list_recent items (AC-H6 N/A)

---

## What we're NOT building

- Kind/path-prefix bucketing within a collection (YAGNI — P3 follow-up if intra-collection burst becomes a real pain point)
- UI changes to RecentBrowsePanel
- Changes to search_evidence or graph_resolve selection
- New MCP tools

## Terminal Schema

```typescript
// In RecentBrowseResolver.ts — extended response
export interface SelectionGroup {
  key: string;
  type: 'collection';
  label: string;
  count: number;
  available: number;
}

export interface ListRecentResult {
  items: RecentItem[];      // unchanged shape, global updatedAt order
  groups?: SelectionGroup[];  // new: per-collection metadata
  nudge?: string;
}
```

```typescript
// In factory.ts — computed exclude
// project:cat-cafe gets exclude: ['library/finance/**'] derived from child collection roots
```

---

### Task 1: Collection Overlap Exclusion in factory.ts

**Files:**
- Modify: `packages/api/src/domains/memory/factory.ts:155-207`
- Test: `packages/api/test/memory/collection-overlap.test.js` (new)

**Step 1: Write failing test — private child docs leak through parent list_recent**

```javascript
// collection-overlap.test.js
test('list_recent from parent does not include docs owned by private child collection', async () => {
  // Setup: parent collection root = tmpDir/docs, child root = tmpDir/docs/library/finance
  // Child is private, parent is internal
  // Index both, then list_recent on parent store
  // Assert: no finance docs in parent results
});
```

Run: `node --test packages/api/test/memory/collection-overlap.test.js`
Expected: FAIL (finance docs appear in parent)

**Step 2: Write failing test — parent rebuild cleans up historical child rows**

```javascript
test('parent rebuild removes rows that now belong to child collection', async () => {
  // Setup: first index parent WITHOUT exclude (simulating current state)
  // Then add child collection and rebuild parent WITH exclude
  // Assert: finance rows gone from parent store
});
```

Run: `node --test packages/api/test/memory/collection-overlap.test.js`
Expected: FAIL

**Step 3: Implement child-root exclude computation in factory.ts**

In `factory.ts`, reorder the initialization:
1. Load external manifests first (metadata only, no stores)
2. Compute which external roots are children of `docsRoot`
3. Register `project:cat-cafe` with computed `exclude`
4. Then register external collections with their stores

```typescript
// factory.ts — after line 159 (const now = ...)

// Pre-load external manifests to compute child excludes
const dataDir = join(homedir(), '.cat-cafe');
const externals = loadExternalCollections(dataDir);
const childExcludes = computeChildExcludes(docsRoot, externals);

catalog.register({
  id: 'project:cat-cafe',
  // ... existing fields ...
  exclude: childExcludes.length > 0 ? childExcludes : undefined,
});
```

Add helper:
```typescript
function computeChildExcludes(parentRoot: string, children: CollectionManifest[]): string[] {
  const absParent = resolve(parentRoot);
  const excludes: string[] = [];
  for (const child of children) {
    const absChild = resolve(child.root);
    if (absChild.startsWith(absParent + '/') && absChild !== absParent) {
      const rel = relative(absParent, absChild);
      excludes.push(`${rel}/**`);
    }
  }
  return excludes;
}
```

**Step 4: Run tests to verify green**

Run: `node --test packages/api/test/memory/collection-overlap.test.js`
Expected: PASS

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All existing tests pass (no regression)

**Step 6: Commit**

```bash
git add packages/api/src/domains/memory/factory.ts packages/api/test/memory/collection-overlap.test.js
git commit -m "fix(memory): exclude child collection roots from parent scanner (AC-H1)"
```

---

### Task 2: Guaranteed Minimum Selection Algorithm

**Files:**
- Modify: `packages/api/src/domains/memory/RecentBrowseResolver.ts:88-146`
- Test: `packages/api/test/memory/recent-browse-resolver.test.js` (existing or new)

**Step 1: Write failing test — cross-collection burst regression**

```javascript
test('guaranteed minimum: each collection gets ≥1 item even when one collection dominates', () => {
  // Setup: 3 collections
  //   - collA: 50 items (all recent)
  //   - collB: 3 items (older)
  //   - collC: 3 items (older)
  // list(limit=20)
  // Assert: all 3 collections represented in results
  // Assert: collB has ≥1, collC has ≥1
  // Assert: total = 20
  // Assert: items sorted by updatedAt desc
});
```

Run: `node --test packages/api/test/memory/recent-browse-resolver.test.js`
Expected: FAIL (collB/collC get squeezed out)

**Step 2: Write failing test — eligible > limit edge case**

```javascript
test('guaranteed minimum: when eligible collections > limit, each gets 1 item by recency', () => {
  // Setup: 25 collections each with 1 item, limit=20
  // Assert: 20 items returned, from the 20 collections with most recent items
});
```

**Step 3: Implement guaranteed minimum selection**

Replace lines 143-145 in `RecentBrowseResolver.ts`:

```typescript
const items = applyGuaranteedMinimum(results, opts.limit);
```

Add method:

```typescript
private applyGuaranteedMinimum(results: RecentItem[], limit: number): RecentItem[] {
  // Group by source (collection)
  const byCollection = new Map<string, RecentItem[]>();
  for (const r of results) {
    const list = byCollection.get(r.source) ?? [];
    list.push(r);
    byCollection.set(r.source, list);
  }

  // Sort each collection's items by updatedAt desc
  for (const list of byCollection.values()) {
    list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  const eligible = byCollection.size;
  if (eligible === 0) return [];

  // If more eligible collections than limit, pick top collections by most recent item
  if (eligible > limit) {
    const sorted = [...byCollection.entries()]
      .sort((a, b) => (a[1][0].updatedAt < b[1][0].updatedAt ? 1 : -1))
      .slice(0, limit);
    return sorted.map(([, items]) => items[0])
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }

  // Guaranteed minimum: 1 per collection
  const selected = new Set<string>();
  const guaranteed: RecentItem[] = [];
  for (const [collId, items] of byCollection) {
    guaranteed.push(items[0]);
    selected.add(`${collId}:${items[0].anchor}`);
  }

  // Best-of-rest: fill remaining slots from global pool
  const remaining = limit - guaranteed.length;
  if (remaining > 0) {
    const rest = results
      .filter((r) => !selected.has(`${r.source}:${r.anchor}`))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
      .slice(0, remaining);
    guaranteed.push(...rest);
  }

  // Final sort by updatedAt desc
  return guaranteed.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}
```

**Step 4: Run tests to verify green**

Run: `node --test packages/api/test/memory/recent-browse-resolver.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git commit -m "feat(memory): guaranteed minimum selection for list_recent (AC-H2)"
```

---

### Task 3: SelectionGroup API + Response

**Files:**
- Modify: `packages/api/src/domains/memory/RecentBrowseResolver.ts` (types + groups computation)
- Modify: `packages/api/src/routes/library.ts` (pass through groups)
- Test: existing test from Task 2 extended

**Step 1: Write failing test — groups metadata returned**

```javascript
test('list returns groups metadata with count and available per collection', () => {
  // Setup: 2 collections, collA has 10 items, collB has 5
  // list(limit=10)
  // Assert: result.groups is array of SelectionGroup
  // Assert: groups[0].type === 'collection'
  // Assert: sum of groups[].count === items.length
  // Assert: groups[].available reflects total available per collection
});
```

**Step 2: Implement SelectionGroup computation**

Add to `RecentBrowseResolver.ts`:

```typescript
export interface SelectionGroup {
  key: string;
  type: 'collection';
  label: string;
  count: number;
  available: number;
}
```

After `applyGuaranteedMinimum`, compute groups from selected items + raw counts.

**Step 3: Run tests, commit**

```bash
git commit -m "feat(memory): add SelectionGroup metadata to list_recent response (AC-H3)"
```

---

### Task 4: MCP Text Footer

**Files:**
- Modify: `packages/mcp-server/src/tools/recent-tools.ts` (footer rendering)
- Test: `packages/mcp-server/test/tools/recent-tools.test.js` (if exists, or inline)

**Step 1: Write failing test — footer shows collection distribution**

```javascript
test('MCP text includes collection distribution footer when groups present', () => {
  // Mock API response with groups
  // Assert text contains "Collections: finance(6) | cat-cafe(6) | lexander(8)"
});
```

**Step 2: Implement footer rendering**

In `recent-tools.ts`, after the items rendering, add:

```typescript
if (data.groups && data.groups.length > 1) {
  const distribution = data.groups
    .map((g) => `${g.label}(${g.count})`)
    .join(' | ');
  lines.push('', `Collections: ${distribution}`);
}
```

**Step 3: Verify deriveResultSummary compatibility**

Read `derive-result-summary.ts` to confirm the footer line doesn't break existing regex parsing. The parser looks for `Recent items (last Xs): N found` header and item lines — a trailing footer line should be ignored.

**Step 4: Run tests, commit**

```bash
git commit -m "feat(memory): MCP text footer shows collection distribution (AC-H4)"
```

---

### Task 5: Integration Regression Fixtures (AC-H5)

**Files:**
- Test: `packages/api/test/memory/recent-browse-selection.test.js` (new, end-to-end)

**Step 1: Cross-collection burst fixture**

```javascript
test('AC-H5 regression: 3 collections, 1 dominant, all represented in limit=20', () => {
  // Setup: catalog with 3 collections
  // collA: 50 docs (all from today)
  // collB: 3 docs (from yesterday)
  // collC: 3 docs (from yesterday)
  // list(scope=docs, limit=20)
  // Assert: items includes at least 1 from collB and 1 from collC
  // Assert: items.length === 20
});
```

**Step 2: Overlap privacy fixture**

```javascript
test('AC-H5 regression: private child collection docs not visible via parent list_recent', () => {
  // Setup: parent internal, child private
  // Both indexed
  // list_recent without callerCollections for child
  // Assert: no child docs in results
});
```

**Step 3: Run all tests, commit**

```bash
git commit -m "test(memory): AC-H5 regression fixtures for collection burst + privacy overlap"
```

---

### Task 6: Final Verification + Cleanup

**Step 1: Run full test suite**

```bash
pnpm test && pnpm lint && pnpm check && pnpm -r --if-present run build
```

**Step 2: Update F188 spec AC-H6 evidence**

Add inline comment in spec: `RecentBrowsePanel` only consumes `/api/library/tool-usage-metrics` (confirmed in `ToolUsageMetricsPanel.tsx`), not list_recent item payload.

**Step 3: Final commit**

```bash
git commit -m "docs(F188): AC-H6 N/A evidence — RecentBrowsePanel doesn't consume list_recent"
```

---

## Open Questions

- **Technical OQ**: Does `project:cat-cafe` need an explicit rebuild after adding child excludes, or does the next `autoRebuild` cycle handle it? → Self-resolve during implementation: check if `indexPolicy.autoRebuild: true` triggers on startup.

## Commit History Target

1. `fix(memory): exclude child collection roots from parent scanner (AC-H1)`
2. `feat(memory): guaranteed minimum selection for list_recent (AC-H2)`
3. `feat(memory): add SelectionGroup metadata to list_recent response (AC-H3)`
4. `feat(memory): MCP text footer shows collection distribution (AC-H4)`
5. `test(memory): AC-H5 regression fixtures for collection burst + privacy overlap`
6. `docs(F188): AC-H6 N/A evidence`
