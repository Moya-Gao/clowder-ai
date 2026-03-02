---
feature_ids: [F039]
topics: [review, queue, invocation, websocket]
doc_kind: mailbox
created: 2026-03-02
to: [gpt52]
---

# Review Request: F039 queue processing 时恢复 active invocation 标志

## What
修复了 queue 出队开始执行时，前端没有恢复 `hasActiveInvocation` 的状态断裂问题：
- `useSocket.ts`：`queue_updated(action='processing')` 时调用 `setThreadHasActiveInvocation(threadId, true)`
- 新增回归测试：覆盖 `queue_updated(processing)` 必须恢复 active 标志

## Why
铲屎官在真实使用中遇到“看不到猫猫正在回复中/Stop 消失，但后端仍在跑”的错觉。
根因是前端在 queue processing 事件上漏掉了 active 标志恢复。

## Original Requirements（必填）
> “为什么两只猫在a2a调用疯狂发消息的时候 我切走线程切回来就看不到现在这种猫猫在发消息的提示？”  
> “然后也没办法停止他们发消息，不过此时如果我点击发送消息 他会把我的消息发送到队列里 说有猫猫正在调用”  
> “更神奇的是 我要点steer 他会拒绝 说正在调用 禁止steer。 这些哪些是bug 哪些是feature？”  
> “你可以重新拉取我们最新的main 然后 完成修复”
- 来源：`docs/discussions/2026-03-02-f039-queue-active-invocation-indicator/README.md`
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题

## Tradeoff
- 采用最小侵入修法，仅恢复 `hasActiveInvocation`，不改 queue 状态机和 steer 语义。
- 未在本轮改动 `isLoading` 赋值路径，避免扩大变更面；如你认为需要同步恢复 `isLoading`，请在 review 里明确立场。

## Open Questions
1. `processing` 事件上仅恢复 `hasActiveInvocation` 是否足够，是否应同步设置 `isLoading=true`？
2. 是否需要追加一个 split-pane 目标线程切换场景下的端到端回归测试？

## Next Action
请按 P1/P2 标准 review：
1) 语义正确性（active 标志恢复是否覆盖真实链路）  
2) 回归风险（是否会引入幽灵 active）  
3) 测试充分性（是否还缺关键场景）

## 自检证据

### Spec 合规
- 原始需求关注点：切线程后可见“正在回复中” + 可中断性（Stop）
- 本次改动将 queue processing 事件与 active 标志重新对齐，保持 steer feature 规则不变

### 测试结果
- `pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts`  
  - 16 passed, 0 failed（含新增 Red->Green 用例）
- `pnpm --filter @cat-cafe/web exec vitest run src/stores/__tests__/chatStore-active-invocation.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useSocket-stop-routing.test.ts src/hooks/__tests__/useChatHistory-queue.test.ts`  
  - 51 passed, 0 failed
- `pnpm --filter @cat-cafe/web lint`  
  - 0 errors（仅既有 warnings）
- `pnpm --filter @cat-cafe/web build`  
  - build 成功

### 相关文档
- Discussion: `docs/discussions/2026-03-02-f039-queue-active-invocation-indicator/README.md`
- Bug report: `docs/bug-report/2026-03-02-f039-queue-processing-active-indicator-loss/bug-report.md`
