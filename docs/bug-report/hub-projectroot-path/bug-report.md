# Bug Report: Hub 环境文件 VSCode 跳转路径错误

## 报告人
铲屎官，2026-02-13，在 Cat Cafe Hub「环境 & 文件」tab 中点击配置文件跳转链接时发现。

## 复现步骤

1. 从 `cat-cafe-runtime` worktree 启动 dev server（`pnpm --filter @cat-cafe/api dev`）
2. 打开 Hub modal → 切换到「环境 & 文件」tab
3. 点击 AGENTS.md 的「打开」链接

**期望行为**：VSCode 打开 `~/projects/relay-station/cat-cafe-runtime/AGENTS.md`（monorepo 根）

**实际行为**：提示 `~/projects/relay-station/cat-cafe-runtime/packages/api/AGENTS.md` 不存在

## 根因分析

`GET /api/config/env-summary` 返回：
```typescript
paths: {
  projectRoot: process.cwd(),  // ← Bug here
  homeDir: os.homedir(),
}
```

当 API 通过 `pnpm --filter @cat-cafe/api dev` 启动时，pnpm 会将 CWD 切换到 `packages/api/` 目录。因此 `process.cwd()` 返回的是包目录而非 monorepo 根目录。

前端用 `${projectRoot}/AGENTS.md` 拼接路径 → 得到 `packages/api/AGENTS.md`，文件不存在。

排除项：
- 不是前端路径拼接 bug（前端逻辑正确）
- 不是 runtime worktree 特有问题（即使在主仓 `packages/api/` 下启动也会复现）

## 修复方案

从 `process.cwd()` 向上遍历目录树，找到包含 `pnpm-workspace.yaml` 的目录作为 monorepo 根。

**为什么选这个方案**：
- `pnpm-workspace.yaml` 是 monorepo 根的唯一标识，不依赖编译路径或 git
- 一次计算缓存到模块常量，无运行时开销

**放弃的方案**：
- `__dirname` 相对路径：依赖编译输出目录结构，脆弱
- `git rev-parse --show-toplevel`：需要 spawn 子进程，过重

## 验证方式

1. 启动 dev server，调用 `GET /api/config/env-summary`，检查 `paths.projectRoot` 是否指向 monorepo 根
2. Hub 中点击 AGENTS.md 跳转链接，确认 VSCode 能打开文件
