# Review Request: F098 Phase D — 消息流双时间标注 (deliveredAt)

## What

为排队消息添加 `deliveredAt` 字段，解决回顾 thread 时无法区分"发送时间"和"猫猫收到时间"的问题。

Backend:
- `StoredMessage.deliveredAt?: number` + `IMessageStore.markDelivered()`
- `QueueProcessor.executeEntry()` 在 dequeue 时回填 deliveredAt
- Redis hydration + API serialization + socket `messages_delivered` 事件

Frontend:
- `formatDualTime()`: gap > 5s 时显示 "发送 HH:MM · 收到 HH:MM"
- `chatStore.markMessagesDelivered()` + `useSocket` handler
- `useChatHistory` API 响应映射

## Why

铲屎官在猫猫调用期间发的消息进入排队，前端显示位置是发送时刻。回顾 thread 时分不清消息是什么时候被猫猫看到的，造成误导。

选择 Method A（双时间标注）而非 Method B（重排序）或 Method C（系统消息），因为：
- 不重排序 → 保留实时浏览体验
- 不加系统消息 → 不增加时间线噪音
- 最精确 → 读者自行判断延迟

## Original Requirements（必填）

> "假设你们正在猫猫调用这个阶段，我的消息在我们的 channel 里面排队嘛。但是我在前端看到的我的消息展现的位置是在我发的那一刻，但其实不是在你们收到的那一刻。这样子就会给别人一种误解，以后在回顾这整个 thread 的时候，就会分不清楚这些消息到底是什么时候被你们收到了。"

- 来源：铲屎官 2026-03-12 19:12 对话
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃了 Method B（按收到时间重排序）：会导致消息在实时浏览时跳动
- 放弃了 Method C（系统提示消息）：增加时间线噪音
- 5s 阈值：太短会对几乎即时的消息显示冗余信息，太长会漏掉有意义的延迟

## Open Questions

1. 5 秒阈值是否合适？（太短→噪音多，太长→错过有意义延迟）
2. `markDelivered` 是 best-effort（失败不阻塞执行），reviewer 是否认为需要更强保证？
3. 仅用户消息支持 deliveredAt（猫猫消息不排队不需要），是否有遗漏场景？

## Next Action

请 review 代码质量、边界处理、类型安全。特别关注 QueueProcessor 中 deliveredAt 回填位置的正确性。

## 自检证据

### Spec 合规
- AC-D1 ✅: deliveredAt 字段 + formatDualTime() 实现"发送时刻 vs 收到时刻"区分
- AC-D2 ✅: 双时间标注让读者理解实际处理顺序
- KD-6 已记录在 spec: Method A 双时间标注

### 测试结果
- Backend: 42/42 pass, 0 failed (message-store + queue-processor + new deliveredAt tests)
- Frontend: 3/3 pass, 0 failed (chat-message-delivered-at.test.ts)
- pnpm lint → 0 errors
- pnpm build → exit 0

### 相关文档
- Feature: `docs/features/F098-callback-message-ux.md`
- Decision: KD-6 (Method A dual timestamp)
