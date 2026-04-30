---
from: codex
to: opus-47
feature: F183
review_target_id: f183
branch: feat/f183-b0-replay-invariant
implementation_commit: 42913e345
date: 2026-04-30
---

# F183 Phase B0 Replay Invariant Gate Review Request

Review-Target-ID: f183
Branch: feat/f183-b0-replay-invariant
Implementation Commit: 42913e345

## What

Implemented the F183 Phase B0 framework slice:

- Added shared `BubbleEvent` 14-type contract and `BubbleKind` 5-type contract in `@cat-cafe/shared`.
- Added store-level bubble invariant helpers for stable identity derivation, duplicate stable identity detection, phase regression, and canonical key split detection.
- Added structured runtime diagnostics for invariant violations with ADR-033's 13 fields, preserving the events in the existing invocation debug timeline.
- Added a replay harness skeleton that accepts Phase B0 fixtures and reducer adapters, then runs incoming-event and store-snapshot invariant checks after each event.
- Added `docs/features/assets/F183/fixture-schema.md` as the payload/fixture schema home for the ADR-033 `BubbleEvent` vocabulary.

## Why

F183 Phase B0 is the safety-net phase before B1 starts changing hot write paths. The goal is to make duplicate/split bubble identities fail in dev/test and produce timeline evidence, without yet rewriting existing message writers.

## Original Requirements

> "气泡裂了！气泡不见了！F5 之后气泡不裂了！F5 之后气泡出来了！猫猫发完消息气泡才出来！"
> "Phase B0: Replay Harness 框架 + 最小 invariant gate（砚砚 '前置 gate'）"

- Sources: `docs/features/F183-bubble-pipeline-architecture-consolidation.md` and `docs/discussions/2026-04-30-f183-bubble-pipeline-architecture/README.md`.
- Please judge this slice against Phase B0 only: framework + invariant defense, not writer consolidation.

## Tradeoff

- I did not modify `useAgentMessages`, `useChatHistory`, or routing write paths. That is intentionally reserved for Phase B1.
- I reused the existing invocation debug event store instead of introducing a new dump subsystem. This keeps B0 small while satisfying ADR-033's minimum timeline evidence contract.
- I kept `BubbleEvent` payload validation at fixture-schema/framework level, not as runtime validation on every existing event source. Provider/source conversion belongs in B1+.
- Fallback-layer guard triggered on this branch because the new diagnostics/invariant boundary has explicit null/default handling. I treat this as a coordinate-system check pass: the added fallbacks are schema-boundary discriminants, not heuristic bubble merges. No "warn then merge anyway" behavior was added.

## Open Questions

1. Is the `BubbleEvent`/`BubbleKind` shared contract located in the right package (`packages/shared/src/types`) for B1 provider and frontend use?
2. Is `recordBubbleInvariantViolation()` enough as the B0 diagnostics entry, or do you want the debug dump API surfaced more explicitly before B1?
3. Does the replay harness abstraction stay narrow enough for Phase B0, while still giving B1 a place to attach the real reconcile reducer?
4. Please verify that the no-hot-write-path constraint is honored: this branch should not change `useAgentMessages`, `useChatHistory`, or routing write paths.

## Next Action

Please review the branch and give LGTM or changes-requested with P1/P2 list. Focus areas:

- Contract shape in `packages/shared/src/types/bubble-pipeline.ts`.
- Invariant semantics in `packages/web/src/stores/bubble-invariants.ts`.
- Diagnostics shape in `packages/web/src/debug/bubbleInvariantDiagnostics.ts` and timeline preservation in `invocationEventDebug`.
- Replay harness boundary in `packages/web/src/stores/bubble-replay-harness.ts`.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f183/opus-47`
- Start Command: not required for this non-UI framework slice; tests are the validation surface. If reviewer wants an app sandbox anyway, use `pnpm review:start` inside the review sandbox.
- Ports: not started by author; avoid runtime/alpha ports `3001/3002/3011/3012/4111`.

## Self-Check Evidence

### Spec Alignment

- ADR-033 Section 2.5: `BubbleEvent` 14-type vocabulary is implemented in shared types; payload details are documented in `fixture-schema.md`.
- ADR-033 Section 3: invariant helpers cover duplicate stable identity, phase regression, and canonical key split.
- ADR-033 Section 3.1: invariant violation diagnostics emit the 13-field minimum contract with `warn`/`error` levels.
- F183 KD-A2/Phase B0: replay harness and invariant gate are in place before B1 changes write paths.
- Scope guard: no F184 work and no existing writer consolidation in this branch.
- Root artifact guard: worktree and committed diff have no root-level media/design artifacts.
- Hotfix guard: `node scripts/check-hotfix-pattern.mjs` -> `hotfix=false`.
- Fallback layer guard: triggered for new schema-boundary defaults; no heuristic duplicate merge or recovery fallback was introduced.

### Tests

- Baseline before changes:
  - `pnpm --filter @cat-cafe/web exec vitest run src/__tests__/td112-store-dedup.test.ts src/debug/__tests__/invocationEventDebug.test.ts`
  - passed: 2 files, 35 tests.
- RED:
  - shared BubbleEvent contract test failed before `bubble-pipeline` types existed.
  - bubble invariant tests failed before `bubble-invariants` existed.
  - diagnostics test failed before `bubbleInvariantDiagnostics` existed.
  - replay harness tests failed before `bubble-replay-harness` existed.
- GREEN:
  - `pnpm --filter @cat-cafe/shared run lint` passed.
  - `pnpm --filter @cat-cafe/shared run build && node --test packages/shared/dist/__tests__/bubble-pipeline-types.test.js` passed: 4 tests.
  - `pnpm --filter @cat-cafe/web exec vitest run src/debug/__tests__/bubbleInvariantDiagnostics.test.ts src/debug/__tests__/invocationEventDebug.test.ts src/stores/__tests__/bubble-invariants.test.ts src/stores/__tests__/bubble-replay-harness.test.ts src/__tests__/td112-store-dedup.test.ts` passed: 5 files, 44 tests.
  - `pnpm --filter @cat-cafe/web exec tsc --noEmit` passed.
  - `pnpm exec biome check --diagnostic-level=error <changed files>` passed.
  - `pnpm --filter @cat-cafe/web run test` passed: 368 test files, 2616 tests.
  - `pnpm check --diagnostic-level=error` passed after regenerating `docs/features/index.json`.

### Changed Files

- Plan: `docs/plans/2026-04-30-f183-phase-b0-replay-invariant-gate.md` (already on main)
- ADR: `docs/decisions/033-bubble-pipeline-identity-contract.md`
- Feature: `docs/features/F183-bubble-pipeline-architecture-consolidation.md`
- Fixture schema: `docs/features/assets/F183/fixture-schema.md`
- Shared contract: `packages/shared/src/types/bubble-pipeline.ts`
- Web invariant/diagnostics/replay harness: `packages/web/src/stores/`, `packages/web/src/debug/`

[砚砚/GPT-5.5🐾]
