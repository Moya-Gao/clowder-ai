---
title: "Review Request: F122 Phase A — dispatch 通道可靠性补漏"
date: 2026-03-15
author: opus
type: review-request
feature: F122
---

# Review Request: F122 Phase A — dispatch 通道可靠性补漏

## What

7 个 commit，补 A2A/multi_mention/queue 执行通道的 4 个可靠性漏洞 + 1 个 UI 缺失 + 回归测试：

1. **pushToWorklist 结构化 PushResult** — 返回 `{ added, reason? }` 替代裸 `CatId[]`，reason 含 `not_found | depth_limit | caller_mismatch | all_duplicate`
2. **not_found fallback** — pushToWorklist 返回 `not_found` 时降级到 standalone invocation（worklist 竞态保护）
3. **parentInvocationId 透传** — multi_mention 的 `dispatchToTarget` 现在把 `parentInvocationId` 传给 `routeExecution`，修复 F108 并发 worklist 断链
4. **tracker 生命周期加固** — `dispatchToTarget` 的 `invocationTracker.complete()` 从内层 try/finally 移到外层 try/finally，覆盖 early return + registerDispatch throw
5. **QueuePanel processing 态** — 用户现在能看到 processing 状态的队列条目（"处理中" 标签，无控制按钮）
6. **回归测试** — AC-A5/A6 queue 行为的显式 F122 regression anchors

## Why

铲屎官报告截图：缅因猫 at 小金，小金挂了，系统显示"猫猫正在回复中"锁死。根因是 multi_mention target 崩溃后 caller slot 未释放、pushToWorklist 返回空数组无法区分失败原因、QueuePanel 过滤掉了 processing 态条目。

F122 是 F108（并发执行基座）的治理策略层。Phase A 只补漏洞不改架构。

## Original Requirements（必填）

> "缅因猫干完活at 小金 小金挂了这个时候系统认为缅因猫还在回复 我发的消息只能挂着除非我强制推" — 铲屎官 2026-03-14 22:54
> "你们这个要做好 未来不会很多bug 要看看f108 得合并完成" — 铲屎官 2026-03-14 22:48
> "来吧大宝贝，我建议你 最好到时候一定要喊 缅因猫他们 认真看我的话 我们的决策 不能只看代码不看架构。" — 铲屎官 2026-03-14 23:01

- 来源：对话记录（F122 立项讨论），spec 见 `docs/features/F122-unified-dispatch-queue.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**
- **请同时审阅 `docs/features/F122-unified-dispatch-queue.md` 的 Roadmap 章节**——铲屎官要求 reviewer 看架构决策，不能只看代码

## Tradeoff

- Phase A 只补漏洞，不做 Phase B 架构改造（A2A 入 queue、统一 InvocationCoordinator）
- pushToWorklist 的 `reason` 是 enum string 而非 error code，trade-off 是可读性优先

## Open Questions

1. **AC-A7 的 defense-in-depth 范围**：tracker.complete() 是 idempotent 的，外层 finally 会 double-call（第二次 no-op）。这是有意为之——请确认你同意这个设计。
2. **F108×F122 Phase B 冲突**：Roadmap 记录了三猫共识（F108=capability, F122=policy），Phase B 需要同步做。请审阅 spec 中的 OQ-1/2/4 和三阶段计划。
3. **pre-existing test failures**：`queue-api.test.js` 有 8 个 pre-existing failures（main 上也同样失败），与 F122 改动无关。

## Next Action

请 reviewer（@codex / @gpt52）：
1. Review 7 个 commit 的代码质量和正确性
2. **重点**：审阅 `docs/features/F122-unified-dispatch-queue.md` 的 Roadmap 章节，特别是 F108×F122 的三阶段执行计划
3. 对照铲屎官原话判断 Phase A 是否解决了报告的问题
4. 给出 verdict

## 自检证据

### Spec 合规
AC-A1 ~ AC-A7 全部实现并有测试覆盖。详见 quality-gate 报告。

### 测试结果
```
Backend: 53 tests, 0 failed (worklist-registry + callback-a2a-trigger + multi-mention-routes + a2a-chain)
Frontend: 14 tests, 0 failed (queue-panel-*.test.ts)
pnpm build → exit 0
pnpm lint → 0 errors (pre-existing warnings only)
pnpm biome check → 0 errors
```

### 相关文档
- Feature: `docs/features/F122-unified-dispatch-queue.md`
- Plan: `docs/plans/2026-03-14-f122-phase-a-reliability.md`
- BACKLOG: F122 行
