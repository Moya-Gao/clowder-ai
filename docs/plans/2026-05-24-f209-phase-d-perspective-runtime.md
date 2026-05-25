---
feature_ids: [F209]
related_features: [F102, F188, F200]
topics: [memory, evidence-recall, perspective, runtime, implementation-plan]
doc_kind: plan
created: 2026-05-24
status: ready-for-worktree
---

# F209 Phase D Perspective Runtime Implementation Plan

**Feature:** F209 - `docs/features/F209-evidence-recall-optimization.md`
**Goal:** implement Perspective v1 as a git-backed live query plan runner that returns anchors and drill-down hints, not conclusions.
**Acceptance Criteria:** AC-D1 through AC-D7 from F209 Phase D. AC-D0 is already closed by `docs/plans/2026-05-24-f209-phase-d-perspective-product-spike.md`.
**Architecture cell:** memory
**Map delta:** update required
**Map delta why:** Phase D adds first-class Perspective plan files and a runner inside the memory recall surface; ownership docs should name that boundary after implementation files exist.
**Architecture:** Add a Perspective domain module under `packages/api/src/domains/memory`, expose a local API route for running plans, then add a read-only MCP tool that cats can call. Visibility is handled by an explicit Slice 3 audit before deciding whether existing Recall UI is enough or a minimal trace surface is required.
**Tech Stack:** TypeScript, Zod, YAML frontmatter parser, existing `IEvidenceStore` / `IKnowledgeResolver` search path, Fastify, MCP server tool definitions, Vitest / node:test.
**前端验证:** Conditional. Slice 3 decides whether existing Recall visibility satisfies AC-D6; if not, add frontend tests and browser verification for the minimal trace surface.

---

## Finish Line

Phase D implementation is complete when:

- a Perspective plan file in `docs/perspectives/<feature-id>/<slug>.md` validates against schema version 1;
- `runPerspective(planId)` executes plan steps live against current evidence;
- output contains `planId`, `runId`, step trace, candidate anchors, opened anchors, degraded / effectiveMode, and warnings;
- no result set or conclusion is stored in the plan;
- MCP exposes a cat-facing run tool in the memory toolset;
- CVO visibility meets AC-D6 by either reusing Recall visibility or adding a minimal trace surface;
- a real F209 orientation Perspective is dogfooded and documented.

Not building: user Smart Folder UI, summary memory, F200 fixture wrapper, F193 topology cleanup, Phase C hardening.

## Terminal Schema

```ts
export type PerspectiveStep =
  | {
      id: string;
      type: 'search_evidence';
      query: string;
      scope: 'threads' | 'docs' | 'all';
      mode: 'lexical' | 'semantic' | 'hybrid';
      depth: 'summary' | 'raw';
      limit?: number;
      dimension?: 'project' | 'collection' | 'global' | 'all';
      collections?: string[];
    }
  | {
      id: string;
      type: 'graph_resolve';
      anchor: string;
    }
  | {
      id: string;
      type: 'open_anchor';
      source: 'previous_step';
      selector: 'top' | 'by_anchor' | 'by_score';
      maxOpen: number;
    };

export interface PerspectivePlan {
  schemaVersion: 1;
  id: string;
  title: string;
  featureIds: string[];
  ownerCatId: string;
  intent: string;
  inputs?: Record<string, PerspectiveInputSpec>;
  defaults?: Record<string, string | number | boolean>;
  steps: PerspectiveStep[];
  outputPolicy: {
    storesResults: false;
    returnsConclusion: false;
    requiresAnchors: true;
  };
}

export interface PerspectiveRun {
  runId: string;
  planId: string;
  startedAt: string;
  actorCatId: string;
  effectiveInputs: Record<string, unknown>;
  steps: PerspectiveRunStep[];
  candidateAnchors: PerspectiveAnchorCandidate[];
  warnings: PerspectiveWarning[];
}
```

## Task 1: Schema + Loader

**Files:**
- Create: `packages/api/src/domains/memory/perspective-types.ts`
- Create: `packages/api/src/domains/memory/PerspectivePlanLoader.ts`
- Create: `packages/api/test/memory/perspective-plan-loader.test.js`
- Create: `docs/perspectives/F209/f209-phase-d-orientation.md`

