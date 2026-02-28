---
feature_ids: [F039]
debt_ids: []
topics: [queue, force-send, cancel, websocket]
doc_kind: bug-report
created: 2026-02-27
---

# F39 Force Send / Cancel / Queue 三连 Bug

## 报告人

铲屎官，2026-02-27 20:52 手动测试发现。在 cat-cafe-runtime 上对砚砚测试 Force Send 功能时触发。

## 复现步骤

1. 对话中发送 `@codex 我借用你测试一下强制推送` → Codex 开始回复
2. Codex 回复中，输入 `@codex 喵`，点击红色闪电 ⚡ 强制发送
3. 观察行为

### 期望 vs 实际

| # | 期望 | 实际 |
|---|------|------|
| Bug 1 | "喵" 中断旧调用并立即执行 | 旧调用被取消，但 "喵" 没有执行 |
| Bug 2 | 取消后 Codex 停止输出 | 取消后 Codex 仍然冒泡输出了完整回复 |
| Bug 3 | 队列面板清空或显示最新状态 | 队列面板显示旧条目，第三条消息时前两条还在 |

## 根因分析

### Bug 1: Force Send = Cancel Only，新消息不执行

**代码路径** (`messages.ts:289-298`):
```
force mode → tracker.cancel() → fall through → invocationRecord.create() → tracker.start() → background execution
```

代码结构正确，cancel 后确实 fall through 到新的执行路径。但存在 **QueueProcessor 状态中毒**：

1. `cancel()` abort 旧 controller → 旧 invocation 的 background IIFE 的 `finally` 块异步执行
2. `finally` 调用 `queueProcessor.onInvocationComplete(threadId, 'failed')` （注意：`finalStatus` 从未设为 `'canceled'`，默认是 `'failed'`）
3. `onInvocationComplete('failed')` → `pausedThreads.add(threadId)` → 发射 `queue_paused` WS 事件
4. 前端收到 `queue_paused` → 可能将 UI 状态设置为"暂停"而非显示新 invocation 的流式输出

**关键文件**:
- `packages/api/src/routes/messages.ts:368` — `finalStatus` 初始化为 `'failed'`，从未设为 `'canceled'`
- `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts:84-98` — `onInvocationComplete` 暂停逻辑

### Bug 2: Cancel 后仍有输出泄漏

`cancel()` 设置 `controller.signal.aborted = true` 并 SIGTERM 子进程，但：

1. **`route-serial.ts` 内层循环**（`for await` 处理单猫流式输出）**没有检查 `signal.aborted`** — 只在外层 `while` 循环（多猫间切换）检查
2. **`messages.ts` 的外层 `for await`**（广播 agent messages 到 WS）**也没有检查 `signal.aborted`**
3. **`broadcastAgentMessage()`** 无条件广播，不检查取消状态
4. 子进程 stdout pipe 缓冲区已有数据继续排出

**结果**：SIGTERM 后 pipe 缓冲区中已有的 NDJSON 行仍然被解析、yield、广播到前端。

**关键文件**:
- `packages/api/src/domains/cats/services/agents/routing/route-serial.ts:219-304` — 内层循环无 abort 检查
- `packages/api/src/routes/messages.ts:415-430` — 外层循环无 abort 检查

### Bug 3: 队列面板显示残留条目

三个因素叠加：

1. **`finalStatus` 从未设为 `'canceled'`**：`messages.ts:368` 初始化为 `'failed'`，被 abort 时走 catch → 仍是 `'failed'` → `queue_paused` 事件 reason 错误
2. **Force 路径不发射 `queue_updated`**：`messages.ts:289-298` cancel 后没有通知前端更新队列面板
3. **前端 `queue_paused` handler 冻结条目**：`useSocket.ts:294-298` 设置 `queuePaused=true` 后，只有队列变空才自动解除暂停 → 面板永远显示旧条目

**关键文件**:
- `packages/web/src/hooks/useSocket.ts:294-298` — `queue_paused` handler
- `packages/web/src/stores/chatStore.ts:284-308` — `setQueue` 逻辑

## 修复方案

### Bug 1 Fix: Force 路径后清除 QueueProcessor 暂停状态

在 `messages.ts` force 路径 cancel 后，立即调用 `queueProcessor.clearPause(threadId)` 防止旧 invocation 的异步 cleanup 中毒。

同时：在 `messages.ts` 的 background IIFE `finally` 中，正确设置 `finalStatus = 'canceled'`（当 `signal.aborted` 时）。

### Bug 2 Fix: 内层流式循环加 abort 检查

在 `route-serial.ts` 内层 `for await` 和 `messages.ts` 外层 `for await` 中加 `if (signal?.aborted) break;` 检查。

### Bug 3 Fix: Force 路径发射 queue_updated + 修正 finalStatus

1. Force cancel 后发射 `queue_updated`（或 `queue_cleared`）通知前端
2. 修正 `finalStatus` 设为 `'canceled'`（而非 `'failed'`）
3. 前端 `queue_paused` handler 在 force 场景下正确处理

## 验证方式

- Bug 1: 单元测试 — force mode 发送后验证 routeExecution 被调用
- Bug 2: 单元测试 — cancel 后验证不再 broadcast agent messages
- Bug 3: 单元测试 — force cancel 后验证 queue_updated 被发射
- E2E: 模拟完整 force send 场景，验证新消息执行 + 队列清空
