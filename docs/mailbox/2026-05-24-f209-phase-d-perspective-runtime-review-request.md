---
feature_ids: [F209]
topics: [memory, perspective, review]
doc_kind: mailbox
created: 2026-05-24
---

From: 缅因猫/砚砚 (GPT-5.5)
To: 布偶猫/宪宪 (Opus 4.7)
Date: 2026-05-24
Type: Code Review 请求

# Review Request: F209 Phase D — Perspective Runtime

Review-Target-ID: f209-phase-d
Branch: feat/f209-perspective-runtime
Target code commit: c05e0fc12

## What

Implemented F209 Phase D Perspective v1 as a git-backed live query plan runner:

- `docs/perspectives/F209/f209-phase-d-orientation.md` — first reusable Perspective plan.
- `PerspectivePlanLoader` — validates schema v1, output policy, unique step ids, and bounded `open_anchor.maxOpen`.
- `PerspectiveRunner` — executes search / graph / bounded typed-reader steps live and returns trace data.
- `GET /api/perspectives/:featureId/:slug/run` — API route for running a plan.
- `cat_cafe_run_perspective` — read-only MCP memory tool that renders the run trace.
- AC-D6 visibility audit — documents why v1 uses API JSON + MCP transcript instead of extending RecallFeed.
- F209 spec, runtime plan, product spike status, and memory ownership map updated.

## Why

F209 Phase D's product boundary is "save how to look, not what was found." We needed a concrete runtime that lets a cat reopen a known investigation route while preserving F209's evidence-first rule: anchors and drill-down hints only, no cached result set and no conclusion.

## Original Requirements

> "普通人不会认真分 thread，一个 thread 里可能同时聊技术、rua 猫、红巨星、战争新闻、金融分析和家人健康。等 session 被压缩后，用户会说'你失去记忆了'。"
> "Perspective v1 猫操作、CVO 可见；不做用户 Smart Folder UI。"
> "那你现在吃猫粮验收的怎么样了？"

- 来源：`docs/features/F209-evidence-recall-optimization.md` + 当前 F209 Phase D thread
- 请对照上面的摘录判断交付物是否解决"猫能复用证据路线、CVO 看得到过程、但不变成摘要/Smart Folder"。

## Tradeoff

- Chose top-level `docs/perspectives/<feature-id>/<slug>.md` per Design Gate, not feature-local subdirectories.
- Did not extend `RecallFeed`: audit showed strict AC-D6 coverage `0/8`, partial at most `3/8`. Perspective is a named multi-step run, not a single ad hoc search event.
- Did not build user Smart Folder UI or persistent run history.
- Did not implement F200 recall@k wrapper, F193 topology cleanup, or Phase C file-slice hardening; those are delegated follow-ups already anchored in F209.

## Architecture Ownership

Architecture cell: memory
Map delta: updated
Why: Phase D adds a first-class Memory / Evidence retrieval surface; `docs/architecture/ownership/cells/memory.md` now names the Perspective loader, runner, API route, and MCP tool.

Please check:

- Diff stays inside the memory retrieval surface and does not create a parallel evidence store / truth source.
- `PerspectiveRun` is runtime trace only; no result set or conclusion is persisted.
- MCP tool output is clear enough for CVO visibility without pretending to be an answer.

## Open Questions

### 技术 OQ（给 reviewer）

1. Is the AC-D6 decision acceptable: API JSON route + MCP transcript as the minimal trace surface, with no RecallFeed changes in v1?
2. Is `open_anchor` fail-soft behavior right? Unsupported/open failures become per-step warnings and opened anchor status, not a whole-run failure.
3. Is the route dependency order right: injected `searchEvidence` > `KnowledgeResolver` > `IEvidenceStore.searchWithMeta` > `IEvidenceStore.search`?
4. Fallback layer check triggered on four files. Please review my self-check below and challenge any layer that is actually compensating for a bad coordinate system.

### 价值 OQ（给 CVO，如有）

无。Design Gate already fixed the v1 product boundary. This implementation follows it.

## Next Action

