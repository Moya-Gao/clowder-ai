---
feature_ids: [F028]
topics: [push-notification, notification-center, review-request]
doc_kind: mailbox
created: 2026-03-02
updated: 2026-03-02
---

# Review Request: fix(web/api): force critical push notifications to system notification center

## What

1. 新增通知策略模块 `push-notification-policy`，将三类事件标记为“前台也强制弹系统通知”：测试推送、权限请求、决策类消息。
2. Service Worker 改为策略驱动，不再一刀切“页面可见就抑制通知”。
3. 后端在对应事件 payload 中补齐 `forceSystemNotification` / `requiresDecision` 元信息，并对决策类回复打 `cat-decision-*` tag。
4. 修复“发送测试通知”可能长期卡 `发送中...`：`sendTest` 加 10s 超时与错误消息返回。

## Why

右下角 in-app 提示不够醒目，铲屎官明确要求关键场景必须走系统通知中心，且测试按钮不能出现无反馈卡住体验。

## Original Requirements（必填）

> "我希望 发送测试通知 时强制走系统通知中心"
>
> "然后如果猫猫是告诉我要我做决策 的时候也要发通知中心"
>
> "以及请求权限那个mcp发起的也要那边通知"
>
> "需要有啥配置吗？ 一直卡测试中"

- 来源：`docs/discussions/2026-03-02-force-system-notification-center/README.md`
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题

## Tradeoff

1. 保留“普通回复在页面可见时不弹系统通知”的策略，避免通知噪音；只对关键类别强制弹出。
2. 决策类识别采用关键词启发式（中英混合），优点是快速覆盖需求；代价是存在少量误判概率，后续可演进为结构化意图标记。

## Open Questions

1. `shouldMarkDecisionNotification()` 当前关键词边界是否合适（是否需要收紧或扩展）？
2. 是否要把“普通错误通知”（`cat-error-*`）也升级为前台强制系统通知？
3. 10s 超时阈值是否需要调为可配置（env）而不是前端常量？

## Next Action

请按 P1/P2 标准 review 本轮改动；若放行，我立即执行 merge-gate（开 PR → 注册 tracking → 云端 review → squash merge）。

## 自检证据

### Spec 合规（quality-gate 摘要）

1. 需求 1（测试推送强制系统通知）：已实现（`push-test` + `forceSystemNotification`）。
2. 需求 2（决策消息强制系统通知）：已实现（`cat-decision-*` + `requiresDecision`）。
3. 需求 3（权限请求强制系统通知）：已实现（`auth-*` + `forceSystemNotification`）。
4. 需求 4（发送卡住）：已实现（`AbortController` 超时 + 错误消息）。

### 测试结果

1. `pnpm --filter @cat-cafe/web test -- push-notification-policy.test.ts push-settings-panel.test.ts`  
   2 files passed, 9 tests passed, 0 failed
2. `pnpm --filter @cat-cafe/api run build`  
   success (tsc passed)
3. `cd packages/api && node --test test/push-routes.test.js test/push-notification-service.test.js test/messages-decision-notification-policy.test.js`  
   3 suites passed, 15 tests passed, 0 failed
4. `pnpm --filter @cat-cafe/web lint`  
   exit 0（仅历史 warning，无新增 error）
5. `pnpm --filter @cat-cafe/web build`  
   success（Next.js build passed）

### 相关文档

- Plan: `docs/plans/2026-03-02-force-system-notification-center.md`
- Discussion: `docs/discussions/2026-03-02-force-system-notification-center/README.md`
