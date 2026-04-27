---
title: "Stream timeout catch-up for lost frontend bubbles"
date: 2026-04-27
author: "砚砚/GPT-5.5"
reviewer: "@sonnet"
type: review-request
status: pending
---

# Review Request: Stream timeout catch-up for lost frontend bubbles

Review-Target-ID: fix-stream-timeout-catchup
Branch: fix/stream-timeout-catchup

## What

- `packages/web/src/hooks/useAgentMessages.ts`: when `DONE_TIMEOUT_MS` fires, both active-thread and background-thread timeout branches now call `requestStreamCatchUp(timeoutThreadId)`.
- `packages/web/src/hooks/__tests__/useAgentMessages-stream-catchup.test.ts`: added RED/GREEN coverage for active/background timeout before `done(isFinal)`.
- `docs/bug-report/2026-04-27-stream-event-delivery-lag/bug-report.md`: marked the bug `fixed-awaiting-review` and added the verified frontend catch-up gap.

## Why

The bug report says backend message persistence was complete, but the frontend lost or lagged stream events and showed only the timeout system message. The timeout path was clearing active invocation state and adding the system message, but it did not rehydrate from the persisted thread store. After that, the stale watchdog could also miss the thread because the last visible message was the system timeout, not a user message or active invocation.

## Original Requirements（必填）

> docs/bug-report/2026-04-27-stream-event-delivery-lag/bug-report.md（commit 26bd41d96，已 push to main）  
> 你看看这个 bug 是不是导致你之前前端气泡消失的，感觉发版本前还得修这个东西

- 来源：当前 thread，铲屎官 2026-04-27 06:59
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- I did not change SocketManager buffering/replay in this patch. The verified immediate gap is frontend recovery after timeout; backend transport hardening is larger scope.
- I did not extend `DONE_TIMEOUT_MS`. Longer timeout would hide the symptom, but still would not recover persisted messages if stream events are lost.
- No browser screenshot: this is hook-level state recovery, not visual layout. The observable behavior is covered by unit tests that assert timeout triggers thread-scoped catch-up.

## Open Questions

- Is `requestStreamCatchUp(timeoutThreadId)` sufficient as the release-blocking fix, or should this PR also add a watchdog case for "last visible message is sysinfo-timeout"?
- Does calling catch-up after adding the timeout system message create any ordering concern in `chatStore` history merge?
- Is it acceptable to leave backend event bus buffering as a follow-up after v0.9.0?

## Next Action

Please review:
- active/background timeout branches in `useAgentMessages.ts`
- test coverage for both timeout cases
- whether the bug report conclusion is too strong or correctly scoped

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-stream-timeout-catchup/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: web/api assigned by `review:start`, forbidden: 3001/3002/3011/3012/4111

## 自检证据

### Spec 合规

- Runtime preflight confirmed runtime was on current main before diagnosis.
- Root cause matched the bug report symptom: backend store complete, frontend timeout path lacked catch-up.
- Bug report updated with diagnosis and fix status.
- Root-directory media/artifact gate: clean.

### 测试结果

- RED: `env -u NODE_ENV pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-stream-catchup.test.ts` failed before fix on the 2 new timeout cases.
- GREEN: same command passes, 8/8 tests.
- Regression group: `env -u NODE_ENV pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useAgentMessages-stream-catchup.test.ts src/hooks/__tests__/useSocket-stale-watchdog.test.ts src/hooks/__tests__/useSocket-reconnect-catchup.test.ts` passes, 18/18 tests.
- `env -u NODE_ENV pnpm check` passes.
- `env -u NODE_ENV pnpm --filter @cat-cafe/web run build` passes. Existing lint warnings remain; no new resetTimeout dependency warning.
- `env -u NODE_ENV pnpm test` passes on second full run. First run had one isolated API flake in `route-serial-verdict-hint.test.js`; the same file passed separately under the same `--import setup-cat-registry` condition.

### 相关文档

- Bug report: `docs/bug-report/2026-04-27-stream-event-delivery-lag/bug-report.md`
- Branch commit after rebase: `aad41183f`

[砚砚/GPT-5.5🐾]
