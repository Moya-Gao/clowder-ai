# Review Request: A2A Liveness Chrome Thread Scope

Review-Target-ID: fix-a2a-liveness-status
Branch: fix/a2a-liveness-status
Commit: 74407ee9e

## What

Fix the A2A/handoff UI path where the chat chrome could lose:
- `{cat} 启动中...` from `ThinkingIndicator`
- bottom `执行中` cat chips
- per-cat cancel buttons

The fix threads `ChatContainer`'s `threadId` into `ThinkingIndicator` and `ThreadExecutionBar`, and makes both read `useThreadLiveness(threadId)` instead of the flat current-thread mirror. `ThreadExecutionBar` now also derives active cats from `targetCats + hasActiveInvocation` during the early A2A spawn window, before active invocation slots hydrate.

## Why

In A2A, the rendered chat thread and the flat liveness mirror can temporarily refer to different threads. The parent `ChatContainer` was already thread-scoped, but these two child chrome components still read flat store state, so they could render nothing or send cancel to the wrong thread.

## Original Requirements（必填）

> 在a2a的场景下 猫a at 猫 b好像会失去哪个猫猫启动中 + 各种猫b正在跑 然后可以取消的 按钮？ 正常情况应该是这样的 @codex

- 来源：当前 Cat Cafe thread `thread_mpgox9rs2se7vywm`，铲屎官消息 `0001779459125894-000057-f7899737`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Did not introduce another liveness store or component-level cache. The coordinate fix is to pass the already-known rendered `threadId` into the chrome components.
- Did not change warning/cancel styling. This is behavior/data-source only.
- Did not depend on `currentThreadId` except as a backward-compatible fallback when these components are used outside `ChatContainer`.

## Architecture Ownership（必填）

Architecture cell: dispatch
Map delta: none
Why: This only changes frontend liveness/cancel chrome to consume existing thread-scoped invocation state; it does not add a new queue, router, dispatcher, store, or binding.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. Is `deriveActiveCats({ targetCats, activeInvocations, hasActiveInvocation, intentMode })` the right shared derivation for `ThreadExecutionBar`, or should this chrome remain slot-only?
2. Does `getStartedAt()` handle the spawn-before-slot window clearly enough, without masking a bad liveness writer?
3. Are the regression tests sufficient for A2A thread mismatch, cancel endpoint correctness, and spawning indicator recovery?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review code commit `74407ee9e`, focusing on thread-scoped selector usage and whether the cancel endpoint is guaranteed to target the rendered thread.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-a2a-liveness-status/opus`
- Start Command: `pnpm review:start`
- Ports: reviewer-assigned by `pnpm review:start`
- Source worktree for author evidence: `/Users/lysander/projects/relay-station/cat-cafe-a2a-liveness-status`

## 自检证据

### Spec 合规

Quality gate PASS for the original reported UX:
- `ThinkingIndicator` now renders the requested thread's `spawning` cat.
- `ThreadExecutionBar` now renders the requested thread's active cat even when the flat current-thread mirror is empty.
- cancel endpoint uses the requested rendered thread id.

Design note: `designs/F118-cli-liveness-warning-ui.pen` matched the liveness UI keyword scan, but this change does not alter visual styling or layout.

Artifact hygiene:
- main root screenshot `a2a-liveness-status-home.png` was deleted.
- worktree `git status --short` is clean.
- root media gate for working tree and `origin/main...HEAD` produced no matches.

Architecture ownership:
- `pnpm check:architecture-ownership` exits 0.
- Existing repo-wide warnings remain in unrelated feature docs; diff architecture noun scan is OK.

Fallback layer check:
- `node scripts/check-fallback-layers.mjs` exits 0.
- Total net fallback change: +1; no coordinate-system threshold after refactor.

### 测试结果

```bash
NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/thread-liveness-chrome.test.tsx
# 1 file, 3 tests passed

NODE_ENV=test pnpm --filter @cat-cafe/web exec vitest run \
  src/components/__tests__/thread-liveness-chrome.test.tsx \
  src/components/__tests__/chat-container-thread-scoped-active.test.ts \
  src/components/__tests__/ThinkingIndicator-liveness.test.ts \
  src/components/__tests__/ThreadCatStatus-spawning.test.ts \
  src/hooks/__tests__/useSocket-liveness-reconcile-writer.test.ts \
  src/hooks/__tests__/useAgentMessages-invocation-created.test.ts
# 6 files, 29 tests passed

NODE_ENV=test pnpm check
# pass; only existing advisory warnings from skills manifest

NODE_ENV=test pnpm lint
# exit 0; existing cafe/no-hardcoded-colors warnings remain unrelated

NODE_ENV=test pnpm -r --if-present run build
# exit 0; existing lint warnings remain unrelated
```

### 相关文档

- SOP: `docs/SOP.md`
- Review request skill: `cat-cafe-skills/request-review/SKILL.md`
