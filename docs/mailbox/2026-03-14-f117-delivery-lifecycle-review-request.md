# Review Request: F117 Message Delivery Lifecycle — 消息投递生命周期真相源

## What

完整的消息投递生命周期实现，修复 queued/canceled 消息泄漏到聊天流、History API 和猫猫 prompt context 的问题。

核心变更：
- **StoredMessage** 新增 `deliveryStatus?: 'queued' | 'delivered' | 'canceled'` 字段 + `isDelivered()` helper + `markCanceled()` 方法
- **Enqueue path**: 持久化 user message 时带 `deliveryStatus: 'queued'`
- **History API + ContextAssembler + Mentions**: 过滤 undelivered 消息
- **QueueProcessor**: `markDelivered()` 同时设 `deliveryStatus: 'delivered'`，扩展 `messages_delivered` 事件携带完整 message payload
- **Withdraw/Clear**: 标 `canceled` + 发 `message_deleted`
- **Frontend**: queue send 跳过乐观插入，`messages_delivered` 触发 bubble 插入

## Why

社区 issue #20 + 铲屎官 2026-03-14 实测确认 3 个 Bug：
1. 队列消息提前显示气泡（Bug 1）
2. 取消后消息仍在气泡 + 仍进入猫猫上下文（Bug 2）
3. queued @mention 提前进入 pending-mentions（Bug 3a）

根因：无 delivery status 概念，History API / ContextAssembler / Mention surfaces 不区分消息状态。

## Original Requirements（必填）
> "前端不应该显示你们真正没有收到的消息，对吧？"
> "当我发了一个正在队列的消息的时候，我的用户气泡这里先不显示，等到你们真的收到这个消息的那一刻，再在正确的地方插入这个气泡"
> "取消后气泡消失，猫猫永远不应该看到这条消息"
- 来源：铲屎官 2026-03-14 语音消息 + 截图（session 4b8f78e6）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃社区 PR #25 的纯前端过滤方案 — 只修渲染层，withdraw resurfacing 和 context 污染未闭合
- 选择显式 `deliveryStatus` 字段而非 `deliveredAt` 时间戳过滤 — 老数据无 `deliveredAt`，按时间戳过滤会误伤历史消息（KD-1）
- `canceled` 消息保留 tombstone 而非 hard delete — 为审计留余地（OQ-1 待定）

## Open Questions

1. **老数据兼容**: `isDelivered()` 对 `deliveryStatus === undefined` 返回 `true`，确保历史消息不被过滤。Reviewer 请确认这个兼容策略是否安全
2. **Redis hydration**: `deliveryStatus` 在 `RedisMessageStore` 的两个 hydration 点都已添加（单条 `getById` + 批量 `hydrateMessages`）。请确认无遗漏
3. **Frontend dedup**: `markMessagesDelivered` 用 `existingIds` Set 防止重复插入。Reviewer 请评估是否有竞态风险
4. **Bug 3b out of scope**: `post_message` callback 路由的 @mention 问题不在 F117 scope，需另开

## Next Action

请 reviewer 逐项对照 15 个 AC（A1-A9 + B1-B6），重点关注 Open Questions 中的 4 个问题。

## 自检证据

### Spec 合规

| AC | 状态 | 代码位置 |
|----|------|----------|
| A1 | ✅ | `MessageStore.ts:70-71` |
| A2 | ✅ | `messages.ts:~251` |
| A3 | ✅ | `MessageStore.ts` getByThread filter |
| A4 | ✅ | `ContextAssembler.ts:109` |
| A5 | ✅ | `QueueProcessor.ts:320-350` |
| A6 | ✅ | `queue.ts:122-142` |
| A7 | ✅ | `queue.ts:273-298` |
| A8 | ✅ | integration regression test |
| A9 | ✅ | `MessageStore.ts` getMentionsFor filter |
| B1 | ✅ | `useSendMessage.ts:96-101` |
| B2 | ✅ | `chatStore.ts:499-520` |
| B3 | ✅ | `useChatSocketCallbacks.ts:85` (pre-existing) |
| B4 | ✅ | Backend getByThread filter |
| B5 | ✅ | QueuePanel unchanged |
| B6 | ✅ | `chatStore.ts:509` existingIds check |

### 测试结果
```
node --test packages/api/test/delivery-status.test.js → 13/13 pass ✅
pnpm lint                                             → 0 errors ✅
pnpm check                                           → 0 errors ✅
pnpm -r --if-present run build                        → exit 0 ✅
pnpm --filter @cat-cafe/web test                      → 21 failed / 170 passed
  (main: 22 failed / 169 passed — 无退化，改善 1)
```

### 相关文档
- Feature: `docs/features/F117-message-delivery-lifecycle.md`
- Plan: `docs/plans/2026-03-14-f117-delivery-lifecycle.md`
- Related: F039, community issue #20, community PR #25

### Commits (6)
1. `1fd654a9` — deliveryStatus field + isDelivered + markCanceled (AC-A1)
2. `deae012d` — filter undelivered from history/context/mentions (AC-A3, A4, A9)
3. `6c2c4688` — enqueue sets queued + withdraw/clear marks canceled (AC-A2, A6, A7)
4. `c725900b` — extend messages_delivered payload (AC-A5)
5. `4c193c9c` — skip optimistic insert + deliver-time bubble insert (AC-B1-B6)
6. `978a2731` — biome format fix + feature index

---

[布偶猫🐾]
