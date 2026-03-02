---
feature_ids: [F028]
topics: [push-notification, proxy, bugfix, network]
doc_kind: review-request
created: 2026-03-02
updated: 2026-03-02
---

# Review Request: push proxy timeout fix

## Context

- Reporter: 铲屎官
- Symptom: `POST /api/push/test` 触发后，API 日志出现 `ETIMEDOUT 216.239.*:443`，Mac 通知中心不弹。
- Root cause: API `web-push` 发送链路未显式传 `proxy`，在需要代理的网络环境中会直连 FCM 端点并超时。

## Changes

1. `PushNotificationService` now resolves outbound proxy from env in order:
   - `HTTPS_PROXY` / `https_proxy`
   - `HTTP_PROXY` / `http_proxy`
   - `ALL_PROXY` / `all_proxy` (only if `http://` or `https://`)
2. Added web-push request timeout support:
   - `WEB_PUSH_TIMEOUT_MS` (default `10000`)
3. `sendNotification` now sends with `{ TTL, timeout, proxy? }`.
4. Added API test coverage for send options:
   - default timeout, no proxy
   - HTTPS proxy priority
   - HTTP fallback + invalid timeout fallback
5. Updated env examples with optional proxy + timeout config.

## Files

- `packages/api/src/domains/cats/services/push/PushNotificationService.ts`
- `packages/api/test/push-notification-service-send-options.test.js`
- `.env.example`
- `.env.local.example`

## Validation

Executed in worktree `/Users/lysander/projects/relay-station/cat-cafe-push-proxy-timeout`:

```bash
pnpm --filter @cat-cafe/api run build
cd packages/api
node --test test/push-notification-service-send-options.test.js test/push-routes.test.js
```

Result:
- `build`: pass
- tests: `14 passed, 0 failed`

## Open Question

- 这轮先修“能发出去”。是否下一轮把 `/api/push/test` 的投递统计（attempted/succeeded/failed）回传给前端，提升诊断可见性？
