---
feature_ids: [F209]
related_features: [F200]
doc_kind: eval-fixture
phase: A
created: 2026-05-22
topics: [eval, raw-retrieval, passage-vector, semantic-search, hybrid-search]
---

# F209 Phase A — Raw Retrieval Fixtures

These fixtures are F209-owned regression cases for F200 to ingest into the
shared memory-recall golden set. They exercise message-level raw recall only:
no entity registry, Perspective, or summary memory behavior is expected here.

## Fixture 1: Semantic Raw Finds Non-Literal Message

**Purpose:** catch regressions where `depth=raw&mode=semantic` silently falls
back to document-level search or passage BM25 only.

| Field | Value |
|-------|-------|
| Query | `care logistics` |
| Scope | `threads` |
| Mode | `semantic` |
| Depth | `raw` |
| Limit | `1` |
| Context window | `1` |
| Seed passage | `Grandmother hospital transportation moved to Tuesday morning.` |
| Expected anchor pattern | `thread-*` parent result with passage `msg-*` |
| Expected drill-down behavior | Result contains `passages[0].docAnchor`, `threadId`, `messageId`, `speaker`, `createdAt`, and two surrounding context passages. |
| Negative guard | The seed passage does not contain literal query tokens `care` or `logistics`; lexical-only raw search should not be sufficient. |

**Pass condition:** top result carries a raw passage whose semantic vector
matches the query, with message/thread anchors preserved for typed drill-down.

## Fixture 2: Hybrid Raw Keeps Lexical And Semantic Hits

**Purpose:** catch regressions where `depth=raw&mode=hybrid` returns only BM25
hits or only NN hits instead of fusing both legs with RRF.

| Field | Value |
|-------|-------|
| Query | `appointment` |
| Scope | `threads` |
| Mode | `hybrid` |
| Depth | `raw` |
| Limit | `2` |
| Lexical seed passage | `The appointment keyword should be found by passage BM25.` |
| Semantic seed passage | `Grandmother hospital transportation moved to Tuesday morning.` |
| Expected anchor pattern | Two `thread-*` parent results, each with at least one raw passage. |
| Expected drill-down behavior | Each result has passage-level anchor fields; CVO/cat can open the parent thread and message window rather than reading a summary. |
| Negative guard | If passage vectors are unavailable, response must set `degraded=true`, `degradeReason=passage_embedding_unavailable`, `effectiveMode=lexical`. |

**Pass condition:** result set includes both the lexical-only passage hit and
the semantic-only passage hit; the semantic-only hit must not require the
literal query token to appear in passage content.

## Current Test Coverage

- `packages/api/test/memory/raw-passage-semantic.test.js`
- `packages/api/test/memory/raw-passage-ranking.test.js`
- `packages/api/test/evidence-route.test.js`

F200 owns the eventual metric wrapper (`recall@k`, anchor open rate, false
confidence, raw drill-down success). This file only records F209's Phase A
golden behavior and seed shape.
