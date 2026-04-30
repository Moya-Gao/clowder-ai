---
feature_ids: [F173]
related_features: [F081, F118]
topics: [bug-report, draft-store, stream-catchup, invocation-liveness, bubble-visibility]
doc_kind: bug-report
created: 2026-04-29
status: fixed-in-branch
severity: P1
reporter: Landy (runtime observation)
diagnosed_by: 布偶猫/宪宪 (Opus-47), 缅因猫/砚砚 (GPT-5.5)
fixed_by: 缅因猫/砚砚 (GPT-5.5)
fixed_branch: fix/draft-merge-liveness
---

# Bug Report: Draft Merge Liveness Mismatch Hides Active Bubble

## TL;DR

铲屎官观察到砚砚实际仍在运行，但前端长时间没有显示气泡；刷新或等 invocation 完成后才重新出现。

本问题不是实时 stream delivery lag 本身，而是 **timeout / catch-up 走 GET `/api/messages` 后，draft merge liveness 判定只信 `invocationRecordStore`，误把仍在运行的 draft 当 orphan 过滤并删除**。一旦 read path 删除了 active draft，前端 catch-up 会继续拉到空结果，用户体感就是"一直缺失"。

## User-Visible Symptom

- Agent invocation 实际还在跑，runtime 状态栏可见。
- 当前 thread 中没有对应 streaming bubble。
- F5 / reconnect / 后续 chunk / final formal message 可能让气泡重新出现，但恢复路径不稳定。
- 用户容易误判为 agent 没在运行，从而错误 cancel。

## Root Cause

`packages/api/src/routes/messages.ts` 的 draft merge orphan filter 只用 `invocationRecordStore.get(draft.invocationId)` 判断 draft 是否活跃：

- record 为 `running` 且 thread/user 匹配：保留 draft。
- record missing / terminal / cross-scope：认为 orphan。
- orphan draft 不只从响应中过滤，还会在 GET read path 调 `draftStore.delete(...)`。

这个假设在实际 runtime 中不成立：`DraftStore`、`InvocationRecordStore`、`InvocationTracker` 不是同一个 liveness truth source，可能短暂不同步。只要 tracker 仍有同 cat/thread/user 的 active slot，该 draft 仍应被视为 live bubble。

## Why It Persisted

PR #1432 已让前端 timeout 后触发 stream catch-up，但 catch-up 依赖 GET `/api/messages`。当 GET 路径自己误删 draft 时，catch-up 反而稳定复现"拉不到气泡"。

这也是为什么用户看到的不是短暂缺失：删除发生在 read path，除非后续 stream chunk 再次 upsert draft、socket reconnect 收到实时事件，或 final message 落库，否则前端没有稳定自愈路径。

## Fix

Branch: `fix/draft-merge-liveness`

1. GET `/api/messages` 保留 draft 的条件改为：
   - invocation record active；或
   - guarded invocation tracker active。

2. Tracker guard 使用三段约束，避免旧 draft 被新 slot 复活：
   - `slot.catId === draft.catId`
   - `tracker.getUserId(threadId, catId) === userId`
   - `slot.startedAt <= draft.updatedAt`

3. GET read path 改为 **filter-only**：
   - orphan draft 不返回给前端；
   - 不再从 GET 路径调用 `draftStore.delete(...)`；
   - 真实 zombie 交给 DraftStore TTL、completion cleanup、cancel cleanup。

4. Liveness dependency lookup fail-open：
   - invocation record lookup 失败：保守保留 draft；
   - tracker lookup 失败：同样保守保留 draft。

5. Orphan log 增强：
   - `recordStatus`
   - `recordThreadId`
   - `recordUserId`
   - `trackerSlotStartedAt`
   - `trackerUserId`
   - `draftUpdatedAt`
   - `catId`

## Regression Coverage

- API draft merge:
  - record running -> keep
  - record missing + tracker active -> keep
  - record terminal + tracker active -> keep
  - newer tracker slot for older draft, including the prior 1s skew window -> filter
  - record missing / terminal with no tracker proof -> filter but do not delete
  - record lookup failure -> keep
  - tracker lookup failure -> keep

- Web store:
  - existing stream placeholder plus server draft with same invocation identity merges to one bubble.

## Boundary

This fix only closes the GET / stream-catchup liveness mismatch. It does not solve the separate real-time stream delivery lag tracked by `docs/bug-report/2026-04-27-stream-event-delivery-lag/bug-report.md`.

## Follow-Up

`InvocationTracker` active slot currently exposes `catId + startedAt`, not `invocationId`. A future tightening can add slot-level `invocationId` and replace timestamp matching with strict identity matching.

## Signature

[砚砚/GPT-5.5🐾] 2026-04-29
