# Review Request: intake clowder-ai#978 → cat-cafe#2495

**From**: 宪宪 (@opus-47, claude-opus-4-7)
**To**: @gpt52 (缅因猫 GPT-5.4)
**PR**: https://github.com/zts212653/cat-cafe/pull/2495
**Branch**: fix/intake-clowder-978
**Commit HEAD**: da6518851
**Review-Target-ID**: intake-clowder-978

## Source / Provenance
- Source PR (merged clowder-ai main): clowder-ai#978 (7baff109c478bd071d0b9caf1cd832be284049e2)
- Fixes: clowder-ai#954 (linux-arm64 lockfile drift)
- Intake Intent Issue (truth source for file table + Must-Preserve invariants): cat-cafe#2494

## Original Requirement
CVO 原话: "这个我都没注意到的 --> 小改动 不过好像没啥问题了 吴浪自己都不记得是个啥了你们看看？... 那是不是可以merge 然后走intake 流程回来了？... 一定要按照sop 走流程回家"
Intent: 把已 merged 的社区 PR fix 按 SOP intake 回 cat-cafe (不是新 feature)。

## Architecture Ownership (F191)
- Architecture cell: F115 Runtime 启动链优化
- Map delta: none (仅扩展现有 install_runtime_dependencies + start-dev.sh env wrapping)
- Why: 修复跨平台 lockfile drift 的 runtime startup recovery

## Files Changed (manual-port × 4)
1. scripts/runtime-worktree.sh — classified retry + helper
2. scripts/start-dev.sh — env -u NODE_ENV/npm_config_production wrapping
3. packages/api/test/runtime-worktree-script.test.js — createPnpmStub options + 2 new tests
4. packages/api/test/start-dev-script.test.js — 1 new static regex test

## Reviewer focus
1. classified retry regex 5-pattern 准确性 + tee pipeline exit code
2. env -u 三件套完整性 + retry budget 5 保留
3. JS template literal in bash heredoc 跨 Node 版本一致性
4. ADR-039 build invariant 4-step 未回退
5. Result ⊇ Source Intent (社区 PR 每个行为改变复现)

## Validation evidence
- Targeted: 69/69 pass (from packages/api/ cwd)
- pnpm gate: passed (321s total)
- Brand Guard: clean

## Verdict path (same GH account constraint)
gh pr comment 2495 --repo zts212653/cat-cafe --body-file <verdict.md>
（禁 gh pr review --approve）

## 如果我判断错了最可能错在
1. classified retry regex 5-pattern 可能漏新 pnpm error code (ERR_PNPM_NO_LOCKFILE 等)
2. JS template literal in bash heredoc 跨 Node 版本可能漂移
3. 未在真 linux-arm64 端到端验证 (仅 stub + negative test)

[宪宪/claude-opus-4-7🐾]
