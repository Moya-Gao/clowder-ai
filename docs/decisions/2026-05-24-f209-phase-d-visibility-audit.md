---
feature_ids: [F209]
related_features: [F102, F188, F200]
doc_kind: decision
created: 2026-05-24
status: accepted
topics: [memory, perspective, recall, visibility]
---

# F209 Phase D Visibility Audit

> **Decision**: Perspective v1 uses the new run API JSON response plus the MCP tool transcript as its minimal trace surface. We do not extend `RecallFeed` in this slice.

## Context

AC-D6 requires a Perspective run to be visible to the CVO with at least:

- `planId`
- `runId`
- step id and step type
- query or anchor per step
- hit count
- typed reader route hints / opened anchors
- degraded / `effectiveMode`
- final candidate anchor list

The Design Gate rule was:

- `>= 80%` existing coverage: reuse Recall visibility and add missing fields.
- `50-80%`: reuse read path plus a minimal run trace JSON surface.
- `< 50%`: build a minimal trace surface.

## Existing RecallFeed Coverage

Current implementation:

- parser: `packages/web/src/hooks/useRecallEvents.ts`
- UI: `packages/web/src/components/memory/RecallFeed.tsx`
- scope: extracts `search_evidence` tool use/result pairs from the active invocation stream.

| Required field | Existing RecallFeed coverage | Notes |
|---|---:|---|
| `planId` | No | Recall events have no plan concept. |
| `runId` | No | Recall events are per tool call, not grouped by run. |
| step id and step type | No | A `search_evidence` call has no Perspective step identity. |
| query or anchor per step | Partial | Query is parsed for search calls only; anchors are result metadata, not step inputs. |
| hit count | Partial | Search result count is parsed from MCP text. |
| typed reader route hints / opened anchors | No | RecallFeed shows result anchors, not typed reader route hints or reader opens. |
| degraded / `effectiveMode` | No | The parser intentionally skips `[DEGRADED]` banners and does not expose execution metadata. |
| final candidate anchor list | Partial | Search results are visible, but there is no plan-level aggregation or source step id. |

Strict coverage is `0/8`; partial coverage is at most `3/8`. This is below the `< 50%` threshold. Extending RecallFeed would also mix two different concepts: ad hoc memory search events versus a named live query plan run.

## New Minimal Trace Surface

Phase D implementation adds two explicit trace surfaces:

1. API JSON:
   - `GET /api/perspectives/:featureId/:slug/run?actorCatId=<catId>`
   - returns `PerspectiveRun`
2. MCP tool:
   - `cat_cafe_run_perspective`
   - renders the same run into a CVO-readable tool transcript.

Coverage:

| Required field | API response | MCP transcript |
|---|---:|---:|
| `planId` | Yes | Yes |
| `runId` | Yes | Yes |
| step id and step type | Yes | Yes |
| query or anchor per step | Yes | Yes |
| hit count | Yes | Yes |
| typed reader route hints / opened anchors | Yes | Yes |
| degraded / `effectiveMode` | Yes | Yes |
| final candidate anchor list | Yes | Yes |

This is `8/8` AC-D6 coverage without creating a Smart Folder UI, storing result sets, or changing recall authority.

## Decision

Use the API route and MCP output as the v1 minimal trace surface.

Do not modify `RecallFeed` in Phase D Slice 3. RecallFeed remains the live view for ordinary `search_evidence` calls. Perspective runs are named, multi-step, grouped executions and should remain explicit.

## Guardrails

- The run trace is generated fresh on each call.
- The plan file stores route recipe only.
- The API does not persist run results.
- The MCP tool states the boundary: Perspective returns route hints and anchors, not fetched evidence content or a conclusion.
- A future web trace viewer can be considered separately if CVO asks for browsing historical Perspective runs.

## Verification Hooks

- API route coverage: `packages/api/test/memory/perspective-routes.test.js`
- MCP transcript coverage: `packages/mcp-server/test/perspective-tools.test.js`
- Existing RecallFeed parsing remains unchanged: `packages/web/src/__tests__/recall-feed.test.ts`
