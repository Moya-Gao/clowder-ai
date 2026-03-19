---
feature_ids: [F113]
topics: [review-request, windows, intake, opensource, deploy]
doc_kind: review-request
created: 2026-03-19
author: gpt52
reviewer: opus
---

# Review Request: F113 Phase C — absorb clowder-ai#113 Windows intake + public port normalization

Review-Target-ID: f113
Branch: feat/f113-windows-intake
Head: 2a53a93c

## What

把 `clowder-ai#113` 的 Windows 一键部署 / 启停 / CLI spawn 修复吸回家里，并在 manual-port 时收口两条真相源：

1. 家里 runtime 继续保持 `Frontend 3001 / API 3002 / Redis 6399`
2. 开源出口统一锁成 `Frontend 3003 / API 3004 / Redis 6399`

这轮是 `33` 个文件的 intake，核心面包括：
- 新增 Windows 脚本：`install.ps1`、`start-windows.ps1`、`stop-windows.ps1`、`windows-installer-ui.ps1`、`windows-command-helpers.ps1`
- 新增 Windows CLI shim 解析与测试：`packages/api/src/utils/cli-spawn-win.ts`
- 修正 sync 真相源：`scripts/sync-to-opensource.sh`
- 修正文档真相源：`docs/open-source-status.md`、`docs/design/naming-contract.md`
- ledger 记账：`docs/ops/opensource-intake-ledger.json` 已记录 `PR #113 -> absorbed`

另外补了两个 gate 收尾 commit：
- `f9b49107`：`env-registry` 格式修正
- `2a53a93c`：Windows Redis 回归测试格式修正

## Why

`clowder-ai main` 现在公开口径是反的，Windows 线又是长分支 merge；如果不先把 `#113` 收回我们家真相源，再做 full outbound sync，后面很容易继续把公开仓端口/Redis 带偏。

这轮目标不是“宣称 F113 全部完成”，而是把 Phase C 的社区实现吸回家里、按我们的端口与 Redis 约定归一，然后为下一步 outbound sync 做干净基座。

## Original Requirements（必填）

> "增加Windows&Linux&mac的裸机(仅能联网+proxy)支持脚本一件安装和启动;"

- 来源：`https://github.com/zts212653/clowder-ai/issues/14`
- 关联讨论：`docs/discussions/2026-03-13-f059-cep-numbering-and-community-governance.md`
- Spec：`docs/features/F113-multi-platform-one-click-deploy.md`
- **请对照上面的摘录判断：这轮 Windows intake + 公开口径归一，是否准确推进了 F113 Phase C，而没有把家里的真相源带偏**

## Tradeoff

1. **先 absorb，再 sync，不先修 ledger 脚本**
   `--advance-ledger` 目前按 commit 粒度卡历史区间；这是工具模型问题，不该反向阻塞 `#113` intake 和公开仓口径修正。

2. **不在这轮顺手清热区旧债**
   `threads.ts`、`projects.ts`、`CodexAgentService.ts`、`ClaudeAgentService.ts` 等热区在 `origin/main` 本来就有 Biome 旧诊断。这轮只修 intake 新带进来的格式红灯，不借题扩 scope。

3. **F113 仍保持 in-progress**
   Linux / macOS Phase A/B 不是这轮目标；这次只把 Windows Phase C 的社区实现吸回家里，并把开源出口口径锁正。

## Open Questions

1. `scripts/sync-to-opensource.sh` 这轮对 Windows 文件的 manual-port 是否把公开口径稳定锁在 `3003/3004/6399`，且不会再把 Redis 误写成 `6379`？
2. Windows 脚本与 CLI spawn 的吸收是否保住了家里 runtime 语义，没有把内部 `3001/3002/6399` 带偏？
3. `projects.ts` / `project-path.ts` / `shared-state-preflight.ts` 这些围绕目录与共享状态的 manual-port，有没有因为 intake 扩大边界？
4. ledger 这轮只 `record` 不 `advance` 是否合理？我的判断是合理，因为脚本现在误把历史长分支的多 commit 当成“53 条未登记社区变更”。

## Next Action

请按纯代码 review 看这条 intake 是否可放行。重点看：
- public 口径：`Frontend 3003 / API 3004 / Redis 6399`
- home 口径：`Frontend 3001 / API 3002 / Redis 6399`
- Windows 脚本 / sync 规则 / Redis 默认值有没有互相打架

放行后我直接进 merge-gate，把这条线合回 `cat-cafe main`，然后立刻做 outbound sync 修正 `clowder-ai main`。

## 自检证据

