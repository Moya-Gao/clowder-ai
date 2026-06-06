---
feature_ids: [F211]
review_target_id: f211-reg12-reg13
branch: fix/f211-dirty-idle-poll
author: codex
reviewer: opus48
topics: [antigravity, poll-for-steps, tool-use, live-regression]
---

# Review Request: F211 REG12/REG13 Dirty-IDLE Poll + Native Tool Metadata Events

## What Changed

This branch fixes two live Antigravity Desktop regressions from `thread_mq0980eu7l3zonck`:

1. **REG12 P1**: `pollForSteps` can false-stall at `steps=N, status=CASCADE_RUN_STATUS_IDLE` after the latest planner step has already streamed displayable text but remains marked `GENERATING`.
2. **REG13 P2**: native Antigravity tool steps can carry tool identity in `metadata.toolCall`, so Cat Cafe missed `tool_activity` / `tool_use` for live `GREP_SEARCH` / `VIEW_FILE`-style steps.

Files changed:

- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-event-transformer.ts`
- `packages/api/test/antigravity-streaming.test.js`
- `packages/api/test/antigravity-event-mapping.test.js`
- `docs/features/F211-cross-runtime-session-transparency.md`

## Original Requirements

Source: current A2A thread, CVO message at 2026-06-05 19:41 America/Los_Angeles.

> `Error: Antigravity stall: no activity for 60566ms (steps=415, status=CASCADE_RUN_STATUS_IDLE)`
>
> `他怎么卡在step415？以及好像又 tool_activity tool_use 应该给你的孟加拉也加上吧？`

## Diagnosis

Live runtime was already on a post-REG11 build (`93445a987`), so this was not a stale runtime.

The cascade in this event was `633808bb-e92c-49f2-be26-43ccdbf86d4d`. The important tail:

- Step 414: `PLANNER_RESPONSE`, status `CORTEX_STEP_STATUS_GENERATING`, response text already present: `发现了关键信息。让我发评估到 thread。`
- Summary then flipped to `CASCADE_RUN_STATUS_IDLE`.
- Poll cursor reported `steps=415`, but that means "delivered indices 0..414"; there was no actual step 415.
- Existing `terminalReady = isTerminal && !hasGeneratingPlannerResponse(allSteps)` kept waiting for a mutation or next step that never came, then surfaced a false stall.

REG12 fix: keep dirty-IDLE reuse strict for future sends, but inside the current poll, after one later IDLE poll with no new step and no mutation, treat already-delivered displayable planner text as terminal for this invocation.

REG13 fix: normalize tool calls from:

- `step.toolCall`
- `step.metadata.toolCall`
- `step.mcpTool.toolCall`

Then emit the same streamable `system_info:{type:"tool_activity"}` + `tool_use` messages.

## Architecture Ownership

- Architecture cell: `identity-session` + `transport` + `bubble-pipeline`
- Map delta: none
- Why: no new store/router/binding/protocol; this tightens the existing Antigravity poll terminal predicate and existing Antigravity step-to-message transformer.

## Red To Green

RED 1, REG12:

```bash
pnpm --dir packages/api run build &&
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test --test-timeout=60000 packages/api/test/antigravity-streaming.test.js
```

Expected failure before implementation:

```text
F211-REG12 ... Error: Antigravity stall: no activity for 43ms (steps=1, status=CASCADE_RUN_STATUS_IDLE)
```

RED 2, REG13:

```bash
pnpm --dir packages/api run build &&
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test --test-timeout=60000 packages/api/test/antigravity-event-mapping.test.js
```

Expected failures before implementation:

```text
metadata.toolCall -> unknown_activity
should emit activity for metadata.toolCall
```

GREEN:

```bash
pnpm --dir packages/api run build &&
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test --test-timeout=60000 \
  packages/api/test/antigravity-event-mapping.test.js \
  packages/api/test/antigravity-streaming.test.js
```

Result: 49/49 pass.

Broader Antigravity regression subset:

```bash
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test --test-timeout=60000 \
  packages/api/test/antigravity-bridge-session.test.js \
  packages/api/test/antigravity-bridge-poll-status-gate.test.js \
  packages/api/test/antigravity-bridge-busy-reuse-poll.test.js \
  packages/api/test/antigravity-bridge-resilience.test.js \
  packages/api/test/antigravity-waiting-approval.test.js \
  packages/api/test/antigravity-agent-service-diagnostics.test.js
```

Result: 89/89 pass.

Quality checks:

```bash
pnpm check
```

Result: 22/22 checks pass.

Fallback layer check:

```bash
node scripts/check-fallback-layers.mjs
```

Result: triggered cumulative threshold on `antigravity-event-transformer.ts`, but the PR has net `+0` fallback layers there. The only reported line changes an existing fallback from `step.toolCall || step.toolResult` to `toolCallFromStep(step) || step.toolResult`; that is a coordinate transform for the tool-call shape, not a new compensating layer. Each source inside `toolCallFromStep` maps a real Antigravity surface (`toolCall`, `metadata.toolCall`, `mcpTool.toolCall`) into one canonical shape.

Hotfix check:

```bash
node scripts/check-hotfix-pattern.mjs
```

Result: `hotfix=false`.

## Dogfood

Scope verdict: branch-level dogfood only before merge. I did not restart or replace the live 3001/3002 runtime.

Evidence used:

- REG12 reproduces the exact live tail shape in `pollForSteps`.
- REG13 reproduces the live raw tool shape (`metadata.toolCall`) and verifies actual `transformTrajectorySteps` output contains both `tool_activity` and `tool_use`.

Live alpha/runtime smoke should happen after merge and explicit runtime/alpha deploy, not from this feature worktree.

## Review Focus

1. **REG12 predicate width**: Does terminalizing on `IDLE && no new step && no mutation && latest-turn displayable planner text` risk hiding a legitimate still-mutating planner response? Existing test `keeps polling when cascade is IDLE but planner response is still generating` stayed green because the fix requires `!shouldFetchForNewSteps && !hadMutation`.
2. **REG11 interaction**: Future `getOrCreateSession` reuse should still reject dirty IDLE with any `GENERATING` planner. This branch only changes the active poll terminalization path.
3. **REG13 event semantics**: Is it acceptable that `metadata.toolCall` native steps now emit streamable tool-use events like top-level `toolCall` steps?

## Open Questions

None blocking. If reviewer thinks REG13 should avoid emitting a generic `code_action` system_info when a `CODE_ACTION` also has `metadata.toolCall`, I can narrow that in this PR; current behavior preserves the old code-action activity and adds the richer tool-use event.
