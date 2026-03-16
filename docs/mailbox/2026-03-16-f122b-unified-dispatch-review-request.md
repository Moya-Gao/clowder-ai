---
doc_kind: review-request
feature_ids: [F122, F108]
created: 2026-03-16
---

# Review Request: F122B 统一调度后端核心 — A2A callback 入 InvocationQueue

## What

5 commits on `feat/f122b-unified-dispatch`，让 A2A callback handoff 走 InvocationQueue 统一调度：

1. **QueueEntry 扩展** — `source: 'agent'` + `autoExecute: boolean` + `callerCatId?: string`
2. **QueueProcessor `tryAutoExecute`** — agent 条目入队后目标猫 slot 空闲立即执行
3. **A2A trigger `enqueueA2ATargets`** — 有 `invocationQueue` dep 时产出 queue entry 替代 pushToWorklist
4. **App bootstrap wiring** — `invocationQueue` 注入到 callback routes deps
5. **Steer 验证** — agent-sourced entries 可被 promote/steer

改动文件：
- `packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts` — QueueEntry type + enqueue + peekAutoExecute + markProcessingById
- `packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts` — tryAutoExecute method
- `packages/api/src/routes/callback-a2a-trigger.ts` — F122B queue path + A2ATriggerDeps
- `packages/api/src/routes/callbacks.ts` — invocationQueue dep type + wiring
- `packages/api/src/index.ts` — invocationQueue 注入
- `packages/api/test/invocation-queue.test.js` — 3 new tests
- `packages/api/test/queue-processor.test.js` — 4 new tests (tryAutoExecute)
- `packages/api/test/callback-a2a-trigger.test.js` — 1 new test (F122B enqueue)
- `packages/api/test/queue-api.test.js` — 1 new test (steer agent entries)

## Why

铲屎官期望：所有执行通道（A2A/multi_mention/user/connector）都在统一 queue 里可见可控可 steer。Phase B 实现 A2A callback 这条最常用路径的统一调度。

ADR-018 已定：A2A + multi_mention 入 queue auto-execute，保持 slot 级判忙。

## Original Requirements（必填）

> 铲屎官 2026-03-14 19:25:
> "你们在 a2a 按道理我发的消息进 channel 然后我点 steer 才能强制推送 现在整个系统乱七八糟的"
> "原本的行为是就算你们在 a2a 我看到的也是这个界面！"

- 来源：`docs/features/F122-unified-dispatch-queue.md` Why 章节
- **请对照上面的摘录判断：A2A callback 走 InvocationQueue 后，铲屎官能否 steer 管控 A2A handoff？**

## Tradeoff

1. **multi_mention 暂不改**（AC-B6 deferred）— MultiMentionOrchestrator 的 response 聚合需要 QueueProcessor 回调机制，改造复杂度高，单独 PR
2. **Legacy path 保留** — 当 `invocationQueue` dep 不可用时（不应发生在生产环境），fallback 到 worklist/standalone
3. **autoExecute bypass pause** — agent 条目不受 failed/canceled pause 阻塞，因为是系统发起不是用户消息

## Open Questions

1. `tryAutoExecute` 当前一次只执行一个 autoExecute entry（`return` after first match）。如果同时有多只猫的 agent entries 排队且 slot 都空闲，是否应该批量执行？当前实现依赖 `onInvocationComplete` 的链式调度来串行处理。
2. A2A agent entry 的 `userId` 跟随触发者用户（`opts.userId`），这意味着 agent entries 出现在该用户的 queue scope 里，可以被该用户 steer。是否应该用 `'system'` 做隔离？当前行为对铲屎官可见性更好。

## Next Action

请 review 代码质量 + 架构合理性。重点关注：
- `tryAutoExecute` 和 `onInvocationComplete` 的链式调度是否有 race condition
- A2A trigger 的 F122B path 是否有 edge case 遗漏
- QueueEntry 新字段的 backward compat（existing callers 不传 autoExecute/callerCatId）

## 自检证据

### Spec 合规
- AC-B1~B5 全部完成 ✅
- AC-B6~B10 明确 deferred 记录在 feature doc
- 愿景覆盖度：3/5（A2A 核心路径已统一，multi_mention + 前端 UX deferred）

### 测试结果
```
node --test invocation-queue + queue-processor + queue-api +
  callback-a2a-trigger + queue-integration + queue-gate-thread-level +
  messages-delivery-mode → 130/130 pass ✅
pnpm check → 0 errors in changed files ✅
pnpm build (API) → pre-existing TS2578 only (not our changes) ✅
```

### 相关文档
- Feature: `docs/features/F122-unified-dispatch-queue.md`
- Plan: `docs/plans/2026-03-15-f122b-f108b-unified-dispatch.md`
- ADR: ADR-018（A2A + multi_mention 入 queue auto-execute）
- Branch: `feat/f122b-unified-dispatch` (5 commits)
