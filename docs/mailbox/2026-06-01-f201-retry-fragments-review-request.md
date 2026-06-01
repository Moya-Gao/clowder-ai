---
doc_kind: review-request
feature_ids: [F201, F211]
topics: [antigravity, session-chain, retry-fragments, runtime-session]
author: codex
reviewer: opus48
created: 2026-06-01
---

# Review Request: F201 Antigravity Retry Fragments

Review-Target-ID: f201
Branch: feat/f201-retry-fragments

## What

Implements the F201 retry-fragment lifecycle decision for Antigravity automatic retries:

- Every Antigravity cascade still creates and keeps a formal auditable `SessionRecord`.
- Failed zero-message automatic retry attempts are explicitly marked in `RuntimeSessionMetadata.lifecycle.retryFragment`.
- `/api/session-chain/:threadId` exposes the retry-fragment marker in runtime sidecar summaries.
- `SessionChainPanel` folds explicit runtime-tagged retry fragments, while preserving the legacy `tool_conflict` fallback for already-existing data.
- Successful fresh cascades are not tagged as fragments.
- F201 docs now record the post-close hardening decision.

## Why

The live F201/F211 batch showed automatic retry attempts with zero messages being surfaced as independent full sessions. Suppressing session creation would lose audit. Pure UI heuristics would keep the root ambiguity. The chosen shape keeps the audit trail but gives the session surface a durable signal for folding.

## Original Requirements

> F201 下一步要做：读 retry/seal/session 生命周期，决定这些 retry fragment 到底应该：
> 不创建成正式 session；或创建但标成 retry fragment；或在 session surface 层折叠；
> 同时保留审计，不影响 retry 成功能力。

- 来源：当前 thread，铲屎官 2026-06-01 07:57 UTC。
- 请 reviewer 对照判断：实现是否保留审计、不影响成功 retry，并且 session surface 不再把失败 0-message retry fragment 当成正常主会话噪音。

## Tradeoff

Decision: create formal sessions and mark fragments explicitly.

Rejected:

- Do not create formal sessions: audit and lifecycle for failed cascades would disappear.
- Fold only in UI by `sealReason`: hides symptoms but leaves API/read-model ambiguity.
- Mark every retry-related session: too broad; only failed zero-message automatic retry attempts become fragments.

Current automatic fragment reasons: `model_capacity`, `empty_response`, `stream_error`, `tool_conflict`, `runtime_disconnected`.

## Architecture Ownership

Architecture cell: `identity-session`
Map delta: none
Why: This extends existing runtime-session lifecycle metadata and existing Session Chain presentation. It adds no new store, queue, router, adapter, dispatcher, binding, or ownership cell.

Please reviewer check:

- `retryFragment` belongs in runtime lifecycle metadata rather than `SessionRecord` core fields.
- The guard only marks previous sessions from the same thread/cat, no longer active, and `messageCount === 0`.
- `SessionChainPanel` does not fold active or `sealing` records.
- Legacy `tool_conflict` fallback remains narrow enough for old data.

## Open Questions

### 技术 OQ

1. Should `model_capacity`, `empty_response`, `stream_error`, `tool_conflict`, and `runtime_disconnected` be the complete automatic retry fragment reason set for now?
2. Is `messageCount === 0` the right hard boundary, or should future structured side-effect markers also veto fragment folding?
3. Is exposing `retryFragment` through the session-chain route sufficient, or should a future drilldown surface show folded fragments individually?

### 价值 OQ

无。This is a reversible technical surface decision inside the existing F201/F211 boundary.

## Next Action

Please review commit `093a626f5`. If approved, I will continue to merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f201/opus48`
- Start Command: `pnpm review:start` if browser review is needed; API/web unit review can inspect directly from the branch.
- Ports: reviewer-assigned by `pnpm review:start` when used.

## Self-Check Evidence

### Spec 合规

- Original requirement asks to decide between no formal session, marked fragment, or surface fold while preserving audit and retry success.
- Implemented: formal session + explicit runtime lifecycle marker + surface fold.
- No `.pen` design matched `f201|retry|session|chain|antigravity`; no design comparison required.
- Dogfood scope: user/cat-visible surface change. Covered by deterministic route/component path tests; live Antigravity dogfood was not run because it would launch external provider work and is not needed to validate the read-model folding rule.

### 测试结果

- `env -u NODE_ENV pnpm --filter @cat-cafe/api build` -> PASS
- `node --test packages/api/test/runtime-session-metadata.test.js --test-name-pattern 'retry fragment'` -> PASS, 6/6
- `node --test packages/api/test/invoke-single-cat.test.js --test-name-pattern 'F201: marks zero-message automatic retry attempts'` -> PASS, 91/91
- `node --test packages/api/test/session-chain-route.test.js --test-name-pattern 'runtime sidecar summaries'` -> PASS, 26/26
- `env -u NODE_ENV pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/session-chain-panel.test.ts --testNamePattern='runtime-tagged retry fragments|0-msg tool_conflict|in-flight sealing'` -> PASS, 3/3 selected, 48 skipped; existing React act warnings only
- `env -u NODE_ENV pnpm --filter @cat-cafe/api lint` -> PASS
- `env -u NODE_ENV pnpm --filter @cat-cafe/web exec tsc --noEmit` -> PASS
- `env -u NODE_ENV pnpm check` -> PASS, all 20 checks
- `git diff --check origin/main...HEAD` -> PASS
- `node scripts/check-fallback-layers.mjs` -> PASS, no fallback pattern changes detected
- `node scripts/check-hotfix-pattern.mjs` -> PASS, hotfix=false
- Root media/design artifact gate -> no matches
- `pnpm check:architecture-ownership` -> exit 0 with existing warning-only repo warnings; diff architecture noun warning reviewed as `identity-session`, Map delta none

### Related Docs

- Feature: `docs/features/F201-antigravity-reliability-contract.md`
- Related surface: F211 Session Chain / runtime session visibility
