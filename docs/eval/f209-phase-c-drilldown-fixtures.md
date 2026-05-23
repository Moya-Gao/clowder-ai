---
feature_ids: [F209]
related_features: [F098, F188, F200]
doc_kind: eval-fixture
phase: C
created: 2026-05-22
topics: [eval, drill-down, typed-readers, message-window, file-slice]
---

# F209 Phase C — Typed Drill-down Fixtures

These fixtures are F209-owned regression cases for F200 to ingest into the
shared memory-recall golden set. They exercise opening the original evidence
window after recall. Search still finds candidates; typed readers read bounded
source windows.

## Fixture 1: Raw Passage Opens Message Window

**Purpose:** catch regressions where raw passage recall returns a message ID but
the cat cannot open the original surrounding conversation.

| Field | Value |
|-------|-------|
| Search query | `care logistics` |
| Search scope | `threads` |
| Search mode/depth | `semantic` / `raw` |
| Expected search result | `passages[0].threadId` and `passages[0].messageId` are present. |
| Expected drill-down | `drillDown.tool = cat_cafe_get_thread_context` with `threadId`, `messageId`, `before`, and `after`. |
| Reader call | `cat_cafe_get_thread_context(threadId, messageId, before=3, after=3)` |
| Reader expected output | Target message plus bounded neighboring messages, never the whole thread. |
| Negative guard | Cross-thread `messageId` returns 404 and does not leak another thread's content. |

**Pass condition:** the raw passage can be opened as a bounded message window.

## Fixture 2: Session Result Points To Invocation Detail Chain

**Purpose:** catch regressions where session recall only returns a digest and
cats lose the path to individual invocation details.

| Field | Value |
|-------|-------|
| Search result | `kind=session`, anchor shape `session-*`. |
| Expected drill-down | `drillDown.tool = cat_cafe_read_session_digest` and hint names the session ID. |
| Reader chain | `cat_cafe_read_session_digest(sessionId)` → `cat_cafe_read_session_events(sessionId, view=handoff)` → `cat_cafe_read_invocation_detail(sessionId, invocationId)`. |
| Negative guard | Do not add a second invocation reader that bypasses existing session-chain auth/formatting. |

**Pass condition:** invocation detail remains a typed reader and the result
points to the session-chain path instead of a generic blob reader.

## Fixture 3: File Source Opens Bounded Slice

**Purpose:** catch regressions where doc/file results only expose a path but no
bounded reader contract.

| Field | Value |
|-------|-------|
| Search result | Any result with `sourcePath`, e.g. `docs/features/F209-evidence-recall-optimization.md`. |
| Expected drill-down | `drillDown.tool = cat_cafe_read_file_slice` with `path`, `startLine=1`, `endLine=120`. |
| Reader call | `cat_cafe_read_file_slice(path, startLine, endLine)` |
| Reader expected output | Numbered lines for the bounded range. |
| Negative guard | Ranges over 400 lines are refused; paths outside allowed directories are refused. |

**Pass condition:** file/document evidence can be opened in a bounded, read-only
slice.

## Current Test Coverage

- `packages/api/test/memory/raw-passage-semantic.test.js`
- `packages/api/test/memory/search-mode-split.test.js`
- `packages/api/test/memory/evidence-route-di.test.js`
- `packages/api/test/callback-routes.test.js`
- `packages/mcp-server/test/callback-tools.test.js`
- `packages/mcp-server/test/evidence-tools.test.js`
- `packages/mcp-server/test/file-tools.test.js`
- `packages/mcp-server/test/tool-registration.test.js`

F200 owns the eventual metric wrapper (`anchor open rate`, `drill-down success`,
and `false confidence`). This file records the Phase C source-window behavior
and seed shape.
