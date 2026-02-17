# Bug Report: 双重猫猫触发 (Thread 切换 Race Condition)

> 日期：2026-02-16
> 报告人：铲屎官（手动复现）
> 严重度：P1（阻塞多 thread 并行使用）

## 复现步骤

1. 在 Thread A 发送消息（触发猫猫调用）
2. 不等猫猫响应，立即切换到 Thread B
3. 观察右面板"当前调用"区域

**期望行为**：Thread B 的右面板为空（或显示 Thread B 自己的猫猫状态）

**实际行为**：Thread B 的右面板显示了 Thread A 的猫猫（如两个布偶猫），即 Thread A 的调用状态泄漏到了 Thread B

## 根因分析

### 定位过程

1. 检查 `RightStatusPanel.tsx` 的 activeCats/historyCats 逻辑 → 数据来自 `targetCats` 和 `catInvocations`
2. 检查这两个字段是否 thread-scoped → **否，它们是 flat state**（直接写入 zustand store 顶层）
3. 检查 socket 事件路由 → `agent_message` 有 `threadIdRef.current` guard（useSocket.ts:120），但 `intent_mode` 没有（useSocket.ts:139-141，直接调用 `callbacks.onIntentMode`）
4. `onIntentMode` 的 guard 在 ChatContainer.tsx:126 (`data.threadId !== threadId`)，使用的是 **useMemo 闭包中的 threadId**

### 根因：三层 race condition 叠加

**Race 1: `intent_mode` 事件没有 socket 层 thread guard**

`useSocket.ts` 中，`agent_message` 有明确的 thread routing（line 120）：
```typescript
if (!msg.threadId || !currentThread || msg.threadId === currentThread) {
  callbacks.onMessage(msg);  // active path
} else {
  handleBackgroundAgentMessage(msg, ...);  // background path
}
```

但 `intent_mode` 没有：
```typescript
socket.on('intent_mode', (data) => {
  callbacks.onIntentMode?.(data);  // 没有 thread check！
});
```

它依赖 ChatContainer 的闭包 guard，但闭包在 thread 切换时有时序窗口。

**Race 2: useEffect socket 重建是异步的**

`useSocket` 的 `useEffect` 依赖 `[callbacks]`。当 thread 切换时：
1. `socketCallbacks`（useMemo）重建 → `callbacks` 引用变化
2. React 调度 `useEffect` cleanup（断开旧 socket）+ setup（新 socket）
3. **在 cleanup 执行前**，旧 socket 仍然存活，旧 `callbacks`（闭包含旧 threadId=A）仍在处理事件
4. 这段时间内到达的 `intent_mode` 事件会被旧闭包处理，guard 通过（A === A）

**Race 3: `setCatInvocation` / `setTargetCats` 非 thread-scoped**

即使事件正确经过 active path 处理，它们写入的是 flat state：
```typescript
setCatInvocation: (catId, info) =>
  set((state) => ({
    catInvocations: { ...state.catInvocations, [catId]: { ...state.catInvocations[catId], ...info } },
  })),
```

如果 `setCurrentThread(B)` 已将 flat state 替换为 Thread B 的状态，此后到达的 Thread A 事件通过 `setCatInvocation` 写入的就是 Thread B 的 catInvocations。

### 对比：Background handler 是正确的

`useSocket-background.ts` 使用的是 thread-scoped 方法：
- `updateThreadCatStatus(threadId, catId, status)` — 自动区分 active/background
- `clearThreadActiveInvocation(threadId)` — 同上

问题出在 **active handler 路径**没有 thread-scope 保护。

## 修复方案

### 方案 A: Socket 层 thread guard（推荐）

在 `useSocket.ts` 中为 `intent_mode` 添加与 `agent_message` 一致的 thread routing：

```typescript
socket.on('intent_mode', (data) => {
  const currentThread = threadIdRef.current;
  if (data.threadId && currentThread && data.threadId !== currentThread) {
    // Background thread intent — store in threadStates, don't affect flat state
    store.updateThreadIntentMode(data.threadId, data);
    return;
  }
  callbacks.onIntentMode?.(data);
});
```

### 方案 B: useCallback ref pattern

用 `callbacksRef` 代替直接依赖 `callbacks`，避免 socket 断开重连：

```typescript
const callbacksRef = useRef(callbacks);
callbacksRef.current = callbacks;
// useEffect 中用 callbacksRef.current，不依赖 callbacks
```

但这不解决 `setCatInvocation` 非 thread-scoped 的问题。

### 方案 C: 完全 thread-scoped（最彻底但工程量大）

把 `setCatInvocation` 和 `setTargetCats` 改为 thread-scoped，类似 `updateThreadCatStatus`。但这需要改动大量调用点。

### 推荐：方案 A + B 组合

1. **方案 B**：用 `callbacksRef` 消除 socket 断开重连问题（避免 Race 2）
2. **方案 A**：在 socket 层为 `intent_mode` 加 thread guard（修复 Race 1）
3. **`setCurrentThread` 增强**：切换 thread 时立即清空 flat catInvocations / targetCats（修复 Race 3 的残留），确保旧 thread 状态不会留在 flat state 中

## 放弃的方案

- **纯前端 debounce**：不治本，只是降低概率
- **方案 C（全 thread-scoped）**：改动面太大，且 active handler 的 setCatInvocation 被大量 invocation_metrics 事件使用，全改 thread-scoped 需要给每个事件添加 threadId 参数

## 验证方式

1. 在 Thread A 发消息 → 快速切换到 Thread B → 右面板不应显示 Thread A 的猫猫
2. 切换回 Thread A → 猫猫状态应正确恢复
3. 多 thread 并行调用 → 各 thread 的猫猫状态互不干扰
4. 单元测试覆盖 thread switch 时 state 清理

## 影响范围

- `packages/web/src/hooks/useSocket.ts` — 核心修改
- `packages/web/src/components/ChatContainer.tsx` — 可能简化 onIntentMode guard
- `packages/web/src/stores/chatStore.ts` — setCurrentThread 增强
- `packages/web/src/hooks/useAgentMessages.ts` — handleAgentMessage 可能需要 thread guard
