---
feature_ids: [F238]
topics: [opensource-ops, intake, brand-guard, review-request]
doc_kind: review-request
created: 2026-06-18
---

# Review Request: F238 Intake Brand Guard Scope Fix

Review-Target-ID: f238-intake-brand-scope
Branch: `fix/f238-intake-brand-scope`
PR: <https://github.com/zts212653/cat-cafe/pull/2360>

## What

- Scope `scripts/intake-from-opensource.sh --record --decision absorbed` Brand Guard to the absorb PR changed-file list via `gh pr diff <absorb-pr> --name-only`.
- Scope standalone `--validate-inbound` to local changed files, and `--from-index` to staged files, when running inside a git worktree.
- Preserve full validation behavior for non-git fixtures and fail-closed if absorbed record cannot resolve its absorb PR file list.
- Add regression coverage for pre-existing public docs outside the intake diff and manual-port contamination inside the intake diff.

## Why

F238 Phase C made inbound brand validation dictionary-driven, but record-time validation scanned the whole repo. Absorbed intakes were repeatedly blocked by pre-existing public-facing docs that intentionally mention `Clowder AI`. The guard should catch intake-introduced contamination, not historical public product docs outside the current intake diff.

## Original Requirements

> F238 Phase C 的 `run_brand_validation` Phase 2 在 `--record --decision absorbed` 时全仓扫所有 dictionary brand-protected 文件，把本来就该含 "Clowder AI" 的开源产品文档误报成 brand violation。  
> #2347 → #943 → #944 → #899，4 次 absorbed intake 全被同一组 34 个 pre-existing false-positive 挡住。  
> 修了能省掉每次 intake 的手动绕过。

- 来源：cross-thread handoff from `thread_mqhh7df7annh3k9t` + cat-cafe#2348
- 请 reviewer 对照上面的摘录判断交付物是否解决了重复摩擦。

## Tradeoff

I chose changed-file scoping over broad dictionary exceptions. Public-doc exceptions may still be useful later, but they would make the dictionary carry historical prose carve-outs. Scope is the root bug for absorbed intake records.

## Architecture Ownership

Architecture cell: opensource-ops
Map delta: none
Why: This changes existing intake guard scope inside the existing script; it does not add a new Store, Queue, Router, Adapter, Dispatcher, or Binding.

Reviewer focus:
- Does scoped validation still fail-closed on actual manual-port contamination inside the absorb PR diff?
- Is `gh pr diff --name-only` the right source for absorb PR changed files?
- Is standalone `--validate-inbound` changed-file scope acceptable for local intake validation?

## Open Questions

### 技术 OQ

- Should `--validate-inbound` expose an explicit `--all` mode later for deliberate whole-repo audits?
- Should #2348's remaining items be split into separate PRs: intent issue header language, SHA normalization, and markdown-wrapped decision tokens?

### 价值 OQ

无。

## Next Action

Please review PR #2360. A logical approve comment is enough because all cats share the same GitHub account.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f238-intake-brand-scope/opus48`
- Start Command: not needed; CLI/script-only change
- Ports: none

## 自检证据

### Spec 合规

- F238 boundary goal preserved: guard still catches public brand terms in protected changed files.
- #2348 friction fixed at the record path: pre-existing `README.opensource.md` no longer blocks when it is outside the absorb PR file list.
- Standalone local validation now scans changed files instead of clean-main history.

### 测试结果

```bash
node --test scripts/intake-from-opensource.test.mjs
# 47 tests, 47 pass

bash scripts/intake-from-opensource.sh --validate-inbound
# Brand Guard scope: 2 local changed file(s)
# No brand violations detected

pnpm check
# All 27 checks passed

pnpm lint
# exit 0; existing web warnings only

pnpm -r --if-present run build
# exit 0; existing web warnings only
```

### 相关文档

- Feature: `docs/features/F238-bidirectional-boundary-symmetry.md`
- Issue: <https://github.com/zts212653/cat-cafe/issues/2348>
