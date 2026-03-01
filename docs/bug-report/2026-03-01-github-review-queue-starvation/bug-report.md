---
feature_ids: [F050]
topics: [github-review, connector, queue, invocation]
doc_kind: bug-report
created: 2026-03-01
debt_ids: []
---

# Bug Report: GitHub review 通知在活跃调用期间被队列饿死

## 1. 报告人
- 报告人：铲屎官（2026-03-01）
- 定位：缅因猫（砚砚）
- 现象：我们在前端能看到 GitHub Review connector 消息，但猫猫长时间处理不到 review（会被当前 thread 的活跃调用一直压住）

## 2. 复现步骤

### 复现
1. 线程内存在活跃调用（`InvocationTracker.has(threadId) === true`）
2. GitHub Review 邮件到达，`ReviewRouter` 发出 connector 消息并触发 `ConnectorInvokeTrigger.trigger(...)`
3. `ConnectorInvokeTrigger` 在活跃调用分支直接 `enqueue`，不做抢占
4. 若当前调用长时间不结束，review 自动处理就一直延后

### 期望
GitHub Review 这类高优先级 connector 触发应尽快处理，不应无限等待当前调用结束。

### 实际
高优 review 仅入队，处理开始时间受当前调用时长控制，存在明显“通知到但处理不到”的体感延迟。

## 3. 根因分析

### 代码位置
- `packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts`

```ts
if (invocationTracker.has(threadId)) {
  invocationQueue.enqueue(...)
  return
}
```

### 问题点
1. 活跃调用分支没有优先级策略，connector 一律排队
2. GitHub review 与普通 connector 共用同一“永远排队”路径
3. 缺少“urgent connector 可抢占”的最小策略，导致长会话期间 review 处理不可预测

## 4. 修复方案
- 在 `ConnectorInvokeTrigger.trigger` 增加可选策略参数：`priority: 'urgent' | 'normal'`
- `urgent` 且 thread 有活跃调用时：
  - 先调用 `invocationTracker.cancel(threadId, userId)` 尝试同用户抢占
  - 直接进入 `executeInBackground(...)`（不入队）
- `normal` 维持现有排队逻辑，不影响现有 F39 行为
- 在 `github-review-bootstrap.ts` 调用 `trigger(...)` 时传 `{ priority: 'urgent', reason: 'github_review' }`

## 5. 验证方式
1. **Red**：新增测试 `preempts active invocation for urgent connector triggers`，先失败（旧逻辑会入队不执行）
2. **Green**：实现后断言：
   - `routeExecution` 被立即调用
   - 未入队
   - 调用了 `invocationTracker.cancel(...)`
3. 回归：
   - `connector-invoke-trigger.test.js` 全绿
   - `queue-integration.test.js` 全绿（normal connector 仍按原规则排队）

## 6. 云端 Review Follow-up（2026-03-01 R6）

### 新症状
- 在 urgent fallback 分支里，`createResult.invocationId` 先被写成 `canceled`，随后竞态路径又复用同一个 id 进入 `executeInBackground(...)`。
- 由于 `InvocationRecord` 状态机中 `canceled` 是终态，后续 `running/succeeded` 更新会被拒绝，记录会错误地停留在 canceled。

### 修复
- 将 fallback 状态从 `canceled` 改为 `failed`，保持可重入（`failed -> running` 合法）。
- 补回归断言：`re-checks activity before queueing urgent fallback when active ends during update` 中验证 direct execution 路径不再先写 `canceled`。

### 验证命令
- `pnpm --filter @cat-cafe/api build`
- `node --test packages/api/test/connector-invoke-trigger.test.js`（24/24）
- `node --test packages/api/test/queue-integration.test.js`（7/7）
