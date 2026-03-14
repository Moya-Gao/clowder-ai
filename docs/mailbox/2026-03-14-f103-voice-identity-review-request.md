# Review Request: F103 Per-Cat Voice Identity

## What

让每只猫有独立的 TTS 声线配置，入口统一在 `cat-config.json`（跟头像一样）。

核心改动 3 处：
1. `cat-config-loader.ts` — Zod schema 加 `voiceConfig` 可选字段验证
2. `cat-voices.ts` — `loadVoicesFromJson()` 遍历所有 variants 按 catId 取声线（不再只看 default variant），加 `characterVoiceBaseDir()` 解析相对路径
3. `cat-config.json` — 11 个 variant 各有独立 `voiceConfig`（refAudio/refText/instruct/temperature）

## Why

F101 狼人杀语音模式需要多猫同时发言，当前 TTS 声线按家族区分（布偶猫 3 只共享一个声线），听不出谁在说话。

## Original Requirements（必填）

> "现在参加的猫 8 只的话，布偶猫三只一个声线就有问题了！"
> "做到跟你们头像一样，入口要统一，不要给我丢的到处都是"
> "一群可爱猫猫出来一个大叔！笑死我了 只能选正太！"

- 来源：F103 spec `docs/features/F103-per-cat-voice-identity.md` + 铲屎官 2026-03-11/14 对话
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃了 per-breed 配置方案，改为 per-variant（每只猫独立），复杂度略增但满足需求
- hardcoded defaults 保留为 fallback（向后兼容），优先级：env var > cat-config.json > hardcoded
- dare 声线待选（铲屎官说"下次再说"），暂无 voiceConfig

## Open Questions

1. `loadVoicesFromJson()` 的缓存清理：当前用模块级 `cachedJsonVoices`，热更新 cat-config.json 需重启。是否需要增加缓存失效机制？
2. Qwen3-TTS clone 模式的 `temperature: 0.3` 是全局统一的，是否有猫需要不同值？

## Next Action

请 review 代码质量和架构合理性。重点关注：
- `loadVoicesFromJson()` 遍历逻辑是否正确
- Zod schema 验证是否覆盖所有必要字段
- 相对路径解析安全性

## 自检证据

### Spec 合规

| # | 铲屎官原始需求 | AC 覆盖？ | 实现？ |
|---|---------------|-----------|--------|
| 1 | 布偶猫三只一个声线有问题 | AC-2 | ✅ 11猫独立 voiceConfig |
| 2 | 入口统一不要丢到处都是 | AC-1 | ✅ cat-config.json per-variant |
| 3 | 只能选正太 | KD-5 | ✅ 全员正太音色 |

### 测试结果

```
cat-config + cat-voices tests → 76/76 pass, 0 failed
pnpm check (biome) → 0 errors
pnpm lint → 0 errors (pre-existing warnings only)
pnpm -r --if-present run build → exit 0
```

API 53 failures 均为 Redis isolation + pre-existing（与 F103 无关）。

### 相关文档

- Feature: `docs/features/F103-per-cat-voice-identity.md`
- Branch: `feat/f103-voice-identity`
- Diff: `packages/api/src/config/cat-config-loader.ts`, `packages/api/src/config/cat-voices.ts`, `cat-config.json`
