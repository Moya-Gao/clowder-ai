---
feature_ids: [F039, F047]
topics: [queue, websocket, invocation, ux]
doc_kind: bug-report
created: 2026-03-02
---

# Bug Report: queue processing 已开始，但前端 active 提示未恢复

## 1. 报告人
- 报告人：铲屎官（2026-03-02）
- 发现方式：A2A 高频调用时切线程再切回，观察输入区状态与 Stop/Steer 行为不一致

## 2. 复现步骤（期望 vs 实际）
前置条件：
- 同一 thread 已有运行中的调用
- 再发送一条消息进入队列，等待自动出队执行

步骤：
1. 触发 queue 出队，后端开始处理该条目（`queue_updated.action = processing`）。
2. 在执行期间切到其他 thread，再切回原 thread。

期望：
- 输入区应显示“猫猫正在回复中”
- Stop 按钮可见且可操作

实际：
- 前端可能不显示“正在回复中”，Stop 不出现
- 但后端仍在执行；继续发送会被判定 active 并排队

## 3. 根因分析
- 后端 QueueProcessor 在条目进入执行时会发 `queue_updated(action='processing')`。
- 前端 `useSocket` 的 `queue_updated` handler 只更新 queue/paused，不恢复 `hasActiveInvocation`。
- 输入区“正在回复中”和 Stop 渲染依赖 `hasActiveInvocation`，导致 UI 与真实执行状态断裂。

## 4. 修复方案
- 在 `queue_updated` 事件处理里，当 `action === 'processing'` 时，
  对该 thread 调用 `setThreadHasActiveInvocation(threadId, true)`。
- 保持其它行为不变（包括 `processing` 条目 steer 拒绝）。

## 5. 验证方式
1. Red：新增回归测试，模拟 `queue_updated(action='processing')`，断言应恢复 active 标记；先失败。
2. Green：实现修复后测试通过。
3. 回归：运行 thread-guard/background/stop-routing/queue hydration 相关测试，确认无回退。
