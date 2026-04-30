---
feature_ids: []
related_features: [F117, F175]
doc_type: review_request
status: open
last_updated: 2026-04-30
---

# Review Request: Voice rich-block queued delivery dedupe

Review-Target-ID: fix-voice-delivery-dedup
Branch: fix/voice-delivery-dedup

## What
- `packages/web/src/stores/chatStore.ts`
  - Reuse the existing assistant bubble duplicate detection when `messages_delivered` inserts stored callback messages.
  - Merge stored callback delivery into an existing stream/rich-block placeholder when both share the same cat and invocation id.
  - Preserve callback content, callback origin, deliveredAt, reply metadata, mention metadata, and rich blocks without duplicating the bubble.
  - Count background unread increments only for true inserts, not placeholder merges.
- `packages/web/src/stores/__tests__/chatStore-delivered-mention.test.ts`
  - Add a regression for the voice/audio rich-block shape: active thread placeholder already has an audio rich block, then queued callback delivery arrives with the same rich block and invocation id.

## Why
`cat-cafe#1492` changed queued callback messages from live `agent_message` broadcast to later `messages_delivered` insertion. `create-rich-block` still emits a live rich-block event first, so voice/audio could already be attached to a stream placeholder. The later stored callback message bypassed `findAssistantDuplicate` / `mergeAssistantBubble`, so the store kept both the placeholder bubble and the delivered callback bubble.

This is visible for voice because audio rich blocks are expected to remain attached to the cat's speech bubble. Other rich blocks may intentionally appear as separate bubbles.

## Original Requirements（必填）
> "你看语音富文本 现在会出现两份。 原本的气泡一份 还会来一个单独的气泡。"
> "之前除了语音富文本其他富文本是会单独气泡 是ok的但是语音这个咋现在也改了行为？"

- 来源：2026-04-30 当前 thread 铲屎官原话和截图；这是 runtime regression report，没有独立 repo discussion 文档。
- 请 reviewer 对照判断：本 patch 是否只恢复 voice/audio rich block 的 queued delivery merge 语义，而不改变其他 rich-block 独立气泡行为。

## Tradeoff
- 采用 store-level merge 修复，而不是改 `AudioBlock` 或禁止 `create-rich-block` live event。
- 好处：修在真正产生重复气泡的队列 delivery 合并点，复用既有 `findAssistantDuplicate` invariant。
- 代价：没有引入新的 `MessageDeliveryService` 前端抽象；本次只把 #1492 漏接的 delivery 路径接回既有 merge 规则。

## Open Questions
- `messages_delivered` merge 时把最终 id 改为 stored server message id，是否符合你对 hydration / history authoritative id 的判断？
- 这次将 background unread count 限定为 true insert，不把 placeholder merge 计入 unread。请重点看这是否会影响 background thread 的队列提醒语义。
- 我没有扩大到 “所有 rich blocks 必须贴回文本泡”；当前 merge 条件仍是 same assistant cat + same invocation id。

## Next Action
请 review this PR，重点看：
1. 同 invocation 的 placeholder merge 是否足够窄，不会误吞普通独立富文本气泡。
2. mention notification / unread count 在 insert 与 merge 两条路径上是否仍正确。
3. 是否还需要把 voice/audio 的期望形态补成更靠近 hook/UI 层的回归。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-voice-delivery-dedup/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Root cause：#1492 的 `messages_delivered` 手动 push 服务器 callback message，绕开了现有 assistant duplicate merge。
- Fix scope：只改 `markMessagesDelivered` 的 serverMessages 插入/合并路径和 `mergeAssistantBubble` metadata merge。
- 根目录工件闸门：工作树和 committed diff 均无根目录媒体/设计工件。
- Fallback layer guard：`node scripts/check-fallback-layers.mjs` -> `No fallback pattern changes detected.`

### 测试结果
- `NODE_ENV=test pnpm --dir packages/web exec vitest run src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts src/stores/__tests__/chatStore-delivered-mention.test.ts src/stores/__tests__/chatStore-queue.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/hooks/__tests__/useAgentMessages-background-system-info-web-search.test.ts`
  - 5 files passed, 89 tests passed.
- `pnpm --dir packages/web exec tsc --noEmit`
  - passed.
- `pnpm check`
  - passed.

### 相关文档
- Source regression report: current thread, 2026-04-30.
- Related delivery invariants: F117 / F175.
