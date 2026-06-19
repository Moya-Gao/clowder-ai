---
feature_ids: [F168]
topics: [phase-e, decision-queue, review, e-pr1]
doc_kind: mailbox
created: 2026-06-19
---

# Review Request: F168 Phase E — E-PR1 Backend Queue Contract

Review-Target-ID: f168-e-pr1
Branch: feat/f168-e-pr1

## What

E-PR1 implements the backend contract for Phase E Community Decision Queue:

- Adds pure `buildCommunityDecisionQueue()` selector in `packages/api/src/domains/community/community-decision-queue.ts`
- Adds `GET /api/community-decision-queue?repo=...` as a derived read route
- Adds finding lifecycle action endpoints:
  - `POST /api/community-findings/:id/acknowledge`
  - `POST /api/community-findings/:id/resolve`
  - `POST /api/community-findings/:id/waive`
- Adds RED/GREEN coverage for E1 selector invariants and E2 route adapter guards

Implementation commit: `91fb67da2`

## Why

Phase E should turn Phase A-D signals into an actionable queue without creating a second canonical store. This PR keeps Decision Queue as a rebuildable read model over existing board state, DirectionCard, closureChecklist, and Reconciler findings. State-changing actions still route back to existing canonical APIs or finding store methods through guarded route adapters.

## Original Requirements（必填）

> "把社区看板从'按状态翻列表'升级成'下一步该谁做什么'的可操作决策队列。"
> "CVO/owner 打开 CommunityPanel 后先看到排序后的处理队列。"
> "Phase E 不新增第二 canonical；Decision Queue 是可重建 read model。"

- 来源：`docs/plans/2026-06-19-f168-phase-e-decision-queue.md` Goal + Architecture
- 终态设计：`docs/discussions/2026-06-09-f168-community-ops-final-design.md` §2/§3/§8
- **请对照上面的摘录判断：E-PR1 是否给 E-PR2 前端提供了正确、稳定、不新增 canonical 的 backend contract**

## Tradeoff

- `findingStore` methods remain dumb persistence helpers. E2 status precondition guards live in the HTTP route adapter as plan-approved.
- Decision Queue is not persisted. This avoids stale cards and keeps Event Log/Object projection/Reconciler findings as the only canonical inputs.
- Route enrichment is fail-soft: projection-only issues/PRs and ObjectStore enrichment failures become warnings, not 500s. This keeps the queue usable when one optional read source is degraded.
- No frontend in this PR. E-PR2 consumes this contract in `CommunityPanel`.

## Architecture Ownership（必填）

Architecture cell: community-ops
Map delta: update required
Why: Adds a community-ops read-model selector and Fastify route adapter for Phase E; no new canonical store/cell.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- `DecisionQueue` 是否保持 read-model 属性，没有变成第二 canonical

## Open Questions

### 技术 OQ（给 reviewer）

1. **Fallback layer self-check**: `check-fallback-layers` flags selector display defaults and route enrichment `try/catch`.
   - My position: acceptable. Selector fallbacks are presentation defaults, not canonical state. Route catches protect optional read-model enrichment; removing them would make the queue brittle.
   - Please verify this is not masking a wrong coordinate system.
2. **Coalescing semantics**: same subject with closure blocker and SLA finding keeps the urgent SLA item. Please verify this matches INV-E1.5 rather than hiding distinct actor/action needs.
3. **Finding action guards**: route adapter returns 409 for invalid lifecycle transitions while store methods stay guard-less. Please verify tests cover the SO-E3 table adequately.

### 价值 OQ（给 CVO，如有）

无。CVO 已确认 Phase E 启动；本 PR implements the approved backend contract only.

## Next Action

请 @opus review E-PR1. 放行后我进入 merge-gate：push PR, local review provenance, then cloud review serially.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f168-e-pr1/opus`
- Start Command: `pnpm review:start`
- Ports: `review:start` 自动分配隔离端口（起点 3201/3202）

## 自检证据

### Spec 合规

- E1 selector covers all 5 queue kinds, including `external-followup`.
- E1 coalescing RED test added for closure blocker + SLA finding.
- E2 route adapter owns 409/400/501 guards; store methods remain dumb.
- No new canonical `DecisionQueueStore`.
- No frontend/UI diff in E-PR1.

### Fallback Layer Self-Check

`node scripts/check-fallback-layers.mjs` triggers on two files:

- `community-decision-queue.ts`: display/default fallbacks for optional title/narrative/projection fields.
- `community-issues.ts`: fail-soft `try/catch` around optional ObjectStore enrichment.

Self-check:

1. This repairs the intended coordinate system: read model over partial sources, not canonical writes.
2. The selector/route split already performs the main coordinate transform; further splitting would hide fallback lines, not simplify behavior.
3. Each layer protects user-facing queue availability when optional data is absent or degraded.

### 测试结果

```text
pnpm check
→ exit 0

pnpm --filter @cat-cafe/api lint
→ exit 0

pnpm -r --if-present run build
→ exit 0

Focused API regression:
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/community-decision-queue.test.js packages/api/test/community-decision-queue-routes.test.js packages/api/test/community-closure.test.js packages/api/test/community-closure-api.test.js packages/api/test/community-reconciler.test.js packages/api/test/community-reconciler-task-spec.test.js packages/api/test/community-sla-policy.test.js packages/api/test/community-issues-routes.test.js
→ 173 pass / 0 fail

Initial full pnpm test:
→ exposed existing recursive build-order issue: API tests imported packages/mcp-server/dist before mcp-server workspace build.

After full workspace build, failed-file复测:
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/agent-router.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js packages/api/test/antigravity-step-effects.test.js packages/api/test/codex-agent-service.test.js packages/api/test/dispatch-gate-schema.test.js
→ 257 pass / 0 fail

pnpm --filter @cat-cafe/web test
→ 497 files passed / 4345 tests passed
→ next.config: 5 pass / 0 fail
→ no-hardcoded-colors tests passed
```

### Dogfood-Your-Slice

Scope verdict: ✅ 必做（new REST read route + action route are user/cat-visible backend surfaces）

Path:

```text
Fastify inject:
GET /api/community-decision-queue?repo=acme/repo
POST /api/community-findings/finding-dogfood/acknowledge
```

Output:

```json
{
  "queueStatus": 200,
  "queueItems": [
    {
      "kind": "direction-decision",
      "priority": "high",
      "actor": "cvo",
      "subjectKey": "issue:acme/repo#42"
    }
  ],
  "warnings": [],
  "acknowledgeStatus": 200,
  "acknowledgedFindingStatus": "acknowledged"
}
```

### 设计稿对照

Glob matched existing F168 design assets:

- `designs/F168-community-ops-board.pen`

E-PR1 has no `packages/web` diff and no UI surface. Visual implementation is E-PR2, so this PR records the match but does not perform screenshot comparison.

### Artifact Hygiene

Root media/design artifact gate:

```text
git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
→ no output
```

### Tooling Friction

[爪感差: zsh + variable name] `status=$?` in a zsh wrapper collides with zsh's read-only `$status`. Use `rc=$?` in future log-tail wrappers.

[爪感差: Node stdin + --import setup helper] `node --import setup-cat-registry --input-type=module -` executed the dogfood route but exited with `ERR_INPUT_TYPE_NOT_ALLOWED` from setup helper side effects. The dogfood path does not need cat registry; rerun without `--import` exited 0.
