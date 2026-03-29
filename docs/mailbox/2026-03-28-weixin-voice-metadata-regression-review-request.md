---
type: review-request
date: 2026-03-28
author: opus
reviewer: codex
---

# Review Request: fix(weixin) — remove voice_item metadata that triggers WeChat rejection

Review-Target-ID: fix-weixin-voice-metadata-regression
Branch: fix/weixin-voice-metadata-regression

## What

Remove `encode_type`, `sample_rate`, `playtime` from `voice_item` in WeChat outbound voice messages. Keep the proper WAV→SILK conversion from PR #839 (extractMonoPcmFromWav + silk-wasm encode).

**Changed files (2):**
- `packages/api/src/infrastructure/connectors/adapters/WeixinAdapter.ts` — voice_item reverted to minimal `{ media: mediaRef }`; removed unused `voiceMeta` variable
- `packages/api/test/weixin-adapter.test.js` — regression test updated to assert metadata fields are NOT sent

## Why

PR #839 added `encode_type: 6, sample_rate: 24000, playtime: <ms>` to voice_item. This caused voice to regress from "1-second fake voice" to **"completely gone"** (5th round verification). Root cause analysis:

1. **Official SDK evidence**: `@tencent-weixin/openclaw-weixin@2.1.1` defines `VoiceItem` type but does NOT implement voice sending at all (only image/video/file). Voice sending via iLink Bot protocol is undocumented.
2. **SILK conversion verified**: Both old (garbage WAV-as-PCM) and new (proper PCM extraction) produce valid `#!SILK_V3` output. The conversion itself is correct.
3. **Metadata triggers rejection**: Before PR #839, minimal voice_item `{ media }` at least produced a 1s fake voice. After adding metadata fields, WeChat silently rejected the message entirely.

## Original Requirements（必填）

> [铲屎官, 5th round verification]: 之前还能收到 1 秒假语音，现在连假语音都收不到了，只收到猫猫头像
> [铲屎官, diagnostic hint]: 我建议你看看飞书那边发的是什么语音文件不是wav以及你可以看看人家官方的sdk里面怎么做的？

- 来源：cross-thread from thread_m (5th round) + 铲屎官直接消息
- **请对照上面的摘录判断：此修复移除了导致 WeChat 拒绝语音的元数据字段，恢复最小可工作的 voice_item 格式**

## Tradeoff

- **放弃了**: 显式指定 encode_type/sample_rate/playtime（看起来更"正确"的做法）
- **为什么**: 官方 SDK 不实现 voice sending，说明这些字段在 bot→user 方向可能不被支持或有不同行为。最小 voice_item 是唯一经过实测证明至少能工作的格式。
- **保留了**: PR #839 的核心改进（extractMonoPcmFromWav + proper PCM→SILK encoding），这确保 SILK 内容是正确的音频数据而非垃圾。

## Open Questions

1. **WeChat auto-detect**: With correct SILK content + minimal voice_item, will WeChat auto-detect duration and play the full audio? (Need 6th round verification by 铲屎官)
2. **Future metadata**: If WeChat opens up official voice sending support, we can re-add metadata. For now, minimal is the safest approach.

## Next Action

请 review 代码变更（2 files, net -1 line）。这是 P1 hotfix，第 5 轮验证语音完全消失。

## 自检证据

### Spec 合规

- P1 voice regression: voice_item metadata removed ✅
- SILK conversion preserved: extractMonoPcmFromWav + encode still used ✅
- Official SDK research: @tencent-weixin/openclaw-weixin@2.1.1 studied ✅

### 测试结果

```
weixin-adapter.test.js + weixin-cdn.test.js: 116 passed, 0 failed
pnpm gate: ✅ GATE PASSED (SHA: fa1d6a3c)
pnpm check: passed (biome)
pnpm lint: passed (tsc)
```

### 相关文档

- PRs: #830 (aes_key fix), #839 (voice metadata — caused regression), #840 (routing fix)
- Feature: F137 WeChat Personal Gateway
