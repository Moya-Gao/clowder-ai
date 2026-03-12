---
feature_ids: [F103]
related_features: [F066, F101]
topics: [voice, tts, identity, cat-config]
doc_kind: spec
created: 2026-03-11
---

# F103: 猫猫独立声线 — Per-Cat Voice Identity

> **Status**: spec | **Owner**: TBD（铲屎官另派布偶猫） | **Priority**: P2

## Why

铲屎官原话（2026-03-11）：
> "现在参加的猫 8 只的话，布偶猫三只一个声线就有问题了！"

F101 狼人杀需要多猫同时发言（语音模式），当前 TTS 声线是按家族/品种区分的（布偶猫一个声线、缅因猫一个声线、暹罗猫一个声线）。但同家族有多只猫（布偶猫 3 只：Opus 4.6 / Opus 4.5 / Sonnet），如果都用同一个声线，玩家分不清谁在说话。

需要让每只猫都有独立可辨识的声线。

## What

- 每只猫（不是每个家族）都有独立的 TTS 声线配置
- 声线配置在 `cat-config.json` 中关联到每个 catId
- 可配置：新增猫时可以指定声线参数（音色/语速/音调等）
- F066 Voice Pipeline 的 TTS 调用需要按 catId 查声线配置

## Acceptance Criteria

- [ ] AC-1: `cat-config.json` 每个 cat entry 有独立的 voice 配置字段
- [ ] AC-2: TTS 合成时按 catId 选择对应声线，同家族不同猫可辨识
- [ ] AC-3: 新增猫时可配置声线参数
- [ ] AC-4: F101 狼人杀语音模式下多猫发言声线可区分

## Dependencies

- **Related**: F066（Voice Pipeline — 当前 TTS 基础设施）
- **Related**: F101（Mode v2 狼人杀 — 语音模式需要声线区分）
- **Config**: `cat-config.json`（猫猫 roster 配置）

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Qwen3-TTS 支持多少种可区分的声线？是否需要用不同 TTS 模型？ | ⬜ 未定 |
| OQ-2 | 声线参数具体包含哪些（音色/语速/音调/情感）？ | ⬜ 未定 |

## Key Decisions

（待 owner 调研后填充）

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-11 | 立项（由 F101 狼人杀语音模式需求衍生） |
