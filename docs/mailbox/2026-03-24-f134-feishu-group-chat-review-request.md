# Review Request: F134 Feishu Group Chat — Phase A+B+C

## What

Enable the Cat Café Feishu bot to handle **group chat** messages (not just DM). Three phases implemented:

- **Phase A (Inbound)**: FeishuAdapter parses group chat events with @bot detection, strips @bot placeholder, extracts sender info, resolves sender name via Contact API and chat name via Chat API
- **Phase B (Routing)**: ConnectorRouter routes group chat messages with sender binding at message level (not thread level), creates threads titled `飞书群聊 · {chatName}`
- **Phase C (Outbound)**: OutboundDeliveryHook looks up stored message sender to inject `replyToSender` metadata for per-message @sender replies; InvocationQueue prevents connector message merge (KD-10)

## Why

铲屎官 needs the Feishu bot to work in group chats where multiple users @bot. The core challenge: each reply must @the correct sender, not a stale/wrong one. This required a fundamental design shift from thread-level to **message-level sender binding** (KD-9).

## Original Requirements（必填）

> 铲屎官原话：
> 1. "飞书机器人加入多个群"
> 2. "不同的人 at 你，我们需要区分不同的用户"
> 3. "区分到底哪个群聊给哪个 thread 发了信息"
> 4. "@所有人的时候bot不要响应，明确@bot才响应"
> 5. "群聊名字+群聊ID+发送消息的人"需要在UI展示

- 来源：`docs/features/F134-feishu-group-chat.md` (KD section)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Thread-level vs message-level sender**: Chose message-level binding (sender on ConnectorSource per message) over thread-level lastSender. This is more complex but solves the AC-C3 "multi-person @bot" precision requirement.
- **Contact/Chat API TTL cache**: 30-minute TTL Map cache instead of Redis cache. Simple and sufficient for reasonable group sizes. Avoids Redis dependency for a read-only lookup.
- **Connector queue merge禁止**: All connector messages now never merge (not just cross-sender). Simpler rule, minor UX cost (consecutive messages from same sender won't merge), but eliminates the merge-race class of bugs entirely.

## Open Questions

1. **OutboundDeliveryHook messageLookup**: Uses `messageStore.getById` which is optional. If not implemented, group chat @sender replies fall back to no-@ (graceful degradation). Reviewer should verify this fallback is acceptable.
2. **Bot open_id resolution**: Async on startup via `/bot/v3/info` API. If it fails, group chat @bot detection is disabled (all group messages ignored). Is this fail-safe acceptable, or should it be fail-open?
3. **FeishuAdapter `@_user_N` stripping**: Uses regex to strip all `@_user_N` patterns. Should we only strip the bot's own placeholder and preserve other user @mentions in the text?

## Next Action

请 @codex review Phase A+B+C 实现。重点关注：
- 缅因猫护栏1: `deliver(triggerMessageId?)` type layer sync
- 缅因猫护栏2: `callbacks` path graceful fallback for empty triggerMessageId
- 缅因猫护栏3: `connector禁merge` regression tests coverage
- AC-C3 @sender precision correctness

Review-Target-ID: f134
Branch: feat/f134-feishu-group-chat

## 自检证据

### Spec 合规
- All AC-A (6/6), AC-B (5/5), AC-C (3/3) verified ✅
- Phase D explicitly deferred per 铲屎官 confirmation
- 缅因猫 Design Gate passed (3 rounds)

### 测试结果
```
node --test feishu-adapter.test.js invocation-queue.test.js connector-router.test.js outbound-delivery-hook.test.js
→ 157 tests, 25 suites, 157 pass, 0 fail ✅

pnpm check → 0 errors ✅ (biome format + lint)
pnpm -r --if-present run build → shared ✅, mcp-server ✅, api ✅, web ✅
```

### 相关文档
- Feature Spec: `docs/features/F134-feishu-group-chat.md`
- Tech Design: KD-9 (message-level sender), KD-10 (queue merge禁止), KD-11 (sender → @reply)

### Files changed (12 files, ~400 LOC added)
| File | Layer | Change |
|------|-------|--------|
| `packages/shared/src/types/connector.ts` | L1 | +`sender?` on ConnectorSource |
| `packages/api/.../FeishuAdapter.ts` | L2 | Group chat parseEvent + resolveSenderName/ChatName |
| `packages/api/.../ConnectorRouter.ts` | L3 | route() extended + sender pass-through |
| `packages/api/.../connector-gateway-bootstrap.ts` | L3c | Bot open_id init + sender/chat enrichment wiring |
| `packages/api/.../ConnectorInvokeTrigger.ts` | L3b | sender param through trigger chain |
| `packages/api/.../OutboundDeliveryHook.ts` | L4 | messageLookup + replyToSender |
| `packages/api/.../InvocationQueue.ts` | L5 | senderMeta + connector禁merge |
| `packages/api/.../QueueProcessor.ts` | L4b | triggerMessageId type |
| `packages/api/src/routes/callbacks.ts` | L4b | triggerMessageId type |
| `packages/api/src/routes/messages.ts` | L4b | triggerMessageId type |
| `packages/web/.../ConnectorBubble.tsx` | UI | Sender sub-label display |
| `packages/api/test/feishu-adapter.test.js` | Tests | +13 new tests |
| `packages/api/test/invocation-queue.test.js` | Tests | +3 new tests |
