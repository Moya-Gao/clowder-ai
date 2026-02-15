# Bug Report: 多 session 返回后消息被拆成单字气泡

## 1) 报告人

- 报告人：铲屎官（截图反馈）
- 接收与定位：缅因猫（砚砚）
- 发现时间：2026-02-15

## 2) 复现步骤（期望 vs 实际）

复现：
1. 开启多 session / split 模式，让线程 A 在后台持续流式回复。
2. 在前台查看线程 B，等待线程 A 收到多段 `text` 增量（delta）。
3. 切回线程 A。

期望：
- 同一只猫同一轮回复在 UI 中合并为一条 assistant 消息，内容随着 delta 追加。

实际：
- 后台期间收到的每个 delta 都被落成一条独立消息，回到线程后看到“单字/短词碎片气泡”列表。

## 3) 根因分析（定位过程）

- 入口：`packages/web/src/hooks/useSocket.ts` 的 background-thread 分支（`agent_message` 处理）。
- 关键问题：在 `msg.type === 'text'` 分支中，每个 chunk 都调用 `addMessageToThread` 新增一条消息，而不是对同一条进行 append。
- 对比：active-thread 走 `useAgentMessages`，使用 `activeRefs` 按 `catId` 复用 messageId 并 `appendToMessage`；background-thread 缺少等价机制。
- 结果：流式 delta 颗粒度被直接暴露为消息颗粒度，切回线程时出现消息碎片化。

## 4) 修复方案（选择与权衡）

方案：
1. 在 `useSocket` 增加 background 流式引用表（按 `threadId + catId` 跟踪当前回复 messageId）。
2. 背景 `text` chunk：
   - 首 chunk 新建 assistant 消息；
   - 后续 chunk 追加到同一 message；
   - `isFinal` 时标记结束并清理引用。
3. 在 `chatStore` 增加针对指定线程消息的 append/streaming 更新 API，避免切线程或直接操作 flat state。

权衡：
- 优点：行为与 active-thread 一致，直接消除碎片化。
- 代价：store API 略增复杂度，需要补充回归测试覆盖后台流式追加路径。

## 5) 验证方式

自动化验证（Red -> Green）：
1. 在 `useSocket-background.test.ts` 新增回归用例：同猫同线程两段 `text` chunk 应合并为一条消息，内容为拼接结果。
2. 先跑该测试确认失败（Red），再实现修复并跑到通过（Green）。
3. 运行相关 web 测试集，确认未引入回归。
