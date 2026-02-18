# Bug Report: Background system_info Metrics Leaking as Raw JSON

## 1. 报告人
- 报告人：铲屎官
- 发现方式：切回后台线程后，消息区出现红色 JSON（`invocation_metrics` / `invocation_usage` / `context_health`）块。
- 时间：2026-02-18

## 2. 复现步骤
1. 在 thread-A 发起调用（会产生 usage/metrics/context health）。
2. 切到 thread-B，让 thread-A 在后台继续。
3. 再切回 thread-A。

期望行为：
- 指标事件不以 system 文本展示；usage 绑定到消息 metadata（图2 那行），调用统计进入状态栏。

实际行为：
- 指标 JSON 作为普通 system 消息落盘并渲染为红块。

## 3. 根因分析
- active thread 路径 (`useAgentMessages.ts`) 会解析 `system_info` JSON，并对 `invocation_usage / invocation_metrics / context_health` 做“只入状态不落消息”。
- background 路径 (`useSocket-background.ts`) 对 `system_info` 直接 `addBackgroundSystemMessage`，没有消费这些结构化类型。
- 两条路径语义漂移，导致后台线程出现原始 JSON 泄露。

## 4. 修复方案
- 为 multi-thread store 增加线程级更新能力：
  - `setThreadCatInvocation(threadId, catId, info)`
  - `setThreadMessageUsage(threadId, messageId, usage)`
- background `system_info` 对齐 active 解析：
  - `invocation_metrics / invocation_usage / context_health / task_progress` -> 消费并写状态
  - `invocation_usage` 同步写入对应 assistant 消息 `metadata.usage`
  - 仅保留真正给用户看的 system 信息消息
- 放弃方案：仅前端隐藏包含 JSON 的 system message。
  - 原因：只能遮蔽症状，丢失 usage/status 正确绑定。

## 5. 验证方式
- 回归测试：
  - `src/hooks/__tests__/useSocket-background.test.ts`
  - `src/hooks/__tests__/useSocket-thread-guard.test.ts`
  - `src/stores/__tests__/chatStore-multithread.test.ts`
  - `src/stores/__tests__/chatStore-usage.test.ts`
- 关键断言：
  - 背景 `invocation_usage` 不新增 system 消息。
  - usage 写入 `threadState.catInvocations` 与 assistant message `metadata.usage`。
  - `invocation_metrics/context_health` 被静默消费并更新状态。
