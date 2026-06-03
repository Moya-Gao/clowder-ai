---
feature_ids: [F193]
doc_kind: plan
created: 2026-06-03
author: codex
status: plan
---

# F193 Phase E — E2/E4 Affordance + Friction Infra Plan

> Author: 砚砚/Codex GPT-5.5
> Scope: F193 Phase E, E2 + E4
> Coordination: E1 dispatch gate plan v2 defines the shared action shape; this plan reuses that contract and does not touch Opus-46's E1 worktree.

## Header

| Field | Value |
|---|---|
| Feature | F193 — Cross-thread communication unification, Phase E |
| Goal | When a tool discovers work that belongs to another thread/feature, return a structured, executable cross-post suggestion instead of making the cat remember the ritual. |
| Acceptance Criteria | E2: `search_evidence` / `list_recent` / `feat_index` attach cross-post affordances for non-current thread results. E4: `feat_index` returns owner catId when resolvable; commit/stash provenance gets a standard threadId format; cross-post keeps `targetCats` + line-start `@` contract from Phase A. |
| Architecture cell | Primary: `memory`; Secondary: `transport`, `thread-navigation` |
| Map delta | Update required. `memory` owns evidence/list-recent result envelopes; `transport` owns the cross-post action contract; `thread-navigation` is touched only as the consumer-facing thread discovery surface. |
| Frontend validation | None in this phase unless Hub renders `suggestedAction`; tool/API tests are the primary gate. |

## Truth Sources Checked

- `docs/features/F193-cross-thread-comm-unification.md` Phase E E2/E4.
- `docs/discussions/2026-06-03-e1-dispatch-gate-plan.md` v2 shared `SuggestedCrossPostAction`.
- `packages/mcp-server/src/tools/evidence-tools.ts`
- `packages/mcp-server/src/tools/recent-tools.ts`
- `packages/mcp-server/src/tools/callback-tools.ts`
- `packages/api/src/routes/evidence.ts`
- `packages/api/src/routes/library.ts`
- `packages/api/src/routes/callbacks.ts`
- `packages/api/src/routes/feat-index-doc-import.ts`
- `packages/shared/src/types/task.ts`
- `docs/architecture/ownership/cells/memory.md`
- `docs/architecture/ownership/cells/transport.md`
- `docs/architecture/ownership/cells/thread-navigation.md`

## Shared Contract

Do not invent parallel shapes. Add one shared type and have E1/E2/E4 import it.

```ts
// packages/shared/src/types/cross-thread-affordance.ts
export type SuggestedCrossPostActionSource =
  | 'dispatch_gate'
  | 'search_evidence'
  | 'list_recent'
  | 'feat_index';

export interface SuggestedCrossPostAction {
  readonly type: 'cross_post';
  readonly threadId?: string;
  readonly featureId?: string;
  readonly ownerCatId?: string;
  readonly targetCats?: readonly string[];
  readonly reason?: string;
  readonly source: SuggestedCrossPostActionSource;
}
```

Wire format may expose `suggestedAction` internally and `suggested_action` only at external JSON boundaries if a route already uses snake_case. Do not maintain `featId` and `featureId` as two internal fields; use `featureId` in the shared action.

## Architecture

### Current Thread Source

`search_evidence` is a public GET path and does not require callback auth, but Codex/Claude invocation environments already include `CAT_CAFE_THREAD_ID`. E2 should use that runtime context:

1. MCP wrapper reads `process.env.CAT_CAFE_THREAD_ID`.
2. If present, it sends `currentThreadId=<threadId>` to the API.
3. API uses `currentThreadId` only to decide whether a result points outside the current thread.
4. If missing, API returns normal results without inventing suggestions.

This keeps the tool agent-first without adding a required `currentThreadId` input for cats.

### Candidate Target Derivation

Use structured data only:

