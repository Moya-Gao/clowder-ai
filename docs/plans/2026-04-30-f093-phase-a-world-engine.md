---
feature_ids: [F093]
related_features: [F102, F129]
topics: [implementation-plan, world-engine, memory-reuse, design-gate]
doc_kind: plan
created: 2026-04-30
---

# F093 Phase A: Cats & U World Engine Implementation Plan

**Feature:** F093 — `docs/features/F093-cats-and-u-world-engine.md`
**Goal:** 交付第一个可用的"活着的房间"：能建世界、进场景、提交结构化动作、显式升格正典、按世界域召回记忆、Replay 回看。
**Acceptance Criteria:** AC-A1 ~ AC-A11（本计划逐项覆盖）
**Architecture:** 新增 `packages/api/src/domains/world/` runtime domain，World/Character/Scene/Canon Decision/world_event_log 是权威状态；复用 F102 `KnowledgeResolver` / `IEvidenceStore` 做可重建 recall index，并通过 `worldId` / `sceneId` 过滤投影到 `WorldContextEnvelope`。F129 `world-driver.yaml` 只作为声明式前端，编译后进入 typed runtime action，不再停留在 static prompt summary。
**Tech Stack:** TypeScript, better-sqlite3, zod, node:test, React/Next.js
**前端验证:** Yes — Build / Perform / Replay-lite 是用户可见流程，必须用浏览器验证。

---

## Straight-Line Check

**终点 B**: 一个 thread 可以承载一个 world session；猫每轮拿到动态 `WorldContextEnvelope`，输出 typed `WorldActionEnvelope`，runtime coordinator 校验并事务化写入 `world_event_log`；accepted canon 能进入 world-scoped recall；用户能完成一次"建世界 → 进场景 → 留下可追溯记忆 → world-scoped recall → Replay 回看"。

**不做的事**: 不做 Phase A+ 的世界自转、多猫并发写仲裁、Relationship/Artifact 独立实体、Branch from here、完整 Turn 级 DAG；不做 Phase B 的 Story→Feature/Care→Action Bridge；不新造独立 RAG 引擎。

**终态 schema 先行**:
- `WorldContextEnvelope`: runtime 注入给 agent 的动态世界状态。
- `WorldActionEnvelope`: agent 输出的结构化动作提案。
- `CanonPromotionRecord`: 显式升格正典的状态机记录。
- `world_event_log`: append-only 权威时间线。
- F102 复用边界：`worldId` / `sceneId` 是检索过滤维度；evidence index 是派生层，不是正典真相源。

---

## AC Coverage

| AC | 覆盖任务 |
|---|---|
| AC-A1 数据结构 | Task 1, 2 |
| AC-A2 Character 5 槽 | Task 1, 2, 8 |
| AC-A3 Role Mask | Task 1, 6 |
| AC-A4 三模式 | Task 8 |
| AC-A5 WorldContextEnvelope + recall | Task 4, 5 |
| AC-A6 WorldActionEnvelope | Task 3 |
| AC-A7 CanonPromotionRecord | Task 1, 3 |
| AC-A8 world_event_log | Task 2, 9 |
| AC-A9 Care Loop | Task 7 |
| AC-A10 E2E | Task 10 |
| AC-A11 F129 unlock | Task 6 |

---

## Task 1: Shared World Contracts

