# Review Request: F123 Hydration Reconcile Slice

## What
- 在 `mergeReplaceHydrationMessages()` 里补了一条 phase priority：同一 invocation 下，server `callback` bubble 在 hydration 时优先于本地 `stream` bubble
- 补了 hydration 红灯回归，钉死“history callback 必须赢过 local stream”
- 补了 active/background 两条 late-guard 边界测试：旧 `replacedInvocations` 不得误抑制新 invocation 的首个无 `invocationId` stream chunk
- 对称收紧 active/background guard：当前槽位还没建立时，清旧 guard 并放行新 chunk

## Why
- F123 这轮上一刀解决的是 realtime overlap；铲屎官点名的另一半痛点是 “F5 前后一会两条一会一条”
- hydration path 的真相源在 `useChatHistory.ts`，如果这里仍然只看 richness，不认识 “callback 比 stream 更正式”，刷新后仍可能回到错误 bubble
- codex 云端复核还留了一个 P3 覆盖缺口：旧 callback replacement guard 不能误伤下一次新 invocation

## Original Requirements（必填）
> “前端的气泡问题，我们已经反复修了一个多月了。”  
> “F5 前后不能一会两条一会一条。”  
> “一定要看代码，不要乱编和瞎猜。”
- 来源：`docs/discussions/2026-03-14-f123-bubble-runtime-followup/README.md`
- **请对照上面的摘录判断这刀是否真的推进了 hydration / F5 一致性，而不是只补了另一层热修**

## Tradeoff
- 这刀没有提前做更大的 identity contract / MessageWriter 收口，只做 hydration reconcile 的最小闭环
- 浏览器实证没有强行在真实 thread 页复现 hydration bug，因为隔离 worktree 前端 `3103` 直连 runtime API `3002` 会被跨源拦住；我保留了 thread smoke 失败的事实，把行为验证放在 hook 回归测试，把浏览器证据退成当前 bundle 的页面 smoke

## Open Questions
1. `callback > stream` 这条 phase priority 现在只落在 hydration reconcile；你帮我看一眼是否已经足够窄，没有把别的 hydrate 语义一起带偏
2. active/background 的 “无当前 invocationId 时清 guard 并放行” 是否和你预期一致，有没有遗漏会重新放出旧双影

## Next Action
- 请按 F123 的 `R2 / hydration reconcile` 目标审这刀
- 重点看：`useChatHistory.ts` 的 phase priority 是否正确，以及两个新 guard 测试是否真的覆盖了 codex 提的边界

## 自检证据

### Spec 合规
- Feature: [F123-bubble-runtime-correctness.md](/Users/lysander/projects/relay-station/cat-cafe-f123-hydration-reconcile/docs/features/F123-bubble-runtime-correctness.md)
- 本刀对齐的 AC:
  - `AC-C1`：补 hydration reconcile 的代码与 fixture
  - `AC-C2`：把 `R2/F5` 这一面开始从口头症状转成可回放测试
  - 顺手补上 codex 愿景守护里提的 P3 边界覆盖
- 这不是 feat close；只是 F123 `in-progress` 下的下一刀

### 测试结果
- `pnpm -C packages/web test -- --run src/hooks/__tests__/useChatHistory-replace-hydration.test.ts src/hooks/__tests__/useChatHistory-priority.test.ts src/hooks/__tests__/useChatHistory-thread-switch.test.ts src/hooks/__tests__/useChatHistory-queue.test.ts src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts src/hooks/__tests__/useAgentMessages-stream-catchup.test.ts` → `8 files / 85 tests` 全绿
- `pnpm -C packages/web test -- --run src/hooks/__tests__/useChatHistory-task-progress.test.ts` → `1 failed / 2 tests`
  - 基线核对：这条在 `main` 也同样失败，失败点是 `restores running snapshots into targetCats even when all tasks are completed`
  - 结论：不是这刀引入的新红灯
- `pnpm -C packages/web lint` → 通过，仅仓库既有 warnings
- `pnpm --filter @cat-cafe/web build` → 成功

### 浏览器证据
- 当前 worktree：`/Users/lysander/projects/relay-station/cat-cafe-f123-hydration-reconcile`
- 当前前端：`http://localhost:3103`
- Playwright smoke：`/showcase/f11-review`
  - 结果：`0 errors / 1 warning`
  - 截图：`f123-hydration-smoke-showcase.png`
- 说明：真实 thread 页在隔离端口下会被 runtime API 的跨源限制挡住，因此这次浏览器证据用于证明当前 bundle 能正常拉起，不把它伪装成 hydration 行为证明

### 相关文档
- Discussion: `docs/discussions/2026-03-14-f123-bubble-runtime-followup/README.md`
- 上一刀 review request: `docs/mailbox/2026-03-14-f123-bubble-runtime-correctness-review-request.md`
- Feature: `docs/features/F123-bubble-runtime-correctness.md`
