---
feature_ids: [F140]
topics: [review-request, github-pr-signals, review-feedback, thread-routing]
doc_kind: note
created: 2026-06-18
---

# Review Request: F140 Review Feedback Original Thread Routing

Review-Target-ID: f140
Branch: fix/f140-review-feedback-original-thread

## What

Removed the #949 MR-review auto-rotation path from `ReviewFeedbackTaskSpec`.
Review feedback now preserves the PR-tracking registration thread: it no longer creates `MR review (auto-rotated...)` threads, posts source-thread breadcrumbs, or maintains per-thread review counters. Legacy tasks that were already rewritten to an auto-rotated thread are repaired back to the source thread before delivery.

## Why

PR tracking ownership is the user-visible routing contract. A long thread may require hydration/context policy, but that is a different layer; the scheduler must not solve it by moving review feedback into a surprise thread.

## Original Requirements（必填）

> "不要创建哪个奇奇怪怪的新的thread"
> "是哪个thread 创建的这个pr 给人投递回去啊！！"
> "你都能找到原本的thread 你干嘛不投递回去啊！！"

- 来源：当前 F140 thread，2026-06-18 CVO bug report
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

This removes the rotation/backlink mitigation instead of leaving it disabled by config. If context overflow is real, the follow-up belongs in invocation hydration / F148-style context selection, not in PR tracking thread ownership.

## Architecture Ownership（必填）

Architecture cell: github-automation / PR Signals tracking layer
Map delta: none
Why: This removes an incorrect scheduler routing strategy without adding a new Store/Queue/Router/Adapter/Dispatcher/Binding or moving ownership boundaries.

Please check:

- diff matches `Map delta: none`
- `ReviewFeedbackTaskSpec` cannot create threads or update task `threadId`
- legacy `completedReviewCount` state is ignored and no longer written
- legacy auto-rotated `task.threadId` state is repaired back to the source thread before routing

## Open Questions

### 技术 OQ（给 reviewer）

1. Is there any remaining live path that can rotate PR review feedback away from the registered thread?
2. Are the factory and direct spec tests sufficient to lock both direct and plugin-wired paths?

### 价值 OQ（给 CVO，如有）

无。CVO already stated the desired behavior: no generated review threads; deliver back to the thread that registered PR tracking.

## Next Action

Please review for APPROVE / REQUEST-CHANGES. Focus on routing ownership and stale #949/#2372 remnants.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f140/opus47`
- Start Command: `pnpm review:start` or direct static review; no frontend server required
- Ports: none

## 自检证据

### Spec 合规

- F140 spec updated to mark #949 auto-rotation / PR #2372 backlink as wrong-layer correction, not hardening.
- Docs ops reconciliation note marks the old #949 rotation sync as superseded.

### 测试结果

- RED reproduced: `review-feedback-thread-rotation.test.js` created a rotated thread and routed to `thread_rotated_1`.
- P1 RED: polluted legacy `task.threadId=thread_rotated_1` still delivered to the rotated thread.
- GREEN targeted: `review-feedback-thread-rotation.test.js` 7/7 pass and `github-schedule-factories.test.js` covers production wiring repair.
- F140 targeted suites: 143/143 pass across severity parser, setup-noise filter, review router, review task spec, GitHub feedback filter, schedule factory, and thread ownership regression.
- `pnpm check`: 27/27 checks passed.
- `pnpm gate`: PASSED at SHA `b218e11e` (build, tsc, all tests, lint, check).

### 相关文档

- Feature: `docs/features/F140-github-pr-automation.md`
- Ops correction note: `docs/ops/reconciliation-2026-06-17.md`
