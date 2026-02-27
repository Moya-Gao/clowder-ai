---
feature_ids: [F024]
topics: [thread, summary, cross]
doc_kind: bug-report
created: 2026-02-21
---

# Bug Report: thread_summary 跨线程泄漏

## 报告人

- **发现者**: 铲屎官（2026-02-21）
- **复现者**: 缅因猫（砚砚）— 确认可稳定打红
- **分析者**: 布偶猫（宪宪）

## 症状

1. **自动摘要打断 A2A 调用**：A2A 消息组正在构建时，跨线程 summary 插入导致 UI 渲染被打断
2. **自动摘要漂 thread**：当前在 thread2，后台 thread1 触发自动摘要后，摘要出现在 thread2 中

## 复现步骤

1. 打开 thread2，触发一个 A2A 调用（耗时较长）
2. thread1 在后台达到自动摘要阈值（或手动触发摘要）
3. **期望**: thread1 的摘要只出现在 thread1
4. **实际**: thread1 的摘要出现在 thread2 的消息列表中，且打断了 A2A 消息组的 UI 渲染

## 根因分析

### 定位过程

1. 缅因猫复现确认：`useSocket` 未对 `thread_summary` 做 thread guard
2. 布偶猫代码审计确认：
   - `useSocket.ts:229-231` — `thread_summary` 事件无任何 threadId 过滤，直接透传到 callback
   - `useChatSocketCallbacks.ts:53-62` — `onThreadSummary` 直接调用 `addMessage`（flat state），未检查 `s.threadId === threadId`

### 对比其他事件的防护

| 事件 | 是否有 thread guard | 说明 |
|------|-------------------|------|
| `agent_message` | **双指针** (route + store) | 完善 |
| `intent_mode` | **双指针** (route + store) | 完善 |
| `authorization:request` | **单指针** (threadIdRef) | 足够 |
| `mode_changed` | **单指针** (threadIdRef) | 足够 |
| `thread_summary` | **无** | **BUG** |

### 后端是否正确？

后端 room-scoped broadcast 是正确的（`broadcastToRoom('thread:X', ...)`），但前端客户端会通过 `joinRoom/syncRooms` 同时订阅多个 thread room（持久化 session、split-pane 等），所以客户端会收到多个线程的事件。其他事件类型都在前端做了 guard，唯独 `thread_summary` 遗漏了。

## 修复方案

**在 `useSocket.ts` 为 `thread_summary` 添加单指针 thread guard**（与 `authorization:request` / `mode_changed` 同模式）：

```ts
socket.on('thread_summary', (summary: Record<string, unknown>) => {
  const currentThread = threadIdRef.current;
  if (summary.threadId && currentThread && summary.threadId !== currentThread) return;
  callbacksRef.current.onThreadSummary?.(summary);
});
```

**为什么选单指针而非双指针**：
- Summary 是一次性事件（非流式），不需要复杂的 background routing
- Summary 已在后端持久化（`summaryStore`），用户切到对应 thread 时会从 API 获取
- 最坏情况：切换窗口期 summary 丢失一条前端通知，下次进 thread 仍可见

**放弃的备选方案**：
- 双指针 + background routing（类似 `agent_message`）— 过度设计，summary 不是流式消息
- 只在 `useChatSocketCallbacks` 加 guard — 防线太晚，应在 socket layer 统一拦截

## 验证方式

1. 在 `useSocket-thread-guard.test.ts` 添加 `thread_summary` 跨线程泄漏测试（先红后绿）
2. 跑 `pnpm --filter @cat-cafe/web test` 确认全绿
