# F211 Phase C JSON Shadow State Retirement Implementation Plan

**Feature:** F211 — `docs/features/F211-cross-runtime-session-transparency.md`
**Goal:** Retire `data/antigravity-sessions.json` as a canonical Antigravity cascade binding source so SessionChainStore / RuntimeSessionStore own reuse, reset, and migration.
**Acceptance Criteria:**
- AC-C1: `data/antigravity-sessions.json` is no longer the canonical source for cascade reuse.
- AC-C2: Existing JSON state has a one-time migration path or an explicit safe discard decision.
- AC-C3: Bridge reset / retire writes through canonical session binding state.
- AC-C4: Tests prove SessionChainStore is the single source of truth for cascade binding after migration.
**Architecture cell:** `identity-session` + `memory`
**Map delta:** none
**Map delta why:** F211 already updated the ownership map in Phase 0; Phase C removes a legacy shadow source inside the existing `identity-session` runtime-session ownership boundary.
**Architecture:** Runtime session metadata remains the canonical sidecar for Antigravity cascade bindings. `AntigravityBridge` must resolve active dispatch cascades from `RuntimeSessionStore.getActiveByThreadCat(...)`, while legacy JSON is only an explicit import input handled by `antigravity-runtime-session-import.ts`. SessionChainStore remains the SessionRecord envelope source; memory only consumes resulting evidence.
**Tech Stack:** TypeScript, Node test runner, `AntigravityBridge`, `AntigravityAgentService`, `RuntimeSessionStore`, `RedisRuntimeSessionStore`, existing legacy import helper.
**前端验证:** No — backend/runtime-session only.

---

## Finish Line

Phase C is done when production Antigravity dispatch can no longer reuse, create, reset, or retire a cascade through `data/antigravity-sessions.json`.

The final state:
- Active cascade reuse is driven by `RuntimeSessionStore.getActiveByThreadCat('antigravity-desktop', threadId, catId)`.
- Legacy JSON import remains an explicit one-time migration path with diagnostics and audit evidence; it is not called from Bridge reuse.
- `resetSession()` seals or retires the active runtime-session metadata through `RuntimeSessionStore.updateLifecycle(...)`.
- `AntigravityAgentService` does not silently enable JSON fallback when no runtime store is injected.

Not building:
- Phase E Hub UI for human browsing.
- Phase D generic `Session.kind`.
- Full Antigravity transcript import.
- A user-facing migration wizard.

## Terminal Contract

### Binding Source

`AntigravityBridge.getOrCreateSession(threadId, catId)` has two modes:

1. Runtime-store mode: if `runtimeSessionStore` exists and `catId` is known, only runtime metadata can provide reusable active cascade ids.
2. Explicit legacy mode: `legacyJsonSessionStore: true` is allowed only for rescue/test compatibility and is never enabled by `AntigravityAgentService` by default.

Runtime-store mode must not call `loadSessionMap()` or `persistSessionMap()`.

### Reset / Retire

`AntigravityBridge.resetSession(threadId, catId)` becomes async:

```ts
await bridge.resetSession(threadId, catId);
```

When `runtimeSessionStore` and `catId` are present, it:
- reads the active runtime metadata via `getActiveByThreadCat(...)`;
- no-ops if no active binding exists;
- calls `updateLifecycle(active.sessionId, { state: 'sealed', sealReason: 'user_initiated', drainResult: 'complete', lastObservedAt: now })`.

Use the existing `user_initiated` seal reason because reset is a user-visible manual reset path and AC-A5 already names it.

Legacy JSON deletion remains available only when an explicit `legacyJsonSessionStore: true` bridge is constructed.

### Migration

`packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-runtime-session-import.ts` remains the one-time migration boundary. It reads JSON, resolves each cascade through `SessionChainStore.getByCliSessionId(...)`, validates identity, and upserts runtime metadata.

Phase C adds or tightens audit evidence around this importer, but does not auto-run it from normal Bridge reuse. Missing or invalid JSON is a diagnostic, not a fallback runtime source.

## Task 1: Red Tests For Removing Runtime-Store JSON Fallback

**Files:**
- Modify: `packages/api/test/antigravity-bridge-session.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`

**Step 1: Replace the old fallback expectation with a failing Phase C test**

Change the existing A2 test named `F211 A2 Task 4: legacy JSON fallback is read-only and does not migrate keys` into:

