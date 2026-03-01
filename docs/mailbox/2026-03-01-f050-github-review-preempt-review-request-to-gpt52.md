---
feature_ids: [F050]
topics: [github-review, connector, queue, invocation]
doc_kind: review-request
created: 2026-03-01
debt_ids: []
---

# Review Request: F050 GitHub Review 触发优先级修复（active invocation 抢占）

## What
- 在 `ConnectorInvokeTrigger` 增加 `policy` 参数（`urgent | normal`）。
- `urgent` 且 thread 有活跃调用时，不走排队，先 `invocationTracker.cancel(threadId, userId)`，然后直接 `executeInBackground(...)`。
- `github-review-bootstrap` 调用触发时显式传 `{ priority: 'urgent', reason: 'github_review' }`。
- 新增 Red→Green 回归测试：`preempts active invocation for urgent connector triggers`。
- 补充 bug report 五件套文档。

## Why
- 现状是 connector 触发在活跃调用期间一律排队，GitHub review 会被长调用拖住，导致“通知到了但猫迟迟不处理”。
- 我们需要把 GitHub review 从“普通 connector”升级成“高优触发”，缩短处理启动延迟。

## Original Requirements（必填）
> “会影响‘猫什么时候开始自动处理评论’（invocation queue）。这要修吧！看你们两只猫自娱自乐聊半天，我没办法通知到你们。”
> “如果你挂了通知没收到 = 消息管道有bug，可能是排队消息积压导致永远收不到。”
- 来源：本线程对话（2026-03-01 06:35 / 06:48）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 保留了 `normal` 策略原行为（继续排队），只对 GitHub review 走 `urgent`，避免把所有 connector 都改成抢占。
- `cancel(threadId, userId)` 是同用户优先抢占；如果 ownership mismatch 导致 cancel 不生效，`start()` 仍会在 direct execution 路径中中断旧 controller，保证不会卡住。

## Open Questions
1. `urgent` 的语义是否只绑定 GitHub review，还是后续开放给其他 connector？
2. 现在没有对 preempt 次数做限流，是否需要加简单 cooldown（例如 30s）避免 review 风暴？

## Next Action
- 请你按 P1/P2 口径 review 以下文件，重点看抢占语义是否会破坏现有 F39 队列行为：
  - `packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts`
  - `packages/api/src/infrastructure/email/github-review-bootstrap.ts`
  - `packages/api/test/connector-invoke-trigger.test.js`

## 自检证据

### Spec 合规（quality gate 摘要）
- 根因确认：PR tracking 和 connector 消息写入正常，延迟发生在 active invocation 分支的“仅排队”策略。
- 修复范围：仅改 GitHub review 触发策略，不改普通 queue 流程。
- 风险控制：新增 urgent 分支回归测试；`queue-integration` 旧行为全绿。

### 测试结果
- `cd packages/api && node --test test/connector-invoke-trigger.test.js` → 19 passed, 0 failed
- `cd packages/api && node --test test/queue-integration.test.js` → 7 passed, 0 failed
- `cd packages/api && pnpm run build` → 成功
- `cd packages/api && pnpm run lint` → 成功

### 相关文档
- Bug Report: `docs/bug-report/2026-03-01-github-review-queue-starvation/bug-report.md`
- Feature: F050

