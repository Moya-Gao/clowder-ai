# Review Request: current-thread queue processing hydrate for single-slot cancel

Review-Target-ID: fix-single-slot-cancel-visibility-queue-hydrate
Branch: fix/single-slot-cancel-visibility-queue-hydrate

## What
- 在 `packages/web/src/hooks/useSocket.ts` 的 `queue_updated(action='processing')` 链上补 current-thread `/queue` reconcile：
  - 先保留现有 `setThreadHasActiveInvocation(true)` 粗粒度 marker
  - 如果事件属于当前 thread，再立刻 `reconcileThreadWithServer(..., 'QueueProcessing')`
- 补一条回归测试，锁住“`intent_mode` 丢了，但 `/queue` 已经在 processing”时必须 hydrate 单 slot truth
- 顺手把 3 个 `useSocket*` hook 测试里的 `node:events` 改成 `events`，恢复当前 vitest/jsdom 环境下的可执行性

## Why
- 这次现场不是 `#1310` 那条“queue 已空但 UI 还像在跑”，也不是 `#1329` 那条“单 slot 在，但 `intentMode` 为空时顶部 cancel 被 gate 掉”
- 新现场是：**当前 thread 已经收到 `queue_updated(processing)`，但 flat state 只有 `hasActiveInvocation=true`，没有 slot truth**
- 结果就是：
  - 服务端已经真的在跑
  - 顶部单猫 cancel 依赖的 `activeInvocations/targetCats` 还没 hydrate
  - 用户看到“猫被叫起来了”，但顶部 cancel 还是没有

## Original Requirements（必填）
> `我现在已经更新到最新了 但是 thread_mo82r0fs6hcwfoqy 你看这个布偶猫at你之后 cancel还是没有`
> `那你直接开始定位，负责这个bug的闭环？... 重要的bug定位记得写清楚代码的comments？以及检查是不是有comments是过时的`
- 来源：`docs/bug-report/2026-04-21-gpt52-live-invocation-stuck-after-cancel/bug-report.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 代价是：当前 thread 每次收到 `queue_updated(processing)` 会额外打一次 `/api/threads/:id/queue`
- 我把范围压到只对 **当前 thread** 生效；background thread 仍保持原行为，不把这笔额外 fetch 扩散到所有 queue 事件
- 这不是试图从 UI 端猜 slot，而是直接向 server truth 要一份最小 reconcile，避免继续在 `intent_mode` 丢失时挂半状态

## Open Questions
- reviewer 请重点看：`queue_updated(processing)` 时立刻 fetch `/queue` 这个代价/收益是否合理，是否还需要更窄 gate
- reviewer 也请留意：现有还有没有别的 current-thread processing 入口，会落到“只写 coarse marker、不 hydrate slot truth”的同类半状态

## Next Action
- 请 review 这次 current-thread queue-hydrate 的边界是否够窄、注释是否准确不过时、回归测试是否真正锁住了现场问题

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-single-slot-cancel-visibility-queue-hydrate/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- runtime 现场已确认 `#1329` 在 runtime 内生效，但 thread `thread_mo82r0fs6hcwfoqy` 仍出现“被叫起来了但顶部 cancel 不亮”
- 根因已经从现场收窄到：
  - `queue_updated(processing)` 确实到了
  - current-thread flat state 只被写成 `hasActiveInvocation=true`
  - 没有同步 hydrate `activeInvocations/targetCats`
- 这次在 `queue_updated` 旁边补了 WHY 注释，明确说明：
  - 为什么单靠 coarse marker 不够
  - 为什么 current-thread 需要立刻用 `/queue` 补 slot truth
  - 不再保留旧的“只恢复 active marker 就够”过时注释
- 根目录工件闸门：
  - `git status --short | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → empty
  - `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → empty

### 测试结果
- `node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts`  # 23 passed, 0 failed
- `node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts src/hooks/__tests__/useSocket-stale-watchdog.test.ts src/hooks/__tests__/useSocket-reconnect-catchup.test.ts src/components/__tests__/chat-container-intent-loading.test.ts`  # 38 passed, 0 failed
- `pnpm gate`  # passed on rebased HEAD `f6ecafff`

### 相关文档
- Bug report: `docs/bug-report/2026-04-21-gpt52-live-invocation-stuck-after-cancel/bug-report.md`
- Feature context: `docs/features/F122-unified-dispatch-queue.md`
- Reliability plan: `docs/plans/2026-03-14-f122-phase-a-reliability.md`
