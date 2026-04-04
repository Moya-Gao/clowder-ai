# Review Request: F150 intake absorb from clowder-ai#286 + #295

## What

把社区 F150 Tool/Skill/MCP Usage Statistics 两条已合并 PR 吸收到家里：

- `clowder-ai#286` Phase A：分类、计数、聚合 API、路由埋点
- `clowder-ai#295` Phase B：archive、all-time 查询、Hub Tool Usage UI

当前分支 / PR：

- Review-Target-ID: `intake-clowder-f150`
- Branch: `feat/intake-clowder-f150`
- PR: `cat-cafe#954`

## Why

社区实现已经在开源仓完成 maintainer merge，我们需要把共享代码路径的行为吸回家里，避免后续 outbound sync 再次覆盖社区修复，也让 F150 在家里成为正式主线能力。

这次 intake 同时覆盖两张 Intent Issue：

- `cat-cafe#953` ← `clowder-ai#286`
- `cat-cafe#952` ← `clowder-ai#295`

## Original Requirements

> 哪些工具被用得最多？哪些几乎没人碰？  
> 各只猫的工具使用分布有什么差异？  
> 使用趋势是什么样的？

- 来源：`docs/features/F150-tool-usage-stats.md`
- 请对照上面的摘录判断交付物是否真正补齐了工具侧可观测性，而不是只把代码从开源仓搬回来

## Tradeoff

- `clowder-ai#286` 里 brand-guard 文件 `packages/web/src/utils/api-client.ts` 没有直接吸收
  原因：社区改动只是 biome 格式化，没有行为变化；直接带进来只会增加 reviewer 噪音
- `test:public` 没作为最终放行证据
  原因：当前 shell 带着 `REDIS_URL=redis://localhost:6399`，把一个现成的 scheduler 测试环境隔离门撞响了；我保留了完整失败上下文，并补跑了 F150 自己的 targeted tests

## Open Questions

1. 请对照 `cat-cafe#952` / `cat-cafe#953` 的逐文件决策表确认：所有 `ABSORB` 项都在 `cat-cafe#954` 中落地，`SKIP` 项只有 `api-client.ts`
2. 请重点看 `packages/api/src/index.ts`、`packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts`、`packages/api/src/domains/cats/services/agents/routing/route-helpers.ts` 这三处冲突解法，确认我是在保留家里主线能力的前提下把 F150 注入进去，没有回退 `evidenceStore` 等内部能力
3. 如果你认为有必要，请在干净环境里复跑一次完整 `pnpm --filter @cat-cafe/api run test:public`，验证 scheduler 那条失败确实与本轮 F150 intake 无关

## Next Action

请 review `cat-cafe#954`，并按 Intake Review Guard 判断这轮 absorb 是否可以放行。若放行，下一步我再执行：

1. `bash scripts/intake-from-opensource.sh --record --pr 286 --decision absorbed`
2. `bash scripts/intake-from-opensource.sh --record --pr 295 --decision absorbed`
3. `bash scripts/intake-from-opensource.sh --advance-ledger`

## 自检证据

### Spec 合规

- Feature 真相源：`docs/features/F150-tool-usage-stats.md`
- Intake 真相源：`cat-cafe#953`、`cat-cafe#952`
- 吸收方式：`#286` 先落 Phase A，再叠 `#295` 的 archive + UI，保持与开源仓最终合并态一致
- Brand Guard：`bash scripts/intake-from-opensource.sh --validate-inbound` 通过

### 测试结果

- `pnpm check` → pass
- `pnpm --filter @cat-cafe/web build` → pass
- `env -u REDIS_URL pnpm --dir packages/api exec node --test test/tool-usage-classify.test.js test/tool-usage-counter.test.js test/tool-usage-routes.test.js test/tool-usage-archive.test.js` → 35 passed, 0 failed
- `pnpm --filter @cat-cafe/api run test:public` → failed at unrelated existing env-sensitive test `test/scheduler-reply-userid-backfill.test.js` because ambient `REDIS_URL=redis://localhost:6399` trips its isolation guard

### 相关文档

- Feature: `docs/features/F150-tool-usage-stats.md`
- Intake Intent: `cat-cafe#953`, `cat-cafe#952`
- Source PRs: `clowder-ai#286`, `clowder-ai#295`

<!-- 缅因猫/砚砚 (gpt52) -->
