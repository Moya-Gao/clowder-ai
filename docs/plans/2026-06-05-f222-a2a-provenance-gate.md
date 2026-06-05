# F222 P1 Fix — A2A Provenance Gate for Frustration Detection

**Feature:** F222 — `docs/features/F222-frustration-auto-issue.md`
**Goal:** A2A/connector 触发的 route 不弹 frustration auto-issue 卡片
**Root Cause:** route-serial/route-parallel 的 F222 detector 对所有 route completion 无差别运行，不区分 user-origin vs agent-origin
**Architecture cell:** harness-eval
**Map delta:** none
**Tech Stack:** TypeScript, existing F222 pipeline
**前端验证:** No

---

## What We're NOT Building

- ❌ 不删 cli_error signal type — 用户触发的 CLI error 仍是 F222 核心价值
- ❌ 不改 evaluate() 内部逻辑 — gate 在调用侧，不在 detector 内部
- ❌ 不改前端 — 折叠/误报是 UX-1/UX-2，单独 PR

## Task 1: Add `frustrationAutoIssueEligible` to RouteOptions

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts`

**Step 1.1:** Add `frustrationAutoIssueEligible?: boolean` to `RouteOptions` interface
**Step 1.2:** Build passes

## Task 2: Plumb flag from message origins

**Files:**
- Modify: `packages/api/src/routes/messages.ts` (user direct entry → eligible=true)
- Modify: `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts` (check entry.source → agent=false, else=true)

**Step 2.1:** messages.ts: add `frustrationAutoIssueEligible: true` to routeExecution opts
**Step 2.2:** QueueProcessor: add `frustrationAutoIssueEligible: entry.source !== 'agent'` to routeExecution opts

## Task 3: Gate F222 detection in route strategies (RED→GREEN)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts`
- Test: `packages/api/test/services/frustration-provenance-gate.test.js` (new)

**Step 3.1:** Write RED tests:
- A2A route (eligible=false) + CLI diagnostics → FrustrationIssue NOT created
- User route (eligible=true) + CLI diagnostics → FrustrationIssue still created
- eligible=undefined (backward compat) → still creates (default eligible)

**Step 3.2:** Gate route-serial F222 block: `if (deps.frustrationIssueStore && opts.frustrationAutoIssueEligible !== false)`
**Step 3.3:** Gate route-parallel F222 block: same
**Step 3.4:** Gate AgentRouter.routeExecution text_frustration + retry_burst: same
**Step 3.5:** Tests GREEN

## Task 4: Verification

- `pnpm check` + all F222 tests pass
- `pnpm gate` green
