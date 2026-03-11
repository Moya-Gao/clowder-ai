---
feature_ids: [F034]
related_features: []
topics: [voice, message]
doc_kind: note
created: 2026-02-26
---


# F034: Voice Block 语音消息

> **Status**: done | **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- 2026-02-18 铲屎官+三猫讨论

## What
- **F34**: 两期全部完成：F34-a TTS 基建 — Python TTS service (edge-tts) + cat-voices 配置 + TtsProviderRegistry + TtsCacheCleaner + /api/tts/* 路由 + 前端 AudioBlock + useTts hook + ChatMessage 朗读按钮。F34-b 语音消息 — 猫猫主动 {kind:'audio', text:'...'} → VoiceBlockSynthesizer 自动合成 → 微信风格语音条。三路 whitespace 防御 (Route A guard + Route B isValidRichBlock trim + Synthesizer trim)。砚砚 R9→R12 (4 轮) 放行。设计: 2026-02-21-f34b-voice-message.md

## Acceptance Criteria
- [x] AC-A1: 本文档已补齐模板核心结构（Status/Why/What/Dependencies/Risk/Timeline）。
## Links
- [A. MLX-Audio 生态（最贴 Apple Silicon 的”现成 MLX 适配”答案）](../research/TTS-research.md)
- [`2026-02-21-f34b-voice-message.md`](./plans/2026-02-21-f34b-voice-message.md)
- **Evolved to**: [F066 Voice Pipeline Upgrade](F066-voice-pipeline-upgrade.md) — 本地 TTS + 流式合成 + 播放队列

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- **Related**: 无
- F034

## Risk
| 风险 | 缓解 |
|------|------|
| 历史文档口径与当前实现可能漂移 | 在 F094 批次里持续复跑审计脚本并按批次回填 |
## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
