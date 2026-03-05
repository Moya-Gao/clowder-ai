# F058: Mission Control 增强 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** Fix 3 bugs (sync blindspot, no done status, missing dependencies) and add reliability + UX enhancements to Mission Control.

**Architecture:** Phase A focuses on `BacklogStatus` state machine extension (`done`), import sync upgrade (detect disappeared features), and dependency extraction from feature doc frontmatter/body. All changes propagate through shared types → BacklogStore port/Redis → routes → frontend.

**Tech Stack:** TypeScript, Fastify, Redis (ioredis), React/Next.js, Tailwind CSS, Zod, node:test

---

## Phase A: Bug 修复

### Task 1: Add `done` to BacklogStatus + BacklogAuditAction

**Files:**
- Modify: `packages/shared/src/types/backlog.ts:4` (BacklogStatus)
- Modify: `packages/shared/src/types/backlog.ts:33-43` (BacklogAuditAction)
- Modify: `packages/shared/src/types/backlog.ts:58-79` (BacklogItem — add `doneAt?`)
- Test: `packages/api/test/backlog-store.test.js`

**Step 1: Write the failing test**

In `packages/api/test/backlog-store.test.js`, add a new test block:

```javascript
await t.test('markDone transitions dispatched → done', async () => {
  const store = new BacklogStore();
  const item = store.create({ userId: 'u1', title: 'T', summary: 'S', priority: 'p2', tags: [], createdBy: 'user' });
  store.suggestClaim(item.id, { catId: 'claude-opus', why: 'w', plan: 'p', requestedPhase: 'coding' });
  store.decideClaim(item.id, { decision: 'approve', decidedBy: 'u1', note: 'ok' });
  store.markDispatched(item.id, { threadId: 'th1', threadPhase: 'coding', dispatchedBy: 'u1' });
  const done = store.markDone(item.id, { doneBy: 'u1' });
  assert.strictEqual(done.status, 'done');
  assert.ok(done.doneAt > 0);
  assert.strictEqual(done.audit.at(-1).action, 'done');
});

await t.test('markDone rejects non-dispatched items', async () => {
  const store = new BacklogStore();
  const item = store.create({ userId: 'u1', title: 'T', summary: 'S', priority: 'p2', tags: [], createdBy: 'user' });
  assert.throws(() => store.markDone(item.id, { doneBy: 'u1' }), /Invalid backlog transition/);
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/backlog-store.test.js`
Expected: FAIL — `store.markDone is not a function`

**Step 3: Update shared types**

In `packages/shared/src/types/backlog.ts`:

```typescript
// Line 4: Add 'done'
export type BacklogStatus = 'open' | 'suggested' | 'approved' | 'dispatched' | 'done';

// Line 33-43: Add 'done' to BacklogAuditAction
export type BacklogAuditAction =
  | 'created'
  | 'refreshed'
  | 'suggested'
  | 'approved'
  | 'rejected'
  | 'dispatched'
  | 'done'
  | 'lease_acquired'
  | 'lease_heartbeat'
  | 'lease_released'
  | 'lease_reclaimed';

// In BacklogItem interface, after dispatchedAt:
readonly doneAt?: number;

// New input interface at end of file:
export interface MarkDoneInput {
  readonly doneBy: string;
}
```

**Step 4: Rebuild shared package**

Run: `pnpm --filter @cat-cafe/shared build`

**Step 5: Add `markDone` to IBacklogStore interface and in-memory impl**

In `packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts`:

```typescript
// In IBacklogStore interface, add:
markDone(itemId: string, input: MarkDoneInput): BacklogItem | null | Promise<BacklogItem | null>;

// In BacklogStore class, add method:
markDone(itemId: string, input: MarkDoneInput): BacklogItem | null {
  const existing = this.items.get(itemId);
  if (!existing) return null;
  if (existing.status !== 'dispatched') {
    throw new BacklogTransitionError('Invalid backlog transition: only dispatched items can be marked done');
  }
  const now = Date.now();
  const updated: BacklogItem = {
    ...existing,
    status: 'done',
    updatedAt: now,
    doneAt: now,
    audit: [
      ...existing.audit,
      {
        id: generateSortableId(now + 1),
        action: 'done',
        actor: makeUserActor(input.doneBy),
        timestamp: now,
      },
    ],
  };
  this.items.set(itemId, updated);
  return updated;
}
```

