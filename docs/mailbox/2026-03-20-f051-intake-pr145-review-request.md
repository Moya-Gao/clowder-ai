# Review Request: F051 intake of clowder-ai#145

## What
吸收 `clowder-ai#145` 已合入的 daily token usage 功能到家里：
- 新增 `/api/usage/daily`、`usage-aggregator`、route-level tests
- 新增 `DailyUsageSection` 并接入 `HubRoutingPolicyTab`
- 更新 `docs/ops/opensource-intake-ledger.json`，把 `clowder-ai#145` 记录为 `absorbed` 并推进到 merge commit `4b21d1ddb66ced5779dbe7361f9804120ff57899`
- 另外补了一个纯格式修整 commit，让内部 `pnpm gate` 全绿

## Why
开源仓已经接受并合入了这条 F051 增量，如果家里不吸收，就会形成双仓实现漂移。
这次 intake 走的是 safe-cherry-pick，不重写方案；本地额外格式修整不改变语义，只为满足内部 merge gate。

## Original Requirements（必填）
> 新增 `/api/usage/daily` 聚合端点，按“日期 × 猫”汇总 token 消耗。
> 在 Hub → 猫粮看板下方增加“近 7 日猫粮消耗”区域。
> `total.invocations` 按 record 计数，per-cat 用 `participations`。
- 来源：`clowder-ai#144` / `clowder-ai#145`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 选择吸收上游已落地实现，而不是在家里重写一版
- 代价是 internal PR 比 upstream merge 多一个 housekeeping commit（只修格式），但换来完整 `pnpm gate` 证据

## Open Questions
- 请重点看 `/api/usage/daily` 的 header-only auth / user-scoped cache key 是否和家里的现有契约一致
- 请看 `DailyUsageSection` 接入 `HubRoutingPolicyTab` 后，是否存在 UI/typing 漏洞或隐藏回归
- 请确认这条 intake 没有漏掉需要一起带回家的非代码真相源

## Next Action
请 review `cat-cafe#598`，重点盯 P1/P2。
如果没有 blocker，请明确给放行信号。

Review-Target-ID: f051
Branch: `chore/intake-pr145-latest`
PR: `https://github.com/zts212653/cat-cafe/pull/598`

## 自检证据

### Spec 合规
- 社区侧 `clowder-ai#145` 已 merge
- intake plan 判定：10/10 文件都是 `safe-cherry-pick`
- ledger 已记录 `absorbed`，并成功 advance 到 `4b21d1ddb66ced5779dbe7361f9804120ff57899`

### 测试结果
- `pnpm gate` # passed on `ffb0ec57a759fd41312e58c7f7c9bce4913af832`, rebased onto `origin/main`
- `pnpm --filter @cat-cafe/api exec node --test test/usage-aggregator.test.js test/usage-route-cache.test.js` # 21 passed, 0 failed
- `pnpm --filter @cat-cafe/api run build` # passed

### 相关文档
- Plan: `N/A (community intake)`
- ADR: `N/A`
- Feature: `F051`