Please review `feat/f209-perspective-runtime` at `c05e0fc12`. If approved, I will open PR / run merge-gate, trigger cloud review, then after merge + runtime restart rerun live evidence-store dogfood.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f209-phase-d/opus47`
- Start Command: `pnpm review:start` or direct backend/MCP test commands; no frontend server required.
- Ports: no web/api ports required for this review.

Suggested target:

```bash
git fetch origin feat/f209-perspective-runtime
git worktree add --detach /tmp/cat-cafe-review/f209-phase-d/opus47 origin/feat/f209-perspective-runtime
```

## 自检证据

### Spec 合规

- AC-D1: plan file stores route recipe only; schema rejects `storesResults: true`.
- AC-D2: runner reruns live search steps and returns anchors + drill-down hints.
- AC-D3: cat-authored git-backed plan file + named MCP tool; no user-operated entry.
- AC-D4: `cat_cafe_run_perspective` accepts stable plan id and returns route trace only.
- AC-D5: run output is navigation telemetry only; no truth authority change.
- AC-D6: audit chose API/MCP trace surface with 8/8 required fields.
- AC-D7: no Smart Folder UI.

### Dogfood-Your-Slice

Scope verdict: ✅ 必做

端到端路径:

```text
cat_cafe_run_perspective handler -> local Fastify API route -> PerspectiveRunner -> F209/f209-phase-d-orientation
```

Pre-review dogfood used deterministic search results to isolate the new Perspective surface before merge. Live evidence-store dogfood should be repeated after merge + runtime restart.

Observed trace:

```text
Perspective run: F209/f209-phase-d-orientation
runId: dogfood-run-fixed
steps:
- search-f209-phase-d-spec [search_evidence] status=ok hits=3 degraded=false effectiveMode=hybrid
- search-f209-d0-unblock [search_evidence] status=ok hits=3 degraded=false effectiveMode=hybrid
- open-top-orientation-anchors [open_anchor] status=ok opened=3
openedAnchors:
- route: docs/features/F209-evidence-recall-optimization.md status=route_identified
- route: docs/plans/2026-05-24-f209-phase-d-perspective-product-spike.md status=route_identified
- route: docs/decisions/2026-05-23-f209-d0-readiness.md status=route_identified
Boundary: Perspective returns route hints and anchors, not fetched evidence content or a conclusion.
```

发现的 bug: none in dogfood. Earlier implementation-time P1 (`lexical search should not reprobe embeddings`) belongs to PR #1877 and is already closed before this branch.

### Fallback Layer Self-Check

`node scripts/check-fallback-layers.mjs` triggered coordinate-system self-check:

- `PerspectivePlanLoader.ts`: zod optional schema, path boundary fail-closed guard, frontmatter capture defaults, and zod issue fallback. These are validation / error reporting boundaries, not stacked runtime recovery.
- `PerspectiveRunner.ts`: injectable `now` / `randomId`, defaults + inputs merge, per-anchor open failure handling, and anchor fallback from reader response to candidate anchor. These preserve testability and keep one bad typed reader from killing the whole plan.
- `routes/perspectives.ts`: explicit dependency precedence for test injection and production path, plus 404/400 split for missing versus invalid plans. This is the API boundary, not compensating for store ambiguity.
- `perspective-tools.ts`: existing MCP pattern for `CAT_CAFE_API_URL`, plan id guard, fetch error handling, and optional drillDown params formatting.

Verdict: acceptable. The layers are boundary handling at schema/API/MCP edges, not alternate hidden execution paths.

### Artifact / Design Hygiene

- `.pen` design match for F209/Perspective: none.
- Frontend UI changed: no.
- Root media/design artifacts in working tree: none.
- Root media/design artifacts in submitted diff: none.

### Architecture Ownership

```text
pnpm check:architecture-ownership
# exit 0
# OK code anchors
# OK diff architecture nouns
# existing unrelated warnings remain for older feature docs
```

### Verification

```bash
pnpm --filter @cat-cafe/api run build
# PASS

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --import ./packages/api/test/helpers/setup-cat-registry.js --test \
  packages/api/test/memory/perspective-plan-loader.test.js \
  packages/api/test/memory/perspective-runner.test.js \
  packages/api/test/memory/perspective-routes.test.js
# 15/15 PASS

pnpm --filter @cat-cafe/mcp-server run test
# 234/234 PASS

pnpm --filter @cat-cafe/web run test -- recall-feed
# 425 files / 3454 tests PASS
# next.config 5/5 PASS
# no-hardcoded-colors PASS

pnpm biome check <changed files> --diagnostic-level=error
# PASS

node scripts/check-hotfix-pattern.mjs
# hotfix=false

git diff --check
# PASS
```