Also update `EVICTION_PRIORITY` to include `done: 0` (same as dispatched — evict first):

```typescript
const EVICTION_PRIORITY: Record<BacklogStatus, number> = {
  done: 0,
  dispatched: 0,
  open: 1,
  suggested: 2,
  approved: 3,
};
```

**Step 6: Run test to verify it passes**

Run: `cd packages/api && node --test test/backlog-store.test.js`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/shared/src/types/backlog.ts packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts packages/api/test/backlog-store.test.js
git commit -m "feat(F058): add done status to BacklogStatus + markDone transition"
```

---

### Task 2: Add `markDone` to RedisBacklogStore

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts`
- Test: `packages/api/test/backlog-store.test.js` (existing test already covers in-memory; add Redis variant if pattern exists)

**Step 1: Write the failing test**

In `packages/api/test/backlog-store.test.js`, find the Redis test section and add:

```javascript
await t.test('RedisBacklogStore.markDone transitions dispatched → done', async () => {
  // Follow existing Redis test pattern (skip if no Redis)
  const store = new RedisBacklogStore(redisClient);
  const item = await store.create({ userId: 'u1', title: 'T', summary: 'S', priority: 'p2', tags: [], createdBy: 'user' });
  await store.suggestClaim(item.id, { catId: 'claude-opus', why: 'w', plan: 'p', requestedPhase: 'coding' });
  await store.decideClaim(item.id, { decision: 'approve', decidedBy: 'u1', note: 'ok' });
  await store.markDispatched(item.id, { threadId: 'th1', threadPhase: 'coding', dispatchedBy: 'u1' });
  const done = await store.markDone(item.id, { doneBy: 'u1' });
  assert.strictEqual(done.status, 'done');
  assert.ok(done.doneAt > 0);
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/backlog-store.test.js`
Expected: FAIL — `store.markDone is not a function`

**Step 3: Implement `markDone` in RedisBacklogStore**

Follow the same pattern as `markDispatched` in `RedisBacklogStore.ts`. Read the item from Redis, validate `status === 'dispatched'`, update status/doneAt/audit, write back.

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/backlog-store.test.js`
Expected: PASS (or skip if no Redis — that's ok)

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/stores/redis/RedisBacklogStore.ts packages/api/test/backlog-store.test.js
git commit -m "feat(F058): add markDone to RedisBacklogStore"
```

---

### Task 3: Add `POST /api/backlog/items/:id/mark-done` route

**Files:**
- Modify: `packages/api/src/routes/backlog.ts` (~line 200+ area, after dispatch routes)
- Test: `packages/api/test/backlog-routes.test.js`

**Step 1: Write the failing test**

In `packages/api/test/backlog-routes.test.js`, add:

```javascript
await t.test('POST /api/backlog/items/:id/mark-done transitions dispatched → done', async () => {
  // Create → suggest → approve → dispatch → mark-done
  const created = await createItem(app, { title: 'Done test', summary: 'S', priority: 'p2' });
  await suggestClaim(app, created.id, { catId: 'claude-opus', why: 'w', plan: 'p', requestedPhase: 'coding' });
  await decideClaim(app, created.id, { decision: 'approve', threadPhase: 'coding' });
  const res = await app.inject({
    method: 'POST',
    url: `/api/backlog/items/${created.id}/mark-done`,
    headers: testHeaders,
  });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.strictEqual(body.item.status, 'done');
  assert.ok(body.item.doneAt);
});

await t.test('POST /api/backlog/items/:id/mark-done rejects non-dispatched', async () => {
  const created = await createItem(app, { title: 'Reject done', summary: 'S', priority: 'p2' });
  const res = await app.inject({
    method: 'POST',
    url: `/api/backlog/items/${created.id}/mark-done`,
    headers: testHeaders,
  });
  assert.strictEqual(res.statusCode, 409);
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && node --test test/backlog-routes.test.js`
Expected: FAIL — 404 (route not found)

**Step 3: Add the route**

In `packages/api/src/routes/backlog.ts`, add after the dispatch/lease routes:

