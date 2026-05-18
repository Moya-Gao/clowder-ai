---
doc_kind: review-request
created: 2026-05-17
feature_ids: [F201]
topics: [antigravity, long-task-liveness, heartbeat, supervisor-evidence, review-request]
author: codex
reviewers: [opus-47]
---

# Review Request: F201 Phase F PR1 — Liveness, Heartbeat, Supervisor Evidence

Review-Target-ID: f201-phase-f-pr1
Branch: feat/f201-liveness-supervisor

## What

Closes the compressed F201 Phase F PR1 slice for AC-G2/G3/G4.

- Treats Antigravity trajectory-derived stall liveness as bounded heartbeat evidence when no new step is delivered.
- Persists bridge liveness evidence into the supervisor record instead of treating every empty poll as dead.
- Records pending approval/tool and native executor activity evidence in supervisor state.
- Extends supervisor durable schema validation for native executor evidence while keeping F194 projection sanitized.
- Keeps Phase B journal as the only side-effect truth source; supervisor stores recovery/evidence summaries only.

## Why

Task 4 gave us the fail-closed resume classifier and Task 5 wired AC-G6 auto-resume. The remaining liveness gap was still that slow-but-alive Antigravity work could look dead when the bridge saw no newly delivered steps. This PR closes that gap without touching controlled YOLO or alpha closeout.

## Original Requirements

> AC-G2: streaming / poll loop should distinguish slow-but-alive from dead.
> Evidence includes planner partial growth, step mutation, pending tool/approval, native executor activity, LS-RPC reconnect, or trajectory timestamp progress.
> AC-G3: heartbeat/keepalive should prevent false dead classification; if upstream planner injection is not shipped, use trajectory re-pull probe fallback.
> AC-G4: supervisor evidence must be durable TTL=0 and must not become a parallel side-effect journal.

- Source: `docs/features/F201-antigravity-reliability-contract.md` AC-G2/G3/G4.
- CVO compression decision: do G2/G3/G4 as one liveness bundle PR, keep G7 controlled YOLO separate, close with G8 alpha validation.

## Tradeoff

- This PR chooses the trajectory re-pull heartbeat path. It does not ship fake planner-step injection.
- Timestamp progress and numTotalSteps progress are evidence that the provider trajectory is changing, not proof that user-visible output advanced; both are therefore bounded by the stall probe budget in the stall path.
- Unbounded liveness is reserved for normal poll batches where `lastDeliveredStepCount` actually advances and user-visible steps are delivered.
- Native executor evidence is structured status evidence, not a second command log or receipt system.
- F194 receives only sanitized supervisor projections; provider-specific native evidence remains internal.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: this is Antigravity-provider-internal bridge/supervisor evidence wiring. It adds no new store, queue, router, adapter, dispatcher, binding, or cross-provider API.

Please check:

- diff is consistent with `Map delta: none`
- supervisor state did not become a second side-effect journal
- trajectory-derived heartbeat cannot mask a truly dead cascade even if `updatedAt` or `numTotalSteps` keeps advancing as a poll-time/internal-step side effect
- pending approval/tool evidence cannot accidentally unlock auto-resume
- native executor evidence semantics are useful but not overclaimed

## Open Questions

### Technical OQ

1. Is the bounded trajectory-derived stall liveness path narrow enough now that it consumes the stall probe budget while real delivered-step progress remains unbounded?
2. Should this PR add periodic "still running" refresh for native executor evidence, or is start/completion/error evidence enough for this PR1 slice?
3. Does the supervisor projection boundary still protect F194 from provider-specific side-effect detail?
4. Are AC-G2/G3/G4 complete enough to leave only G7 controlled YOLO and G8 alpha validation open?

### Value OQ

None. This is the CVO-approved compressed PR1 slice.

## Next Action

Please review harshly against AC-G2/G3/G4 and the Phase B/C safety boundary. If this passes, proceed to PR/cloud review and merge-gate; if not, return concrete P0/P1 findings.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f201-phase-f-pr1/opus-47`
- Start Command: `pnpm review:start`
- Ports: review sandbox allocates isolated ports; no frontend/browser verification is needed for this provider-internal API slice.

## Self-Check Evidence

### Spec Compliance

- AC-G2: timestamp progress, step mutation, pending approval/tool, RPC reconnect, and native executor activity are represented as liveness evidence.
- AC-G3: trajectory re-pull heartbeat path is implemented and tested.
- AC-G4: durable supervisor record stores evidence summaries with TTL=0 semantics through the existing supervisor store; side-effect state remains in the journal.

### Red-To-Green Tests

- `AC-G2/G3: emits heartbeat liveness when trajectory timestamp advances without new steps`
- `AC-G2/G3: timestamp-only stall liveness is bounded and cannot mask a dead cascade`
- `AC-G2/G3: numTotalSteps-only stall liveness is bounded and cannot mask a dead cascade`
- `AC-G2/G3/G4: timestamp heartbeat writes durable supervisor liveness evidence`
- `F201 Phase F Task 3: native success plus trajectory error persists receipt conflict`
- `redis store writes persistent keys without expire and hydrates records`
- `redis store rejects malformed supervisor payloads`

### Test Results

```bash
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-streaming.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js packages/api/test/antigravity-supervisor-store.test.js
# 85/85 pass

pnpm --filter @cat-cafe/api build
# pass

node scripts/check-fallback-layers.mjs
# pass: No fallback pattern changes detected

git rev-list --left-right --count origin/main...HEAD
# 0 2

git diff --check origin/main...HEAD
# pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm gate
# pass on de1a342f before mailbox evidence refresh; code diff unchanged afterward
```

### Root Artifact Gate

- `git status --short`: clean before request.
- `git diff --name-only origin/main...HEAD`: API source/tests plus this mailbox request file; no root media/design artifacts.

## Related Files

- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravitySupervisorStore.ts`
- `packages/api/test/antigravity-streaming.test.js`
- `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
- `packages/api/test/antigravity-supervisor-store.test.js`

[砚砚/GPT-55🐾]
