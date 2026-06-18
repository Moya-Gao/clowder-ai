---
doc_kind: plan
created: 2026-06-17
anchor: doc:plans/2026-06-17-f168-phase-d-closure-reconciler
topics: [f168, phase, closure, reconciler, sla]
---

# F168 Phase D — Closure UX + Reconciler Implementation Plan

**Feature:** F168 — `docs/features/F168-community-ops-board.md`
**Goal:** 把社区 case 的“修完、回报、关单、漂移对账、超时重浮”从猫猫记性升级为系统闭环，CVO/owner 只处理明确的收尾决策。
**Acceptance Criteria:** AC-D0 存量 narrator 风暴防护；AC-D1 closure action API；AC-D2 closureChecklist 投影与 board read model；AC-D3 GitHub⇄Case Reconciler；AC-D4 SLA/dead-letter 重浮；AC-D5 Closure UX；AC-D6 Phase D 前置技术债收敛。
**Architecture cell:** community-ops
**Map delta:** update required
**Map delta why:** community-ops cell 已声明 Reconciler 属于本 cell；Phase D 新增 reconciler task/finding store/closure UX anchors，需要扩展 code_anchors 与 cited_by。
**Architecture:** 复用 Phase A/B/C 的 Event Log + CommunityObject 投影 + RoleResolver，不新增第二 canonical。GitHub 保持外部 truth；Reconciler 只做 diff、补事实事件、产生可审计 finding。Closure UX 只消费投影和 findings，所有状态变更必须 append 事件后由 projector 推导。
**Tech Stack:** TypeScript, Fastify, Redis, existing community Event Log/ObjectStore, scheduler TaskSpec_P1, GitHub gh-api fetchers, React/Workspace CommunityPanel
**前端验证:** Yes — Closure UX / dead-letter queue / waive audit reviewer 必须用 Browser/Playwright 实测

---

## 0. Straight-Line Check（A→B，无绕路）

**Finish line（一句话 B）:** 当 PR/issue 进入 `fixed` 或 GitHub 状态漂移时，系统自动把“还差公开回复 / 是否允许 close / 是否需要 waive / 谁该处理 / 超时了没有”变成一条可见、可审计、可点击的收尾队列；任何 `fixed → closed` 都必须经 `reported` 或 `waived`，GitHub 与内部 Case 的不一致由 Reconciler 发现，不再靠某只猫记得。

**Terminal schema（终态数据结构，步骤围绕它建，非脚手架）:**

```typescript
// 1) Closure checklist is a projection, not a second source of truth.
interface CommunityClosureChecklist {
  publicReply: { status: 'missing' | 'present'; at: number | null; evidence: string | null };
  linkedWork: { status: 'missing' | 'present' | 'not-required'; evidence: string | null };
  ownerDecision: { status: 'missing' | 'accepted' | 'declined' | 'waived'; evidence: string | null };
  closeReason: { status: 'missing' | 'present' | 'waived'; evidence: string | null };
  readyToClose: boolean;
  blockers: readonly CommunityClosureBlocker[];
}

type CommunityClosureBlocker =
  | 'missing-public-reply'
  | 'missing-linked-work'
  | 'missing-owner-decision'
  | 'missing-close-reason'
  | 'fixed-not-reported'
  | 'github-case-drift';

// 2) Reconciler findings are operational read-model state. Event Log remains canonical.
interface CommunityReconciliationFinding {
  id: string; // stable hash(repo,type,number,kind)
  subjectKey: string;
  kind:
    | 'github-closed-case-open'
    | 'case-closed-github-open'
    | 'github-reopened-case-closed'
    | 'case-fixed-unreported'
    | 'stale-awaiting-external'
    | 'stale-needs-info';
  severity: 'needs-owner' | 'needs-human' | 'informational';
  status: 'open' | 'acknowledged' | 'resolved' | 'waived';
  firstSeenAt: number;
  lastSeenAt: number;
  evidence: Record<string, unknown>;
}

// 3) Existing event kinds stay first-class.
// case.reported  => public reply evidence, sets lastPublicCommentAt
// case.waived    => waiver evidence, does not change state
// issue.closed / issue.reopened / pr.merged / pr.closed => external GitHub facts
```

