---
title: F188 Graph Anchor/UI Bugfix Review Request
date: 2026-05-08
feature: F188
review_target_id: f188-graph-anchor-ui
branch: fix/f188-graph-anchor-ui
status: review-requested
---

# F188 Graph Anchor/UI Bugfix Review Request

Reviewer: @opus
Author: @codex
Branch: `fix/f188-graph-anchor-ui`

## User Report

铲屎官截图反馈：

> 好像你们的graph 还是有bug？ 比以前更丑了 且 f186的link是啥也没显示出来啊

Observed on current runtime:

- `GET /api/library/graph?anchor=f186&depth=1` returned `nodeCount=1`, `edgeCount=0`
- `GET /api/library/graph?anchor=F186&depth=1` returned `nodeCount=23`, `edgeCount=30`
- Graph UI rendered one large clipped title inside a node, with excessive blank canvas height

## Root Cause

1. `GraphResolver` resolved `f186` case-insensitively through `store.getByAnchor()`, but kept using the raw input anchor for `store.getRelated()`.
   - Center node existed because document lookup was tolerant.
   - Edges disappeared because edge lookup remained case-sensitive (`f186` vs canonical `F186`).

2. `CollectionGraph` rendered `node.title` inside the node circle.
   - Long Chinese titles overflowed the fixed-radius SVG node.
   - The SVG had only `w-full`, so the browser stretched the graph into a tall mostly-empty canvas.

## Fix

### Backend

`packages/api/src/domains/memory/GraphResolver.ts`

- Canonicalizes every resolved document anchor before:
  - node map insertion
  - visited tracking
  - related-edge lookup
  - edge endpoint emission
  - center node lookup
- Preserves unresolved/placeholder behavior by falling back to the original input anchor when no document exists.

### Frontend

`packages/web/src/components/memory/CollectionGraph.tsx`

- Node circles now render compact anchor labels such as `F186`.
- Full document title remains in the SVG `<title>` tooltip.
- SVG canvas is constrained with `h-[520px] w-full`.

This is deliberately a surgical repair, not a second full graph redesign.

## Tests

Added Red -> Green coverage:

- `packages/api/test/memory/graph-resolver.test.js`
  - `canonicalizes case-insensitive anchor matches before fetching edges`
- `packages/web/src/components/memory/__tests__/CollectionGraph.test.tsx`
  - `uses compact anchor labels and constrains the graph canvas height`

## Verification

Passed:

```bash
pnpm --filter @cat-cafe/api build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 packages/api/test/memory/graph-resolver.test.js

node packages/web/scripts/run-with-node-env-test.mjs \
  pnpm --dir packages/web exec vitest run src/components/memory/__tests__/CollectionGraph.test.tsx

git diff --check origin/main...HEAD
pnpm lint
pnpm exec biome check \
  packages/api/src/domains/memory/GraphResolver.ts \
  packages/api/test/memory/graph-resolver.test.js \
  packages/web/src/components/memory/CollectionGraph.tsx \
  packages/web/src/components/memory/__tests__/CollectionGraph.test.tsx
```

Results:

- API graph resolver tests: 13/13 pass
- Web graph component tests: 7/7 pass
- `git diff --check`: clean
- `pnpm lint`: exit 0, unrelated hardcoded-color warnings remain
- Changed-file biome check: 0 errors, 2 existing warnings in `GraphResolver.ts`

Known baseline:

- Full `pnpm check` currently fails on unrelated formatting errors already present on main, outside this diff.
- `scripts/check-fallback-layers.mjs` reports net `+2`; both are bounded coordinate/label guards, not cascading fallback chains:
  - `doc?.anchor ?? currentAnchor` keeps unresolved placeholders working while canonicalizing real docs.
  - `anchor.split(':').at(-1) ?? anchor` is label formatting only.

## Review Focus

1. Does canonicalizing the anchor at resolver boundary preserve placeholder/unresolved-node semantics?
2. Are duplicate/visited semantics correct when input differs only by case from canonical anchor?
3. Is compact anchor labeling acceptable as the immediate UI repair for the clipped-title graph bug?

[砚砚/GPT-5.5🐾]
