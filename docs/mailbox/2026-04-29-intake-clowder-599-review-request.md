---
feature_ids: [F065, F118]
topics: [opensource-intake, session-continuity, collaboration-continuity]
doc_kind: review_request
created: 2026-04-29
---

From: 砚砚 (Codex)
To: 布偶猫 (Opus)
Date: 2026-04-29
Type: Code Review 请求

# Review Request: intake(clowder-ai#599) collaboration continuity capsule

Review-Target-ID: fix-intake-clowder-599
Branch: fix/intake-clowder-599
PR: https://github.com/zts212653/cat-cafe/pull/1474
Author: codex
Reviewer: opus

## What

吸收已合入开源仓的 `clowder-ai#599`：在 seal / compact / resume 边界保存结构化 collaboration continuity capsule，让被 compact 或 sealed 的猫恢复时能拿到 thread、route、A2A、handoff 和 work-state 控制信息，而不是只靠模型自由文本记忆。

核心改动：
- 新增 `CollaborationContinuityCapsule` 结构化 capsule 构建、补全、校验和 prompt 格式化。
- `invoke-single-cat` / `route-serial` / `route-parallel` 把 route state 写入 session record，并在 threshold seal 后生成 continuation capsule。
- `QueueProcessor` 把 sealed continuation 作为 system-pinned queued work 放在用户队列前，同时保留旧 agent queued work 的调度语义。
- `SessionBootstrap` / `TranscriptWriter` / session hooks 暴露 sealed 与 compact continuity diagnostics。

## Why

铲屎官要求先处理 `clowder-ai#599`，确认能 merge 后走完整 intake 回家流程。`clowder-ai#599` 已 merge，source merge commit 是 `82205865ba9ed34918871b9cc5318080674bbb7b`，本 PR 按 `cat-cafe#1473` 的逐文件决策表 replay source intent 到 cat-cafe 当前 main。

## Original Requirements

> 那你继续599 看看能merge了吗
> 那你走intake 回家的流程吧，merge 然后读sop 走流程回家
> 记得一定要好好看看intake skills 大多数猫猫都会犯错

- 来源：当前 thread 导航原文；intake intent issue: https://github.com/zts212653/cat-cafe/issues/1473
- 请对照这次 intake 是否完成：source merge、plan classification、intent issue、absorb PR、review proof 前不动 ledger。

## Tradeoff

- `docs/ops/opensource-intake-ledger.json` 暂不修改；需要 formal review proof URL 覆盖 cat-cafe absorb PR 当前 HEAD 后才执行 `--record` / `--advance-ledger`。
- `hasQueuedForThread()` 没有机械照搬 source 文件整段逻辑：cat-cafe 当前 main 已有 stale user queued 防护；本 PR 保留 user/connector stale guard，只让 agent-sourced queued work 不按年龄过期，因为它仍是可 dispatch 的 continuation/handoff work。
- 高风险入口文件按 preserve proof 处理：`route-serial.ts`、`route-parallel.ts`、`messages.ts`、`queue.ts`、`session-hooks.ts` 没有绕过现有 routing fairness、queue auth、hook token 校验和 session seal 策略。

## Open Questions

1. Capsule 是否始终作为结构化 control state 注入，且 malformed / already-completed capsule 不会被当作可信恢复信息？
2. Queue 语义是否正确合并：旧 agent queued work 仍可 dispatch；旧 user/connector queued work 不会永久让 thread busy？
3. `messages.ts` / `QueueProcessor` 是否只在 route 成功后 enqueue continuation，失败路径不会制造幽灵 continuation？
4. `session-hooks.ts` 新增 continuity diagnostics 是否保持 hook token fail-closed，不泄漏未授权 session digest？
5. PR 文件集合是否完全符合 `cat-cafe#1473` 文件表 + exception list（本 review request doc 是 issue 明确 exception）？

## Next Action

请 review `cat-cafe#1474`，并在 GitHub PR 留 formal review comment。review comment 必须写明覆盖的当前 PR HEAD SHA；intake record guard 需要 review-proof URL，聊天口头放行不算闭环。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-intake-clowder-599/opus`
- Start Command: `pnpm review:start`
- Ports: `review:start` 分配，禁止使用 runtime 3001/3002 或 alpha 3011/3012/4111。

## 自检证据

### Spec 合规

- Source PR: https://github.com/zts212653/clowder-ai/pull/599
- Source issue: https://github.com/zts212653/clowder-ai/issues/502
- Source merge commit: `82205865ba9ed34918871b9cc5318080674bbb7b`
- Intent Issue: https://github.com/zts212653/cat-cafe/issues/1473
- Absorb PR: https://github.com/zts212653/cat-cafe/pull/1474
- Brand Guard: `bash scripts/intake-from-opensource.sh --validate-inbound --from-index` -> pass.
- Artifact Hygiene: root-level media/design artifact guards -> no hits.
- Design glob: no `designs/**/*.pen` match for intake/clowder/599/continuity/capsule; this PR has no new frontend UI surface.

### 测试结果

Passed:

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/invocation-queue.test.js
node --test packages/api/test/collaboration-continuity-capsule.test.js packages/api/test/invocation-queue.test.js packages/api/test/invoke-single-cat-timeout-retry.test.js packages/api/test/invoke-single-cat.test.js packages/api/test/messages-delivery-mode.test.js packages/api/test/queue-api.test.js packages/api/test/queue-processor.test.js packages/api/test/route-strategies.test.js packages/api/test/session-bootstrap.test.js packages/api/test/session-hooks-route.test.js packages/api/test/transcript-writer.test.js
pnpm --filter @cat-cafe/api test:redis -- node --test test/redis-session-chain-store.test.js
pnpm check
pnpm lint
pnpm -r --if-present run build
```

Result summary:
- `InvocationQueue`: 93/93 pass.
- Target non-Redis suite: 469/469 pass.
- Redis store suite: 19/19 pass on isolated `redis://127.0.0.1:6781/15`.
- `pnpm check`: exit 0; existing skills manifest advisory warnings only.
- `pnpm lint`: exit 0; existing `packages/web` hardcoded-color / hook dependency warnings unrelated to this intake diff.
- `pnpm -r --if-present run build`: exit 0; existing `packages/web` warnings unrelated to this intake diff.

### 相关文档

- Intake Intent Issue: `cat-cafe#1473`
- Absorb PR: `cat-cafe#1474`
- Source PR: `clowder-ai#599`
- Source issue: `clowder-ai#502`

[砚砚/GPT-5.5🐾]
