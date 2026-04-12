---
type: review-request
date: 2026-04-12
author: opus
reviewer: codex
branch: fix/weixin-audio-outbound
---

# Review Request: 修复微信语音出站 — audio{text,no url} 静默丢弃

Review-Target-ID: fix-weixin-audio-outbound
Branch: fix/weixin-audio-outbound

## What

OutboundDeliveryHook 新增 `resolveVoiceBlocks` 可注入选项，在出站投递前将 `audio{text, no url}` blocks 补齐 URL（通过 TTS 合成）。补齐失败时降级为文本卡片，不静默丢弃。

改动范围（3 文件）：
- `OutboundDeliveryHook.ts`: +option 定义 +resolve 逻辑 +fallback
- `connector-gateway-bootstrap.ts`: 注入 lazy VoiceBlockSynthesizer
- `outbound-delivery-media-integration.test.js`: +3 test cases

## Why

voiceMode 线程的 route-serial 故意不给 audio blocks 填 URL（让前端走 `/api/tts/stream` 低延迟流式播放）。但同一份 richBlocks 传到 OutboundDeliveryHook 后，Phase 6 要求 `block.url` 存在才发 sendMedia → audio 被静默跳过 → 微信用户永远收不到语音。

铲屎官反馈"这个问题修了 n 次都没修好"。此次三猫独立分析定位到同一根因。

## Original Requirements（必填）

> 猫猫在猫猫咖啡前端发 audio rich block 可以正常播放，但语音没有传到微信端。铲屎官说这个问题修了 n 次都没修好。

- 来源：本 thread 的 multi-mention 比赛题目（铲屎官 + opus 出题）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| 烁烁方案：动态 import VoiceBlockSynthesizer | 简单 | infrastructure→domain 层级违反，难测试，synth=null 无兜底 | ❌ |
| 本方案：option 注入 + fallback | 可测试，层级干净，有兜底 | 多一层间接 | ✅ |
| 在 route 层对 connector 特殊处理 | 源头修复 | 影响前端低延迟播放逻辑，耦合 | ❌ |

## Open Questions

1. **fallback 文案**：unresolved audio 降级为 `{kind:'card', title:'🔊 语音', bodyMarkdown: text}`。微信端渲染为 plaintext `📋 🔊 语音\n{text}`。是否需要更友好的降级方式？
2. **烁烁在 main 上的未提交改动**：需要在 main 上 `git checkout -- packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts` 清理。

## Next Action

请 review 代码正确性 + 边界处理 + 测试覆盖。放行后走 merge-gate。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-weixin-audio-outbound/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规

Bug fix，无正式 spec。三猫独立分析共识作为验收标准：
- ✅ audio{text,no url} + resolver → sendMedia 调用
- ✅ resolver 不可用 → 文本兜底，不静默丢失
- ✅ resolver 异常 → 文本兜底 + warn log
- ✅ 原有 audio{url} 链路无回归

### 测试结果

```
node --test outbound-delivery-hook.test.js + outbound-delivery-media-integration.test.js
→ 40 pass, 0 fail ✅

pnpm lint → 0 errors ✅
pnpm biome check → 0 errors ✅
tsc → exit 0 ✅
```

### 相关文档

- Feature: F137（微信 iLink Bot）、F034（Voice Block）、F066（Voice Pipeline）、F111（Streaming TTS）
- 历史修复: `497cdfa8a fix(weixin): recover DM audio + media_gallery delivery`
