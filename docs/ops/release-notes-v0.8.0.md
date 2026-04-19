## Bug Fixes

- **fix(public-tests)**: public contract tests now run on compiled `dist/*.js`, removing the Node 20 `.ts` import breakage that blocked release CI.
- **fix(sync)**: temp-target validation installs no longer inherit production-only env, so public gate build/test steps get required devDependencies.
- **fix(api)**: `packages/api` build now copies marketplace catalog JSON through a cross-platform Node.js script instead of Unix-only shell commands.
- **fix(F061/F167)**: stream recovery and ball-ownership governance were hardened to preserve recoverable tails and avoid silent chain deadlocks.
- **fix(web/startup)**: ships the already-merged community fixes from clowder-ai#527, #528, and #529.

## Features

- **feat(F168)**: Community Operations Board Phase A-C — triage orchestration, dispatch controls, repo/time filtering, and Workspace-linked operations.
- **feat(F146)**: capability marketplace groundwork with curated catalog loaders and install-governance plumbing.
- **feat(F163)**: memory entropy-reduction groundwork and authority backfill improvements included in the public snapshot.

## Community

- Release-intended sync PR: `clowder-ai#538`
- Source snapshot tag: `clowder-v0.8.0-source`
- Sync baseline tag: `sync/2026-04-19-145655`
- No additional GitHub issues were newly closed during the release gate; this release bundles already-merged community PR work plus the new source-owned sync fixes.
- Full reconciliation report: `docs/ops/reconciliation-v0.8.0.md`

---

## 缺陷修复

- **fix(public-tests)**：公开契约测试改为走编译产物 `dist/*.js`，彻底消除 Node 20 下 `.ts` 导入导致的发版 CI 红灯。
- **fix(sync)**：temp target 验证安装不再继承 production-only 环境变量，公开门禁里的 build/test 能正确拿到 devDependencies。
- **fix(api)**：`packages/api` 的构建流程改用跨平台 Node.js 脚本复制 marketplace catalog JSON，不再依赖 Unix-only shell 命令。
- **fix(F061/F167)**：流恢复与球权治理继续加固，保留可恢复 tail，减少链路静默死锁。
- **fix(web/startup)**：包含已在社区仓合入的 #527、#528、#529 三条修复。

## 新功能

- **feat(F168)**：Community Operations Board Phase A-C —— 社区事务编排、派发控制、仓库/时间过滤、Workspace 联动。
- **feat(F146)**：能力市场基础设施继续推进，包含 curated catalog loaders 与安装治理底座。
- **feat(F163)**：记忆熵压缩 / authority backfill 的基础能力进入公开快照。

## 社区

- 本次 release-intended sync PR：`clowder-ai#538`
- source snapshot tag：`clowder-v0.8.0-source`
- sync baseline tag：`sync/2026-04-19-145655`
- 本轮 release gate **没有新增手工关单的 GitHub issue**；它发布的是已合入的社区 PR 修复，以及这次新完成的 source-owned sync 修复。
- 完整对账报告：`docs/ops/reconciliation-v0.8.0.md`
