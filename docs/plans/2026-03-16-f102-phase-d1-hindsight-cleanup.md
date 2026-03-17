---
feature_ids: [F102]
topics: [memory, hindsight-removal, phase-d]
doc_kind: plan
created: 2026-03-16
---

# F102 Phase D-1: Hindsight Runtime Cleanup — Implementation Plan

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** Remove all Hindsight runtime code paths so SQLite is the only memory backend
**Acceptance Criteria:** AC-D1 (no Hindsight call branches in runtime), AC-D2 partial (factory only has sqlite)
**Architecture:** Delete Hindsight adapter/client → simplify factory to sqlite-only → remove Hindsight fallback from all routes → clean barrel exports
**Tech Stack:** TypeScript, better-sqlite3, node:test
**前端验证:** No — pure backend

---

## Sequencing: Inside-out (dependencies first → consumers last)

```
Step 1: factory.ts — remove 'hindsight' type + createHindsightServices()
Step 2: ReflectionService.ts — remove createHindsightReflectBackend
Step 3: routes/evidence.ts — remove Hindsight fallback path
Step 4: routes/reflect.ts — remove Hindsight fallback path
Step 5: routes/callback-memory-routes.ts — remove Hindsight fallback paths (3 endpoints)
Step 6: routes/evidence-helpers.ts — remove HindsightMemory/HindsightError refs
Step 7: index.ts (main server) — simplify to sqlite-only init
Step 8: Delete HindsightAdapter.ts + HindsightClient.ts
Step 9: Clean barrel exports (services/index.ts + memory/index.ts)
Step 10: Run full test suite, fix broken imports, commit
```

## Step 1: factory.ts — sqlite-only

**Files:** Modify `packages/api/src/domains/memory/factory.ts`

- Remove imports: `IHindsightClient`, `HindsightAdapter`, `createHindsightReflectBackend`
- Remove `'hindsight'` from `MemoryConfig.type` union → only `'sqlite'`
- Remove `hindsightClient?` and `hindsightBank?` from `MemoryConfig`
- Remove `createHindsightServices()` function entirely
- Simplify `createMemoryServices()` to always call `createSqliteServices()`

## Step 2: ReflectionService.ts — remove Hindsight backend

**Files:** Modify `packages/api/src/domains/memory/ReflectionService.ts`

- Delete `createHindsightReflectBackend()` function (lines 21-26)
- Keep `ReflectionService` class and `ReflectBackend` type

## Step 3: routes/evidence.ts — remove fallback

**Files:** Modify `packages/api/src/routes/evidence.ts`

- Remove `IHindsightClient` import
- Remove `hindsightClient` and `sharedBank` from `EvidenceRoutesOptions`
- Make `evidenceStore` required (not optional)
- Delete entire Hindsight fallback path (lines ~115-187)
- SQLite DI block becomes the only path

## Step 4: routes/reflect.ts — remove fallback

**Files:** Modify `packages/api/src/routes/reflect.ts`

- Remove `IHindsightClient` and `HindsightError` imports
- Remove `hindsightClient` from `ReflectRoutesOptions`
- Make `reflectionService` required (not optional)
- Delete entire Hindsight fallback path (lines ~57-111)

## Step 5: routes/callback-memory-routes.ts — remove 3 fallbacks

**Files:** Modify `packages/api/src/routes/callback-memory-routes.ts`

- Remove `IHindsightClient` and `HindsightError` imports
- Remove `hindsightClient?` and `sharedBank?` from `CallbackMemoryRoutesDeps`
- Make `evidenceStore`, `markerQueue`, `reflectionService` required
- Delete Hindsight fallback in search-evidence, reflect, retain-memory (3 blocks)
- Delete or simplify `shouldDegrade()` helper

## Step 6: routes/evidence-helpers.ts — remove Hindsight types

**Files:** Modify `packages/api/src/routes/evidence-helpers.ts`

- Remove `HindsightMemory` and `HindsightError` imports
- Delete `memoryToResult()` function (Hindsight-only)
- Simplify `shouldDegradeToDocs()` — remove `instanceof HindsightError`

## Step 7: index.ts — simplify initialization

**Files:** Modify `packages/api/src/index.ts`

- Remove `createHindsightClient` import
- Delete Hindsight client creation lines
- Remove `EVIDENCE_STORE_TYPE` conditional — always create sqlite services
- Unwrap the `if (evidenceStoreType === 'sqlite')` block
- Remove `hindsightClient`/`sharedBank` from all route registrations
- Always pass memoryServices to routes (not conditional spread)

## Step 8: Delete files

- Delete `packages/api/src/domains/memory/HindsightAdapter.ts`
- Delete `packages/api/src/domains/cats/services/orchestration/HindsightClient.ts`

## Step 9: Clean barrel exports

**Files:**
- Modify `packages/api/src/domains/cats/services/index.ts` — remove Hindsight export block
- Modify `packages/api/src/domains/memory/index.ts` — remove HindsightAdapter + createHindsightReflectBackend exports

## Step 10: Build + test + commit

```bash
pnpm --filter @cat-cafe/api run build
pnpm check
node --test packages/api/test/memory/*.test.js
# Fix any broken imports in tests
git add -A && git commit -m "feat(F102-D): remove Hindsight runtime — sqlite-only memory backend"
```

## Not in scope (Phase D-1b/D-2)

- Config layer cleanup (env-registry, ConfigSnapshot, frontend) — D-1b
- Legacy asset cleanup (docker-compose, scripts, P0 import, tests) — D-1c
- Auto-rebuild on startup — D-2
