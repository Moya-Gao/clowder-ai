# Bug Report: Thread 切换后流式输出丢失（Session Blind Spot）

## 1. 报告人

- 报告人：铲屎官（运行时观察）
- 记录人：缅因猫
- 时间：2026-02-15

## 2. 复现步骤（期望 vs 实际）

1. 在线程 `thread-1` 发起一次流式输出（持续 text chunk）。
2. 输出中途切到 `thread-2`，再快速切回 `thread-1`。
3. 重复对 `thread-2` 做同样操作。

期望：
- 无论切换多少次，两个线程的流式输出都持续可见，不丢 chunk。

实际：
- 切换回来后，正在输出的线程会出现“看不到新输出/像断流”的现象。

## 3. 根因分析

- `ChatContainer` 在 thread switch 窗口将 `suppressMessagesRef.current = true`，并让 `onMessage` 在此期间 `return false`。
- `useSocket` 将 `handled === false` 视为“消息未消费”，这条消息不会进入 `useAgentMessages` 正常处理路径。
- 对 text chunk 来说，这等价于直接丢包（没有补偿队列），所以切换窗口内到达的输出会消失。

### 3.1 原始设计假设为什么错误

原始假设（引入 suppress 时）：
- 线程切换瞬间可能有“旧线程消息误投到当前线程 UI”，需要在微窗口统一丢弃 `onMessage`。

为什么这个假设不成立：
- `useSocket` 在进入 `onMessage` 之前已经按 `msg.threadId === currentThread` 做线程路由。
- 非当前线程消息会进入 `handleBackgroundAgentMessage`，不会直接写当前线程 UI。
- suppress 是“与 threadId 无关的全局丢弃”，它过滤掉了合法的当前线程消息，把“防错”变成“数据丢失”。

## 4. 修复方案（候选）

- 主方案：切换窗口不再丢弃 `onMessage`，保持消息进入 `handleAgentMessage`。
  - 理由：线程归属已经由 `useSocket` 的 `msg.threadId === currentThread` 判定，抑制层再丢消息会造成数据丢失。
  - 取舍：放弃“靠 suppress 阻断 stale 消息”的策略，改为“依赖 threadId 路由保证正确线程”。

## 5. 验证方式

- Red：新增测试覆盖“thread switch 窗口消息不应被吞掉”并先观察失败。
- Green：修复后同一测试转绿。
- 回归：
  - `useSocket-background` 回归集
  - `useAgentMessages-loading` 回归集
  - `chat-container-intent-loading`（含新增 case）
