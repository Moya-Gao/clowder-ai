# Bug Report: Background Thread Tool Events Not Collapsed

## 1. 报告人
- 报告人：铲屎官
- 发现方式：切换到后台线程后看到大量红色 system 消息（`codex -> command_execution` 原始块），工具调用没有收起。
- 时间：2026-02-18

## 2. 复现步骤
1. 在 `thread-1` 发起执行，让 cat 产生 `tool_use/tool_result` 事件。
2. 切到 `thread-2`，让 `thread-1` 在后台继续跑。
3. 再切回 `thread-1`。

期望行为：
- 工具调用显示在 assistant 气泡内的可折叠 `toolEvents` 面板，不污染主消息流。

实际行为：
- `tool_use/tool_result` 被渲染为独立红色 system 消息块，像错误日志一样铺开。

## 3. 根因分析
- 后台消息分支 `useSocket-background.ts` 对 `tool_use/tool_result` 走了 `addBackgroundSystemMessage(...)`，把工具事件存成 `type: 'system'`。
- active thread 分支（`useAgentMessages.ts`）对同类事件走 `appendToolEvent(...)`，会挂到 assistant 消息的 `toolEvents` 上并默认折叠。
- 两条路径语义不一致，导致 thread 切换后展示不一致。

## 4. 修复方案
- 在 `chatStore` 增加 `appendToolEventToThread(threadId, messageId, event)`，支持后台线程按消息追加工具事件。
- 在 `useSocket-background.ts`：
  - `tool_use/tool_result` 改为“定位或创建 assistant 流消息 + append toolEvent”。
  - 不再写独立 system 红块。
- 放弃方案：只改 system message 样式（`variant: tool`）。
  - 原因：只能弱化视觉，无法实现和 active thread 一致的“按消息折叠工具事件”语义。

## 5. 验证方式
- 更新并通过回归测试：
  - `src/hooks/__tests__/useSocket-background.test.ts`
  - `src/hooks/__tests__/useSocket-thread-guard.test.ts`
- 重点断言：
  - `tool_use/tool_result` 存为 assistant `toolEvents`。
  - `tool_use + tool_result` 会合并在同一 assistant 消息里。
  - route/store mismatch 场景仍走 background path，且会追加 toolEvents。