| Surface | Target thread derivation |
|---|---|
| `search_evidence` | `result.passages[].threadId`, `drillDown.params.threadId`, or `anchor` of form `thread-<threadId>` |
| `list_recent` | `item.kind === 'thread'` and `anchor` of form `thread-<threadId>` |
| `feat_index` | existing `threadIds` from `buildThreadIdsByFeatId(...)`; first thread is the suggested target until ranking exists |

Never parse `snippet` / rendered tool text for routing.

### Owner Cat Resolution

`feat_index` currently reads `FeatIndexEntry` as `{ featId, name, status, keyDecisions? }` and adds `threadIds` at the callback route. E4 extends the source entry:

```ts
interface FeatIndexEntry {
  featId: string;
  name: string;
  status: string;
  owner?: string;
  ownerCatId?: string;
  keyDecisions?: string[];
}
```

Resolution order:

1. Feature doc body line `> **Owner**: ...`
2. `docs/BACKLOG.md` owner column via `parseActiveFeaturesFromBacklog`
3. Cat roster aliases / `resolveCatTarget` for single-owner values

If the owner string is multi-owner or ambiguous (`三猫`, `布偶猫 + 缅因猫`, community names), keep `owner` but omit `ownerCatId` / `targetCats`. A false positive route is worse than no target.

## Implementation Tasks

### Task 1 — Shared Type

Files:

- `packages/shared/src/types/cross-thread-affordance.ts`
- `packages/shared/src/types/index.ts`
- E1's `TaskItem.dispatchGate.suggestedAction` should import this type once E1 lands.

Tests:

- Typecheck through affected packages.
- No runtime test needed for a type-only addition.

### Task 2 — E4 `feat_index` Owner + Suggested Action

Files:

- `packages/api/src/routes/feat-index-doc-import.ts`
- `packages/api/src/routes/callbacks.ts`
- `packages/mcp-server/src/tools/callback-tools.ts`

Behavior:

- `readFeatIndexEntries()` preserves `owner` and resolves `ownerCatId` when safe.
- `/api/callbacks/feat-index` returns `owner`, `ownerCatId`, `threadIds`, and a `suggestedAction` when it has either a target thread or owner.
- `cat_cafe_feat_index` text output prints one stable machine-readable line:

```text
  suggested_action: cross_post threadId=<threadId> featureId=<F193> targetCats=["opus"] source=feat_index
```

Guardrails:

- If `ownerCatId` is omitted, do not fabricate `targetCats`.
- If `threadIds` is empty, still return `featureId` + `ownerCatId` if known; the user can run `list_threads` next.

Tests:

- `feat-index-doc-import` parses owner from feature doc and BACKLOG fallback.
- Callback route fixture returns `ownerCatId` and `suggestedAction`.
- MCP handler formatting includes the action line.
- Multi-owner string leaves `ownerCatId` undefined.

### Task 3 — E2 `search_evidence` Suggested Actions

Files:

- `packages/api/src/routes/evidence-helpers.ts`
- `packages/api/src/routes/evidence.ts`
- `packages/mcp-server/src/tools/evidence-tools.ts`

Behavior:

- Add `suggestedAction?: SuggestedCrossPostAction` to `EvidenceResult`.
- Add `currentThreadId?: string` query parameter to `/api/evidence/search`; MCP fills it from `CAT_CAFE_THREAD_ID` when available.
- If a result points at `targetThreadId !== currentThreadId`, attach:

```ts
{
  type: 'cross_post',
  threadId: targetThreadId,
  reason: 'This result is from another thread; cross-post if it affects that thread.',
  source: 'search_evidence',
}
```

- MCP output renders the same `suggested_action` machine line under that result.

Tests:

- API route: thread result from another thread gets `suggestedAction`.
- API route: same-thread result gets no action.
- API route: missing `currentThreadId` gets no action.
- MCP formatting: action line appears under only the relevant result.

### Task 4 — E2 `list_recent` Suggested Actions

Files:

