# Review Request: F088 Telegram stream race fix

Review-Target-ID: f088-telegram-race
Branch: fix/f088-telegram-race

## What

修 `StreamingOutboundHook` 的两条竞态：

- `onStreamChunk` 早于 `sendPlaceholder` resolve 时，缓存最新 accumulated text，placeholder 建好后强制 replay 一次，降低“有概率才流式”。
- `onStreamEnd` 已因 5s start timeout 先走 fallback delivery 时，记录 ended-before-start tombstone；如果 placeholder 后到，先保留为 fallback，只有 `cleanupPlaceholders` 确认 fallback delivery 成功后才按 adapter 能力清理/完成，不再注册给下一次 delivery。
- late-start cleanup state 不再用 60s timer GC；调用者的 late-success cleanup 没有上限，状态必须保留到真实 `cleanupPlaceholders` 到达。若 `onStreamStart` 最终没有创建任何 placeholder，则直接清掉 tombstone。

新增四条回归测试直接覆盖这些时序。

## Why

我们之前只按 PR/CI/ledger 判断 F088 Telegram 闭环，社区真实反馈证明行为未闭环：还是两条消息，流式概率性。根因不是 K1/K2/K3 的静态同步状态，而是 `sendPlaceholder` 慢于 chunk/end 时，hook 没有跨 start/chunk/end 保存状态。

## Original Requirements（必填）

> 确实修了部分，至少能用了。还是发两条，还是一样发两条，但是有概率流式 -> 社区小伙伴的反馈

- 来源：当前 thread `0001778210597512-000146-dc7ffc09`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

没有把 Telegram 改成单独的 `ownsFinalDelivery + skipConnectorIds` 所有权模型；那会扩散到 `OutboundDeliveryHook`、`QueueProcessor`、`ConnectorInvokeTrigger` 三条调用链。这里选择在 `StreamingOutboundHook` 内修坐标系：start/chunk/end 的时序状态由 hook 自己持有，调用者仍保留现有 fallback delivery 行为。

`sendPlaceholder` 超过 5s 时仍可能不展示实时流式；这时正确行为是最终 fallback 只发一条，并删除迟到 placeholder。要把“超过 5s 也强保证流式”做成目标，需要重新设计调用者 timeout/外部 Bot API SLA，不放进这次 bugfix。

## Architecture Ownership（必填）

Architecture cell: transport
Map delta: none
Why: 只修现有 connector streaming hook 的时序状态，不新建 Store / Queue / Router / Adapter / Dispatcher / Binding。

请 reviewer 检查：

- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

- P1：`endedBeforeStart` tombstone 是否正确覆盖 “deliver fallback 已赢，placeholder 后到” 的 Telegram 两条消息路径。
- P1：pending chunk replay 是否会绕过正常 rate limit 造成过度编辑；当前只在 placeholder 刚创建时 force 一次，用的是最新 accumulated text。
- P2：fallback-layer check 仍触发自检，当前为 `+4 -3 (net +1)`；请确认这是合理的 adapter 能力降级 / 时序坐标修正，不是继续堆错坐标系。

## Next Action

请 review `StreamingOutboundHook` 的状态机和新增回归测试；若放行，下一步走 merge-gate，然后需要同步到 clowder-ai 并重新通知社区。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f088-telegram-race/sonnet`
- Start Command: `pnpm review:start`（本次后端 hook review，不需要启动前端）
- Ports: N/A（backend-only；禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规

- 原始反馈“两条消息”：新增 `cleans up a late placeholder when stream end already timed out before sendPlaceholder resolves`，当前通过。
- 云端 P1：新增 `preserves a late placeholder until cleanup confirms fallback delivery success`，确认 delivery 失败路径不会丢 fallback placeholder，当前通过。
- 云端 P2：新增 `keeps late-placeholder cleanup state until cleanup even after tombstone ttl elapses`，确认慢 fallback 成功后仍能清理迟到 placeholder，当前通过。
- 原始反馈“有概率流式”：新增 `replays the latest chunk when chunks arrive before sendPlaceholder resolves`，当前通过。
- 代码落点：`packages/api/src/infrastructure/connectors/StreamingOutboundHook.ts`
- 测试落点：`packages/api/test/streaming-outbound-hook.test.js`

### 测试结果

- `pnpm --dir packages/api run build` → pass
- `pnpm --dir packages/api run lint` → pass
- `pnpm biome check packages/api/src/infrastructure/connectors/StreamingOutboundHook.ts packages/api/test/streaming-outbound-hook.test.js --diagnostic-level=error` → pass
- `node --test packages/api/test/streaming-outbound-hook.test.js` → 22 pass, 0 fail
- `node --test packages/api/test/web-outbound-delivery.test.js packages/api/test/telegram-adapter.test.js packages/api/test/outbound-delivery-hook.test.js packages/api/test/connector-phase-b4-integration.test.js packages/api/test/connector-invoke-trigger.test.js packages/api/test/queue-processor.test.js` → 244 pass, 0 fail
- `node scripts/check-hotfix-pattern.mjs` → hotfix=false
- `node scripts/check-fallback-layers.mjs` → `StreamingOutboundHook.ts: +4 -3 (net +1) [total=18]`; self-check triggered because refactor adds/replaces fallback-like guards
- `pnpm check:architecture-ownership` → exit 0; 23 existing in-progress feature warnings, no code anchor / Architecture cell declaration errors from this PR
- `pnpm gate --no-rebase --skip-install` → latest-main build/test/lint reached full web suite; gate hygiene fixes included for unrelated main/test fragility noted below
- Artifact hygiene: root media/design gate empty

### Known Gate Note

This branch includes two unrelated gate hygiene fixes:

- `packages/api/test/system-prompt-builder.test.js`: formatting-only; current `origin/main` (`762e2b287`) fails `pnpm check` on this file.
- `packages/web/src/components/ThreadSidebar/__tests__/thread-sidebar-organize-flow.test.tsx`: test-only wait hardening; full-suite web test consistently raced before `ThreadOrganizerModal` applied `initialSuggestions`, while isolated test passed.

Neither changes Telegram runtime behavior.

### 相关文档

- Plan: `docs/plans/2026-03-10-f088-phase-b-commands-and-phase-4-streaming.md`
- Prior review request: `docs/mailbox/2026-05-06-f088-k1-telegram-dedup-review-request.md`
