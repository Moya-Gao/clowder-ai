# Review Request: intake clowder-ai#657 startup probe reliability

Review-Target-ID: fix-intake-clowder-657
Branch: fix/intake-clowder-657
PR: https://github.com/zts212653/cat-cafe/pull/1588

## What

Absorbed maintainer-approved `clowder-ai#657` into Cat Cafe:

- Added bounded `/dev/tcp` port probes to `scripts/start-dev.sh`, `scripts/runtime-worktree.sh`, and `scripts/review-start.sh`.
- Added source-only test seams for `runtime-worktree.sh` and `review-start.sh`.
- Added regression tests for environments where `timeout` is unavailable.
- Regenerated `docs/features/index.json` because `pnpm check` found the feature index stale before this branch.

## Why

The upstream fix prevents startup/review/runtime port probes from hanging in WSL-style `/dev/tcp` behavior while preserving fallback behavior on stock macOS/minimal images where `timeout` is absent.

Source PR: `zts212653/clowder-ai#657`  
Source issue: `zts212653/clowder-ai#661`  
Source merge commit: `e9d214b0cd4fc994d61757303a594fb3534af4c4`  
Intent issue: `zts212653/cat-cafe#1587`

## Original Requirements

> "那你走intake 回家的流程吧，merge 然后读sop 走流程回家"
> "记得一定要好好看看intake skills 大多数猫猫都会犯错"
> "如果你觉得ok 可以merge了"

- 来源：当前线程 2026-05-07 09:04 PT；落盘锚点为 `cat-cafe#1587`
- 请对照上面的摘录判断交付物是否完成 inbound merge + Cat Cafe absorb PR 的正确前半程

## Tradeoff

I did not run `--record` or `--advance-ledger` in this branch. That is intentional: inbound SOP requires formal cross-cat Intake Review Guard proof before recording the decision and advancing the ledger.

The patch is manual-port rather than byte-copy because these files are high-risk startup/runtime entrypoints and Cat Cafe has house-specific Redis, runtime worktree, review sandbox, and profile semantics that must be preserved.

## Architecture Ownership

Architecture cell: none (operational shell entrypoints and tests only)
Map delta: none
Why: This changes existing startup/review/runtime scripts and their tests; it does not add a new Store, Queue, Router, Adapter, Dispatcher, Binding, or ownership boundary.

Please check:

- diff 是否与 `Map delta: none` 一致
- 是否误改了 Cat Cafe 的 Redis 6399 sacred guard / runtime worktree lifecycle / review sandbox port-pair behavior
- whether the three manual-port files replay the source intent without overwriting house-specific behavior

## Open Questions

- Verify the source intent against `clowder-ai#657` and merge commit `e9d214b0cd4fc994d61757303a594fb3534af4c4`.
- Rerun at least one high-risk chain from the validation list below, preferably the three startup script tests or inbound brand guard.
- If approved, please leave formal review proof on PR `#1588`; after that I can run `--record` + `--advance-ledger`.

## Next Action

Please perform Intake Review Guard on `cat-cafe#1588`.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-intake-clowder-657/opus`
- Start Command: `pnpm review:start` if runtime/browser inspection is needed
- Ports: N/A for author self-check; this PR is shell-script/test only and no frontend runtime was started

## 自检证据

### Spec 合规

- `clowder-ai#661` had `bug` + `triaged` labels before upstream merge.
- `clowder-ai#657` was maintainer-reviewed, fixed, CI-green, then squash-merged.
- `cat-cafe#1587` was created before absorb PR and contains per-file intake decisions.
- `scripts/intake-from-opensource.sh --pr 657 --mode=plan` classified 3 safe-cherry-pick test files and 3 manual-port script files.
- No ledger record/advance has been done before reviewer proof.

### 测试结果

```bash
bash scripts/intake-from-opensource.sh --validate-inbound
# PASS: No brand violations detected

bash scripts/intake-from-opensource.sh --validate-inbound --from-index
# PASS: No brand violations detected

cd packages/api && node --test test/start-dev-script.test.js test/runtime-worktree-script.test.js test/review-start-script.test.js
# tests 51, pass 51, fail 0

pnpm check
# PASS, including check-feature-truth, check:pre-merge-gate, check:guides, check:followup-tails

pnpm lint
# PASS; existing web design-token warnings only, unrelated to this diff

pnpm check:architecture-ownership
# PASS: 0 warning(s)

node scripts/check-fallback-layers.mjs
# PASS: No fallback pattern changes detected

node scripts/check-hotfix-pattern.mjs
# PASS: {"hotfix":false,"autoLabel":false}
```

### 根目录工件闸门

```bash
git diff --cached --name-only | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true
# empty
```

### 相关文档

- Intent Issue: `https://github.com/zts212653/cat-cafe/issues/1587`
- Absorb PR: `https://github.com/zts212653/cat-cafe/pull/1588`
- Source PR: `https://github.com/zts212653/clowder-ai/pull/657`
- Source merge commit: `e9d214b0cd4fc994d61757303a594fb3534af4c4`

[砚砚/GPT-5.5🐾]
