---
feature_ids: [F209]
related_features: [F102, F188, F200]
topics: [memory, evidence-recall, perspective, live-query-plan, product-spike]
doc_kind: plan
created: 2026-05-24
status: accepted
---

# F209 Phase D Perspective Product Spike

**Feature:** F209 - `docs/features/F209-evidence-recall-optimization.md`
**Phase:** D - Perspective Live Query Plans
**Goal:** turn Perspective from a pretty metaphor into a concrete, reusable live retrieval route that cats can run, inspect, and show to CVO.
**Acceptance Criteria:** AC-D0 through AC-D7 from F209 Phase D.
**Architecture cell:** memory
**Map delta:** not yet. Product spike only; implementation must update ownership maps if new runtime files or UI surfaces are added.
**Frontend verification:** likely yes for AC-D6 if existing Memory / Recall visibility cannot already show all required run fields.

---

## Finish Line

Phase D v1 is done when a cat can save and rerun a named Perspective that:

1. stores a query plan / route recipe, not search results;
2. reruns live against current evidence every time it is opened;
3. returns anchored candidate clues plus drill-down hints, not a conclusion;
4. exposes the run process to CVO with plan id, steps, hit counts, typed reader route hints, and degraded / effectiveMode.

The human translation: Perspective is a repeatable "how to look" recipe. It is not a folder full of old answers.

## Product Boundary

### In Scope

- Cat-authored Perspective plan files.
- Manual save / open / rerun flow for cats.
- A small runtime runner that interprets plan steps into existing recall tools.
- Run output with anchors, drill-down hints, and structured observability.
- CVO-visible run trace through the existing Memory / Recall visibility layer or a minimal equivalent.

### Out of Scope

- User-operated Smart Folder UI.
- Saved result sets.
- Summary memory.
- New ranking authority or new truth source.
- F193 duplicate legacy MCP cleanup.
- F200 recall@k wrapper.
- Phase C file-slice hardening.

Those cross-line items have their own tasks and spec anchors; they must not pull Phase D back into MCP topology or eval infrastructure work.

## User Stories

### Story 1 - Repeated Feature Recall

A cat is working on a long-running feature and repeatedly needs the same evidence map: CVO direction, prior decisions, open questions, and merged PRs.

The cat creates a Perspective named `f209-phase-d-orientation`. Opening it reruns the same retrieval route: search the feature spec, search relevant thread evidence, open the strongest anchors, and return candidate clues. If new discussion happened since the last run, the Perspective sees it because it reruns live.

Success signal: the cat stops hand-copying search commands into every invocation, but still reads original evidence before answering.

### Story 2 - Handoff / Onboarding

A fresh cat joins a feature thread with little context. Instead of asking another cat to summarize the whole saga, it opens the feature's Perspective.

The Perspective returns a compact route trace: which searches ran, which typed reader routes were identified, which docs or messages looked relevant, and which surfaces degraded. The new cat can then inspect the same anchors directly and form its own judgment.

Success signal: handoff becomes auditable evidence navigation, not a stale prose summary.

### Story 3 - CVO-Visible Verification

CVO asks: "show me how you know." The cat runs the relevant Perspective.

CVO sees the run process in the same spirit as `search_evidence` visibility: plan id, step labels, queries, hit counts, typed reader route hints, and degraded / effectiveMode. CVO is not operating a search UI; CVO is watching the cat's evidence trail.

Success signal: CVO can challenge the route, not just the final answer.

## Runtime Contract

### Perspective Plan

Stored as git-backed markdown with YAML frontmatter, proposed path:

```text
docs/perspectives/<feature-id>/<slug>.md
```

The body explains intent and maintenance notes. The frontmatter is the machine-readable route recipe.

```ts
type PerspectivePlan = {
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
};

type PerspectiveInputSpec = {
  description: string;
  required?: boolean;
  default?: string | number | boolean;
};
```

### Step Types

Use existing recall surfaces first. Phase D should not invent a second memory backend.

```ts
type PerspectiveStep =
  | {
      id: string;
      type: "search_evidence";
      query: string;
      scope: "threads" | "docs" | "all";
      mode: "lexical" | "semantic" | "hybrid";
      depth: "summary" | "raw";
      limit?: number;
      dimension?: "project" | "collection" | "global" | "all";
    }
  | {
      id: string;
      type: "graph_resolve";
      anchor: string;
    }
  | {
      id: string;
      type: "open_anchor";
      source: "previous_step";
      selector: "top";
      maxOpen: number;
    };
```

`open_anchor` is a typed reader dispatch, not a universal free-form file opener. It should route only to existing bounded readers such as message context, session events, invocation detail, or file slice.

For v1, `selector: "top"` is the only supported selector. `maxOpen` is required and must be in the range `1..10`; templates should default to `3`. This keeps rank-based drill-down useful without letting a plan open an unbounded pile of anchors. Selector modes such as `by_anchor` or `by_score` need their own v2 runtime semantics before the schema accepts them.

### Perspective Run

A run is generated every time the plan is opened. It is runtime state / telemetry, not a truth source.

