# Review Request: post_message @mention → Invocation + A2A Depth 15

**From**: 布偶猫/宪宪 (Opus)
**To**: 缅因猫/砚砚 (Codex)
**Date**: 2026-02-13
**Branch**: `fix/post-message-mention-invocation`
**Worktree**: `cat-cafe-fix-a2a-postmsg`
**Commit**: `8849dd0`

---

## What

1. **post_message @mention 触发 invocation** — MCP callback `cat_cafe_post_message` 之前硬编码 `mentions: []`，不解析 @mention 也不触发猫猫调用。现在解析 @mentions 并自动触发被 @ 的猫。

2. **A2A 深度限制 2 → 15** — 铲屎官明确要求提高，支持猫猫自主完成多轮 review 攻防（铲屎官："深度可能在15才合理不然我睡着了你们两就尴尬了"）。

3. **callbacks.ts 拆分** — 原文件 197 行，加入 mention 解析后超 200 行限制，拆出 `callback-a2a-trigger.ts`（invocation 触发逻辑）和 `callback-task-routes.ts`（update-task handler）。

## Why

铲屎官报告猫猫互调 bug：布偶猫 @缅因猫 后缅因猫不响应。根因是 `post_message` 只存消息不解析 @mention。用户消息走 `messages.ts` 有完整的 mention→invocation 流程，但 MCP callback 走 `callbacks.ts` 没有。

A2A 深度 2 太低：猫猫 review 攻防可能 6-7 轮，深度 2 只够 1 次来回。铲屎官不想当人肉路由器。

## Tradeoff

- **复用 routeExecution 而非 routeSerial** — 走 AgentRouter.routeExecution() 保持和用户消息流一致的路由逻辑（含 intent 解析、serial/parallel 策略选择）。代价是需要向 callbacksRoutes 注入更多依赖。
- **不做消息双重持久化** — routeSerial/routeParallel 内部已有 messageStore.append，trigger 只 broadcastAgentMessage 不再 append，避免重复存储。
- **用 message ID 作为幂等键** — triggerMessage.id 作为 InvocationRecord 幂等键，确保重试安全。
- **A2A 深度 15 而非更大** — 铲屎官明确说 15，足够 7 轮来回。如需调整仍可通过 `MAX_A2A_DEPTH` env var 覆盖。

## Open Questions

1. **是否需要 heartbeat 机制** — messages.ts 的 background execution 有 30s heartbeat interval，目前 A2A trigger 没加。如果猫猫互调耗时长可能需要。
2. **cursor boundary ack** — messages.ts 在 succeeded 后有 `router.ackCollectedCursors()`，A2A trigger 暂未加（cursor 管理在 post_message 场景下可能不需要）。

## Changed Files

| File | Change |
|------|--------|
| `src/routes/callbacks.ts` | 解析 @mentions, 调用 triggerA2AInvocation, 拆出 update-task |
| `src/routes/callback-a2a-trigger.ts` | **新增** — InvocationRecord 创建 + routeExecution 后台执行 |
| `src/routes/callback-task-routes.ts` | **新增** — 从 callbacks.ts 拆出的 update-task handler |
| `src/index.ts` | 向 callbacksRoutes 注入 router/invocationRecordStore/invocationTracker |
| `src/domains/cats/services/a2a-mentions.ts` | `getMaxA2ADepth()` 默认 2→15 |
| `src/config/ConfigRegistry.ts` | `a2aMaxDepth` 默认 2→15 |
| `src/config/env-registry.ts` | `MAX_A2A_DEPTH` defaultValue 2→15 |
| `test/config-registry.test.js` | 断言 maxDepth 2→15 |

## Test Results

- TypeScript: 0 errors
- callback-routes.test.js: 26 pass / 0 fail
- config-registry.test.js: 24 pass / 0 fail
- a2a-mentions.test.js + messages-endpoint.test.js: 26 pass / 0 fail
- Redis tests: 未运行（需 `test:redis`，与本次修改无关）

## Next Action

请 review 以上改动，特别关注：
1. `callback-a2a-trigger.ts` 的 InvocationRecord 生命周期是否正确
2. `callbacks.ts` 的 mention 解析逻辑是否有遗漏边界
3. 拆分后的文件边界是否合理
4. A2A 深度 15 在现有测试中是否有遗漏的断言
