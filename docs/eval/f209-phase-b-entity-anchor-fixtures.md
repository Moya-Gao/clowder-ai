---
feature_ids: [F209]
related_features: [F200, F208]
doc_kind: eval-fixture
phase: B
created: 2026-05-22
topics: [eval, entity-anchor, alias-registry, privacy, evidence-recall]
---

# F209 Phase B — Entity Anchor Fixtures

These fixtures are F209-owned regression cases for F200 to ingest into the
shared memory-recall golden set. They exercise deterministic entity alias
expansion only: no classifier inference, no capability-profile routing, and no
roster-truth mutation is expected here.

## Fixture 1: CVO Alias Finds Chinese-Only Evidence

**Purpose:** catch regressions where `search_evidence("CVO")` only searches the
literal token and misses evidence that uses `铲屎官`.

| Field | Value |
|-------|-------|
| Query | `CVO` |
| Scope | `docs` |
| Mode | `lexical` |
| Depth | `summary` |
| Entity seed | `person:landy` aliases: `landy`, `CVO`, `铲屎官` |
| Evidence seed | Summary contains `铲屎官` but not literal `CVO`. |
| Expected anchor pattern | Existing doc evidence item, not a generated summary. |
| Expected explanation | Result contains `entityMatches[0].entityId = person:landy`, `matchedAlias = CVO`, and `surface = 铲屎官`. |
| Negative guard | Query must not match `chief vision discussion` unless that exact alias is registered. |

**Pass condition:** alias expansion is a deterministic dictionary lookup, and
the returned evidence remains anchored to the original doc.

## Fixture 2: Raw Entity Hit Returns Passage Anchor

**Purpose:** catch regressions where entity alias hits only hydrate parent docs
and lose raw message coordinates.

| Field | Value |
|-------|-------|
| Query | `CVO` |
| Scope | `threads` |
| Mode | `lexical` |
| Depth | `raw` |
| Entity seed | `person:landy` aliases: `landy`, `CVO`, `铲屎官` |
| Passage seed | Message passage contains `铲屎官说 Phase B 要先把实体门牌号钉住。` |
| Expected anchor pattern | `thread-*` parent result with passage `msg-*`. |
| Expected drill-down behavior | Result contains `passages[0].docAnchor`, `threadId`, `messageId`, `speaker`, `createdAt`, and `entityMatches`. |
| Negative guard | Result must not return a synthetic entity doc instead of the original passage. |

**Pass condition:** alias expansion can open the raw passage window that
contains the registered entity surface.

## Fixture 3: Private Collection Redaction Strips Entity Details

**Purpose:** catch regressions where entity explanations leak private collection
content into library / transcript surfaces.

Phase B uses collection-store routing plus `redactForTranscript`; entity records
do not carry half-wired entity-level privacy tags.

| Field | Value |
|-------|-------|
| Query | `CVO` |
| Dimension | `collection` |
| Collections | `world:private-*` |
| Sensitivity | `private` |
| Expected anchor pattern | Private collection item anchor may remain visible. |
| Expected redaction | Title is `[redacted — private collection]`; `entityMatches` is omitted. |
| Negative guard | `dimension=library` must not route private collections by default. |

**Pass condition:** F186 collection redaction remains authoritative over F209
entity explanations.

## Current Test Coverage

- `packages/api/test/memory/entity-registry-store.test.js`
- `packages/api/test/memory/entity-alias-search.test.js`
- `packages/api/test/memory/entity-mention-index.test.js`
- `packages/api/test/memory/passage-embedding-index.test.js` (dirty refresh guard)

F200 owns the eventual metric wrapper (`recall@k`, anchor open rate, false
confidence, raw drill-down success). This file only records F209's Phase B
golden behavior and seed shape.
