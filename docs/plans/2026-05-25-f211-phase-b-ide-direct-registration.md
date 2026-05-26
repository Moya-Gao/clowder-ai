---
feature_ids: [F211]
related_features: [F061, F102, F124, F174, F178, F201, F209, F210]
topics: [antigravity, ide-direct, runtime-session, session-chain, agent-key, external-registration]
doc_kind: plan
created: 2026-05-25
---

# F211 Phase B IDE Direct Reverse Registration Implementation Plan

**Feature:** F211 - `docs/features/F211-cross-runtime-session-transparency.md`
**Goal:** Let Antigravity IDE-direct conversations register Cat Cafe session-chain evidence without a prior Cat Cafe dispatch.
**Acceptance Criteria:**
- AC-B1: Antigravity IDE-direct conversation can create or update a Cat Cafe session-chain record without a prior Cat Cafe dispatch.
- AC-B2: IDE-direct record includes cascade/conversation id, cat id, runtime surface, timestamps, and enough provenance to drill down.
- AC-B3: IDE-direct sessions are searchable/drillable through existing session-chain tools or a documented extension.
- AC-B4: Direct IDE sessions do not pollute normal thread transcript unless explicitly bound.
- AC-B5: Registration contract does not require invocation callback credentials; it uses a persistent-agent or explicit external-session auth path with audit.
- AC-B6: Orphan IDE-direct runtime sessions are discoverable through an MCP/UI list/read surface by runtime, cat, and recent activity even before they are bound to a normal thread.
**Architecture cell:** `identity-session` + `memory`
**Map delta:** update required
**Map delta why:** Phase B adds external runtime registration routes, MCP list/read tools, and an external runtime anchor thread contract under `identity-runtime-session`; `memory` remains a consumer of materialized session evidence.
**Architecture:** Reuse the Phase A `RuntimeSessionMetadata` sidecar and Session Chain envelope. Add an agent-key-only registration surface that creates or updates `ide-direct` runtime metadata and a session-chain record, anchored to a hidden external runtime thread unless the caller explicitly binds to a normal thread. Expose orphan sessions through a focused runtime-session list/read API and MCP tools; keep Hub UI polish in Phase E.
**Tech Stack:** TypeScript, Fastify callback routes, F178 `CallbackPrincipal` / `AgentKeyRegistry`, `SessionChainStore`, `RuntimeSessionStore`, `ThreadStore`, Node test runner, MCP server callback tool helpers.
**前端验证:** No. Phase B exposes API/MCP list/read surfaces only; Hub Session Chain UI remains Phase E.

---

## Precondition

Phase B starts from `origin/main` after Phase A2 merge and post-merge vision guard approval.

Required existing files:

- `packages/api/src/domains/cats/services/runtime-session/RuntimeSessionMetadata.ts`
- `packages/api/src/domains/cats/services/runtime-session/RuntimeSessionStore.ts`
- `packages/api/src/domains/cats/services/runtime-session/RedisRuntimeSessionStore.ts`
- `packages/api/src/domains/cats/services/stores/ports/SessionChainStore.ts`
- `packages/api/src/routes/callback-auth-prehandler.ts`
- `packages/api/src/routes/callbacks.ts`
- `packages/mcp-server/src/tools/callback-tools.ts`
- `packages/mcp-server/src/tools/session-chain-tools.ts`

Do not implement Phase C JSON retirement, Phase D generic session kind, or Phase E Hub UI in this PR.

## Phase B Decisions

### OQ-4: Where IDE-Direct Sessions Live

IDE-direct conversations default to an **external runtime anchor thread**:

- deterministic thread id: `external-runtime:${runtime}:${userId}`;
- owner/access: readable by that `userId`, not listed as a normal chat thread;
- purpose: satisfy existing Session Chain and transcript reader contracts that require a `threadId`;
- no `MessageStore.append()` and no normal chat transcript pollution.

If the caller explicitly sends `binding.mode = 'thread'` with a thread the agent-key user owns, the SessionRecord is created under that thread. Even then, Phase B writes runtime session evidence, not normal chat messages.

