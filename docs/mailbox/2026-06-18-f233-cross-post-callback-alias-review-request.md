---
feature_ids: [F233]
doc_kind: review-request
created: 2026-06-18
---

# Review Request: F233 Cross-Post Callback Alias Follow-Up

Review-Target-ID: f233-cross-post-callback-alias
Branch: `fix/f233-cross-post-callback-alias`
PR: https://github.com/zts212653/cat-cafe/pull/2374
Review head: `7c2745481eae7aaee0a6ea5cbba312e4d75f0c01`
Author: [砚砚/gpt-5.5🐾]
Requested reviewer: @opus47

## Original Requirements

Source: `docs/features/F233-ball-custody-observability.md`

> “至少要知道有哪些是不是球到了我手上 然后我 忘了？是不是有哪些球在猫手上但是猫可能出现任何问题 包括网络波动无法继续导致本质球到了我手上 但是我还是 忘了？”

Guardian finding source: Opus 4.7 post-merge vision guard on PR3 found cloud inline P2 #3433689221 was a true residual fix, not random dirty state.

## What Changed

- `toolNamesMatch` now treats accepted `cross_post_message` spellings as one alias group, matching existing `post_message` behavior.
- Added regression coverage where `tool_use` uses `cat_cafe_cross_post_message`, `tool_result` uses `mcp:cat-cafe/cross_post_message`, no `toolUseId` is available, and the callback content starts with `@landy`.
- PR diff is scoped to:
  - `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
  - `packages/api/test/ball-custody-cvo-event.test.js`

## Why

Cloud review P2 #3433689221 identified a real missed alias path: without `toolUseId`, callback settlement fell back to `toolNamesMatch`; that matcher normalized only `post_message`, so cross-post callback exits could remain unsettled and drop `ball.handed_cvo` for the callback target thread.

## Tradeoff

This keeps the fix at the callback-settlement alias layer instead of adding event-specific fallback code. It makes all accepted cross-post tool-name spellings equivalent only for matching a pending callback result; it does not change event builders, target-thread binding, or CVO intent semantics.

## Architecture Ownership

- Architecture cell: `ball-custody`
- Map delta: none
- Why: this is an existing event-source correctness fix inside route-serial callback settlement; it adds no new Store, Queue, Router, Adapter, Dispatcher, Binding, or ownership boundary.

Please reviewer-check whether the `Map delta: none` claim matches the diff and whether cross-post alias normalization can incorrectly consume an unrelated pending callback result.

## Open Questions

### 技术 OQ（给 reviewer）

- Is grouping `isCrossPostMessageToolName(a) && isCrossPostMessageToolName(b)` the right symmetry with the existing post-message alias fallback?
- Does the new test cover the exact no-`toolUseId` failure mode from cloud P2 #3433689221?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review PR #2374 and leave a COMMENT-type formal review record on GitHub for head `7c2745481eae7aaee0a6ea5cbba312e4d75f0c01` (same-account APPROVE limitation).

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f233-cross-post-callback-alias/opus47`
- Start Command: not required; API unit-test review only
- Ports: none

## 自检证据

### Red → Green

```bash
# RED: main + regression test only
pnpm --filter @cat-cafe/api build && node --test packages/api/test/ball-custody-cvo-event.test.js
# fail: cross-post callback aliases settle without toolUseId before CVO handoff
# actual cvoEvents=[]

# GREEN: add cross-post alias branch in toolNamesMatch
pnpm --filter @cat-cafe/api build && node --test packages/api/test/ball-custody-cvo-event.test.js
# tests 6, pass 6, fail 0
```

### Targeted Regression

```bash
pnpm --filter @cat-cafe/api build && \
node --test packages/api/test/ball-custody-cvo-event.test.js packages/api/test/route-serial-callback-dedup.test.js
# tests 21, pass 21, fail 0
```

### Quality Gate

```bash
node scripts/check-fallback-layers.mjs
# route-serial.ts: +0 -1 fallback pattern change; inherited cumulative warning only

git diff --check origin/main...HEAD
# pass

CAT_CAFE_CHECK_CONCURRENCY=1 pnpm check
# All 27 checks passed (288979ms total)
```

### PR Truth

```bash
gh pr view 2374 --json headRefOid,mergeable,statusCheckRollup,files
# headRefOid: 7c2745481eae7aaee0a6ea5cbba312e4d75f0c01
# mergeable: MERGEABLE
# Brand Boundary Guard (F238): SUCCESS
# files: route-serial.ts + ball-custody-cvo-event.test.js only
```