```js
test('F211 C1: runtime-store mode ignores legacy JSON fallback when no active binding exists', async () => {
  const storePath = tempStorePath();
  cleanupPaths.push(storePath);
  fs.writeFileSync(storePath, JSON.stringify({ 'thread-legacy': 'cascade-legacy' }));
  const runtimeSessionStore = createRuntimeSessionStoreProbe();
  const bridge = new AntigravityBridge(
    { port: 1234, csrfToken: 'test', useTls: false },
    { sessionStorePath: storePath, runtimeSessionStore },
  );

  mock.method(bridge, 'startCascade', async () => 'cascade-fresh');
  mock.method(bridge, 'getTrajectory', async () => {
    throw new Error('legacy JSON must not be read in runtime-store mode');
  });

  const id = await bridge.getOrCreateSession('thread-legacy', 'antig-opus');
  assert.equal(id, 'cascade-fresh');
  assert.equal(bridge.startCascade.mock.callCount(), 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(storePath, 'utf8')), { 'thread-legacy': 'cascade-legacy' });
});
```

**Step 2: Run the red test**

Run:

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/antigravity-bridge-session.test.js
```

Expected: FAIL because current runtime-store mode still calls `loadSessionMap()` and reuses `cascade-legacy`.

**Step 3: Implement minimal Bridge change**

In `AntigravityBridge.getOrCreateSession(...)`, change:

```ts
const canReadLegacyJson = this.runtimeSessionStore !== undefined || this.legacyJsonSessionStore;
```

to:

```ts
const canReadLegacyJson = this.runtimeSessionStore === undefined && this.legacyJsonSessionStore;
```

Keep the existing explicit legacy branch for rescue/test compatibility.

**Step 4: Run the test green**

Run the same command. Expected: PASS.

**Step 5: Commit**

```bash
git add packages/api/test/antigravity-bridge-session.test.js \
  packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts
git commit -m "test(F211): lock runtime-store cascade reuse to canonical metadata" \
  -m "Why: Phase C must prove legacy Antigravity JSON cannot remain a fallback source when runtime metadata is available."
```

## Task 2: Stop AgentService From Enabling JSON By Default

**Files:**
- Modify: `packages/api/test/antigravity-agent-service.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/types.ts` if the options type is split out there; otherwise modify the local options interface.

**Step 1: Write the failing constructor test**

Add a test that constructs `AntigravityAgentService` without `runtimeSessionStore` and verifies the owned bridge is not put into legacy JSON mode. If direct field inspection is not available, inject a temp JSON path and prove `invoke()` / `getOrCreateSession()` does not create or reuse it through a bridge diagnostic helper.

Preferred small seam:

```ts
getLegacyJsonSessionStoreForDiagnostics(): boolean {
  return this.legacyJsonSessionStore;
}
```

Test shape:

```js
test('F211 C1: AgentService does not enable legacy JSON fallback by default', async () => {
  const service = new AntigravityAgentService({
    connection: { port: 1234, csrfToken: 'test', useTls: false },
  });
  assert.equal(service.getBridgeForDiagnostics().getLegacyJsonSessionStoreForDiagnostics(), false);
});
```

If `getBridgeForDiagnostics()` does not exist, add it only under the existing diagnostics pattern used by `getRuntimeSessionStoreForDiagnostics()`.

**Step 2: Run the red test**

Run:

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/antigravity-agent-service.test.js
```

Expected: FAIL because the constructor currently passes `legacyJsonSessionStore: options?.runtimeSessionStore === undefined`.

**Step 3: Implement explicit opt-in**

Change `AntigravityAgentServiceOptions` to include:

```ts
legacyJsonSessionStore?: boolean;
```

Construct the owned bridge with:

```ts
legacyJsonSessionStore: options?.legacyJsonSessionStore === true,
```

No production path should set this flag.

**Step 4: Run the test green**

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/api/test/antigravity-agent-service.test.js \
  packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts
git commit -m "fix(F211): make Antigravity JSON fallback explicit opt-in" \
  -m "Why: Phase C retires JSON as production cascade-binding state; AgentService must not silently revive it when runtime metadata is unavailable."
