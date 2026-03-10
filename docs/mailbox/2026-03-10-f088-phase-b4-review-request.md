# Review Request: F088 Phase B (Command Layer) + Phase 4 (Streaming)

## What

11 commits adding two feature tracks to the multi-platform chat gateway:

**Phase B — IM Command Layer:**
- `ConnectorCommandLayer` — platform-agnostic `/new /threads /use /where` command parser
- `listByUser` on binding store (Memory + Redis ZADD/ZREVRANGE user index)
- `ConnectorRouter` command interception — `/` prefix → command path, else normal routing
- Deep link URL in `threadMetaLookup` for outbound replies

**Phase 4 — Edit-in-Place Streaming:**
- `IStreamableOutboundAdapter` interface — `sendPlaceholder()` + `editMessage()`
- `FeishuAdapter` streaming: `im.message.create` → `im.message.patch`
- `TelegramAdapter` streaming: `sendMessage` → `editMessageText`
- `StreamingOutboundHook` — manages streaming sessions with rate-limited edits (2s interval, 200 char delta)
- Wired into `ConnectorInvokeTrigger.executeInBackground()` (onStreamStart → onStreamChunk → onStreamEnd)
- Gateway bootstrap creates `StreamingOutboundHook` from streamable adapters subset

## Why

飞书/Telegram 用户无法管理 thread（被困在自动分配的单个 thread），也无法看到实时回复进度（只能等 final-only 一次性发送）。Phase B 让用户掌控 thread 切换，Phase 4 让回复像打字一样实时出现。

## Original Requirements

> "Phase B — 命令层 — 让你在飞书里能 /new /threads /use 管理 thread"
> "还有那个 streamable 飞书输出加上富文本支持"
> "可以你一起做吧！"
- 来源：本 session 铲屎官直接指示（2026-03-10）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Memory store `listByUser` 只保留当前 binding**: Memory store keyed by `connectorId:externalChatId`，rebind 会覆盖旧 binding。Redis store 用 Sorted Set 维护完整历史。Memory store 是开发/测试用，不影响生产。
- **Streaming 不走 rich block**: streaming 是纯文本 edit-in-place，rich block 走 `OutboundDeliveryHook.deliver()` 作为 follow-up 消息。两条路径互不干扰。
- **`/where` 深度链接硬编码 `frontendBaseUrl`**: 从 env 或 fallback `http://localhost:3001`，不走 DNS 动态解析。够用。

## Open Questions

1. **FeishuAdapter 275 行**：超过 200 行 warn 阈值（低于 350 硬限），需要 reviewer 判断是否值得拆分。sendPlaceholder + editMessage 是新增的，核心 parseEvent/sendReply 不变。
2. **Redis BIND_LUA 现在操作 3 个 key**: detail hash + rev set + user sorted set。原子性由 Lua 保证，但复杂度增加。
3. **Streaming rate limit 参数可配置但无 UI**: 默认 2s interval + 200 char delta，hardcoded 在 StreamingOutboundHook 构造函数。

## Next Action

请 review 以下文件（按重要性排序）：
1. `ConnectorCommandLayer.ts` — 命令解析逻辑
2. `StreamingOutboundHook.ts` — 流式会话管理
3. `connector-gateway-bootstrap.ts` — 组件组装
4. `RedisConnectorThreadBindingStore.ts` — Lua 原子操作 + listByUser
5. `ConnectorRouter.ts` — 命令拦截集成
6. 两个 Adapter 的 streaming 方法

## 自检证据

### Spec 合规
- AC-B1 ~ B8: 全部 checked（见 F088 feature doc Phase B section）
- AC-15 ~ 18: 全部 checked（见 F088 feature doc Phase 4 section）
- TypeScript: `tsc --noEmit` 零错误
- Biome: 仅剩 pre-existing warnings（index signature `['key']` 和 non-null assertion in config guard）

### 测试结果
```
F088 Phase B+4 specific tests:  64 passed, 0 failed
  - connector-command-layer.test.js: 12 tests (parser, /where, /new, /threads, /use)
  - streaming-outbound-hook.test.js: 8 tests (placeholder, rate-limit, chunks, cursor, cleanup)
  - feishu-adapter.test.js: 4 new tests (sendPlaceholder + editMessage)
  - connector-router.test.js: 4 command interception tests
  - connector-phase-b4-integration.test.js: 4 integration tests (command lifecycle, streaming lifecycle, coexistence)
  - connector-gateway-bootstrap.test.js: existing tests still pass
  - redis-connector-binding-store.test.js: 3 listByUser tests (pnpm test:redis)
```

### 相关文档
- Plan: `docs/plans/2026-03-10-f088-phase-b-commands-and-phase-4-streaming.md`
- Feature: F088 / `docs/features/F088-multi-platform-chat-gateway.md`
- Worktree: `cat-cafe-f088-phase-b4` / branch `feat/f088-phase-b4`
