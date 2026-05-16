---
type: review-request
date: 2026-05-15
feature: F201
author: codex
reviewers:
  - opus
  - opus-47
branch: feat/f201-phase-b-journal
status: requested
---

# Review Request: F201 Phase B — Antigravity Side-Effect Journal

Review-Target-ID: f201
Branch: feat/f201-phase-b-journal
Implementation Commit: `1baf1ab1f`

## What

Phase B adds the side-effect journal layer that Phase A prepared:

1. New `AntigravitySideEffectJournal` records Antigravity side-effect-capable steps per cascade.
2. Journal entries carry required non-empty `idempotencyKey`; completed side effects use stable keys and are deduped on repeat observation.
3. Sensitive targets are redacted before diagnostics/audit output.
4. Antigravity diagnostics now include `sideEffectJournal`, and legacy `executionJournal` metadata is emitted through the journal boundary.
5. The old `isLegacyToolishStep` fallback gate is deleted; retry dispatch relevance now comes from `classifyAntigravityStepEffect()`.
6. `RUN_COMMAND` classification preserves the metadata `toolCall.argumentsJson.CommandLine` path that F061 used for read-only retry behavior.

## Why

F201 must make Antigravity failures recoverable without downgrading or disabling Antigravity. Phase A made side effects visible; Phase B makes them durable enough to reason about interruption, deduplication, and recovery UI in later phases.

## Original Requirements（必填）

> "我要的是你给我一份完整的解决方案让人家可靠可用"
> "除了 f061 之外还有其他地方是 antigravity 的 feat 吗？都 close 了吗？"
> "写好方案找 46 和 47 两只布偶猫给你看"
> "走起201 wktree"

- 来源：当前 F201 thread（2026-05-15）+ `docs/features/F201-antigravity-reliability-contract.md`
- **请对照上面的摘录判断 Phase B 是否沿着“可靠可用、不降级”的方向推进**

## Tradeoff

- JSONL audit flush is awaited at terminal points but remains best-effort: audit write failure is logged and does not fail the user request.
- Pending/failed side effects use cascade/step-scoped idempotency keys rather than stable cross-cascade keys. Only completed side effects dedup automatically.
- The journal stores redacted target strings in metadata/audit. This protects obvious sensitive paths and secret-like strings, but reviewer should check whether the blacklist is strict enough for Phase B.

## Architecture Ownership（必填）

Architecture cell: `transport` + `bubble-pipeline`
Map delta: none
Why: F201 extends the existing Antigravity provider/retry/recovery contract and keeps recovery UI future work on the F183 bubble pipeline; it does not introduce a parallel Store/Queue/Router/Adapter/Dispatcher/Binding.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. Journal idempotency: completed side-effect keys are stable by thread/cat/effect/operation/target. Is that enough to dedup resume duplicates without collapsing distinct writes?
2. Redaction: target blacklist covers `.aws`, `.ssh`, `.gnupg`, key files, credentials, `.env`, and secret/token/password/api-key strings. Is this sufficient for Phase B diagnostics and JSONL audit?
3. Retry gate: after deleting `isLegacyToolishStep`, does the classifier-driven `dispatchRelevant` logic preserve F061 read-only waiting `RUN_COMMAND` retry semantics?
4. Audit behavior: awaited best-effort terminal flush logs failure but does not abort user response. Is that the right reliability tradeoff?
5. Fallback self-check: `check-fallback-layers` flags this branch. Are these boundary fallbacks justified by unstable upstream trajectory shapes, or should we simplify before review passes?

### 价值 OQ（给 CVO，如有）

无。Phase B is technical reliability plumbing under the already accepted F201 direction.

## Next Action

请 review:

1. `AntigravitySideEffectJournal` idempotency, dedup, summary, and audit behavior.
2. Service integration around terminal model_capacity / empty_response / done diagnostics.
3. Deletion of legacy retry gate and preservation of safe read-only retry behavior.
4. Target redaction boundary and whether any sensitive data can still leak through journal metadata.
5. Test coverage against AC-B1 / AC-B5 and the Phase B alert from 47 (`isLegacyToolishStep` delete + path redaction).

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f201/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: review sandbox auto-assigns (3201+); no author-run dev server required for this backend/provider phase

## 自检证据

### Spec 合规

- F201 spec/plan approved by Opus 4.6 and Opus 4.7 before implementation.
- Phase B scope only: side-effect journal, idempotency, redaction, executionJournal subsume, retry gate migration support.
- `isLegacyToolishStep` / `batchHasToolishStep` no longer exist in Antigravity provider code.
- Architecture ownership remains `transport` + `bubble-pipeline`; no architecture map delta.
- Root artifact gate: no root media/design artifacts in worktree or `origin/main...HEAD`.

### Fallback 坐标系自检

`node scripts/check-fallback-layers.mjs` exits 0 but flags expected fallback growth:

- `AntigravitySideEffectJournal.ts`: trajectory metadata is optional and upstream-owned; fallbacks normalize step id, target, operation, effect type, and idempotency material into one journal boundary.
- `antigravity-step-effects.ts`: metadata `toolCall.argumentsJson` parsing preserves F061 read-only retry behavior after deleting the legacy gate.
- `AntigravityAgentService.ts`: fallback growth is limited to audit best-effort catch, optional step index, and classifier-driven dispatch relevance.

判断：这是修正坐标系（side-effect state centralized into one journal/classifier boundary），不是继续叠旧 gate。请 reviewer 验证这条判断。

### 测试结果

- `pnpm --filter @cat-cafe/api build` — pass.
- `node --test packages/api/test/antigravity-side-effect-journal.test.js` — 5/5 pass.
- `node --test packages/api/test/antigravity-agent-service-diagnostics.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js` — 51/51 pass.
- `node --test packages/api/test/antigravity-side-effect-journal.test.js packages/api/test/antigravity-step-effects.test.js packages/api/test/antigravity-agent-service-diagnostics.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js` — 71/71 pass.
- `pnpm --filter @cat-cafe/api test:public` — 9841 tests, 9839 pass, 0 fail, 2 skipped.
- `pnpm --filter @cat-cafe/mcp-server build` — pass.
- `pnpm check:architecture-ownership` — exits 0; existing warning-only feature architecture declarations unrelated to this diff.
- `git diff --check origin/main...HEAD` — pass.

### 相关文档

- Feature: `docs/features/F201-antigravity-reliability-contract.md`
- Plan: `docs/plans/2026-05-15-f201-antigravity-reliability-contract.md`

### 如果判断错了我最可能错在哪（pre-registered retraction conditions）

1. Stable completed idempotency keys may be too coarse for two intentional writes to the same target in one user turn.
2. Redaction may miss sensitive paths embedded in longer shell commands.
3. Awaited audit flush might add terminal latency if the audit directory is slow or unavailable.
