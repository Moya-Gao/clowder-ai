---
topics: [review-request, intake, clowder-ai, routing]
doc_kind: mailbox
created: 2026-03-26
---

# Review Request: PR268 Intake

Review-Target-ID: absorb-pr268-health-routing
Branch: `feat/absorb-pr268-health-routing`

## What

把 `clowder-ai#268` 的健康路由修复吸收到 Cat Café：

- 无 `@mention` 的隐式路由不再盲目复用“最近参与者”，而是优先找“最近一次健康回复者”
- 对从未成功回复过的参与者做第二层 fallback，避免它们短路健康猫选择
- 在 `route-serial` / `route-parallel` 里记录 `lastResponseHealthy`
- Redis `ThreadStore` 持久化并读取健康状态
- 保留家里 `API_SERVER_PORT=3002` 的 source truth，不吸收 upstream public sync 变换出来的 `3004`

## Why

upstream `#268` 修的是一个真实共享 bug：某只猫 provider 报错后仍被视为“最后回复者”，用户下一条不带 `@mention` 的消息还会再次路由给它，形成重复失败循环。这个问题在我们家同样成立，所以值得吸收。

但 upstream 仓库的公开发行默认端口是 `3004`，家里的 source truth 是 `3002`。这轮 intake 的目标是吸收“健康路由能力”，不是把 target-side sync 变换也反向带回家。

## Original Requirements

> “看看他们做的事什么？ 是我们要的吗？ 2. 如果是 检视代码 看看是否可以merge / takein”
> “那你按照你的判断 来进行一下我们的流程？”

- 来源：当前 thread 对话（2026-03-26）
- 请对照上面的摘录判断：这次交付是否真的把 `#268` 从“判断”推进到了“merge + take-in + 家里自检完成”，而不是只停在分析。

## Tradeoff

- 这轮按 `absorbed` intake：共享 routing/store/test 逻辑带回家。
- upstream `AgentRouter.ts` 里的 `API_SERVER_PORT ?? '3004'` 没有带回家；这是 sync-to-opensource 的 target-side 公开默认值，不是我们仓的 source truth。
- 没做全量 workspace `pnpm test`；本轮证据聚焦于 `packages/api` build、lint 和与 `#268` 直接相关的 3 个回归测试文件，加上 intake brand guard / diff hygiene。

## Open Questions

1. `peekTargets` / `resolveTargets` 的两层 fallback 语义是否足够清晰，没有引入“从未成功回复的猫先被选中”的回归？
2. `route-serial` / `route-parallel` 对 abort/cancel 维持 `healthy=true` 的处理，你认为还需要补哪类边界测试？
3. 这轮把 `3004` 剔除为 repo-specific drift，你是否同意这是正确的 source-owned 取舍？

## Next Action

请重点 review：

- 这次 intake 是否只吸收了 `#267/#268` 的健康路由修复，没有混入 target-side 配置漂移
- Redis / ThreadStore 的健康状态读写是否完整
- 当前 focused regression set 是否足够证明行为正确

如果没有 P1/P2，请放行我继续走后续 PR / merge 流程。

## 自检证据

### Quality Gate

- 报告：`docs/mailbox/2026-03-26-pr268-intake-quality-gate.md`

### 测试结果

```bash
pnpm --dir packages/api run build
pnpm --dir packages/api run lint
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --test --test-timeout=60000 \
  test/agent-router.test.js \
  test/f32b-preferred-cats.test.js \
  test/route-strategies.test.js
pnpm check
bash scripts/intake-from-opensource.sh --validate-inbound
git diff --check
```

结果：

- API build ✅
- API typecheck/lint ✅
- focused regression set → `144 passed, 0 failed` ✅
- repo-wide `pnpm check` ✅
- Brand Guard ✅
- `git diff --check` ✅

### 相关文档

- Quality Gate: `docs/mailbox/2026-03-26-pr268-intake-quality-gate.md`
- Intake ledger: `docs/ops/opensource-intake-ledger.json`
- Skill rule: `cat-cafe-skills/refs/opensource-ops-inbound-pr.md`
