---
feature_ids: [F117, F175]
topics: [review-request, queue, message-delivery, connector, invocation]
doc_kind: review-request
created: 2026-04-30
---

# Review Request: stale queued message dispatch fix

Review-Target-ID: fix-stale-queue-dequeue
Branch: fix/stale-queue-dequeue

## What

修复 user / connector queued message 超过 60s 后，active invocation 完成也不会再自动推送的问题。

- `InvocationQueue.hasQueuedForThread()` 保留 freshness/fairness 语义。
- 新增 `hasDispatchableQueuedForThread()` 表示真正可调度的 pending queue work。
- `QueueProcessor` 的 completion、pause、auto-recovery、thread busy gate 改用 dispatchable 语义。
- 补 user + connector stale queued entry 回归测试，覆盖 succeeded dispatch、failed/canceled pause、#595 auto-recovery、`isThreadBusy()`。

## Why

Landy 报告 runtime dogfood bug：猫猫执行期间发的消息会进队列，但猫猫跑完以后不会再推送；外部 GitHub / IM connector 也一样。

## Original Requirements

> 我发现我们现在有个bug 你看看为什么
> 这个消息等你跑完了 他都不会再推送给你了
> 外部进来的 github也好 im也好 也是这样
> 记得开worktree修复一下

- 来源：当前 A2A thread，Landy 2026-04-30 报告。
- 请 reviewer 对照判断：这次修复是否覆盖 user message 和 connector message 两条入口。

## Tradeoff

没有删除 60s stale guard。它对路由 fairness 仍有价值：旧 user / connector entry 不应永久把新广播消息拖进 queue mode。修复点是把 queue 自身调度从 freshness gate 中拆出来。

## Open Questions

- `isThreadBusy()` 改用 dispatchable gate 后，streaming `chainDone` 会把 stale queued entry 视为 busy；这是我认为正确的行为，请重点复核。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-stale-queue-dequeue/opus-47`
- Start Command: `pnpm review:start`
- Ports: 默认 `web=3201`, `api=3202`，若被占用由 `review:start` 自动向后扫描；禁止使用 3001/3002/3011/3012/4111。

## 自检证据

### RED

```bash
pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/invocation-queue.test.js test/queue-processor.test.js
# before fix: 166 pass, 4 fail
# failures:
# - hasDispatchableQueuedForThread is not a function
# - stale user queued entry did not dispatch on completion
# - stale connector queued entry did not dispatch on completion
```

### GREEN

```bash
pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/invocation-queue.test.js test/queue-processor.test.js test/queue-processor-pause-epoch.test.js test/queue-processor-zombie.test.js test/queue-integration.test.js
# 191/191 pass

pnpm --filter @cat-cafe/api run lint
# pass

pnpm check
# pass; existing skills manifest advisory warnings only

pnpm -r --if-present run build
# pass; existing web lint warnings only
```

### 相关文档

- Bug report: `docs/bug-report/2026-04-30-stale-queued-message-not-dispatched/bug-report.md`
- Feature truth sources: `docs/features/F117-message-delivery-lifecycle.md`, `docs/features/F175-unified-message-queue.md`