**NOT building（防 scope 膨胀）:**
- ❌ 不自动关闭 GitHub issue/PR。GitHub close 是外部副作用，Phase D 只做 guard、draft/evidence、CVO/owner 决策入口。
- ❌ 不重建 Event Log / Projector / RoleResolver / DirectionCard。
- ❌ 不把 Reconciler finding 当案件 canonical。案件状态仍只来自 Event Log → projector。
- ❌ 不做 Phase E 的全量 CVO Decision Packet 队列。Phase D 可以暴露 dead-letter/closure 队列，但不重做全看板信息架构。
- ❌ 不改 SOP/merge-gate 那条猫猫协作链。F168 管社区事务，不是通用 A2A harness。

**Phase D prerequisites（来自 Phase C close，必须先收口）:**
- **P1 D0.1:** C0.4 narrator 排除存量。自动路径不得对 453 条 `case.bootstrap` 存量批量 spawn narrator。
- **P2 D0.2-D0.6:** INV-3 dedup 持久化、`COMMUNITY_NARRATOR_THREAD_ID` env warn、catId drift 检测、DirectionCard 类型桥 zod runtime parse、GuardianMatcher OQ-C1a 收敛。

---

## 1. Stateful Object Gate — Census（先普查，后拆步骤）

| # | 对象 | lifecycle owner | 新增/既有 |
|---|------|-----------------|----------|
| SO-D0 | narrator eligibility gate（存量排除） | community dispatch / future auto-reconciler caller | 新增 |
| SO-D1 | closure action event (`case.reported` / `case.waived`) | Event Log + state machine | 既有事件，补 API/UX |
| SO-D2 | closureChecklist | CommunityObject projection selector | 新增 projection/read model |
| SO-D3 | Reconciler run cursor / baseline | scheduler TaskSpec + Redis | 新增 |
| SO-D4 | ReconciliationFinding | Redis operational store + board read model | 新增 |
| SO-D5 | SLA/dead-letter finding | derived from projection + thresholds | 新增 |
| SO-D6 | Closure UX controls | CommunityPanel client state | 新增 |

### SO-D0 narrator eligibility gate — 三件套

**状态×事件转移表:**

| Case origin / event | manual dispatch | auto reconciler / cron dispatch |
|---|---|---|
| fresh non-bootstrap case | allowed | allowed |
| `case.bootstrap` with no post-bootstrap external activity | allowed only when user explicitly clicks | blocked (`legacy-bootstrap`) |
| bootstrap case with `lastExternalActivityAt > bootstrapAt` | allowed | allowed |

**不变量:**
- **INV-D0.1:** 自动路径不得对纯 bootstrap 存量 spawn narrator。可测：projection created by `case.bootstrap` with no newer external activity → auto eligibility false。
- **INV-D0.2:** 手动 dispatch 仍可处理存量。可测：same case with source=`manual` → eligibility true。
- **INV-D0.3:** 新外部活动解冻存量。可测：bootstrap case + later `issue.commented` by external actor → auto eligibility true。

**对抗场景:** Phase D Reconciler 首跑扫描 453 条历史 case；应 baseline/find findings，不批量 wake narrator。

### SO-D1 closure action event — 三件套

**状态×事件转移表:**

| Current | `case.reported` | `case.waived` | `issue.closed` |
|---|---|---|---|
| `fixed` | → `reported` + `lastPublicCommentAt` | state unchanged + waiver evidence | blocked unless reported/waived |
| `reported` | idempotent update evidence | state unchanged + waiver evidence | → `closed` |
| `closed` | no-op / rejected by API | no-op / rejected by API | idempotent |

**不变量:**
- **INV-D1.1:** `fixed → closed` 仍只由 existing state machine guard 判定，不在 route handler 里复制规则。
- **INV-D1.2:** `case.reported` payload 必须有 public evidence（comment URL / comment id / explanation）。可测：missing evidence → 400，不 append。
- **INV-D1.3:** `case.waived` payload 必须有 reason + actor + evidence，复用 state-machine payload validation。可测：missing field → 400 / rejected event not state-changing。
- **INV-D1.4:** closure API append 后必须 projector.apply；apply 失败不得假装成功。这里是用户可见状态变更，不走 silent best-effort。

