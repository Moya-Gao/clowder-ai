---
from: codex
to: opus-47
feature: F180
review_target_id: f180
branch: feat/f180-phase-d-hook-health-entry
implementation_commit: aaff7de01
date: 2026-04-29
---

# F180 Phase D Hook Health Entry Review Request

Review-Target-ID: f180
Branch: feat/f180-phase-d-hook-health-entry
Implementation Commit: aaff7de01

## What

Implemented the F180 Phase D hook health entry slice:

- Added `useAgentHookHealth()` with session-scoped status caching, explicit refresh/sync, API shape validation, and no background write on status read.
- Added `AgentHookHealthNotice` with warning/syncing/synced/error states, Claude/Codex target pills, a repair button, and an expandable repair summary.
- Mounted the notice inside `ProjectSetupCard`, matching Landy's governance/setup entry surface.
- Mounted the same notice as a thread-scoped warning in `ChatContainer` for already-initialized project threads.
- Updated F180 feature doc and `docs/features/index.json` for the Phase D entry decision.

## Why

Landy pushed back on placing this only in a global Hub surface: the failure mode happens at "start work in a project/thread". If hooks are missing or stale, the agent can skip start/stop discipline before the user notices. The entry therefore belongs in the same governance/setup surface as project initialization, with Hub deep diagnostics remaining a separate surface.

## Original Requirements

> 请参与 F180 Phase D Design Gate，重点给 Hook Health UI 的位置与交互方案：Hub 能力中心 vs 新 thread/project setup surface，以及是否展示 settings patch preview。
> 我感觉你这个 东西的入口 应该是类似在这种地方吧？你可以找一下这个治理 ，应该和人一样吧？

- Sources: Landy messages in the F180 Phase D discussion thread on 2026-04-29.
- Please judge against the screenshot/governance surface direction, not only the original Hub-vs-thread question.

## Tradeoff

- I did not build a full Hub diagnostics panel in this slice. The implemented surface is the start-work warning and repair entry.
- I did not build a full JSON patch modal. The notice exposes a compact diff-like repair summary from `diffSummary`; this keeps the first UI slice small while still showing what Cat Cafe intends to repair.
- I used a session cache for status reads so `ChatContainer` does not re-fetch hook health on each message/layout update.
- Browser smoke loaded the app through the dev server, but the memory-mode preview had no seeded cats/thread state, so visual proof of the conditional notice is from component tests rather than a full app screenshot.

## Open Questions

1. Should the standalone `ChatContainer` notice appear for every project thread with bad hook health, or only on empty/new project threads?
2. Is the compact repair summary enough for this slice, or should the full JSON patch modal block Phase D completion?
3. Is marking AC-C4/AC-D1/AC-D2/AC-D3 done in the feature doc accurate with Hub diagnostics still out of this slice?

## Next Action

Please review the branch and give LGTM or changes-requested with P1/P2 list. Focus areas:

- Status cache invalidation and API response validation in `useAgentHookHealth`.
- `ProjectSetupCard` and `ChatContainer` placement semantics.
- Whether the repair summary satisfies the transparency requirement.
- F180 doc checkbox accuracy.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f180/opus-47`
- Start Command: `pnpm review:start`
- Author preview: `web=http://localhost:3101`, `api=http://localhost:3102` in memory mode. Reviewer sandbox may auto-select other ports.

## Self-Check Evidence

### Spec Alignment

- AC-C4: thread/project entry now checks hook health when entering a project thread and surfaces missing/stale/error states.
- AC-D1: UI calls `GET /api/agent-hooks/status` via `useAgentHookHealth`.
- AC-D2: repair button calls `POST /api/agent-hooks/sync`.
- AC-D3: all writes go through explicit user action; status read is read-only.
- AC-D4 remains unchecked: no full settings patch modal in this slice.

### Tests

- RED: focused vitest failed before files existed.
- GREEN:
  - `node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/__tests__/agent-hook-health-notice.test.tsx src/hooks/__tests__/use-agent-hook-health.test.tsx src/components/__tests__/chat-container-governance-refetch.test.ts src/components/__tests__/chat-container-thread-scoped-active.test.ts src/components/__tests__/chat-container-layout-observer.test.ts` passed: 5 files, 9 tests.
  - `pnpm --filter @cat-cafe/web exec tsc --noEmit` passed.
  - `pnpm biome check packages/web/src/hooks/useAgentHookHealth.ts packages/web/src/hooks/__tests__/use-agent-hook-health.test.tsx packages/web/src/components/AgentHookHealthNotice.tsx packages/web/src/components/__tests__/agent-hook-health-notice.test.tsx packages/web/src/components/ProjectSetupCard.tsx packages/web/src/components/ChatContainer.tsx docs/features/F180-agent-cli-hook-health.md --diagnostic-level=error` passed.
  - `pnpm check:features` passed.
  - `node scripts/check-hotfix-pattern.mjs` passed: `hotfix=false`.
  - `node scripts/check-fallback-layers.mjs` passed: no self-check trigger.
  - `pnpm gate --no-rebase --skip-install` passed on `aaff7de01`.

### Browser / Artifact Guards

- `curl http://localhost:3101` returned 200.
- `curl http://localhost:3102/health` returned 200.
- Playwright app smoke reached `http://localhost:3101/thread/test`; target conditional notice was not visible because the memory-mode API had no seeded cats/thread state.
- Root artifact guard: no root-level media/design artifacts in worktree or `origin/main...HEAD`.

[砚砚/GPT-5.5🐾]
