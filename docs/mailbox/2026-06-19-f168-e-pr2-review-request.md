---
feature_ids: [F168]
topics: [phase-e, decision-queue, review, e-pr2]
doc_kind: mailbox
created: 2026-06-19
---

# Review Request: F168 Phase E — E-PR2 Frontend Decision Queue UX

Review-Target-ID: f168-e-pr2
Branch: feat/f168-e-pr2

## What

E-PR2 wires the Phase E backend contract into the existing CommunityPanel:

- Adds `DecisionQueuePanel` + `DecisionQueueItem` for prioritized queue rendering and actions.
- Fetches `GET /api/community-decision-queue?repo=...` from `CommunityPanel`.
- Renders Decision Queue above raw Issues / PRs / Findings.
- Wires queue actions to canonical endpoints:
  - direction decisions -> `POST /api/community-issues/:id/resolve`
  - report/waive closure -> D-PR1 `/report` / `/waive`
  - finding lifecycle -> E-PR1 `/api/community-findings/:id/{acknowledge,resolve,waive}`
  - `close-via-github` -> external GitHub link only, no local legacy `PATCH`
- Updates F168 feature doc, community-ops architecture ownership map, `opensource-ops` skill guidance, and capability tip seed.

Implementation commit: `6513f021e`

## Why

Phase E is the CVO-facing closeout for F168: the board should stop making humans scan separate Issues / PRs / Findings sections and instead surface the next actionable community decision first. E-PR1 provided the backend read model; this PR consumes it without creating a new page or second canonical workflow store.

## Original Requirements（必填）

> "不应该和失败的 mission hub（我几乎不打开）那样放在独立的页面。应该和成功的 workspace 里面的开发、记忆、调度、任务那些 tab 一样挂在右边"
> "大多数我们的操作！谁自己手点啊！都是和猫猫自然语言。所以似乎这个能力应该是打开了社区系统 thread，右边可以看到社区事务管理，然后里边就是看板了"
> "比如说我可以点击跳转到 feat153 里面去看这个社区处理进度，毕竟猫猫跑在 thread 里！我觉得应该这样联动才是对的！"

- 来源：`docs/features/F168-community-ops-board.md` § Original Requirements lines 70-72
- Plan：`docs/plans/2026-06-19-f168-phase-e-decision-queue.md` E-PR2 row
- **请对照上面的摘录判断：E-PR2 是否把决策队列落在现有 CommunityPanel，而不是独立页面或平行 workflow**

## Tradeoff

- No standalone page. The queue is embedded in `CommunityPanel`, matching the Workspace-side-panel mental model.
- No new frontend store. Queue state comes from the API response and refreshes alongside board/findings.
- No GitHub auto-close/comment. `close-via-github` is an external action link only; external side effects remain explicit.
- Queue render is fail-soft for malformed/missing `items` to preserve old board mocks and avoid crashing the panel on a bad read-model response.
- Mobile app shell still uses the existing `MobileStatusSheet` under `lg`; E-PR2 does not re-architect the global mobile shell.

## Architecture Ownership（必填）

Architecture cell: community-ops
Map delta: update required
Why: Adds the Phase E Decision Queue frontend surface and skill/capability guidance to the existing community-ops read-model/UX boundary; no new canonical store/cell.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- `DecisionQueuePanel` 是否只是 CommunityPanel 的 read-model consumer，没有变成第二 workflow owner

## Open Questions

### 技术 OQ（给 reviewer）

1. **Action wiring:** verify there are no refresh-only buttons and no legacy `PATCH /api/community-issues/:id` close path. The queue should call canonical Phase D/E endpoints or external GitHub links only.
2. **Information architecture:** verify the queue is the first operational surface above raw Issues / PRs / Findings, and does not reintroduce noisy parallel closure cards as the primary workflow.
3. **Malformed queue response guard:** `fetchDecisionQueue()` treats non-array `items` as `[]`. My position: acceptable fail-soft read-model guard, and it keeps older CommunityPanel tests/mocks from crashing. Please verify it is not hiding a contract bug that should be fail-visible.
4. **Fallback-layer self-check:** net new fallback count is +2 (`CommunityPanel` network guard, `DecisionQueueItem` action guard). My position: both are UI fail-soft boundaries; not a coordinate-system workaround.
5. **Visual fit:** long titles/asks/evidence should wrap inside the side panel at desktop and narrow widths.

### 价值 OQ（给 CVO，如有）

无。CVO already approved Phase E direction; this PR implements the approved E-PR2 UX/docs scope.

## Next Action

请 @opus review E-PR2. 放行后我进入 merge-gate：PR checks, squash merge, then Phase E close prep / non-author vision guard.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f168-e-pr2/opus`
- Start Command: `pnpm review:start`
- Ports: `pnpm review:start` auto-assigns isolated review ports. Author dogfood used `web=2921`; no author dev server is left running. Do not use 3001/3002/3011/3012/4111.

## 自检证据

### Spec 合规

- E-PR2 scope matches plan row: CommunityPanel queue UX + docs/skill sync + browser verification.
- NOT building respected: no independent page, no `DecisionQueueStore`, no GitHub auto-close/comment, no Event Log / Projector / RoleResolver / DirectionCard rebuild.
- Architecture ownership map updated for community-ops.
- `opensource-ops` skill and capability tip updated so the new operational surface is discoverable.
- Root artifact gate empty for root media files.

### 测试结果

```bash
pnpm test
# PASS: root suite exit 0
# web summary: 501 files / 4375 tests passed
```

```bash
pnpm check
# PASS: Biome + feature truth + capability tips + SOP + skills + env + pre-merge + guides + scripts ASCII
# Note: existing advisory warnings remain for undeclared MCP requirements in pencil/browser automation skills.
```

```bash
pnpm --filter @cat-cafe/web build
# PASS: build completed; existing lint warnings only, no E-PR2 file warnings called out.
```

```bash
pnpm --filter @cat-cafe/web exec vitest run \
  src/components/__tests__/community-panel-dispatch.test.ts \
  src/components/__tests__/community-panel-filter.test.ts \
  src/components/__tests__/community-panel-navigation.test.ts \
  src/components/__tests__/community-decision-queue.test.tsx
# PASS: 4 files / 15 tests
```

```bash
node scripts/check-fallback-layers.mjs
# PASS: net +2 fallback layers; both reviewed as UI fail-soft boundaries.
```

Browser dogfood:

- Local Next server dogfooded on `web=2921`, then stopped.
- `curl` + Playwright verified the queue and raw issues both render, queue appears before raw issues, and text does not overflow at desktop/narrow widths.
- Mobile 390px shows the existing app-shell `MobileStatusSheet` instead of `CommunityPanel`; this is an existing shell breakpoint boundary, not changed by E-PR2.
- [爪感差: agent-browser localhost 2921 returned `net::ERR_CONNECTION_CLOSED` while curl + Playwright loaded the same server; used Playwright evidence instead.]

### 相关文档

- Plan: `docs/plans/2026-06-19-f168-phase-e-decision-queue.md`
- Feature: `docs/features/F168-community-ops-board.md`
- Architecture cell: `docs/architecture/ownership/cells/community-ops.md`
- Skill: `cat-cafe-skills/opensource-ops/SKILL.md`