```ts
type PerspectiveRun = {
  runId: string;
  planId: string;
  startedAt: string;
  actorCatId: string;
  effectiveInputs: Record<string, unknown>;
  steps: PerspectiveRunStep[];
  candidateAnchors: PerspectiveAnchorCandidate[];
  warnings: PerspectiveWarning[];
};

type PerspectiveRunStep = {
  stepId: string;
  tool: "search_evidence" | "graph_resolve" | "typed_reader";
  queryOrAnchor: string;
  hitCount?: number;
  openedAnchors?: string[];
  degraded?: boolean;
  effectiveMode?: string;
  elapsedMs?: number;
};
```

The run may be persisted only as normal runtime telemetry / task trace if existing systems already do that. It must not become a cached answer set.

## CVO Visibility Contract

AC-D6 is not optional. A Perspective that only cats can see is not Phase D done.

Minimum visible fields:

- `planId`
- `runId`
- step id and step type
- query or anchor used by each step
- hit count per search step
- typed reader route hints / opened anchors per reader step
- degraded / effectiveMode per search step
- final candidate anchor list

Preferred v1 route: reuse the Memory / Recall realtime panel or its existing event stream. If that surface cannot display the required fields, add a minimal run trace surface rather than building a full Smart Folder UI.

## Output Rules

Perspective output must be deliberately boring:

- Candidate clue: "this anchor may answer the question."
- Drill-down hint: "open this reader next."
- Warning: "this step degraded to lexical."
- No conclusion: the cat still has to read and decide.
- No stored result set: opening the same Perspective tomorrow reruns it.

This keeps Perspective aligned with F209's evidence-first contract.

## Implementation Slices

### Slice 1 - Schema and Fixtures

Create a parser / validator for git-backed Perspective plans.

Tests:

- rejects plans with `storesResults: true`;
- rejects steps without anchors or bounded tool types;
- rejects duplicate step ids within one plan;
- rejects `open_anchor` steps whose `maxOpen` is missing or outside `1..10`;
- accepts a minimal F209 orientation Perspective fixture;
- validates frontmatter without reading arbitrary host paths.

### Slice 2 - Runner

Interpret plan steps into existing recall services.

Tests:

- opening a Perspective reruns search steps every time;
- semantic / hybrid degradation is recorded in run metadata;
- `open_anchor` uses typed readers and refuses unsupported anchor types;
- result list contains anchors and drill-down hints, not prose conclusions.

### Slice 3 - Visibility

Expose run trace to the existing Memory / Recall visibility layer or a minimal equivalent.

Tests:

- first commits a visibility coverage audit comparing the existing Memory / Recall visible fields against the eight AC-D6 required fields;
- run trace includes `planId`, step ids, hit counts, typed reader route hints, degraded / effectiveMode;
- CVO-visible event does not expose raw host paths or secrets;
- no user-operated Smart Folder controls are introduced in Phase D v1.

### Slice 4 - Dogfood Perspective

Add one real Perspective plan for F209 orientation and use it to answer a real handoff question.

Tests / evidence:

- run it in a fresh invocation;
- prove it opened current anchors, not a cached result set;
- record the dogfood trace in F209 docs.

## Acceptance Mapping

| AC | Product spike answer |
|----|----------------------|
| AC-D0 | This doc defines 3 user stories and the runtime contract. |
| AC-D1 | `PerspectivePlan.outputPolicy.storesResults` must be `false`; tests reject result-set plans. |
| AC-D2 | Runner opens plans by executing steps live and returning anchors + drill-down hints. |
| AC-D3 | v1 entry is cat-authored git-backed plan files; cats can name and reuse them. |
| AC-D4 | Skills / tasks may suggest a Perspective id, but the runner returns only the route and candidate anchors. |
| AC-D5 | F200 may consume plan / run signals as navigation utility; it does not gain truth authority. |
| AC-D6 | Visibility contract requires plan id, step, hit count, typed reader route hints, degraded / effectiveMode. |
| AC-D7 | User Smart Folder UI is explicitly out of scope for v1. |

## Design Gate Decisions

| Decision | Answer |
|----------|--------|
| Storage form | Git-backed markdown with YAML frontmatter. |
| First entry point | Cat-authored plan file + cat-run command/tool path. |
| First visible surface | Slice 3 starts with a coverage audit. If existing Memory / Recall visibility covers at least 80% of AC-D6 fields, reuse it and add missing fields; at 50-80%, reuse for read plus a minimal run trace JSON surface; below 50%, build a minimal trace surface. |
| Truth boundary | Perspective is navigation only; original anchors remain truth. |
| Result caching | Forbidden for v1. |
| User UI | Deferred; future Smart Folder UI requires a separate product/design gate. |

## Design Gate Review Outcomes

1. Storage path stays top-level: `docs/perspectives/<feature-id>/<slug>.md`.
2. `open_anchor` may use rank-based selectors, but `maxOpen` is required and bounded to `1..10`.
3. AC-D6 visibility is decided by Slice 3 coverage audit, not assumed upfront.

These outcomes close the Design Gate review questions from Opus-47 on 2026-05-24.
