---
feature_ids: []
topics: [stop, click, event]
doc_kind: bug-report
created: 2026-02-14
---

# Bug Report - Stop Click Event Causes Socket Stack Overflow

## 1) 报告人
- 报告人：铲屎官（2026-02-14 07:44）
- 现象：前端控制台出现 `is-binary.js:29 Uncaught RangeError: Maximum call stack size exceeded`，并伴随 `[ws] Engine close` / `[ws] Connected`。
- 触发条件：并发调用（例如同时圈出暹罗猫与缅因猫）后点击 Stop。

## 2) 复现步骤
1. 在前端发起并发调用（ideate 并行或多猫并发）。
2. 点击 Stop（输入框 stop 按钮或并行状态栏 stop 按钮）。
3. 观察浏览器控制台。

期望行为：
- 前端正常发送 `cancel_invocation`，payload 的 `threadId` 为字符串。
- 不出现 Socket.IO `hasBinary` 递归爆栈。

实际行为：
- `cancel_invocation` payload 中 `threadId` 被污染为 React `MouseEvent` 对象。
- Socket.IO 在 `hasBinary` 检查 payload 时递归进入循环引用对象，触发栈溢出。

## 3) 根因分析
- `ChatInputActionButton` 与 `ParallelStatusBar` 直接使用 `onClick={onStop}`。
- React 会将 `MouseEvent` 作为第一个参数传入回调。
- `ChatContainer.handleStop(overrideThreadId?: string)` 将该参数继续透传到 `cancelInvocation`。
- `useSocket.cancelInvocation` 执行 `socket.emit('cancel_invocation', { threadId: tid })`，导致 `tid` 不是 string 而是事件对象。
- 事件对象存在循环引用，触发 Socket.IO `is-binary` 递归栈溢出。

## 4) 修复方案
- UI 侧 stop 入口统一改为无参调用：`onClick={() => onStop?.()}`，杜绝事件对象透传。
- `ChatContainer.handleStop` 增加类型防御：仅接受 string override，其余回退当前 threadId。
- 回归测试覆盖：
  - stop 按钮点击不应向 onStop 透传事件参数；
  - stop 路由参数必须是 threadId 字符串。

放弃方案：
- 在 `useSocket.cancelInvocation` 做 `JSON stringify` 防御。该方案治标不治本，仍会让上游类型污染蔓延。

## 5) 验证方式
- Red→Green：先新增失败测试复现事件参数污染，再修复并转绿。
- 运行 web 相关测试（含新增回归测试）并确认全部通过。
- 人工验证：并发场景点击 Stop，不再出现 `hasBinary` 栈溢出。