```typescript
app.post<{ Params: { id: string } }>('/api/backlog/items/:id/mark-done', async (request, reply) => {
  const userId = resolveUserId(request, {});
  if (!userId) {
    reply.status(401);
    return { error: 'Identity required' };
  }

  const itemId = request.params.id;
  try {
    const done = await backlogStore.markDone(itemId, { doneBy: userId });
    if (!done) {
      reply.status(404);
      return { error: 'Backlog item not found' };
    }
    return { item: done };
  } catch (err) {
    if (isTransitionError(err)) {
      reply.status(409);
      return { error: (err as Error).message };
    }
    throw err;
  }
});
```

**Step 4: Run test to verify it passes**

Run: `cd packages/api && node --test test/backlog-routes.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/backlog.ts packages/api/test/backlog-routes.test.js
git commit -m "feat(F058): add mark-done route for backlog items"
```

---

### Task 4: Import sync — detect "disappeared = done"

**Files:**
- Modify: `packages/api/src/routes/backlog.ts` (import-active-features route, ~line 233-308)
- Modify: `packages/api/src/routes/backlog-doc-import.ts` (add feature doc Status reading)
- Test: `packages/api/test/backlog-routes.test.js`
- Test: `packages/api/test/backlog-doc-import.test.js`

**Step 1: Write the failing tests**

In `packages/api/test/backlog-doc-import.test.js`, add:

```javascript
await t.test('readFeatureDocStatus returns done for Status: done in frontmatter', async () => {
  // This tests parsing a feature doc's YAML frontmatter for status
  const md = '---\nfeature_ids: [F099]\ndoc_kind: spec\n---\n\n# F099\n\n> **Status**: done\n';
  const status = parseFeatureDocStatus(md);
  assert.strictEqual(status, 'done');
});
```

In `packages/api/test/backlog-routes.test.js`, add:

```javascript
await t.test('import-active-features marks disappeared dispatched items as done', async () => {
  // Create a dispatched item with feature:f999 tag, then import with BACKLOG that has no F999
  const created = await createItem(app, {
    title: '[F999] Ghost',
    summary: 'S',
    priority: 'p2',
    tags: ['source:docs-backlog', 'feature:f999'],
  });
  // Move to dispatched
  await suggestClaim(app, created.id, { catId: 'claude-opus', why: 'w', plan: 'p', requestedPhase: 'coding' });
  await decideClaim(app, created.id, { decision: 'approve', threadPhase: 'coding' });
  // Now import — F999 not in BACKLOG.md → should mark done
  const res = await app.inject({
    method: 'POST',
    url: '/api/backlog/import-active-features',
    headers: testHeaders,
  });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload);
  assert.ok(body.markedDone > 0 || body.markedDoneIds?.includes(created.id));
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/api && node --test test/backlog-doc-import.test.js test/backlog-routes.test.js`
Expected: FAIL

**Step 3: Add `parseFeatureDocStatus` to backlog-doc-import.ts**

```typescript
/**
 * Parse a feature doc's body for "> **Status**: done" or similar patterns.
 * Returns the normalized status string or null.
 */
export function parseFeatureDocStatus(markdown: string): string | null {
  // Match "> **Status**: done" pattern (used in feature docs)
  const match = markdown.match(/>\s*\*\*Status\*\*:\s*(\w[\w\s-]*)/i);
  return match ? match[1].trim().toLowerCase() : null;
}
```

**Step 4: Update import route to mark disappeared items as done**

In the `import-active-features` route handler in `backlog.ts`, after the existing import loop, add logic:

```typescript
// After the for-of features loop, detect disappeared items
const importedFeatureIds = new Set(features.map((f) => f.id.toLowerCase()));
const markedDoneIds: string[] = [];
for (const [featureId, existingItem] of existingByFeatureId) {
  if (importedFeatureIds.has(featureId)) continue; // still in BACKLOG
  if (existingItem.status !== 'dispatched') continue; // only auto-done dispatched
  try {
    const done = await backlogStore.markDone(existingItem.id, { doneBy: userId });
    if (done) markedDoneIds.push(done.id);
  } catch {
    // transition error — skip silently
  }
}

// Update response to include markedDone count
return {
  totalActive: features.length,
  imported: importedItemIds.length,
  refreshed: refreshedItemIds.length,
  skipped,
  markedDone: markedDoneIds.length,
  importedItemIds,
  refreshedItemIds,
  markedDoneIds,
};
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/api && node --test test/backlog-doc-import.test.js test/backlog-routes.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/api/src/routes/backlog.ts packages/api/src/routes/backlog-doc-import.ts packages/api/test/backlog-routes.test.js packages/api/test/backlog-doc-import.test.js
git commit -m "feat(F058): import sync marks disappeared dispatched items as done"
```

