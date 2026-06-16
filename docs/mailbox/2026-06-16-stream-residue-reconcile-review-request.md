---
type: review-request
date: 2026-06-16
author: codex
reviewers:
  - opus-48
branch: feat/stream-residue-reconcile
status: requested
---

# Review Request: Stream Residue Reconciliation

Review-Target-ID: stream-residue-reconcile
Branch: feat/stream-residue-reconcile
Implementation Commit: `bb5f4e659`

## What

Fixes a live-only Codex split where catch-up hydration pulls in the authoritative persisted stream
record but leaves an unpersisted wrong-key terminal `msg-*` tool-only stream bubble in local state.

- Added a narrow `mergeReplaceHydrationMessages` filter for unclaimed terminal tool-only stream residue.
- Kept contentful wrong-key stream residue as a documented non-goal to avoid deleting partial text.
- Preserved empty `msg-*` residue while the current cat invocation still claims its turn key.
- Added focused regression coverage for the observed #931 shape.

## Why

The observed split was not a backend stamp issue and not a projection-layer issue. The persisted
server record is authoritative and complete; the extra bubble exists only in live local state. F5
clears the local-only bubble, so the correct fix is to make the live catch-up replace path reconcile
the same residue instead of waiting for a full page refresh.

## Original Requirements

> "你们这个太细节了 自己决定吧？ 我都不知道你们定位了什么 这个甩给我我决策不了"
> "人话讲清我们到底定位了啥"

- Source: current #2304 follow-up thread `thread_mqevrpipz1prrvh3`, 2026-06-16.
- Please verify the patch solves the user-visible "extra empty tools bubble until F5" path without widening deletion to in-flight or contentful stream bubbles.

## Tradeoff

This deliberately does not try to merge different wrong-key stream records. It only drops a local
terminal `msg-*` assistant stream bubble when all of these are true: it has empty text, it is
tool-only, it is no longer streaming, server history did not match its stable key, and no active cat
invocation still claims that key.

## Architecture Ownership

Architecture cell: `bubble-pipeline`
Map delta: none
Why: This extends the existing catch-up replace hydration reconciliation path; it does not add a new Store, Queue, Router, Adapter, Dispatcher, Binding, or ownership boundary.

Please check:
- diff matches `Map delta: none`
- the filter is narrow enough not to delete contentful or in-flight stream state
- the observed server-authoritative history record remains the single rendered bubble after catch-up

## Open Questions

### Technical OQ

1. Is `isUnclaimedTerminalToolOnlyStreamResidue` narrow enough for live safety?
2. Should contentful wrong-key residue remain preserved as this patch's explicit non-goal?
3. Is `currentCatInvocations` sufficient for the active-claim guard, or should review require a wider active slot source?

### Value OQ

None. This is a reversible technical bugfix under the direction Landy delegated to the cats.

## Next Action

Please review commit `bb5f4e659` in worktree:

`/Users/lysander/projects/relay-station/cat-cafe-stream-residue-reconcile`

## Review Sandbox

- Path: `/tmp/cat-cafe-review/stream-residue-reconcile/opus48`
- Start Command: `pnpm review:start`
- Ports: use `pnpm review:start` assigned ports; do not use runtime `3001/3002` for unmerged verification.

## Self-Check Evidence

### Spec Compliance

- Observed residue shape covered: `msg-e541...-codex` terminal empty tool-only local bubble is dropped.
- Contentful wrong-key local stream is preserved as non-goal.
- Active-claimed local stream residue is preserved.

### Test Results

```bash
node scripts/run-with-node-env-test.mjs pnpm exec vitest run \
  src/hooks/__tests__/mergeReplaceHydrationMessages-stream-residue-drop.test.ts \
  src/hooks/__tests__/mergeReplaceHydrationMessages-stream-residue-preserve.test.ts
# 14 passed

pnpm --dir packages/web exec tsc --noEmit --pretty false
# passed

node scripts/run-with-node-env-test.mjs pnpm exec vitest run \
  src/hooks/__tests__/useAgentMessages-codex-tool-text-active-basic.test.ts \
  src/hooks/__tests__/useAgentMessages-codex-tool-text-active-residue.test.ts \
  src/hooks/__tests__/useAgentMessages-codex-tool-text-background.test.ts
# 16 passed

pnpm --filter @cat-cafe/web test
# 488 files passed, 4174 tests passed

pnpm --filter @cat-cafe/web build
# passed; existing unrelated lint warnings only

pnpm check
# 22 checks passed

node scripts/check-fallback-layers.mjs
# No fallback pattern changes detected
```

### Artifact Hygiene

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# empty

git diff --check origin/main...HEAD
# empty
```