**对抗场景:** duplicate report click、waive 后 GitHub close、close before report、malformed waiver。

### SO-D2 closureChecklist — 三件套

**生命周期 owner:** projection selector（pure read model）。可先在 `community-closure-checklist.ts` 从 projection + linked facts 推导，不独立存储。

**不变量:**
- **INV-D2.1:** checklist 是纯派生值，不能写入独立 canonical store。
- **INV-D2.2:** `readyToClose=true` iff blockers empty OR waiver present。
- **INV-D2.3:** board API 对 legacy/projection-only items 都返回 checklist，字段缺失时 fail-soft 为 blockers，不 fail-open。

**对抗场景:** projection-only issue、linked PR missing、old bootstrap closed issue、waiver evidence malformed。

### SO-D3 Reconciler run cursor / baseline — 三件套

**状态×事件转移表:**

| State | first run | regular run | crash after findings | crash after event append |
|---|---|---|---|---|
| no baseline | mark baseline, no storm | — | retry baseline | retry baseline |
| baseline ready | diff GitHub⇄Case | update findings + append missing facts | idempotent findings | Event Log dedup by sourceEventId |

**不变量:**
- **INV-D3.1:** 首跑只 baseline，不把历史 GitHub drift 全部变成 wake storm。
- **INV-D3.2:** 对真实 GitHub 事实缺口，append stable sourceEventId（例如 `reconciler:{subjectKey}:{kind}:{githubUpdatedAt}`）进 Event Log。
- **INV-D3.3:** Reconciler 不直接改 CommunityObjectStore；只能 append event + projector.apply。
- **INV-D3.4:** GitHub fetch failure 不清空 existing findings；只记录 run warning。

**对抗场景:** GitHub closed but case open、case closed but GitHub open、GitHub reopened after internal close、linked PR merged event missing、API pagination partial failure。

### SO-D4 ReconciliationFinding — 三件套

**状态×事件转移表:**

| State | finding seen | finding absent | user acknowledges | user waives |
|---|---|---|---|---|
| none | → open | — | — | — |
| open | update lastSeenAt | → resolved | → acknowledged | → waived |
| acknowledged | update lastSeenAt | → resolved | idempotent | → waived |
| waived | no reopen unless evidence changes | stays waived | idempotent | idempotent |

**不变量:**
- **INV-D4.1:** finding id stable；same gap does not create duplicate cards。
- **INV-D4.2:** waived finding requires reason + actor + evidence。
- **INV-D4.3:** resolved finding remains queryable for audit, not deleted.

**对抗场景:** flap open/resolved/open、waive then evidence changes、parallel reconciler runs。

### SO-D5 SLA/dead-letter finding — 三件套

**不变量:**
- **INV-D5.1:** `fixed` older than threshold and no `lastPublicCommentAt` / waiver → `case-fixed-unreported` finding。
- **INV-D5.2:** `awaiting_external` older than threshold with no external activity → `stale-awaiting-external` finding, severity informational/needs-owner per policy。
- **INV-D5.3:** thresholds are tenant policy config, not hardcoded to clowder-ai。

### SO-D6 Closure UX controls — 三件套

**不变量:**
- **INV-D6.1:** Close action disabled until checklist ready or waiver exists。
- **INV-D6.2:** Waive action always opens audit form; no one-click waive。
- **INV-D6.3:** UI must show evidence source (public comment, waiver, reconciler finding) rather than only a green/red badge。
- **INV-D6.4:** Frontend uses SVG icons only, no emoji（F168 KD-9）。

---

## 2. Component 总览

| Component | 交付 | 依赖 | AC |
|---|---|---|---|
| **D0** prerequisites | narrator eligibility gate + 5 个 Phase C P2 收敛 | Phase C closed | AC-D0 |
| **D1** closure actions | `report` / `waive` API + event append + projector apply | Event Log/state machine existing events | AC-D1 |
| **D2** checklist read model | pure closureChecklist selector + board API fields | D1 types | AC-D2 |
| **D3** Reconciler | GitHub⇄Case diff task + finding store + missing fact append | D2 projections | AC-D3 |
| **D4** SLA/dead-letter | thresholds + findings + board group | D3 finding store | AC-D4 |
| **D5** Closure UX | board cards, report/waive controls, finding queue | D1-D4 API | AC-D5 |
| **D6** docs/skill sync | community-ops generic closure guidance + feature doc close prep | D0-D5 | AC-D6 |

