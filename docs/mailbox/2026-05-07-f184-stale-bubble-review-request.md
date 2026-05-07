---
feature_ids: [F184]
topics: [review-request, stale-streaming-bubble, socket-reconcile]
doc_kind: review-request
created: 2026-05-07
author: codex
reviewer: opus
---

# Review Request: F184 Stale Streaming Bubble Reconcile Fix

Review-Target-ID: f184
Branch: fix/f184-stale-streaming-bubble

## What

Fixed a live frontend state reconciliation gap where an old assistant bubble could remain `isStreaming: true` after its invocation had already completed, while another cat still had an active server slot.

- Added a stale-bubble finalization pass after `/queue` server-slot reconciliation in `useSocket.ts`.
- Only bubbles whose `catId` is absent from server active slots are finalized.
- Kept active server cats streaming and requested stream catch-up after finalizing stale local bubbles.
- Added a regression test covering the screenshot shape: stale Opus bubble still streaming locally while Codex is the only server-active cat.

## Why

The symptom is frontend-owned: F5 or switching thread rehydrates from server history and clears the stale presentation, but live socket reconcile did not clear old `isStreaming` bubbles when `/queue` still returned some other active cat.

## Original Requirements

> 我发现现在f184 183改完之后好像气泡还是有问题  
> 你看布偶猫其实都回答完了，现在是缅因猫但是他气泡还是这样  
> 然后f5/切换thread然后回去之后又正常，这应该是前端问题？

- 来源：A2A current thread, 2026-05-06 铲屎官原话
- 请对照上面的摘录判断：这版是否修掉“旧猫已完成但旧气泡还显示 streaming，F5/切 thread 才恢复”的 live 前端状态问题。

## Tradeoff

This is deliberately a narrow frontend reconcile fix. It does not change reducer merge semantics, CLI Output rendering, callback ordering, or backend invocation persistence. The server remains the source of truth for active cats; the client now also clears stale local streaming bubbles that are not present in that truth set.

## Open Questions

- Should the stale finalization helper also clear per-cat `catStatuses` for absent cats, or is finalizing `message.isStreaming` plus catch-up sufficient for the current UI?
- Is calling `requestStreamCatchUp(threadId)` from socket reconcile acceptable for both active and background thread states?

## Next Action

Please review this worktree. Focus on the socket reconcile invariant and whether the helper can accidentally finalize a valid still-streaming bubble.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f184/opus`
- Start Command: `pnpm review:start`
- Ports: assigned by `pnpm review:start`
- Local smoke used production web port `3081` after `pnpm -C packages/web build`

## 自检证据

### RED

`useSocket-stale-watchdog.test.ts` failed before the fix:

```text
expected "setThreadMessageStreaming" to be called with arguments:
["thread-stale-while-codex", "opus-stale-stream", false]
Number of calls: 0
```

### Tests

```text
node packages/web/scripts/run-with-node-env-test.mjs pnpm -C packages/web exec vitest run src/hooks/__tests__/useSocket-stale-watchdog.test.ts
# 9 tests passed

node packages/web/scripts/run-with-node-env-test.mjs pnpm -C packages/web exec vitest run src/hooks/__tests__/useSocket-stale-watchdog.test.ts src/hooks/__tests__/useSocket-reconnect-catchup.test.ts src/hooks/__tests__/useSocket-liveness-reconcile-writer.test.ts
# 18 tests passed

pnpm -C packages/web exec tsc --noEmit --pretty false
# pass

pnpm biome check packages/web/src/hooks/useSocket.ts packages/web/src/hooks/__tests__/useSocket-stale-watchdog.test.ts --diagnostic-level=error
# pass

pnpm -C packages/web build
# pass; existing lint warnings only

curl http://localhost:3081/ and curl http://localhost:3081/thread/f188
# both returned 200 under next start
```

### Reviewer Follow-Up

R1 P1 fixed after review:

- Added `catId?: string` to the test mock message shape.
- Added `catId: 'opus'` to the stale bubble fixture so the test exercises the real absent-cat branch.
- Added an active `catId: 'codex'` streaming bubble plus a negative assertion that it is not finalized.

Post-fix verification:

```text
node packages/web/scripts/run-with-node-env-test.mjs pnpm -C packages/web exec vitest run src/hooks/__tests__/useSocket-stale-watchdog.test.ts src/hooks/__tests__/useSocket-reconnect-catchup.test.ts src/hooks/__tests__/useSocket-liveness-reconcile-writer.test.ts
# 18 tests passed

pnpm biome check packages/web/src/hooks/useSocket.ts packages/web/src/hooks/__tests__/useSocket-stale-watchdog.test.ts --diagnostic-level=error
# pass

pnpm -C packages/web exec tsc --noEmit --pretty false
# pass

curl http://localhost:3081/thread/f188
# 200
```

## Related Files

- `packages/web/src/hooks/useSocket.ts`
- `packages/web/src/hooks/__tests__/useSocket-stale-watchdog.test.ts`
