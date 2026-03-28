# Review Request: F132 Phase B — WeCom Bot Adapter

## What

Complete `wecom-bot` connector implementation: WeComBotAdapter (695 lines) with `IStreamableOutboundAdapter`, WebSocket lifecycle, native `replyStream` streaming bridge, inbound parsing (text/image/voice/file/mixed for DM+group), media upload/download via SDK, and full IM Hub UI integration.

15 files changed (3 new + 12 modified), 2049 insertions.

## Why

F132 Phase B — extend Cat Café's multi-platform chat gateway with WeCom Bot (企业微信 AI 聊天机器人). This is the WebSocket + true streaming path; WeCom Agent (HTTP callback) comes later in Phase C.

Constraints:
- Adapter-only extension: public layer diff = 0 (ConnectorRouter / OutboundDeliveryHook / StreamingOutboundHook / CommandLayer / BindingStore untouched)
- KD-7 11-step onboarding checklist: all 11 files addressed
- Visual identity: indigo theme (distinct from feishu=blue, dingtalk=cyan, telegram=sky, weixin=green)

## Original Requirements（必填）

> "我们需要接入钉钉和企业微信，必须复用我们的 channel 等等架构设计" — 铲屎官
> "企微拆两个 connector：wecom-bot（WebSocket + 流式）+ wecom-agent（HTTP callback + AES/XML）" — F132 KD-4
> "测试对齐钉钉 76 tests 的水准" — 布偶猫
> "公共层零改动" — F132 spec

- 来源：`docs/features/F132-dingtalk-wecom-gateway.md`（KD-4, KD-7）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **No HTTP callback path** — Bot mode only (WebSocket). Agent mode (HTTP+AES/XML) deferred to Phase C.
- **Frame caching for streaming** — `lastFrameByChat` Map caches last inbound frame per chatId because `replyStream` requires the original frame with `req_id` header. Risk: stale frame if bot restarts mid-stream. Mitigation: streams auto-cleanup.
- **Placeholder PNG icon** — 128×128 indigo-bg + white "W" placeholder, not final brand logo. Can be swapped later.

## Open Questions

1. **`voice` → `audio` type mapping**: WeCom SDK uses `type: 'voice'` but connector router expects `'audio'`. Handled in bootstrap with explicit cast. Is this the right place, or should it live in the adapter's `parseEvent`?
2. **`lastFrameByChat` lifetime**: Currently unbounded Map. Should we add TTL-based eviction for long-idle chats?
3. **Group chat message filtering**: Bot receives ALL group messages (no @-mention filter). Same behavior as DingTalk. Is this acceptable or should we filter to @bot only?

## Next Action

Please review the implementation for correctness, architecture compliance (public layer diff=0), and test coverage adequacy. Focus on:
- `WeComBotAdapter.ts` — core adapter logic + streaming bridge design
- `connector-gateway-bootstrap.ts` — registration block pattern
- Test coverage gaps (76 tests — does it match DingTalk quality?)

## 自检证据

### Spec 合规

KD-7 Checklist: 11/11 files modified
- [x] WeComBotAdapter.ts — 695 lines, IStreamableOutboundAdapter
- [x] connector-gateway-bootstrap.ts — config, env, guard, registration block
- [x] connector.ts (shared) — wecom-bot ConnectorDefinition, indigo theme
- [x] ConnectorMediaService.ts — wecomBotDl + setWeComBotDownloadFn + url|aeskey= routing
- [x] connector-secrets-allowlist.ts — WECOM_BOT_ID, WECOM_BOT_SECRET
- [x] connector-hub.ts — PlatformDef with fields + steps
- [x] HubConfigIcons.tsx — PLATFORM_VISUALS entry (indigo)
- [x] HubListModal.tsx — CONNECTOR_LABELS: '企业微信'
- [x] .env.example — env var comment block
- [x] wecom-bot.png — 128×128 placeholder icon
- [x] Tests — 76 tests, all passing

Public layer diff=0: ConnectorRouter, OutboundDeliveryHook, StreamingOutboundHook, CommandLayer, BindingStore — zero changes.

### 测试结果

```
node --test packages/api/test/wecom-bot-adapter.test.js  # 76 passed, 0 failed
pnpm --filter @cat-cafe/shared run build                  # 成功
pnpm --filter @cat-cafe/api run build                     # 成功（type-check clean）
```

TypeScript: All 3 packages (shared, api, web) type-check clean (tsc --noEmit — no errors)
Lint: No new warnings introduced; all flagged warnings are pre-existing in untouched code

### 相关文档

- Feature: `docs/features/F132-dingtalk-wecom-gateway.md` (F132 Phase B)
- KD-7: New IM onboarding 11-step checklist (within F132 spec)
- SDK reference: `@wecom/aibot-node-sdk@1.0.4` (MIT)

## Review Target

```
Review-Target-ID: f132-phase-b
Branch: feat/F132-wecom-bot-adapter
Commit: 94a410831
```
