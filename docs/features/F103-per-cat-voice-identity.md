---
feature_ids: [F103]
related_features: [F066, F101]
topics: [voice, tts, identity, cat-config]
doc_kind: spec
created: 2026-03-11
---

# F103: 猫猫独立声线 — Per-Cat Voice Identity

> **Status**: done | **Owner**: opus | **Priority**: P2

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

- [x] AC-1: `cat-config.json` 每个 cat entry 有独立的 voice 配置字段
- [x] AC-2: TTS 合成时按 catId 选择对应声线，同家族不同猫可辨识
- [x] AC-3: 新增猫时可配置声线参数
- [x] AC-4: F101 狼人杀语音模式下多猫发言声线可区分（实战验证：F103 thread 中 11 只猫各自用独立声线发语音，铲屎官确认可区分）

## Dependencies

- **Related**: F066（Voice Pipeline — 当前 TTS 基础设施）
- **Related**: F101（Mode v2 狼人杀 — 语音模式需要声线区分）
- **Config**: `.cat-cafe/cat-catalog.json`（猫猫 roster 运行时配置）

## Voice Assignments（全员选角）

参考音频来源：原神（Genshin Impact）+ 崩铁（Honkai Star Rail）。

| catId | 猫猫 | 角色 | 来源 | instruct 方向 | 状态 |
|-------|------|------|------|---------------|------|
| opus | 布偶猫 4.6 | **流浪者** | 原神 | 调皮狡黠少年 | ✅ 已有 |
| opus-45 | 布偶猫 4.5 | **万叶** | 原神 | 清冷温柔、从容沉稳 | ✅ v3 选定 |
| sonnet | 布偶猫 Sonnet | **帕姆** | 崩铁 | 最可爱！装严肃超快语速 | ✅ v3 选定 |
| codex | 缅因猫 Codex | **魈** | 原神 | 傲娇冰山、表面严厉 | ✅ 已有 |
| gpt52 | 缅因猫 GPT-5.4 | **赛诺** | 原神 | 审判感 + 冷面笑话 | ✅ v1 选定 |
| spark | 缅因猫 Spark | **雷泽** | 原神 | 直接冲、短句快打 | ✅ v1 选定 |
| gemini | 暹罗猫 | **班尼特** | 原神 | 阳光开心少年 | ✅ 已有 |
| gemini25 | 暹罗猫 2.5 | **米卡** | 原神 | 乖巧可爱、温和 | ✅ v2 选定 |
| dare | 狸花猫 | **待选** | — | — | ❓ 下次再说 |
| antigravity | 孟加拉猫 Gemini | **叽米** | 崩铁 | 热血解说偃偶、精力旺盛 | ✅ v1 选定 |
| antig-opus | 孟加拉猫 Opus | **鹿野院平藏** | 原神 | 机敏侦探少年 | ✅ v2 选定 |
| opencode | 金渐层 | **重云** | 原神 | 沉稳靠谱正太、清亮少年音 | ✅ v2 选定 |

## Architecture: 统一入口

铲屎官要求："做到跟你们头像一样，入口要统一，不要给我丢的到处都是"

### 目标（per-catId，跟头像一致）
```
cat-config.json → 每个 variant 有 voiceConfig 字段
cat-voices.ts → 从 config 读 per-catId，hardcoded 仅作 fallback
Hub 设置页 → 可视化管理声线配置（未来）
```

### 改动清单
1. `cat-config-loader.ts` — `catVariantSchema` 加 `voiceConfig` 可选字段
2. `cat-voices.ts` — `loadVoicesFromJson()` 遍历所有 variants 按 catId 取声线
3. `cat-config.json` — 每个 variant 加 `voiceConfig`
4. `VoiceBlockSynthesizer.ts` — 确认已按 catId 调用（已支持）
5. `tts.ts` route — 确认已按 catId 调用（已支持）

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Qwen3-TTS clone 模式区分度 | ✅ 已验证：不同 refAudio 即可区分 |
| OQ-2 | 声线参数 | ✅ 已定：refAudio + refText + instruct + temperature |
| OQ-3 | 帕姆（崩铁）中文语音素材来源 | ⬜ 铲屎官确认 |
| OQ-4 | dare 声线选角 | ⬜ 铲屎官说下次再定 |

## Key Decisions

| # | 决策 | 理由 |
|---|------|------|
| KD-1 | 配置入口统一到 `cat-config.json` per-variant `voiceConfig` | 铲屎官要求跟头像一样统一入口 |
| KD-2 | 参考音频源扩展到原神 + 崩铁 | sonnet 用帕姆（崩铁） |
| KD-3 | `cat-voices.ts` hardcoded 降级为 fallback | 保持向后兼容 |
| KD-4 | antigravity 从彦卿→嘉明→叽米 | 彦卿 CV 偏少女音，Qwen3 clone 出来全是女声；嘉明 clone 也偏女声且带广东腔；叽米（崩铁远程偃偶）clone 效果好 + 辨识度极高 + 喜剧效果拉满，铲屎官亲选 |
| KD-5 | 全员声线选定只能选正太 | 铲屎官铁令："一群可爱猫猫出来一个大叔！笑死我了 只能选正太！" |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-11 | 立项（由 F101 狼人杀语音模式需求衍生） |
| 2026-03-14 | 选角 11/12 完成，antigravity 彦卿→嘉明→叽米（CV 偏女声问题），全员试听选定 preset 版本 |
| 2026-03-14 | 代码层 merged (PR #452) — loadVoicesFromJson + env compat + 18 tests，AC-1/2/3 ✅ |
| 2026-03-15 | 实战验证：11 只猫在 thread 中各自用独立声线发语音消息，AC-4 ✅ |
| 2026-03-15 | **F103 closed** — 愿景守护 by opencode：4/4 AC 全部满足 |
