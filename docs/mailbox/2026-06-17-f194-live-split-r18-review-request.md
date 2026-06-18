---
type: review-request
date: 2026-06-17
author: codex
reviewers:
  - opus-47
branch: fix/f194-live-split-r18
status: requested
---

# Review Request: F194 Live Split R18

Review-Target-ID: f194
Branch: fix/f194-live-split-r18
Implementation Commit: `efdced318073e3f798e54be933c5d3bf9fc5fecf`

## What

Fixes the R18 recurrence of the Codex live bubble split where `invocation_created` itself arrives
on the background path after the operator switches away from the replying thread.

- Bridges the per-thread active bubble ledger into `finalizeStaleBackgroundInvocationStreams`.
- Allows a background `invocation_created` event to upgrade the already-visible active
  parent-only seed from `msg-{parent}-codex` to `msg-{turn}-codex`.
- Writes the upgraded bound id back into both `bgStreamRefs` and the active ledger, so later
  no-turn background tool events keep converging onto the same bubble.
- Documents the R18 boundary in the original bug report.

## Why

#2349 fixed late background tool events by letting background message creation recover a bound turn
from the active ledger. R18 exposed a narrower earlier window: the user can switch away before
`invocation_created` arrives, so the background boundary cleanup still sees no `bgStreamRefs` entry
and finalizes the active parent-only seed instead of upgrading it. Late no-turn tools can then drift
through `catInvocations` into a shadow CLI-only bubble.

## Original Requirements

> "@codex 好消息你又裂开了"
> Screenshot shows a codex reply rendered as content bubble plus a separate "CLI Output" tools-only bubble.

- Source: current F194 saga thread, user message `0001781746841799-000121-19bc1fc6`, 2026-06-17.
- Bug report: `docs/bug-report/2026-06-16-codex-live-bubble-split-race/README.md`.
- Please verify this handles the new R18 edge without reopening the #2349/Z3 multi-turn boundary.

## Tradeoff

This is still a surgical bridge inside the existing live reducer rather than a full rewrite of the
active/background message pipeline. I accepted that because the new condition is deliberately narrow:
same thread, same cat, same visible message id, same parent invocation id, and
`seedSource === 'fresh-parent-seed'`, plus the existing fresh-seed timestamp/seq window.

## Architecture Ownership

Architecture cell: `bubble-pipeline`
Map delta: none
Why: This extends an existing live bubble reconciliation path and test coverage; it does not add a new Store, Queue, Router, Adapter, Dispatcher, Binding, or ownership boundary.

Please check:
- diff matches `Map delta: none`
- the active-ledger bridge cannot upgrade stale parent-only bubbles from older turns
- true same-parent multi-turn Codex replies still stay separate

## Open Questions

### Technical OQ

1. Is the `ledgerRefForMessage` gate narrow enough, especially `seedSource === 'fresh-parent-seed'`
   plus `isCurrentFreshParentSeed(...)`?
2. Should the background upgrade write back to the active ledger as `bound`, or is `bgStreamRefs`
   alone sufficient after the id replacement?
3. Does this preserve #814/F194 explicit-post no-swallow and the #2349 Z3 redline?

### Value OQ

None. This is a reversible technical bugfix for a user-visible regression.

## Next Action

Please review commit `efdced318073e3f798e54be933c5d3bf9fc5fecf` in worktree:

`/Users/lysander/projects/relay-station/cat-cafe-f194-live-split-r18`

If approved, proceed to merge-gate/PR path. If you find any same-pattern gap, send it back to
`@codex`; do not patch `useAgentMessages.ts` yourself unless you explicitly take over authorship.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f194/opus47`
- Start Command: `pnpm review:start`
- Ports: use `pnpm review:start` assigned ports; do not use runtime `3001/3002` or alpha `3011/3012/4111` for unmerged verification.

## Self-Check Evidence

### Spec Compliance

- R18 root cause recorded in `docs/bug-report/2026-06-16-codex-live-bubble-split-race/README.md`.
- New red test covers active parent-only seed creation, thread switch before background
  `invocation_created`, done, `catInvocations` drift, and late no-turn background tool.
- Existing Z3 redline test remains in the same file and still passes.
- Fallback layer self-check: `scripts/check-fallback-layers.mjs` reports total net fallback change
  `+0`; the cumulative warning is the existing `useAgentMessages.ts` total layer count. This patch
  is repairing the live bubble coordinate handoff rather than adding a new fallback stack.

### Dogfood-Your-Slice

Scope verdict: partial. This is user-visible, but live runtime dogfood was not performed on the
unmerged worktree because the bug requires a live Codex race and the browser-control tools failed in
this session (`agent-browser evaluate` unknown command; `pinchtab` context canceled). I used the
captured production screenshot/records as the scenario source and encoded the missing race branch as
a deterministic regression test.

### Test Results

```bash
pnpm --filter @cat-cafe/web exec vitest run \
  src/hooks/__tests__/useAgentMessages-codex-dual-path-thread-switch.test.ts \
  src/hooks/__tests__/useAgentMessages-codex-tool-text-active-basic.test.ts \
  src/hooks/__tests__/useAgentMessages-codex-tool-text-active-residue.test.ts \
  src/hooks/__tests__/useAgentMessages-codex-tool-text-background.test.ts \
  src/hooks/__tests__/mergeReplaceHydrationMessages-stream-residue-drop.test.ts \
  src/hooks/__tests__/mergeReplaceHydrationMessages-stream-residue-preserve.test.ts \
  src/hooks/__tests__/mergeReplaceHydrationMessages-explicit-post.test.ts \
  src/hooks/__tests__/useAgentMessages-a2a-postmsg-no-swallow.test.ts
# 8 files passed, 41 tests passed

pnpm --filter @cat-cafe/web exec tsc --noEmit
# passed

pnpm --filter @cat-cafe/web test -- --run
# 492 files passed, 4233 tests passed
# next.config node:test: 5 passed
# no-hardcoded-colors: passed
```

### SOP / Hygiene

```bash
node scripts/check-hotfix-pattern.mjs
# {"hotfix":false,"autoLabel":false,"labelApplied":null,"labelError":null}

node scripts/check-fallback-layers.mjs
# Total net fallback change: +0
# cumulative warning only for existing useAgentMessages.ts layer count

pnpm check:architecture-ownership
# exits 0; OK diff architecture nouns; repository baseline warnings only

git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# empty

git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# empty

git diff --check origin/main...HEAD
# empty
```

### Related Documents

- Bug report: `docs/bug-report/2026-06-16-codex-live-bubble-split-race/README.md`
- Feature saga: `docs/features/F194-invocation-liveness-canonical-read-model.md`
