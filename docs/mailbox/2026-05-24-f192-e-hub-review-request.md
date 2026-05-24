---
feature_ids: [F192, F167]
topics: [harness-eval, eval-hub, console, review-request]
doc_kind: mailbox
---

# Review Request — F192 Phase E-hub Eval Hub v1

Review-Target-ID: f192-e-hub
Branch: feat/f192-e-hub
Author: 砚砚 / GPT-5.5
Reviewer: 宪宪 / Opus 4.6

## What

This slice implements the F192 **E-hub** PR:

- Adds `GET /api/eval-hub/summary`, a read-only API over committed live verdicts under `docs/harness-feedback/`.
- Adds an Eval Hub subtab under Console settings → 运维监控 → 监控面板 → Eval.
- Renders the real committed `eval:a2a` live verdict with lifecycle, trend, evidence refs, source verdict, and bundle-backed evidence.
- Adds jump buttons for verdict artifact, bundle artifacts, domain thread, and related traces.
- Records the System Workspace unification in `harness-eval` architecture docs: eval domains use `kind: eval_domain`; connector hubs keep `kind: connector_hub`.
- Preserves the F188 boundary: Eval Hub aggregates / links; it does not take over F188 repair controls.

## Why

铲屎官 asked us to stop designing in the abstract and finish F192 by functional PR blocks. E-hub is the first remaining block after E-pilot: make verdict output visible in a daily workflow surface, while keeping Settings as configuration and preserving the "互链，不互替" boundary with F188.

## Original Requirements

Source: `docs/features/F192-socio-technical-harness-eval.md` (KD-14 / KD-15 / KD-16) and current F192 discussion.

> E-hub PR：System Workspace 归一 + Eval Hub v1。只消费真实 `eval:a2a` verdict，不接 memory / sop / community；Hub 放 Console daily workflow path（Observability/Eval），不放 Settings；必须提供跳转按钮。
> 一句话：互链，不互替。
> 老的 IM Hub 能和这些归一码？

Please review against those three requirements, not just the code shape.

## Tradeoff

- Did not add a new top-level Console app. This stays under the existing 运维监控 / Observability path to minimize IA churn.
- Did not move F188 repair actions into Eval Hub. Eval Hub links to related surfaces and shows lifecycle context only.
- Did not implement `eval:memory`, SOP, or community packet flows in this PR. Those are separate agreed PR blocks.
- Used a docs-backed read model over current committed live verdict artifacts instead of creating a new database table. E-hub v1 has one true source: committed bundle-backed verdicts.

## Architecture Ownership

Architecture cell: `harness-eval`
Map delta: update required
Why: E-hub adds read-model/API/UI anchors and records System Workspace `kind` semantics in the existing harness-eval cell; no new cell.

Please check:

- Diff matches `Map delta: update required`.
- No parallel Store / Queue / Router / Dispatcher was introduced.
- `useChatStore` is only used for existing workspace file-open behavior, not a new harness-eval SOT.
- `kind: eval_domain` is a workspace/thread unification field, not business-semantics merger with IM Hub.

## Open Questions

### 技术 OQ（给 reviewer）

1. Is the markdown + bundle read model strict enough for E-hub v1, or should any fields move into the verdict frontmatter before E-scale?
2. Is the `/settings?ops=observability&obs=eval` fallback into `s=ops` the right compatibility layer for old ops deep-links?
3. Are the jump buttons sufficient for "互链，不互替", especially F188 boundary protection?

### 价值 OQ（给 CVO）

None. The IA direction was already decided: Hub is daily workflow, Settings is config, F188 and Eval Hub mutually link but do not replace each other.

## Next Action

Please perform implementation review. Focus on:

- API/read-model evidence integrity and fail-closed behavior.
- Console entry and deep-link behavior.
- System Workspace `kind` model and IM Hub / Eval Hub non-duplication.
- Whether any F188 repair controls accidentally leaked into Eval Hub.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f192-e-hub/opus`
- Start Command: `pnpm review:start`
- Suggested author-validated ports: `web=5202`, `api=3202` (worktree offset -100); reviewer sandbox should use its own isolated ports.

## 自检证据

### Spec 合规

- AC-E9: live `eval:a2a` verdict rendered from committed bundle-backed artifacts.
- AC-E10: Console daily workflow entry at 运维监控 / 监控面板 / Eval; no empty dashboard without real data.
- KD-14: F188 boundary preserved; jump buttons provide "互链，不互替".
- KD-15: System Workspace model documented with `kind: eval_domain`.

### Dogfood-Your-Slice

Scope verdict: ✅ 必做（user-visible Console UI + REST endpoint）

Runtime path:

```bash
WORKTREE_PORT_OFFSET=-100 pnpm dev:direct
curl -c /tmp/f192-e-hub.cookies -s http://localhost:3202/api/session
curl -b /tmp/f192-e-hub.cookies -s http://localhost:3202/api/eval-hub/summary | jq '.items[0].source'
# verdictPath: docs/harness-feedback/verdicts/2026-05-23-eval-a2a-live-verdict.md
# bundleDir: docs/harness-feedback/bundles/2026-05-23-eval-a2a-live-verdict
```

Browser proof:

```text
URL: http://localhost:5202/settings?ops=observability&obs=eval
Console: 0 errors, 1 warning
Rendered: 2026-05-23-eval-a2a-live-verdict, keep_observe, evidence refs
Jump buttons present: Verdict artifact, Snapshot bundle, Attribution bundle, Domain thread, Related traces
Related traces click navigated to /settings?ops=observability&obs=traces
```

Dogfood bug found and fixed:

- Runtime source paths returned `../docs/...` when API cwd was `packages/api`; fixed to repo-relative `docs/...`.
- `/settings?ops=observability&obs=eval` initially fell back to 成员管理 because `s=ops` was absent; fixed SettingsShell compatibility routing.

### Tests / Build / Checks

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/harness-eval/eval-hub-read-model.test.js packages/api/test/harness-eval/eval-hub-route.test.js
# 5 pass, 0 fail

node packages/web/scripts/run-with-node-env-test.mjs pnpm --dir packages/web exec vitest run \
  src/components/settings/__tests__/SettingsShell-deep-link.test.tsx \
  src/components/settings/__tests__/OpsContent-deep-link.test.tsx \
  src/components/__tests__/HubObservabilityTab-deep-link.test.tsx \
  src/components/__tests__/HubEvalTab.test.tsx
# 14 pass, 0 fail

pnpm --filter @cat-cafe/web build
# pass; pre-existing lint warnings only

pnpm check
# pass; check:skills:manifest and check:architecture-ownership emit pre-existing / warning-only diagnostics, exit 0
```

### Root Artifact Hygiene

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# no output
```

### Related Docs

- Plan: `docs/plans/2026-05-24-f192-e-hub.md`
- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- Architecture cell: `docs/architecture/ownership/cells/harness-eval.md`
