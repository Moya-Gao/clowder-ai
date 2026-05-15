---
type: review-request
date: 2026-05-15
feature: F201
author: codex
reviewers:
  - opus
  - opus-47
branch: feat/f201-antigravity-reliability
pr: "https://github.com/zts212653/cat-cafe/pull/1689"
status: reviewed
---

# Review Request: F201 Phase A — Antigravity Side-Effect Classification

Review-Target-ID: f201
Branch: feat/f201-antigravity-reliability

## What

Phase A adds the first reliability-contract layer for Antigravity:

1. New `classifyAntigravityStepEffect()` / `summarizeAntigravityStepEffects()` module for side-effect classification.
2. `CODE_ACTION`, unknown step types, unknown MCP tools, mutating shell commands, and image generation now fail closed for blind retry decisions.
3. Antigravity retry diagnostics now include `sideEffectSummary` for downstream journal/recovery work.
4. `CODE_ACTION` no longer falls into silent `unknown_activity`; it is surfaced as structured `system_info` activity metadata.
5. F201 spec now declares architecture ownership (`transport` + `bubble-pipeline`) required by the in-progress gate.
6. Three pre-existing web formatting nits were isolated in a separate formatter commit so `pnpm check` is green.

## Why

F201 is explicitly not a degradation path for Antigravity. This phase starts the reliability contract by making side-effect-capable steps visible to the retry gate and diagnostics, so a post-file-write stream/capacity failure cannot be blindly retried or hidden as an empty/unknown activity.

## Original Requirements（必填）

> "我要的是你给我一份完整的解决方案让人家可靠可用"
> "除了 f061 之外还有其他地方是 antigravity 的 feat 吗？都 close 了吗？"
> "写好方案找 46 和 47 两只布偶猫给你看"
> "走起201 wktree"

- 来源：当前 F201 thread（2026-05-15）+ `docs/features/F201-antigravity-reliability-contract.md`
- **请对照上面的摘录判断 Phase A 是否沿着“可靠可用、不降级”的方向推进**

## Tradeoff

- Unknown MCP/native tool shapes default to unsafe. This may suppress safe transient retries for some read-only Antigravity-native tools until we add explicit allowlist entries, but it prevents repeat side effects after write-like tools.
- `CODE_ACTION` is classified as `unknown_side_effect_capable` even when a path is present. Phase B journal can refine operation/idempotency, but Phase A deliberately blocks blind retry first.
- Formatter-only web changes are committed separately. They are not part of F201 behavior, but `pnpm check` required the formatting deltas in this worktree.

## Architecture Ownership（必填）

Architecture cell: `transport` + `bubble-pipeline`
Map delta: none
Why: F201 extends the existing Antigravity provider/retry/recovery contract and will render future recovery UI through the F183 bubble pipeline; it does not introduce a parallel Store/Queue/Router/Adapter/Dispatcher/Binding.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. Fail-closed policy: unknown native tools now block blind retry. Is this conservative enough without over-blocking F061's transient retry path?
2. `CODE_ACTION` is rendered as `tool_pending` with JSON `system_info` metadata. Is this acceptable for Phase A until typed recovery cards land in Phase E?
3. `sideEffectSummary.target` can include shell command / file path / tool name. Phase B journal will need redaction; any issue with putting this into diagnostics now?

### 价值 OQ（给 CVO，如有）

无。Phase A is reversible and technical; no product tradeoff needs CVO judgment beyond the already accepted F201 direction.

## Next Action

请 review:

1. Classifier correctness and fail-closed safety.
2. Retry gate integration: preserves F061 safe retry for read-only waiting `RUN_COMMAND`, but blocks after `CODE_ACTION` / unsafe side effects.
3. Transformer behavior: `CODE_ACTION` is no longer silent unknown activity.
4. Test coverage for CODE_ACTION, image dual classification, MCP read-only allowlist, unknown fail-closed behavior, and model_capacity retry suppression.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f201/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: review sandbox auto-assigns (3201+); no author-run dev server required for this backend/provider phase

## 自检证据

### Spec 合规

- F201 spec/plan approved by Opus 4.6 and Opus 4.7 before implementation.
- Phase A scope only: classifier + retry gate integration + CODE_ACTION activity visibility.
- Architecture ownership declared in `docs/features/F201-antigravity-reliability-contract.md`.
- Fallback diagnostic: no new per-file >=3 fallback layer after cleanup; residual warning is pre-existing ThreadSidebar cumulative total with net -1 from this branch.

### 测试结果

- `pnpm check` — pass; existing skills manifest advisories only.
- `NODE_ENV=development pnpm --dir packages/api build` — pass.
- F201 targeted tests — 72/72 pass:
  `antigravity-step-effects.test.js`, `antigravity-event-mapping.test.js`, `antigravity-agent-service-fatal-errors.test.js`.
- `pnpm --filter @cat-cafe/web build` — pass; existing hardcoded-color / hook warnings only.
- Earlier full regression on this branch: `NODE_ENV=development pnpm test` — pass, including API, MCP server 199/199, web 3066/3066.
- `git diff --check origin/main...HEAD` — pass.

### 相关文档

- Feature: `docs/features/F201-antigravity-reliability-contract.md`
- Plan: `docs/plans/2026-05-15-f201-antigravity-reliability-contract.md`

### 如果判断错了我最可能错在哪（pre-registered retraction conditions）

1. The read-only MCP allowlist may be too narrow and suppress harmless retries for future read-only tools.
2. `CODE_ACTION` activity metadata might need a dedicated bubble type earlier than Phase E if raw JSON `system_info` is too poor for users.
3. `target` in diagnostics may need redaction earlier than Phase B if it leaks sensitive shell/path data in normal error surfaces.
