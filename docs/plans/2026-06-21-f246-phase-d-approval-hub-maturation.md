---
feature_ids: [F246]
related_features: [F193, F231, F168, F128, F225]
topics: [approval, hub, maturation, workspace, regression-tests]
doc_kind: plan
created: 2026-06-21
---

# F246 Phase D: Approval Hub Maturation

**Feature:** F246 — `docs/features/F246-approval-hub.md`
**Goal:** 把 Phase C 后真实遗留的成熟化工作收束成可执行交付：AC-C8 收口、workspace/web 自动化回归、筛选、批量操作、v2 adapter admission matrix、materialized index gate。
**Acceptance Criteria:** AC-D1 ~ AC-D7（见下）
**Architecture cell:** platform-infra（subcell: `approval-index`）+ web-shell（workspace integration）
**Map delta:** update existing cell — `approval-index` 新增 Phase D plan anchor；如果本阶段新增筛选/batch 代码锚点，合入时同步 ownership cell。
**Map delta why:** 继续扩展 Approval Hub 聚合层和 workspace presentation；不新增 Store/Queue/Router family，不引入独立 index。
**前端验证:** Yes — reviewer 必须用浏览器/alpha 实测 workspace approval tab、filters、batch actions、responsive tab regression。

---

## Finish Line

F246 不是“先 close 再下次一定”。Phase D 完成后，Approval Hub 才进入 v1 close 候选状态：

- AC-C8 的 intercept mirror pruning 已实现并有回归测试。
- WorkspaceTabBar / ApprovalPanel / ActivityBar 的关键 UX 路径有自动化 web tests，不只靠 alpha smoke。
- CVO 能在 Hub 内按 feature/thread/时效筛选，能对安全 inline 的审批项批量 approve/reject。
- v2 候选 adapter 有 admission matrix 和拆分边界，不再停留在口头候选。
- materialized index 的触发条件明确，query aggregation 继续是有意选择，不是欠账。

## Non-Goals

- 不在 Phase D 引入 materialized CQRS index；除非命中 AC-D7 的阈值。
- 不把 F128/F225 这类需要上下文/override 的项目强行批量 approve。
- 不把 F168 整个 mixed action queue 迁进 Hub；只评估 `direction-decision` 子类型。
- 不做 push notification、邮件、移动端提醒；Hub 仍是 pull surface + badge。

## Acceptance Criteria

- [ ] **AC-D1:** AC-C8 收口：intercept mirror / line-start mention pruning 完成。`assign_work` 的审批拦截只认合法行首 mention / 显式 target，不让正文里的 `@cat` 误触发；F193 effect-class 边界不回退。
- [ ] **AC-D2:** WorkspaceTabBar 自动化 web 回归：full / overflow / icon-only 三档、overflow click、active-in-overflow swap 全部有 vitest 覆盖。
- [ ] **AC-D3:** ApprovalPanel + ActivityBar 自动化 web 回归：bell → workspace approval、bell toggle close、fetchPending 刷新、loading/empty/error、inline/jump card rendering 有测试。
- [ ] **AC-D4:** Hub 筛选：支持 by feature、by thread、by stale/expired 的组合筛选；筛选是 UI projection，不改变 canonical stores。
- [ ] **AC-D5:** 批量操作：只对 `inlineApprovable=true` 且安全的项目开放 batch approve/reject；F128/F225 等需要上下文/override 的项目默认不可批量 approve，并给出明确 UI 状态。
- [ ] **AC-D6:** v2 adapter admission matrix：F231 profile update、F168 `direction-decision`、Knowledge Feed、Limb pair approval 逐项给出 actor / outcome / source store / inline fields / risk / first PR boundary。
- [ ] **AC-D7:** Materialized index gate：明确引入 CQRS index 的双阈值（adapter count 与实测 pending fetch latency），并记录为什么当前仍保持 query aggregation。

## Architecture

Phase D 继续沿用 Phase A 的 query aggregation：

```
ApprovalPanel filters/batch controls
  → useApprovalHubStore selectors/actions
  → current ApprovalItem DTO
  → GET /api/approval-hub/pending
  → registered adapters read canonical stores at request time
```

筛选是前端 projection。批量操作是对现有 per-item approve/reject action 的安全编排，第一版不新增 durable batch object，不新增 materialized index。

## Stateful Object Gate

| Object | Owner | Phase D rule | Test requirement |
|--------|-------|--------------|------------------|
| `ThreadProposal` | F128 canonical store | Hub 只能读取/跳转；没有 full override UI 时不可批量 approve | F128 item excluded from batch approve |
| `SessionHandoffProposal` | F225 canonical store | Hub 只能读取/跳转；不批量 settle | F225 item excluded from batch approve |
| `DispatchProposal` | F193/F246 adapter | `assign_work` 可 inline approve/reject；CAS/status invariant 不变 | batch approve/reject covers success + partial failure |
| `ApprovalItem` DTO | F246 approval-index | 新增 filter/batch affordance 不能破坏 sourceFeature allowlist | route/store tests preserve allowlist |
| `approvalHubStore` | F246 web | filter state is UI-only; deciding state remains per item | vitest covers selectors + deciding state |

## Task 1: AC-C8 Intercept Mirror Pruning

**Files to inspect first:**
- `packages/api/src/routes/callbacks.ts`
- `packages/api/test/approval-hub/effect-class-boundary.test.js`
- F193 callback/cross-post tests found by `rg "assign_work|effectClass|line-start|mention" packages/api/test packages/api/src`

