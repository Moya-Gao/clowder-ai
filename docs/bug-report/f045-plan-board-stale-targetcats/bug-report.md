---
feature_ids: [F045]
debt_ids: []
topics: [status-panel, task_progress, targetCats, hydration]
doc_kind: bug-report
created: 2026-03-03
---

# Bug Report: 右上角计划看板卡在上一只猫（targetCats 复活旧快照）

## 1) 报告人

- 报告人：铲屎官（当前 thread，2026-03-03 20:43 PT）
- 现象：右上角“当前调用”没有刷新到下一只猫，仍显示上一只猫的已完成计划。

## 2) 复现步骤（期望 vs 实际）

1. 上一轮调用结束，某猫已有完整 task progress 快照（含已完成项）。
2. 线程切换 / 刷新 / 历史 hydration 后进入同一线程。
3. 观察右侧“当前调用”。

期望：仅显示本轮活跃调用的猫；上一轮 completed 快照应在历史区，不应占据“当前调用”。  
实际：上一轮猫被重新塞回 `targetCats`，继续出现在“当前调用”。

## 3) 根因分析

- `useChatHistory.ts` 在 `fetchTaskProgress()` 里会把 `progress.tasks.length > 0` 的猫收集到 `restoredCats`。
- 随后在 `currentTargets.length === 0` 时直接 `setThreadTargetCats(fetchForThread, restoredCats)`。
- 该逻辑没有过滤 `progress.status === 'completed'`，导致 completed 快照也被当作“当前调用目标”复活。
- `RightStatusPanel` 的 activeCats 来源是 `targetCats + snapshotCats(非 completed)`，所以只要 `targetCats` 被复活，旧猫会继续显示在当前区。

## 4) 修复方案

- `fetchTaskProgress()` 恢复目标猫时，仅恢复“非 completed 且 tasks>0”的快照。
- `completed` 快照继续保留在 `catInvocations`（用于历史展示），但不写回 `targetCats`。
- 新增前端单测锁定：当 task-progress 返回 completed 快照时，不应恢复 `targetCats`。

## 5) 验证方式

- Red：新增 `useChatHistory` 单测，断言 completed 快照不写入 `targetCats`（未修前失败）。
- Green：修复后同测通过。
- 回归：`RightStatusPanel` 相关测试和 `useChatHistory` 既有测试仍通过。