### Spec 合规
- F113 Spec：`docs/features/F113-multi-platform-one-click-deploy.md`
- 本轮范围：Phase C Windows intake，不是整条 F113 完成声明
- 对齐结果：
  - AC-3（Windows 用户有明确引导）这轮推进为 ✅ 基座：Windows 安装/启动/停止脚本 + installer UI + auth config 脚本已吸回
  - AC-4（幂等 / 重复运行不破坏）这轮推进为 ✅ 基座：Windows installer / startup / portable Redis / env 覆盖回归已补
  - 开源口径归一：`Frontend 3003 / API 3004 / Redis 6399` 已锁入 sync 规则与 drift test

### 设计稿对照（Step 5）
- `glob designs/**/*.pen` 命中：`designs/f113-cross-platform-directory-picker.pen`
- 结论：➖ 当前分支无 `packages/web` 改动；这轮是 Phase C Windows/scripts/API intake，不是 Phase D UI 改动，因此设计稿对照不适用

### Artifact Hygiene（Step 7.5）
- 仓库根目录未跟踪媒体文件：无 ✅

### 测试结果
```bash
pnpm --filter @cat-cafe/api build
# ✅ success

node --test scripts/check-env-port-drift.test.mjs \
  packages/api/test/project-path.test.js \
  packages/api/test/pick-directory.test.js \
  packages/api/test/runtime-worktree-script.test.js \
  packages/api/test/claude-agent-service.test.js \
  packages/api/test/codex-agent-service.test.js \
  packages/api/test/cli-spawn-win.test.js \
  packages/api/test/install-auth-config-script.test.js \
  packages/api/test/install-auth-config-env.test.js \
  packages/api/test/windows-portable-redis-tools.test.js \
  packages/api/test/windows-portable-redis-url.test.js \
  packages/api/test/windows-portable-redis-lifecycle.test.js
# 227 passed, 0 failed ✅

node --test \
  packages/api/test/windows-portable-redis-tools.test.js \
  packages/api/test/windows-portable-redis-url.test.js \
  packages/api/test/windows-portable-redis-lifecycle.test.js
# 50 passed, 0 failed ✅

bash -n scripts/install.sh && bash -n scripts/runtime-worktree.sh && bash -n scripts/setup.sh
# ✅ success

pnpm exec biome check \
  docs/design/naming-contract.md \
  docs/features/F113-multi-platform-one-click-deploy.md \
  docs/open-source-status.md \
  docs/ops/opensource-intake-ledger.json \
  packages/api/src/config/env-registry.ts \
  packages/api/src/utils/cli-spawn-win.ts \
  packages/api/src/utils/project-path.ts \
  packages/api/test/cli-spawn-win.test.js \
  packages/api/test/install-auth-config-env.test.js \
  packages/api/test/install-auth-config-script.test.js \
  packages/api/test/project-path.test.js \
  packages/api/test/runtime-worktree-script.test.js \
  packages/api/test/windows-portable-redis-tools.test.js \
  packages/api/test/windows-portable-redis-url.test.js \
  packages/api/test/windows-portable-redis-lifecycle.test.js \
  scripts/check-env-port-drift.test.mjs \
  scripts/install-auth-config.mjs \
  scripts/install-windows-helpers.ps1 \
  scripts/install.ps1 \
  scripts/start-windows.ps1 \
  scripts/start.bat \
  scripts/stop-windows.ps1 \
  scripts/sync-to-opensource.sh \
  scripts/windows-command-helpers.ps1 \
  scripts/windows-installer-ui.ps1
# 0 errors, only 1 inherited complexity warning in cli-spawn-win.ts ✅
```

### Biome 旧债说明
- diff-wide touched-file `biome check` 仍会扫出 `origin/main` 已存在的热区旧诊断：
  - `packages/api/src/config/shared-state-preflight.ts`
  - `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts`
  - `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts`
  - `packages/api/src/routes/capabilities.ts`
  - `packages/api/src/routes/projects.ts`
  - `packages/api/src/routes/provider-profiles.ts`
  - `packages/api/src/routes/threads.ts`
  - `packages/api/src/utils/cli-spawn.ts`
- 我这轮已修掉 intake 新带进来的两条格式红灯：
  - `packages/api/src/config/env-registry.ts`
  - `packages/api/test/windows-portable-redis-tools.test.js`
  - `packages/api/test/windows-portable-redis-url.test.js`
  - `packages/api/test/windows-portable-redis-lifecycle.test.js`

### 相关文档
- Feature: `docs/features/F113-multi-platform-one-click-deploy.md`
- Discussion: `docs/discussions/2026-03-13-f059-cep-numbering-and-community-governance.md`
- Open-source status: `docs/open-source-status.md`
- Ledger: `docs/ops/opensource-intake-ledger.json`
