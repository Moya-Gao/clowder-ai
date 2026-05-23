---
feature_ids: [F209]
related_features: [F098, F102, F188, F200]
topics: [memory, evidence-recall, drill-down, typed-readers, mcp]
doc_kind: plan
created: 2026-05-22
---

# F209 Phase C Typed Drill-down Readers Implementation Plan

**Feature:** F209 — `docs/features/F209-evidence-recall-optimization.md`
**Goal:** Make `search_evidence` results actionable by attaching typed, bounded drill-down hints and by extending existing readers so cats can open the exact source window instead of copying IDs into ad hoc grep.
**Acceptance Criteria:** AC-C1 through AC-C5 from F209 Phase C.
**Architecture cell:** memory
**Map delta:** none
**Map delta why:** Phase C extends existing memory/evidence reader surfaces (`search_evidence`, callback thread context, session-chain readers, and read-only file access). It does not change entity ownership, roster truth, collection privacy ownership, or add a new architecture cell.
**Architecture:** Preserve canonical evidence anchors and add typed drill-down contracts at the edge: message windows are served through `cat_cafe_get_thread_context`, invocation details through existing session-chain tools, and file slices through a narrow read-only MCP reader. `search_evidence` emits source-type hints, not inferred conclusions.
**Tech Stack:** TypeScript, Fastify, Zod, existing `IMessageStore`, SQLite-backed `IEvidenceStore`, MCP tool schemas, `node:test`.
**前端验证:** No. This is API/MCP contract work; browser/Perspective UI remains Phase D.

---

## Finish Line

Phase C is done when:

- `cat_cafe_get_thread_context` can open a bounded message window by `threadId + messageId + before/after`.
- `cat_cafe_read_invocation_detail` remains the typed invocation detail reader, and search results point to the correct session-chain path when invocation-level drill-down is needed.
- `cat_cafe_read_file_slice` can open a bounded, read-only file range by `path + startLine/endLine`.
- `/api/evidence/search` and MCP `cat_cafe_search_evidence` both surface `drillDown` hints for source-specific next reads.
- Default behavior stays windowed: large threads and files are never returned in full by the new Phase C paths.

Not building in Phase C: Perspective run traces, Smart Folder UI, summary memory, entity seeding, F208 cat-dossier consumption, or a universal “read anything” black-box reader.

## Terminal Schema

Runtime result contract:

- `EvidenceItem.drillDown?: { tool, params, hint }` remains the internal source of truth.
- REST `EvidenceResult` gains `drillDown` and forwards it unchanged from `EvidenceItem`.
- MCP `SearchEvidenceResponseItem` gains `drillDown` and renders a stable machine-readable line.

Reader contracts:

- `cat_cafe_get_thread_context({ threadId, messageId, before, after })`
  - Returns target message plus bounded neighboring messages.
  - Keeps existing thread auth, user scoping, delivered-message filtering, and whisper filtering.
  - Defaults remain compatible with existing callers that only pass `limit/threadId/catId/keyword`.
- `cat_cafe_read_invocation_detail({ sessionId, invocationId })`
  - Existing typed reader; Phase C adds better hints rather than duplicating it.
- `cat_cafe_read_file_slice({ path, startLine, endLine })`
  - Read-only, path-validator protected, line range bounded.
  - Returns numbered lines and refuses directories, missing files, invalid ranges, or overly large slices.

## Task 1: REST/MCP Drill-down Contract

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts`
- Modify: `packages/api/src/routes/evidence-helpers.ts`
- Modify: `packages/api/src/routes/evidence.ts`
- Modify: `packages/mcp-server/src/tools/evidence-tools.ts`
- Test: `packages/api/test/memory/evidence-route-di.test.js`
- Test: `packages/mcp-server/test/evidence-tools.test.js`

**TDD:** red tests prove route and MCP preserve/render `drillDown` from a mock evidence store.

## Task 2: Message Window Reader

**Files:**
- Modify: `packages/api/src/routes/callbacks.ts`
- Modify: `packages/mcp-server/src/tools/callback-tools.ts`
- Test: `packages/api/test/callback-routes.test.js`
- Test: `packages/mcp-server/test/callback-tools.test.js`

**TDD:** red tests prove `messageId + before/after` returns exactly the bounded window, rejects cross-thread targets, and preserves existing keyword/latest-context behavior.

Implementation notes:

- Use existing `IMessageStore.getById`, `getByThreadBefore`, and `getByThreadAfter`; do not add a store boundary.
- Fetch `before` messages before the target timestamp, target itself, and `after` messages after the target ID.
- Re-run the same visibility/whisper filter used by current thread-context output before returning the window.

## Task 3: Search Result Drill-down Hints

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Test: `packages/api/test/memory/search-mode-split.test.js`
- Test: `packages/api/test/memory/raw-passage-semantic.test.js`

**TDD:** red tests prove passage-backed thread results point at `cat_cafe_get_thread_context` with `messageId/before/after`, session results retain session-chain hints, and non-passage thread results keep the existing thread-context fallback.

## Task 4: File Slice Reader

**Files:**
- Modify: `packages/mcp-server/src/tools/file-tools.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`
- Modify: `packages/mcp-server/src/server-toolsets.ts`
- Test: `packages/mcp-server/test/file-tools.test.js`
- Test: `packages/mcp-server/test/tool-registration.test.js`

**TDD:** red tests prove `cat_cafe_read_file_slice` returns numbered bounded lines, enforces path validation, refuses invalid ranges, and is registered in full/memory/read-only toolsets without exposing write access.

## Task 5: Fixtures and Feature Sync

**Files:**
- Create: `docs/eval/f209-phase-c-drilldown-fixtures.md`
- Modify: `docs/features/F209-evidence-recall-optimization.md`
- Modify: `docs/features/index.json` via generator if required.

**TDD / docs gate:** add fixtures for message-window drill-down, invocation-detail drill-down, and file-slice drill-down. Mark Phase C ACs only after implementation and tests are green.

## Quality Gate

Run before review:

```bash
PATH="$(brew --prefix node@24)/bin:$PATH" pnpm --filter @cat-cafe/api run build
PATH="$(brew --prefix node@24)/bin:$PATH" pnpm --filter @cat-cafe/mcp-server run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 PATH="$(brew --prefix node@24)/bin:$PATH" bash packages/api/scripts/with-test-home.sh node --test \
  packages/api/test/callback-routes.test.js \
  packages/api/test/memory/search-mode-split.test.js \
  packages/api/test/memory/raw-passage-semantic.test.js \
  packages/api/test/memory/evidence-route-di.test.js \
  packages/api/test/f98-session-query-tools.test.js
PATH="$(brew --prefix node@24)/bin:$PATH" node --test \
  packages/mcp-server/test/callback-tools.test.js \
  packages/mcp-server/test/evidence-tools.test.js \
  packages/mcp-server/test/file-tools.test.js \
  packages/mcp-server/test/tool-registration.test.js
pnpm check:features
```

Before PR / merge-gate:

```bash
pnpm gate
```
