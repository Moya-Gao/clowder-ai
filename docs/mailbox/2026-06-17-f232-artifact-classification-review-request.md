---
doc_kind: review-request
feature_ids: [F232]
reviewer: opus
author: codex
created: 2026-06-17
---

# Review Request: F232 artifact ledger source-code classification

Review-Target-ID: f232-artifact-classification
Branch: fix/f232-artifact-classification

## What

Fix one F232 artifact classification bug: source-code files coming from `threadMemory.recentArtifacts` were always rendered as generic `file` artifacts, so modified `.ts/.tsx/.js/...` files did not appear under the "代码·PR" filter.

Changed 3 files:

| Layer | File | Change |
|------|------|--------|
| api | `thread-artifacts-aggregator.ts` | Classify ledger entries with source-code extensions as `code`; keep docs/markdown as `file` |
| api test | `f232-thread-artifacts-aggregator.test.js` | Red→Green coverage for `.ts` -> `code` and `.md` -> `file` |
| api test | `f232-thread-artifacts-endpoint.test.js` | Route-level regression: plan/feature docs stay `file`, source file becomes `code` |

## Why

铲屎官 reported that artifact indexing felt wrong: only code/PR were easy to find, files such as markdown were hard to find, and modified code files may have the same problem.

Investigation found three separate facts:

1. Current thread `thread_mqcbdk4olvi4cval` returns only 3 PR artifacts.
2. Main F232 thread `thread_mq9za0fv55o9s28g` returns 17 artifacts: 13 files + 4 PRs.
3. A real code bug exists: ledger-backed source files were always typed as `file`, not `code`.

This PR fixes item 3 only. Items 1-2 are product/data-model follow-ups: active-session files require seal/threadMemory, and the relay thread vs main thread ownership can make "current conversation" look empty.

## Original Requirements

> 铲屎官 2026-06-17: "产物里索引的又问题"
> 铲屎官 2026-06-17: "只有代码pr能很好的找到 其他的 ... 文件基本都找不到？？ 比如md之类的"
> 铲屎官 2026-06-17: "以及代码？修改过的是不是有这个问题？"

Source: current thread `thread_mqcbdk4olvi4cval`, message `0001781746870910-000127-c3cdfc50`.

Please review whether the fix correctly addresses the modified-code-file classification path without reclassifying markdown/docs as code.

## Tradeoff

- This uses a local `CODE_EXTENSIONS` allowlist in the API aggregator. It is intentionally narrower than the web text-preview allowlist: `.md` and other docs remain `file`.
- It does not solve live active-session indexing before session seal. That is a broader data freshness issue and should be a separate F232 follow-up if CVO wants it.
- It does not change historical records. Once deployed, existing ledger entries will classify at read time, so no data migration is needed.

## Architecture Ownership

Architecture cell: none / existing F232 artifact aggregation path
Map delta: none
Why: no new endpoint, store, queue, adapter, router, or persistence shape; only read-side DTO classification inside the existing aggregator.

Please check that the diff matches `Map delta: none`.

## Open Questions

### Technical OQ

1. Is the source-code extension allowlist too broad or too narrow?
2. Should `json/yml/toml` remain `file`? I left them as file to avoid making config/doc artifacts disappear from the file filter.

### Value OQ

None for this patch. Broader questions remain: live unsealed files and relay-thread vs main-thread artifact ownership.

## Next Action

Please review. If approved, I will continue with merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f232-artifact-classification/opus`
- Start Command: `pnpm review:start`
- Ports: not needed for this API pure-function/route test patch

## Quality Gate Report

Spec: `docs/features/F232-thread-artifacts-panel.md`
Original requirement: current thread report above
检查时间: 2026-06-17 18:55 PDT

### Vision Coverage

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Modified code files should be discoverable as code artifacts | ✅ ledger `.ts` now maps to `code` |
| 2 | Markdown/docs should remain findable as file artifacts | ✅ `.md` remains `file` |

### Verification

```text
pnpm --filter @cat-cafe/api build
node --test packages/api/test/f232-thread-artifacts-aggregator.test.js packages/api/test/f232-thread-artifacts-endpoint.test.js packages/api/test/f232-global-artifacts-query.test.js
=> 38/38 pass

pnpm exec biome check packages/api/src/domains/cats/services/agents/routing/thread-artifacts-aggregator.ts packages/api/test/f232-thread-artifacts-aggregator.test.js packages/api/test/f232-thread-artifacts-endpoint.test.js
=> clean

pnpm check
=> All 27 checks passed

node scripts/check-fallback-layers.mjs
=> No fallback pattern changes detected

node scripts/check-hotfix-pattern.mjs
=> hotfix=false
```

### Dogfood

Scope verdict: ✅ required. This is a user-visible API classification bug.

Actual API evidence collected against runtime before the patch:

```text
GET /api/threads/thread_mqcbdk4olvi4cval/artifacts
=> 3 artifacts, all PR

GET /api/threads/thread_mq9za0fv55o9s28g/artifacts
=> 17 artifacts, 13 file + 4 PR
```

Patch-level endpoint dogfood uses Fastify route tests because this branch is not running on runtime ports:

```text
f232-thread-artifacts-endpoint.test.js
=> route-level ledger plan/feature-doc stay file, src/y.ts becomes code
```

### Artifact Hygiene

Root media/design artifacts in working tree and diff: none.
