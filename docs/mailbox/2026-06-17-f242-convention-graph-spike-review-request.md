---
feature_ids: [F242]
topics: [code-intelligence, convention-graph, review-request]
doc_kind: mailbox
created: 2026-06-17
---

# Review Request: F242 Convention Graph Layer Spike

Review-Target-ID: f242
Branch: feat/f242-convention-graph

## What

F242 Phase A + Phase B skeleton implemented on `feat/f242-convention-graph`:

1. New package `@cat-cafe/convention-graph` with a worktree-local `node:sqlite` engine for convention nodes, edges, gaps, indexed files, provenance, freshness, and `codeConsumers()` queries.
2. Domain plugin interface plus three deterministic extractors:
   - `mcp-tool`: MCP tool definitions, toolset registrations, exact string consumers, permission metadata, and missing-tool gaps.
   - `skill-manifest`: `cat-cafe-skills/*/SKILL.md` manifest name + trigger convention edges.
   - `fastapi-route`: unfamiliar-repo FastAPI `APIRouter` and route decorators, used as Phase B skeleton against deer-flow.
3. New `convention-graph-discovery` skill + manifest/BOOTSTRAP/symlink wiring.
4. New architecture ownership cell `code-intelligence` and F242 spec implementation checkpoints.

## Why

F242 is not "another codegraph"; it is the first internal Convention Graph Layer slice: repo-specific convention edges that LSP and grep cannot represent reliably, with source provenance and freshness so cats can follow impact paths before editing.

## Original Requirements（必填）

> 铲屎官（2026-06-17）："如果当猫猫们进入一个新的 repo 要如何构建出专属的「约定层关联图」，是不是才是我们成功的胜负手？"
> "减少你们费力的 grep 之类的，甚至比如说改了这个似乎可以改，结果导致另一个模块炸了。"

- 来源：`docs/features/F242-code-graph-layer-spike.md` Why
- **请对照上面的摘录判断交付物是否验证了“进 repo 建约定图、改 X 查影响面”的机制。**

## Tradeoff

- Chose `node:sqlite` + deterministic extractors instead of graph DB / embeddings / clustering in the authoritative path. This keeps F242 small, local, explainable, and license-safe.
- Phase A implements cat-cafe domains, but the engine/plugin boundary is domain-agnostic so Phase B can add repo-specific domains without rewriting the engine.
- GitNexus-style clustering is left as discovery assistance only; authoritative edges must come from source spans and extractor provenance.
- Freshness starts as indexed file hash + pending changes, not a daemon watcher. Stale marking is the spike gate; live auto-sync is out of scope.

## Architecture Ownership（必填）

Architecture cell: code-intelligence
Map delta: new cell required
Why: F242 creates a new code-level convention graph layer; it must stay separate from memory, LSP, and skill activation.

Please check:
- Whether `code-intelligence` is the right new cell boundary.
- Whether `packages/convention-graph` stays domain-agnostic at the engine level.
- Whether new domain knowledge is properly isolated in plugin extractors.

## Open Questions

### 技术 OQ（给 reviewer）

1. **Engine/schema boundary**: Is `nodes/edges/files/gaps/meta` enough for this spike, or did I smuggle domain semantics into the engine?
2. **Extractor correctness**: `mcp-tool` uses TS AST but intentionally only follows deterministic anchors. Are there false-positive risks in exact string consumers or spread registrations?
3. **FastAPI route parser**: It is regex-based for the spike. Is the scope honest enough for Phase B skeleton, or should reviewer require a Python AST parser before review approval?
4. **Fallback self-check**: `check-fallback-layers` flags parser/DB boundary guards. I believe these are grammar/nullability guards, not layered fallback. Please challenge that.
5. **Skill quality**: Does `convention-graph-discovery` meet T0 routing/value standards, or is it still too F242-specific?

### 价值 OQ（给 CVO，如有）

无。This is the CVO-approved spike slice; remaining questions are implementation/review scope.

## Next Action

Please do cross-family code review, with focus on:

