---
doc_kind: plan
created: 2026-06-19
anchor: doc:plans/2026-06-19-f168-phase-e-decision-queue
topics: [f168, phase, decision-queue, community-ops]
---

# F168 Phase E — Community Decision Queue Implementation Plan

**Feature:** F168 — `docs/features/F168-community-ops-board.md`
**Goal:** 把社区看板从“按状态翻列表”升级成“下一步该谁做什么”的可操作决策队列。CVO/owner 打开 CommunityPanel 后先看到排序后的处理队列：待定方向、待回报、待关单、对账漂移、SLA dead-letter 都以同一种 Decision Packet 形态浮出。
**终态设计:** `docs/discussions/2026-06-09-f168-community-ops-final-design.md` §2 CVO interface + §3 event-sourced architecture + §8 Phase E 行。
**Architecture cell:** community-ops
**Map delta:** update required
**Map delta why:** Phase E 新增 decision queue selector/read route/frontend queue surface，属于 community-ops cell 的 read-model/UX 层扩展。
**Architecture:** 复用 Phase A-D 已合入的 Event Log、CommunityObject projection、DirectionCard、closureChecklist、Reconciler finding store。Phase E 不新增第二 canonical；Decision Queue 是可重建 read model，动作仍回到现有 canonical API / Event Log。
**Tech Stack:** TypeScript, Fastify, Redis-backed existing stores, React CommunityPanel, Playwright/Browser verification
**前端验证:** Yes — CommunityPanel 信息架构和 action wiring 必须截图/浏览器实测

---

## 0. Straight-Line Check（A→B，无绕路）

**Finish line（一句话 B）:** CVO 打开社区看板，不再自己扫 Issues / PRs / Findings 三段找事；系统给出一个按优先级排序的“下一件要处理的社区决策”，每条都说明“谁该做什么、为什么、证据在哪、点哪个动作”，处理后自动从队列消失或降级。

**Phase D actual baseline（不要再按旧 schema 设计）:**

Phase D plan §0 里的 early terminal schema 是设计草稿。真实已交付的 D2 schema 是：

```typescript
interface ClosureChecklist {
  readonly readyToClose: boolean;
  readonly blockers: readonly Array<{
    readonly kind: 'fixed-not-reported' | 'not-in-closeable-state';
    readonly detail: string;
  }>;
  readonly waiverPresent: boolean;
}
```

Phase E 以这个真实 schema 为输入。旧的 `publicReply/linkedWork/ownerDecision/closeReason` 四字段 schema 视为 superseded，不作为实现合同。

**Terminal schema（Phase E 新增终态 read model）:**

```typescript
export type CommunityDecisionQueueKind =
  | 'direction-decision'
  | 'closure-action'
  | 'reconciliation-finding'
  | 'sla-dead-letter'
  | 'external-followup';

export type CommunityDecisionActor = 'cvo' | 'case-owner' | 'reconciler' | 'external-author';

export type CommunityDecisionPriority = 'urgent' | 'high' | 'normal' | 'low';

export type CommunityDecisionStatus = 'open' | 'blocked' | 'done';

export interface CommunityDecisionAction {
  readonly kind:
    | 'resolve-direction'
    | 'mark-reported'
    | 'waive-closure'
    | 'close-via-github'
    | 'acknowledge-finding'
    | 'resolve-finding'
    | 'waive-finding'
    | 'open-thread'
    | 'open-github';
  readonly label: string;
  readonly endpoint?: string;
  readonly method?: 'GET' | 'POST';
  readonly requiresAuditForm?: boolean;
}

export interface CommunityDecisionEvidenceRef {
  readonly label: string;
  readonly source:
    | 'projection'
    | 'direction-card'
    | 'closure-checklist'
    | 'reconciler-finding'
    | 'github'
    | 'thread';
  readonly href?: string;
  readonly text?: string;
}

export interface CommunityDecisionQueueItem {
  /** Stable id: `decision:{kind}:{subjectKey}:{sourceId}` */
  readonly id: string;
  readonly repo: string;
  readonly subjectKey: string;
  readonly subjectType: 'issue' | 'pr';
  readonly number: number;
  readonly kind: CommunityDecisionQueueKind;
  readonly priority: CommunityDecisionPriority;
  readonly actor: CommunityDecisionActor;
  readonly status: CommunityDecisionStatus;
  readonly title: string;
  /** One sentence: what decision/action is needed now. */
  readonly ask: string;
  /** Why this item is in the queue. */
  readonly why: string;
  readonly recommendedActions: readonly CommunityDecisionAction[];
  readonly evidenceRefs: readonly CommunityDecisionEvidenceRef[];
  readonly source: {
    readonly projectionState?: string;
    readonly nextOwner?: string;
    readonly directionCardEntryId?: string;
    readonly findingId?: string;
    readonly closureBlocker?: string;
  };
  readonly firstSeenAt: number;
  readonly lastUpdatedAt: number;
}
```

