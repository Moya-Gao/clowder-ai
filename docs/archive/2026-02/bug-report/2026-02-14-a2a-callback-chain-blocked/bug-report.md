---
feature_ids: []
topics: [a2a, callback, chain]
doc_kind: bug-report
created: 2026-02-14
---

# Bug Report: A2A Callback 链式调用被错误阻断

> 报告人: 铲屎官 (thread_mlmcl97gv87xk5uk 实测)
> 定位: 布偶猫
> 日期: 2026-02-14

## 复现步骤

1. 在 thread 里发送消息 `@布偶 请帮我问问缅因...`
2. 布偶 CLI 执行，回复中通过 MCP `post_message` callback 提到 `@缅因`
3. 前端显示系统消息: **"当前线程已有进行中的调用，本次 A2A 自动触发已跳过，请稍后重试。"**

**期望**: 布偶的 callback 成功触发缅因的 A2A 调用
**实际**: A2A 被阻断，缅因未被调用

## 根因分析

### 引入来源

`8eacef3` (缅因猫, 2026-02-14) 在 `callback-a2a-trigger.ts:58` 添加了 `invocationTracker.has(threadId)` guard:

```typescript
// Do not preempt active thread work with callback-triggered A2A.
if (invocationTracker?.has?.(threadId)) {
  // ... skip + broadcast error
  return;
}
```

### 为什么错

A2A 链的正常时序:

1. 用户 `@布偶` → `messages.ts` 调用 `invocationTracker.start(threadId)` → tracker 标记活跃
2. 布偶 CLI 执行 → MCP callback `post_message` 内容含 `@缅因`
3. `callbacks.ts:108` 调用 `triggerA2AInvocation()`
4. `invocationTracker.has(threadId)` → **必然 TRUE**（父 invocation 还在跑！）
5. A2A 被拒绝

callback A2A 链天然发生在**父 invocation 执行期间**——这是设计如此，不是异常。
guard 把所有正常的 A2A 链都封死了。

### 排除的方案

- **直接删除 guard，让 `start()` 替换 tracker**: 不行。`start()` 会 abort 父 invocation 的 controller，导致布偶 CLI 被中途 kill。
- **让 guard 只检查非本 invocation**: 需要 tracker 存储 invocationId，改动较大。

## 修复方案

**如果父 invocation 活跃，跳过 tracker.start()，让 A2A 作为"子调用"运行**:

- guard 改为条件分支: 有父 invocation → 跳过 `start()`，直接执行 A2A
- 无父 invocation → 正常 `start()` + abort check
- A2A "子调用"没有独立 tracker 条目，但有 InvocationRecord（可查审计）
- trade-off: 子调用不支持单独 cancel（需要通过 cancel 父来间接取消）

## 验证方式

1. Red test: 模拟 `invocationTracker.has()` 返回 true 时，A2A 仍被触发
2. Green: 实现修复后测试通过
3. 全量 API tests 无 regression
