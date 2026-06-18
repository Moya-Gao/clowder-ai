---
doc_kind: review-request
created: 2026-06-18
feature_ids: [F168]
---

# Review Request: F168 Phase D D-PR1 — backend closure core (D0.2-D0.6 + D1 + D2)

Review-Target-ID: f168-d-pr1
Branch: feat/f168-d-pr1

## What

Backend closure core for F168 Phase D — 13 files changed, +1311/-8 lines:

1. **D0.2 Persistent narrator dedup**: Replaced NarratorDriver process-local `Set` with injected `NarratorDedupStore` interface + `RedisNarratorDedupStore` (persistent across restarts; in-memory fallback when Redis unavailable).
2. **D0.3 Narrator env warning**: Boot warning when narrator role configured but `COMMUNITY_NARRATOR_THREAD_ID` absent.
3. **D0.4 catId drift guard**: Test proves narrator binding catId must exist in cat template/catalog.
4. **D0.5 DirectionCard runtime schema**: Shared `parseRouteRecommendation` schema validator — API + web share one parser.
5. **D0.6 GuardianMatcher settlement**: Guard test proves guardian source is explicitly wired through RoleResolver roster injection.
6. **D1 Closure API**: `POST /report` and `/waive-closure` endpoints — append `case.reported` / `case.waived` events, fail visibly (501) when EventLog/Projector dependencies absent. State machine enforces closure invariant: fixed->closed requires either `lastPublicCommentAt` or `closureWaiver`.
7. **D2 Closure checklist**: `computeClosureChecklist` pure selector + board enrichment — `closureChecklist` field in all 4 enrichment points.

## Why

Phase D plan (砚砚 spec, `docs/plans/2026-06-17-f168-phase-d-closure-reconciler.md`) defines D-PR1 as backend closure core. The 64-issue unreplied backlog (2026-06-09 截图) is the burning pain — closure can't happen without report/waiver invariant enforcement and the checklist telling owners what's missing.

## Original Requirements

> "你们得想想得做管理的啊，不然上次这个任务派发给什么线程的猫，然后他们进度如何，是合入还是正在拉扯还是 issue 怎么样了"
> "比如说我可以点击跳转到 feat153 里面去看这个社区处理进度，毕竟猫猫跑在 thread 里！"

- 来源: `docs/features/F168-community-ops-board.md` lines 51-67
- Phase D 动机: closure 靠猫记性 -> 积压 64 条未回复 (CVO 签字 reopen 2026-06-10)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- D0.2 dedup store 用 Redis SET key-per-event 而非 sorted set。简单、O(1) lookup、no TTL by default。如果 event 量级变大可以加 TTL，但当前不加（plan 明确说"default TTL = none unless reviewed reason"）。
- D1 endpoints 选择 fail-visibly (501) 而非 best-effort silent failure。Plan P1#2 明确要求："unlike older best-effort dispatch paths, these endpoints must fail visibly."
- D2 checklist 是纯函数 selector 不是独立 store。Plan 明确 "do not add a second canonical closure store."

## Architecture Ownership

Architecture cell: community-ops
Map delta: none
Why: 扩展 community-ops 域内已有的 EventLog/Projector/state-machine 模式，新增 closure 行为。没有新增并行 Store/Queue/Router/Adapter/Dispatcher/Binding。NarratorDedupStore 是 NarratorDriver 的内部依赖注入，不是 cell 级新 store。

请 reviewer 检查:
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ (给 reviewer)
1. **NarratorDedupStore TTL**: Plan says "default TTL = none". Redis keys accumulate indefinitely. At current scale (~100 events/month) this is trivial. Reviewer: acceptable, or should we add a 90-day TTL safety net?
2. **Board enrichment coverage**: `closureChecklist` added to all 4 enrichment points (legacy issues, projection-only issues, tracked PRs, projection-only PRs). Reviewer: any enrichment path I missed?

### 价值 OQ (给 CVO)
无 — 所有决策在 plan 内，回滚成本 ≤1 commit。

## Next Action

请 review 代码质量 + 验收 acceptance matrix（plan §2.2 lines 244-257）的 10 项 AC。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f168-d-pr1/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 由 review:start 自动分配（起点 3201/3202）

## 自检证据

### Spec 合规
Plan §2.2 acceptance matrix 10 项 AC 全部有对应测试覆盖（详见下方测试清单）。

### 测试结果
```
pnpm --filter @cat-cafe/api test   → 40 tests, 40 pass, 0 fail
pnpm lint                          → 0 errors (warnings only, pre-existing)
pnpm check                         → 27/27 checks pass
pnpm -r --if-present run build     → exit 0 (API + Web clean)
```

### 新增测试清单 (44 new tests)
| AC | File | Count |
|---|---|---|
| D0.2 persistent dedup | community-narrator-driver.test.js | 4 |
| D0.3 env warning | community-narrator-driver.test.js | 2 |
| D0.4 catId drift | community-role-binding-guard.test.js | 3 |
| D0.5 schema parse | community-route-recommendation-schema.test.js | 10 |
| D0.6 GuardianMatcher | community-role-binding-guard.test.js | 2 |
| D1 state machine | community-closure.test.js | 9 |
| D1 API endpoints | community-closure-api.test.js | 7 |
| D2 checklist | community-closure.test.js | 7 |
| Existing narrator | community/narrator-driver.test.js | 7 (patched +dedupStore) |

### Dogfood-Your-Slice
Scope verdict: can-skip (理由: backend-only API + pure-function selectors, no user/cat-visible UX path yet — D-PR2/D-PR3 will add frontend + reconciler)

### Artifact Hygiene
Root artifacts (worktree + diff): none

### 相关文档
- Plan: `docs/plans/2026-06-17-f168-phase-d-closure-reconciler.md` (§2.2 D-PR1 packet)
- Feature: `docs/features/F168-community-ops-board.md`
- Phase D ownership: opus (接手自 fable-5, CVO 签字 2026-06-14/17)
