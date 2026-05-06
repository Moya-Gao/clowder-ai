---
feature_ids: []
topics: [review-request, stream-callback-race, clowder-ai-623, source-owned]
doc_kind: review-request
created: 2026-05-06
author: codex
reviewer: opus-47
---

# Review Request: Stream Callback Race Source-Owned Fix

Review-Target-ID: fix-stream-callback-race-source-owned
Branch: fix/stream-callback-race-source-owned

## What

在家里直接实现 `clowder-ai#623` 可学习的两条核心修复：

- stream 仍 active 时，explicit callback 先进入 pending map，不立刻替换 bubble，也不提前 `markReplacedInvocation`
- `done` / background text-final 时 drain pending callback，确保 late stream chunk 不会被 suppression 吃掉
- recoverable error 保留 pending callback，nonrecoverable error / reset 清掉
- draft merge 改用 stable `createdAt` 判断 liveness，避免 old draft 被 touch 后复活进 newer tracker slot

## Why

铲屎官判断得对：如果家里可以完成源头修复，就不要等社区 PR 在外面长期悬着。我们先在 home repo 验证完整行为，再全量 sync 到外部，社区 PR 可以关闭为 superseded by source-owned implementation。

## Original Requirements

> 我在想我们是不是能直接在家里实现完成  
> 然后刚好也需要全量同步一次到外部了  
> 这样这个 PR 社区那边就可以直接关？  
> 家里实现完成然后我们一起验证没问题就可以全量同步一次？

- 来源：thread `thread_moli9ev12ihcz7fi`，2026-05-06 铲屎官原话
- 请对照上面的摘录判断：这版是否足够让家里先完成并验证，再作为外部 full sync 的源头。

## Tradeoff

- 没引入 backend `messageRole` 等大架构 marker；这刀只收 callback-before-done / draft-liveness 两个已经可验证的 race。
- timeout path 仍走既有 catch-up/recovery，不在本 PR 扩大语义。
- `pnpm gate` 全量脚本重复卡在既有 `workspace-file-watcher.test.js` 子进程；该文件单跑通过，剩余 lint/check 已单独补绿。PR body 里明确没有把 full gate 标成 passed。

## Open Questions

- `threadId::catId::invocationId` 作为 pending callback key 是否覆盖 active + background 两条路径的身份边界？
- background drain 时先把 matching stream message 标为 non-streaming 再递归处理 callback，是否是最小且正确的防 re-deferral 方式？
- DraftStore `createdAt` 保存策略是否足够兼容旧 Redis draft（fallback 到 `updatedAt`）？

## Next Action

请宪宪做 R1 review。重点看 race 语义、pending callback cleanup、draft liveness 兼容性；如果 LGTM，我再触发 cloud review。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-stream-callback-race-source-owned/opus-47`
- Start Command: `pnpm review:start`
- Ports: 由 `pnpm review:start` 在 review 沙盒分配；本 PR 是 store/API race 修复，无需浏览器 UI 端口验收。

## 自检证据

### Spec 合规

- 对齐铲屎官要求：home repo source-owned implementation，后续 full sync 外部。
- 对齐 PR #623 可学习点：callback-before-done defer、background final drain、recoverable error preservation、draft liveness。

### 测试结果

- `node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/hooks/__tests__/useAgentMessages-catchup-ref-desync.test.ts src/hooks/__tests__/useAgentMessages-background.test.ts src/hooks/__tests__/useAgentMessages-active-text-reducer-wire.test.ts src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts` — 97/97
- focused hook suite — 135/135
- full web vitest — 380 files / 2831 tests
- `pnpm --filter @cat-cafe/web exec tsc --noEmit` — pass
- `pnpm --filter @cat-cafe/api build && node --test packages/api/test/draft-messages-merge.test.js` — 20/20
- isolated `workspace-file-watcher.test.js` — 4/4
- `pnpm lint` — pass, existing warnings only
- `pnpm check` — pass
- `git diff --check` — pass

### Gate Note

`pnpm gate` attempted twice; both reached API full test and hung in the existing `workspace-file-watcher.test.js` child process. I killed the detached process tree after confirming the file passes isolated and then ran the remaining lint/check gates separately. Full `pnpm gate` is therefore **not** claimed as passed.
