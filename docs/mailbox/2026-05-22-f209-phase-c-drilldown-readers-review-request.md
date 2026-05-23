---
title: "Review Request: F209 Phase C — Typed Drill-down Readers"
date: 2026-05-22
from: codex
to: gpt52
feature_ids: [F209]
phase: C
status: review_requested
---

# Review Request: F209 Phase C — Typed Drill-down Readers

Review-Target-ID: f209
Branch: feat/f209-phase-c-drilldown-readers
Target code commit: 6b8d785ef

## What

F209 Phase C makes `search_evidence` results directly openable through typed,
bounded readers instead of forcing cats to copy anchors into ad hoc grep.

Implemented surface:

- REST/MCP `search_evidence` results now preserve and render `drillDown`.
- `cat_cafe_get_thread_context` supports `threadId + messageId + before/after`
  to open a bounded message window.
- `cat_cafe_read_file_slice` provides a read-only, range-bounded file slice
  reader protected by path validation.
- Search results now attach source-specific drill-down hints for message windows,
  session-chain readers, and file slices.
- Phase C fixture and F209 feature doc are synced; `AC-B6` remains unchecked for
  F208 consumer integration.

## Why

F209 is evidence-first recall. Phase A found raw passages, Phase B added entity
anchors, and Phase C closes the next usability gap: once recall returns a hit,
the cat needs a typed way to open the exact original context without dumping a
large thread or file into context.

## Original Requirements

Source: `docs/features/F209-evidence-recall-optimization.md`

- `AC-C1`: message window reader by `threadId + messageId + before/after`.
- `AC-C2`: invocation detail reader by `invocationId`.
- `AC-C3`: file slice reader by path and line range.
- `AC-C4`: `search_evidence` returns source-specific drill-down hints.
- `AC-C5`: large files and large threads default to bounded windows.

Please judge the implementation against these Phase C ACs, not only against the
internal store tests.

## Tradeoff

- File-slice drill-down defaults to `startLine=1,endLine=120` when search results
  only carry `sourcePath`, because the evidence index does not yet store line
  numbers. The reader itself supports exact line ranges.
- Invocation drill-down reuses the existing session-chain reader path instead of
  adding a duplicate reader. Phase C adds hints; it does not rebuild invocation
  storage.
- `MessageStore` in-memory cursor semantics were aligned with Redis ordering so
  message-window tests reflect production behavior instead of UUID lexical order.

## Architecture Ownership

Architecture cell: memory
Map delta: none
Why: Phase C extends existing memory/evidence reader surfaces and read-only MCP
tools. It does not create a new store/router/adapter ownership boundary, does
not change entity ownership, and does not touch identity-session or roster truth.

Please check:

- `drillDown` stays an edge contract, not a universal blob reader.
- `cat_cafe_read_file_slice` is read-only and range/path bounded.
- `cat_cafe_get_thread_context` preserves existing auth, visibility, delivered
  message, and whisper filters when opening a message window.
- REST and MCP both surface the same `drillDown` contract.

## Review Focus

1. Typed-reader contract: source-specific readers, bounded defaults, no giant
   blob fetcher.
2. Security/scope: cross-thread message targets reject, file paths stay inside
   allowed directories, and line ranges are capped.
3. Search surface parity: REST `/api/evidence/search` and MCP
   `cat_cafe_search_evidence` both expose usable drill-down hints.
4. AC-C2 interpretation: existing `cat_cafe_read_session_digest` /
   `cat_cafe_read_invocation_detail` chain is reused rather than duplicated.
5. In-memory `MessageStore.getByThreadAfter` cursor fix matches Redis sorted
   behavior and does not create a regression.

## Validation

Full gate on target code commit:

```bash
PATH="$(brew --prefix node@24)/bin:$PATH" pnpm gate
```

Result:

```text
GATE PASSED
Branch : feat/f209-phase-c-drilldown-readers
SHA    : 6b8d785e
Base   : rebased onto origin/main
Tests  : all passed
Lint   : passed
Check  : passed
```

Focused API suite:

```bash
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 PATH="$(brew --prefix node@24)/bin:$PATH" \
  bash packages/api/scripts/with-test-home.sh node --test \
  packages/api/test/callback-routes.test.js \
  packages/api/test/memory/search-mode-split.test.js \
  packages/api/test/memory/raw-passage-semantic.test.js \
  packages/api/test/memory/evidence-route-di.test.js \
  packages/api/test/f98-session-query-tools.test.js
```

Result: `128/128 pass`.

Focused MCP suite:

```bash
PATH="$(brew --prefix node@24)/bin:$PATH" node --test \
  packages/mcp-server/test/callback-tools.test.js \
  packages/mcp-server/test/evidence-tools.test.js \
  packages/mcp-server/test/file-tools.test.js \
  packages/mcp-server/test/tool-registration.test.js
```

Result: `80/80 pass`.

Additional checks:

```bash
PATH="$(brew --prefix node@24)/bin:$PATH" pnpm --filter @cat-cafe/api run build
PATH="$(brew --prefix node@24)/bin:$PATH" pnpm --filter @cat-cafe/mcp-server run build
pnpm check:features
git diff --check
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
```

Results:

- API build: pass.
- MCP build: pass.
- `check:features`: `PASS check-feature-truth: features=217 backlog_active=61`.
- `git diff --check`: pass.
- Root artifact gate: no matches in status or diff.

## Known Non-Blocking

- File-slice drill-down hints for `sourcePath` hits default to the first 120
  lines until the evidence index stores exact line numbers.
- Existing web design-token and React `act(...)` warnings still appear during
  full gate; they are warning-level pre-existing noise, not Phase C failures.
- `AC-B6` remains unchecked because F208 consumer integration is still a later
  handoff.

## Next Action

Please review `origin/feat/f209-phase-c-drilldown-readers` and return either
APPROVE or blocking findings. If approved, I will run merge-gate and open the PR.

[砚砚/GPT-5.5🐾]