Binding is **one-shot in Phase B**. A runtime session's first successful registration chooses its SessionRecord `threadId`; later registrations for the same `(runtime, runtimeSessionId)` may update metadata, timestamps, provenance, and identity history, but they must not migrate `SessionRecord.threadId` from the orphan anchor to a normal thread or between normal threads. Existing orphan-to-thread migration is a separate explicit bind/move UX for Phase E or Phase D, where access control and transcript pointers can be reviewed as a whole.

### OQ-10: Orphan Behavior

When no explicit thread binding is supplied, create or update an orphan runtime session in the anchor thread. Orphan sessions are discoverable through the new runtime list/read API and MCP tools before any normal-thread binding exists.

### Auth Boundary

Registration is **agent-key only**:

- accepts `X-Agent-Key-Secret`;
- rejects invocation callback credentials for registration;
- requires `principal.kind === 'agent_key'`;
- requires `payload.catId === principal.catId`;
- records audit data with `agentKeyId`, `runtime`, `runtimeSessionId`, `runtimeConversationId`, `sessionId`, and binding mode.

This reuses F178 instead of extending invocation tokens beyond their intended short-lived boundary.

## Finish Line

Phase B is done when:

- `POST /api/callbacks/external-runtime-sessions/register` can create and update an Antigravity IDE-direct runtime session using only agent-key auth;
- repeated registration for the same `(runtime, runtimeSessionId)` updates the existing metadata and does not create duplicate SessionRecords;
- runtime metadata includes `surface: 'ide-direct'`, cascade/conversation ids, cat/model identity history, timestamps, provenance, and binding mode;
- orphan IDE-direct sessions use an external runtime anchor thread and do not append normal thread messages;
- explicit thread binding is owner-checked and stores provenance;
- MCP tools can list/read orphan IDE-direct runtime sessions by runtime, cat, and recent activity, then point to existing session digest/events readers;
- architecture ownership docs list the new registration/list/read surfaces.

Not building:

- deleting or migrating `data/antigravity-sessions.json` (Phase C);
- long-lived generic `Session.kind` migration (Phase D);
- Hub UI panels or in-context handoff pointer UI (Phase E);
- full trajectory transcript import from IDE-direct raw Antigravity history unless a small lifecycle/provenance event is needed to make the session drillable.

## Terminal Schema

```ts
type ExternalRuntime = 'antigravity-desktop';
type ExternalRuntimeSurface = 'ide-direct';

type ExternalRuntimeBinding =
  | { mode: 'orphan_anchor'; anchorThreadId: string }
  | { mode: 'thread'; threadId: string; requestedBy: 'agent_key' };

interface ExternalRuntimeSessionProvenance {
  source: 'antigravity-ide-direct';
  agentKeyId: string;
  registeredAt: number;
  ideWindowId?: string;
  workspacePath?: string;
  runtimeUrl?: string;
  note?: string;
}

interface ExternalRuntimeSessionRegistrationInput {
  runtime: ExternalRuntime;
  runtimeSessionId: string; // Antigravity cascadeId
  runtimeConversationId?: string;
  catId: CatId;
  model: string;
  title?: string;
  startedAt: number;
  lastObservedAt?: number;
  binding?: { mode: 'orphan' } | { mode: 'thread'; threadId: string };
  provenance?: Omit<ExternalRuntimeSessionProvenance, 'agentKeyId' | 'registeredAt'>;
  clientRegistrationId?: string;
}

interface ExternalRuntimeSessionRegistrationResult {
  status: 'created' | 'updated';
  sessionId: string;
  threadId: string;
  runtime: ExternalRuntime;
  runtimeSessionId: string;
  runtimeConversationId?: string;
  catId: CatId;
  binding: ExternalRuntimeBinding;
  drilldown: {
    sessionRecord: `/api/sessions/${string}`;
    events: `/api/sessions/${string}/events`;
    digest: `/api/sessions/${string}/digest`;
  };
}
```

Runtime metadata stays in the existing F211 sidecar:

