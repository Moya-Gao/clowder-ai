---
type: review-request
author: opus
reviewer: codex
date: 2026-03-29
review-target-id: fix-voice-metadata
branch: feat/voice-metadata-fix
---

# Review Request: fix(weixin) voice_item bits_per_sample — fix 1s fake voice

## What

Added `bits_per_sample: 16` to voice_item metadata alongside `encode_type`, `sample_rate`, `playtime`. Restored `voiceMeta` capture from `convertWavToSilk` result that was removed in PR #844's revert.

Changes (2 files, +21/-13):
- `WeixinAdapter.ts`: Capture `voiceMeta` from SILK conversion; build voice_item with full protocol-spec metadata
- `weixin-adapter.test.js`: Test now asserts all 4 metadata fields present with correct values

## Why

WeChat voice messages show as "1s fake voice" without proper metadata. History:
- PR #839: Added `encode_type: 6, sample_rate: 24000, playtime: <ms>` → voice "completely gone"
- PR #844: Reverted to minimal `{ media }` → voice back to "1s fake"
- **Root cause**: PR #839 was missing `bits_per_sample: 16`, a field present in ALL three SDK type definitions (official @tencent-weixin/openclaw-weixin, @wechatbot/wechatbot, wechat-clawbot). Incomplete metadata caused WeChat to reject the entire message.

## Original Requirements（必填）
> 铲屎官："微信发语音还是不行"（2026-03-29 01:01）
> 铲屎官："我建议你看看飞书那边发的是什么语音文件不是wav以及你可以看看人家官方的sdk里面怎么做的？"（2026-03-28 17:07）
- 来源：Cat Cafe thread 对话（跨线程交接 + 铲屎官直接反馈）
- **请对照上面的摘录判断：voice_item 带完整 SILK 元数据后，WeChat 能否正常播放语音**

## Tradeoff

- 如果完整 metadata 仍导致 "completely gone"，fallback 是只发 `playtime` 一个字段（WeChat 只需 duration hint）
- 没有任何社区 SDK 实现过 voice sending——我们是在无参考实现的情况下推导正确格式

## Open Questions

1. **需要铲屎官验收**：完整 metadata 是否解决 "1s fake"——这只能在真实 WeChat 上测试
2. 如果仍然 fail，下一步考虑：只发 `playtime` 不发其他字段；或改为 file_item 方式发送

## Next Action

请 @codex review 代码变更，重点关注：
- voice_item metadata 字段值是否符合 iLink bot protocol spec
- voiceMeta fallback 默认值（sampleRate=24000, durationMs=0）是否合理

Review-Target-ID: fix-voice-metadata
Branch: feat/voice-metadata-fix

## 自检证据

### Spec 合规
Bug fix — 无 formal spec。需求来自铲屎官直接反馈 + 跨线程交接。

### 测试结果
```
node --test weixin-adapter.test.js → 105/105 pass, 0 failed ✅
pnpm check → 0 errors ✅
pnpm lint → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档
- PR #839: voice metadata addition (caused "completely gone")
- PR #844: revert to minimal voice_item (restored "1s fake")
- Official SDK: `@tencent-weixin/openclaw-weixin@2.1.1` — VoiceItem type includes bits_per_sample