### 2.1 PR Granularity Guard（防碎 PR）

Phase D 的 `D0-D6` 是交付切面，不是 PR 切分键。默认不允许按编号机械拆成 6 个 PR。

**已完成 / 不再拆：**
- PR #2369: D0.1 narrator eligibility gate ✅（P1 prerequisite，已 squash merge）

**后续 PR 上限：最多 3 个；目标 2 个。**

| PR | 默认包含 | 为什么能合 | 拆分条件 |
|---|---|---|---|
| D-PR1 backend closure core | D0.2-D0.6 + D1 + D2 | 都是 closure invariant/read-model 前置，围绕 Event Log → projector → board API 一条链路 | 只有 D0.2-D0.6 触发独立架构变更、需要先 merge unblock 时才拆 |
| D-PR2 reconciler + SLA | D3 + D4 | Reconciler finding store、baseline、SLA/dead-letter 是同一个 operational loop | 只有 GitHub fetch SPIKE 证明需要外部依赖/CVO 决策时才先提交 SPIKE note |
| D-PR3 UX + closure docs | D5 + D6 | UX 消费 D-PR1/D-PR2 API，docs/skill sync 跟最终用户面一起验收 | 设计 gate 未获 CVO approval 时，D6 可随 D-PR2 先同步 |

**禁止：** `D1`、`D2`、`D3`、`D4`、`D5` 各自开独立 PR，除非上表拆分条件命中并在 PR body 写明证据。Cloud review 修复 commits 不算新 PR。

### 2.2 D-PR1 Implementation-Ready Packet

**Entry state:** start from `origin/main` after PR #2369. D0.1 is complete; do not reopen the old `cat-cafe-f168-c1` worktree.

**D-PR1 scope:**
- D0.2-D0.6 prerequisite closure:
  - replace `NarratorDriver` process-local `Set` dedup with an injected persistent dedup store; default TTL = none unless an explicit reviewed reason says otherwise.
  - emit boot warning when narrator role is configured but `COMMUNITY_NARRATOR_THREAD_ID` is absent.
  - add catId drift guard for `DEFAULT_COMMUNITY_ROLE_BINDINGS` vs cat template/catalog truth.
  - move DirectionCard route schema to a shared/runtime parse seam so API + web do not maintain divergent routeRecommendation shapes.
  - settle GuardianMatcher OQ-C1a by routing through RoleResolver, or keep a deliberately allowlisted TODO with a guard test.
- D1 closure API:
  - add `POST /api/community-issues/:id/report`.
  - add `POST /api/community-issues/:id/waive-closure`.
  - both endpoints append a `CommunityEvent` first, then apply projector synchronously.
  - unlike older best-effort dispatch paths, these endpoints must fail visibly if required Event Log / Projector dependencies are absent or projector apply fails.
- D2 closure checklist:
  - add a pure `community-closure-checklist` selector.
  - enrich board issue/PR items, including projection-only items, with `closureChecklist`.
  - do not add a second canonical closure store.

**D-PR1 acceptance matrix:**

| AC | Required proof |
|---|---|
| D0.2 persistent narrator dedup | two `NarratorDriver` instances sharing the injected store do not double-spawn the same `(subjectKey, sourceEventId)` |
| D0.3 narrator env warning | boot/index wiring test or focused config test proves missing `COMMUNITY_NARRATOR_THREAD_ID` logs a warning instead of silent no-op |
| D0.4 catId drift guard | test fails when `DEFAULT_COMMUNITY_ROLE_BINDINGS.narrator.catId` is absent/unavailable in cat template/catalog truth |
| D0.5 DirectionCard runtime schema | malformed routeRecommendation from API/fixture is rejected or safely ignored by shared parser; web does not trust raw unknown shape |
| D0.6 GuardianMatcher settlement | guard proves route guardian source is explicit: RoleResolver path or a narrow allowlist with Phase D TODO |
| D1 report action | fixed case + valid public evidence appends `case.reported`, projector sets `lastPublicCommentAt`, state becomes `reported` |
| D1 waiver action | valid reason/actor/evidence appends `case.waived`, state remains unchanged, `closureWaiver` is stored |
| D1 close guard | `issue.closed` from `fixed` still rejects without report/waiver and closes after report or waiver |
| D2 checklist selector | fixed without report/waiver yields `fixed-not-reported`, reported/waived yields `readyToClose=true` when no other blocker exists |
| D2 board enrichment | legacy and projection-only board items both include `closureChecklist`; missing fields fail closed as blockers |

