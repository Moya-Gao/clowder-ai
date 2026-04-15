# Review Request: intake(clowder-ai#458) cli_session runtime tracing tests

Review-Target-ID: intake-clowder-458
Branch: fix/intake-clowder-458

## What
吸收 `clowder-ai#458` 已 merge 的 tests-only slice：
- 新增 `packages/api/test/telemetry/otel-tracing-runtime.test.js`
- 用 `InMemorySpanExporter` 验证 `cat_cafe.cli_session` 的真实 span 产出
- 覆盖 parent-child 关系、属性、status，以及 redactor-safe key 约束

## Why
这条社区 PR 已被 maintainer 收窄为单一切片：它不再改变 telemetry 生产语义，只补 `cli_session` 的 runtime exporter-level tests。回家 intake 的目标是把这个干净切片准确吸收，减少双仓在 F153 tracing 测试面上的漂移。

## Original Requirements
> Runtime exporter 级 tracing tests（in-memory exporter 验证父子关系）

- 来源：[`docs/features/F153-observability-infra.md`](../features/F153-observability-infra.md)
- 对应社区 issue：`clowder-ai#456`
- **请对照上面的摘录判断交付物是否满足这次 intake 的目标范围**

## Tradeoff
我没有把这次 intake 扩成“顺手补完 `llm_call` / `tool_use` / redaction runtime coverage”。
取舍是：保持与 `clowder-ai#458` 已 merge 边界完全一致，只吸收 `cli_session` runtime-test slice；代价是 `clowder-ai#456` 继续保持 open，后续 coverage 另做。

## Open Questions
- 我吸收的文件集合是否与 `cat-cafe#1187` 的逐文件决策表完全一致，没有漏项或越界？
- 这 6 个 runtime tests 在我们家当前 `origin/main` 基线上是否已经足够证明本切片可 absorbed？
- 以 reviewer 视角看，这条 absorb PR 是否还需要额外扩大验证面，还是已经满足 “tests-only slice” 的 review guard？

## Next Action
请对照 `cat-cafe#1187` 和 PR `#1188` 做 formal review，确认：
1. 唯一 `absorb` 文件已经完整落地；
2. 没有把 `clowder-ai#458` 已剥离的生产语义改动重新带回家；
3. 现有验证证据足以支持后续 `record + advance-ledger`。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-458/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Intake Intent Issue：`cat-cafe#1187`
- Community PR：`clowder-ai#458`
- Absorb PR：`cat-cafe#1188`
- `bash scripts/intake-from-opensource.sh --pr 458 --mode=plan` → 1 个文件，全部分类为 `safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`
- 本次无 `packages/web/**` 变更，`.pen` 设计稿对照不适用
- Root artifact hygiene：无根目录媒体/设计工件命中

### 测试结果
- `pnpm check` → success
- `pnpm --filter @cat-cafe/api lint` → success
- `node --test packages/api/test/telemetry/otel-tracing-runtime.test.js` → `6 passed, 0 failed`
- `git diff --check` → clean

### 相关文档
- Feature：`docs/features/F153-observability-infra.md`
- Intake Intent：`cat-cafe#1187`
- Source Issue：`clowder-ai#456`
- Source PR：`clowder-ai#458`
- Absorb PR：`cat-cafe#1188`
