---
feature_ids: [F045]
debt_ids: []
topics: [task-progress, redis, interruption, abort, reliability]
doc_kind: bug_report
created: 2026-03-01
---

# Bug Report: F045 Task Progress snapshot finalize reliability

## 报告人

- 来源：GitHub cloud Codex review（PR #106）两条 inline 评论（P1/P2）
- 记录人：缅因猫/砚砚（Codex）

## 复现步骤

### P1：finalize snapshot 写 Redis 失败会污染成功调用（应降级）

1. 构造 `taskProgressStore` mock：`setSnapshot()` 在 `status === 'completed' || status === 'interrupted'` 时抛错
2. 调用 `invokeSingleCat()`，service 仅 yield：
   - 1 条 `system_info(type=task_progress)`（让 `lastTasks` 有值）
   - 1 条 `done`
3. 预期：调用本身成功结束（只产出 `done`，无额外 `error`）
4. 实际（现状）：`finalizeTaskProgress()` await 抛错进入 outer `catch`，产出额外 `error` + second `done`

### P2：abort/early close 时 snapshot 不应被标为 completed

1. 调用 `invokeSingleCat()`，service 先 yield 1 条 `task_progress`
2. consumer 在收到第一条 progress 后立即 `iterator.return()`（模拟 `signal.aborted` 下路由提前关闭）
3. 预期：snapshot 变为 `interrupted`（提供“继续”入口）
4. 实际（现状）：`hadError` 没被置位，`finally` finalize 产出 `completed`

## 根因分析

- P1：`finalizeTaskProgress()` 对 `taskProgressStore.setSnapshot()` 没有 error guard，导致 store 端短暂失败上升为用户可见错误。
- P2：在 yield loop 中，`hadError` 的更新发生在 `yield out` 之后；consumer early close 时，yield 后的代码不再执行，`finally` 只能看到旧的 flags，导致 finalize 误判。

## 修复方案

1. **store 写入降级**：对 `setSnapshot()`（running + finalize）做 `try/catch`，失败只 `console.warn`，不影响主调用成功路径。
2. **interruption 判定**：
   - 将 `hadError` 设置移动到 `yield out` 之前（避免 early close 丢 flag）
   - `finalizeTaskProgress()` 额外考虑 `signal?.aborted` → `interrupted`，并记录 `interruptReason: 'aborted'`

## 验证方式

- 新增两条回归测试（RED→GREEN）：
  - P1：finalize store throw 不应产出额外 `error`
  - P2：early `iterator.return()` 时 snapshot 必须为 `interrupted`
- 运行：
  - `node --test packages/api/test/invoke-single-cat.test.js`
  - `pnpm --filter @cat-cafe/api test:redis`（确保隔离 Redis 下全量绿）
