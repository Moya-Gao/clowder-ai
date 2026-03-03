---
feature_ids: [F045]
doc_kind: mailbox
created: 2026-03-03
updated: 2026-03-03
---

# Review Request: F045 右侧计划看板 stale progress 修复（to @gpt52）

## What
修复“右侧状态栏计划看板复用旧 invocation 计划”的问题，核心改动：
- 前台 `useAgentMessages` 新增 `invocation_created` 消费逻辑：每轮新 invocation 开始时重置该猫旧 `taskProgress`
- 后台 `consumeBackgroundSystemInfo` 同步新增相同重置逻辑，避免切线程后旧快照残留
- 后端 `invokeSingleCat` 对所有 `task_progress` system_info 统一补 `invocationId`
- 新增回归测试：前台/后台/后端各 1 条，覆盖 Red→Green

## Why
铲屎官反馈“猫 1 写完计划后，猫 2 或猫 1 下一轮仍显示旧计划，计划不更新”。根因是新 invocation 边界没有清空旧计划快照，导致无新 `task_progress` 事件时继续渲染旧任务。

## Original Requirements（必填）
> “我们的这个右上角的这个计划看板是不是有bug？我好像发现比如🐱1写了计划然后他做完了🐱2写计划这里一直是猫1的？甚至猫1写了第二份计划这里也没更新？！你能排查一下吗？”
- 来源：`docs/bug-report/2026-03-03-right-status-stale-task-progress/bug-report.md`（源消息 ID: `0001772542176947-000001-83c4a1f0`）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 采用“invocation_created 到达即清空旧计划”的策略，优先保证“当前调用不显示旧计划”
- 放弃“仅在拿到首个新 task_progress 才替换”方案：该方案在“新调用无 task 事件”场景仍会漏修

## Open Questions
1. `invocation_created` 作为计划重置边界是否足够稳健？是否还需要与 `invocation_metrics.session_started` 双保险？
2. 目前 `task_progress` 默认 `snapshotStatus='running'`，你是否建议在某些 provider 场景改为更保守状态？
3. 除当前覆盖测试外，还有没有你建议补的竞态用例（例如同猫极短间隔连续 invocation）？

## Next Action
请你做一轮 peer review，重点看：
- invocation 边界定义是否正确
- 前后端 payload 契约（`invocationId`）是否一致
- 回归测试是否覆盖到了关键用户路径

## 自检证据

### Spec 合规
- Bug report 五件套已补：`docs/bug-report/2026-03-03-right-status-stale-task-progress/bug-report.md`
- 修复目标与用户原话对齐：新调用不能继续显示上一轮计划

### 测试结果
- `pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-invocation-created.test.ts src/hooks/__tests__/useAgentMessages-warning.test.ts src/hooks/__tests__/useSocket-background-system-info-web-search.test.ts src/hooks/__tests__/useSocket-background.test.ts`
  - 4 files passed, 46 tests passed, 0 failed
- `pnpm --filter @cat-cafe/api build && node --test packages/api/test/invoke-single-cat.test.js`
  - 44 passed, 0 failed
- `pnpm --filter @cat-cafe/web lint && pnpm --filter @cat-cafe/web build`
  - lint/build 均通过（lint 有既有 warning，无 error）

### 相关文档
- Bug report: `docs/bug-report/2026-03-03-right-status-stale-task-progress/bug-report.md`
- Feature: `docs/features/F045-ndjson-observability.md`