**NOT building（防 scope 膨胀）:**

- ❌ 不重建 Event Log / Projector / RoleResolver / DirectionCard。
- ❌ 不新增 canonical `DecisionQueueStore`。队列是 read model，能从 projection + findings + direction cards 重建。
- ❌ 不做 GitHub 自动 close/comment。`close-via-github` 只打开外部动作或明确提示，外部副作用仍需 owner/CVO 手动确认。
- ❌ 不做独立新页面。Phase E 先落在现有 `CommunityPanel`，只调整信息架构和组件。
- ❌ 不复活 2026-04 的旧 Phase E “issue sync” scope；那是历史 v1，当前 Phase E 是 reopen 后的决策队列。
- ❌ 不顺手治理全局 test isolation infra。只为 Phase E 新测试写好隔离；历史 aggregate 问题另开技术债。

---

## 1. Stateful Object Gate — Census

| # | 对象 | lifecycle owner | 新增/既有 |
|---|------|-----------------|----------|
| SO-E0 | Phase D schema baseline | plan/read contract | 新增文档基线 |
| SO-E1 | DecisionQueue selector | pure read-model function | 新增 |
| SO-E2 | Decision priority policy | config/pure function | 新增 |
| SO-E3 | Finding action endpoints | existing ReconciliationFindingStore | 新增 route adapter |
| SO-E4 | CommunityPanel queue UI state | frontend client state | 新增 |
| SO-E5 | Decision action forms | existing report/waive/finding APIs | 复用 + 补齐 |
| SO-E6 | docs/skill sync | feature doc + opensource-ops guidance | 新增/更新 |

### SO-E0 Phase D schema baseline — 三件套

**状态×事件转移表:**

| State | Phase E plan kickoff | implementation starts |
|---|---|---|
| old Phase D §0 schema | record as superseded | no implementation may import assumptions from old schema |
| actual D2 schema | becomes Phase E input contract | selector tests fixture uses actual shape |

**不变量:**

- **INV-E0.1:** Phase E tests must fixture `ClosureChecklist.readyToClose/blockers/waiverPresent`, not the superseded four-field shape.
- **INV-E0.2:** Any Phase E route/schema exporting closure checklist must preserve D2 backwards compatibility.

**对抗场景:** A future implementer reads only Phase D §0 and designs against `publicReply/linkedWork/...`; Phase E test fixtures should fail that shape mismatch immediately.

### SO-E1 DecisionQueue selector — 三件套

**Lifecycle owner:** pure selector in `packages/api/src/domains/community/community-decision-queue.ts`.

**状态×事件转移表:**

| Inputs | Queue output |
|---|---|
| pending-decision issue + narrator DirectionCard | `direction-decision` item for CVO/case-owner |
| fixed issue + `fixed-not-reported` blocker | `closure-action` item |
| open/acknowledged Reconciler finding | `reconciliation-finding` or `sla-dead-letter` item |
| awaiting_external stale finding | `external-followup` item |
| closed/declined clean projection | no item |

**不变量:**

- **INV-E1.1:** Queue item ids are stable and deterministic; refresh must not duplicate cards.
- **INV-E1.2:** Queue selector is pure: no Redis, no fetch, no projector writes.
- **INV-E1.3:** Queue item `ask` must be action-specific, not a generic status label.
- **INV-E1.4:** Closed/declined clean cases do not appear in the open queue.
- **INV-E1.5:** One subject may produce multiple items only when they require distinct actors/actions; otherwise selector coalesces into the highest-priority item.

