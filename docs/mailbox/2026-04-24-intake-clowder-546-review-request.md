# Review Request: intake(clowder-ai#546) F153 Phase E implementation

Review-Target-ID: intake-clowder-546
Branch: fix/intake-clowder-546

## What
吸收 `clowder-ai#546` 的 F153 Phase E implementation：
- telemetry API routes
- LocalTraceStore / LocalTraceExporter / MetricsSnapshotStore
- burn-rate monitor
- Hub observability UI
- telemetry tests

本轮 intake 结果是 `28 safe-cherry-pick + 2 manual-port`。

## Why
`clowder-ai#546` 已经 merge 到上游 `main`（merge commit `59ebc985053055b7071f324d06501cb3c90d7129`），如果不回家吸收，双仓的 telemetry / Hub observability 路径会继续漂移。

## Original Requirements
> “那你走intake 回家的流程吧，merge 然后读sop 走流程回家 记得一定要好好看看intake skills 大多数猫猫都会犯错”
- 来源：当前 thread `thread_mo89w0xb209b8rcu`
- 请对照上面的原话判断：这次 intake 是否既把 `clowder-ai#546` 吸回家里，又守住了我们自己的真相源和当前主线约束

## Tradeoff
- 没有把当前 `main` 上无关的 baseline 问题（`F172` 缺 BACKLOG、`ANTIGRAVITY_BRAIN_HOME` 未注册、antigravity 目录里的 Biome 红灯）顺手塞进这条 intake PR
- 但为让 absorb 版本能在家里编译，我补了两个**与本次 intake 直接相关**的集成修正：
  - `await registry.create()`
  - 删掉已退休的 `role-gate` 依赖/分支

## Open Questions
1. 这两个 cat-cafe-side integration fix 是否都是“吸收上游切片所必需的最小修正”，没有越界扩大 scope？
2. `docs/features/F153-observability-infra.md` 和 `packages/api/src/config/env-registry.ts` 的 manual-port 是否保留了家里的文风/默认值，同时准确吸收了 upstream 的新内容？
3. 在 full gate 仍被无关 baseline 问题挡住的情况下，你是否认同这条 intake PR 已经达到 code-review-ready？

## Next Action
请直接 review `cat-cafe#1372`，重点对照上面的 3 个问题和 `cat-cafe#1371` 的逐文件决策表。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-546/opencode`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Intake plan：`bash scripts/intake-from-opensource.sh --pr 546 --mode=plan` → `28 safe-cherry-pick + 2 manual-port`
- Brand Guard：`bash scripts/intake-from-opensource.sh --validate-inbound` → pass
- Intent Issue：`cat-cafe#1371`
- Absorb PR：`cat-cafe#1372`

### 测试结果
- `pnpm --filter @cat-cafe/api build` → pass（在修正 `await registry.create()` + retired role-gate 后）
- `node --test packages/api/test/telemetry/burn-rate-monitor.test.js packages/api/test/telemetry/local-trace-exporter.test.js packages/api/test/telemetry/local-trace-store.test.js packages/api/test/telemetry/metrics-snapshot-store.test.js packages/api/test/telemetry/telemetry-routes.test.js` → `65 passed, 0 failed`
- `pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/hub-observability-health-503.test.ts` → `4 passed, 0 failed`
- `pnpm lint` → pass（warnings only）

### Known Baseline Blockers
- `pnpm check` 仍被非 diff 的 antigravity Biome 问题挡住
- `pnpm check:features` 仍被当前 `main` 上 `F172` 缺 BACKLOG 挡住
- `pnpm check:env-registry` 仍被当前 `main` 上 `ANTIGRAVITY_BRAIN_HOME` 未注册挡住

### 相关文档
- Feature: `docs/features/F153-observability-infra.md`
- Source PR: `clowder-ai#546`
- Intent Issue: `cat-cafe#1371`
