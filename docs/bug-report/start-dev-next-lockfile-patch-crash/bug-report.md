# Bug Report: start-dev 启动 Next.js 时 lockfile patch 崩溃

> **报告人**: 铲屎官
> **定位猫猫**: 缅因猫 🐾
> **报告日期**: 2026-02-09
> **严重程度**: P1（开发环境启动失败）
> **状态**: 修复中

---

## 1. 报告人

- 报告人：铲屎官
- 发现方式：执行 `/Users/lysander/projects/relay-station/cat-cafe/scripts/start-dev.sh` 后，Frontend 启动阶段报错并中断

---

## 2. 复现步骤（期望 vs 实际）

### 复现步骤

1. 在仓库根目录执行 `scripts/start-dev.sh`。
2. 脚本构建 `shared` 和 `api` 成功。
3. 启动 `packages/web` 的 Next.js dev server。
4. 观察到 Next 打印：`Found lockfile missing swc dependencies, patching...` 后抛异常。

### 期望行为

- Frontend 正常启动，输出 `Ready` 并持续运行。
- 不应在 pnpm 工作区触发 npm `package-lock` 自动 patch 流程。

### 实际行为

- Next 在 patch lockfile 阶段崩溃：
  - `Failed to patch lockfile, please try uninstalling and reinstalling next in this workspace`
  - `TypeError: Cannot read properties of undefined (reading 'os')`
- 结果是前端无法稳定启动，开发链路中断。

---

## 3. 根因分析

### 3.1 事实证据

- 仓库使用 `pnpm`（根 `package.json` 含 `packageManager: pnpm@8.15.0`，且存在 `pnpm-lock.yaml`）。
- 仓库中同时存在并被追踪的 `packages/web/package-lock.json`。
- Next 14.2.35 的 `patch-incorrect-lockfile.js` 在检测到 `package-lock.json` 时会尝试补齐 SWC 依赖。
- 当前 lockfile 中 SWC 版本与 Next 预期映射不一致，patch 逻辑访问空值导致 `versionData.os` 报错。

### 3.2 根因结论

这是一个**包管理器混用导致的启动链路故障**：

1. pnpm workspace 下残留 npm lockfile（`packages/web/package-lock.json`）
2. Next 误判为需修补 npm lockfile
3. patch 逻辑在版本映射不一致时崩溃
4. Frontend 启动失败

---

## 4. 修复方案（直接修复，不止血）

### 4.1 方案选择

采用“根因消除 + 运行时防护”双保险：

1. **根因消除**：移除并停止追踪 `packages/web/package-lock.json`，避免 pnpm 项目继续携带 npm 锁文件。
2. **运行时防护**：`start-dev.sh` 启动 frontend 前执行 lockfile 清理，并设置 `NEXT_IGNORE_INCORRECT_LOCKFILE=1`，确保 Next 不进入该 patch 路径。
3. **回归测试**：在脚本测试中增加 `sanitize_lockfiles` 用例，防止后续回归。

### 4.2 放弃方案

- 只告诉用户“重装 next / 删除 node_modules”：治标不治本，后续仍可能复发。
- 仅依赖 `NEXT_IGNORE_INCORRECT_LOCKFILE`：若有人绕过脚本直接启动，仍可能踩到残留 lockfile。

---

## 5. 验证方式

计划执行以下验证：

1. `bash scripts/test-start-dev.sh`：验证 shell 级回归（含 lockfile 清理测试）。
2. `scripts/start-dev.sh`：确认 Frontend 启动不再出现 lockfile patch 崩溃。
3. `git status`：确认仓库不再追踪 `packages/web/package-lock.json`。

通过标准：

- 启动日志中不出现 `Failed to patch lockfile`。
- Frontend 能保持 `Ready` 状态。

---

*签名: 缅因猫 🐾*
