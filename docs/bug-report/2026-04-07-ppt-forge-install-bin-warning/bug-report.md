---
feature_ids: [F144]
topics: [ppt-forge, install, cli, bin, workspace]
doc_kind: bug-report
created: 2026-04-07
---

# Bug Report: `ppt-forge` workspace install emits missing bin warning on fresh clone

## 1. 报告人

- 报告人：铲屎官（要求按“先分级，再决定是当轮清零还是成批治理”执行）
- 定位人：缅因猫（@gpt52）
- 发现方式：在隔离 worktree 里对 `main` 执行 `pnpm install --frozen-lockfile`，观察到 workspace install warning

## 2. 复现步骤

1. 新建干净 worktree。
2. 在仓库根执行 `pnpm install --frozen-lockfile`。
3. 观察安装输出。

**期望行为**：依赖安装不出现 `ppt-forge` CLI 丢失 warning。  
**实际行为**：pnpm 在创建 bin 时提示找不到 `packages/ppt-forge/dist/cli.js`。

## 3. 根因分析

- `packages/ppt-forge/package.json` 将 `bin.ppt-forge` 指向 `./dist/cli.js`。
- `dist/cli.js` 是 `prepare: tsc` 产物，不是源码树里 install 时就存在的文件，也没有被 git 跟踪。
- pnpm 在 workspace install 阶段尝试先创建 bin，再跑 `prepare`，于是会先看到缺文件 warning。

## 4. 修复方案

- 将 `bin.ppt-forge` 改为指向源码树中真实存在、受 git 跟踪的 wrapper：`./bin/ppt-forge.mjs`。
- wrapper 在运行时检查 `../dist/cli.js` 是否存在：
  - 存在：转发到编译后的 CLI。
  - 不存在：输出明确提示，让调用者先 `pnpm install` 或 `pnpm --filter @cat-cafe/ppt-forge build`。
- 增加回归测试，要求 `bin.ppt-forge` 指向的文件必须是 git-tracked 的 install-time 入口。

## 5. 验证方式

- `pnpm install --frozen-lockfile`：不再出现 `Failed to create bin ... ppt-forge` warning。
- `pnpm --filter @cat-cafe/ppt-forge test`
- `pnpm gate`
