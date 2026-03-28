---
type: review-request
from: opus
to: codex
date: 2026-03-28
feature: F137
review_target_id: f137-phase-d
branch: feat/f137-phase-d
---

# Review Request: F137 Phase D — WeChat Disconnect + Unbind

## What
Add disconnect functionality to the WeChat personal gateway:
- `WeixinAdapter.disconnect()` — stops polling, clears bot_token, context_tokens, and all session state
- `POST /api/connector/weixin/disconnect` — new API endpoint with auth guard
- WeixinQrPanel: disconnect button in connected state + iLink unbind help text

## Why
铲屎官 DM 测试中发现无法断开 WeChat ClawBot 连接。既需要"停止轮询"的软断开，也需要"解绑授权"的说明文案。

## Original Requirements（必填）
> "微信的那个 clawbot 他提供解绑的功能吗？还是怎么样就解绑了？"
> "那我们这里是不是可以写清楚怎么样不绑定？...以及我们可以做一个按钮？停止长轮询...你觉得如何？"
> "我觉得你得把这个写在你的F137里面，这是你F137的一部分"
- 来源：铲屎官 2026-03-28 对话（F137 Phase D 立项讨论）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- iLink Bot 没有服务端 revoke API，无法主动解除微信端授权。选择在 UI 展示手动解绑说明文案（指向 liteapp.weixin.qq.com）而非假装能自动解绑。
- `disconnect()` 清除所有 session state（包括 pendingReplies），而非仅清 token。原因：断开后不应有残留的未发送消息。

## Open Questions
1. AC-D4 的解绑文案目前指向 liteapp.weixin.qq.com，这是 iLink Bot 授权管理页面。请确认路径是否合适，还是应该指向"微信设置 → 账号与安全 → 登录设备管理"。
2. `disconnect()` 是否需要通知 sessionExpiredCallback？当前选择不通知（disconnect 是用户主动行为，不是 session 过期）。

## Next Action
请审查代码质量、安全性、测试覆盖。重点关注 Open Questions。

Review-Target-ID: f137-phase-d
Branch: feat/f137-phase-d

## 自检证据

### Spec 合规
AC-D1~D5 全部覆盖（见 quality gate report）

### 测试结果
```
node --test weixin-adapter.test.js connector-hub-route.test.js → 110 pass, 0 fail
pnpm --filter @cat-cafe/api test → 6477 pass, 4 fail (pre-existing Redis integration)
pnpm lint → 0 errors
pnpm biome check → 0 errors
pnpm --filter @cat-cafe/api build → exit 0
pnpm --filter @cat-cafe/web exec tsc --noEmit → exit 0
```

### 相关文档
- Feature: `docs/features/F137-weixin-personal-gateway.md` Phase D
