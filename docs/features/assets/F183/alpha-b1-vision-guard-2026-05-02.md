---
feature_ids: [F183]
doc_kind: alpha_validation
created: 2026-05-02
topics: [bubble, alpha, vision-guard, phase-b1]
---

# F183 Phase B1 Alpha Vision Guard

## Scope

This is a Phase B1 alpha validation pass after AC-B1 was closed by PR #1530.
It validates the single-writer/reducer-owned part of the original five bubble
symptoms. It does **not** close full AC-Z1, because several symptoms also depend
on Phase C sequence/gap detection and Phase D IDB invalidation.

## Environment

- Alpha channel: `3011 / 3012 / 4111 / 6398`
- Frontend: `http://localhost:3011`
- API: `http://localhost:3012`
- Main HEAD at validation start: `19eb707d3`
- B1.8 merge commit: `72bd2e27b`
- B1 doc sync commit: `19eb707d3`

Startup verification:

| Check | Result |
|-------|--------|
| `GET /` on frontend | `200` |
| `GET /api/cats` on API | `200` |
| Alpha worktree synced to B1.8 main | pass |

## Browser Smoke

Default thread was loaded in alpha production mode, then hard reloaded.

| Check | Result |
|-------|--------|
| visible message count before reload | `5` |
| visible message count after reload | `5` |
| message id order stable across reload | pass |
| duplicate `data-message-id` after reload | none |

Observed ids:

```text
0001777256560311-000000-4df2b745
0001777256560632-000001-ef8b16f4
0001777256560632-000003-2651e95b
0001777256560632-000004-98357cf4
0001777256568962-000002-0235d0da
```

Alpha production emitted React hydration mismatch errors (`#418`, `#423`) and
one `403` resource load in the browser console. They did not change bubble
identity or visibility in this smoke pass, so they are recorded as alpha runtime
noise, not a B1 blocker. They should not be confused with the original bubble
split/disappear symptoms.

## Fixture Cluster

Ran the B1/F123 bubble cluster against the alpha worktree with `NODE_ENV=test`.
The first attempt inherited `NODE_ENV=production` from the shell and failed
because React production builds do not support `act(...)`; that run is discarded.

Command:

```bash
NODE_ENV=test pnpm -C /Users/lysander/projects/relay-station/cat-cafe-alpha \
  --filter @cat-cafe/web exec vitest run \
  src/stores/__tests__/bubble-reducer.test.ts \
  src/stores/__tests__/bubble-invariants.test.ts \
  src/hooks/__tests__/bubble-event-adapter.test.ts \
  src/hooks/__tests__/useAgentMessages-background.test.ts \
  src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts \
  src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts \
  src/hooks/__tests__/useAgentMessages-cross-thread-handoff.test.ts \
  src/hooks/__tests__/useAgentMessages-thread-dispatch.test.ts \
  src/hooks/__tests__/useChatHistory-replace-hydration.test.ts \
  src/hooks/__tests__/useChatHistory-thread-switch.test.ts
```

Result:

| Test files | Tests | Result |
|------------|-------|--------|
| 10 | 227 | pass |

Coverage highlights:

- BubbleReducer core, invariant gate, and adapter mapping.
- Active/background single dispatch and background thread-scoped writers.
- Callback/stream replacement, rich-block correlation, late stream suppression.
- Cross-thread handoff deterministic bubble id invariant.
- Replace hydration and thread-switch duplicate collapse.

## Five-Symptom Status

| Original symptom | B1-owned alpha result | Remaining dependency |
|------------------|-----------------------|----------------------|
| R1: 气泡裂了 | pass for reducer-owned split/duplicate paths. Browser reload showed no duplicate visible ids; fixture cluster covers active/background split cases. | Phase E should keep invariant assertions/replay harness as runtime guard. |
| R2: 气泡不见了 | partial. B1 no longer drops reducer-owned callback/text/tool/error payloads in covered fixtures. | Phase C sequence/gap still required for lost WebSocket/fire-and-forget events. |
| R3: F5 之后气泡不裂了 | partial pass. Alpha reload kept the same message ids/order and replace-hydration fixture cluster passed. | Phase D IDB contract still required before calling this fully closed. |
| R4: F5 之后气泡出来了 | not closed by B1. | Phase C sequence/gap is the primary owner. |
| R5: 猫猫发完消息气泡才出来 | partial. Callback/stream finalization and late stream suppression are covered by fixtures. | Phase C still needed for transport/gap cases where live chunks never arrived. |

## Verdict

Phase B1 alpha validation is **pass with scope limits**:

- AC-B1 single-writer/reducer convergence is alpha-smoke verified.
- No visible split/duplicate/reload regression was observed in the alpha default thread.
- The B1/F123 bubble fixture cluster is green on the alpha worktree.

Do **not** mark AC-Z1 complete from this pass. Full "five symptoms disappeared"
requires Phase C (sequence + gap), Phase D (IDB contract), and Phase E (runtime
invariant/replay closure), followed by another alpha pass.
