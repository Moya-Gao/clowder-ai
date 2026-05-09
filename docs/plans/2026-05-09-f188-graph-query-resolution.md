---
feature_ids: [F188]
topics: [memory, knowledge-graph, graph-query-resolution, ux]
doc_kind: plan
created: 2026-05-09
---

# F188 Graph Query Resolution Implementation Plan

**Feature:** F188 — `docs/features/F188-library-stewardship.md`  
**Goal:** Turn the Memory Graph entry point from a blind anchor lookup into a query resolution flow: exact anchors open a graph, natural queries show explainable candidate anchors, and no-match/privacy states are explicit.  
**Acceptance Criteria:** AC-C7a, AC-C7b, AC-C7c, AC-C7d, AC-C7e, AC-C7f, AC-C7g  
**Architecture cell:** `memory`  
**Map delta:** none  
**Map delta why:** This extends existing library graph/search APIs and Memory Hub UI inside the memory cell; no new ownership boundary.  
**Architecture:** Add a small backend resolver around existing `IEvidenceStore.getByAnchor()`, `IEvidenceStore.search()`, and `GraphResolver.buildSubgraph()`. Keep `/api/library/graph` as the exact-anchor graph endpoint, and add a query-resolution endpoint used by the UI submit path. Frontend renders three states: graph, candidates, and no-match/single-node explanation.  
**Tech Stack:** Fastify route, `GraphResolver`, `IEvidenceStore`, React/Vitest, existing Memory Hub components.  
**前端验证:** Yes — browser screenshots for `F186`, `f186`, `harness`, and an evidence-free natural-language query.

---

## Finish Line

Users can type either an anchor or a natural query into the Graph input. Exact anchors open a graph directly; non-anchor terms like `harness` show a concise candidate list with `anchor + title + kind + collection/source + match reason/snippet`; evidence-free queries show a no-match state; private/restricted data is not leaked through candidates.

**Not building now:**
- Debounced autocomplete while typing.
- LLM-generated answers to natural-language questions.
- New graph layout algorithms beyond the existing readable graph work.
- Cross-domain expansion beyond the existing catalog/stores passed to `libraryRoutes`.

## Terminal Schema

```ts
export type GraphQueryResolution =
  | {
      status: 'graph';
      queryKind: 'exact';
      query: string;
      resolvedAnchor: string;
      graph: GraphResult;
      note?: 'no_edges';
    }
  | {
      status: 'candidates';
      queryKind: 'search';
      query: string;
      candidates: GraphQueryCandidate[];
    }
  | {
      status: 'no_match';
      queryKind: 'search';
      query: string;
      message: string;
      examples: string[];
    };

export interface GraphQueryCandidate {
  anchor: string;
  title: string;
  kind: string;
  collectionId: string;
  source?: string;
  matchReason: 'anchor' | 'title' | 'source' | 'summary' | 'keyword' | 'content';
  snippet?: string;
  edgeCount?: number;
}
```

Privacy policy for this schema: candidate search omits private/restricted collections unless the caller explicitly includes that collection in `collections=`. Exact-anchor graph rendering still goes through `GraphResolver`, so redaction behavior stays centralized.

## Implementation Tasks

### Task 1: Backend resolver pure behavior

**Files:**
- Create: `packages/api/src/domains/memory/GraphQueryResolver.ts`
- Test: `packages/api/test/memory/graph-query-resolver.test.js`

**Step 1: Write failing tests**

Cover:
- `F186` exact anchor returns `status: 'graph'` and resolved canonical anchor.
- `f186` exact anchor is case-insensitive.
- `harness` query returns `status: 'candidates'`, capped at 8 candidates, with match reason/snippet.
- Query with no exact/search hits returns `status: 'no_match'` and example anchors.
- Existing node with no edges returns `status: 'graph'` with `note: 'no_edges'`.
- Private collection candidates are omitted unless `callerCollections` contains that collection.

Run:

```bash
cd packages/api
node --test test/memory/graph-query-resolver.test.js
```

Expected RED: module or exported function missing.

**Step 2: Implement `GraphQueryResolver`**

Use existing store contracts:
- exact path: loop stores, `getByAnchor(query)`; if exactly one visible match, call `GraphResolver.buildSubgraph()`.
- search path: loop visible stores, `search(query, { mode: 'hybrid', limit: 8, scope: 'all' })`; normalize and de-dupe candidates by `collectionId + anchor`.
- candidate cap: max 8 total.
- match reason: deterministic field inspection in order `anchor → title → source → summary → keyword → content`.
- edge count: optional best effort via `getRelated(anchor)` when available.

**Step 3: Verify GREEN**

Run:

```bash
cd packages/api
node --test test/memory/graph-query-resolver.test.js
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/api/src/domains/memory/GraphQueryResolver.ts packages/api/test/memory/graph-query-resolver.test.js
git commit -m "feat(F188): add graph query resolver [砚砚/gpt-5.5🐾]"
```

### Task 2: Library route integration

**Files:**
- Modify: `packages/api/src/routes/library.ts`
- Test: `packages/api/test/library-graph-query-route.test.js` or extend existing library route tests if one exists.

**Step 1: Write failing route tests**

Cover:
- `GET /api/library/graph/resolve?query=F186` returns `status: 'graph'`.
- `GET /api/library/graph/resolve?query=harness` returns `status: 'candidates'`.
- Missing `query` returns 400.
- Remote IP returns 403, same localhost guard as `/api/library/graph`.
- `depth` validation remains `0-3`.

Run:

```bash
cd packages/api
node --test test/library-graph-query-route.test.js
```

Expected RED: route missing.

