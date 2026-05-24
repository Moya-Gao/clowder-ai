---
feature_ids: [F211]
related_features: [F061, F102, F124, F194, F200, F201, F209, F210]
topics: [antigravity, session-chain, runtime-session, metadata, implementation-plan]
doc_kind: plan
created: 2026-05-24
---

# F211 Phase A1 Runtime Metadata and Binding Implementation Plan

**Feature:** F211 — `docs/features/F211-cross-runtime-session-transparency.md`
**Goal:** Add the runtime-session metadata and binding foundation that lets Antigravity cascades become Session Chain-visible state without rewriting cascade rotation yet.
**Acceptance Criteria:** Phase A1 closes the storage/design foundation for AC-A11 and prepares AC-A12; it does not close AC-A1/A2/A3/A4/A8/A10 until Phase A2 wires live cascade lifecycle and transcript materialization.
**Architecture cell:** identity-session + memory
**Map delta:** done
**Map delta why:** Phase 0 updated `identity-session` with `identity-runtime-session` and marked `memory` as downstream transcript/digest consumer.
**Architecture:** Add a runtime-session sidecar store keyed by Cat Cafe `sessionId` and runtime `runtimeSessionId` (`cascadeId`). Keep `SessionRecord` narrow and keep `(catId, threadId) -> active session` semantics unchanged. A1 creates the canonical metadata and import surface; A2 consumes it from `AntigravityBridge` / `AntigravityAgentService`.
**Tech Stack:** TypeScript, existing SessionChainStore pattern, Redis via ioredis, Node test runner.
**前端验证:** No.

---

## Finish Line

Phase A1 is done when the codebase has a tested runtime-session metadata sidecar that can:

- persist `RuntimeSessionMetadata` for Antigravity Desktop cascades;
- look up metadata by Cat Cafe `sessionId` and by runtime tuple `(runtime, runtimeSessionId)`;
- represent lifecycle states `active`, `runtime_seal_pending`, `runtime_conflict_pending`, and `sealed` without changing `SessionRecord.status`;
- record `identityHistory`, `sealReason`, `drainResult`, retry timestamps, and last observed time;
- import legacy `data/antigravity-sessions.json` mappings into metadata through a read-only adapter without writing the JSON file.

Not building in A1:

- no `ephemeralSession: false` live switch;
- no cascade rotation seal/create behavior;
- no `drainCascade` or reaper;
- no transcript/digest materialization;
- no IDE-direct external registration tool.

Those stay in A2/B because A1 should be a small, reviewable storage contract PR.

## Terminal Schema

```ts
type RuntimeSessionRuntime = 'antigravity-desktop';
type RuntimeSessionSurface = 'cat-cafe-dispatch' | 'ide-direct';
type RuntimeSessionLifecycleState =
  | 'active'
  | 'runtime_seal_pending'
  | 'runtime_conflict_pending'
  | 'sealed';

type RuntimeSessionDrainResult =
  | 'complete'
  | 'best_effort_quiet_window'
  | 'skipped_runtime_unreachable';

type RuntimeSessionMetadata = {
  sessionId: string;
  runtime: RuntimeSessionRuntime;
  runtimeSessionId: string;
  runtimeConversationId?: string;
  threadId?: string;
  catId: CatId;
  userId?: string;
  surface: RuntimeSessionSurface;
  identityHistory: Array<{
    catId: CatId;
    model: string;
    modelVerified?: boolean;
    provider?: string;
    from: number;
    to?: number;
    source: 'session_init' | 'trajectory' | 'external_registration' | 'legacy_json_import';
  }>;
  lifecycle: {
    state: RuntimeSessionLifecycleState;
    startedAt: number;
    lastObservedAt: number;
    sealReason?: string;
    drainResult?: RuntimeSessionDrainResult;
    pendingSince?: number;
    retryCount?: number;
    lastRetryAt?: number;
    lastFailureReason?: string;
  };
};
```

Store contract:

```ts
interface IRuntimeSessionStore {
  upsert(metadata: RuntimeSessionMetadata): Promise<RuntimeSessionMetadata> | RuntimeSessionMetadata;
  getBySessionId(sessionId: string): Promise<RuntimeSessionMetadata | null> | RuntimeSessionMetadata | null;
  getByRuntimeSession(
    runtime: RuntimeSessionRuntime,
    runtimeSessionId: string,
  ): Promise<RuntimeSessionMetadata | null> | RuntimeSessionMetadata | null;
  listByLifecycleState(state: RuntimeSessionLifecycleState): Promise<RuntimeSessionMetadata[]> | RuntimeSessionMetadata[];
  updateLifecycle(
    sessionId: string,
    patch: Partial<RuntimeSessionMetadata['lifecycle']>,
  ): Promise<RuntimeSessionMetadata | null> | RuntimeSessionMetadata | null;
}
```

