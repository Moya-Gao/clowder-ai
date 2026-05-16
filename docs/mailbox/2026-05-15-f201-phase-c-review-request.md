---
type: review-request
date: 2026-05-15
feature: F201
author: codex
reviewers:
  - opus
  - opus-47
branch: feat/f201-phase-c-recovery
status: requested
---

# Review Request: F201 Phase C — Antigravity Recovery Policy

Review-Target-ID: f201
Branch: feat/f201-phase-c-recovery
Implementation Commit: `824235321`

## What

Phase C moves Antigravity recovery out of inline retry booleans and into explicit decision payloads:

1. Added `decideAntigravityRecovery()` as the centralized recovery decision engine for `model_capacity`, `network_error`, `stream_error`, and `empty_response`.
2. Added `buildAntigravityResumeContext()` for Phase E/UI and human-approved resume turns.
3. Wired recovery decisions into `AntigravityAgentService` diagnostics, including post-side-effect `stream_error` and `empty_response` paths.
4. Changed `AntigravitySideEffectJournal.toExecutionJournal()` from passthrough to journal-derived compatibility metadata.
5. Added explicit coverage for the Phase B alert: read-only `MCP_TOOL` transient retry is intentionally narrowed and documented in tests.

## Why

F201 is not just "do not retry after writes." The provider needs a typed answer to: retry fresh cascade, surface terminal error, or surface resumable error with enough context to continue without repeating completed side effects. Phase C creates that policy layer so Phase D smoke and Phase E recovery card can build on one recovery contract.

## Original Requirements（必填）

> "我要的是你给我一份完整的解决方案让人家可靠可用"
> "除了 f061 之外还有其他地方是 antigravity 的 feat 吗？都 close 了吗？"
> "走起201 wktree"
> "最后要如何测试呢？我来测试？"

- 来源：当前 F201 thread（2026-05-15）+ `docs/features/F201-antigravity-reliability-contract.md`
- **请对照上面的摘录判断 Phase C 是否把 A/B 的内部地基推进到可恢复策略，而不是只继续堆 diagnostics**

## Tradeoff

- Phase C does not implement cascade health retirement thresholds from Task 4. This slice focuses on recovery policy + resume payload, matching the Phase C kickoff from 47 after A/B vision guard. If reviewers consider Task 4 mandatory for Phase C merge, mark it P1.
- Read-only `MCP_TOOL` transient retry is intentionally fail-closed for now. This avoids blind retry after opaque MCP activity, but narrows one F061 retry case; the test names the behavior so it is not an accidental regression.
- Resume context is machine-readable metadata, not user-facing UI. Phase E must still render the typed recovery card through F183.

## Architecture Ownership（必填）

Architecture cell: `transport` + `bubble-pipeline`
Map delta: none
Why: F201 extends the existing Antigravity provider/retry/recovery contract and prepares typed recovery metadata for the existing F183 bubble pipeline; it does not introduce a parallel Store/Queue/Router/Adapter/Dispatcher/Binding.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. Policy replacement: does `decideAntigravityRecovery()` fully replace the old inline retry decision without leaving a second policy path?
2. Post-side-effect stream interruption: does the service now surface `surface_resumable_error` with `resumeContext` and avoid blind retry?
3. Read-only MCP narrowing: is `read_only_mcp_tool_transient_retry_intentionally_disabled` acceptable for Phase C, or should read-only MCP regain retry eligibility now?
4. Execution compatibility: does journal-derived `executionJournal` preserve F061 before-dispatch approval-gate diagnostics while marking completed/failed side effects as dispatched?
5. Scope: is cascade-health retirement required before Phase C merge, or can it remain Task 4 / later Phase C-D work?

### 价值 OQ（给 CVO，如有）

无。This is technical reliability plumbing under the already accepted F201 direction.

## Next Action

请 review:

1. Recovery policy semantics and integration points in `AntigravityAgentService`.
2. Resume payload shape and whether it is sufficient for Phase E recovery cards.
3. Tests covering post-write `stream_error`, read-only MCP transient retry narrowing, and journal-derived compatibility metadata.
4. F061 compatibility: read-only waiting `RUN_COMMAND` retries should remain intact.
5. Whether Task 4 cascade-health behavior must be pulled into this PR before merge.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f201/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: review sandbox auto-assigns (3201+); no author-run dev server required for this backend/provider phase

## 自检证据

### Spec 合规

- Phase A+B vision guard passed: production data flow confirmed non-dead-code, no downgrade, A/B treated honestly as foundation rather than completion.
- Phase C AC-C1/C2/C3 direction covered: recovery decision engine, post-side-effect resumable surface, resume payload metadata.
- Phase B reviewer alerts covered: read-only MCP retry narrowing has an explicit test; `toExecutionJournal()` is now derived from journal state.
- Architecture ownership remains `transport` + `bubble-pipeline`; no architecture map delta.
- Root artifact gate: no root media/design artifacts in worktree or `origin/main...HEAD`.

### Fallback 坐标系自检

`node scripts/check-fallback-layers.mjs` exits 0 and reports net fallback reduction:

- `AntigravityAgentService.ts`: `+1 -6`, net `-5`; cumulative threshold still fires because this historical provider file already has many existing fallback patterns.
- `antigravity-recovery-policy.ts`: `+2`, both are boundary defaults in the new policy input normalization path.
- Total net fallback change: `-3`.

判断：这是把旧 inline retry branches 收口到 policy/journal 边界，且本轮净减少 fallback，不是在错误坐标系上继续打补丁。请 reviewer 验证这条判断。

### 测试结果

- `pnpm check` — pass after review-request doc (`biome check`, feature truth, manifest/env/guide/followup checks; only existing advisory skill-manifest warnings).
- `pnpm test` — pass after review-request doc. The first root run exposed an intermittent API `route-serial-phase-h-hint` assertion; standalone file rerun passed, full `@cat-cafe/api` rerun passed (`tests 11200`, `fail 0`, `skipped 3`), and final root rerun passed (`web` 408 files / 3069 tests, `next-config` 5 tests, no-hardcoded-colors pass).
- `pnpm --filter @cat-cafe/api build` — pass after final cleanup.
- `node --test packages/api/test/antigravity-agent-service-fatal-errors.test.js packages/api/test/antigravity-recovery-policy.test.js packages/api/test/antigravity-resume-context.test.js packages/api/test/antigravity-side-effect-journal.test.js` — 57/57 pass after final cleanup.
- `pnpm biome check --diagnostic-level=error` on changed Antigravity implementation files — pass after final cleanup.
- `git diff --check` — pass after final cleanup.

### 相关文档

- Feature: `docs/features/F201-antigravity-reliability-contract.md`
- Plan: `docs/plans/2026-05-15-f201-antigravity-reliability-contract.md`

### 如果判断错了我最可能错在哪（pre-registered retraction conditions）

1. Read-only `MCP_TOOL` retry narrowing might be too conservative if real Antigravity trajectories use read-only MCP as an isolated recoverable step.
2. The resume context may be too journal-entry-centric for Phase E and may need extra user-facing summary fields.
3. Deferring cascade-health retirement may make Phase C too narrow if reviewers interpret Task 4 as part of the same merge unit.
