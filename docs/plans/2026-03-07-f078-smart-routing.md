# F078: Smart Routing & Group Mentions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** When no @mention is present, route to the last replier (not all participants). Add group mentions: @all, @全体{breed}, @thread.

**Architecture:** All changes are in `AgentRouter.ts` — add a `parseGroupMentions()` method called before `parseMentions()`, and change `peekTargets`/`resolveTargets` to take only the first participant instead of all. Group mentions use `catRegistry.getAllConfigs()` + `breedId` field to resolve breed groups.

**Tech Stack:** Node.js, TypeScript, node:test

---

### Task 1: Add group mention parsing tests (RED)

**Files:**
- Modify: `packages/api/test/agent-router.test.js`

**Step 1: Write failing tests for @all**

```js
describe('F078: Group mentions', () => {
  test('@all routes to all registered cats', async () => {
    const router = createRouter();
    const { targetCats } = await router.resolveTargetsAndIntent('@all 大家好');
    // Should include all cats with services registered
    assert.ok(targetCats.length > 1, 'should route to multiple cats');
    assert.ok(targetCats.includes('opus'), 'should include opus');
    assert.ok(targetCats.includes('codex'), 'should include codex');
  });

  test('@全体 routes to all registered cats', async () => {
    const router = createRouter();
    const { targetCats } = await router.resolveTargetsAndIntent('@全体 大家好');
    assert.ok(targetCats.length > 1);
  });

  test('@全体布偶猫 routes to all ragdoll variants', async () => {
    const router = createRouter();
    const { targetCats } = await router.resolveTargetsAndIntent('@全体布偶猫 你们好');
    assert.ok(targetCats.includes('opus'));
    assert.ok(targetCats.includes('sonnet'));
    // Should NOT include non-ragdoll cats
    assert.ok(!targetCats.includes('codex'));
  });

  test('@all-ragdoll routes to all ragdoll variants', async () => {
    const router = createRouter();
    const { targetCats } = await router.resolveTargetsAndIntent('@all-ragdoll hello');
    assert.ok(targetCats.includes('opus'));
    assert.ok(targetCats.includes('sonnet'));
  });

  test('@thread routes to thread participants', async () => {
    const threadStore = createMockThreadStore({ 't1': ['opus', 'codex'] });
    const router = createRouter({ threadStore });
    const { targetCats } = await router.resolveTargetsAndIntent('@thread 大家看看', 't1');
    assert.deepStrictEqual(new Set(targetCats), new Set(['opus', 'codex']));
  });

  test('@本帖 routes to thread participants', async () => {
    const threadStore = createMockThreadStore({ 't1': ['opus', 'gemini'] });
    const router = createRouter({ threadStore });
    const { targetCats } = await router.resolveTargetsAndIntent('@本帖 看看', 't1');
    assert.deepStrictEqual(new Set(targetCats), new Set(['opus', 'gemini']));
  });

  test('@thread with no participants falls back to default cat', async () => {
    const threadStore = createMockThreadStore({});
    const router = createRouter({ threadStore });
    const { targetCats } = await router.resolveTargetsAndIntent('@thread hello', 't1');
    assert.deepStrictEqual(targetCats, ['opus']);
  });

  test('group mentions skip unavailable cats', async () => {
    // Cats not in services map are naturally skipped
    // since parseGroupMentions filters against this.services
  });

  test('individual @mention still works alongside group mentions', async () => {
    const router = createRouter();
    const { targetCats } = await router.resolveTargetsAndIntent('@opus 你好');
    assert.deepStrictEqual(targetCats, ['opus']);
  });
});
```