**Step 1: Write failing schema tests**

Tests:

- accepts the F209 orientation plan fixture;
- rejects `schemaVersion !== 1`;
- rejects `outputPolicy.storesResults: true`;
- rejects `outputPolicy.returnsConclusion: true`;
- rejects duplicate step ids;
- rejects `open_anchor` without `maxOpen`;
- rejects `maxOpen < 1` or `maxOpen > 10`;
- rejects paths outside `docs/perspectives/`.

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/memory/perspective-plan-loader.test.js
```

Expected red: module not found / loader not implemented.

**Step 2: Implement minimal loader**

Use `yaml` to parse frontmatter. Keep body as `description?: string` for human notes but do not interpret it as output.

Rules:

- base root defaults to repo root;
- plan path must be under `docs/perspectives/`;
- normalized plan has `maxOpen` required for every `open_anchor`;
- schema errors return human-readable messages.

**Step 3: Green and commit**

Run the same test. Commit:

```bash
git add packages/api/src/domains/memory/perspective-types.ts packages/api/src/domains/memory/PerspectivePlanLoader.ts packages/api/test/memory/perspective-plan-loader.test.js docs/perspectives/F209/f209-phase-d-orientation.md
git commit -m "feat(F209): add Perspective plan schema loader"
```

## Task 2: Runner

**Files:**
- Create: `packages/api/src/domains/memory/PerspectiveRunner.ts`
- Create: `packages/api/test/memory/perspective-runner.test.js`
- Modify: `packages/api/src/routes/evidence-helpers.ts` only if a reusable anchor/drillDown mapper is needed.

**Step 1: Write failing runner tests**

Use fake `IEvidenceStore` / `IKnowledgeResolver` style dependencies rather than hitting live SQLite.

Tests:

- reruns search steps on every call;
- records `planId`, `runId`, `actorCatId`, step ids, hit counts, candidate anchors;
- copies degraded / effectiveMode from search metadata;
- returns drill-down hints from evidence results;
- `open_anchor selector=top maxOpen=3` opens at most 3 prior anchors;
- refuses unsupported anchor types without throwing the whole run;
- output has no conclusion field and no stored result set field.

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/memory/perspective-runner.test.js
```

Expected red: runner module not found.

**Step 2: Implement minimal runner**

The runner should call existing search path abstractions, not duplicate ranking logic.

Initial dependency shape:

```ts
interface PerspectiveRunnerDeps {
  searchEvidence(query: string, options: SearchOptions): Promise<{ items: EvidenceItem[]; meta: SearchExecutionMeta }>;
  openAnchor(anchor: PerspectiveAnchorCandidate): Promise<PerspectiveOpenedAnchor>;
  now?: () => Date;
  randomId?: () => string;
}
```

For Slice 2, `openAnchor` can be an injected bounded reader shim; real typed-reader dispatch can land in Task 3.

**Step 3: Green and commit**

Run the runner test. Commit:

```bash
git add packages/api/src/domains/memory/PerspectiveRunner.ts packages/api/test/memory/perspective-runner.test.js
git commit -m "feat(F209): add live Perspective runner"
```

## Task 3: API + MCP Entry

**Files:**
- Create: `packages/api/src/routes/perspectives.ts`
- Modify: `packages/api/src/routes/index.ts`
- Modify: `packages/api/src/index.ts`
- Create: `packages/api/test/memory/perspective-routes.test.js`
- Create: `packages/mcp-server/src/tools/perspective-tools.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`
- Modify: `packages/mcp-server/src/server-toolsets.ts`
- Create: `packages/mcp-server/test/perspective-tools.test.js`

**Step 1: Write failing API route tests**

Tests:

- `GET /api/perspectives/:featureId/:slug/run?actorCatId=codex` loads and runs the plan;
- response includes `planId`, `runId`, `steps`, `candidateAnchors`, `warnings`;
- missing plan returns 404;
- invalid plan returns 400 with schema errors;
- API does not write result sets back to the plan file.

