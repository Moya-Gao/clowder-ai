# Review Request: intake(clowder-ai#495) 首装 / auth-root / Hub 账号真相回流

Review-Target-ID: intake-clowder-495
Branch: fix/intake-clowder-495

## What
- 吸收 `clowder-ai#495` 里对我们有价值的 inbound 修复，覆盖三块：
- 首装交互：`scripts/install.sh` / `scripts/install.ps1` 增补 TTY 数字选择、箭头键兼容、Kimi 可跳过、Puppeteer 下载失败回退。
- config root 对齐：`scripts/install-auth-config.mjs`、`scripts/runtime-worktree.sh`、Windows helper 链路补 runtime-aware auth root / seed 行为。
- Hub 账号真相：`packages/web/src/components/hub-accounts.view.ts` / `HubAccountsTab.tsx` 不再合成 ghost builtin placeholder，只规范真实账号。
- 增补回归测试：installer auth root、TTY fallback、runtime seed、Windows auth/install 分支、Hub account truthfulness。

## Why
- 铲屎官明确要求我们先合 upstream，再走 intake 回家流程，而且特别点名 “以前每次 intake 都容易出错”，这次不能 blind cherry-pick。
- 这张 upstream PR 修的是我们自己已确认存在的痛点，不是社区自嗨 patch：
- 首装 Kimi/TTY 卡死、installer 写 project root 而 runtime 读 runtime root、Hub 伪造未配置 builtin 账号。

## Original Requirements（必填）
> “那你帮他合入一下然后走intake流程？”
> “那你走intake 回家的流程吧，merge 然后读sop 走流程回家”
> “记得一定要好好看看intake skills 大多数猫猫都会犯错”
- 来源：当前 thread `0001776437539903-000355-6a6f06ec`
- **请对照上面的摘录判断：我这次 intake 是否既吸收了上游价值，又避免了历次 intake 常见的 blind cherry-pick / manual-port 混淆错误**

## Tradeoff
- 没有直接照抄 upstream 的 opensource 包装层改动。
- 明确保留为 manual-port / 不吸收：
- `--profile=opensource`、3003/3004 端口语义、严格 public defaults 相关外层包装。
- `.env.example` 没有跟着 upstream 改；这里维持我们仓当前 truth source，不把开源仓 public-facing 示例直接带回家。
- Windows / shell / runtime 相关改动只吸收行为本身，不吸收开源仓专用约束。

## Open Questions
- `scripts/install.*`、`scripts/runtime-worktree.sh`、`install-auth-config.mjs` 这组 manual-port 的边界是否收得对，有没有把 upstream 的 public-profile 语义误带回家。
- Hub 账号页现在只展示真实 builtin + 真实已配置账号；请重点看这是否完整覆盖了 “不造 ghost state” 的要求。
- Kimi builtin 没被伪造回 UI，但 installer auth 里已经支持 `kimi|moonshot`；这个分层是否合理。

## Next Action
- 请按 intake 视角 review：不是审“和 upstream 一不一样”，而是审“我们是否正确吸收了上游价值，同时守住了本仓自己的架构/环境约束”。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/intake-clowder-495/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- upstream 已合入：`zts212653/clowder-ai#495` 已 `--admin squash merge`
- internal intake tracking：`cat-cafe#1234`
- inbound 采用逐文件决策：前端/测试直接 absorb，installer/runtime/Windows helpers 走 manual-port，不做 blind cherry-pick。
- 浏览器实测已完成：生产模式下 `http://localhost:3111` 的 Hub「账号配置」页成功请求本地 `http://localhost:3102/api/session`（200），并确认：
- 存在 `Claude (OAuth)` / `Dare (client-auth)` / `OpenCode (client-auth)`
- **不存在** `Kimi (OAuth)` ghost placeholder
- 截图：`/tmp/cat-cafe-intake-495-evidence/cat-cafe-intake-495-hub-accounts.png`

### 测试结果
```bash
node --test \
  packages/api/test/install-auth-config-script.test.js \
  packages/api/test/install-script-env.test.js \
  packages/api/test/install-script-tty.test.js \
  packages/api/test/runtime-worktree-script.test.js \
  packages/api/test/windows-installer-auth.test.js \
  packages/api/test/windows-portable-redis-tools.test.js \
  packages/api/test/windows-portable-redis-url.test.js
# 113 passed, 0 failed

pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/cat-cafe-hub-accounts-tab.test.ts
# 12 passed, 0 failed

pnpm check
# passed

pnpm -r --if-present run build
# passed（仅现存 hardcoded-color warnings，无新错误）

bash scripts/intake-from-opensource.sh --validate-inbound
# No brand violations detected. Safe to commit.
```

### 相关文档
- Intake issue: `cat-cafe#1234`
- Upstream PR: `zts212653/clowder-ai#495`
- Upstream accepted issue: `zts212653/clowder-ai#519`
