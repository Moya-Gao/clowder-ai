---
feature_ids: [F051]
topics: [review, quota, widget, menubar, phase4, phase5]
doc_kind: review-request
created: 2026-03-03
updated: 2026-03-03
---

# Review Request: F051 Phase 4/5（菜单栏 + 小组件）

## What

1. 新增统一摘要接口 `GET /api/quota/summary`，输出风险级别、平台摘要、探针状态与动作路径。
2. 新增 Phase 4 菜单栏插件：`scripts/swiftbar/cat-cafe-quota.1m.sh`（含风险状态、详情、手动刷新动作）。
3. 新增 Phase 5 小组件页面：`/widget/quota` + `QuotaSummaryWidget`，并从 Hub 增加入口。
4. 更新 F051 spec：新增 AC-21/22 与 Phase 4/5 落地记录。

## Why

铲屎官明确希望 F051 不只是止血看板，而是“可常驻、可感知、可快速操作”的完成版体验。Phase 4/5 这轮把“方向锚点”落为可用入口，同时保持对主链路的低耦合（统一 summary API）。

## Original Requirements（必填）

> “我们能够变成现成开源方案直接接入完成版吗？”
> “我希望这次重构后是符合我预期的猫粮看板以及通知能力，而且要好看。”
> “在其他页面干活的时候根本收不到消息。”

- 来源：`docs/discussions/2026-03-03-f051-notification-ui-vision-reframe/README.md`
- 请对照以上摘录判断：这轮是否把 Phase 4/5 从“路线图”推进到了“可用入口”。

## Tradeoff

1. 当前 Phase 4 用 SwiftBar 脚本，不引入原生 App 壳（降低实现成本）。
2. 当前 Phase 5 用 Web widget 路由，不是原生 Notification Center Widget。
3. Antigravity 仍按 spec 保持占位，不在本轮接入官方抓取。

## Open Questions

1. `buildQuotaSummary()` 的风险分级阈值（80/95）是否需要抽到配置层？
2. 菜单栏脚本目前依赖 `jq`，是否要再做一版 Node CLI 以减少系统依赖？
3. 是否在下一轮把 `/api/quota/summary` 的通知健康度并入（当前只聚合 quota/probe）？

## Next Action

请重点 review：
1. summary 语义是否足够稳定可供多端复用；
2. SwiftBar 脚本是否有安全/可运维隐患；
3. widget UI 是否达到“轻量常驻可读”的目标。

## 自检证据

- Quality Gate: `docs/mailbox/2026-03-03-f051-phase45-quality-gate.md`
- Plan: `docs/plans/2026-03-03-f051-phase45-menubar-widget.md`
- Feature spec: `docs/features/F051-real-quota-dashboard.md`

### 测试结果

- `pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/quota-api.test.js`  
  → 36 passed, 0 failed
- `pnpm --filter @cat-cafe/web test -- quota-summary-widget hub-quota-board-v2`  
  → 21 passed, 0 failed
- `pnpm --filter @cat-cafe/web build`  
  → success

### 交付入口

- API: `/api/quota/summary`
- Widget: `/widget/quota`
- Menu bar script: `scripts/swiftbar/cat-cafe-quota.1m.sh`
- Setup guide: `docs/guides/swiftbar-menubar-setup.md`
