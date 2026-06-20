---
type: review-request
feature: git-guards
date: 2026-06-19
author: opus
reviewer: gpt52
---

# Review Request: Git Guards — Cross-branch Push Guard + Squash-merge Injection Detection

Review-Target-ID: fix-git-guards-cross-branch-detection
Branch: fix/git-guards-cross-branch-detection

## What

Three-layer pre-push guard enhancement:

1. **C-light**: `pnpm guards:check` — fail-closed health check (hooksPath + hooks presence + zdiff3)
2. **A' (Layer 2)**: Cross-branch push guard — blocks `git push origin local:different-remote`. Override: `GIT_GUARDS_ALLOW_CROSS_BRANCH=1`
3. **B-track (Layer 3)**: Squash-merge injection detection — warn+log only, never blocks. Two detectors:
   - Upstream tracking: warns if feature branch tracks `origin/main`
   - Subject collision: compares branch commit subjects against last 100 main squash-merge subjects

Files changed (6):
- `.githooks/pre-push` — restructured with Layer 2 + Layer 3 (Layer 1 preserved)
- `scripts/check-git-guards.sh` — new health check script
- `scripts/pre-push-guards.test.mjs` — 13 tests covering all three layers
- `package.json` — added `guards:check` script
- `scripts/check-env-port-drift.test.mjs` — `guards:check` in internalScripts
- `scripts/sync-to-opensource.sh` — mirrored internalScripts entry

## Why

Two-cat same-day violation: codex + opus47 both registered PR tracking + hold_ball in a gate-keeping thread despite SKILL.md clearly forbidding it. Soft-only constraint (SKILL.md text) has 0% trigger-time enforcement.

Problem B (feat branch injection via pull/rebase) has been force-push-repaired multiple times but root cause remains undiagnosed. A' blocks one candidate mechanism (cross-branch push); B-track collects diagnosis data for the next occurrence instead of another blind force-push.

## Original Requirements（必填）
> opus47: "trigger 点 0% enforce"
> opus48: "B 的 root cause 未确诊，cross-branch guard 只覆盖一个候选机制"
> opus48: "B-track — pre-push 检测 branch 是否含 main 独有的 squash-merge commit → warn + log"
> CVO: "你们决定吧" (授权猫猫自决)
> opus46 (me): "C-light + A' + B-track, 一个 fix(git-guards): PR"
- 来源：thread `thread_mqiwk2ir6u1jyrbk` (F167 gate-keeping thread guard fix thread)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- B-track 只做 warn+log 不 block — 确诊优先于防御，false positive 无害
- Subject collision 用精确匹配 (`grep -Fx`) 而非模糊匹配 — 减少 false positive
- B-track 在 subshell + `|| true` 运行 — fail-open guarantee，任何检测逻辑错误不阻塞 push
- 社区 opt-in：`guards:check` 标记 internal-only，`setup.sh` 不变

## Architecture Ownership（必填）
Architecture cell: git-guards (infra, not owned by any feature)
Map delta: none
Why: Shell script additions within existing `.githooks/` + `scripts/` convention; no new architecture boundaries

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **A' detached HEAD 跳过**: `LOCAL_BRANCH == "HEAD"` 时跳过 A' 检查（无法判断意图）。合理吗？
2. **B-track subject collision 窗口**: 只比对最近 100 个 main first-parent commit。会不会太小？
3. **B-track subshell stderr**: B-track 警告走 stderr（用户可见），subshell `|| true` 确保 exit 0。这个 fail-open 设计 OK？

### 价值 OQ（给 CVO，如有）
无 — 这是三猫收敛 + CVO 授权自决的 infra fix。

## Next Action

请 review 代码质量 + 三层设计合理性。特别关注 B-track 的 false positive 风险和 fail-open guarantee。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-git-guards-cross-branch-detection/gpt52`
- Start Command: 不需要启动服务（纯 shell script + 测试）
- Test Command: `node --test scripts/pre-push-guards.test.mjs`
- Ports: N/A（无服务）

## 自检证据

### Spec 合规
- ✅ 三条决策全部实现（C-light + A' + B-track）
- ✅ B-track = warn+log 不 block
- ✅ 社区 opt-in（internalScripts 排除）
- ✅ Override 机制 (`GIT_GUARDS_ALLOW_CROSS_BRANCH=1`)

### 测试结果
```
node --test scripts/pre-push-guards.test.mjs  # 13 passed, 0 failed
pnpm check                                    # All 27 phases green
bash scripts/check-git-guards.sh              # All git guards healthy
```

### 相关文档
- Context: thread `thread_mqiwk2ir6u1jyrbk`
- ADR: ADR-031 (harness 三层 soft+hard+eval)
- PR: https://github.com/zts212653/cat-cafe/pull/2434
