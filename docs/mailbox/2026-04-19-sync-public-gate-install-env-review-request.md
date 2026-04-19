# Review Request: sync public gate install env sanitation

Review-Target-ID: sync-public-gate-install-env
Branch: fix/sync-public-gate-install-env (HEAD b7b34310a)

@opus

## What

- 在 `scripts/sync-to-opensource.sh` 的 `run_public_acceptance_env()` 中额外清除：
  - `NODE_ENV`
  - `npm_config_production`
  - `NPM_CONFIG_PRODUCTION`
- temp target public gate 的 `pnpm install --frozen-lockfile` 改为走 `run_public_acceptance_env`
- 在 `scripts/check-env-port-drift.test.mjs` 增加回归断言：
  - temp target install 必须通过净化 env helper 运行
  - helper 必须显式清掉 production install 相关变量

## Why

`fix(public-tests)` 合入 `main` 后，我按计划重跑 `v0.8.0` full sync。新的 source-owned public gate 红灯不在开源仓，而是在家里 sync pipeline 自己：

1. temp target 的 `pnpm install` 继承了外层 shell 的 `NODE_ENV=production`
2. devDependencies 被跳过
3. 随后 temp target 的 `pnpm check` / `api build` / `test:public` 因 `@types/ws`、`@types/better-sqlite3` 等缺失一起红

这是典型的 source-side gate 污染，不修家里，下次 full sync 还会原样回归。

## Original Requirements

> “那你不是又又又不完整干完！！又特么球掉地上了！！ 我滴笨蛋猫！ 你这个  --validate你得挂着跑啊！”
>
> “你就先把这个东西修了之后，合到我们家自己的 main，然后等我说你可以全量同步，你再全量同步。”
>
> “或者你可以先修一个社区的绿的 版本，然后这边等着，因为我估计可能还有其他的问题导致社区的CI不能绿，你就先把社区的 CI修到绿”

- 来源：当前 thread（2026-04-19）
- 相关真相源：
  - `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
  - `docs/lessons-learned.md`（source-owned public gate / 不在 target 手补）
- **请对照上面的摘录判断：这条修复是否确实把这次新的 source-owned public gate blocker 收回到家里解决，而不是继续把问题留在社区仓或停在半状态**

## Tradeoff

- 我没有把 scope 扩成“顺手解决 validate wrapper 为什么偶尔不写退出码”
- 我也没有继续推进 real full sync；按铲屎官指令，这轮只修这条 source-side blocker 并准备合回 `main`
- 这次只修安装环境污染，不碰 startup acceptance 的其他潜在慢路径

## Open Questions

1. `run_public_acceptance_env` 清掉这 3 个 production 相关变量，粒度是否合适？会不会误伤 temp target public gate 本该继承的变量？
2. 把 temp target install 也纳入 env 净化 helper，是否符合我们对 source-owned public gate 的职责边界？
3. 脚本级回归断言是否足够覆盖这次根因，还是 reviewer 认为还需要补更直接的 shell integration test？

## Next Action

- 请按 source-side sync blocker 的标准 review 这 2 个文件
- 如果放行，我下一步只做一件事：把这条修复合回 `main`
- 合回后我不会继续 full sync，等铲屎官明确下一步

## Review Sandbox

- Path: `/tmp/cat-cafe-review/sync-public-gate-install-env/opus`
- Start Command: `pnpm review:start`
- Ports: 自动分配（起点 3201/3202），禁止使用 3001/3002/3011/3012/4111

## 自检证据

### Spec / 边界合规

- 改动只落在 source repo 的 sync script + script test
- 没有改 `clowder-ai`
- 没有继续推进 full sync

### 验证命令输出

```bash
node --test scripts/check-env-port-drift.test.mjs
# 57 pass / 0 fail

# 失败前证据（修复前）
CLOWDER_AI_DIR=... bash scripts/sync-to-opensource.sh --yes
# temp target install:
#   devDependencies: skipped because NODE_ENV is set to production
# temp target build/test:public:
#   missing @types/ws / @types/better-sqlite3 / ...

# 修复后证据（validate partial progress）
CLOWDER_AI_DIR=... bash scripts/sync-to-opensource.sh --validate --yes
# temp target public gate 已推进到：
#   Installing dependencies... (不再出现 “devDependencies skipped ...”)
#   Biome check
#   TypeScript lint
#   Building
#   Smoke test (test:public) 进入主段
```

### 相关文件

- `scripts/sync-to-opensource.sh`
- `scripts/check-env-port-drift.test.mjs`
- context:
  - `docs/mailbox/2026-03-21-public-sync-shell-safe-brand-review-request.md`
  - `docs/mailbox/2026-04-18-public-test-contract-review-request.md`
