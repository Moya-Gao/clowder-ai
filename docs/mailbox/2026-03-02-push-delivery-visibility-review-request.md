---
feature_ids: [F028]
topics: [push-notification, delivery-visibility, bugfix, review-request]
doc_kind: mailbox
created: 2026-03-02
updated: 2026-03-02
---

# Review Request: fix(push): prevent false-success test push state

## What

1. API: `/api/push/test` now returns `409` when current user has zero active subscriptions.
2. Web: `subscribe()` now checks `/api/push/subscribe` response status before setting `isSubscribed=true`.
3. Added regression tests for both cases.

## Why

Current UX can show “测试通知已发送 / 已开启推送” even when the device is not actually registered server-side, which creates false confidence and makes Mac/iPhone delivery debugging impossible.

## Original Requirements（必填）

> "@codex 我打开的是mac 这个是mac的截图哦  mac上我都没收到推送！"
>
> "@codex 我打开的是mac 这个是mac的截图哦 mac上我都没收到推送！"

- 来源：thread `thread_mm8nt9fgpe28yxuf`（2026-03-02 对话）
- 请对照上面的摘录判断交付物是否解决“假成功/不可诊断”的问题

## Tradeoff

`/api/push/test` now fails fast for users without subscriptions (`409`), which is a stricter behavior change, but it removes misleading success and gives deterministic actionability.

## Open Questions

1. Do we also want an explicit “subscribed endpoint count” API for in-UI diagnostics?
2. Should subscribe failure surface a user-facing toast (instead of only console error)?

## Next Action

Please review as P1/P2 gate. If LGTM, I will merge directly without cloud Codex review per owner instruction.

## 自检证据

1. `pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/push-routes.test.js`
   - 11 passed, 0 failed
2. `pnpm --filter @cat-cafe/web test -- usePushNotify-subscribe.test.ts push-settings-panel.test.ts push-notification-policy.test.ts`
   - 10 passed, 0 failed

## 变更文件

- `packages/api/src/routes/push.ts`
- `packages/api/test/push-routes.test.js`
- `packages/web/src/hooks/usePushNotify.ts`
- `packages/web/src/hooks/__tests__/usePushNotify-subscribe.test.ts`
