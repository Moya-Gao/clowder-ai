---
topics: [opensource-intake, routing, queue, review-request]
doc_kind: mailbox
created: 2026-05-27
---

# Review Request: intake clowder-ai#776

Review-Target-ID: intake-clowder-776
Branch: fix/intake-clowder-776
PR: cat-cafe#1919
Code commit under review: bb4883ff7a6995082cdd15761e661e26f39536c1
Intake Intent Issue: cat-cafe#1918
Source PR: clowder-ai#776
Source merge commit: 8bc3b25b705c1267e378162a6cf5859ac4fdefa1

## What

- Absorbs clowder-ai#776 so queue-dispatched A2A stream messages preserve explicit `replyTo` threading.
- Adds explicit `a2aTriggerMessageId` flow through `InvocationQueue -> QueueProcessor -> AgentRouter -> routeSerial`.
- Keeps the guard that normal queued user messages must not inherit a bogus A2A `replyTo`.
- Manual-port strengthens the same invariant for deferred text-scan queue dispatch, not just callback A2A.
- Adds targeted regression coverage in callback, queue processor, and route-serial tests.

## Why

Before this intake, A2A dispatch had asymmetric reply threading: queue-dispatched initial targets could lose `replyTo`, so ReplyPill rendering and downstream threading metadata diverged from the worklist path. The source PR fixes the main queue path; this intake also closes the same hole for fairness-deferred text-scan queue dispatch so home invariants stay consistent across both queue entry points.

## Original Requirements

> 来吧 应该md文档处理好了？能merge了吗？ 如果merge了， merge 然后读sop 走流程回家
> 记得一定要好好看看intake skills 大多数猫猫都会犯错

- Source: current Cat Café A2A thread, Landy message at 2026-05-27 01:52 PT.
- Please review against the above requirement: the open-source merge already happened, and this branch is the “walk it back home carefully” absorb step, with extra attention on intake-specific mistakes.

## Tradeoff

I did not try to complete the broader issue-736 “fully unify text-scan dispatch into InvocationQueue” architecture change. This PR stays on the accepted bugfix slice: preserve explicit reply threading through queue-dispatched A2A. The only scope extension beyond source is making the same explicit trigger invariant apply to the existing fairness-deferred text-scan queue path, because otherwise home would still keep one queue-sourced hole open.

## Architecture Ownership

Architecture cell: dispatch
Map delta: none
Why: This extends the existing InvocationQueue/routeSerial contract and reply-threading semantics, but does not add a new Store, Queue, Router, Adapter, Dispatcher, or ownership boundary.

Please check:

- Diff matches `Map delta: none`.
- Queue-dispatched A2A initial targets get explicit trigger threading without widening `currentUserMessageId` semantics.
- The manual-port on `route-serial.ts` preserves home behavior for crossThreadReplyHint while fixing stream `replyTo`.
- Deferred text-scan queue dispatch now carries the same explicit trigger id as callback A2A.

## Open Questions

### 技术 OQ（给 reviewer）

- Is the manual-port on the fairness-deferred text-scan queue path the right home-side strengthening, or do you want to keep intake strictly source-equivalent and defer that extra invariant fix?
- Do you see any queue entry merge/dedup behavior that should also carry stronger semantics around multiple `a2aTriggerMessageId` values, or is single-trigger-per-entry still the right boundary for this slice?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review cat-cafe#1919 against cat-cafe#1918. If approved, I will merge the absorb PR, record clowder-ai#776 as `absorbed`, and advance the intake ledger immediately.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/intake-clowder-776/opus47`
- Start Command: no service start needed; run the validation commands below.
- Ports: n/a (API targeted tests only; do not use 3001/3002/3011/3012/4111)

## 自检证据

### Spec 合规

- Intake Intent Issue: `cat-cafe#1918`
- `bash scripts/intake-from-opensource.sh --pr 776 --mode=plan` classified: 6 safe-cherry-pick, 3 high-risk manual-port, 0 public-only.
- Brand Guard: `bash scripts/intake-from-opensource.sh --validate-inbound` passed.
- Root artifact gate: no root-level media/design artifacts in worktree status or `origin/main...HEAD` diff.

### Dogfood-Your-Slice

Scope verdict: ✅ 必做

端到端路径:
- callback A2A enqueue → QueueProcessor → routeSerial stream reply threading
- fairness-deferred text-scan A2A enqueue → deferred queue entry carries explicit trigger id

实际证据:
- `packages/api/test/callback-a2a-trigger.test.js`
- `packages/api/test/queue-processor.test.js`
- `packages/api/test/route-serial-replyto-stream.test.js`

发现的 bug:
- source PR fixed callback/queue path, but home-side parity check found the fairness-deferred text-scan queue path still needed the same explicit trigger invariant. Fixed in `bb4883ff7`.

### 测试结果

```bash
bash scripts/intake-from-opensource.sh --validate-inbound
# passed

cd packages/api
pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/callback-a2a-trigger.test.js test/queue-processor.test.js test/route-serial-replyto-stream.test.js
# 108 passed, 0 failed

cd ../..
pnpm lint
# passed (existing web warnings only, no new errors)

pnpm check
# passed

git diff --check
# passed
```

### 相关文档

- Intake Intent Issue: `cat-cafe#1918`
- Absorb PR: `cat-cafe#1919`
- Mailbox: `docs/mailbox/2026-05-27-intake-clowder-776-review-request.md`

[砚砚/GPT-5.4🐾]
