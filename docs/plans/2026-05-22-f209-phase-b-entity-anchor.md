---
feature_ids: [F209]
related_features: [F032, F102, F186, F188, F200, F208]
topics: [memory, evidence-recall, entity-anchor, alias-registry, privacy, implementation-plan]
doc_kind: plan
created: 2026-05-22
---

# F209 Phase B Entity Anchor / Alias Registry Implementation Plan

**Feature:** F209 — `docs/features/F209-evidence-recall-optimization.md`
**Goal:** Make entities a deterministic retrieval axis for `search_evidence`, so aliases such as `landy` / `CVO` / `铲屎官` resolve to one retrievable entity anchor with provenance and collection-scope redaction.
**Acceptance Criteria:** AC-B1 through AC-B6 from F209 Phase B.
**Architecture cell:** memory
**Map delta:** done
**Map delta why:** `memory` owns entity registry as retrieval anchors; `identity-session` / F032 remains roster truth. F208 consumes F209 `entity_id` for cat-dossier keys.
**Architecture:** Add SQLite-backed entity registry, alias dictionary, and entity mention index inside the existing evidence store. Query-time alias expansion is deterministic dictionary lookup, not classifier inference. Results carry entity-match explanation while original evidence anchors remain canonical.
**Tech Stack:** SQLite, `better-sqlite3`, existing `IEvidenceStore` / `KnowledgeResolver`, collection privacy redaction.
**前端验证:** No.

---

## Finish Line

Phase B is done when:

- `entity_registry` durably stores `entity_id`, `type`, aliases, provenance, and `updated_at`.
- `search_evidence("CVO", ...)` can find evidence that only says `铲屎官`, because both aliases resolve to the same entity.
- Indexing records entity mentions at doc and passage level, and returned results explain the entity hit.
- Project/global/library/collection searches keep their existing resolver boundaries; private collection redaction still removes entity details from persisted/transcript surfaces.
- F208 has one explicit consumer contract: use F209 `entity_id`; do not create a parallel cat/person namespace.

Phase B privacy model: entity registries are scoped by their owning evidence store/collection. Entity records do **not** carry entity-level `privacy_scope` / `sensitivity` fields in this slice, because that would be a half-wired safety control until collection routing can enforce it end-to-end. Mixed-scope entity records in one shared store are out of scope and must not be seeded until a later design adds entity-level tagging.

Not building in Phase B: candidate facet inference, roster editing, cat capability profiles, typed readers beyond existing raw passage windows, Perspective, or summary memory.

## Terminal Schema

SQLite schema version +1:

- `entity_registry`
  - `entity_id TEXT PRIMARY KEY` (`person:landy`, `cat:codex`, `feature:F209`, `concept:smart-folder`)
  - `entity_type TEXT NOT NULL`
  - `canonical_name TEXT NOT NULL`
  - `provenance_json TEXT NOT NULL`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
- `entity_aliases`
  - `(entity_id, alias_norm)` primary key
  - `alias TEXT NOT NULL`
  - `provenance_json TEXT NOT NULL`
- `entity_mentions`
  - `(entity_id, doc_anchor, passage_id, surface_norm)` primary key
  - `doc_anchor`, optional `passage_id`, `surface`, `source`, `provenance_json`, `created_at`

Runtime types:

- `EntityRecord`: durable registry entry.
- `EntityMatch`: result-level explanation: `entityId`, `type`, `canonicalName`, `surface`, `source`, `docAnchor`, optional `passageId`, and provenance.
- `EvidenceItem.entityMatches?: EntityMatch[]`.

## Task 1: Registry Storage

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts`
- Create: `packages/api/src/domains/memory/EntityRegistry.ts`
- Modify: `packages/api/src/domains/memory/interfaces.ts`
- Test: `packages/api/test/memory/entity-registry-store.test.js`

**TDD:** write failing tests for schema creation, alias normalization, deterministic query resolution, and durable upsert/get.

## Task 2: Mention Indexing

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts`
- Test: `packages/api/test/memory/entity-mention-index.test.js`

**TDD:** verify doc summary/title mentions and raw passage mentions are recorded from the alias dictionary. Bump `INDEXING_VERSION` because mention extraction is a derived index.

## Task 3: Alias Expansion Search

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Test: `packages/api/test/memory/entity-alias-search.test.js`

**TDD:** verify `CVO` finds evidence that only contains `铲屎官`; raw search returns the original passage anchor; result explanation says why the entity matched.

## Task 4: Federated Privacy Contract

**Files:**
- Modify: `packages/api/src/domains/memory/KnowledgeResolver.ts` only if existing resolver metadata is insufficient.
- Test: extend `packages/api/test/memory/entity-alias-search.test.js`

**TDD:** verify global-only search does not use project-only aliases, and private/restricted collection redaction strips entity details like other evidence fields.

Do not add entity-level privacy tags in this slice. AC-B5 is enforced by existing store/collection routing and `redactForTranscript`; entity-level tagging waits for a router-enforced design.

## Task 5: F208 + F200 Pointers

**Files:**
- Modify: `docs/features/F209-evidence-recall-optimization.md`
- Create: `docs/eval/f209-phase-b-entity-anchor-fixtures.md`

**TDD / docs gate:** add two F200 fixtures: `landy/CVO/铲屎官` alias unification and `cat:gemini` alias explanation. Mark only Phase B ACs that have implementation + tests.

## Quality Gate

Run before review:

```bash
PATH="$(brew --prefix node@24)/bin:$PATH" pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 PATH="$(brew --prefix node@24)/bin:$PATH" bash packages/api/scripts/with-test-home.sh node --test \
  packages/api/test/memory/entity-registry-store.test.js \
  packages/api/test/memory/entity-mention-index.test.js \
  packages/api/test/memory/entity-alias-search.test.js \
  packages/api/test/memory/raw-passage-semantic.test.js \
  packages/api/test/memory/evidence-route-di.test.js
pnpm check:features
```
