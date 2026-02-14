# A2A Stop 按钮 UX 改进计划

> 日期: 2026-02-14
> 作者: 布偶猫/宪宪 (Claude Opus)
> 状态: 待实施
> 来源: [情人节猫猫聊天会议纪要](../mailbox/2026-02-14-valentines-day-cat-chat-meeting-minutes.md) 第四节
> 关联: BACKLOG #73, fix/claude-session-recovery (方向 1 已修)

---

## 1. 背景

猫猫互调 (A2A) 时，铲屎官观察到以下 UX 问题：

1. ~~Callback A2A 不通知前端 loading 状态~~ — **已修** (fix/claude-session-recovery)
2. **Stop 按钮只在 `isLoading=true` 时显示**，但 A2A 链中 loading 状态可能在中间环节被 reset，导致猫还在聊但 Stop 按钮消失
3. **没有独立的"停止互调"入口**，用户只能等 15 轮上限自然停止

本计划解决方向 2 和 3。

---

## 2. 现状分析

### Stop 按钮显示条件

```
ChatInputActionButton.tsx:72
{disabled && onStop ? ( <Stop按钮> ) : ...}
```

- `disabled` = `isLoading`（来自 chatStore）
- `onStop` = `handleStop`（调用 `cancelInvocation` emit socket 事件）

**问题**：Stop 按钮的可见性完全绑定 `isLoading`。但 `isLoading` 的语义是"用户发送消息后等待回复"，不完全等同于"thread 有活跃 invocation"。

### cancelInvocation 链路

```
前端 socket.emit('cancel_invocation', { threadId })
  → 后端 InvocationTracker.cancel(threadId, userId)
    → AbortController.abort()
      → CLI 进程收到 signal → 终止
```

这条链路是通的，问题只在前端"什么时候显示 Stop 按钮"。

---

## 3. 设计方案

### 方向 2：Stop 按钮改为"有活跃 invocation 就显示"

**核心改动**：Stop 按钮的显示条件从 `isLoading` 改为 `isLoading || hasActiveInvocation`。

#### 3.1 新增 `hasActiveInvocation` 状态

在 chatStore 中新增：

```typescript
hasActiveInvocation: boolean;
setHasActiveInvocation: (v: boolean) => void;
```

#### 3.2 后端广播 invocation 生命周期事件

callback A2A 触发时已有 `intent_mode` 广播（fix/claude-session-recovery 新增）。需要确保：

- **开始**：`intent_mode` 事件 → 前端 `setHasActiveInvocation(true)`
- **结束**：`done(isFinal=true)` → 前端 `setHasActiveInvocation(false)`
- **失败**：`error` + `done(isFinal=true)` → 同上

现有 `useAgentMessages.ts:217-221` 的 `done(isFinal)` handler 已经会 `setLoading(false)`，
同一位置加 `setHasActiveInvocation(false)` 即可。

#### 3.3 ChatInputActionButton 改动

```diff
- {disabled && onStop ? (
+ {(disabled || hasActiveInvocation) && onStop ? (
```

这样即使 `isLoading` 被 reset（比如用户手动发送的消息已完成），
只要 thread 还有活跃 invocation，Stop 按钮就会持续显示。

### 方向 3：常驻"停止互调"入口

**方案**：在 `ParallelStatusBar`（多猫执行状态栏）中增加一个小型 Stop 按钮。

当前 `ParallelStatusBar` 在多猫并行执行时显示每只猫的状态（thinking / streaming / done）。
在状态栏右侧增加一个 Stop 图标按钮，点击即触发 `cancelInvocation`。

**优势**：
- 不依赖 `isLoading` 状态，只要状态栏可见就能点
- 位置直觉——猫猫状态旁边就是停止按钮
- 改动小，只在 `ParallelStatusBar` 组件内部

**备选方案（不推荐）**：
- 在聊天区域顶部加浮动 Stop 按钮 — 遮挡内容，视觉侵入大
- 右键菜单 — 不直觉，用户找不到

---

## 4. 实施步骤

| Step | 内容 | 改动文件 | 测试 |
|------|------|----------|------|
| 1 | chatStore 新增 `hasActiveInvocation` | `stores/chatStore.ts` | store unit test |
| 2 | `useAgentMessages` done(isFinal) 时 reset | `hooks/useAgentMessages.ts` | 复用现有 loading test 模式 |
| 3 | `onIntentMode` handler 设置 `hasActiveInvocation=true` | `components/ChatContainer.tsx` | intent-loading test 扩展 |
| 4 | `ChatInputActionButton` 显示条件改为 `disabled \|\| hasActiveInvocation` | `components/ChatInputActionButton.tsx` | 新增 button visibility test |
| 5 | `ParallelStatusBar` 增加 Stop 按钮 | `components/ParallelStatusBar.tsx` | 新增 stop button test |

预估：~5 个文件改动，~80 行代码，~10 个新测试。

---

## 5. 不做的事

- **不改 15 轮上限**：这是安全保护，不是 bug
- **不做 A2A 队列**：callback A2A busy 时 skip 的策略已在 fix 中实现，暂不改为排队
- **不做 A2A 进度条**：当前 ParallelStatusBar 已显示每只猫状态，够用

---

## 6. 验证方式

### Red（先让问题可测）

1. 模拟 callback A2A 开始后、`isLoading` 为 false 时，Stop 按钮是否可见
2. 模拟 `done(isFinal)` 到达后，`hasActiveInvocation` 是否被 reset
3. 模拟 ParallelStatusBar 有活跃猫时，Stop 按钮是否可点击

### Green（修复后）

- 上述用例全绿
- 手动验证：发起 A2A 互调 → 中途能看到 Stop 按钮 → 点击后猫停止

---

*布偶猫（宪宪）🐾*
