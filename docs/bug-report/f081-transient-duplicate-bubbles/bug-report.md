---
feature_ids: [F081]
topics: [frontend, bubble, duplicate, reconcile, optimistic, hydration]
doc_kind: bug-report
created: 2026-03-08
---

# Bug Report: Frontend 瞬时双影气泡

## 1. 报告人

- 报告人：铲屎官
- 发现方式：真实使用时偶发看到“自己的消息出现两条”或“同一只猫的回复出现两条”，但 `F5` 后又只剩一条
- 时间：2026-03-08

## 2. 复现步骤（期望 vs 实际）

1. 在前端发送一条消息，或切到后台 thread 让猫继续回复。
2. 观察主区时间线。
3. 在不刷新页面的情况下，偶发会出现两条看起来是同一条的用户消息，或两条内容相同的 assistant 回复。
4. 执行 `F5` 刷新页面后，再次观察同一 thread。

期望：
- 同一条消息在前端任意时刻都只应有一个可见实例。

实际：
- 前端本地 store 偶尔短暂保留了“optimistic / placeholder”和“正式历史消息”两份。
- `F5` 之后服务器历史只有一条，因此重复会消失。

## 3. 根因分析

这次不是后端存了重复消息，而是前端本地 reconcile 还留了身份缺口：

1. **用户消息硬根因**
   - `useSendMessage.ts` 会先写一个 optimistic user bubble，ID 形如 `user-*`
   - `POST /api/messages` 虽然早就知道真实的 `storedUserMessage.id`，但之前没有把它回给前端
   - 前端因此无法把 optimistic user bubble 改名成真实 message id
   - 当后续 history replace / rehydrate 带回正式历史消息时，就会短暂出现两条用户消息

2. **assistant callback 背景链路根因**
   - active thread 的 callback assistant message 已使用后端 `messageId`
   - 但 background thread 的 callback message 之前会自行生成 `bg-cb-*` synthetic id
   - 当同一条 callback 消息后来以正式历史形式出现时，前端就会暂时保留 synthetic bubble + persisted bubble 两份

3. **为什么 F5 后会恢复正常**
   - `F5` 后前端重建状态，只读取服务器真相源
   - 服务器里本来就只有一条，所以刷新后重复消失

## 4. 修复方案

1. 在 `chatStore` 增加 `replaceMessageId / replaceThreadMessageId`
   - 用于把 optimistic / placeholder bubble 原地对位成真实 message id
   - 如果真实 id 已存在，则丢掉临时 duplicate，只保留 canonical message

2. `POST /api/messages` 响应增加 `userMessageId`
   - queue / immediate 两条路径都回传真实 user message id

3. `useSendMessage` 改为：
   - 为每次发送生成稳定 `idempotencyKey`
   - optimistic bubble 先用临时 id
   - 收到响应后按 `threadId` 调 `replaceThreadMessageId(...)` 做精确 reconcile

4. background callback assistant message 改为优先使用后端 `messageId`
   - 不再无条件生成 `bg-cb-*`

## 5. 验证方式

- Web 回归：
  - `useSendMessage-thread-source.test.ts`
  - `chatStore-multithread.test.ts`
  - `useSocket-background.test.ts`
- API 回归：
  - `messages-delivery-mode.test.js`
- 结果：
  - Web `86/86` 绿
  - API `11/11` 绿
