---
type: review-request
date: 2026-03-30
author: opus
reviewer: codex
branch: feat/voice-experiments
review-target-id: voice-experiments
---

# Review Request: WeChat voice playtime-sec + SILK end-of-stream marker

## What

Two additive experiments to fix WeChat voice playback (shows correct duration but won't play):

1. **`playtime-sec` mode**: New A/B test mode that sends `playtime` in seconds (not ms). Hypothesis: WeChat native client may use seconds, and our 11280ms value is misinterpreted.

2. **SILK end-of-stream marker**: Appends `0xFFFF` (standard SILK v3 terminator) to silk-wasm output. silk-wasm omits this, but WeChat's decoder may require it for proper playback.

Changed files:
- `packages/api/src/infrastructure/connectors/adapters/WeixinAdapter.ts` — added `playtime-sec` branch in voice_item construction + SILK EOS marker in `convertWavToSilk`
- `packages/api/test/weixin-adapter.test.js` — added test for `playtime-sec` mode

## Why

WeChat voice messages have been broken across multiple PRs (#854, #857, #866). Current state:
- `playtime` mode shows correct 11s duration — **breakthrough** — but audio won't play
- `playtime-encode` and `metadata` modes cause voice to "completely disappear" (encode_type is poison)
- GPT-5.4's deep investigation concluded the issue is in SILK payload compatibility, not voice_item fields
- Binary analysis of silk-wasm output confirmed: valid SILK structure but missing end-of-stream marker

## Original Requirements（必填）
> 铲屎官 03:49: "你们这次更新完 哈哈哈语音消息都没看到了"
> 铲屎官 22:11: "@opus 好像快成功了" (screenshot: 11s duration displays, but won't play)
> 铲屎官 23:46: "你查查看runtime的配置 我更新完成后 语音都没了！"
- 来源：本轮对话直接消息
- **请对照上面的摘录判断：铲屎官需要语音消息能正常显示且能播放**

## Tradeoff

- 两个实验同时上线（SILK marker对所有模式生效 + playtime-sec 需要手动切 env）。考虑过分开 PR，但它们互补且低风险——SILK marker 是 spec-compliant 的追加字节，playtime-sec 是 opt-in env 切换。
- 没有做 "捕获入站 SILK 做二进制对比" 的方案（更复杂），先试这两个低成本假设。

## Open Questions

1. **SILK EOS marker 是否足以修复播放**：这是最可能的根因（silk-wasm 缺失标准终止符），但需要铲屎官实测确认。
2. **playtime 单位到底是 ms 还是 s**：`playtime` mode 显示 11s 对应 11280ms，如果 WeChat 预期秒则应显示 11280s（显然不对），所以 ms 可能是对的。但 playtime-sec 仍值得测试排除。
3. 如果两个实验都失败，下一步是捕获入站 WeChat 原生 SILK 做逐字节对比。

## Next Action

请 @codex review 代码变更，确认：
- playtime-sec 分支逻辑正确（ms→s 转换）
- SILK EOS marker 追加位置正确（encode 后、writeFile 前）
- 测试覆盖充分

Review-Target-ID: voice-experiments
Branch: feat/voice-experiments

## 自检证据

### Spec 合规
- Gate passed: SHA 2afacd1e, branch feat/voice-experiments
- Biome check: passed
- TypeScript: `tsc --noEmit` clean

### 测试结果
```
pnpm --filter @cat-cafe/api exec node --test test/weixin-adapter.test.js
# tests 109, pass 109, fail 0

pnpm gate
# ✅ GATE PASSED (SHA 2afacd1e, tests all passed, lint passed, check passed)
```

### 相关文档
- PRs: #854, #857, #866 (prior voice fix iterations)
- No formal feature doc (bug fix / experiment)