**Step 2: Run to verify RED**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f078-smart-routing
pnpm --filter @cat-cafe/api test -- --test-name-pattern "F078"
```

Expected: FAIL (resolveTargetsAndIntent doesn't handle group mentions yet)

---

### Task 2: Add default-to-last-replier tests (RED)

**Files:**
- Modify: `packages/api/test/agent-router.test.js`

**Step 1: Write failing test**

```js
describe('F078: Default to last replier', () => {
  test('no @mention routes to most recent replier only', async () => {
    const threadStore = createMockThreadStore({ 't1': ['opus', 'codex', 'gemini'] });
    // Simulate opus replied most recently (activity sorting)
    threadStore.updateParticipantActivity('t1', 'codex');
    threadStore.updateParticipantActivity('t1', 'opus'); // most recent
    const router = createRouter({ threadStore });
    const { targetCats } = await router.resolveTargetsAndIntent('hello', 't1');
    assert.deepStrictEqual(targetCats, ['opus'], 'should route to last replier only');
  });

  test('no participants defaults to opus', async () => {
    const threadStore = createMockThreadStore({});
    const router = createRouter({ threadStore });
    const { targetCats } = await router.resolveTargetsAndIntent('hello', 't1');
    assert.deepStrictEqual(targetCats, ['opus']);
  });
});
```

**Step 2: Run to verify RED**

Expected: FAIL — currently returns ALL participants, not just the first one.

---

### Task 3: Implement group mention parsing (GREEN)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts`

**Step 1: Add `parseGroupMentions` method**

Add a new private method that checks for group patterns BEFORE individual mention parsing. Returns `CatId[] | null` — null means "no group mention found, fall through to parseMentions".

Group patterns (longest first for collision safety):
- `@全体参与者` → thread participants
- `@全体布偶猫`, `@全体缅因猫`, `@全体暹罗猫`, `@全体狸花猫`, `@全体孟加拉猫` → breed variants
- `@all-ragdoll`, `@all-maine-coon`, `@all-siamese`, `@all-dragon-li`, `@all-bengal` → breed variants
- `@thread`, `@本帖` → thread participants
- `@全体`, `@all` → all available cats

Key implementation:
1. Build group patterns from `cat-config.json` breeds array (not hardcoded)
2. Use `catRegistry.getAllConfigs()` and filter by `breedId` to get breed variants
3. Filter results against `this.services` (only cats with registered services)
4. `@thread`/`@本帖`/`@全体参与者` needs threadId → passed to parseMentions, forwarded here

**Step 2: Wire into `parseMentions` / create a new top-level parse method**

Since `@thread` needs threadId (which `parseMentions` doesn't have), create a wrapper:

```typescript
private async parseAllMentions(message: string, threadId: string): Promise<CatId[]> {
  const groupResult = await this.parseGroupMentions(message, threadId);
  if (groupResult !== null) return groupResult;
  return this.parseMentions(message);
}
```

Then replace `this.parseMentions(message)` calls in `peekTargets` and `resolveTargets` with `this.parseAllMentions(message, threadId)`.

**Step 3: Run tests**

Expected: Group mention tests → GREEN

---

### Task 4: Implement default-to-last-replier (GREEN)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts`

**Step 1: Change participant fallback to take only first**

In both `peekTargets` and `resolveTargets`, change:
```typescript
// BEFORE (routes to ALL participants)
return this.applyThreadRoutingPolicy(thread, message, participantsWithActivity.map(p => p.catId));

// AFTER (routes to LAST REPLIER only)
return this.applyThreadRoutingPolicy(thread, message, [participantsWithActivity[0].catId]);
```

**Step 2: Run tests**

Expected: Last-replier tests → GREEN, existing tests still pass.

---

### Task 5: Update file header comment + commit

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` (header comment)

**Step 1: Update the file header**

Change line 7-8 from:
```
 * - 无 @ 提及时路由到对话中所有活跃参与者
```
To:
```
 * - 无 @ 提及时路由到最近回复的猫（F078）
 * - 群组 mention: @all/@全体, @全体{breed}, @thread/@本帖 (F078)
```

**Step 2: Run full test suite**

```bash
pnpm --filter @cat-cafe/api test
```

Expected: ALL tests pass.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(F078): smart routing — default last replier + group mentions [布偶猫🐾]"
```