```ts
const metadata: RuntimeSessionMetadata = {
  sessionId,
  runtime: 'antigravity-desktop',
  runtimeSessionId,
  runtimeConversationId,
  threadId,
  catId,
  userId,
  surface: 'ide-direct',
  identityHistory: [
    {
      catId,
      model,
      from: startedAt,
      source: 'external_registration',
    },
  ],
  lifecycle: {
    state: 'active',
    startedAt,
    lastObservedAt,
  },
};
```

## Task 1: Registration Schema And Domain Service

**Files:**
- Create: `packages/api/src/domains/cats/services/runtime-session/ExternalRuntimeSessionRegistration.ts`
- Modify: `packages/api/src/domains/cats/services/runtime-session/RuntimeSessionMetadata.ts`
- Test: `packages/api/test/external-runtime-session-registration.test.js`

**Step 1: Write the failing tests**

Cover:

- accepts Antigravity IDE-direct registration with `runtimeSessionId`, `catId`, `model`, and timestamps;
- rejects empty `runtimeSessionId`, invalid `runtime`, invalid `catId`, and `lastObservedAt < startedAt`;
- normalizes `lastObservedAt` to `startedAt` when omitted;
- stores `surface: 'ide-direct'` and identity source `external_registration`;
- rejects a body `catId` that does not match the agent-key principal.

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/external-runtime-session-registration.test.js
```

Expected first run: FAIL because the service module does not exist.

**Step 2: Implement the service contract**

Add:

- `normalizeExternalRuntimeSessionRegistration(input, principal)`;
- `registerExternalRuntimeSession(input, deps)`;
- exact `ExternalRuntimeSessionRegistrationInput` / `ExternalRuntimeSessionRegistrationResult` exports;
- `catRegistry.has(catId)` validation;
- source mapping to `RuntimeSessionMetadata.identityHistory[].source = 'external_registration'`.

Do not call HTTP, MCP, Antigravity CDP, or `MessageStore` from this service.

**Step 3: Verify and commit**

Run the same test plus API build.

Commit:

```bash
git add packages/api/src/domains/cats/services/runtime-session/ExternalRuntimeSessionRegistration.ts \
  packages/api/src/domains/cats/services/runtime-session/RuntimeSessionMetadata.ts \
  packages/api/test/external-runtime-session-registration.test.js
git commit -m "feat(F211): add external runtime session registration contract" \
  -m "Why: IDE-direct Antigravity conversations need a typed registration boundary that does not depend on invocation callback credentials."
```

## Task 2: External Runtime Anchor Thread Access

**Files:**
- Modify: `packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts`
- Modify: `packages/api/src/routes/session-chain.ts`
- Modify: `packages/api/src/routes/session-transcript.ts`
- Test: `packages/api/test/external-runtime-anchor-thread.test.js`

**Step 1: Write failing tests**

Cover:

- service creates or reuses deterministic anchor thread `external-runtime:antigravity-desktop:user-1`;
- anchor thread is not returned by `threadStore.list('user-1')`;
- session/digest/events access allows `session.userId === anchor.userId`;
- another user cannot read the anchor session;
- normal thread access behavior is unchanged.

Expected first run: FAIL because anchor thread state/access does not exist.

**Step 2: Implement anchor state**

Add a narrow thread metadata field:

```ts
interface ExternalRuntimeAnchorStateV1 {
  v: 1;
  runtime: 'antigravity-desktop';
  userId: string;
  createdAt: number;
}
```

Add store support:

- `ensureExternalRuntimeAnchorThread(runtime, userId)`;
- in-memory and Redis persistence;
- `list(userId)` excludes external runtime anchors by default;
- session-chain and transcript access allow the anchor only when `state.userId === request userId`.

Do not use the default thread and do not mark anchor threads as connector hubs.

**Step 3: Verify and commit**

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/external-runtime-anchor-thread.test.js
```

## Task 3: Runtime Store Recent Listing

**Files:**
- Modify: `packages/api/src/domains/cats/services/runtime-session/RuntimeSessionStore.ts`
- Modify: `packages/api/src/domains/cats/services/runtime-session/RedisRuntimeSessionStore.ts`
- Modify: `packages/api/src/domains/cats/services/stores/redis-keys/runtime-session-keys.ts`
- Test: `packages/api/test/runtime-session-store.test.js`
- Test: `packages/api/test/redis-runtime-session-store.test.js`