1. TDD coverage and negative fixtures.
2. Provenance/freshness semantics.
3. Domain plugin boundary and future Phase B extensibility.
4. Whether Phase A/B evidence genuinely satisfies the original "约定层关联图" goal.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f242/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: reviewer 自动分配（默认 3201/3202）

## 自检证据

### Spec 合规

- AC-A0: schema + edge provenance implemented in `packages/convention-graph/src/schema.sql`, `engine.ts`, and fixtures.
- AC-A1: two cat-cafe extractors implemented (`mcp-tool`, `skill-manifest`); dogfood found `cat_cafe_post_message` structural consumers that grep misses.
- AC-A2: negative fixtures cover same-name/non-tool/non-skill false positives.
- AC-A3: `codeConsumers()` returns freshness; tests mark stale after indexed file content changes.
- AC-A4: `convention-graph-discovery` skill added and `pnpm check:skills` passes.
- AC-A5: cat-cafe dogfood recorded in F242 spec, including the `as const` extractor bug fixed in commit `54cfc4582`.
- AC-B1/B2: deer-flow FastAPI route skeleton extracted 82 routes from real unfamiliar repo files and emits gaps instead of silent zero.

### Local Review Follow-up

Opus-47 local review approved the spike and raised four non-blocking P2 observations. Three were fixed before merge-gate:

- Edge dedup: repeated `insertEdge()` for the same source/target/kind/extractor now deduplicates via a unique index + `INSERT OR IGNORE`.
- MCP consumer invalidation: `packages/**/*.ts` consumer files now fall inside `mcp-tool` invalidation scope; consumer nodes carry `metadata.consumerKind`.
- FastAPI multiline APIRouter gap: unsupported multiline `APIRouter(` declarations now emit an explicit gap instead of silent zero.

The remaining consumer precision item is represented by `consumerKind` metadata for the spike; deeper production/test/doc ranking is productionization scope.

### Dogfood-Your-Slice

Scope verdict: required, completed.

- Cat-cafe dogfood: `codeConsumers({ domainId: "mcp-tool", kind: "mcp_tool", name: "cat_cafe_post_message" })` found `WorklistRegistry.ts`, `route-serial.ts`, and `COLLAB_TOOL_SOURCES` registration with freshness `stale=false`.
- Deer-flow dogfood: `fastapi-route` extractor over `backend/app/gateway/routers/*.py` found 15 routers, 82 routes, 0 gaps, freshness `stale=false`.
- Dogfood bug found/fixed: `callbackTools` was wrapped in `as const`; extractor initially saw zero targets. Added fixture and unwrap support in `54cfc4582`.

### Verification

Fresh commands run from `/Users/lysander/projects/relay-station/cat-cafe-f242`:

```text
pnpm --filter @cat-cafe/convention-graph test
  tests 16, pass 16, fail 0

pnpm --filter @cat-cafe/convention-graph lint
  tsc --noEmit, exit 0

pnpm check
  All 27 checks passed

pnpm -r --if-present run build
  exit 0; web build emits existing lint/design-token warnings only

pnpm check:skills
  exit 0; 47 skills mounted; convention-graph-discovery mounted everywhere
  existing warnings remain: 3 BOOTSTRAP warnings and 5 advisory MCP capability warnings

pnpm check:architecture-ownership
  exit 0 warning-only; F242/code-intelligence recognized
  remaining warnings are pre-existing stale anchors / old specs

node scripts/check-fallback-layers.mjs
  exit 0; self-check triggered for parser/DB-boundary guards

git diff --check origin/main...HEAD
  exit 0
```

### Design / Artifact Hygiene

- `find designs -name '*.pen' | rg -i 'F242|code-graph|convention|graph'`: no matches.
- Root media/design artifact checks for worktree and committed diff: no matches.

### Related Docs

- Feature: `docs/features/F242-code-graph-layer-spike.md`
- Design Gate: `docs/discussions/2026-06-17-f242-design/README.md`
- Source teardown/report: `docs/discussions/2026-06-17-codegraph-vs-gitnexus/README.md`
- Ownership cell: `docs/architecture/ownership/cells/code-intelligence.md`