---

### Task 5: Import sync — read feature doc `Status: done`

**Files:**
- Modify: `packages/api/src/routes/backlog-doc-import.ts` (add `readFeatureDocStatuses`)
- Modify: `packages/api/src/routes/backlog.ts` (import route uses doc statuses)
- Test: `packages/api/test/backlog-doc-import.test.js`

**Step 1: Write the failing test**

```javascript
await t.test('readFeatureDocStatuses reads done status from feature files', async () => {
  // This needs a tmp dir with feature docs — or mock fs
  const statuses = await readFeatureDocStatuses(tmpDocsDir);
  assert.strictEqual(statuses.get('f099'), 'done');
});
```

**Step 2: Implement `readFeatureDocStatuses`**

In `backlog-doc-import.ts`:

```typescript
import { readdir } from 'node:fs/promises';

export async function readFeatureDocStatuses(featuresDir?: string): Promise<Map<string, string>> {
  const dir = featuresDir ?? join(findMonorepoRoot(), 'docs', 'features');
  const result = new Map<string, string>();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return result;
  }
  for (const entry of entries) {
    const match = entry.match(/^(F\d{3})/i);
    if (!match) continue;
    const featureId = match[1].toLowerCase();
    try {
      const content = await readFile(join(dir, entry), 'utf-8');
      const status = parseFeatureDocStatus(content);
      if (status) result.set(featureId, status);
    } catch {
      // skip unreadable
    }
  }
  return result;
}
```

**Step 3: Use doc statuses in import route**

After the "disappeared" loop, add:

```typescript
// Also mark items whose feature doc says "done"
let featureDocStatuses: Map<string, string>;
try {
  featureDocStatuses = await readFeatureDocStatuses();
} catch {
  featureDocStatuses = new Map();
}
for (const [featureId, existingItem] of existingByFeatureId) {
  if (markedDoneIds.includes(existingItem.id)) continue; // already handled
  if (existingItem.status !== 'dispatched') continue;
  const docStatus = featureDocStatuses.get(featureId);
  if (docStatus !== 'done') continue;
  try {
    const done = await backlogStore.markDone(existingItem.id, { doneBy: userId });
    if (done) markedDoneIds.push(done.id);
  } catch {
    // skip
  }
}
```

**Step 4: Run tests**

Run: `cd packages/api && node --test test/backlog-doc-import.test.js test/backlog-routes.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/backlog-doc-import.ts packages/api/src/routes/backlog.ts packages/api/test/backlog-doc-import.test.js
git commit -m "feat(F058): import reads feature doc Status: done for completion sync"
```

---

### Task 6: Add `dependencies` to BacklogItem type

**Files:**
- Modify: `packages/shared/src/types/backlog.ts` (BacklogItem + CreateBacklogItemInput)
- Test: `packages/api/test/backlog-store.test.js`

**Step 1: Write the failing test**

```javascript
await t.test('create with dependencies preserves them', async () => {
  const store = new BacklogStore();
  const item = store.create({
    userId: 'u1', title: 'T', summary: 'S', priority: 'p2',
    tags: [], createdBy: 'user',
    dependencies: { evolvedFrom: ['f049'], related: ['f037'] },
  });
  assert.deepStrictEqual(item.dependencies, { evolvedFrom: ['f049'], related: ['f037'] });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL — `dependencies` not in type

**Step 3: Add types**

In `packages/shared/src/types/backlog.ts`:

```typescript
export interface BacklogDependencies {
  readonly evolvedFrom?: readonly string[];
  readonly blockedBy?: readonly string[];
  readonly related?: readonly string[];
}