**Files:**
- Create: `packages/shared/src/types/world.ts`
- Create: `packages/shared/src/schemas/world.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Test: `packages/shared/src/__tests__/world-types.test.ts`

**Step 1: Write failing type/schema tests**

Assert the exported zod schemas accept the terminal contracts:
- `WorldRecord`: `worldId`, `name`, `status`, `createdAt`, `updatedAt`, `threadId?`
- `CharacterRecord`: 5 slots (`coreIdentity`, `innerDrive`, `relationshipTension`, `voiceAndImage`, `growthState`)
- `SceneRecord`: `sceneId`, `worldId`, `mode`, `status`, `activeCharacterIds`
- `WorldContextEnvelope`: `world`, `scene`, `characters`, `recentEvents`, `relationshipSnapshot`, `canonSummary`, `recall`
- `WorldActionEnvelope`: `worldId`, `sceneId`, `actorCatId`, `mode`, `actions[]`, `idempotencyKey`
- `CanonPromotionRecord`: `recordId`, `worldId`, `sceneId`, `sourceEventId`, `status: draft | proposed | accepted | rejected`

**Step 2: Run test and confirm red**

Run: `pnpm --dir packages/shared build`

Expected: FAIL because `world.ts` / `world` schemas do not exist.

**Step 3: Implement shared contracts**

Use zod schemas for runtime validation and inferred TS types. Keep Relationship as a typed field on `WorldContextEnvelope`, not an independent exported entity yet.

**Step 4: Run green**

Run: `pnpm --dir packages/shared build`

Expected: PASS.

---

## Task 2: World SQLite Store

**Files:**
- Create: `packages/api/src/domains/world/interfaces.ts`
- Create: `packages/api/src/domains/world/schema.ts`
- Create: `packages/api/src/domains/world/SqliteWorldStore.ts`
- Create: `packages/api/src/domains/world/index.ts`
- Test: `packages/api/test/world/world-store.test.js`

**Step 1: Write failing store tests**

Cover:
- `initialize()` creates `worlds`, `world_characters`, `world_scenes`, `canon_promotion_records`, `world_event_log`.
- `createWorld()` writes a world with optional `threadId`.
- `upsertCharacter()` preserves 5-slot fields.
- `appendEvent()` is append-only and rejects updates/deletes.
- `getContext(worldId, sceneId)` returns records needed by `WorldContextEnvelope`.

**Step 2: Run test and confirm red**

Run from `packages/api`: `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/world/world-store.test.js`

Expected: FAIL because world store does not exist.

**Step 3: Implement SQLite store**

Use `better-sqlite3`, idempotent migrations, WAL, and explicit `worldId` / `sceneId` indexes. Do not write into F102 `evidence_docs` here; this is authoritative runtime state.

**Step 4: Run green**

Run the same test command.

Expected: PASS.

---

## Task 3: Runtime Coordinator + Action Protocol

**Files:**
- Create: `packages/api/src/domains/world/WorldRuntimeCoordinator.ts`
- Create: `packages/api/src/domains/world/action-handlers.ts`
- Test: `packages/api/test/world/world-runtime-coordinator.test.js`

**Step 1: Write failing coordinator tests**

Cover:
- Valid `WorldActionEnvelope` commits in one transaction.
- Invalid `worldId` / `sceneId` / role-mask overwrite is rejected.
- Duplicate `idempotencyKey` does not double-append events.
- `propose_canon` creates `CanonPromotionRecord(status='proposed')`.
- `accept_canon` writes accepted record + append-only event.

**Step 2: Implement minimal coordinator**

Coordinator responsibilities are only load → validate → normalize → commit → return new snapshot. Agent remains decision source; coordinator owns transaction and audit.

**Step 3: Run green**

Run: `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/world/world-runtime-coordinator.test.js`

Expected: PASS.

---

## Task 4: F102-Compatible World Recall Adapter

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts`
- Modify: `packages/api/src/domains/memory/schema.ts`
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Create: `packages/api/src/domains/world/WorldKnowledgeAdapter.ts`
- Test: `packages/api/test/world/world-knowledge-adapter.test.js`
- Test: `packages/api/test/memory/world-scope-filter.test.js`

**Step 1: Write failing tests**

Cover:
- `SearchOptions` accepts `worldId?: string` and `sceneId?: string`.
- Evidence rows can store world metadata without breaking existing docs/thread search.
- `WorldKnowledgeAdapter.indexCanon(record)` writes derived evidence only after canon is accepted.
- `WorldKnowledgeAdapter.searchWorld(query, { worldId })` calls `KnowledgeResolver` with world filter.

**Step 2: Implement additive metadata**

Add nullable metadata columns / JSON metadata only as a derived index path. Existing F102 queries without `worldId` must remain unchanged.

**Step 3: Run regression tests**

Run:
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/memory/world-scope-filter.test.js`
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/memory/knowledge-resolver.test.js test/memory/knowledge-resolver-dimension.test.js`

Expected: PASS.

---

## Task 5: WorldContextEnvelope Dynamic Injection

**Files:**
- Create: `packages/api/src/domains/world/WorldContextProvider.ts`
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`
- Modify: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
- Test: `packages/api/test/world/world-context-provider.test.js`
- Test: `packages/api/test/system-prompt-builder.test.js`

**Step 1: Write failing tests**

Cover:
- `buildStaticIdentity()` never includes live world state.
- `buildInvocationContext()` can include a dynamic world context block.
- Context provider combines world store snapshot + `WorldKnowledgeAdapter.searchWorld()`.
- Missing world/session mapping fails open with no context block.

**Step 2: Implement provider and injection point**

Inject the rendered `WorldContextEnvelope` per invocation, next to other dynamic context, not in pack `worldDriverSummary`.

**Step 3: Run green**

Run:
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/world/world-context-provider.test.js test/system-prompt-builder.test.js`

Expected: PASS.

---

## Task 6: F129 World Driver Runtime Bridge

**Files:**
- Modify: `packages/shared/src/schemas/pack.ts`
- Modify: `packages/api/src/domains/packs/PackCompiler.ts`
- Create: `packages/api/src/domains/world/WorldDriverRuntime.ts`
- Test: `packages/api/test/pack-schema.test.js`
- Test: `packages/api/test/pack-integration.test.js`
- Test: `packages/api/test/world/world-driver-runtime.test.js`

**Step 1: Write failing tests**

Cover:
- Existing `world-driver.yaml` still validates.
- Compiler keeps read-only summary for static identity, but runtime bridge emits typed allowed actions / canon rules.
- `resolver: agent` maps to `WorldRuntimeCoordinator` action submission, not direct text mutation.

