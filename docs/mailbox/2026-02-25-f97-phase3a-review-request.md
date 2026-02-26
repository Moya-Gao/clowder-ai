---
feature_ids: [F097]
topics: [phase3a, request]
doc_kind: mailbox
created: 2026-02-25
---

# Review 请求: F97 Phase 3a — Connector Messages 抽象 + 前端气泡

## 背景

铲屎官指示"把 Email Watcher 这套做完整"，要求：
- review 通知在前端以**专属气泡**展示（区别于用户/猫/系统消息）
- 通过**抽象 connector 模型**为未来信息源（iMessage、Slack）留位
- 这是 Phase 3a（可视化），Phase 3b（自动唤起）和 3c（Redis 持久化）为后续

## 设计文档

- **Plan**: `docs/plans/2026-02-25-connector-messages-phase3.md`（Phase 3a 部分）
- **BACKLOG**: #97 — Connector Messages — 外部信息源抽象 + 自动唤起
- **前置**: BACKLOG #81 Phase 1+2 已合入 (`e50f99c`)

## Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 | 测试 |
|---|-----------|------|----------|------|
| 1 | Shared: `ConnectorSource` 接口 | ✅ | `shared/types/connector.ts:14-25` | parser 9 cases |
| 2 | Shared: `ConnectorDefinition` + registry | ✅ | `shared/types/connector.ts:30-67` | 静态数据 |
| 3 | Backend: `StoredMessage.source?` 字段 | ✅ | `stores/ports/MessageStore.ts:58` | — |
| 4 | Backend: 三路 type 判定 | ✅ | `routes/messages.ts:515` | endpoint 2 cases |
| 5 | Backend: API response 透传 source | ✅ | `routes/messages.ts:526` | endpoint test |
| 6 | Backend: Redis 序列化/反序列化 | ✅ | `RedisMessageStore.ts:69,120,495` | parser 9 cases |
| 7 | Backend: `safeParseConnectorSource` | ✅ | `redis-message-parsers.ts` | 9 edge cases |
| 8 | Backend: ContextAssembler 用 source.label | ✅ | `ContextAssembler.ts` | 1 case |
| 9 | ReviewRouter: source 字段 (review+triage) | ✅ | `ReviewRouter.ts:175,203` | 3 cases |
| 10 | Frontend: `ChatMessage.type += 'connector'` | ✅ | `chat-types.ts:116` | — |
| 11 | Frontend: `ConnectorBubble` 组件 | ✅ | `ConnectorBubble.tsx` | — |
| 12 | Frontend: useChatHistory mapper | ✅ | `useChatHistory.ts:76-90` | — |
| 13 | 视觉: 左对齐 + icon 头像 + 蓝色调 + 可点击链接 + rounded-bl-sm | ✅ | `ConnectorBubble.tsx:52-79` | — |

偏离：
- Registry 用 array+Map 而非纯 Map（API 等效，array 更便于 as const）
- `ConnectorSource` 放 shared 而非 MessageStore（前端也需要类型）
- 气泡用固定 blue-50，未读取 ConnectorDefinition.color（单 connector，后续动态化）

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `shared/types/connector.ts` | **新增** | ConnectorSource + ConnectorDefinition + registry |
| `shared/types/index.ts` | 修改 | 导出新类型 |
| `stores/ports/MessageStore.ts` | 修改 | StoredMessage 新增 source? 字段 |
| `routes/messages.ts` | 修改 | 三路 type 判定 + source 透传 |
| `ContextAssembler.ts` | 修改 | connector 消息用 source.label 做发言人 |
| `RedisMessageStore.ts` | 修改 | 序列化/反序列化两条路径 |
| `redis-message-parsers.ts` | 修改 | 新增 safeParseConnectorSource |
| `ReviewRouter.ts` | 修改 | postReviewMessage + postTriageMessage 附带 source |
| `chat-types.ts` | 修改 | type union + ConnectorSourceData 接口 |
| `useChatHistory.ts` | 修改 | mapper 透传 source |
| `ChatMessage.tsx` | 修改 | isConnector 分支 → ConnectorBubble |
| `ConnectorBubble.tsx` | **新增** | 蓝色独立气泡组件 |
| `connector-source-parser.test.js` | **新增** | 9 个 parser 测试 |
| `review-router.test.js` | 修改 | +3 ConnectorSource 测试 |
| `messages-endpoint.test.js` | 修改 | +2 type mapping 测试 |
| `context-assembler.test.js` | 修改 | +1 source.label sender 测试 |

## Git SHA

- Base: `fda96f2` (main)
- Head: `91c66a1` (feat/f97-connector-messages)

## 测试状态

```
pnpm --filter @cat-cafe/api test:
  1910 pass, 0 new failures
  (1 pre-existing Redis isolation guard failure — redis-thread-store.test.js:200)

pnpm --filter @cat-cafe/web exec tsc --noEmit:
  0 new errors (26 pre-existing in test files)

New tests: 15
  - connector-source-parser.test.js: 9
  - review-router.test.js ConnectorSource: 3
  - messages-endpoint.test.js connector mapping: 2
  - context-assembler.test.js source.label: 1
```

## Review 重点

1. **三路 type 判定** (`messages.ts:515`): `catId ? assistant : source ? connector : user` — 优先级是否正确？如果一条消息同时有 catId 和 source 会怎样？
2. **safeParseConnectorSource 容错** (`redis-message-parsers.ts`): 损坏数据降级为 undefined 是否足够，还是需要 log.warn？
3. **ConnectorBubble 安全**: `source.url` 直接渲染为 `<a href>`，是否需要 URL 白名单（目前只有 github.com）？
4. **偏离判断**: 气泡用固定 blue-50 而非 ConnectorDefinition.color，多 connector 时再动态化——这个 tradeoff 合理吗？

## 五件套

**What**: F97 Phase 3a — 为 StoredMessage 新增 `source` 字段（ConnectorSource 类型），前端新增 `connector` 消息类型 + ConnectorBubble 组件，ReviewRouter 发消息时附带 source

**Why**: 铲屎官要求 Email Watcher 发出的通知以专属气泡展示，并为未来外部信息源做抽象。ConnectorSource 是通用模型，不仅适用于 GitHub Review

**Tradeoff**:
- 放弃了将 ConnectorSource 定义在 MessageStore.ts（放 shared 让前端也能用）
- 放弃了动态读取 ConnectorDefinition.color（Phase 3a 只有一种 connector，YAGNI）
- 未实现 Phase 3b 自动唤起和 Phase 3c Redis 持久化（按 spec 分 phase）

**Open Questions**:
- `source.url` 是否需要前端 URL 白名单校验？
- safeParseConnectorSource 损坏时是否需要 log？

**Next Action**: 请 @缅因猫 全量 review 上述 16 个文件