// In BacklogItem, add after audit:
readonly dependencies?: BacklogDependencies;

// In CreateBacklogItemInput, add:
readonly dependencies?: BacklogDependencies;

// In RefreshBacklogItemInput, add:
readonly dependencies?: BacklogDependencies;
```

**Step 4: Rebuild shared + update BacklogStore.create to pass through dependencies**

Run: `pnpm --filter @cat-cafe/shared build`

In `BacklogStore.ts` `create()`, add `dependencies: input.dependencies` to the item object.
In `refreshMetadata()`, add `dependencies: input.dependencies ?? existing.dependencies` to the updated object.

**Step 5: Run test to verify it passes**

Run: `cd packages/api && node --test test/backlog-store.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/shared/src/types/backlog.ts packages/api/src/domains/cats/services/stores/ports/BacklogStore.ts packages/api/test/backlog-store.test.js
pnpm --filter @cat-cafe/shared build
git commit -m "feat(F058): add BacklogDependencies type to BacklogItem"
```

---

### Task 7: Extract dependencies from feature docs during import

**Files:**
- Modify: `packages/api/src/routes/backlog-doc-import.ts` (parse dependencies from feature docs)
- Modify: `packages/api/src/routes/backlog.ts` (pass dependencies during import)
- Test: `packages/api/test/backlog-doc-import.test.js`

**Step 1: Write the failing test**

```javascript
await t.test('parseFeatureDocDependencies extracts evolved-from and related', async () => {
  const md = [
    '---',
    'feature_ids: [F058]',
    'related_features: [F049, F037]',
    '---',
    '',
    '## Dependencies',
    '',
    '- **Evolved from**: F049（Mission Control MVP）',
    '- **Related**: F037（Agent Swarm）',
  ].join('\n');
  const deps = parseFeatureDocDependencies(md);
  assert.deepStrictEqual(deps.evolvedFrom, ['f049']);
  assert.deepStrictEqual(deps.related, ['f037']);
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL — `parseFeatureDocDependencies is not a function`

**Step 3: Implement `parseFeatureDocDependencies`**

In `backlog-doc-import.ts`:

```typescript
import type { BacklogDependencies } from '@cat-cafe/shared';

export function parseFeatureDocDependencies(markdown: string): BacklogDependencies {
  const result: { evolvedFrom: string[]; blockedBy: string[]; related: string[] } = {
    evolvedFrom: [], blockedBy: [], related: [],
  };

  // 1. Extract from frontmatter related_features
  const fmMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const relatedMatch = fmMatch[1].match(/related_features:\s*\[([^\]]*)\]/);
    if (relatedMatch) {
      const ids = relatedMatch[1].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      result.related.push(...ids);
    }
  }

  // 2. Extract from Dependencies section body
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const evolvedMatch = line.match(/\*\*Evolved from\*\*[:\s]*(\S+)/i);
    if (evolvedMatch) {
      const ids = extractFeatureIds(evolvedMatch[0]);
      result.evolvedFrom.push(...ids);
    }
    const blockedMatch = line.match(/\*\*Blocked by\*\*[:\s]*(\S+)/i);
    if (blockedMatch) {
      const ids = extractFeatureIds(blockedMatch[0]);
      result.blockedBy.push(...ids);
    }
  }

  // Deduplicate and remove related entries that are already in evolvedFrom/blockedBy
  const specialized = new Set([...result.evolvedFrom, ...result.blockedBy]);
  result.related = [...new Set(result.related)].filter((id) => !specialized.has(id));
  result.evolvedFrom = [...new Set(result.evolvedFrom)];
  result.blockedBy = [...new Set(result.blockedBy)];

  const deps: BacklogDependencies = {};
  if (result.evolvedFrom.length > 0) deps.evolvedFrom = result.evolvedFrom;
  if (result.blockedBy.length > 0) deps.blockedBy = result.blockedBy;
  if (result.related.length > 0) deps.related = result.related;
  return Object.keys(deps).length > 0 ? deps : {};
}

function extractFeatureIds(text: string): string[] {
  const matches = text.matchAll(/F\d{3}/gi);
  return [...matches].map((m) => m[0].toLowerCase());
}
```

**Step 4: Wire into `buildBacklogInputFromFeature`**

Update `buildBacklogInputFromFeature` to accept an optional `dependencies` parameter:

```typescript
export function buildBacklogInputFromFeature(
  row: BacklogFeatureRow,
  userId: string,
  dependencies?: BacklogDependencies,
): CreateBacklogItemInput {
  // ... existing code ...
  return {
    userId, title, summary, priority: statusToPriority(row.status),
    tags: [...],
    createdBy: 'user',
    ...(dependencies && Object.keys(dependencies).length > 0 ? { dependencies } : {}),
  };
}
```

**Step 5: Update import route to read & pass dependencies**

In the import route, for each feature, read the feature doc and extract dependencies:

```typescript
// Inside the features loop, before create/refresh:
let featureDeps: BacklogDependencies | undefined;
if (feature.link) {
  try {
    const docPath = join(findMonorepoRoot(), 'docs', feature.link);
    const content = await readFile(docPath, 'utf-8');
    featureDeps = parseFeatureDocDependencies(content);
  } catch { /* skip */ }
}
const importInput = buildBacklogInputFromFeature(feature, userId, featureDeps);
```

**Step 6: Run tests**

Run: `cd packages/api && node --test test/backlog-doc-import.test.js test/backlog-routes.test.js`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/api/src/routes/backlog-doc-import.ts packages/api/src/routes/backlog.ts packages/api/test/backlog-doc-import.test.js
git commit -m "feat(F058): extract and attach dependencies from feature docs during import"
```

---

### Task 8: Frontend — "已完成" collapsible section

**Files:**
- Modify: `packages/web/src/components/mission-control/MissionControlPage.tsx`
- Test: `packages/web/src/components/__tests__/mission-control-page.test.ts`

**Step 1: Write the failing test**

```typescript
await t.test('renders done items in collapsible section', async () => {
  // Mock items with status 'done'
  mockItems([
    { ...baseItem, id: 'done1', status: 'done', title: 'Done task' },
  ]);
  render(<MissionControlPage />);
  await waitFor(() => {
    const section = screen.getByTestId('mc-lane-done');
    expect(section).toBeTruthy();
    expect(section.textContent).toContain('Done task');
  });
});

await t.test('done section is collapsed by default', async () => {
  mockItems([{ ...baseItem, id: 'done1', status: 'done' }]);
  render(<MissionControlPage />);
  await waitFor(() => {
    const section = screen.getByTestId('mc-lane-done');
    // Content should be hidden by default
    const cards = within(section).queryAllByTestId('mc-card');
    expect(cards.length).toBe(0); // collapsed
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm test`
Expected: FAIL — no `mc-lane-done` testid

**Step 3: Implement**

In `MissionControlPage.tsx`:

1. Add `doneItems` memo:
```typescript
const doneItems = useMemo(() => items.filter((item) => item.status === 'done'), [items]);
```

2. Add collapsible Done lane after the 3 existing lanes:
```tsx
{doneItems.length > 0 && (
  <CollapsibleDoneLane items={doneItems} selectedItemId={selectedItemId} onSelect={setSelectedItemId} />
)}
```

3. Add `CollapsibleDoneLane` component (in same file or extract):
```tsx
function CollapsibleDoneLane({ items, selectedItemId, onSelect }: {
  items: BacklogItem[];
  selectedItemId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="col-span-full rounded-2xl border border-[#D4E8D0] bg-[#F6FBF5] p-3" data-testid="mc-lane-done">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-[#2C4A28]">已完成</h2>
          <p className="text-[11px] text-[#6B8F65]">Done · {items.length}</p>
        </div>
        <span className="text-xs text-[#6B8F65]">{expanded ? '收起 ▲' : '展开 ▼'}</span>
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MissionControlCard key={item.id} item={item} selected={selectedItemId === item.id} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/web && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/components/mission-control/MissionControlPage.tsx packages/web/src/components/__tests__/mission-control-page.test.ts
git commit -m "feat(F058): add collapsible Done lane in Mission Control UI"
```

---

### Task 9: Frontend — dependency labels on cards

**Files:**
- Modify: `packages/web/src/components/mission-control/MissionControlCard.tsx` (or wherever card renders)
- Test: `packages/web/src/components/__tests__/mission-control-page.test.ts`

**Step 1: Write the failing test**

```typescript
await t.test('renders dependency labels on card', async () => {
  mockItems([{
    ...baseItem,
    id: 'dep1',
    dependencies: { evolvedFrom: ['f049'], related: ['f037'] },
  }]);
  render(<MissionControlPage />);
  await waitFor(() => {
    expect(screen.getByText('← F049')).toBeTruthy();
    expect(screen.getByText('↔ F037')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL — no dependency labels rendered

**Step 3: Implement**

In `MissionControlCard.tsx`, add a dependency label row:

```tsx
{item.dependencies && (
  <div className="mt-1 flex flex-wrap gap-1">
    {item.dependencies.evolvedFrom?.map((id) => (
      <DependencyBadge key={`ef-${id}`} label={`← ${id.toUpperCase()}`} href={`/docs/features/${id.toUpperCase()}`} variant="evolved" />
    ))}
    {item.dependencies.blockedBy?.map((id) => (
      <DependencyBadge key={`bb-${id}`} label={`⊘ ${id.toUpperCase()}`} href={`/docs/features/${id.toUpperCase()}`} variant="blocked" />
    ))}
    {item.dependencies.related?.map((id) => (
      <DependencyBadge key={`rel-${id}`} label={`↔ ${id.toUpperCase()}`} href={`/docs/features/${id.toUpperCase()}`} variant="related" />
    ))}
  </div>
)}
```

With a small `DependencyBadge` component:

```tsx
function DependencyBadge({ label, variant }: { label: string; href: string; variant: 'evolved' | 'blocked' | 'related' }) {
  const colors = {
    evolved: 'border-blue-200 bg-blue-50 text-blue-700',
    blocked: 'border-red-200 bg-red-50 text-red-700',
    related: 'border-gray-200 bg-gray-50 text-gray-600',
  };
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${colors[variant]}`}>
      {label}
    </span>
  );
}
```

**Step 4: Run tests**

Run: `cd packages/web && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/web/src/components/mission-control/MissionControlCard.tsx packages/web/src/components/__tests__/mission-control-page.test.ts
git commit -m "feat(F058): display dependency labels on Mission Control cards"
```

---

### Task 10: Update flow description + quality checks

**Files:**
- Modify: `packages/web/src/components/mission-control/MissionControlPage.tsx` (flow description text)

**Step 1: Update the flow description**

Change line 356:
```
"面向手机/桌面统一收集与分配。流程：Open → Suggested → Dispatched。"
```
to:
```
"面向手机/桌面统一收集与分配。流程：Open → Suggested → Dispatched → Done。"
```

**Step 2: Run full test suite**

Run: `cd packages/api && node --test` and `cd packages/web && pnpm test`
Expected: all pass

**Step 3: Run quality checks**

Run: `pnpm check` (Biome) and `pnpm lint` (TypeScript)
Expected: clean

**Step 4: Commit**

```bash
git add packages/web/src/components/mission-control/MissionControlPage.tsx
git commit -m "feat(F058): update flow description to include Done status"
```

---

## Phase B: 可靠性增强 (separate PR)

> Phase B 和 Phase C 在 Phase A 合入后再出详细计划。以下是方向性 outline。

### Task B1: Lua 原子派发 (TBD)
- 将 `dispatchApprovedItem` 的多步操作（状态→thread→message→标记）封装为 Lua 脚本
- Fallback: 保留现有非原子路径

### Task B2: 幂等硬化 (TBD)
- `dispatchAttemptId ?? 'pending'` → 硬前置（无 attemptId 抛错）
- Redis idempotency key 升级为 TTL lock

## Phase C: UX 增强 (separate PR)

### Task C1: Feature 鸟瞰态势图 (TBD)
### Task C2: 查询安全限制 (TBD)
### Task C3: 时间显示优化 (TBD)

---

## Checklist

- [ ] `pnpm --filter @cat-cafe/shared build` after type changes
- [ ] `pnpm check` (Biome) clean
- [ ] `pnpm lint` (TypeScript) clean
- [ ] All new tests pass
- [ ] No `any` types introduced
- [ ] Files under 350 lines
- [ ] LSP diagnostics checked after each Edit