**对抗场景:** A pending-decision issue also has `not-in-closeable-state` checklist. It should produce a direction item only; the non-actionable closure blocker must not create queue noise.

### SO-E2 Decision priority policy — 三件套

**Lifecycle owner:** pure priority function with injected policy defaults.

**Priority order default:**

1. `urgent` — data/state drift that blocks trust: `github-reopened-case-closed`, `github-closed-case-open`, old `case-fixed-unreported`.
2. `high` — CVO/owner decision required: `direction-decision`, `fixed-not-reported`.
3. `normal` — stale awaiting external / needs info follow-up.
4. `low` — acknowledged findings or informational queue items.

**不变量:**

- **INV-E2.1:** Sorting is deterministic: priority rank → actor rank → lastUpdatedAt desc → id asc.
- **INV-E2.2:** Policy is repo-agnostic; no `zts212653/clowder-ai` hardcode.
- **INV-E2.3:** Priority policy cannot hide urgent findings through filters by default; user filters are UI-only.

**对抗场景:** Two items have identical timestamps and priority; order remains stable across refresh by id tie-break.

### SO-E3 Finding action endpoints — 三件套

**Lifecycle owner:** existing `CommunityReconciliationFindingStore`; Phase E adds HTTP adapter, not a new store.

**状态×事件转移表:**

| Current | acknowledge | resolve | waive |
|---|---|---|---|
| open | → acknowledged | → resolved | → waived with audit |
| acknowledged | idempotent | → resolved | → waived with audit |
| resolved | no-op / 409 | idempotent | 409 |
| waived | 409 unless evidence changed upstream | 409 | idempotent if same audit |

**不变量:**

- **INV-E3.1:** Finding buttons in UI must call real endpoints; no refresh-only action handlers.
- **INV-E3.2:** Waive requires reason + actor + evidence; no one-click waive.
- **INV-E3.3:** Endpoint returns 501 if findingStore is not configured, not silent success.
- **INV-E3.4:** Resolved/waived findings remain queryable for audit.

**对抗场景:** User clicks waive without evidence; route returns 400 and UI displays an inline error.

### SO-E4 CommunityPanel queue UI state — 三件套

**Lifecycle owner:** frontend client state; server remains source for queue items.

**UI contract:**

- Queue appears above raw Issues/PRs/Findings sections.
- Raw sections remain available for exploration/debugging.
- The queue item expanded view is the Decision Packet: ask, why, evidence, recommended action.
- Use existing visual language from `CommunityPanel`, `DirectionCard`, `ClosureChecklistCard`, and `ReconciliationFindingCard`.

**不变量:**

- **INV-E4.1:** The first viewport must show queue summary + at least one actionable item when queue is non-empty.
- **INV-E4.2:** No card-in-card nesting. Queue items can expand into unframed detail bands or compact panels.
- **INV-E4.3:** No emoji; SVG icons only.
- **INV-E4.4:** Text must not overlap at narrow widths; item actions wrap cleanly.
- **INV-E4.5:** Queue filters cannot make all urgent items invisible without a visible active-filter indicator.

**对抗场景:** 20 queue items with long GitHub titles and long evidence URLs; rows truncate/wrap without horizontal overflow.

### SO-E5 Decision action forms — 三件套

**Lifecycle owner:** existing canonical APIs:

- direction: `/api/community-issues/:id/resolve`
- report: `/api/community-issues/:id/report`
- waive closure: `/api/community-issues/:id/waive-closure`
- finding lifecycle: new Phase E finding endpoints
- close via GitHub: external link/action, no automatic mutation

**不变量:**

- **INV-E5.1:** Queue actions must reuse existing forms where available (`ReportAuditForm`, `WaiverAuditForm`) rather than duplicating validation.
- **INV-E5.2:** Every state-changing queue action refreshes both board and queue read models.
- **INV-E5.3:** `close-via-github` never calls legacy `PATCH /api/community-issues/:id { state: "closed" }`.

**对抗场景:** A case is ready to close; user clicks “Close via GitHub”; UI opens GitHub target and keeps queue item until webhook/Reconciler confirms closure.