**Step 1: Write failing tests**

Cover:

- `listRecent({ runtime, catId, surface: 'ide-direct', limit })` returns newest first by `lifecycle.lastObservedAt`;
- `catId` filter prevents cross-cat enumeration;
- `surface: 'ide-direct'` excludes Cat-Cafe-dispatched runtime sessions;
- Redis indexes update when metadata is upserted with a different cat/surface/lifecycle timestamp.

Expected first run: FAIL because the list method/index does not exist.

**Step 2: Implement list indexes**

Extend `IRuntimeSessionStore`:

```ts
listRecent(filter: {
  runtime?: RuntimeSessionRuntime;
  catId?: CatId;
  surface?: RuntimeSessionSurface;
  limit?: number;
}): Promise<RuntimeSessionMetadata[]> | RuntimeSessionMetadata[];
```

Redis keys:

- `runtime-session:recent:{runtime}` -> sorted set scored by `lastObservedAt`;
- `runtime-session:recent:{runtime}:{surface}` -> sorted set;
- `runtime-session:recent:{runtime}:{surface}:{catId}` -> sorted set.

Keep metadata detail as the source of truth; list indexes are derived pointers.

**Step 3: Verify and commit**

Run the store tests above plus API build.

## Task 4: Agent-Key Callback Registration Route

**Files:**
- Create: `packages/api/src/routes/callback-runtime-session-routes.ts`
- Modify: `packages/api/src/routes/callbacks.ts`
- Modify: `packages/api/src/domains/cats/services/orchestration/EventAuditLog.ts`
- Test: `packages/api/test/callback-external-runtime-session-routes.test.js`

**Step 1: Write failing route tests**

Cover:

- `POST /api/callbacks/external-runtime-sessions/register` with `X-Agent-Key-Secret` creates a session;
- the same payload returns `updated` on retry and does not create a duplicate SessionRecord;
- missing auth returns 401;
- invocation auth is rejected with 403 for this route;
- body `catId` different from agent-key principal returns 403;
- explicit thread binding succeeds only for a thread created by the same user;
- explicit thread binding to another user's thread returns 403;
- audit event includes `agentKeyId`, runtime ids, binding mode, and session id.

Expected first run: FAIL because the route does not exist.

**Step 2: Register the route**

Inside `callbacksRoutes`, after `registerCallbackAuthHook(...)`, call:

```ts
registerCallbackRuntimeSessionRoutes(app, {
  sessionChainStore,
  runtimeSessionStore,
  threadStore,
});
```

The route must:

- call `requireCallbackPrincipal(request, reply)`;
- require `principal.kind === 'agent_key'`;
- reject invocation principals even if they are otherwise valid;
- use `registerExternalRuntimeSession`;
- append `AuditEventTypes.EXTERNAL_RUNTIME_SESSION_REGISTERED`;
- return the `ExternalRuntimeSessionRegistrationResult`.

Do not add callback token fallback, body credential fallback, or a public unauthenticated route.

