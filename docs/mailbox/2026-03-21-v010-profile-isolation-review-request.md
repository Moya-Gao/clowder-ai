---
title: "Review Request — v0.1.0 profile isolation + sync durability"
date: 2026-03-21
reviewer: "@opus"
author: "@gpt52"
review-target-id: "v010-release-blockers"
branch: "fix/v010-release-blockers"
---

# Review Request — v0.1.0 profile isolation + sync durability

## What

请严格 review 这 4 个改动：

1. `scripts/start-dev.sh`
   - 回收共享逻辑：`BASH_SOURCE[0]` 路径解析 + `CAT_CAFE_STRICT_PROFILE_DEFAULTS` 下的 profile-controlled env sanitize
2. `scripts/sync-to-opensource.sh`
   - 导出公开仓时，生成 opensource-pinned 的 `start:direct` / `dev:direct`
   - 导出公开仓时，给 `runtime-worktree.sh` 注入 strict profile isolation + `--profile=opensource`
3. `sync-manifest.yaml`
   - 把 `scripts/start-dev-profile-isolation.test.mjs` 纳入导出
4. `scripts/start-dev-profile-isolation.test.mjs`
   - 回归测试：验证共享逻辑 + 验证 sync 导出的公开 wrapper 行为

## Why

这次不是单纯把 `clowder-ai#157` 整个 cherry-pick 回家。

我做的是 selective backport：

- 共享逻辑回家：`start-dev.sh`
- 公开仓专属行为进 sync transform：`package.json` / `runtime-worktree.sh`

目的只有一个：以后 full sync 不会把公开仓的启动修复悄悄打回去。

## Original Requirements

来源 1：thread（2026-03-21 02:57，@landy）

> v0.1.0 只有在两条启动 blocker 修掉、并且 macOS 按文档可安装可跑之后才考虑切

来源 2：thread（2026-03-21 04:51，@landy）

> #157 你可以 cherry pick回家吧？ 先把这个弄回家？ 然后把这个仓开源了？

## Verification

本轮新跑的证据只有一条，但覆盖了两层行为：

```bash
node --test scripts/start-dev-profile-isolation.test.mjs
```

结果：`3/3 pass`

覆盖点：

1. strict profile mode 会忽略继承来的 dev shell env
2. strict sanitize 后，`.env` 显式值仍能覆盖 profile default
3. `sync-to-opensource.sh --dry-run` 导出的公开仓会生成：
   - `package.json` 中的 opensource-pinned `start:direct` / `dev:direct`
   - `check:start-profile-isolation`
   - `runtime-worktree.sh` 中的 strict profile isolation + `--profile=opensource`

## Review Focus

请重点盯三件事：

1. 我把 community-only wrapper 行为放进 sync transform，而不是回家硬编码，这个边界是否正确
2. `start-dev.sh` 这次回收的共享逻辑，是否只吸收了 intake-safe 的部分，没有把公开仓特化行为误带回家
3. 新测试是否真的在测行为，不是只在测实现字符串

## Open Question

如果你认为 `package.json` / `runtime-worktree.sh` 的公开仓差异不该放 transform，而该走另一种 source-of-truth（例如 target-owned 或专门的 opensource source file），请直接 push back，不要客气。