### SO-E6 docs/skill sync — 三件套

**Lifecycle owner:** F168 feature doc + community/open-source ops guidance.

**不变量:**

- **INV-E6.1:** Feature doc timeline records Phase E PRs and close criteria.
- **INV-E6.2:** Any skill/docs update must describe the generic workflow, not hardcode Cat Cafe repo names.
- **INV-E6.3:** Phase E close requires non-author/non-reviewer vision guard.

---

## 2. Component Plan

### E0 — Kickoff prerequisites

**Files:**

- Modify: `docs/plans/2026-06-19-f168-phase-e-decision-queue.md` during review only.
- Optional later: `docs/plans/2026-06-17-f168-phase-d-closure-reconciler.md` to mark §0 schema superseded.

**Steps:**

1. Use this plan’s Phase D actual baseline as implementation truth.
2. For Phase E tests, avoid broad community aggregate runner as the only proof. Run focused files and, before close, clean rebuild + per-file verification if aggregate flakes.

### E1 — Backend decision queue selector + read route

**Files:**

- Create: `packages/api/src/domains/community/community-decision-queue.ts`
- Modify: `packages/api/src/routes/community-issues.ts`
- Test: `packages/api/test/community-decision-queue.test.js`
- Test: `packages/api/test/community-decision-queue-routes.test.js`

**RED tests:**

1. pending-decision issue with narrator entry produces one `direction-decision` item with `resolve-direction` action.
2. fixed issue with `fixed-not-reported` blocker produces one `closure-action` item with report/waive actions.
3. open `case-fixed-unreported` finding produces `sla-dead-letter`.
4. open `github-reopened-case-closed` finding produces `reconciliation-finding` with urgent priority.
5. non-closeable checklist blocker on pending-decision does not produce closure queue noise.
6. closed clean projection produces no item.
7. deterministic sort: priority → actor → updatedAt desc → id asc.

**GREEN implementation:**

- Add pure builder:

```typescript
export function buildCommunityDecisionQueue(input: {
  repo: string;
  issues: readonly CommunityBoardIssueLike[];
  prItems: readonly CommunityBoardPrLike[];
  findings: readonly ReconciliationFindingLike[];
  now: number;
  policy?: CommunityDecisionQueuePolicy;
}): CommunityDecisionQueueItem[];
```

- Add focused route:

```text
GET /api/community-decision-queue?repo=owner/repo
```

- Route composes existing board projection + findingStore data, then calls pure selector.
- Missing findingStore is not fatal: queue can still return projection/direction/closure items with a warning field.

**Acceptance proof:** route fixture returns the same queue ids across repeated calls and does not mutate stores.

### E2 — Finding action endpoints

**Files:**

- Modify: `packages/api/src/routes/community-issues.ts`
- Test: `packages/api/test/community-finding-actions.test.js`

**Endpoints:**

```text
POST /api/community-findings/:findingId/acknowledge
POST /api/community-findings/:findingId/resolve
POST /api/community-findings/:findingId/waive
```

**RED tests:**

1. acknowledge open finding updates status to acknowledged.
2. resolve acknowledged finding updates status to resolved and remains listed by `status=resolved`.
3. waive requires reason + actor + evidence.
4. missing findingStore returns 501.
5. missing finding returns 404.

**GREEN implementation:** expose adapter over `CommunityReconciliationFindingStore` methods; keep all status lifecycle in store.

### E3 — CommunityPanel queue UX

**Design gate:** Create a small design artifact or screenshotable mock before code if layout changes are non-trivial. Since this is an operational panel, keep it dense and integrated; do not create a marketing/landing-style page.

**Files:**

- Create: `packages/web/src/components/community/DecisionQueuePanel.tsx`
- Create: `packages/web/src/components/community/DecisionQueueItem.tsx`
- Modify: `packages/web/src/components/CommunityPanel.tsx`
- Test: `packages/web/src/components/__tests__/community-decision-queue.test.tsx`

**UI behavior:**

1. Fetch `/api/community-decision-queue?repo=...` alongside board/findings.
2. Render queue summary above raw sections: total, urgent/high counts, actor filters.
3. Render first actionable item expanded by default when queue is non-empty.
4. Decision Packet detail shows ask/why/evidence/actions.
5. Raw Issues/PRs/Findings sections stay below as drill-down, collapsed as needed.