Redis keys:

- `runtime-session:{sessionId}` -> JSON metadata
- `runtime-session-by-runtime:{runtime}:{runtimeSessionId}` -> sessionId
- `runtime-session-state:{state}` -> sorted set of sessionIds scored by `lastObservedAt`

## Task 1: Runtime Metadata Types And Validators

**Files:**
- Create: `packages/api/src/domains/cats/services/runtime-session/RuntimeSessionMetadata.ts`
- Test: `packages/api/test/runtime-session-metadata.test.js`

**Step 1: Write failing type/validator tests**

Cover:
- accepts a valid Antigravity Desktop metadata object;
- rejects empty `sessionId`, `runtimeSessionId`, and invalid lifecycle state;
- appends identity history with non-overlapping `from` / `to` boundaries;
- normalizes `lastObservedAt >= startedAt`.

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/runtime-session-metadata.test.js
```

Expected first run: FAIL because the module does not exist.

**Step 2: Implement types and small helpers**

Add:
- exported TypeScript unions for runtime, surface, lifecycle state, and drain result;
- `normalizeRuntimeSessionMetadata(input)` for defensive construction;
- `appendRuntimeIdentity(metadata, entry)` to close the previous identity segment before adding a new one.

Keep validation local and lightweight; do not introduce a new runtime dependency unless existing local patterns already use it in this layer.

**Step 3: Verify**

Run the same test plus API build.

## Task 2: In-Memory Runtime Session Store

**Files:**
- Create: `packages/api/src/domains/cats/services/runtime-session/RuntimeSessionStore.ts`
- Test: `packages/api/test/runtime-session-store.test.js`

**Step 1: Write failing store tests**

Cover:
- `upsert` stores and replaces metadata by `sessionId`;
- runtime index lookup by `(runtime, runtimeSessionId)` works;
- changing `runtimeSessionId` removes the old runtime index;
- `updateLifecycle` changes sidecar state without touching `SessionRecord.status`;
- `listByLifecycleState('runtime_seal_pending')` returns only pending records ordered by `lastObservedAt`.

Expected first run: FAIL because the store does not exist.

**Step 2: Implement store**

Add:
- `IRuntimeSessionStore` interface;
- `RuntimeSessionStore` in-memory implementation;
- in-memory indexes for `sessionId`, runtime tuple, and lifecycle state.

Do not import or mutate `SessionChainStore`; this sidecar only references `sessionId`.

**Step 3: Verify**

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/runtime-session-store.test.js
```

## Task 3: Redis Runtime Session Store

**Files:**
- Create: `packages/api/src/domains/cats/services/stores/redis-keys/runtime-session-keys.ts`
- Create: `packages/api/src/domains/cats/services/runtime-session/RedisRuntimeSessionStore.ts`
- Create: `packages/api/src/domains/cats/services/runtime-session/RuntimeSessionStoreFactory.ts`
- Test: `packages/api/test/redis-runtime-session-store.test.js`
- Test: `packages/api/test/runtime-session-store-factory.test.js`

**Step 1: Write failing Redis tests**

Cover:
- JSON metadata persists with TTL=0 persistent behavior;
- runtime tuple index points to the current `sessionId`;
- upserting changed runtime id removes stale runtime tuple index;
- state sorted sets move records when lifecycle state changes;
- factory returns Redis implementation when Redis is present and in-memory otherwise.

Run:

```bash
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/redis-runtime-session-store.test.js packages/api/test/runtime-session-store-factory.test.js
```

Expected first run: FAIL because Redis store/factory modules do not exist. The Redis test should use the same skip/isolation helper pattern as `packages/api/test/redis-session-chain-store.test.js`.

**Step 2: Implement Redis store**

Mirror `RedisSessionChainStore` patterns:
- use bare keys because ioredis `keyPrefix` applies to normal commands;
- use JSON blob for metadata to avoid churn in `SessionRecord` hashes;
- keep indexes explicit and updated transactionally enough for this low-volume sidecar.

**Step 3: Verify**

Run Redis store tests, factory tests, and API build.