Run:

```bash
pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/memory/perspective-routes.test.js
```

Expected red: route not registered.

**Step 2: Implement API route**

Register near `evidenceRoutes` in `packages/api/src/index.ts` because this is memory recall, not collaboration.

**Step 3: Write failing MCP tests**

Tests:

- `cat_cafe_run_perspective` encodes path params and actor cat id;
- renders plan id, run id, each step, hit count, opened anchors, degraded / effectiveMode;
- returns API 404 / 400 as tool error;
- tool appears in memory server registration;
- read-only MCP mode includes `cat_cafe_run_perspective`.

Run:

```bash
pnpm --filter @cat-cafe/mcp-server run test
```

Expected red: tool missing.

**Step 4: Implement MCP tool**

Add the tool to the memory toolset and `READONLY_ALLOWED_TOOLS`. It is read-only because it reruns recall and returns trace; it must not mutate persisted results.

**Step 5: Green and commit**

Run API route test and MCP tests. Commit:

```bash
git add packages/api/src/routes/perspectives.ts packages/api/src/routes/index.ts packages/api/src/index.ts packages/api/test/memory/perspective-routes.test.js packages/mcp-server/src/tools/perspective-tools.ts packages/mcp-server/src/tools/index.ts packages/mcp-server/src/server-toolsets.ts packages/mcp-server/test/perspective-tools.test.js
git commit -m "feat(F209): expose Perspective runner through API and MCP"
```

## Task 4: Visibility Audit + Minimal Trace Decision

**Files:**
- Create: `docs/decisions/2026-05-24-f209-phase-d-visibility-audit.md`
- Modify: `packages/web/src/hooks/useRecallEvents.ts` if reuse is enough and only parsing fields are missing.
- Modify/Create: minimal web/API files only if audit shows existing Recall visibility covers less than required.
- Test: `packages/web/src/__tests__/recall-feed.test.ts` or a new perspective trace test.

**Step 1: Write the audit**

Compare required AC-D6 fields against current `useRecallEvents` / RecallFeed parsing:

- `planId`
- `runId`
- step id and step type
- query or anchor per step
- hit count
- opened anchors
- degraded / effectiveMode
- final candidate anchor list

Decision rule from product spike:

- >= 80% coverage: reuse Recall visibility and add missing fields.
- 50-80%: reuse read path plus minimal run trace JSON surface.
- < 50%: build a minimal trace surface.

**Step 2: Red test for chosen path**

If reuse:

```bash
pnpm --filter @cat-cafe/web run test -- recall-feed
```

Expected red: Perspective run detail does not parse required fields.

If minimal trace surface:

Write a focused API/web test for the trace viewer route and run the relevant package test.

**Step 3: Implement and commit**

Commit:

```bash
git add docs/decisions/2026-05-24-f209-phase-d-visibility-audit.md <changed visibility files>
git commit -m "feat(F209): surface Perspective run trace visibility"
```

## Task 5: Dogfood + Spec Close

**Files:**
- Modify: `docs/features/F209-evidence-recall-optimization.md`
- Modify: `docs/decisions/2026-05-23-f209-d0-readiness.md` only if dogfood changes D.0 historical context; otherwise do not touch it.

**Step 1: Run real Perspective**

After build:

```bash
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/mcp-server run build
```

Then run the F209 orientation Perspective through the MCP tool in a fresh invocation or equivalent local API route.

Evidence to capture:

- no stored result set in `docs/perspectives/F209/f209-phase-d-orientation.md`;
- run trace includes plan id and run id;
- each step has hit count or opened anchors;
- degraded / effectiveMode is visible;
- candidate anchors include current F209 spec / product spike / D.0 report.

**Step 2: Update ACs**

Mark AC-D1 through AC-D7 only when each has evidence.

**Step 3: Quality gate**

Run:

```bash
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/mcp-server run test
pnpm --filter @cat-cafe/web run test -- recall-feed
git diff --check
```

Broaden to `pnpm gate` before merge-gate / PR.

**Step 4: Request review**

Reviewer: Opus-47, because it approved Design Gate and is guarding Phase D semantics.
