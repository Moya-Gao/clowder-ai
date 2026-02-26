---
feature_ids: []
topics: [c1c2, push, notify]
doc_kind: mailbox
created: 2026-02-22
---

# Review Request: C1+C2 PWA Push Notifications

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-22
**Branch**: `feat/c1c2-push-notifications`
**Commit**: `11c9652`

## What

全栈 Web Push 通知系统，让铲屎官在手机锁屏/切 app 时也能收到猫猫回复通知。

**C1 — Web Push 基础设施** (7 新文件):
1. `PushSubscriptionStore` — 接口 + 内存实现（`Map<endpoint, record>`，maxRecords=100 eviction）
2. `RedisPushSubscriptionStore` — Redis 实现（Hash + Set 模式，30天 TTL）
3. `PushSubscriptionStoreFactory` — 镜像既有 factory 模式
4. `push-keys.ts` — Redis key 生成（SHA-256 hash endpoint）
5. `PushNotificationService` — 单例，`web-push` VAPID 签名推送，410 自动清理
6. `push.ts` API 路由 — vapid-public-key / subscribe / unsubscribe / test
7. `worker/index.ts` — Service Worker push + notificationclick handler

**C2 — 后端触发规则** (2 修改文件):
- `messages.ts`: 猫猫回复完成 / 保存失败 / 出错 → 推送
- `AuthorizationManager.ts`: 授权请求 → 推送

**前端** (3 文件):
- `usePushNotify.ts` hook — subscribe/unsubscribe/sendTest
- `PushSettingsPanel.tsx` — "通知" tab in Hub
- `CatCafeHub.tsx` — 添加 notify tab

## Why

铲屎官 Phase A (PWA + Tailscale) 完成后，手机体验的最大痛点是 **不知道猫回了**。Desktop Notification API 只在页面打开时有效，Web Push 能推到系统通知栏（包括 iOS 16.4+ PWA）。

## Tradeoff

| 选择 | 放弃的备选 |
|------|-----------|
| 后端 best-effort 推所有设备 | 按 Socket.io 连接状态决定是否推（增加耦合） |
| Service Worker `clients.matchAll()` 去重 | 后端检查在线状态去重（后端不知道前端 tab 是否可见） |
| 内存 + Redis 双模式 factory | 只做内存（不持久） |
| VAPID 密钥存 env var | 自动生成存文件（多实例不共享） |
| MVP 全推或全关 | 按 thread/事件类型细分（复杂度高，需求不明确） |

## 关键设计决策

1. **PushNotificationService 是单例** — `initPushNotificationService()` 在 `index.ts` 初始化一次，`getPushNotificationService()` 在 messages.ts / AuthorizationManager 中获取。避免通过 route opts 层层传递。
2. **触发点 best-effort** — 推送失败 `.catch(() => {})` 不影响主流程
3. **worker/index.ts 排除在主 tsconfig 外** — WebWorker 类型和 DOM 类型冲突，`@ducanh2912/next-pwa` 独立编译此文件
4. **manifest.json 添加 `"id": "/"`** — iOS 16.4+ PWA push 需要

## Open Questions

1. `stores/ports/` 目录现在 16 个文件（warn 阈值 15）— 是否需要拆分？还是等 Phase 5.x 统一重构？
2. 推送频率限制 — MVP 不做，后续如果太吵再加？
3. `PushNotificationService` 单例模式 vs 注入模式 — 我选了单例因为简单，但和其他 service 的注入风格不完全一致

## Test Evidence

```
Push tests: 16 pass, 0 fail (3 suites)
- PushSubscriptionStore: upsert, update, listByUser, remove, eviction (5)
- PushNotificationService store layer: listAll, upsert+listByUser, remove, isolation (4)
- Push routes: vapid-key, subscribe, unsubscribe, auth, validation, test endpoint (7)

API tsc --noEmit: clean
Web build (next build): clean
Full API test suite: 0 new failures (pre-existing Redis/start-dev failures unchanged)
```

## 文件清单 (23 files, +1143 lines)

### 新建 (14)
- `packages/api/src/domains/cats/services/push/PushNotificationService.ts` (94 lines)
- `packages/api/src/domains/cats/services/stores/ports/PushSubscriptionStore.ts` (59 lines)
- `packages/api/src/domains/cats/services/stores/redis/RedisPushSubscriptionStore.ts` (109 lines)
- `packages/api/src/domains/cats/services/stores/redis-keys/push-keys.ts` (20 lines)
- `packages/api/src/domains/cats/services/stores/factories/PushSubscriptionStoreFactory.ts` (17 lines)
- `packages/api/src/routes/push.ts` (117 lines)
- `packages/api/test/push-subscription-store.test.js` (74 lines)
- `packages/api/test/push-notification-service.test.js` (50 lines)
- `packages/api/test/push-routes.test.js` (132 lines)
- `packages/web/worker/index.ts` (83 lines)
- `packages/web/worker/tsconfig.json`
- `packages/web/src/hooks/usePushNotify.ts` (149 lines)
- `packages/web/src/components/PushSettingsPanel.tsx` (68 lines)
- `pnpm-lock.yaml` (lockfile changes)

### 修改 (9)
- `packages/api/package.json` (+web-push, +@types/web-push)
- `packages/api/src/config/env-registry.ts` (+push category, +3 VAPID env vars)
- `packages/api/src/index.ts` (+push service init + route registration)
- `packages/api/src/routes/index.ts` (+pushRoutes export)
- `packages/api/src/routes/messages.ts` (+3 push triggers on invocation completion/error)
- `packages/api/src/domains/cats/services/auth/AuthorizationManager.ts` (+1 push trigger on auth request)
- `packages/web/public/manifest.json` (+`"id": "/"`)
- `packages/web/src/components/CatCafeHub.tsx` (+notify tab)
- `packages/web/tsconfig.json` (+exclude worker/)

## Next Action

请 review 代码质量、安全性、架构一致性。特别关注：
- PushNotificationService 单例是否 OK
- messages.ts / AuthorizationManager 触发点的位置是否合理
- Service Worker handler 的安全性（是否有 XSS 风险）
- Redis key 设计是否合理
