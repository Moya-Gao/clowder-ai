# Review Request: Stream Catch-Up Recovery Wiring

Review-Target-ID: `fix-stream-catchup-recovery-action`
Branch: `fix/stream-catchup-recovery-action`
PR: https://github.com/zts212653/cat-cafe/pull/1550

## What

Wired `bubble-reducer`'s existing `recoveryAction: 'catch-up'` signal into the Phase C stream catch-up machinery from `useAgentMessages`.

- Added `applyBubbleEventWithRecovery(...)` as the single local wrapper around `applyBubbleEvent(...)`.
- When reducer returns `catch-up`, the wrapper calls `useChatStore.getState().requestStreamCatchUp(threadId)`.
- Replaced all `useAgentMessages.ts` reducer call sites with the wrapper.
- Added active-thread and background-thread regression tests for late stream chunks.

## Why

The reducer already knew that a late stream chunk after phase regression needed catch-up, but production callers ignored that signal. The live client could drop the late text tail and only recover after F5/thread switch via HTTP history hydration.

## Original Requirements

> "最新的版本 还是偶尔会出现claude code里边的猫猫需要f5 或者thread切换一下才会出来cli output 为什么啊？！"
> "tool events arrive, text chunks silently dropped/missing ... F5 only fixes via HTTP fetchHistory"

- 来源：thread handoff, 2026-05-04, `thread_moli9ev12ihcz7fi`
- 请对照上面的摘录判断：这次 PR 是否解决 live reducer recovery signal 被丢掉、必须 F5 才恢复的问题。

## Tradeoff

This PR intentionally does not change visual rendering, CLI Output placement, or reducer merge semantics.

Alternative B, "accept the late chunk into the finalized bubble directly in reducer", is a larger behavior change in F183 identity/reducer territory. This PR chooses the smaller recovery wiring fix first: reuse the existing Phase C catch-up path that already handles HTTP fetch, debounce, retry, ack, and Phase D merge filtering.

## Open Questions

- Is using a local wrapper in `useAgentMessages.ts` enough, or should `recoveryAction` handling be centralized closer to store actions?
- Is the global `useChatStore.getState().requestStreamCatchUp(...)` acceptable for both active and background paths?
- Should the reducer-level "accept late chunk into finalized bubble" path be required now, or left as a follow-up after this recovery wiring closes the F5-only symptom?

## Next Action

Please review PR #1550. If LGTM, I will trigger cloud review via SOP-serial.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-stream-catchup-recovery-action/opus-47`
- Start Command: `pnpm review:start`
- Ports: assigned by `pnpm review:start`

## Self-Check Evidence

### RED

`useAgentMessages-background.test.ts` late background stream chunk regression failed before the wiring:

```text
expected "requestStreamCatchUp" to be called with arguments: [ 'thread-bg-catchup' ]
Number of calls: 0
```

### Tests

```text
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run \
  src/stores/__tests__/bubble-reducer.test.ts \
  src/hooks/__tests__/useAgentMessages-stream-catchup.test.ts \
  src/hooks/__tests__/useSocket-reconnect-catchup.test.ts \
  src/hooks/__tests__/useAgentMessages-active-text-reducer-wire.test.ts \
  src/hooks/__tests__/useAgentMessages-background.test.ts
# 5 files, 151 tests passed

NODE_ENV=test pnpm --filter @cat-cafe/web test
# 377 files, 2810 tests passed

pnpm check
# passed

pnpm --filter @cat-cafe/web build
# passed

pnpm exec tsc -p packages/web/tsconfig.json --noEmit
# passed

git diff --check
# passed
```

## Related Files

- `packages/web/src/hooks/useAgentMessages.ts`
- `packages/web/src/hooks/__tests__/useAgentMessages-active-text-reducer-wire.test.ts`
- `packages/web/src/hooks/__tests__/useAgentMessages-background.test.ts`
