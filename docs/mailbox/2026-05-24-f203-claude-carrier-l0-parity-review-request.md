# Review Request: F203 Claude Carrier L0 Parity

Review-Target-ID: f203
Branch: fix/f203-carrier-l0-parity
Commit: PR head after push (exact SHA lives in GitHub; this packet is committed with the branch and avoids self-referential SHA drift)

## What

Fixed the F203 AC-C5 production gap where default Claude runtime invocations still used `ClaudeAgentService(-p)` without compiled native L0.

- `ClaudeAgentService` now compiles per-cat L0 via the existing `compileL0ViaSubprocess` seam and passes `--system-prompt-file <compiled-path>` to `claude -p`.
- `ClaudeAgentService.injectsL0Natively()` now returns true, so route-serial / route-parallel send only pack blocks through `options.systemPrompt` instead of full static identity.
- `ClaudeBgCarrierService` now preserves pack-only `options.systemPrompt` via `--append-system-prompt`, matching the `-p` carrier.
- `cliConfigArgs` can no longer override reserved Claude system prompt flags (`--system-prompt-file`, `--system-prompt`, `--append-system-prompt`).
- L0 compile failure is fail-closed: the provider emits error + done and never spawns `claude`.
- F203 feature doc records KD-18: Claude carrier choice is orthogonal to native L0 injection.
- Stabilized the existing `agent-router` workingDirectory test so it uses the host monorepo root instead of `packages/api` when gate runs tests from the package directory.

## Why

AC-C5 alpha exposed that runtime restart alone did not make F203 active for布偶猫 production invocations: the factory still defaults to `ClaudeAgentService(-p)`, while Phase C only wired compiled L0 into `ClaudeBgCarrierService(--bg)`.

The correct fix is not flipping `CAT_CAFE_CLAUDE_CARRIER` or accelerating F198. `-p` vs `--bg` should control execution mode only; both carriers must inject the same compiled L0 identity/governance layer.

## Original Requirements

> "难道不是应该 -p 和 bg_daemon 统一行为吗？ 为什么要割裂？"
> "哈哈哈也可以 那你喊他 他写你review 也行"

- 来源：thread handoff messages `0001779586998576-000145` and `0001779587371378-000000`; plan `docs/plans/2026-05-24-F203-carrier-unify-l0.md`
- 请对照上面的摘录判断这次是否真正统一两个 Claude carriers 的 L0 注入行为，而不是把 F203 继续绑到 F198 carrier migration。

## Tradeoff

- Did not flip `CAT_CAFE_CLAUDE_CARRIER` default; F198 canary/migration stays on its own timeline.
- Chose `--system-prompt-file` parity instead of reading compiled L0 content into `--append-system-prompt`; this keeps the same replace-style file path as bg carrier.
- Kept `options.systemPrompt` as an append layer for pack-only blocks in both Claude carriers, but it is no longer the carrier's L0 source.
- Added reserved system-prompt flag stripping for Claude `cliConfigArgs`; this intentionally narrows user override power because allowing those flags would silently remove compression-immune governance.
- Did not run a pre-merge behavioral alpha probe. That requires merged code + runtime pull/restart; local spike only proved `claude -p` accepts the hidden `--system-prompt-file` flag before budget/auth limits prevented a full content echo.

## Architecture Ownership

Architecture cell: `harness/system-prompt-injection`
Map delta: none
Why: This fixes an existing provider implementation gap inside the F203 L0 injection path; it does not add a new Store / Queue / Router / Adapter / Dispatcher / Binding or change the F198 carrier ownership boundary.

Please check:
- diff matches `Map delta: none`
- route layer contract is still service-driven via `injectsL0Natively()`
- `cliConfigArgs` restriction is scoped only to Claude system prompt flags

## Open Questions

### 技术 OQ

1. Is `--system-prompt-file` under `claude -p` acceptable based on the local spike plus bg carrier precedent, or do you want an additional runtime proof after PR creation before merge?
2. Resolved from review: preserve pack-only `options.systemPrompt` as `--append-system-prompt` in both Claude carriers. A separate pack channel can be evaluated later, but carrier parity requires no silent drop today.
3. Confirm fail-closed behavior is right for `ClaudeAgentService`: L0 compile failure blocks invocation rather than falling back to pre-F203 prompt.

### 价值 OQ

无。This is the CVO-selected direction: unify behavior, do not couple F203 to F198 carrier migration.

## Next Action

Please review the branch. If approved, I will continue merge-gate: create PR, run cloud review, handle feedback, squash merge, then hand back for post-merge AC-C5 runtime alpha probe.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f203/opus47`
- Start Command: `pnpm review:start`
- Suggested ports: `web=auto`, `api=auto` via review sandbox; do not use 3001/3002/3011/3012/4111.

## 自检证据

### Spec 合规

- Plan: `docs/plans/2026-05-24-F203-carrier-unify-l0.md`
- F203 doc updated: AC-C1 covers both Claude carriers; AC-C5 now requires default `-p` and `bg_daemon` behavioral probes after merge; KD-18 records carrier/L0 orthogonality.
- F198 factory default unchanged.
- Runtime restart not performed in this branch.

### Quality Gate

- Hotfix pattern: `node scripts/check-hotfix-pattern.mjs` → `hotfix=false`.
- Fallback layer check: `node scripts/check-fallback-layers.mjs` → net +1 in `ClaudeAgentService`; cumulative threshold warning only. Self-check: this repairs the carrier coordinate system. New layers are necessary: compiler seam default keeps tests isolated from subprocesses, and fail-closed catch prevents identity/governance-free Claude invocation. No extra fallback branch was added for CLI incompatibility.
- Architecture ownership: `pnpm check:architecture-ownership` → exit 0, existing repo-wide warnings only; diff architecture nouns OK.
- Artifact hygiene: root media/design artifact checks returned empty.
- Dogfood-your-slice: pre-merge runtime dogfood is deferred by design because the observable behavior requires merged code + runtime pull/restart. Local dogfood was the CLI spike documented in the plan: `claude -p` accepted `--system-prompt-file`; full echo was blocked by budget/auth limits. Core local coverage is argv + fail-closed tests below.

### 测试结果

```bash
CAT_OPUS_MODEL=claude-opus-4-6 pnpm --filter @cat-cafe/api run build
# pass

CAT_OPUS_MODEL=claude-opus-4-6 node --test \
  packages/api/test/claude-agent-service.test.js \
  packages/api/test/agent-router.test.js \
  packages/api/test/claude-bg-carrier-l0.test.js
# tests 138, pass 138, fail 0

CAT_OPUS_MODEL=claude-opus-4-6 pnpm check
# pass

git diff --check
# pass
```

### 相关文档

- Plan: `docs/plans/2026-05-24-F203-carrier-unify-l0.md`
- Feature: `docs/features/F203-native-system-prompt-l0.md`
- Related: `docs/features/F198-claude-code-subscription-carrier.md`