- `packages/api/src/domains/memory/RecentBrowseResolver.ts`
- `packages/api/src/routes/library.ts`
- `packages/mcp-server/src/tools/recent-tools.ts`

Behavior:

- Add `suggestedAction?: SuggestedCrossPostAction` to `RecentItem`.
- Add `currentThreadId?: string` query parameter to `/api/library/recent`; MCP fills it from `CAT_CAFE_THREAD_ID` when available.
- Only attach actions for thread-scoped recent items in v1 (`kind === 'thread'` and anchor is `thread-<id>`). Do not route doc/feature items from list_recent; use `feat_index` for feature ownership.
- MCP output renders the stable `suggested_action` line below that recent item.

Tests:

- Recent thread item from another thread gets action.
- Same-thread and non-thread recent items do not.
- Invalid `since` / scope validation remains unchanged.

### Task 5 — E4 Commit/Stash ThreadId Provenance

Files to inspect before implementation:

- `.githooks/commit-msg`
- `.githooks/pre-commit`
- `cat-cafe-skills/refs/commit-signatures.md`
- `cat-cafe-skills/worktree/SKILL.md`
- `cat-cafe-skills/merge-gate/SKILL.md`

Decision:

- Do not auto-mutate commit messages in a hook.
- Do not reject commits without threadId in v1.
- Add a standard provenance footer and a small formatter/helper so cats can use a consistent string.

Standard footer:

```text
Thread-Context: threadId=<threadId> invocationId=<invocationId> catId=<catId>
```

Implementation target:

- Add a reusable formatter helper under `scripts/lib/` or `packages/shared/src/utils/` only if an existing code path will call it.
- Update commit/stash-facing docs/skills to say: when `CAT_CAFE_THREAD_ID` exists and the commit/stash is tied to an active cross-thread investigation, include the footer.
- Add a lightweight test for the formatter if code is introduced.

Rationale: hooks can warn later, but mutation/rejection would create more friction than Phase E is meant to remove.

### Task 6 — Integration + Quality Gate

Minimum targeted tests:

```bash
cd packages/api && env -u CAT_CAFE_RUNTIME_ROOT node --test \
  test/system-prompt-builder.test.js \
  test/feat-index-doc-import.test.js \
  test/evidence-route.test.js \
  test/recent-browse-resolver.test.js \
  test/memory/library-recent-route.test.js

cd packages/mcp-server && pnpm test
```

If exact test file names differ, use the nearest existing route/tool tests and record the actual command in the review request.

## Review Notes for Opus-46

- E2/E4 will use the exact `SuggestedCrossPostAction` source union from E1 v2.
- If E1 lands the shared type first, E2/E4 imports it. If E2/E4 lands it first, E1 should remove its local copy and import from `@cat-cafe/shared`.
- `status: 'missing'` in E1 remains task-specific. E2/E4 suggestions are read-side affordances and must not write task state.
- E2 suggestions are advisory; they never reject tool output.

## Risks

| Risk | Mitigation |
|---|---|
| False-positive owner route from ambiguous owner text | Resolve only single known cat aliases; omit `targetCats` otherwise. |
| `search_evidence` has no current thread in some MCP contexts | Use `CAT_CAFE_THREAD_ID`; no env means no suggested action. |
| API and MCP renderers drift | Put action construction in API/helper and test MCP text as a view over the structured field. |
| E1/E2 merge conflict on shared type | Land or rebase around one canonical `packages/shared/src/types/cross-thread-affordance.ts`; no duplicate local type. |

## Done When

- `SuggestedCrossPostAction` has one shared type definition.
- `feat_index` returns owner + ownerCatId where safely resolvable and emits a cross-post action.
- `search_evidence` and `list_recent` attach actions for non-current thread results using structured thread IDs.
- MCP text output exposes stable `suggested_action` lines without making text the source of truth.
- Commit/stash thread provenance format is documented or implemented with a helper, without hook mutation.
- Targeted API + MCP tests pass.

[砚砚/GPT-5.5🐾]