**Step 2: Implement bridge**

Keep F129 as declaration layer. The bridge translates `roles`, `actions`, `canonRules`, and `memoryPolicy` into runtime config used by coordinator/context provider.

**Step 3: Run green**

Run: `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/pack-schema.test.js test/pack-integration.test.js test/world/world-driver-runtime.test.js`

Expected: PASS and AC-A11 is unblocked.

---

## Task 7: Care Loop Runtime Hook

**Files:**
- Create: `packages/api/src/domains/world/CareLoopPolicy.ts`
- Modify: `packages/api/src/domains/world/WorldContextProvider.ts`
- Test: `packages/api/test/world/care-loop-policy.test.js`

**Step 1: Write failing tests**

Cover:
- Care Loop triggers from explicit user state or scene policy, not from arbitrary sentiment guessing.
- Care output includes check-in, actionable next step, and reality-bridge reminder.
- Care Loop is additive to world context and does not auto-promote canon.

**Step 2: Implement policy**

Start with deterministic trigger fields and mode gates. Do not add LLM sentiment classification in Phase A.

**Step 3: Run green**

Run: `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/world/care-loop-policy.test.js`

Expected: PASS.

---

## Task 8: Build / Perform / Replay-lite UI

**Files:**
- Create: `packages/web/src/components/world/WorldRoomPanel.tsx`
- Create: `packages/web/src/components/world/WorldModeTabs.tsx`
- Create: `packages/web/src/components/world/WorldReplayPanel.tsx`
- Create: `packages/web/src/components/world/WorldCanonPanel.tsx`
- Create: `packages/web/src/components/world/__tests__/WorldRoomPanel.test.tsx`
- Modify: `packages/web/src/services/api.ts`

**Step 1: Write failing UI tests**

Cover:
- Build mode can show world + character setup.
- Perform mode shows active scene, speaking cat, and mask identity.
- Replay-lite shows append-only event log and canon status.
- World-scoped recall results are visually tied to the current world.

**Step 2: Implement UI shell**

Keep layout dense and operational. Use tabs for Build/Perform/Replay-lite; do not make a landing page.

**Step 3: Run web tests**

Run: `pnpm --dir packages/web exec vitest run src/components/world/__tests__/WorldRoomPanel.test.tsx`

Expected: PASS.

---

## Task 9: API Routes

**Files:**
- Create: `packages/api/src/routes/worlds.ts`
- Modify: `packages/api/src/routes/index.ts`
- Test: `packages/api/test/world/world-routes.test.js`

**Step 1: Write failing route tests**

Cover:
- `POST /api/worlds` creates a world.
- `POST /api/worlds/:worldId/scenes` creates a scene.
- `POST /api/worlds/:worldId/actions` submits a `WorldActionEnvelope`.
- `GET /api/worlds/:worldId/replay` returns ordered events.
- Requests validate user/thread ownership before read/write.

**Step 2: Implement routes**

Wire routes to `SqliteWorldStore`, `WorldRuntimeCoordinator`, and `WorldContextProvider`. Keep auth checks consistent with existing thread/project route patterns.

**Step 3: Run green**

Run: `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/world/world-routes.test.js`

Expected: PASS.

---

## Task 10: End-to-End Acceptance

**Files:**
- Create: `packages/api/test/world/world-engine-e2e.test.js`
- Create: `docs/discussions/2026-04-30-f093-phase-a-design-gate/README.md`
- Modify: `docs/features/F093-cats-and-u-world-engine.md`

**Step 1: Write E2E test**

Script the full AC-A10 path:
1. Create world.
2. Create character with 5 slots.
3. Enter scene.
4. Submit Perform action.
5. Propose + accept canon.
6. Search world-scoped recall and verify only that world's accepted canon appears.
7. Replay event log and verify ordered state changes.

**Step 2: Run E2E red → green**

Run: `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/world/world-engine-e2e.test.js`

Expected: PASS.

**Step 3: Browser verification**

Start dev server after implementation and verify Build/Perform/Replay-lite in browser. Capture screenshots for review.

**Step 4: Update F093 checkboxes**

Only check ACs backed by tests/browser evidence. Do not mark Design Gate complete until interface contracts and schema are reviewed.

---

## Review Gate

Before implementation worktree starts:
- 宪宪 owns authoring the final TS contract draft if this remains a 布偶猫-led feature.
- 砚砚 review must explicitly approve `WorldContextEnvelope`, `WorldActionEnvelope`, `CanonPromotionRecord`, and the F102 reuse boundary.
- 烁烁 must review Perform mode visual identity ("who is speaking + wearing which mask") before UI implementation.

Blockers for review:
- `worldId` is missing from recall/filter path.
- Any code path writes RP text directly into Canon Memory.
- Live world state appears in `buildStaticIdentity()`.
- evidence index is treated as authoritative world state.
