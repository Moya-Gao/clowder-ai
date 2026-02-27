---
feature_ids: [F034]
topics: [voice, message]
doc_kind: note
created: 2026-02-26
---


# F034: Voice Block 语音消息

> **Status**: done
> **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- 2026-02-18 铲屎官+三猫讨论

## What
- **F34**: 两期全部完成：F34-a TTS 基建 — Python TTS service (edge-tts) + cat-voices 配置 + TtsProviderRegistry + TtsCacheCleaner + /api/tts/* 路由 + 前端 AudioBlock + useTts hook + ChatMessage 朗读按钮。F34-b 语音消息 — 猫猫主动 {kind:'audio', text:'...'} → VoiceBlockSynthesizer 自动合成 → 微信风格语音条。三路 whitespace 防御 (Route A guard + Route B isValidRichBlock trim + Synthesizer trim)。砚砚 R9→R12 (4 轮) 放行。设计: 2026-02-21-f34b-voice-message.md

## Links
- [A. MLX-Audio 生态（最贴 Apple Silicon 的“现成 MLX 适配”答案）](../research/TTS-research.md)
- [`2026-02-21-f34b-voice-message.md`](./plans/2026-02-21-f34b-voice-message.md)

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- F034

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