```

## Task 3: Canonical Reset / Retire Lifecycle

**Files:**
- Modify: `packages/api/test/antigravity-bridge-session.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`

**Step 1: Write the failing reset test**

Replace `F211 A2 Task 4: resetSession no longer mutates JSON in runtime-store mode` with:

```js
test('F211 C3: resetSession seals active runtime metadata in runtime-store mode', async () => {
  const storePath = tempStorePath();
  cleanupPaths.push(storePath);
  fs.writeFileSync(storePath, JSON.stringify({ 'thread-reset:antig-opus': 'cascade-json' }));
  const runtimeSessionStore = createRuntimeSessionStoreProbe();
  runtimeSessionStore.getActiveByThreadCat = mock.fn(async () =>
    runtimeMetadata({
      sessionId: 'session-runtime',
      runtimeSessionId: 'cascade-runtime',
      threadId: 'thread-reset',
      catId: 'antig-opus',
    }),
  );
  runtimeSessionStore.updateLifecycle = mock.fn(async (_sessionId, patch) =>
    runtimeMetadata({
      sessionId: 'session-runtime',
      runtimeSessionId: 'cascade-runtime',
      threadId: 'thread-reset',
      catId: 'antig-opus',
      lifecycle: {
        state: patch.state,
        startedAt: 1000,
        lastObservedAt: patch.lastObservedAt,
        sealReason: patch.sealReason,
        drainResult: patch.drainResult,
      },
    }),
  );
  const bridge = new AntigravityBridge(
    { port: 1234, csrfToken: 'test', useTls: false },
    { sessionStorePath: storePath, runtimeSessionStore },
  );

  await bridge.resetSession('thread-reset', 'antig-opus');

  assert.equal(runtimeSessionStore.getActiveByThreadCat.mock.callCount(), 1);
  assert.equal(runtimeSessionStore.updateLifecycle.mock.callCount(), 1);
  assert.equal(runtimeSessionStore.updateLifecycle.mock.calls[0].arguments[0], 'session-runtime');
  assert.equal(runtimeSessionStore.updateLifecycle.mock.calls[0].arguments[1].state, 'sealed');
  assert.equal(runtimeSessionStore.updateLifecycle.mock.calls[0].arguments[1].sealReason, 'user_initiated');
  assert.equal(runtimeSessionStore.updateLifecycle.mock.calls[0].arguments[1].drainResult, 'complete');
  assert.deepEqual(JSON.parse(fs.readFileSync(storePath, 'utf8')), { 'thread-reset:antig-opus': 'cascade-json' });
});
```

**Step 2: Run red**

Run:

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/antigravity-bridge-session.test.js
```

Expected: FAIL because `resetSession()` currently no-ops when runtime store exists.

**Step 3: Make `resetSession` async and canonical**

Change the signature:

```ts
async resetSession(threadId: string, catId?: string): Promise<void>
```

Runtime-store branch:

```ts
if (this.runtimeSessionStore && catId) {
  const active = await this.runtimeSessionStore.getActiveByThreadCat('antigravity-desktop', threadId, catId as CatId);
  if (!active) return;
  const now = Date.now();
  await this.runtimeSessionStore.updateLifecycle(active.sessionId, {
    state: 'sealed',
    lastObservedAt: Math.max(active.lifecycle.lastObservedAt, now),
    sealReason: 'user_initiated',
    drainResult: 'complete',
  });
  return;
}
```

Legacy branch remains only for `legacyJsonSessionStore: true`.

**Step 4: Update call sites**

In `AntigravityAgentService.rotateCascade(...)`, change:

```ts
this.bridge.resetSession(threadId, this.catId as string);
```

to:

```ts
await this.bridge.resetSession(threadId, this.catId as string);
```

Search for other call sites:

```bash
rg -n "resetSession\\(" packages/api/src packages/api/test
```

Update tests to `await bridge.resetSession(...)` where needed.

**Step 5: Run green and commit**

Run the targeted bridge + agent tests. Expected: PASS.

```bash
git add packages/api/test/antigravity-bridge-session.test.js \
  packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts \
  packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts
git commit -m "fix(F211): seal Antigravity reset through runtime metadata" \
  -m "Why: Phase C requires reset and retire semantics to update canonical runtime-session state instead of mutating or ignoring legacy JSON."
```

## Task 4: Migration Path Audit Guard

**Files:**
- Modify: `packages/api/test/antigravity-runtime-session-import.test.js`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-runtime-session-import.ts`
- Modify: `docs/features/F211-cross-runtime-session-transparency.md`

**Step 1: Add importer audit test**

Extend `antigravity-runtime-session-import.test.js` to assert imported records carry:
- `surface: 'cat-cafe-dispatch'`
- `identityHistory[0].source: 'legacy_json_import'`
- diagnostics for missing/invalid/conflict paths
- no writes to the JSON file

If an audit sink already exists nearby, add optional importer output:

```ts
export interface ImportLegacyAntigravitySessionsResult {
  imported: RuntimeSessionMetadata[];
  diagnostics: LegacyAntigravitySessionDiagnostic[];
  auditedAt: number;
}
```

If no shared audit sink fits, use the returned diagnostics/imported records as the audit trail and document it in F211.

**Step 2: Run importer tests**

Run:

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/antigravity-runtime-session-import.test.js
```

