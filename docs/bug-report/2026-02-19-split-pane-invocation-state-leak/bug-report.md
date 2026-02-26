---
feature_ids: []
topics: [split, pane, invocation]
doc_kind: bug-report
created: 2026-02-19
---

# Bug Report: 分屏 thread 切换时 invocation 状态串线（Stop 方块错位/消失）

## 1. 报告人
- 报告人：铲屎官（2026-02-19）
- 发现方式：分屏模式实测，thread 之间切换时 Stop 方块与超时/流式状态不一致

## 2. 复现步骤（期望 vs 实际）
1. 进入分屏模式，窗格中存在至少两个 thread（如 f21/f22）。
2. 对非 route thread（共享输入当前发往的 target thread）发起一次会触发流式输出的请求。
3. 在两个 thread 间切换观察底部输入区的 Stop 方块。

期望：
- 正在执行的 thread 能看到可中断 Stop；已完成的 thread 不应继续显示可中断状态。
- invocation/loading 应严格按 thread 隔离。

实际：
- 有时正在输出的 thread 没有 Stop（无法取消）。
- 有时已结束的 thread 仍显示 Stop（像被另一个 thread 的状态污染）。
- 刷新（F5）后状态恢复，表现出明显的前端内存态串线特征。

## 3. 根因分析
- `useSendMessage` 在 split-pane 向非 active thread 发送时，仍调用了全局 `setLoading(true)`，把 loading 写进当前 route thread。
- `useSocket-background` 处理后台线程事件时，会清 `hasActiveInvocation`，但没有同步清理 `isLoading`；导致 thread 已结束仍处于 loading。
- 后台线程开始流式时未显式把该 thread 标为 active/loading（依赖 active thread 路径），导致“正在输出但无 Stop”。
- `useChatHistory` 对“已有缓存消息的 thread”默认不重拉首屏历史，内存态错误会持续；F5 后重建状态才看起来恢复。

## 4. 修复方案
- 为 `chatStore` 增加 thread 级 invocation 状态写接口：
  - `setThreadLoading(threadId, loading)`
  - `setThreadHasActiveInvocation(threadId, active)`
- `useSendMessage`：按目标 thread 更新 invocation/loading，而不是一律写当前 active thread。
- `useSocket-background`：
  - 收到后台非终态流式事件时，置目标 thread `loading=true` + `hasActiveInvocation=true`
  - 收到终态（`text.isFinal` / `done.isFinal` / `error.isFinal`）时清理两者，避免幽灵 Stop
- 补充回归测试覆盖 split-pane 目标 thread 路由与后台完成态清理。

## 5. 验证方式
1. Red：新增回归测试，先复现“非 target thread 被置 loading”与“后台完成后 loading 未清”并失败。
2. Green：实现修复后同测试转绿。
3. 回归：运行 `useSocket-background`、`useSendMessage`、`chatStore` 相关测试，确认无新增回退。

