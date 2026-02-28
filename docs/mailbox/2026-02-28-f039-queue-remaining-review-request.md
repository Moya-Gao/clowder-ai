---
feature_ids: [F039]
debt_ids: []
topics: [queue, hydration, images, bugfix, review]
doc_kind: review_request
created: 2026-02-28
---

# Review 请求：F039 队列遗留修复（后端图片透传 + pauseReason hydration）

> Author: 砚砚（本分支写代码）  
> Reviewer: 宪宪/Opus（按 SOP 跨猫 review）  
> Branch: `fix/f039-queue-remaining`

## 背景

F039 队列功能 Phase A/B/C 已合入，但还残留两处体验/功能断裂：

1. 排队消息带图片时，后端执行链路不透传 `contentBlocks` → 猫看不到图片（功能缺失）
2. F5 刷新走 `GET /queue` 只恢复 `paused` boolean，不恢复暂停原因（体验不一致）

## 铲屎官原始需求（摘录 ≤5 行）

来自交接：`docs/mailbox/2026-02-28-f039-remaining-bugs-handoff.md`

> QueueProcessor.executeEntry() 处理排队消息时，只传递 entry.content（纯文本），不从 messageStore 补取 contentBlocks。  
> 结果：铲屎官排队发了带图片的消息，猫拿到的只有文字，图片丢了。  
> WebSocket queue_paused 事件携带 reason，但 F5 刷新走 GET /queue 只返回 paused，不返回 reason。

## 设计文档

- Handoff（问题定义 + tradeoff + open questions）：`docs/mailbox/2026-02-28-f039-remaining-bugs-handoff.md`
- F039 Feature 文档（愿景/范围）：`docs/features/F039-message-queue-delivery.md`

## Spec Compliance 自检（Step 2）

| # | 要求 | 状态 | 证据 |
|---|------|------|------|
| 1 | GET /queue 返回 `pauseReason?: 'canceled'|'failed'` | ✅ | `packages/api/src/routes/queue.ts` + `packages/api/test/queue-api.test.js` |
| 2 | F5 hydration 恢复 pauseReason（store queuePauseReason） | ✅ | `packages/web/src/hooks/useChatHistory.ts` + `packages/web/src/hooks/__tests__/useChatHistory-queue.test.ts` |
| 3 | QueueProcessor 执行排队条目时透传 contentBlocks（含 mergedMessageIds） | ✅ | `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts` + `packages/api/test/queue-processor.test.js` |
| 4 | 相关回归测试全绿 | ✅ | API + Web test 输出见下方 |

## 改动文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts` | 修改 | `pausedThreads: Map` + `getPauseReason`；执行时从 messageStore 聚合 `contentBlocks` 并透传到 routeExecution opts |
| `packages/api/src/routes/queue.ts` | 修改 | GET 返回 `pauseReason` |
| `packages/api/src/index.ts` | 修改 | QueueProcessor DI 注入 `messageStore` |
| `packages/api/test/queue-api.test.js` | 修改 | 新增 pauseReason 断言（Red→Green） |
| `packages/api/test/queue-processor.test.js` | 修改 | 新增 contentBlocks 聚合断言（Red→Green） |
| `packages/api/test/queue-integration.test.js` | 修改 | 补齐 QueueProcessor deps（messageStore stub） |
| `packages/web/src/hooks/useChatHistory.ts` | 修改 | fetchQueue 解析并传递 `pauseReason` |
| `packages/web/src/hooks/__tests__/useChatHistory-queue.test.ts` | 修改 | paused=true 时断言 `queuePauseReason` |

## Git SHA

- Base: `31b4c3b`
- Head: `cc82c6f`

## 测试状态

```bash
# API（注意：env -u REDIS_URL 避免触发 Redis 隔离守卫）
env -u REDIS_URL pnpm --filter @cat-cafe/api test
# => tests 2204, pass 2203, skip 1, fail 0

# Web
pnpm --filter @cat-cafe/web test
# => 87 files, 554 pass, 0 fail

# Build
env -u REDIS_URL pnpm -r --if-present run build
# => API + MCP + Web build clean（Next lint warnings pre-existing）
```

## Review 重点

1. `QueueProcessor.executeEntry()` 聚合 `contentBlocks` 的顺序/覆盖（messageId + mergedMessageIds）是否符合我们预期
2. `getPauseReason()` 语义：当 queue 为空时应返回 undefined（现在依赖 `isPaused()`）
3. `QueueProcessor` 依赖 `IMessageStore.getById` 的引入是否会带来循环依赖/初始化问题（我已在 `index.ts` 做 DI 注入）

## 五件套

- **What**: 修复 F039 遗留两项：队列执行透传图片 contentBlocks；GET /queue + hydration 恢复 pauseReason
- **Why**: 图片丢失是功能断裂；pauseReason 丢失破坏“人在环可见性”一致性
- **Tradeoff**: 不把 contentBlocks 存入 QueueEntry（避免 WS payload 膨胀）；改为 executeEntry 按 messageId 现取
- **Open Questions**: 无（这轮在现有签名/接口内完成；如后续要优化性能再讨论）
- **Next Action**: 请宪宪 review，若 0 P1/P2 放行我进入 merge gate → PR → 云端 review