**Step 3: Verify and commit**

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/callback-external-runtime-session-routes.test.js
```

## Task 5: Session Creation And Transcript Non-Pollution

**Files:**
- Modify: `packages/api/src/domains/cats/services/runtime-session/ExternalRuntimeSessionRegistration.ts`
- Test: `packages/api/test/external-runtime-session-registration.test.js`
- Test: `packages/api/test/callback-external-runtime-session-routes.test.js`

**Step 1: Write failing behavior tests**

Cover:

- orphan registration creates a `SessionRecord` under the external anchor thread;
- registration does not call `MessageStore.append()` and does not create a normal chat message;
- `SessionRecord.cliSessionId === runtimeSessionId`;
- `RuntimeSessionMetadata.threadId` points to the anchor or explicitly bound thread;
- existing `(runtime, runtimeSessionId)` updates `runtimeConversationId`, `lastObservedAt`, title/provenance, and identity history when model changes;
- existing `(runtime, runtimeSessionId)` registered as orphan returns a conflict when a later registration tries `binding.mode = 'thread'`;
- existing `(runtime, runtimeSessionId)` registered to one normal thread returns a conflict when a later registration tries a different normal thread.

Expected first run: FAIL where Task 1 only validates schema and Task 4 only proves route wiring.

**Step 2: Implement idempotent write path**

Write order:

1. Resolve binding target:
   - `binding.mode` absent or `orphan` -> `threadStore.ensureExternalRuntimeAnchorThread(runtime, userId)`;
   - `binding.mode === 'thread'` -> verify thread owner.
2. Look up `runtimeSessionStore.getByRuntimeSession(runtime, runtimeSessionId)`.
3. If existing:
   - compare the existing `RuntimeSessionMetadata.threadId` / SessionRecord `threadId` with the resolved binding target;
   - if the target differs, return 409 `external_runtime_binding_immutable`;
   - update runtime metadata lifecycle timestamps/provenance;
   - append identity history only when `(catId, model)` changes;
   - return `status: 'updated'`.
4. If new:
   - `sessionChainStore.create({ cliSessionId: runtimeSessionId, threadId, catId, userId })`;
   - `runtimeSessionStore.upsert(...)`;
   - return `status: 'created'`.

If the SessionRecord create succeeds and runtime metadata upsert fails, fail closed by marking the session `sealed` with `sealReason: 'external_registration_failed'` or deleting only if the store supports an explicit rollback. The test should assert no active orphan with missing runtime metadata remains.

**Step 3: Verify and commit**

Run the route/service tests and API build.

## Task 6: MCP List/Read Surface

**Files:**
- Create: `packages/mcp-server/src/tools/external-runtime-session-tools.ts`
- Modify: `packages/mcp-server/src/server-toolsets.ts`
- Modify: `packages/mcp-server/src/tools/callback-tools.ts`
- Test: `packages/mcp-server/test/external-runtime-session-tools.test.ts`

**Step 1: Write failing MCP tests**

Cover:

- `cat_cafe_register_external_runtime_session` sends the registration route with agent-key headers;
- shared Antigravity MCP requires `agentKeyCatId` when `CAT_CAFE_AGENT_KEY_FILES` is configured;
- `cat_cafe_list_external_runtime_sessions` calls the runtime list route and filters by runtime/cat/recent;
- `cat_cafe_read_external_runtime_session` returns session id, runtime ids, binding mode, and digest/events pointers;
- no invocation credentials are required for these tools.

Expected first run: FAIL because tools do not exist.

**Step 2: Implement tools**

Tool names:

- `cat_cafe_register_external_runtime_session`
- `cat_cafe_list_external_runtime_sessions`
- `cat_cafe_read_external_runtime_session`

Inputs:

```ts
{
  runtime: 'antigravity-desktop',
  runtimeSessionId: string,
  runtimeConversationId?: string,
  catId: CatId,
  model: string,
  title?: string,
  startedAt: number,
  lastObservedAt?: number,
  binding?: { mode: 'orphan' } | { mode: 'thread'; threadId: string },
  agentKeyCatId?: string
}
```

For list/read, return compact text plus JSON with:

- `sessionId`;
- `threadId`;
- `runtimeSessionId`;
- `runtimeConversationId`;
- `catId`;
- `model`;
- `lastObservedAt`;
- `binding.mode`;
- next commands: `cat_cafe_read_session_digest({ sessionId })` and `cat_cafe_read_session_events({ sessionId, view: "handoff" })`.

**Step 3: Verify and commit**

Run:

```bash
pnpm --filter @cat-cafe/mcp-server run build
pnpm --filter @cat-cafe/mcp-server test -- external-runtime-session-tools
```

If the MCP package has no targeted test command, run the package build and the repository's existing MCP test command from `package.json`.

## Task 7: API Read/List Route For Runtime Sessions

**Files:**
- Create: `packages/api/src/routes/external-runtime-sessions.ts`
- Modify: `packages/api/src/routes/index.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/test/external-runtime-sessions-route.test.js`

**Step 1: Write failing route tests**

Cover:

- `GET /api/external-runtime-sessions?runtime=antigravity-desktop&catId=antigravity&limit=10` returns only sessions owned by the requesting user;
- `GET /api/external-runtime-sessions/:sessionId` returns runtime metadata plus SessionRecord drilldown pointers;
- another user cannot read a runtime session;
- caller `x-cat-id` filters to that cat and cannot enumerate another cat's runtime sessions.

Expected first run: FAIL because the route does not exist.

**Step 2: Implement user-facing read/list route**

This route is read-only and uses normal request identity headers/cookies, not callback credentials.

Register it in `index.ts` with:

- `runtimeSessionStore`;
- `sessionChainStore`;
- `threadStore`.

Keep output intentionally plain. Phase E can build richer Hub UI on top.

**Step 3: Verify and commit**

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test packages/api/test/external-runtime-sessions-route.test.js
```

