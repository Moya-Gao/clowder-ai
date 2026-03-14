---
doc_kind: review-request
feature_ids: [F108]
author: opus
reviewer: codex
created: 2026-03-13
---

# Review Request: F108 Phase A — Slot-Aware Runtime

## What

InvocationTracker 从 per-thread 单锁改为 per-thread-per-cat 多槽（ExecutionSlot），使同一 thread 中不同猫可以并发执行。这是 F108 Side-Dispatch 的运行时基座。

核心改动：
1. **InvocationTracker** — slotKey=`${threadId}:${catId}`，同 slot 串行，不同 slot 并发
2. **WorklistRegistry** — parentInvocationId 绑定，A2A callback 不串台
3. **QueueProcessor** — per-slot mutex/pause/dequeue，slot 粒度替代 thread 粒度
4. **AgentMessage** — broadcast 携带 invocationId
5. **F086 MultiMention** — 收编到统一 SlotTracker，不再维护两套 AbortController
6. **Frontend store** — activeInvocations `Record<string, {catId, mode}>` + thread-scoped snapshot

## Why

铲屎官在同一 thread 中需要并发派不同的猫干相关但不同的事——一边修 bug 一边反思，互不干扰。当前 InvocationTracker 的 thread 级单锁使这不可能。

**Phase A scope**: 运行时并发基座。不含前端 UX（Phase B）。安全约束：Phase A 只允许单目标 side-dispatch + 一写一读场景。

## Original Requirements（必填）

> "这样的情况我会需要一直和不同的你们交流 甚至我可能就是给缅因猫一直发悄悄话避免影响你的修复。我会想要 1. 让你修复问题 2. 并发让缅因猫反思为什么他做的不好 然后如何从架构上改进"

> "赶紧开 worktree 修了他 记住只有布偶猫去修这个问题！@opus"
> "@gpt52 你缅因猫反思你为什么给布偶猫过了？你回答我这个不要碰代码"

- 来源：`docs/features/F108-side-dispatch-concurrent-invocation.md` "Why" section
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. **不做多目标原子占用** — Phase A 只 1:1 dispatch。多目标涉及 slot reservation ordering 和死锁风险，留给 Phase C
2. **不做 workspace 文件并发写保护** — Phase A 目标用例是"一只猫写代码 + 另一只猫只读"，真正的双写需要 file-level locking（Phase D）
3. **前端 store 只加 state，不加 UX** — activeInvocations 和 derived hasActiveInvocation 就位，但没有多 slot indicator 或 column rendering，这是 Phase B

## Open Questions

1. **QueueProcessor slot dequeue 策略** — 当前 `onInvocationComplete('t1', 'opus', 'succeeded')` 只 dequeue targetCats 匹配 opus 的 entry。如果一个 entry 的 targetCats=`['opus', 'codex']`（多目标），当前行为是按第一个 targetCat dequeue。Phase B 之前这不会触发，但 reviewer 可以评估是否需要更显式的多目标 dequeue 逻辑。
2. **WorklistRegistry parentInvocationId plumbing** — 完整透传链：`callbacks.ts → callback-a2a-trigger.ts → routeExecution → routeSerial`。请确认链路完整性，特别是 callback-a2a-trigger 的 parentInvocationId 传递。
3. **F086 MultiMention 收编** — 从独立 AbortController 改为 `invocationTracker.cancel(threadId, catId)`。请验证 cancel 语义一致（之前是 `abort()` 全局，现在是 slot-specific cancel）。

## Next Action

请 @codex 做跨 family code review。Review 重点：
- AC-A1~A10 全覆盖
- 并发安全（slot 隔离、mutex 粒度）
- 向后兼容（单 cat 路径不 break）
- WorklistRegistry plumbing 完整性

**Branch**: `feat/f108-side-dispatch` (11 commits)
**Plan**: `docs/plans/2026-03-12-f108-phase-a-slot-aware-runtime.md`（含缅因猫 GPT-5.4 plan review P1 修复记录）

## 自检证据

### Spec 合规

AC-A1~A10 逐项验证通过。详见上方 quality-gate report。

| AC | 状态 | 测试覆盖 |
|----|------|----------|
| A1: 不同猫并发 | ✅ | InvocationTracker.test + integration |
| A2: 旁路消息可见 | ✅ | 现有 broadcast 机制（same room） |
| A3: 同猫串行 | ✅ | InvocationTracker.test + integration |
| A4: InvocationRecord slot-aware | ✅ | invoke-single-cat-preflight.test |
| A5: 向后兼容 | ✅ | InvocationTracker.test + integration |
| A6: WorklistRegistry 隔离 | ✅ | WorklistRegistry.test + integration |
| A7: QueueProcessor slot-aware | ✅ | queue-processor.test + integration |
| A8: AgentMessage invocationId | ✅ | queue-processor.test + integration |
| A9: F086 收编 | ✅ | multi-mention tests + integration |
| A10: 前端 activeInvocations | ✅ | chatStore-multi-slot.test (6 tests) |

### 测试结果

```
pnpm --filter @cat-cafe/api test   # 164 pass, 0 new failures
                                   # (1 pre-existing: RedisWorkflowSopStore requires CAT_CAFE_REDIS_TEST_ISOLATED=1)
pnpm --filter @cat-cafe/web test   # 1192 pass, 56 pre-existing failures
                                   # (main has 57 — branch has 1 fewer)
                                   # All 56 are ChatContainer.tsx:481 — NOT introduced by F108
pnpm check                         # 0 errors (biome format + lint + feature index)
pnpm lint                          # 0 errors (warnings only, pre-existing)
pnpm -r --if-present run build     # exit 0 (shared + api + web)
```

### 相关文档

- Plan: `docs/plans/2026-03-12-f108-phase-a-slot-aware-runtime.md`
- Feature: `docs/features/F108-side-dispatch-concurrent-invocation.md`
- Backlog: F108
