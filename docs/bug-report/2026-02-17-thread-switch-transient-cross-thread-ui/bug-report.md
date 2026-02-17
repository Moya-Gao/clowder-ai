# Bug Report: Thread 切换瞬间 UI 串线（刷新后恢复）

> 日期：2026-02-17  
> 报告人：铲屎官（实际使用中发现）  
> 定位：缅因猫（砚砚）  
> 严重度：P1（会误导用户在错误线程看到别的线程输出）

## 1. 报告人

- 报告人：铲屎官
- 现象：thread A 未在使用，却出现 timeout/输出；thread B 的进行中输出看起来“跑到 A 里”
- 关键证据：按 `F5` 刷新后恢复正常

## 2. 复现步骤（期望 vs 实际）

1. 在线程 A 与线程 B 之间快速切换。
2. 在切换窗口里，让线程 B 持续收到 `agent_message`（text/tool 等流式事件）。
3. 观察当前 UI 的消息归属。

**期望行为**：
- 线程 B 的流式事件只更新线程 B；线程 A 不应出现 B 的内容。

**实际行为**：
- 切换窗口偶发出现“B 的事件写进 A 的当前 UI”现象；刷新后按后端持久化重载，错位消失。

## 3. 根因分析

### 现状路径

- `useSocket` 用 URL `threadIdRef` 判定“active thread”并把该消息转给 `onMessage`。
- `onMessage -> useAgentMessages` 使用 flat active-thread store（`addMessage/appendToMessage`）写 UI。
- `setCurrentThread(threadId)` 在 `ChatContainer` 的 effect 中执行，存在短窗口：
  - URL thread 已更新为 B，
  - 但 store 的 `currentThreadId` 仍是 A。

### 竞态后果

在该窗口到达的 `threadId=B` 消息会被当成 active 消息处理，但实际写入的是仍指向 A 的 flat state，从而造成跨线程错位显示。刷新后重新按 thread 拉历史，所以表象“恢复正常”。

## 4. 修复方案（为何选择）

主方案（最小修复）：
- 在 `useSocket` 的 `agent_message` 路由中，active 判定改为 **双重一致**：
  - `msg.threadId === routeThreadId`
  - `msg.threadId === store.currentThreadId`
- 只有同时满足才走 active `onMessage`；否则走 background 分支。

Why：
- 不改后端协议，不改消息模型；只在前端路由层补竞态保护。
- 直接阻断“route 已切但 store 未切”的错误写入窗口。

放弃方案：
- 仅依赖 `useLayoutEffect` 提前 `setCurrentThread`：可缩小窗口，但不如路由层防线稳妥。
- 在 `useAgentMessages` 做 thread 过滤：侵入较大，且信息已在 `useSocket` 可判定。

## 5. 验证方式

1. Red：新增回归测试，构造 `routeThread=B`、`storeThread=A` 时收到 `threadId=B` 消息，断言 `onMessage` 不被调用。
2. Green：修复后同测试转绿，且消息走 background handler。
3. 回归：
   - `useSocket-thread-guard` 测试集
   - `useSocket-background` 测试集
