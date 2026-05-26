---
title: F194 queue zombie processing row recovery
date: 2026-05-26
status: blocked-design-reset
owner: codex
---

# F194 Queue Zombie Processing Row Recovery

## Reporter

铲屎官在 runtime thread `thread_mplxo94tqi4caxjx` 发现队列看起来积压了 30-60 分钟。

## Reproduction

现场 API 证据：

- `GET /api/threads/thread_mplxo94tqi4caxjx/queue` 返回一个 `status="processing"` 的 connector review entry。
- 同一响应里 `activeInvocations=[]`，说明没有活跃 invocation。
- `POST /queue/next` 返回 `{"started":false}`，因为 QueueProcessor 的 slot 仍然被 processing mutex 占用。

期望行为：F194 zombie reconcile 判定 invocation 已死后，队列 slot 和 processing row 也一起释放，后续 queued work 继续推进。

实际行为：F194 只把 InvocationRecord 标记为 `failed(error="zombie_record_detected")` 并清 TaskProgress；InvocationQueue 的 processing row 和 QueueProcessor slot 没被清理，前端看起来像后续消息积压。

## Root Cause

F194 cleanup pathway 的 cleanup surface 不完整：

1. `getThreadLiveInvocations()` 能正确识别 `running record + no tracker + no fresh draft + age exceeded` 为 zombie。
2. `reconcileZombies()` 只收敛 lifecycle record 和 TaskProgress。
3. QueueProcessor 的 per-cat `processingSlots` 和 InvocationQueue 的 `status="processing"` row 仍然保留。
4. 后续 `processNext()` 会被 stale slot 拦住，用户看到队列长时间不推进。

这不是 F185 A2A/connector fairness gate 回归；F185 代码仍在 runtime 中，相关队列测试也通过。

## Hard Block

The first hotfix attempt put queue recovery orchestration inside `reconcileZombies()`.
Cloud review then found repeated P1/P2 invariant leaks around slot ownership,
cross-user dispatch, zombie reason gating, namespace-aware classification,
already-terminal retries, paused slots, and method binding.

That pattern shows the coordinate system is wrong: lifecycle reconciliation should
not manually orchestrate `InvocationQueue`, `QueueProcessor`, `SocketManager`, and
TaskProgress cleanup. PR #1900 is frozen as a catalog of invariants, not a mergeable
hotfix.

Replacement design: move queue recovery behind a lifecycle event / resource-owner
cleanup pipeline so normal completion and zombie cleanup share the same atomic
cleanup contract. See `docs/plans/2026-05-26-f194-lifecycle-event-driven-recovery.md`.

## Verification

No code fix is merged from this attempt.
