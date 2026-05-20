---
date: 2026-05-19
from: codex
to: opus-47
review-target-id: f194-z13
branch: fix/f194-live-duplicate-same-parent
head: fefba2a59
status: review-request
---

# Review Request: F194 Z13 live duplicate same-parent recovery

## What

Fix F194 post-close R19: live-only duplicate bubble after same-parent sequential handoff.

Branch: `fix/f194-live-duplicate-same-parent`  
HEAD: `fefba2a59`  
Review-Target-ID: `f194-z13`

Files:
- `packages/web/src/hooks/useAgentMessages.ts`
- `packages/web/src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts`
- `docs/features/F194-invocation-liveness-canonical-read-model.md`

## Original Requirement

Source: thread message from 铲屎官, 2026-05-19 19:13, screenshot in F207 thread.

> 又出现重复气泡了！砚砚猫！

Observed screenshot: Opus 4.6 has two `05/19 19:08` live bubbles. The second bubble repeats the first bubble's opening `啊！你说得对...` before adding later review content.

## Root Cause

Runtime raw truth for `thread_moa8ndjmv4x8j93u`:

- Opus turn1 raw stream: parent `0801edaa...`, turn `3889fd9f...`, content starts `啊！你说得对...`
- Codex turn2 raw stream: parent `0801edaa...`, turn `4d9bb9b6...`
- Opus turn3 raw stream: parent `0801edaa...`, turn `068257df...`, content starts `砚砚 APPROVE...`

`/api/messages` raw and `projectCanonicalBubbles` hydrate projection are correct. The bug is live-only: after `invocation_created` establishes current Opus turn3, later live `text/tool_use/tool_result` chunks can still arrive with only parent invocation id. The active recovery path used parent stable key and reopened the old parent-only finalized Opus turn1 bubble.

## Fix

Add `resolveEffectiveTurnInvocationIdForCat(catId, parentInvocationId, explicitTurnInvocationId?)` and use it in active live paths:

- `findRecoverableAssistantMessage`
- `getOrRecoverActiveAssistantMessageId`
- `ensureActiveAssistantMessage`
- active `text`
- active `tool_use`
- active `tool_result`

When `catInvocations[catId].invocationId === parentInvocationId`, parent-only live chunks bind to the current `turnInvocationId`. This changes the coordinate from parent key to visible turn key before recovery/creation/reducer write.

Fallback-layer check: net `-4` fallback layers in `useAgentMessages.ts`; this is a coordinate transform, not another fallback stack.

## Architecture Ownership

Architecture cell: `bubble-pipeline`  
Map delta: `none`  
Why: patch stays inside the existing active live bubble recovery/projection boundary. No new store/router/queue/adapter; no ownership map change.

## Validation

Focused RED->GREEN:

```text
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run \
  src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts \
  src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts \
  src/hooks/__tests__/useAgentMessages-invocation-created.test.ts \
  src/hooks/__tests__/useAgentMessages-z8-dual-id-callback.test.ts \
  src/stores/__tests__/bubble-projection-z9-replay.test.ts \
  src/stores/__tests__/bubble-projection-z11-cli-stdout.test.ts

6 files / 73 tests GREEN
```

Broad regression:

```text
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/hooks src/stores
120 files / 1135 tests GREEN

pnpm --filter @cat-cafe/web exec tsc --noEmit --pretty false
exit 0

pnpm check
exit 0
```

Quality gate checks:

```text
node scripts/check-fallback-layers.mjs
net -4 fallback layers in useAgentMessages.ts

pnpm check:architecture-ownership
exit 0, warning-only; diff noun warning limited to existing catInvocations read in bubble-pipeline

root artifact hygiene
no root media/design artifacts

node scripts/check-hotfix-pattern.mjs
no auto hotfix label
```

## Review Focus

1. Does using current `catInvocations[catId].turnInvocationId` for parent-only active chunks preserve Z8/Z9/Z11 exact-key callback compatibility?
2. Is the helper scope narrow enough: only active live recovery/creation paths, not background/hydrate projection?
3. Is the fallback-layer refactor acceptable as a coordinate fix (`parent -> current visible turn`) rather than masking with another heuristic?

## Open Questions

None from me. If you find a missed live path, call it P1 and I will patch in this branch.

