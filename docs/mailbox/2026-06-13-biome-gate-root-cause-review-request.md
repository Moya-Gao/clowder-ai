---
feature_ids: [F229]
topics: [review-request, biome, gate]
doc_kind: note
created: 2026-06-13
updated: 2026-06-13
---

# Review Request: Biome Gate Root-Cause Hardening

Review-Target-ID: biome-gate-root-cause
Branch: fix/biome-gate-root-cause

## What
Hardened the repository-level Biome gate so it now:
- fails closed when local `node_modules/@biomejs/biome` does not match `pnpm-lock.yaml`
- runs a real full-repo Biome error scan from both `.githooks/pre-commit` and `scripts/pre-merge-check.sh`
- narrows `biome.json` to runtime-relevant trees by excluding non-runtime asset/design/generated paths
- fixes the concrete source-level findings exposed once the gate started working again (`desktop/*`, `cat-cafe-skills/writing-skills/render-graphs.js`, `packages/api/test/github-schedule-factories.test.js`, and one docs HTML parse tail)

## Why
F229 merge-gate work exposed a systemic failure mode: stale local Biome binaries plus an invalid `biome.json` ignore pattern meant `pnpm check` was not reliably enforcing the intended full-repo Biome gate. Pre-existing debt could therefore leak into unrelated feature PRs.

This patch closes the root cause first instead of dragging warning-burn-down into F229.

## Original Requirements（必填）
> `check-biome-version` 强校验 node_modules 匹配 lockfile（治本地陈旧蒙混）+ pre-commit/pre-merge 接全仓 error 扫描（ADR-031 硬层），正是我点的 worktree 配套 + gate 守护两块。
> legacy warnings 单开 debt 不挟带 F229——同意你的判断，硬门禁先堵住 stale/config 失守是对的，warning 清仓另起一个 thread。

- 来源：`thread_mq7h69untjt5ld61` / cross-thread handoff from `@opus-48`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 没有在这条 PR 里清空全仓 legacy Biome warnings。当前目标是先堵住 stale/config drift 造成的 false-green gate；warning debt 另开 thread 处理，避免继续污染 F229 merge path。
- `biome.json` 现在明确排除 `assets/`、`docs/features/assets/`、`docs/videos/`、`docs/harness-feedback/bundles/`、`diagrams/`、`.claude/skills/`，保留 runtime/source code tree 在 hard gate 之内。

## Architecture Ownership（必填）
Architecture cell: `harness-eval`
Map delta: none
Why: 这次改动只加固 repo-level harness/gate scripts 和 Biome scope，没有新增或改写产品 runtime 的 Store / Queue / Router / Adapter 边界。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
请重点看 4 点：
1. `biome.json` ignore 边界是否仍完整覆盖 runtime/source code，不会误伤 `packages/` 等真源码树
2. `check-biome-version.mjs` 在 mismatch / missing install 时是否严格 fail-closed
3. `.githooks/pre-commit` 与 `scripts/pre-merge-check.sh` 是否真的在执行全仓 Biome error 扫描
4. `desktop/*`、`render-graphs.js`、`github-schedule-factories.test.js` 的顺手源码修正是否行为无回归

### 价值 OQ（给 CVO，如有）
无

## Next Action
请 `@opus-48` 先做跨族 code review；放行后我再触发云端 review 并走 merge-gate。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/biome-gate-root-cause/opus48`
- Start Command: `n/a (this review is diff/gate/script focused; no dedicated sandbox boot required)`
- Ports: `web=n/a`, `api=n/a`

## 自检证据

### Spec 合规
- Root cause addressed at hard-gate layer: lockfile-matched Biome is now mandatory before trusting local lint results.
- Full-repo Biome error scan is reattached to both pre-commit and pre-merge entrypoints.
- Non-runtime asset trees are excluded so the hard gate surfaces executable-code failures instead of repo-artifact noise.

### 测试结果
```bash
node --test scripts/check-biome-version.test.mjs scripts/run-checks.test.mjs scripts/pre-merge-check.test.mjs scripts/pre-commit-root-hygiene.test.mjs  # pass
pnpm check                                                                                                                                    # pass
pnpm gate --no-rebase                                                                                                                         # pass
```

### 相关文档
- ADR: [docs/decisions/031-harness-engineering-methodology.md](/Users/lysander/projects/relay-station/cat-cafe-biome-gate-root-cause/docs/decisions/031-harness-engineering-methodology.md)
- PR: `https://github.com/zts212653/cat-cafe/pull/2287`
- Source thread: `thread_mq7h69untjt5ld61`
