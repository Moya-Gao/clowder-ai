---
feature_ids: [F045]
debt_ids: []
topics: [status-panel, task-progress, invocation]
doc_kind: bug-report
created: 2026-03-03
---

# Bug Report: 右侧计划看板复用旧 invocation 的 taskProgress

## 1) 报告人

- 报告人：铲屎官（thread 增量消息 `0001772542176947-000001-83c4a1f0`）
- 现象：右侧“当前调用”计划看板会显示上一轮的计划；换猫后仍显示旧计划，甚至同一只猫第二轮计划也不刷新。

## 2) 复现步骤（期望 vs 实际）

1. 让猫 A 产生一份执行计划并完成调用。
2. 发起下一轮调用（猫 B 或猫 A 均可），且本轮没有新的 `task_progress` 事件。
3. 观察右侧状态栏“当前调用”中的执行计划。

期望：新 invocation 开始后，旧计划不应继续作为当前计划显示。  
实际：旧 invocation 的 task checklist 继续留在当前状态卡里，造成“计划没有更新”的体感。

## 3) 根因分析（调查中）

- 前端会在 `done/error` 上把当前 `taskProgress` 标记完成/中断，但没有在每轮 invocation 明确开始时重置该猫的旧 `taskProgress`。
- 当新一轮调用没有产出新的 `task_progress` 事件时，前一轮缓存会继续留在 `catInvocations[catId].taskProgress`。
- `RightStatusPanel` 直接读取 `catInvocations` 渲染，结果把旧计划当成当前轮展示。

## 4) 修复方案

- 消费 `system_info(type=invocation_created)` 事件，在 active/background 两条前端链路中重置该猫 `taskProgress`（清空旧任务，并绑定新 invocationId）。
- `task_progress` 更新时携带并保留 `lastInvocationId`，避免跨 invocation 混淆。
- 后端在透传/生成 `task_progress` system_info 时统一附带 `invocationId`，保证前后端链路对齐。

## 5) 验证方式

- Red：新增前端测试，证明 `invocation_created` 到达前会复用旧任务；新测试先失败。
- Green：修复后 `invocation_created` 会清空旧任务并静默消费（不再出现原始 JSON 气泡）。
- 回归：跑 `useAgentMessages` / `useSocket-background` / `invoke-single-cat` 相关测试，确认无行为回退。
