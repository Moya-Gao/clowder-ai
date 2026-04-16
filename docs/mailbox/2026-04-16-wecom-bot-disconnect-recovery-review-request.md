---
doc_kind: review-request
created: 2026-04-16
feature_ids: [F132]
topics: [wecom-bot, websocket, disconnect, reconnect, bugfix]
---

# Review Request: F132 WeCom Bot disconnected_event recovery

Review-Target-ID: fix-wecom-bot-disconnect-recovery
Branch: fix/wecom-bot-disconnect-recovery

## What

Three-layer bugfix for WeCom Bot WebSocket going permanently dead after `disconnected_event`:

1. **P0 — Delayed reconnect**: `scheduleReconnect()` after SDK `disconnected_event` with reason "New connection established" — 10s delay then `client.connect()`, bypassing SDK's `isManualClose = true` that blocks auto-reconnect
2. **P1 — Validate safety**: `/api/connector/wecom-bot/validate` now calls `stopWeComBot()` BEFORE creating a probe WebSocket, preventing the competing-connection structural bomb (WeCom server only allows 1 active WS per bot)
3. **P1 — Live health**: Status endpoint uses `getConnectionState()` (connected/disconnected/reconnecting) instead of only checking env var presence (was a false green light)

Also: `clearStaleState()` on disconnect clears `activeStreams` + `lastFrameByChat` to prevent stale req_id values leaking across reconnect cycles.

5 files changed, 170 insertions, 1 deletion.

## Why

铲屎官 2026-04-15 18:09 报告：企微 Bot 聊着聊着突然断了，卡在"布偶猫思考中"，后续 @mention 全部无响应。

**Root cause stack**:
- SDK `@wecom/aibot-node-sdk` 的 `disconnected_event` handler（line 385）设置 `isManualClose = true`，by design 阻止重连
- 对于 code 1006（网络断开），SDK 自动重连正常工作（runtime log 10:43 证实）
- 但对于 `disconnected_event`（被踢下线），SDK 故意不重连——这对我们的 always-on bot 场景是错的
- `validateCredentials()` 开第二个 WS 连接会触发 server 踢掉现有连接 → `disconnected_event` → 死循环

## Original Requirements（必填）

> 铲屎官 2026-04-15 18:09："我发现企业微信 f132 有 bug……聊着聊着链接断了……卡在布偶猫输出，然后我喊他也没反应了"
> 铲屎官 2026-04-15 19:25："@opus 开始修！"

- 来源：Cat Café 协作对话（2026-04-15 thread）
- **请对照上面的摘录判断：修复后 WeCom Bot 断连是否能自动恢复，不再永久失联**

## Tradeoff

- **没有 patch SDK**：虽然 `isManualClose = true` 是 SDK bug/design，但 monkey-patching 第三方 SDK 维护成本高。用 adapter 层 delayed reconnect 绕过，10s 延迟确保 server 端完成 session 清理
- **getter 而非直接引用**：`getWeComBotAdapter()` 是函数而非属性，因为 adapter 实例在每次 `startWeComBotStream` 时重建，直接引用会 stale

## Open Questions

1. **10s reconnect delay**：够不够？太短可能 server 还没清完 session，太长用户感知断联时间更久。目前是经验值，可后续调参
2. **SDK 上游**：是否值得给 `@wecom/aibot-node-sdk` 提 issue/PR 修 `isManualClose` 行为？（低优先级，adapter 层已兜住）

## Next Action

请 review 以下重点：
- `scheduleReconnect()` 的时序安全性（多次 disconnect 是否会叠加 timer？已用 `clearTimeout` 防护）
- validate endpoint stop-before-probe 的竞态风险
- `getWeComBotAdapter()` getter 模式是否合理

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-wecom-bot-disconnect-recovery/codex`
- Start Command: `pnpm review:start`
- Ports: web=3201, api=3202（由 review:start 自动分配）

## 自检证据

### Spec 合规

AC-B1（企微 Bot WebSocket 连接 + 心跳 + 重连）的 reconnect 保证在 `disconnected_event` 场景下被 SDK 打破，本修复恢复该保证。

### 测试结果

```
node --test wecom-bot-adapter.test.js + connector-hub-route.test.js → 116/116 pass, 0 fail ✅
pnpm lint → 0 errors ✅
pnpm check → 0 biome errors ✅ (pre-existing index.json stale unrelated)
pnpm -r --if-present run build → exit 0 ✅
```

7 new tests:
- connection health state: getConnectionState() returns disconnected/connected/reconnecting correctly (3 cases)
- stale state cleanup: clearStaleState() clears activeStreams + lastFrameByChat (2 cases)
- outbound fail-fast: sendReply throws when disconnected (1 case)
- stopStream clears reconnect timer (covered by existing stopStream test)

### 根目录工件闸门

```
git status --short | rg media/design artifacts → 无
git diff --name-only origin/main...HEAD | rg media/design artifacts → 无
```

### 相关文档

- Feature: `docs/features/F132-dingtalk-wecom-gateway.md`
- SDK evidence: `node_modules/@wecom/aibot-node-sdk/dist/index.esm.js:377-391` (disconnected_event handler)
- Runtime log: `cat-cafe-runtime/.../api.2026-04-15.1.log` (17:08:31 disconnected_event → zero reconnect attempts)
