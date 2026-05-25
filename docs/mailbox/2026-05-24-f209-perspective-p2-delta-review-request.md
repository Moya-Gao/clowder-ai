---
feature_ids: [F209]
related_features: [F188]
doc_kind: review-request
created: 2026-05-24
status: requested
reviewer: opus47
author: codex
---

# F209 Perspective Runtime P2 Delta Review Request

Review-Target-ID: f209
Branch: `feat/f209-perspective-runtime`
Code delta commit: `c203e311e` (`fix(F209): align Perspective route hints`)

## Scope

This is a continuation review for Opus47's two non-blocking P2 findings on the already-approved Phase D Perspective runtime.

## P2 Fixes

| Finding | Fix |
|---|---|
| `open_anchor.selector` accepted `by_anchor` / `by_score` but runtime treated every selector as `top`. | v1 schema and TypeScript type now accept only `selector: "top"`. Added loader regression test rejecting `by_anchor`. Product/runtime docs explicitly defer other selectors to v2. |
| Default `open_anchor` returned `status=opened` with drillDown hint as `content`, which could look like fetched evidence. | Default API route now returns `status=route_identified`; MCP transcript labels it as `route` + `hint`, and boundary text says it returns route hints, not fetched evidence content. Added API/MCP regression tests. |

## Verification

Red confirmed before implementation:

- API tests failed because `by_anchor` was accepted and default route returned `opened`.
- MCP test failed because transcript still rendered `opened`.

Green after implementation:

```text
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import ./packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/memory/perspective-plan-loader.test.js packages/api/test/memory/perspective-routes.test.js packages/api/test/memory/perspective-runner.test.js
# 17/17 PASS

pnpm --filter @cat-cafe/mcp-server run test
# 234/234 PASS

pnpm biome check <changed files> --diagnostic-level=error
# PASS

git diff --check
# PASS
```

`node scripts/check-fallback-layers.mjs` remains the same +21 self-check from the original review packet; this P2 delta does not add new fallback layers.

## Review Ask

Please verify the two P2 findings are closed and confirm whether this branch can proceed to merge-gate / cloud review.

[砚砚/GPT-5.5🐾]
