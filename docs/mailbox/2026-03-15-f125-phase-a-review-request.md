---
title: "Review Request: F125 Phase A - Alpha 验收通道基础设施改名"
date: "2026-03-15"
topic: "f125-phase-a-alpha-review-request"
reviewer: "opus"
feature_ids: [F125]
topics: [alpha, infra, review]
doc_kind: mailbox
---

# Review Request: F125 Phase A - Alpha 验收通道基础设施改名

## What
把原本本地验证通过的 `main-test` worktree 启动器正式收敛为 `alpha` 通道：

- 新增 `scripts/alpha-worktree.sh`
- 新增 `scripts/alpha-worktree.test.sh`
- `package.json` 新增 `pnpm alpha:init|sync|start|status|test`
- 兼容迁移旧的 `../cat-cafe-main-test` 路径和 `main-test/main-sync` 分支到 `../cat-cafe-alpha` / `alpha/main-sync`

## Why
铲屎官要一条长期可复用、和 runtime 完全隔离的 alpha 验收通道，用来验证最新 `main`，避免在 `3001/3002/6399` 的 runtime 上测试导致不稳定。

这轮只做 F125 Phase A 基础设施收敛，不碰 SOP / skill / 提示词；那些由布偶猫接 Phase B。

## Original Requirements
> "我要！给他搞个一键启动脚本！然后和 runtime 那样每次启动自动同步 main！"
>
> "我希望这个变成一个 alpha 测试的分支"

- 来源：`docs/features/F125-alpha-test-channel.md`
- **请对照上面的摘录判断：这轮 Phase A 是否已经把 main-test 升级成可长期复用的 alpha 基础设施**

## Tradeoff
- 保留了对旧 `main-test` 目录、旧 `main-test/main-sync` 分支、旧 `CAT_CAFE_MAIN_TEST_*` 环境变量的兼容读取，换来一次无痛迁移
- 没有在这轮顺手改 feature 分支名或 launcher worktree 目录名，因为它们不是产品/运行时接口，不影响 alpha 通道本身

## Open Questions
- 旧 `main-test` 的兼容迁移边界是否合适：路径迁移、分支重命名、旧 env var fallback 三层是否都该保留
- `alpha-worktree.sh` 的命令面是否足够对齐 `runtime-worktree.sh`，尤其是 `sync/status/start` 的行为一致性

## Next Action
请 review `35b80a17`，重点看：

- alpha 命名是否收敛完整
- legacy `main-test` 迁移逻辑是否安全
- 这轮是否已经满足 F125 Phase A 的 AC

## 自检证据

### Spec 合规
Spec：`docs/features/F125-alpha-test-channel.md`

- AC-A1 `pnpm alpha:start`：
  已真实启动 `/Users/lysander/projects/relay-station/cat-cafe-alpha`，端口为 `3011/3012/4111/6398`
- AC-A2 `pnpm alpha:sync`：
  `alpha-worktree.test.sh` 的 `test_init_and_sync_alpha_worktree_ff_only` 覆盖 ff-only 同步
- AC-A3 `pnpm alpha:status`：
  真实输出包含 `api_running: yes`
- AC-A4 `pnpm alpha:test`：
  本轮全绿
- AC-A5 自动迁移旧 `main-test`：
  `alpha-worktree.test.sh` 的 `test_migrate_legacy_main_test_worktree_to_alpha_location` 覆盖目录迁移 + 分支重命名；
  真实环境也已从 `../cat-cafe-main-test` 迁到 `../cat-cafe-alpha`

设计稿对照：➖ 无 UI 代码改动  
Artifact Hygiene：仓库根目录未跟踪媒体文件 `0`

### 测试结果
```bash
pnpm alpha:test
```

结果：全部通过

```text
PASS: usage documents alpha commands
PASS: alpha env exports are fixed to isolated defaults
PASS: init + sync fast-forward alpha worktree
PASS: ensure_alpha_branch repairs detached worktree
PASS: legacy main-test worktree migrates to alpha location
PASS: resolve_env_source_file falls back to sibling cat-cafe/.env
PASS: is_api_running checks the configured alpha api port
```

### 运行态验证
```bash
./scripts/alpha-worktree.sh status
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3011
curl -fsS http://127.0.0.1:3012/api/preview/status
```

结果：

```text
alpha worktree: /Users/lysander/projects/relay-station/cat-cafe-alpha
branch: alpha/main-sync
ahead_of_origin/main: 0
behind_origin/main: 0
api_running: yes
frontend_port: 3011
api_port: 3012
preview_gateway_port: 4111
redis_port: 6398
env_source: /Users/lysander/projects/relay-station/cat-cafe/.env
```

```text
200
```

```json
{"available":true,"gatewayPort":4111}
```

### 相关文档
- Feature: `docs/features/F125-alpha-test-channel.md`
