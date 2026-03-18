---
capsule_id: "F122-CLOSE-2026-03-18"
context: "F122 执行通道统一完成收口（A2A/multi_mention 全量入 Dispatch Queue）"
feature_ids: [F122]
doc_kind: capsule
created: 2026-03-18
---

## What Worked
- 把 Phase A（止血）和 Phase B（语义收敛）拆开推进，先修线上可见故障，再统一执行平面，降低了大改期间的回归风险。
- B6 采用 `InvocationQueue + QueueProcessor` 复用路径，而不是在 multi_mention 单独再造一套调度器，最终让 queue/steer/状态可视化语义一致。
- Review 链条执行到位（R3→R5），连续抓到 `abort→succeeded`、hook 泄漏、duplicate 状态不一致三类真实缺陷，避免了“看起来能跑”的假闭环。

## What Failed
- Feature 完成后，真相源文档收口滞后：`AC-B6` 已合入但仍挂在 BACKLOG 和 `in-progress` 状态，说明 merge 后的 close 动作没有及时落盘。
- B6 的首版测试覆盖了主路径，但对 `duplicate` 分支状态一致性覆盖不足，导致 finally hook 与返回状态脱节问题晚发现一轮。

## Trigger Missed
- 应该在 PR #536 merge 当下立即触发 `feat close`，而不是依赖人工提醒；这次是铲屎官点名后才补完整闭环。
- 对“新引入 hook + finally”模式，应该默认触发一次“早返回分支一致性”检查（`duplicate`/`abort`/`throw` 三分支），避免状态漂移。

## Doc Links
- [F122 spec](../features/F122-unified-dispatch-queue.md)
- [ADR-018](../decisions/018-f122-oq-unified-dispatch-decisions.md)
- [F108 spec](../features/F108-side-dispatch-concurrent-invocation.md)
- [F098 spec](../features/F098-callback-message-ux.md)

## Rule Update Target
- `cat-cafe-skills/feat-lifecycle/SKILL.md` Completion 阶段：补一条“若 Phase 全部 AC 已 merge，24h 内必须执行 close（三件套：spec status/BACKLOG/features README）”的时效规则。
- `cat-cafe-skills/tdd/SKILL.md` 或 review checklist：新增“hook/finally 结构必须覆盖 early-return 状态一致性测试”的固定检查项。
