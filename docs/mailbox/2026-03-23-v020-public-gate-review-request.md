# Review Request: v0.2.0 Public Gate Validate Hardening

## What
- 修复 `scripts/sync-to-opensource.sh --validate` 的两类 harness 问题：`test:public` 全量输出先落日志再 tail，失败时不再只剩 5 行尾巴；temp target public gate 传给 `PROJECT_ALLOWED_ROOTS` 的路径改为 physical path，避免 macOS `/var` ↔ `/private/var` 别名导致 allowlist 误判。
- 加固 tmux stale-server 自愈：`TmuxGateway.createPane()` 在 cached server 死亡和 fresh gateway 遇到 stale socket / `server exited unexpectedly` 时都能重建 detached session。
- 补齐 source-owned 回归：`check-env-port-drift.test.mjs` 守住 validate 合约，`runtime-worktree-script.test.js` 固定 API 端口环境，`tmux-gateway.test.js` 覆盖 stale server 两条恢复路径。
- 更新 `workspace-navigator` skill，去掉公开文档里的 home-only `3002` 硬编码，改成运行态 `API_SERVER_PORT` 指引。

## Why
- 这条修复是 `clowder-ai v0.2.0` full sync 的前置。没有它，`--validate` 会在 source-owned public gate 阶段反复给出假阴性或不可观测失败，导致我们把时间花在重跑和猜测上，而不是定位真实 blocker。
- 当前 root cause 已经实锤：同一个 temp target 下，`PROJECT_ALLOWED_ROOTS=/var/...` 会让 `agent-router` 的 `workingDirectory` 断言失败；换成 physical path `/private/var/...` 立刻转绿。

## Original Requirements
> “你得先确定家里的基线是绿的……你得先把它修成绿的，然后你才能发。”  
> “通过之后你得修复 sync-to-opensource.sh --validate？先修这个，避免这次发完版本忘记修了，导致每次都要定位半天结果是同步脚本的问题？”
- 来源：thread message `0001774305291331-000048-5913583d` / `0001774317507934-000028-9deb4fc0`
- **请对照上面的摘录判断交付物是否真的把 release gate 修到可持续使用，而不是只让这一次侥幸过线。**

## Tradeoff
- 这轮没有顺手泛化 `project-path` 工具本身的 symlink-root 规范化，而是先修 validate 入口传参，因为 blocker 发生在 sync harness，且这条路径是当前 release 的真阻塞点。更广义的 env root canonicalization 可以后续单开。
- `test:public` 输出改成先落盘再 tail，日志处理稍微啰嗦一点，但换来失败面可观测，不再被管道吞掉上下文。

## Open Questions
- 请重点看：把 temp target allow-root canonicalize 到 physical path，是否是这层问题最合适的修复边界。
- 请重点看：`TmuxGateway.createDetachedSession()` 现在同时覆盖 cached stale server 和 fresh stale socket 两条恢复路径，是否还有遗漏的崩溃文案分支。

## Next Action
- 请 `@opus` review 这条 source-owned 修复，重点看 `scripts/sync-to-opensource.sh`、`packages/api/src/domains/terminal/tmux-gateway.ts` 和新增回归测试是否足够。

Review-Target-ID: `fix-v020-public-gate`
Branch: `fix/v020-public-gate`
Commit: `354f2e20`

## 自检证据

### Spec 合规
- 对齐对象：`docs/plans/2026-03-13-f059-sync-hardening.md` 的 `--validate` / public gate 目标，外加铲屎官在当前 thread 明确追加的“先把家里的基线修绿，再修 validate 本身”要求。
- 本轮没有新增用户功能，属于 release/source-owned infrastructure hardening；交付边界是让 `sync-to-opensource.sh --validate` 在 fresh temp target 上可重复通过，并且失败时给出完整日志。
- `.pen` 设计稿对照：不适用（无前端 UI 交付）。

### 测试结果
- `pnpm exec node --test scripts/check-env-port-drift.test.mjs` → `52/52 pass`
- `bash -n scripts/sync-to-opensource.sh` → `exit 0`
- `pnpm --filter @cat-cafe/api exec node --test test/runtime-worktree-script.test.js` → `8/8 pass`
- `pnpm --filter @cat-cafe/api exec node --test test/tmux-gateway.test.js` → `13/13 pass`
- `CLOWDER_AI_DIR=/Users/lysander/projects/relay-station/clowder-ai bash scripts/sync-to-opensource.sh --validate` → `✓ Validate passed`
- 对照复验：
  - `PROJECT_ALLOWED_ROOTS=/var/...` + `agent-router.test.js` 指定断言 → `FAIL`
  - `PROJECT_ALLOWED_ROOTS=/private/var/...` 同一断言 → `PASS`

### 相关文档
- Plan: `docs/plans/2026-03-13-f059-sync-hardening.md`
- Feature: `docs/features/F059-open-source-plan.md`
