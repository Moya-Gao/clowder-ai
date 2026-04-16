# Review Request: intake clowder-ai#497 telemetry runtime coverage

Review-Target-ID: intake-clowder-497
Branch: fix/intake-clowder-497

## What
Absorb `clowder-ai#497` into `cat-cafe` via safe cherry-pick. This brings over the extracted `span-helpers.ts` helper, rewires `invoke-single-cat.ts` to delegate `llm_call` / `tool_use` instrumentation to those helpers, and adds runtime telemetry coverage plus the matching structural test update.

## Why
`clowder-ai#497` is already maintainer-reviewed and merged on the community side for accepted issue `clowder-ai#456`. The intake plan classifies all 4 touched files as `safe-cherry-pick`, so the home-side job is to verify behavior parity against Intake Intent Issue `#1217`, then let the reviewer run the Intake Review Guard before we record/advance the ledger.

## Original Requirements
> Runtime test creates real spans via InMemorySpanExporter
> Parent-child span relationships verified (invocation → cli_session, invocation → llm_call)
> Span attributes verified (cli.command, cli.pid, gen_ai.usage.*)
> tool_use events verified on invocation span
> All tests pass with `pnpm check`
- 来源：`clowder-ai#456`
- 请对照上面的摘录判断这次 absorb 是否完整复现了社区 PR 的行为变化，而不是只看“文件在不在”

## Tradeoff
这次 intake 保持和社区 squash commit 等价，没有额外重构，也没有提前执行 `--record/--advance-ledger`。原因是 playbook 明确要求 reviewer 先按 Intent Issue 做 file-level / behavior-level 验收，review 通过后才能推进 ledger 水位。

## Open Questions
1. `packages/api/src/infrastructure/telemetry/span-helpers.ts` 的抽取粒度是否足够作为“真实 instrumentation path”，还是还需要 reviewer 明确要求更进一步贴近 `invokeSingleCat()` 整体流程？
2. `docs/ops/opensource-intake-ledger.json` 这次尚未更新。请 reviewer 明确确认 `#1217` 的逐文件决策表和 `cat-cafe#1218` 的 diff 一一对应，然后我们再执行 `--record --decision absorbed` + `--advance-ledger`。

## Next Action
请 reviewer 对照 `#1217` 做 Intake Review Guard：
- 每个 `absorb` 文件都有对应改动
- 社区 PR 的每个行为变化都在家里复现
- 验证通过后在 `cat-cafe#1218` 留 formal review/comment 放行

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-497/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Intake Intent Issue：`cat-cafe#1217`
- Intake plan：`bash scripts/intake-from-opensource.sh --pr 497 --mode=plan`
- 分类结果：4 个文件全部 `safe-cherry-pick`，0 manual，0 public-only
- `.pen` 设计稿：无匹配；本次无前端 UI 变更
- Artifact hygiene：仓库根目录媒体/设计工件检查为空

### 测试结果
- `pnpm build` → success
- `pnpm check` → success
- `pnpm lint` → success
- `node --test packages/api/test/telemetry/otel-tracing-llm-runtime.test.js packages/api/test/telemetry/otel-tracing-phase-b.test.js packages/api/test/telemetry/otel-tracing-runtime.test.js` → 45 passed, 0 failed

### 相关文档
- Intake Intent Issue: `cat-cafe#1217`
- Absorb PR: `cat-cafe#1218`
- Source PR: `clowder-ai#497`
- Source Issue: `clowder-ai#456`
