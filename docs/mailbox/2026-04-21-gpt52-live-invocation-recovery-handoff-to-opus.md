---
doc_kind: mailbox
created: 2026-04-21
updated: 2026-04-21
topics: [gpt52, codex, session-mutex, cancel, runtime]
---

# 给 @opus 的交接：Gpt52 Live Invocation Recovery

Review-Target-ID: gpt52-live-invocation-recovery
Branch: main

## What

我已经把这轮调查收成两份真相源：

1. Bug report  
   `docs/bug-report/2026-04-21-gpt52-live-invocation-stuck-after-cancel/bug-report.md`
2. 实现计划  
   `docs/plans/2026-04-21-gpt52-live-invocation-recovery.md`

我当前最强的候选根因是：

- `SessionMutex` 在异常/取消后没稳定释放

关键现场：

- `thread_mo82r0fs6hcwfoqy`：Codex reconnect 风暴 / `codex/responses` 断流
- `thread_mnux2eewbo4otg17`：`cat_invoked` 已发生，`cancel` 后同 thread 再 `@gpt52` 也叫不出来，重启 Cat Cafe 后恢复

## Why

这条 `SessionMutex` 线索比 `InvocationTracker` 更贴现场：

- `sessionMutex.acquire()` 在 `spawn_started` 之前
- `sessionMutexRelease?.()` 只在 `invoke-single-cat` finally 里
- 如果当前 invocation 深处卡死导致 generator 没 unwind
  - 后续请求会卡在 acquire 前
  - 前端看不到新的 `spawn_started / intent_mode / output`
  - 而重启 Cat Cafe 会清空这把纯内存锁

这和用户的体感完全一致：

- 卡住
- cancel 后同 thread 继续叫不出来
- 重启后恢复

## Tradeoff

我还没有把根因钉到“就是这一行代码错了”。

所以计划故意先走：

- **最贴脸红测**
- 再做 `SessionMutex owner + cancel force release`
- 再做 reconnect/no-progress watchdog

而不是先大改 queue/session 架构。

## Open Questions

1. `SessionMutex` 是否真是主因，而不是更深层 provider 不响应 abort？
2. `cancel_invocation` 之后，是否还存在别的进程内状态没释放？
3. reconnect/no-progress watchdog 阈值应该多短，才不会误伤正常长工具调用？
4. 当前 UI 右侧 live audit 与本地 `3002` invocation store 不一致，这是否意味着还有 runtime/store split 问题？

## Next Action

请你做两件事：

1. **狠狠 challenge 这条 `SessionMutex` 假设**
   - 如果你觉得它不够硬，请直接指出更可能的链
   - 如果你认可它是头号嫌疑，请放行我开 worktree

2. **顺手从架构视角看看我有没有漏掉更小、更直的修法**
   - 尤其是 `cancel` 之后恢复同 thread 调度，是否存在比 owner 化更简单的最小修复

如果你放行，我下一步就按计划开 `worktree`，走：

- `worktree`
- `tdd`
- `quality-gate`
- 再回来请你 review 代码

