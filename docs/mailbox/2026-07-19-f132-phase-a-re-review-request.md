# Review Request: F132 Phase A — DingTalk Adapter (Re-review)

Review-Target-ID: f132
Branch: feat/f132-phase-a-dingtalk

## What
DingTalkAdapter implementing F132 Phase A: Stream mode inbound, oToMessages/batchSend outbound, AI Card streaming, media download/upload. This is a re-review after addressing all 3 P1 + 1 P2 findings from the first review.

## Why
F132 adds DingTalk + WeCom chat gateways. Phase A covers DingTalk only. Must reuse F088 public layer with zero changes.

## Original Requirements（必填）
> "立项吧。DingTalk + 企业微信。必须复用我们的 channel 等等架构设计。学飞书集成的经验。参考 OpenClaw。"
- 来源：铲屎官在 F132 立项讨论中的直接指示
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Changes Since First Review

### P1-1 (richText format) — FIXED
- **Root cause**: Used `body.richText.richTextList` (nested). DingTalk Stream FAQ confirms `body.richText` is a flat array.
- **Fix**: `Array.isArray(body.richText)`, also extracts embedded picture downloadCode from richText nodes.
- **Evidence**: DingTalk Stream FAQ Q8 example shows `"richText": [{...}, {...}]`.

### P1-2 (outbound target ID) — FIXED
- **Root cause**: `chatId` was `conversationId`, but `oToMessages/batchSend` requires `senderStaffId` in `userIds`. Error `staffId.notExisted` confirms this.
- **Fix**: `chatId = senderStaffId`. Added `conversationId` as separate field for AI Card delivery routing.
- **Evidence**: DingTalk Apifox spec: `userIds: 接收机器人消息的用户的userId列表`, error code `staffId.notExisted`.

### P1-3 (AC-A5 media) — FIXED
- **Root cause**: `sendMedia` was text-URL fallback only; no download capability.
- **Fix**: Added `downloadMedia(downloadCode)` → `POST /v1.0/robot/messageFiles/download`. Added `sendDingTalkImageMessage` → `msgKey: sampleImageMsg`. Audio/file still text-link fallback (DingTalk robot API has no audio/file msgKey).
- **Evidence**: DingTalk Apifox `/v1.0/robot/messageFiles/download` spec.

### P2 (ACK messageId guard) — FIXED
- **Fix**: `if (messageId) client.socketCallBackResponse(messageId, EventAck.SUCCESS)`.

## Open Questions
1. Audio/file outbound: DingTalk robot API only has `sampleImageMsg` for images. Audio/file still use text-link fallback. Is this acceptable for Phase A, or should we use a different API path?
2. `sessionWebhook` alternative: Research shows DingTalk also supports replying via the callback's `sessionWebhook` URL (no AccessToken needed, but expires). Should we consider this as primary reply path?

## Next Action
Re-review the fixes, especially P1-1/P1-2/P1-3 root cause analysis and fixes. If satisfied, approve for merge-gate.

## 自检证据

### Spec 合规
- AC-A1 ✅ DM text + richText (flat array) + picture/audio/file parsing
- AC-A2 ✅ Text + markdown sending via oToMessages/batchSend
- AC-A3 ✅ AI Card with cat name header + body + deep link + fallback
- AC-A4 ✅ AI Card streaming (create → 300ms throttled update → finish)
- AC-A5 ✅ Image download (downloadCode→URL) + image send (sampleImageMsg). Audio/file partial.
- AC-A6 ✅ Public layer zero change (ConnectorRouter/CommandLayer/BindingStore untouched)
- AC-A7 ✅ Stream connection + ACK with messageId guard

### 测试结果
```
node --test packages/api/test/dingtalk-adapter.test.js  # 33 passed, 0 failed
node --test packages/api/test/connector-*.test.js       # 196 passed, 0 failed (regression)
pnpm build                                              # success
```

### 相关文档
- Feature: `docs/features/F132-dingtalk-wecom-gateway.md`
- Research: `docs/research/2026-03-22-dingtalk-wecom-gateway-gpt-pro-consult.md`
- Comparison: `docs/features/assets/F132/platform-capability-comparison.md`
