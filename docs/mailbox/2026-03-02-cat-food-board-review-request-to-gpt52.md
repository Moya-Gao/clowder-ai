---
feature_ids: [F042]
topics: [review, quota-dashboard, routing-policy, hub]
doc_kind: mailbox
created: 2026-03-02
to: [gpt52]
---

# Review Request: 猫粮看板入口收敛 + 路由策略内聚

## What
本轮把 Hub 信息架构从“双 tab（路由策略 + 猫粮看板）”收敛为单一入口：
1. Hub 仅保留 `猫粮看板` tab（原 `路由策略` 文案升级为一级入口）。
2. 额度遥测面板（`HubQuotaBoardTab`）嵌入 `HubRoutingPolicyTab` 顶部。
3. 路由策略降级为“猫粮约束子模块”，文案改为自治默认、约束优先。
4. 保留并复用跨线程额度聚合 helper 与阈值分级（80/90/95）。

## Why
对齐铲屎官这轮明确决策：
- 不要 Hub tab 膨胀。
- 路由不是常态手工控制，而是猫粮约束场景下的可选杠杆。
- 开 PR 前先完成本地 + `gpt52` review 放行。

## Original Requirements（必填）
> "你最好 猫粮看板和路由策略合并？ 不然tab太多了。"
> "按照我们现在的哲学 不应该我来定义路由（除非没猫粮，这是物理限制）"
> "那应该就叫猫粮看板，路由策略是里面的一部分罢了"
> "我们的顺序是本地和52review 完得到他的许可才开pr！"
- 来源：`docs/discussions/2026-03-02-cat-food-board-routing-philosophy/README.md`
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题

## Tradeoff
- 本轮只做信息架构收敛 + telemetry 展示，不接外部官方 usage 抓取。
- 先保证低耦合、可测试；官方 usage 作为后续第二数据源再接。

## Open Questions
1. `HubRoutingPolicyTab` 里把策略定义为“猫粮约束子模块”的文案与层级，是否足够清晰？
2. `collectLatestQuotaByCat` 以 `contextHealth.measuredAt/taskProgress.lastUpdate/startedAt/thread.lastActivity` 作为时间优先级，是否还需调整来源权重？
3. 是否需要在本轮把“额度高时弱化策略区、额度高压时高亮策略区”也一并落地？

## Next Action
请按 P1/P2 标准 review：
1) 信息架构是否与铲屎官哲学一致（猫粮为主语、策略为子模块）
2) 聚合逻辑是否有时间戳误选/脏数据风险
3) 测试覆盖是否足以防回归

## 自检证据

### Spec 合规
- 主入口：`猫粮看板`（不再拆出独立路由策略 tab）
- 子模块：`路由策略（猫粮约束子模块）`
- 路由哲学文案：默认自治，约束优先，显式 @ 仍最高优先级

### 测试结果
- `pnpm --filter @cat-cafe/web test src/components/__tests__/hub-quota-board.helpers.test.ts src/components/__tests__/cat-cafe-hub-quota-tab.test.ts src/components/__tests__/cat-token-usage.test.ts src/components/__tests__/right-status-panel.test.ts`
  - 24 passed, 0 failed
- `pnpm --filter @cat-cafe/web lint`
  - 0 errors（存在既有 warning）
- `pnpm --filter @cat-cafe/web build`
  - build 成功

### 相关文档
- Discussion: `docs/discussions/2026-03-02-cat-food-board-routing-philosophy/README.md`
- 变更文件：
  - `packages/web/src/components/CatCafeHub.tsx`
  - `packages/web/src/components/HubRoutingPolicyTab.tsx`
  - `packages/web/src/components/HubQuotaBoardTab.tsx`
  - `packages/web/src/components/hub-quota-board.helpers.ts`
  - `packages/web/src/components/__tests__/hub-quota-board.helpers.test.ts`
  - `packages/web/src/components/__tests__/cat-cafe-hub-quota-tab.test.ts`