**Step 2: Add route**

Add:

```ts
GET /api/library/graph/resolve?query=...&depth=1&collections=...
```

Implementation notes:
- Reuse existing graph-store map construction.
- Instantiate `GraphQueryResolver`.
- Keep `/api/library/graph` unchanged for direct graph fetches and candidate clicks.

**Step 3: Verify GREEN**

Run:

```bash
cd packages/api
node --test test/library-graph-query-route.test.js test/memory/graph-query-resolver.test.js
```

Expected: all targeted backend tests pass.

**Step 4: Commit**

```bash
git add packages/api/src/routes/library.ts packages/api/test/library-graph-query-route.test.js
git commit -m "feat(F188): expose graph query resolution route [砚砚/gpt-5.5🐾]"
```

### Task 3: Frontend query states

**Files:**
- Modify: `packages/web/src/components/memory/CollectionGraph.tsx`
- Modify if useful: `packages/web/src/components/memory/CollectionGraphParts.tsx`
- Test: `packages/web/src/components/memory/__tests__/CollectionGraph.test.tsx`

**Step 1: Write failing UI tests**

Cover:
- Submitting `F186` calls `/api/library/graph/resolve?query=F186...` and renders graph directly.
- Submitting `harness` renders candidate list with `anchor`, title, kind, source, and match reason.
- Candidate click fetches/draws that candidate graph.
- No-match response renders helpful no-match copy and anchor examples.
- Single-node no-edge graph renders graph plus "暂无关联边" style explanation.

Run:

```bash
cd packages/web
NODE_ENV=test pnpm exec vitest run src/components/memory/__tests__/CollectionGraph.test.tsx
```

Expected RED: candidate/no-match UI missing and fetch URL still uses `/api/library/graph`.

**Step 2: Implement UI**

State additions:
- `resolutionStatus`
- `candidates`
- `noMatch`
- optional `graphNote`

UI behavior:
- Input placeholder becomes `Search knowledge or enter anchor (e.g. F186, harness)`.
- Submit uses `/api/library/graph/resolve`.
- `status: 'graph'`: render graph.
- `status: 'candidates'`: render candidate list beside/above graph stage; do not auto-select.
- `status: 'no_match'`: render friendly empty state with examples.
- Candidate click calls existing direct graph fetch by anchor.

**Step 3: Verify GREEN**

Run:

```bash
cd packages/web
NODE_ENV=test pnpm exec vitest run src/components/memory/__tests__/CollectionGraph.test.tsx
pnpm exec tsc --noEmit
```

Expected: targeted UI tests and typecheck pass.

**Step 4: Commit**

```bash
git add packages/web/src/components/memory/CollectionGraph.tsx packages/web/src/components/memory/CollectionGraphParts.tsx packages/web/src/components/memory/__tests__/CollectionGraph.test.tsx
git commit -m "feat(F188): resolve graph queries before rendering [砚砚/gpt-5.5🐾]"
```

### Task 4: Browser verification and polish

**Files:**
- No planned code files unless screenshots reveal a layout/readability defect.
- Evidence path if screenshots are saved: `docs/evidence/F188/graph-query-resolution/`

**Step 1: Run local worktree app**

Use worktree ports, not runtime:

```bash
pnpm dev:direct
```

**Step 2: Browser scenarios**

Verify:
- `F186`: direct graph.
- `f186`: direct graph with canonical `F186`.
- `harness`: candidate list.
- evidence-free natural query: no-match state.

**Step 3: Fix defects with tests first**

If browser reveals layout or state bugs, add/adjust tests before implementation.

**Step 4: Commit any polish**

Only commit code if the browser pass requires a fix.

### Task 5: Quality gate and review request

**Files:**
- Create: `docs/mailbox/YYYY-MM-DD-f188-ac-c7-review-request.md`

**Step 1: Run targeted verification**

```bash
cd packages/api
node --test test/memory/graph-query-resolver.test.js test/library-graph-query-route.test.js

cd ../web
NODE_ENV=test pnpm exec vitest run src/components/memory/__tests__/CollectionGraph.test.tsx
pnpm exec tsc --noEmit
```

**Step 2: Run broader checks**

```bash
pnpm lint
pnpm check
pnpm -r --if-present run build
```

Run full `pnpm test` if time allows; if baseline flakes occur, single-run repro and document.

**Step 3: Request review from Opus 4.6**

Use `request-review` and explicitly ask `@opus` (46) to review:
- backend resolver privacy and exact/candidate semantics
- route guard/contract
- candidate UI/no-match UX
- browser screenshots for AC-C7g

## Open Questions

**技术 OQ（实现中自行解决）**
1. Candidate `snippet` should come from summary/title/source if store search does not expose BM25 snippets.
2. Whether exact matches across multiple collections should return candidates instead of auto graph. Default: if more than one collection has the same anchor, show candidates unless one is visible and all others are redacted.
3. Whether candidate edge count is worth the extra `getRelated()` calls. Default: best effort, no blocking if a store lacks `getRelated`.

**价值 OQ（当前不升级 CVO）**
- None. CVO already decided not to hotfix and requested a complete spec-first implementation path.

## Verification Matrix

| AC | Test / Evidence |
|----|-----------------|
| AC-C7a | backend exact tests + frontend `F186` / `f186` tests |
| AC-C7b | backend `harness` candidates test + frontend candidate list test |
| AC-C7c | frontend candidate row assertions |
| AC-C7d | frontend verifies no auto graph on multiple candidates |
| AC-C7e | no-match and single-node no-edge tests |
| AC-C7f | backend private candidate filtering test |
| AC-C7g | browser screenshots for four inputs |