## Task 4: Legacy JSON Read-Only Import Adapter

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-runtime-session-import.ts`
- Test: `packages/api/test/antigravity-runtime-session-import.test.js`

**Step 1: Write failing importer tests**

Cover:
- reads `{ "threadId:catId": "cascadeId" }` and produces runtime metadata with `surface = 'cat-cafe-dispatch'`;
- legacy key without cat (`threadId`) is imported only when caller supplies a fallback cat id;
- corrupt JSON emits a diagnostic result and does not write or delete the source file;
- import is idempotent for the same `(runtime, runtimeSessionId)`;
- importer never calls `writeFileSync` or Bridge `persistSessionMap`.

Expected first run: FAIL because importer module does not exist.

**Step 2: Implement importer**

Add:
- `readLegacyAntigravitySessionMap(path)` returning parsed entries + diagnostics;
- `importLegacyAntigravitySessions({ path, runtimeSessionStore, sessionChainStore?, userId?, now })`.

The importer should not create fake `SessionRecord`s without a user/thread context. For A1, it may create runtime metadata with `sessionId = legacy:${runtimeSessionId}` only for import preview tests, or require a supplied session resolver. Pick the shape that avoids claiming full Session Chain visibility before A2.

**Step 3: Verify importer**

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/antigravity-runtime-session-import.test.js
```

## Task 5: API Wiring Preparation

**Files:**
- Modify: `packages/api/src/index.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- Test: `packages/api/test/antigravity-bridge-session.test.js`
- Test: `packages/api/test/antigravity-cascade-health.test.js`

**Step 1: Write failing wiring tests**

Cover:
- `AntigravityBridge` can accept an optional runtime session binding dependency without changing current behavior when absent;
- creating/reusing a cascade can emit a runtime metadata observation through the dependency in test mode;
- current JSON behavior remains unchanged until the A2 switch is explicitly enabled.

Expected first run: FAIL because constructor/options do not expose runtime session binding.

**Step 2: Implement preparatory dependency injection**

Add optional dependencies only:
- `runtimeSessionStore?: IRuntimeSessionStore`;
- `legacySessionImportMode?: 'disabled' | 'read-only-preview'`.

Do not flip live behavior yet. A1 is allowed to observe and test metadata creation, but the actual "JSON is read-only and new cascade writes only runtime binding" switch belongs to A2 with a dedicated Red-Green PR. This prevents a storage PR from also changing runtime lifecycle.

**Step 3: Verify no runtime behavior regression**

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/antigravity-bridge-session.test.js packages/api/test/antigravity-cascade-health.test.js
```

## Task 6: Feature Doc Sync And Commit

**Files:**
- Modify: `docs/features/F211-cross-runtime-session-transparency.md`

**Step 1: Update F211 timeline**

After implementation passes, add a Phase A1 timeline row with:
- runtime metadata sidecar merged;
- no live cascade rotation change yet;
- next Phase A2 owns `ephemeralSession: false`, lifecycle edge detection, drain, and reaper.

Do not tick AC-A1/A2/A3/A4/A8/A10 unless the implementation actually wires live session lifecycle.

**Step 2: Run gates**

```bash
pnpm check:features
pnpm check:architecture-ownership
git diff --check
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test \
  packages/api/test/runtime-session-metadata.test.js \
  packages/api/test/runtime-session-store.test.js \
  packages/api/test/redis-runtime-session-store.test.js \
  packages/api/test/runtime-session-store-factory.test.js \
  packages/api/test/antigravity-runtime-session-import.test.js \
  packages/api/test/antigravity-bridge-session.test.js \
  packages/api/test/antigravity-cascade-health.test.js
```

**Step 3: Commit**

```bash
git add packages/api/src packages/api/test docs/features/F211-cross-runtime-session-transparency.md
git commit -m "feat(F211): add runtime session metadata sidecar" \
  -m "Why: Phase A1 needs a canonical metadata and binding foundation before Antigravity cascade rotation can safely seal/create Session Chain records."
```

## Open Questions

| Type | Question | Default |
|------|----------|---------|
| Technical | Should A1 store metadata JSON in a new sidecar Redis key or embed a JSON field in `SessionRecord`? | Sidecar store, per Phase 0 design. |
| Technical | Should legacy JSON import create placeholder session ids? | Prefer no; require a resolver where possible, otherwise preview-only metadata. |
| Technical | Should A1 wire Bridge live behavior? | No. A1 may add optional observation hooks; A2 flips behavior. |
| Value | Should we preserve the root legacy JSON file after import? | Deferred to Phase C; no CVO decision needed in A1. |

## Straight-Line Check

- A1 output stays in the final system: the runtime metadata store is the same store A2/B/C will use.
- A1 has tests independent of live Antigravity LS, so it is reviewable without browser/IDE automation.
- A1 avoids changing cascade lifecycle and therefore cannot accidentally mis-seal active cascades while the metadata contract is still under review.
