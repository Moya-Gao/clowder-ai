---
feature_ids:
  - F095
topics:
  - sidebar
  - search
  - collapse
doc_kind: review-request
created: 2026-06-01
---

# Review Request: F095 Sidebar Search Collapse Fix

Review-Target-ID: f095-search-collapse
Branch: fix/f095-search-collapse
Author: [砚砚/GPT-5.5🐾]
Requested Reviewer: @opus

## What

- Changed sidebar collapse resolution so active search no longer forces every group to render expanded forever.
- Added one-shot search auto-expansion per query: search still reveals matching groups initially, but manual group toggle / "全部折叠" wins afterward until the query changes.
- Added regression coverage for the active-search collapse path in both pure collapse helpers and the hook.
- Fixed an existing Next build blocker by moving `resolveLayoutThreadId` out of `src/app/(chat)/layout.tsx`; Next layouts cannot export arbitrary named helpers.

## Why

铲屎官 reported that, while filtering the thread sidebar, clicking a thread group header could not fold it and "全部折叠" also did nothing. Root cause was `searchQuery.length > 0` short-circuiting collapse state at render time, so persisted/manual state changed but UI ignored it. The behavior contract should be: search opens relevant groups once so results are discoverable, then user collapse actions are authoritative.

## Original Requirements

> 我发现这里 thread这个地方 点击不了这个让他折叠起来了！ 包括全部折叠点了也不生效了！ @codex why？哪个pr / feat是肇事猫猫？
> 嘿嘿那你开一个worktree修一下？然后和你的小伙伴按照sop闭环？

- 来源：当前 A2A thread，2026-06-01 08:35/08:56 UTC
- 肇事定位：F095 Phase A / PR #366 introduced the search-force-expanded behavior; this patch preserves the intended search reveal without overriding later manual collapse.

## Tradeoff

I did not remove search auto-expansion entirely. That would make hidden matches easy to miss after a previous collapse. Instead, search expansion is scoped to the first render for a changed query; same-query data refreshes no longer undo manual collapse.

## Architecture Ownership

Architecture cell: thread-navigation
Map delta: none
Why: This only changes existing ThreadSidebar collapse state and moves one layout helper into a pure module; no Store / Queue / Router / Adapter / Dispatcher / Binding boundary changes.

Reviewer checks:
- Confirm the same-query guard does not regress search result discoverability.
- Confirm `threadGroups` refresh while search is active does not re-expand manually collapsed groups.
- Confirm the Next layout helper move is a build-gate-only extraction and does not change routing semantics.

## Open Questions

### 技术 OQ（给 reviewer）

- Is "auto-expand once per query, manual collapse wins until query changes" the right final contract for search-filtered thread groups?
- Should empty-search reset only the last auto-expanded query, as implemented, or also force an expand-all? I intentionally kept existing persisted collapse state intact.

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review the diff and either approve for merge-gate or return blocking findings with concrete file/line references.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f095-search-collapse/opus`
- Start Command: `WORKTREE_PORT_OFFSET=-10 PREVIEW_GATEWAY_PORT=0 ANTHROPIC_PROXY_ENABLED=0 ASR_ENABLED=0 TTS_ENABLED=0 LLM_POSTPROCESS_ENABLED=0 EMBED_ENABLED=0 EMBED_MODE=off pnpm dev:direct`
- Ports: `web=5112`, `api=3112`, `redis=6388`

## 自检证据

### Spec 合规

- Worktree: `/Users/lysander/projects/relay-station/cat-cafe-f095-search-collapse`
- Branch: `fix/f095-search-collapse`
- Base: `origin/main` at `7a8ac50ce docs: add DeliAutoResearch synthesis`
- Design refs checked: `designs/sidebar-navigation.pen`, `designs/F128-thread-hierarchy-sidebar.pen`. No visual layout/style delta; this is behavior-state logic.
- Artifact hygiene: root media/debris grep clean; `git diff --check` clean.

### Red / Green

- Red: `pnpm --filter @cat-cafe/web exec node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/__tests__/use-collapse-state-hook.test.ts`
  - New regression failed before implementation: after `collapseAll()` with `searchQuery='relay'`, `isCollapsed('pinned')` was still `false`.
- Green targeted:
  - `pnpm --filter @cat-cafe/web exec node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/__tests__/use-collapse-state.test.ts src/components/__tests__/use-collapse-state-hook.test.ts`
  - Result: 2 files passed, 26 tests passed.
- Green layout helper:
  - `pnpm --filter @cat-cafe/web exec node scripts/run-with-node-env-test.mjs pnpm exec vitest run 'src/app/(chat)/__tests__/thread-route-marker.test.tsx'`
  - Result: 1 file passed, 3 tests passed.

### Full Gates

- `pnpm check` — passed, all 20 checks.
- `pnpm lint` — passed with existing warnings only.
- `pnpm --filter @cat-cafe/web test` — passed, 439 files / 3632 tests.
- `pnpm -r --if-present run build` — passed after moving the invalid layout helper export.
- `pnpm test` — passed, root workspace test run exit 0.
- `pnpm check:architecture-ownership` — passed; only existing warning inventory, diff architecture nouns OK.

### Browser Dogfood

Author sandbox ran on `http://localhost:5112` with API `http://localhost:3112`.

- Search `微信` auto-expanded matching groups initially.
- Clicking `全部折叠` while search remained active updated storage to include collapsed groups and hid matching items from visible sidebar text.
- Re-entering the same search auto-expanded once; clicking the single `系统1` group collapsed only that group while other result groups stayed visible.

### Related Files

- `packages/web/src/components/ThreadSidebar/collapse-state.ts`
- `packages/web/src/components/ThreadSidebar/use-collapse-state.ts`
- `packages/web/src/components/__tests__/use-collapse-state.test.ts`
- `packages/web/src/components/__tests__/use-collapse-state-hook.test.ts`
- `packages/web/src/app/(chat)/layout-thread-id.ts`
- `packages/web/src/app/(chat)/layout.tsx`
- `packages/web/src/app/(chat)/__tests__/thread-route-marker.test.tsx`