**TDD:**
1. Add failing tests for content-only inline `@cat` in the body: it must not be routed as approval unless it is a legal line-start route or explicit structured target.
2. Add regression tests for valid `assign_work` with explicit target and valid line-start mention.
3. Add regression tests for `fyi` / `coordinate` / `investigate`: no ApprovalItem, no coding authorization.
4. Refactor duplicated mirror resolution into one target resolver used by the F193 intercept path.
5. Verify same-thread assignment and unknown target still fail closed.

**Commands:**

```bash
pnpm --filter @cat-cafe/api test -- approval-hub
pnpm --filter @cat-cafe/api test -- callbacks
```

## Task 2: WorkspaceTabBar Regression Tests

**Files:**
- `packages/web/src/components/workspace/WorkspaceTabBar.tsx`
- New or update: `packages/web/src/components/workspace/__tests__/WorkspaceTabBar.test.tsx`

**TDD:**
1. Mock `ResizeObserver` and assert wide width shows all seven labels without overflow.
2. Assert medium width shows visible tabs + overflow menu.
3. Assert narrow width uses icon-only buttons with accessible `title`/label support.
4. Click an overflow tab and assert `workspaceMode` changes and dropdown closes.
5. Set active tab into overflow and assert active-in-overflow swap keeps the active tab visible/marked.

**Commands:**

```bash
pnpm --filter @cat-cafe/web test -- WorkspaceTabBar
```

## Task 3: ApprovalPanel + ActivityBar Regression Tests

**Files:**
- `packages/web/src/components/ApprovalPanel.tsx`
- `packages/web/src/components/ActivityBar.tsx`
- `packages/web/src/components/ApprovalItemCard.tsx`
- `packages/web/src/stores/approvalHubStore.ts`

**TDD:**
1. Bell click from chat route opens workspace and sets `workspaceMode='approval'`.
2. Bell click while approval workspace is already open closes workspace.
3. Bell click calls `fetchPending` so badge/list refresh semantics from the old drawer are preserved.
4. ApprovalPanel renders loading, empty, error, and populated states.
5. F193 inline approve/reject buttons call approval actions; F128/F225 jump-only cards render as jump-only when required context is missing.

**Commands:**

```bash
pnpm --filter @cat-cafe/web test -- ApprovalPanel
pnpm --filter @cat-cafe/web test -- ActivityBar
```

## Task 4: Filters

**Files:**
- `packages/web/src/components/ApprovalPanel.tsx`
- `packages/web/src/stores/approvalHubStore.ts` or a local selector hook
- `packages/shared/src/types/approval-hub.ts` only if the DTO needs a typed display field already present in adapters

**Implementation:**
1. Add feature filter from the current item set (`F128`, `F193`, `F225`, future-safe allowlist).
2. Add thread filter/search by `sourceThreadId` or display thread title if already available.
3. Add stale/expired filter using existing `expiresAt` projection.
4. Keep filter state local/UI-only unless there is a measured need to persist it.

**Tests:**
- Filter combinations are deterministic.
- Empty filtered result uses a distinct empty-filter state, not the global empty inbox copy.

## Task 5: Batch Approve/Reject

**Files:**
- `packages/web/src/components/ApprovalPanel.tsx`
- `packages/web/src/components/ApprovalItemCard.tsx`
- `packages/web/src/stores/approvalHubStore.ts`
- API approval route tests only if a server batch endpoint is introduced

**Implementation:**
1. Derive selectable items from `inlineApprovable=true` plus feature-specific safety rules.
2. First implementation may client-loop existing per-item approve/reject endpoints; do not introduce a durable batch object unless partial failure semantics require it.
3. Show per-item progress/failed state for partial failure.
4. Exclude F128/F225 jump/context-required items from batch approve; allow batch reject only if the feature contract explicitly permits it.

**Tests:**
- Batch approve selects only safe inline items.
- Partial failure leaves failed items visible and settled items removed after refresh.
- Non-inline items are visibly excluded and cannot be accidentally selected.

## Task 6: v2 Adapter Admission Matrix

**Files:**
- `docs/features/F246-approval-hub.md`
- Optional per-feature follow-up plan docs if a candidate is accepted

**Matrix fields:**
- Feature / approval type
- Actor is CVO?
- Outcome is binary approve/reject?
- Cross-thread need?
- Canonical store and status lifecycle
- Inline minimum fields
- First PR boundary

**Candidates:**
- F231 `propose_profile_update`
- F168 `direction-decision` subcell only
- Knowledge Feed review item
- Limb pair approval

Phase D may implement the first low-risk candidate only if the matrix proves it is small. Otherwise Phase D ends with explicit follow-up PRs, not an unowned backlog sentence.

## Task 7: Materialized Index Gate

**Rule:**

Stay on query aggregation unless both are true:

1. Registered approval adapters exceed 5.
2. Alpha or production-like pending fetch p95 exceeds 250ms for a representative inbox, or a single adapter dominates fan-out cost in profiling.

If the rule triggers, open a separate index/backfill plan with:

- event-driven write path,
- restart/backfill contract,
- reconciliation job,
- phantom/stale item tests,
- rollback path to query aggregation.

## Quality Gate

Run targeted tests first, then normal gates:

```bash
pnpm --filter @cat-cafe/api test -- approval-hub
pnpm --filter @cat-cafe/web test -- WorkspaceTabBar
pnpm --filter @cat-cafe/web test -- ApprovalPanel
pnpm lint
pnpm check
pnpm -r --if-present run build
node scripts/check-hotfix-pattern.mjs
node scripts/check-architecture-ownership.mjs
```

Alpha validation after merge:

```bash
pnpm alpha:start
```

Smoke checklist:

- Bell opens workspace approval and toggles closed.
- Responsive tab bar still passes full / overflow / icon-only.
- Filters combine correctly.
- Batch approve/reject handles safe inline items only.
- F128/F225 context-required items remain jump-only.
