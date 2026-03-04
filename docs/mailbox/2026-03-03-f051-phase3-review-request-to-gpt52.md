---
feature_ids: [F051]
topics: [review, quota, notification, ui, phase3]
doc_kind: review-request
created: 2026-03-03
updated: 2026-03-03
---

# Review Request: F051 Phase 3（猫粮看板 + 通知能力 + 产品化 UI）

## What

1. 猫粮看板重构为产品化结构：状态总览、更新时间、操作建议、风险提示、平台卡片下一步动作。
2. 通知设置页重构为“能力矩阵 + 设备订阅 + 投递摘要 + 修复路径”。
3. 引入通知策略去重（短窗口 suppression）和额度高风险系统预警触发。
4. 补齐开发环境通知验证路径（dev 提示 + prod-like 验证指引）。
5. 输出桌面/移动截图证据并完成 quality-gate。

## Why

铲屎官目标已经从“能抓额度”升级为“日常可用控制台”：要看得清、知道怎么修、在不驻留页面时也能接到关键通知。本轮把 Phase 3 目标收束为可交付的产品形态。

## Original Requirements（必填）
> “希望这次重构后是符合我预期的猫粮看板以及通知能力，而且要好看。”
> “在其他页面干活的时候根本收不到猫猫望眼欲穿的消息。”
> “我期望是能够 macOS 或者 iPhone 级别的通知。”
- 来源：`docs/discussions/2026-03-03-f051-notification-ui-vision-reframe/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. Phase 3 继续走 Web Push（含 iPhone PWA 条件），不在本轮引入原生壳/APNs。
2. 录屏豁免，仅保留 3 张关键截图证据（静态信息架构变更为主）。
3. Antigravity 额度仍占位，未进入官方抓取接入实现。

## Open Questions

1. `R9/R10` 目前在 spec 记为 `[~]`（需真机持续回归），是否接受这个阶段性状态？
2. 现有 lint warnings 为历史存量，是否需要在本 feature 顺手清零，还是另开整理项？
3. Phase 4（菜单栏）是否要在 F051 下继续分 task，还是拆独立 feature？

## Next Action

请重点 review 以下三块：
1. 通知能力矩阵与诊断文案是否能支撑“不可达可自修”；
2. 猫粮看板 UI 层级是否达到“可读 + 可操作”；
3. 去重与阈值通知策略是否存在误报/漏报边界。

## 自检证据

### Spec 合规

- Quality Gate：`docs/mailbox/2026-03-03-f051-phase3-quality-gate.md`
- F051 spec 更新：`docs/features/F051-real-quota-dashboard.md`（AC-16/20 已打勾，R11/R12 完成）

### 测试结果

- `pnpm --filter @cat-cafe/web test -- push-settings-panel hub-quota-board-v2 push-notification-policy usePushNotify-subscribe`  
  → 35 passed, 0 failed
- `cd packages/api && node --test test/push-routes.test.js`  
  → 16 passed, 0 failed
- `pnpm --filter @cat-cafe/web lint`  
  → 0 errors（既有 warnings）
- `pnpm --filter @cat-cafe/web build`  
  → success

### 截图证据

- `docs/evidence/f051-phase3/desktop-quota-board.png`
- `docs/evidence/f051-phase3/desktop-notification.png`
- `docs/evidence/f051-phase3/mobile-quota-board.png`

### 相关文档

- Plan: `docs/plans/2026-03-03-f051-notification-ui-productization-plan.md`
- Discussion: `docs/discussions/2026-03-03-f051-notification-ui-vision-reframe/README.md`
- UI Wireframe: `docs/discussions/2026-03-03-f051-phase3-ui-wireframe/README.md`
- Feature: `docs/features/F051-real-quota-dashboard.md`