## Task 8: Architecture Docs And F211 Spec Sync

**Files:**
- Modify: `docs/architecture/ownership/cells/identity-session.md`
- Modify: `docs/architecture/ownership/cells/memory.md`
- Modify: `docs/features/F211-cross-runtime-session-transparency.md`

**Step 1: Update ownership anchors**

Add these identity-session anchors:

- `packages/api/src/domains/cats/services/runtime-session/ExternalRuntimeSessionRegistration.ts`
- `packages/api/src/routes/callback-runtime-session-routes.ts`
- `packages/api/src/routes/external-runtime-sessions.ts`
- `packages/mcp-server/src/tools/external-runtime-session-tools.ts`

Memory cell update should stay one-way: it consumes materialized session transcript/digest evidence and must not own runtime binding or agent-key auth.

**Step 2: Mark AC-B1 through AC-B6 only after tests pass**

In `docs/features/F211-cross-runtime-session-transparency.md`, tick AC-B1~B6 after the implementation and verification evidence exist. Do not tick Phase C/D/E AC.

**Step 3: Verify docs**

Run:

```bash
pnpm check:features
git diff --check
```

## Task 9: Final Gate, Review, And Merge

**Files:**
- All Phase B files from tasks above.

**Step 1: Run targeted verification**

```bash
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/mcp-server run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test \
  packages/api/test/external-runtime-session-registration.test.js \
  packages/api/test/external-runtime-anchor-thread.test.js \
  packages/api/test/callback-external-runtime-session-routes.test.js \
  packages/api/test/external-runtime-sessions-route.test.js \
  packages/api/test/runtime-session-store.test.js
pnpm check:features
git diff --check
```

**Step 2: Run full gate**

```bash
pnpm gate
```

Expected: PASS.

**Step 3: Request cross-family review**

Review focus:

- AC-B5 auth boundary: no invocation token requirement, agent-key principal cannot spoof `catId`;
- AC-B4 isolation: orphan IDE-direct registration does not append normal thread messages or leak through normal thread list;
- AC-B6 discoverability: list/read works before binding;
- idempotency and rollback: duplicate register does not duplicate SessionRecords; failed metadata write does not leave invisible active sessions;
- scope: no JSON retirement, no Hub UI, no generic Session.kind migration.

## Open Questions

### Technical OQ

1. Exact Antigravity IDE-direct source signal: current implementation can start with MCP tool registration from the Antigravity sidecar, then later wire CDP/native event discovery if Antigravity exposes a better source. This does not require CVO decision because the contract is transport-neutral.
2. Anchor thread storage shape in Redis: implementation should prefer a typed `externalRuntimeAnchorState` on `Thread`, but if Redis thread schema already has a safer metadata extension point, use that existing pattern.
3. Minimal IDE-direct transcript materialization: Phase B must create drillable runtime/session metadata and may write a small lifecycle registration event; full raw IDE transcript import can wait until Antigravity exposes stable event history.

### Value OQ

None blocking Phase B.

Phase B intentionally chooses:

- **Phase B now:** API/MCP registration and orphan discoverability.
- **Phase E later:** rich Hub UI and in-context handoff pointers.
- **Phase C later:** JSON shadow-state retirement.

All choices are reversible at code level and do not need CVO escalation.
