---
title: F168 Phase E Close Guard Review Request
date: 2026-06-19
feature: F168
branch: fix/f168-e-close-guard
review_target_id: f168
---

# Review Request: F168 Phase E Close Guard

Review-Target-ID: f168
Branch: fix/f168-e-close-guard

## What

Fixes the two Phase E vision-guard blockers raised after PR #2431 merged:

- Decision Queue items now expose a first-class `open-thread` action when their issue/PR subject has an owner thread.
- `CommunityPanel` no longer boots into `zts212653/clowder-ai`; it starts empty and selects the first discovered repo from `/api/community-repos`.

## Why

The merged E-PR2 queue made the "what should happen next" surface real, but Phase E close was still blocked because the queue did not connect actionable cases back to the thread where cats actually work, and the operator surface still had a Clowder-specific default.

## Original Requirements

> "比如说我可以点击跳转到 feat153 里面去看这个社区处理进度，毕竟猫猫跑在 thread 里！我觉得应该这样联动才是对的！"
> "未来这个 feat 最后一个阶段就是要允许社区其他小伙伴用你们这套管理他们自己的社区！你们在架构设计上必须是解耦的！"

- Source: `docs/features/F168-community-ops-board.md` lines 72 and 75
- Please review against the quoted CVO requirements, not only the implementation diff.

## Tradeoff

I kept this as a close-guard patch instead of redesigning CommunityPanel routing. The backend read model remains rebuildable and still routes mutations through existing canonical APIs; `open-thread` is a navigation action only.

## Architecture Ownership

Architecture cell: community-ops
Map delta: none
Why: This extends the existing F168 Decision Queue read model and CommunityPanel surface; it does not add a second Store, Queue, Router, Adapter, Dispatcher, or Binding.

Please check:

- whether the diff matches `Map delta: none`
- whether `open-thread` is correctly modeled as navigation, not a new mutation channel
- whether the repo selection behavior is genuinely repo-agnostic

## Open Questions

### Technical OQ

- Should `source.assignedThreadId` remain the generic source field name for PR queue subjects, or should a later cleanup introduce a neutral `source.threadId`? I kept the existing issue terminology to minimize contract churn in this close-guard patch.

### Value OQ

None.

## Next Action

Please run a focused code + vision review for this close-guard patch. If approved, it can proceed through merge-gate as the Phase E close unblocker.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f168/gpt52`
- Start Command: `pnpm review:start --web-port=3201 --api-port=3202`
- Ports: `web=3201`, `api=3202`

## Self-Check Evidence

### Spec Compliance

- Thread linkage blocker: covered by API tests for issue/finding queue items and browser dogfood clicking `Open thread`.
- Repo-agnostic blocker: covered by web integration test selecting `acme/community` from `/api/community-repos` and browser dogfood with mocked repo data.
- Architecture ownership: `node scripts/check-architecture-ownership.mjs` exits 0; diff noun scan is OK. Existing stale-anchor warnings are unrelated repository warnings.
- Fallback layer check: `node scripts/check-fallback-layers.mjs` exits 0 and triggers coordinate self-check.
  Verdict: acceptable. The production fallbacks preserve existing partial projection behavior
  (`item.threadId ?? proj.ownerThreadId`) and empty-repo startup behavior (`currentRepo || nextRepos[0] || ''`);
  the three test-helper defaults keep older focused tests concise without changing runtime logic.
  This patch fixes the coordinate system by making owner-thread and repo discovery explicit, not by masking a missing contract.
- Design file scan: `find designs -name '*.pen' -print` found `designs/F168-community-ops-board.pen`; this patch does not change layout, only action wiring/repo default. Browser screenshot evidence captured instead of redesign comparison.
- Artifact hygiene: root media/design artifact checks empty; screenshots stored under `/tmp/cat-cafe-evidence/f168-e-close/`.

### Dogfood-Your-Slice

- Worktree: `/Users/lysander/projects/relay-station/cat-cafe-f168-e-close-fix`
- URL: `http://localhost:3101` with API `http://localhost:3102`
- Command path: start current worktree in memory mode with isolated ports, open Workspace -> Community, mock `/api/community-repos` + queue payload in Playwright, click `Open thread`.
- Result: `beforeUrl=http://localhost:3101/`, `afterUrl=http://localhost:3101/thread/thread-owner`, `navigatedToOwnerThread=true`.
- Screenshots: `/tmp/cat-cafe-evidence/f168-e-close/community-panel.png`, `/tmp/cat-cafe-evidence/f168-e-close/community-open-thread-clicked.png`.

### Test Results

- `pnpm check` -> pass
- `pnpm --dir packages/api build` -> pass
- `pnpm --dir packages/web exec tsc --noEmit` -> pass
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/community-decision-queue.test.js` -> 10/10 pass
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/community-decision-queue-direction.test.js` -> 9/9 pass
- `node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/__tests__/community-decision-queue.test.tsx` -> 9/9 pass, with existing React `act(...)` warnings
- `pnpm --dir packages/web build` -> pass, with existing lint warnings outside this patch
- `git diff --check` -> pass

## Related Documents

- Feature: `docs/features/F168-community-ops-board.md`
- Plan: `docs/plans/2026-06-19-f168-phase-e-decision-queue.md`
- Prior PR: #2431, squash commit `2d35bd585`
