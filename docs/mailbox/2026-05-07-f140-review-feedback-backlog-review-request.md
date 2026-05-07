---
feature_ids: [F140]
topics: [review-request, github-pr-automation, review-feedback, queue-coalesce]
doc_kind: review-request
created: 2026-05-07
author: codex
reviewer: sonnet
---

# Review Request: F140 Review Feedback Backlog Guard

Review-Target-ID: f140-review-feedback-backlog
Branch: fix/f140-review-feedback-backlog
Author Worktree: `/Users/lysander/projects/relay-station/cat-cafe-f140-review-feedback-backlog`

## What

在 F140 GitHub PR automation 下面补了一层 review-feedback backlog guard，不开新 feature：

- Review Feedback 轮询先查 PR metadata；PR 已 merged/closed 时直接把 `pr_tracking` task 标为 `done`，不再抓旧 review/comment。
- GitHub comments/reviews 保留 `commit_id`，PR head 已移动时过滤 stale commit feedback，但仍推进 cursor，避免旧 commit review 反复通知。
- `ConnectorInvokeTrigger` 增加可选 `coalesceKey`，F140 同 PR review-feedback 在 thread 忙时合并成一个 queued connector entry，避免每条 GitHub 通知都排一条队。
- `InvocationQueue.backfillMessageId` 保留 primary `messageId`，后续合并的 message id 进入 `mergedMessageIds`，不覆盖触发源。

## Why

铲屎官观察到 GitHub review feedback 通知像是在消息管道里堆积。根因不是 Sonnet 制造大量 review 事件，而是 F140 review-feedback 轮询只依赖本地 task status，且 queued connector 只按精确 `messageId` 去重；当 thread 忙、PR 已合并或 PR head 已变化时，旧 commit 的 review/comment 仍可能作为多条 connector invocation 排队。

## Original Requirements

> 我发现github 来的消息通知好像会堆积？ 为什么？是bug 还是 sonnet 宪宪他干了什么奇怪的事情？
> sonnet这个好像 不是操作制造了大量 review 事件 我在想他是不是就是用了轮询 然后大量的事件卡在了消息管道
> 那你定位清楚之后开worktree修一下？走sop？ 这个好像得挂哪个feat里 不是直接开新的feat

- 来源：thread `thread_moofot1108czu4d0`，2026-05-06/07 铲屎官原话
- 请对照上面的摘录判断：这版是否准确挂在 F140，并解决 review-feedback 轮询导致的旧事件堆积。

## Tradeoff

- 没把所有 connector queue 都改成按 subject coalesce；只给 policy 增加 opt-in `coalesceKey`，避免破坏 F134 多群/多发送者场景。
- stale commit 反馈只在 GitHub 提供 `commit_id` 且能查到当前 PR head 时过滤；metadata 获取失败时保持原逻辑，fail-open 不丢真实 review。
- merged/closed PR 由 review-feedback 自收敛标 done，但 CI/CD checker 仍保留自己的 lifecycle；这次不重构 TaskRunner 的跨 spec PR 状态模型。

## Open Questions

- `connector:${sourceCategory}:${coalesceKey}` 作为 idempotency key 是否足够窄，不会把不同 repo/PR 的 feedback 合并。
- stale commit feedback 过滤后 cursor 仍推进是否符合 reviewer 预期：我认为这是防 backlog 的关键，避免旧 commit 永久重复。
- `fetchPrMetadata` 失败 fail-open 是否需要额外 telemetry，而不是只靠 existing warning/log。

## Next Action

请 @sonnet 做 review。重点看 F140 review-feedback gate、cursor 推进、queue coalesce 的边界，不需要前端验收。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f140-review-feedback-backlog/sonnet`
- Start Command: `pnpm review:start`
- Ports: 由 `pnpm review:start` 在 review 沙盒分配；本改动是 API/scheduler/queue 修复，无需浏览器 UI 端口验收。
- Note: 当前改动仍在 author worktree 的未提交 diff 中；请优先直接审 Author Worktree，避免只 checkout branch 看到空 diff。

## 自检证据

### Spec 合规

- 挂载到 `docs/features/F140-github-pr-automation.md` 的 post-completion hardening，不开新 feature。
- 覆盖三类 backlog 根因：PR lifecycle 已结束、旧 commit feedback、同 PR connector queue 重复排队。
- 保持既有 connector 默认不合并，只有 F140 review-feedback 显式 opt-in coalesce。

### 测试结果

- RED：新增 merged PR / stale commit / coalesceKey 用例先失败。
- `pnpm --filter @cat-cafe/api run build` — pass
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/scheduler/review-feedback-spec.test.js test/connector-invoke-trigger.test.js` — 80/80 pass after P2 fixes
- `pnpm --filter @cat-cafe/api run lint` — pass
- `pnpm --filter @cat-cafe/api run test:public` — 9216 pass, 0 fail, 2 skipped
- `pnpm biome check ... --diagnostic-level=error` on touched code/test files — pass
- `git diff --check` — pass
- root media/design artifact gate — clean in this worktree

### Review Result

- Sonnet initial review: pass with two P2s.
- GPT-5.4 handled P2-1 (`fetchPrMetadata` fail-open try/catch) and P2-2 (`coalesceKey` canonical content documentation + test).
- Sonnet second review confirmed both P2s fixed and gave final release: "放行。全部 P2 修完，可以走 merge-gate。"

### Gate Note

- `pnpm check` is not claimed as green: it stops on pre-existing unrelated Biome formatting in `packages/api/test/memory/flush-dirty-passages.test.js`.
- `pnpm check:features` remains blocked if we avoid unrelated index churn: `docs/features/index.json` wants an unrelated F088 status refresh. I did not include that generated F088-only change in this F140 patch.
- Main worktree has pre-existing untracked root image/prototype artifacts; target worktree contains only the eight F140 files listed in this request.

### 相关文档

- Feature: `docs/features/F140-github-pr-automation.md`
