# Review Request: F081 live bubble refresh stall

## What
- 修 `useAgentMessages` 在 replace hydration 之后继续抱着旧 `activeRefs` id 的问题
- 新增回归：本地 streaming bubble 被 hydration 换成 server id 后，后续 text chunk 仍应落到同一条正式消息上
- 把这次现场补成 `F081` 证据：bug report + discussion + spec detective note

## Why
- 铲屎官新报的是“前端增量不再刷新，除非 F5”
- 这不是服务器没继续产出，而是前端 live append 丢了写目标
- 如果不修，主区会像“卡住”，直到 F5 才从服务器历史看到更完整内容

## Original Requirements（必填）
> 不知道是不是你f81修改之后，然后有的时候我会发现，除非我f5，前端气泡增量都不刷新了
>
> 我同意！大侦探出击！你看看！

- 来源：[README.md](/Users/lysander/projects/relay-station/cat-cafe-f081-live-refresh/docs/discussions/2026-03-09-f081-live-refresh-stall/README.md)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 这次没有回头扩大 `useChatHistory` merge 规则，而是在 `useAgentMessages` 侧修“写目标漂移”
- 恢复策略优先级是：
  1. 仍然存在的 `activeRefs`
  2. 当前 store 中的 streaming bubble
  3. 同一 `catId + invocationId` 的正式历史消息
- 如果恢复到的是 hydration 后的正式消息且它已不带 `isStreaming`，这次会补回 `setStreaming(true)`，让后续 live chunk 继续落在它身上

## Open Questions
1. 这颗修复落在 `useAgentMessages` 而不是 `useChatHistory`，你觉得边界是否正确？
2. `catId + invocationId` 恢复到正式历史消息并补回 `isStreaming`，是否有你担心的副作用？
3. 这轮只补了 active 前台流；如果后面再抓到 background 同类现场，你同不同意再单独切下一刀？

## Next Action
- 请 review `97b51fef`
- 如果没有新的 P1/P2，我继续走 merge-gate

## 自检证据

### Spec 合规
- F081 这轮对准的是新增 symptom：“主区 streaming 气泡中途停止刷新，F5 后又完整”
- 根因已从“服务器真相源没长”排除到“前端 append 继续写旧 id”
- 交付切片和 symptom 直接对齐，没有扩到新的 feature

### 测试结果
- `pnpm test -- src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts src/hooks/__tests__/useAgentMessages-invocation-created.test.ts`
  - `5 passed, 0 failed`
- `pnpm test -- src/hooks/__tests__/useAgentMessages-*.test.ts src/hooks/__tests__/useSocket-thread-guard.test.ts src/hooks/__tests__/useChatHistory-thread-switch.test.ts src/hooks/__tests__/useChatHistory-priority.test.ts src/debug/__tests__/invocationEventDebug.test.ts`
  - `68 passed, 0 failed`
- `pnpm lint`
  - 通过，只有现有 warning
- `pnpm --filter @cat-cafe/web build`
  - 成功

### 相关文档
- Feature: [F081-bubble-continuity-observability.md](/Users/lysander/projects/relay-station/cat-cafe-f081-live-refresh/docs/features/F081-bubble-continuity-observability.md)
- Bug report: [bug-report.md](/Users/lysander/projects/relay-station/cat-cafe-f081-live-refresh/docs/bug-report/f081-live-bubbles-stop-refreshing/bug-report.md)
- Discussion: [README.md](/Users/lysander/projects/relay-station/cat-cafe-f081-live-refresh/docs/discussions/2026-03-09-f081-live-refresh-stall/README.md)
