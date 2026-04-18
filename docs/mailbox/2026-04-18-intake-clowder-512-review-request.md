# Review Request: intake(clowder-ai#512) telemetry debug slice

Review-Target-ID: intake-clowder-512
Branch: fix/intake-clowder-512

## What
吸收 `clowder-ai#512` 已 merge 的 F153 Phase D slice：
- 新增 `TELEMETRY_DEBUG` / `TELEMETRY_DEBUG_FORCE` raw span 调试通道
- 在 `init.ts` 增加 default-deny guardrail（`shouldEnableDebugMode()`）和 debug-before-redactor pipeline
- 在 `env-registry.ts` 明确把两个调试变量锁出 Hub（`hubVisible: false` + `runtimeEditable: false`）
- 在 Unix / Windows 启动链上显式把 API child process 的 `NODE_ENV` 语义对齐到真实 launch mode
- 新增 `telemetry-debug.test.js`，并补 `start-dev-script.test.js` / `start-dev-profile-isolation.test.mjs` 回归
- 同步 F153 真相源和 quality gate 报告

## Why
这条社区 PR 已在 `clowder-ai` merge。回家 intake 的目标不是简单“把 debug exporter 带回来”，而是把它作为**受约束的维护者调试能力**吸收回来：raw span 只能在安全上下文开启，且 guardrail 必须与我们真实的 startup semantics 对齐，不能再让 `init.ts` 自己猜环境。

## Original Requirements（必填）
> Runtime 调试 exporter + 启动语义对齐（社区 PR intake）
> 1. `TELEMETRY_DEBUG` 调试通道
> 2. default-deny guardrail
> 3. Hub 锁定
> 4. 启动链语义对齐
- 来源：`docs/features/F153-observability-infra.md`
- **请对照上面的摘录判断：这次 absorbed 是否既把调试能力带回家，又避免了历次 intake 常见的 blind cherry-pick / manual-port 污染错误**

## Tradeoff
这次不是 `safe-cherry-pick` 整包吸收，而是 `3 safe + 4 manual-port`：
- 直接吸收：`init.ts`、`telemetry-debug.test.js`、`start-dev-script.test.js`
- manual-port：`env-registry.ts`、`start-dev.sh`、`start-windows.ps1`、`start-dev-profile-isolation.test.mjs`

我刻意没有把开源仓里的 public-profile / port / embed 相关脚本差异带回家，只移植和 `TELEMETRY_DEBUG` / `NODE_ENV` 语义直接相关的增量。代价是 absorb diff 比机械 cherry-pick 更需要 reviewer 对照；收益是不会把 clowder-ai 的外部发布默认值倒灌回 Cat Café。

## Open Questions
1. `cat-cafe#1250` 的 7 个 `absorb` 文件是否都在 `cat-cafe#1251` 里完整落地，没有漏项？
2. `scripts/start-dev.sh` / `scripts/start-windows.ps1` 的 manual-port 是否只带回了 `NODE_ENV` 语义，没有把 upstream 的 ports/embed/public wrapper 差异误带回家？
3. F153 真相源更新是否足够支撑后续 `--record --decision absorbed` + `--advance-ledger`，还是还缺审计锚点？

## Next Action
请对照 `cat-cafe#1250` 和 `cat-cafe#1251` 做 Intake Review Guard，确认：
1. 7 个 `absorb` 文件全部与逐文件决策表一致；
2. `manual-port` 边界收得对，没有 brand/public-only 污染；
3. 本轮验证证据足以支持后续 `record + advance-ledger`；
4. 通过后在 `cat-cafe#1251` 留 formal review/comment 放行。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/intake-clowder-512/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Feature：`docs/features/F153-observability-infra.md`
- Intake Intent Issue：`cat-cafe#1250`
- Quality Gate：`docs/mailbox/2026-04-18-intake-clowder-512-quality-gate.md`
- Community PR：`clowder-ai#512`
- Absorb PR：`cat-cafe#1251`
- `bash scripts/intake-from-opensource.sh --pr 512 --mode=plan` → `3 safe-cherry-pick + 4 manual-port`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`
- `rg --files designs 2>/dev/null | rg 'F153|observability|telemetry|debug'` → 无匹配
- Root artifact hygiene：无根目录媒体/设计工件命中

### 测试结果
- `pnpm --filter @cat-cafe/api run build` → success
- `cd packages/api && node --test test/telemetry/telemetry-debug.test.js test/start-dev-script.test.js` → `39 passed, 0 failed`
- `node --test scripts/start-dev-profile-isolation.test.mjs` → `16 passed, 0 failed`
- `pnpm check` → success
- `git diff --check` → clean

### 相关文档
- Feature：`docs/features/F153-observability-infra.md`
- Quality Gate：`docs/mailbox/2026-04-18-intake-clowder-512-quality-gate.md`
- Intake Intent：`cat-cafe#1250`
- Source Issue：`clowder-ai#456`
- Source PR：`clowder-ai#512`
- Absorb PR：`cat-cafe#1251`