**RED tests:**

1. queue appears before Issues and shows urgent item first.
2. action buttons call their intended endpoint/form, not just refresh.
3. `close-via-github` renders as external link/action and never calls legacy PATCH.
4. long title/evidence does not overflow in component-level layout snapshot where test infra supports it.

**Browser verification:**

- Desktop: CommunityPanel shows queue summary + first item + raw sections hint.
- Narrow viewport: actions wrap, no overlap, no horizontal scroll.
- Empty queue: compact “no pending decisions” state, raw board still accessible.

### E4 — Docs / skill sync

**Files:**

- Modify: `docs/features/F168-community-ops-board.md`
- Modify: `docs/architecture/ownership/cells/community-ops.md`
- Optional: `cat-cafe-skills/opensource-ops/SKILL.md` or a community-ops ref if implementation changes operator workflow.

**Steps:**

1. Add Phase E timeline entries after each PR.
2. Update architecture anchors for decision queue selector/route/components.
3. Sync operator guidance: CVO handles queue first; raw board is secondary evidence.

---

## 3. PR Granularity Guard

Phase E is intentionally smaller than Phase D. Default target: **2 PRs, max 2 PRs.**

| PR | Scope | Why |
|---|---|---|
| E-PR1 backend queue contract | E1 selector/read route + E2 finding action endpoints + focused API tests | Establishes stable Decision Queue contract and action endpoints before frontend wiring |
| E-PR2 frontend UX + docs | E3 CommunityPanel queue UX + E4 docs/skill sync + browser verification | Consumes stable API and closes CVO workflow |

**Allowed collapse:** If E-PR1 is very small after review, E-PR1/E-PR2 may be one PR only if review/gate remains manageable.

**Forbidden:** splitting by E0/E1/E2/E3/E4 as separate PRs without a hard blocker and written evidence in PR body.

---

## 4. Verification Matrix

| Gate | Command / Evidence | Expected |
|---|---|---|
| API build | `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build` | exit 0 |
| Queue selector | `pnpm --filter @cat-cafe/api test -- community-decision-queue` or exact node test | all pass |
| Finding actions | focused API route tests | all pass |
| Web tests | `pnpm --filter @cat-cafe/web test -- community-decision-queue` or exact vitest file | all pass |
| Browser UX | Browser/Playwright screenshots desktop + narrow | queue visible, no overlap, actions correct |
| Full check | `pnpm check` | pass |
| Merge gate | `pnpm gate` | pass before PR/cloud review |

**Test isolation note:** Phase D close found community aggregate isolation friction. For Phase E, every new test must clean its own stores/fixtures. If an aggregate community run fails but focused files pass, run clean rebuild + per-file verification before calling it a product bug.

---

## 5. Open Questions

### Technical OQ（实现时可自决）

- **OQ-E1:** Queue route should be top-level (`/api/community-decision-queue`) or embedded in `/api/community-board`. Default: top-level route, with optional board summary later; keeps raw board response backward compatible.
- **OQ-E2:** Queue selector should consume raw ObjectStore projections or current board-shaped items. Default: consume board-shaped items for Phase E MVP, because D2 already enriches legacy/projection-only paths; keep selector types narrow and fixtureable.
- **OQ-E3:** Finding status lifecycle for resolved/waived actions. Default: expose only existing store lifecycle; do not add defer/snooze in MVP.

### Value OQ（需要 CVO 时才升级）

- **OQ-V-E1:** Exact wording of queue item `ask` and priority labels. Default: ship terse operational copy; CVO can tune labels during frontend review.
- **OQ-V-E2:** Whether CVO wants a “next item” single-item mode or a compact list. Default: compact list with first item expanded; no wizard flow until requested.

---

## 6. Review / Handoff Policy

- @codex owns Phase E spec/AC/failure-mode/gate.
- @opus reviews this plan before implementation starts.
- Implementation can be @opus or @codex, but same individual must not review own code.
- Frontend UX needs browser verification and preferably CVO visual check before merge if the layout changes substantially.
- Phase E close requires non-author/non-reviewer vision guard after PRs merge.
