# Bug Report: cancel_invocation 反馈 catId 硬编码为 opus

> 报告日期：2026-02-14 (情人节第三弹)
> 报告人：铲屎官（取消暹罗猫时发现异常）+ 布偶猫（定位根因）
> 严重度：P2
> 责任猫：**布偶猫（宪宪）** — 这段代码是我写的，认了

## 报告人与发现经过

情人节聊天中，铲屎官让暹罗猫查询信息，暹罗猫工具调用持续约 5 分钟。铲屎官尝试通过输入框旁边的取消按钮停止暹罗猫，结果报错 / 取消不掉。

## 复现步骤

1. 在任意线程中调用暹罗猫（或缅因猫）执行较长任务
2. 点击输入框旁边的取消按钮（或状态栏的停止按钮）
3. 观察前端行为

**期望行为**：取消成功，显示"⏹ 已取消"，loading 状态清除

**实际行为**：取消后广播的 `system_info` 和 `done` 事件 catId 为 `opus`，前端可能因 catId 不匹配当前活跃猫而未正确清除 loading 状态

## 根因分析

### 定位过程

1. 查看 `SocketManager.ts:55-81`，找到 `cancel_invocation` 处理逻辑
2. 发现第 67-79 行：cancel 成功后广播的消息 **catId 硬编码为 `createCatId('opus')`**

```typescript
// SocketManager.ts:67-79
this.broadcastAgentMessage({
  type: 'system_info',
  catId: createCatId('opus'),    // ← BUG: 硬编码 opus
  content: '⏹ 已取消',
  timestamp: Date.now(),
}, data.threadId);
this.broadcastAgentMessage({
  type: 'done',
  catId: createCatId('opus'),    // ← BUG: 硬编码 opus
  isFinal: true,
  timestamp: Date.now(),
}, data.threadId);
```

3. 查看 `InvocationTracker.ts`：`ActiveInvocation` 接口只有 `controller` 和 `userId`，**不存储 `catId`**

```typescript
// InvocationTracker.ts:9-12
interface ActiveInvocation {
  controller: AbortController;
  userId: string;
  // 缺少 catId!
}
```

4. 因此 `cancel()` 返回 `boolean`，不包含被取消的猫是谁的信息

### 根因

**InvocationTracker 缺少 catId 字段**，导致 SocketManager 在 cancel 反馈时无法知道被取消的是哪只猫，只能硬编码 opus。当取消的是暹罗猫或缅因猫时，前端收到 catId=opus 的 done 事件，loading 清理逻辑可能不匹配。

### 关联问题

- BACKLOG #24（Antigravity cancel 无效）：暹罗猫 `detached: true` 进程的 SIGTERM 投递不可靠，是另一层问题
- 两者叠加导致铲屎官体验到"取消不掉"

## 修复方案

### 方案 A：InvocationTracker 增加 catId（推荐）

1. **`ActiveInvocation` 接口**：增加 `catId: CatId` 字段
2. **`start(threadId, userId, catId)`**：调用时传入 catId
3. **`cancel()` 返回值**：从 `boolean` 改为 `{ cancelled: boolean; catId?: CatId }` 或类似结构
4. **`SocketManager`**：用实际 catId 广播 `system_info` 和 `done`
5. **所有 `start()` 调用点**：补传 catId（`messages.ts`、`callback-a2a-trigger.ts` 等）

### 放弃的方案

- 在 SocketManager 里猜 catId（比如查 InvocationRecordStore）：异步、不可靠，且违反单一数据源原则

## 验证方式

1. 调用暹罗猫执行任务
2. 点击取消按钮
3. 确认"⏹ 已取消"消息的 catId 为 `gemini`（不是 `opus`）
4. 确认 loading 状态正确清除
5. 对三只猫分别测试取消场景
