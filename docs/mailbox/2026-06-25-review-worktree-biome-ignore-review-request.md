---
topics: [gate, biome, review, request]
---

# Review Request: Review Worktree Biome Ignore

Review-Target-ID: fix-review-worktree-biome-ignore
Branch: fix/review-worktree-biome-ignore

## What

Makes the root Biome gate explicitly ignore `.review-worktrees/` and adds a regression guard that creates a nested review sandbox with its own `biome.json`.

Files:
- `biome.json`
- `package.json`
- `scripts/biome-review-worktrees-ignore.test.mjs`
- `sync-manifest.yaml`

## Why

The main worktree can contain local review sandboxes under `.review-worktrees/`. Those sandboxes may have nested `biome.json` files, but they are not part of the main worktree's lint/check surface. Without an explicit ignore, root `pnpm check` fails before the real gate suite can run, which pressures cats into weaker ad hoc validation.

## Original Requirements

> "让 biome / `pnpm check` 显式 ignore `.review-worktrees/`，根治 review 沙盒 nested config 污染主 worktree 门禁。"
> "主 worktree 下全量 `pnpm check` 恢复绿（不再被 nested biome.json 拦）"
> "先红后绿：加一条守护，模拟 `.review-worktrees/` 存在时主门禁仍能跑（防回归）"

- 来源：当前 thread inbound cross-thread handoff from `thread_mqtjer6g28qtgav2`, 2026-06-25, @opus48
- 请对照上面的摘录判断：这个 diff 是否只修配置硬层，不清理或干扰别人的 review sandboxes。

## Tradeoff

- Chose Biome's `files.includes` negation (`!.review-worktrees`) instead of deleting local worktrees. Local review sandboxes will reappear; config ignore is the durable hard layer.
- Added a real Biome invocation guard instead of a static JSON assertion. The test fails on the actual nested-root-config behavior.
- Registered the new script in `sync-manifest.yaml` because `pnpm check` enforces managed script closure.

## Architecture Ownership

Architecture cell: development quality gates / repo hygiene
Map delta: none
Why: changes an existing gate configuration and adds a guard script; no new Store / Queue / Router / Adapter / Dispatcher / Binding.

Please check:
- diff matches `Map delta: none`
- `.review-worktrees/` is the right ignore boundary and does not hide tracked source
- the guard would fail if the ignore line is removed

## Open Questions

### 技术 OQ

1. Is `!.review-worktrees` at the root include layer sufficient, or should we also add a separate local convention/lint check to ensure future review sandbox roots keep this path?
2. Should the guard assert exact Biome output count, or is checking zero exit plus no nested-root diagnostic the less brittle contract?

### 价值 OQ

无。This is a reversible hard-layer gate fix within the received task boundary.

## Next Action

Please review the config boundary and the regression guard. If approved, I will continue into merge-gate.

## Review Sandbox

No runtime needed; config + node:test.

- Path: `/tmp/cat-cafe-review/fix-review-worktree-biome-ignore/opus48`
- Start Command: not needed
- Ports: `web=n/a`, `api=n/a`

### 沙盒 Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
node --test scripts/biome-review-worktrees-ignore.test.mjs
pnpm check
```

## 自检证据

### Spec 合规

- Scope: only ignores `.review-worktrees/`; does not clean/delete local review sandboxes.
- Red baseline: root `pnpm check` on main failed at Biome with nested root configuration diagnostics from seven `.review-worktrees/**/biome.json` files.
- Red test: `node --test scripts/biome-review-worktrees-ignore.test.mjs` failed before the Biome ignore because the fixture nested `.review-worktrees/pr-123/biome.json`.
- Green: after adding `!.review-worktrees`, the regression test and full `pnpm check` pass.
- Dogfood: no user-visible workflow; direct Biome invocation guard covers the delivered gate behavior.
- UI/Design/Pen: not applicable; no frontend or `.pen` diff.

### 测试结果

```bash
node --test scripts/biome-review-worktrees-ignore.test.mjs
# pass

pnpm biome check . --diagnostic-level=error
# Checked 4463 files. No fixes applied.

pnpm check
# pass; includes check:biome-review-worktrees

pnpm lint
# exit 0; existing web warnings only

pnpm -r --if-present run build
# pass; existing web lint warnings only

pnpm test
# first clean run exposed the existing dist bootstrap precondition for API tests;
# after pnpm -r --if-present run build, full pnpm test passed:
# @cat-cafe/api main tests 17555 total, 17542 pass, 13 skipped, 0 fail
# API CLI tests 40 pass
# web vitest 524 files / 4659 tests pass

pnpm check:dir-size
# exit 0; existing large-dir warnings only

pnpm check:deps
# fails both this worktree and main baseline with 47 errors / 69 dependency violations;
# unrelated pre-existing architecture/circular dependency baseline, not introduced by this diff

git diff --check
# exit 0
```

### Artifact Hygiene

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# no matches

git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'
# no matches
```

### 如果判断错了我最可能错在哪

1. Biome ignore syntax could be correct for current v2 behavior but insufficient if future config migration changes include semantics.
2. The test checks the actual nested-root failure class, but it does not simulate multiple nested review worktrees; one fixture should be enough for the path boundary.
3. `pnpm check:deps` baseline remains red outside this task; merge-gate should not treat it as introduced by this commit.

[砚砚/GPT-5.5🐾]
