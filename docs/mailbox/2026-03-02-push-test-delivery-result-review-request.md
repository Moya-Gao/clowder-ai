---
feature_ids: [F028]
topics: [push-notification, diagnostics, bugfix, ux]
doc_kind: review-request
created: 2026-03-02
updated: 2026-03-02
---

# Review Request: push test delivery result truthfulness

## Context

- 铲屎官反馈：点击“发送测试通知”仍只看到 Cat Café 内部 toast，体验像“发了”，但系统通知中心未弹。
- 当前根因：`/api/push/test` 只要调用 `notifyUser()` 就回 `200`，未区分“真正投递成功”与“全部失败/过期”。

## Changes

1. `PushNotificationService` 新增投递统计返回：
   - `attempted / delivered / failed / removed`
2. `/api/push/test` 改为基于投递结果返回：
   - `delivered > 0` -> `200`
   - `delivered === 0` -> `502`（含错误提示 + delivery summary）
3. 前端测试按钮 toast 文案改为“系统通知已请求发送/系统通知发送失败”，避免“仅页面内成功感”。
4. 补齐 API + Web 回归测试。

## Files

- `packages/api/src/domains/cats/services/push/PushNotificationService.ts`
- `packages/api/src/routes/push.ts`
- `packages/api/test/push-notification-service-send-options.test.js`
- `packages/api/test/push-routes.test.js`
- `packages/web/src/components/PushSettingsPanel.tsx`
- `packages/web/src/components/__tests__/push-settings-panel.test.ts`

## Validation

```bash
pnpm --filter @cat-cafe/api run build
cd packages/api
node --test test/push-notification-service-send-options.test.js test/push-routes.test.js
cd ..
pnpm --filter @cat-cafe/web test -- src/components/__tests__/push-settings-panel.test.ts src/utils/__tests__/push-notification-policy.test.ts
```

Result:
- API tests: 16 passed, 0 failed
- Web tests: 9 passed, 0 failed

## Open Question

- 下一步可选：把 `delivery summary` 在前端“测试通知”卡片中可视化展示（attempted/failed/removed），进一步减少排障往返。