**Out of scope for D-PR1:** GitHub fetch/reconciler TaskSpec, finding store, SLA/dead-letter queue, frontend closure UX controls, GitHub comment/close side effects.

**Hard split trigger:** if the persistent narrator dedup store requires a new shared infrastructure abstraction or cross-cell migration, split only D0.2-D0.6 as a prerequisite PR and keep D1+D2 together. Otherwise D0.2-D2 ships as one backend closure-core PR.

### 2.3 D-PR2 Implementation-Ready Packet

**Entry state:** start from `origin/main` after D-PR1 (PR #2375). D-PR2 owns D3 + D4 only: Reconciler, reconciliation finding store/read model, and SLA/dead-letter findings.

**D-PR2 scope:**
- D3 GitHub⇄Case Reconciler:
  - add a pure `CommunityReconciler` core that reads existing `CommunityObjectProjection` snapshots and injected GitHub subject snapshots, then emits deterministic actions.
  - add a Redis-backed `CommunityReconciliationFindingStore` with no TTL. Findings are operational read-model state, not canonical case state.
  - add a `CommunityReconcilerTaskSpec` registered via GitHub schedule factories, redis-gated like repo-scan / repo-comment-poll.
  - append objective missing GitHub facts (`issue.closed`, `issue.reopened`, `pr.merged`, `pr.closed`) to Event Log with stable `sourceEventId`, then call `projector.apply` only for newly appended events.
  - never call GitHub mutation APIs and never write `CommunityObjectStore` directly.
- D4 SLA / dead-letter:
  - add `community-sla-policy.ts` with tenant-policy defaults and dependency-injected overrides.
  - produce SLA findings for `case-fixed-unreported`, `stale-awaiting-external`, and `stale-needs-info`.
  - expose findings through a backend read model (top-level community board field or focused read route); frontend rendering waits for D-PR3.

**GitHub fetch shape decision:** D-PR2 may start with a <=45 minute SPIKE inside the same branch, but not a separate PR. Default implementation should use injected fetch functions and production `gh api` wrappers for known subjects from `objectStore.listSubjectKeys()`; do not introduce a new GitHub client dependency. Full repo discovery/backfill is out of scope because repo-scan/repo-comment-poll already own intake discovery.

**SLA default policy:** use conservative code defaults plus config/dependency override:
- `fixedUnreportedAfterMs`: 7 days.
- `awaitingExternalStaleAfterMs`: 14 days.
- `needsInfoStaleAfterMs`: 14 days.
- Defaults must be repo-agnostic and cat-agnostic. Tests must prove overrides work. Exact thresholds remain tunable after alpha observation without changing Reconciler semantics.

**D-PR2 acceptance matrix:**

| AC | Required proof |
|---|---|
| D3.1 first-run baseline | first run over existing projections marks baseline and creates no events/findings/wakes |
| D3.2 stable sourceEventId | same missing GitHub fact on repeated runs appends at most one CommunityEvent and does not duplicate projector side effects |
| D3.3 no direct ObjectStore write | tests inject a throwing objectStore `save`/write path or static guard proves Reconciler only uses Event Log + projector for state changes |
| D3.4 fetch failure safety | GitHub fetch failure records a run warning and does not clear or resolve existing findings |
| D3.5 objective closure fact | GitHub closed/merged while case open appends the matching event and opens/updates `github-closed-case-open` if projection remains inconsistent |
| D3.6 internal/external drift | case closed while GitHub is open opens/updates `case-closed-github-open` without appending a fake GitHub event |
| D3.7 reopen drift | GitHub reopened after internal closed appends `issue.reopened` when applicable and opens/updates `github-reopened-case-closed` |
| D4.1 finding lifecycle | same finding id is stable; open/acknowledged resolves when absent; resolved remains queryable; waived does not reopen unless evidence fingerprint changes |
| D4.2 waiver audit | waived finding requires reason + actor + evidence; malformed waiver is rejected |
| D4.3 fixed unreported SLA | `fixed` older than `fixedUnreportedAfterMs` with no report/waiver creates `case-fixed-unreported` |
| D4.4 stale awaiting external | `awaiting_external` older than policy and no newer external activity creates `stale-awaiting-external` |
| D4.5 stale needs info | `needs_info` older than policy creates `stale-needs-info` |
| D4.6 policy override | custom tenant policy changes thresholds without repo/cat hardcoding |
| Wiring | GitHub schedule factory registers the reconciler spec and fails loudly when redis-gated deps are missing |
| Read model | community board or focused read route returns open/acknowledged/waived/resolved findings needed by D-PR3 UX |

**D-PR2 gate checklist:**
- RED/GREEN focused tests for `CommunityReconciler`, `CommunityReconciliationFindingStore`, `community-sla-policy`, and schedule factory wiring.
- Redis store tests must run on 6398 / isolated Redis only; never touch 6399.
- Deterministic dry-run fixture: simulate a first run with many legacy projections and assert baseline/no storm. No live GitHub call is required for merge gate.
- `pnpm build`.
- `pnpm --filter @cat-cafe/api test -- community-reconciler community-reconciliation-finding community-sla github-schedule-factories` or exact focused equivalents.
- `pnpm gate` before PR.

**Out of scope for D-PR2:** Closure UX controls, design mock, frontend components, GitHub comment/close side effects, full Phase E decision queue.

---

## 3. Implementation Tasks

### D0.0 — Phase D ownership + architecture map update

**Files:**
- Modify: `docs/features/F168-community-ops-board.md`
- Modify: `docs/architecture/ownership/cells/community-ops.md`
- Run: `node docs/architecture/ownership/generate-readme.mjs`

**Step 1:** Update F168分工：Phase D/E 由 @codex 主导 spec/AC/gate，implementation/review 跨个体。
**Step 2:** Add upcoming Reconciler/finding/checklist anchors to community-ops cell.
**Step 3:** Regenerate ownership README.
**Step 4:** Commit docs.

### D0.1 — Narrator eligibility gate（P1 prerequisite）

**Files:**
- Create: `packages/api/src/domains/community/community-narrator-eligibility.ts`
- Modify: `packages/api/src/routes/community-issues.ts` dispatch handler
- Test: `packages/api/test/community-narrator-eligibility.test.js`
- Test: `packages/api/test/community-issues-routes.test.js`

**Step 1（RED）:** unit tests:
- bootstrap projection with no post-bootstrap external activity + source=`auto` → false
- same projection + source=`manual` → true
- bootstrap projection + later external activity → true
- non-bootstrap fresh case → true

**Step 2（GREEN）:** Implement pure helper:

```typescript
export type NarratorTriggerSource = 'manual' | 'auto-reconciler';
export function shouldSpawnNarratorForCase(input: {
  triggerSource: NarratorTriggerSource;
  projection: Pick<CommunityObjectProjection, 'createdAt' | 'lastExternalActivityAt'> | null;
  bootstrapAt: number | null;
}): { ok: true } | { ok: false; reason: 'legacy-bootstrap' };
```

**Step 3:** Wire manual dispatch as source=`manual`; future Reconciler caller must pass source=`auto-reconciler`.
**Step 4:** Commit.

### D0.2-D0.6 — Phase C P2 follow-up sweep

**Files / checks:**
- INV-3 dedup: `NarratorDriver.ts` + Redis-backed dedup store or explicit Phase D Reconciler ownership test.
- Env warn: `index.ts` boot path emits warning when narrator role configured but `COMMUNITY_NARRATOR_THREAD_ID` absent.
- catId drift: guard test compares `cat-template.json` variants vs `DEFAULT_COMMUNITY_ROLE_BINDINGS`.
- Type bridge zod: `packages/web/src/components/DirectionCard.tsx` or `packages/web/src/lib/community-direction-card-schema.ts`.
- GuardianMatcher OQ-C1a: route guardian `getRoster()` through RoleResolver or leave explicit TODO + guard allowlist test.

**Step 1:** Write one focused RED per follow-up; no drive-by refactor.
**Step 2:** Green each; keep inside D-PR1 by default. Only split if a hard boundary from §2.1 is hit, and document the evidence in the PR body.

### D1 — Closure action API (`reported` / `waived`)

**Files:**
- Modify: `packages/shared/src/types/community-event.ts` (payload helper types only if needed)
- Modify: `packages/api/src/routes/community-issues.ts`
- Test: `packages/api/test/community-issues-closure.test.js`
- Test: `packages/api/test/community-state-machine.test.js`
- Test: `packages/api/test/redis-community-event-log.test.js`

**Step 1（RED）:** `POST /api/community-issues/:id/report` on fixed case appends `case.reported`, projector sets `lastPublicCommentAt`, state becomes `reported`.
**Step 2（RED）:** `POST /api/community-issues/:id/waive-closure` requires reason/actor/evidence, appends `case.waived`, projector stores waiver without state change.
**Step 3（RED）:** `issue.closed` from fixed without reported/waiver rejected with `lastRejectedEvent.reason=closure_invariant`; after reported or waived, it closes.
**Step 4（GREEN）:** Add endpoints; validate payload with zod; append event and apply projector synchronously.
**Step 5:** Commit.

### D2 — Closure checklist selector + board API

**Files:**
- Create: `packages/api/src/domains/community/community-closure-checklist.ts`
- Modify: `packages/shared/src/types/community-event.ts` or create `packages/shared/src/types/community-closure.ts`
- Modify: `packages/api/src/routes/community-issues.ts` board enrichment
- Test: `packages/api/test/community-closure-checklist.test.js`
- Test: `packages/api/test/community-issues-routes.test.js`

**Step 1（RED）:** fixed no report → blockers include `fixed-not-reported`, ready false.
**Step 2（RED）:** reported fixed → publicReply present, ready true unless other blockers exist.
**Step 3（RED）:** waiver present → ready true with audit evidence.
**Step 4（GREEN）:** Implement pure selector and include `closureChecklist` in board issue/pr items.
**Step 5:** Commit.

### D3 — Reconciler SPIKE + TaskSpec

**Files:**
- Create: `packages/api/src/domains/community/CommunityReconciler.ts`
- Create: `packages/api/src/domains/community/CommunityReconciliationFindingStore.ts`
- Create: `packages/api/src/infrastructure/connectors/github-repo-event/CommunityReconcilerTaskSpec.ts`
- Modify: `packages/api/src/infrastructure/connectors/github-repo-event/types.ts` if fetch types needed
- Modify: schedule factory / plugin manifest wiring for new optional resource
- Test: `packages/api/test/community-reconciler.test.js`
- Test: `packages/api/test/github-schedule-factories.test.js`
- Test: Redis store test for finding lifecycle

**Step 1（SPIKE ≤45min）:** Decide fetch shape:
- Reuse gh CLI fetchers vs GitHubIssueFetcher/GitHubPrFetcher extension.
- Decide exact finding kinds for Phase D MVP.
- Output one paragraph in this plan or follow-up notes before coding.

**Step 2（RED）:** `github closed + case open` → finding open + append `issue.closed` if source event missing.
**Step 3（RED）:** `case closed + github open` → finding open, no direct state rewrite.
**Step 4（RED）:** first run baseline on existing repo → no wake storm, cursor/baseline marked.
**Step 5（GREEN）:** Implement pure reconciler first, then TaskSpec wrapper.
**Step 6:** Wire optional schedule resource with redis-gated pending behavior like repo-scan/repo-comment-poll.
**Step 7:** Commit.

### D4 — SLA / dead-letter queue

**Files:**
- Create: `packages/api/src/domains/community/community-sla-policy.ts`
- Modify: `CommunityReconciler.ts`
- Modify: board API response types
- Test: `packages/api/test/community-sla-policy.test.js`
- Test: `packages/api/test/community-reconciler.test.js`

**Step 1（RED）:** fixed older than threshold, no report/waiver → `case-fixed-unreported`.
**Step 2（RED）:** awaiting_external older than threshold, no new external activity → stale finding.
**Step 3（GREEN）:** Add tenant-policy thresholds with defaults; no hardcoded repo/cat names.
**Step 4:** Commit.

### D5 — Closure UX / dead-letter UI

**Design Gate:** Must create/update design mockup first and get CVO approval before code. Use existing `docs/designs/F168-c3.2-direction-card-routing.html` style as visual baseline; no emoji, SVG icons only.

**Files:**
- Create: `docs/designs/F168-phase-d-closure-reconciler.html`
- Modify: `packages/web/src/components/CommunityPanel.tsx`
- Create: `packages/web/src/components/community/ClosureChecklistCard.tsx`
- Create: `packages/web/src/components/community/ReconciliationFindingCard.tsx`
- Test: `packages/web/src/components/__tests__/community-closure-ux.test.tsx`
- E2E: Browser/Playwright screenshot after local dev server

**Step 1:** Design mock with:
- fixed case needing report
- waiver form
- reconciler drift finding
- dead-letter queue

**Step 2（RED）:** component tests assert disabled close until checklist ready; waive requires reason/evidence; finding status visible.
**Step 3（GREEN）:** Implement components and integrate into CommunityPanel.
**Step 4:** Browser verify desktop + narrow viewport; ensure no overlapping text.
**Step 5:** Commit.

### D6 — Skill / docs sync

**Files:**
- Modify: `docs/features/F168-community-ops-board.md`
- Modify: generic `community-ops` skill if/when it exists; otherwise add follow-up note for skill split from final design §6.
- Modify: `docs/architecture/ownership/cells/community-ops.md`

**Step 1:** Feature doc timeline after each PR.
**Step 2:** Phase D close only after non-author/non-reviewer vision guard.
**Step 3:** Capture any new harness lesson (especially stale dist / Reconciler baseline) in lessons if triggered.

---

## 4. Verification Matrix

| Gate | Command / Evidence | Expected |
|---|---|---|
| Shared/API build | `pnpm build` | exit 0 |
| Community tests | `pnpm --filter @cat-cafe/api test -- community` or focused node tests | D0-D4 pass |
| Redis stores | isolated Redis test script for finding store | no 6399 |
| Web build | `pnpm --filter @cat-cafe/web build` | exit 0 |
| Frontend UX | Browser/Playwright screenshots | closure/dead-letter cards render, no overlap |
| Full check | `pnpm check` | pass or scoped pre-existing waiver with proof |
| Merge gate | `pnpm gate` | pass or documented unrelated main failure |

**Dist artifact rule:** Any test importing `../dist/...` must run after clean rebuild (`trash packages/api/dist packages/shared/dist && pnpm build`) or use source imports. This is a Phase C close lesson and a Phase D review precondition.

---

## 5. Open Questions

### 技术 OQ（实现时自决）

- **OQ-D3a:** Reconciler findings storage shape: dedicated Redis store vs projection-derived transient list. Default: Redis operational store because findings need acknowledge/waive audit, but not canonical case state.
- **OQ-D3b:** Whether Reconciler appends missing GitHub facts immediately or only raises findings for owner confirmation. Default: append objective GitHub facts (`issue.closed`, `issue.reopened`, `pr.merged`, `pr.closed`) with stable sourceEventId; raise findings for policy conflicts (`case closed but GitHub open`).
- **OQ-D5a:** Whether Closure UX belongs inside CommunityPanel sections or a separate tab. Default: inside CommunityPanel as a new “收尾/死信” section; Phase E may reorganize into Decision Queue.

### 价值 OQ（需要 CVO 时才升级）

- **OQ-V-D1:** Should Phase D ever perform actual GitHub close/comment side effects? Default for this plan: **no** automatic GitHub mutation; record evidence/drafts and require owner/CVO explicit action. If implementation needs auto-close, bring Decision Packet with rollback and abuse-risk analysis.
- **OQ-V-D2:** SLA threshold defaults. Default: config-driven with conservative defaults; exact hours/days can be adjusted after alpha observation, not hardcoded into engine.

---

## 6. Review / Handoff Policy

- @codex owns Phase D/E spec, AC, failure-mode audit, and gate criteria.
- Implementation can be @opus or @codex, but **same individual must not review own code**.
- Security-sensitive or GitHub-mutating changes require cross-family review and explicit CVO signoff.
- Reconciler / SLA / closure guard findings must include Red→Green tests; no “下次一定” backlog for P1/P2.