Expected: PASS after any small audit-shape adjustments.

**Step 3: Update F211 Phase C wording only after tests pass**

Check AC-C2 in `docs/features/F211-cross-runtime-session-transparency.md` only if:
- explicit importer tests prove the one-time path still works;
- Bridge tests prove normal reuse does not call JSON;
- reset tests prove canonical lifecycle writes.

Do not mark AC-C1/C3/C4 done before the final targeted suite passes.

**Step 4: Commit**

```bash
git add packages/api/test/antigravity-runtime-session-import.test.js \
  packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-runtime-session-import.ts \
  docs/features/F211-cross-runtime-session-transparency.md
git commit -m "docs(F211): document Antigravity JSON migration audit path" \
  -m "Why: retiring the JSON shadow source still needs a visible one-time migration story for existing cascade bindings."
```

## Task 5: Runtime Store Regression Suite

**Files:**
- Modify: `packages/api/test/runtime-session-store.test.js`
- Modify: `packages/api/test/redis-runtime-session-store.test.js`

**Step 1: Add lifecycle update regression if missing**

Ensure both in-memory and Redis runtime-session stores prove:
- `updateLifecycle(..., { state: 'sealed' })` removes the active `(runtime, threadId, catId)` binding;
- `getActiveByThreadCat(...)` returns `null` after seal;
- `listRecent(...)` still returns the sealed session for drilldown.

**Step 2: Run store tests**

Run:

```bash
pnpm --filter @cat-cafe/api build && \
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/runtime-session-store.test.js
```

Redis test command must use the dev-test Redis endpoint, not 6399:

```bash
REDIS_URL=redis://localhost:6398 CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/redis-runtime-session-store.test.js
```

If Redis 6398 is not running, start the project test dependency through the repo-approved script; do not touch 6399.

**Step 3: Commit**

```bash
git add packages/api/test/runtime-session-store.test.js packages/api/test/redis-runtime-session-store.test.js
git commit -m "test(F211): prove sealed runtime sessions leave active binding" \
  -m "Why: Phase C reset semantics depend on updateLifecycle removing canonical active cascade bindings."
```

## Task 6: Final Phase C Verification And Docs Sync

**Files:**
- Modify: `docs/features/F211-cross-runtime-session-transparency.md`

**Step 1: Run focused suite**

Run:

```bash
pnpm --filter @cat-cafe/api build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test \
    packages/api/test/antigravity-bridge-session.test.js \
    packages/api/test/antigravity-agent-service.test.js \
    packages/api/test/antigravity-runtime-session-import.test.js \
    packages/api/test/runtime-session-store.test.js
```

Run Redis suite only against 6398:

```bash
REDIS_URL=redis://localhost:6398 CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  bash packages/api/scripts/with-test-home.sh \
  node --test packages/api/test/redis-runtime-session-store.test.js
```

**Step 2: Run full gate**

Run:

```bash
pnpm gate
```

Expected: PASS.

**Step 3: Mark AC-C1~C4 complete**

Update `docs/features/F211-cross-runtime-session-transparency.md`:
- check AC-C1 through AC-C4;
- add a timeline line with commit hashes and gate evidence;
- note that Phase C did not change ownership map.

**Step 4: Commit docs**

```bash
git add docs/features/F211-cross-runtime-session-transparency.md
git commit -m "docs(F211): mark Phase C JSON retirement complete" \
  -m "Why: implementation and gate evidence prove runtime-session metadata is now the canonical Antigravity cascade binding source."
```

## Review Gate

Before implementation starts:
- Commit this plan on `main`.
- Ask a non-author cat to review the Phase C plan.
- Do not open the Phase C implementation worktree until the review returns APPROVE or a concrete BLOCKING item.

After implementation:
- Request cross-cat implementation review before merge gate.
- Then use the merge-gate workflow for PR, cloud review, checks, merge, post-merge docs sync, and愿景守护.

## Open Questions

### Technical OQ: explicit legacy mode removal timing

Recommendation: keep `legacyJsonSessionStore: true` as an explicit rescue/test-only bridge option for this phase, but remove all default production usage. This gives a reversible escape hatch while satisfying AC-C1 because production canonical reuse no longer reads JSON.

### Technical OQ: importer audit shape

Recommendation: treat importer result diagnostics/imported metadata as the audit trail unless an existing audit sink is already wired at the migration call site. Do not invent a new audit subsystem for Phase C.

### Value OQ

None. This is a reversible technical-debt retirement inside the already approved F211 scope.
