# Review Request: F066 Qwen3-TTS Base clone TtsAdapter

## What
Implement Qwen3-TTS Base clone mode as a proper TtsAdapter, completing the E-type unified voice pipeline for all three cats. Changes span Python TTS server + TypeScript API layer.

Key changes:
- `Qwen3CloneAdapter` (Python): new TtsAdapter using `ref_audio`/`ref_text`/`instruct` for voice cloning
- `VoiceConfig`/`TtsSynthesizeRequest` extended with `refAudio`, `refText`, `instruct`, `temperature`
- `cat-voices.ts`: E-type defaults — 宪宪→流浪者, 砚砚→魈, 烁烁→班尼特
- `MlxAudioTtsProvider.ts`: passes clone params through HTTP body
- `tts.ts` route: clone params included in cache hash + synthesize passthrough

## Why
F066 voice pipeline upgrade: replace Kokoro-82M voices with Qwen3-TTS Base zero-shot clone using Genshin character reference audio. E-type unified scheme = all three cats on one engine, one pipeline, consistent quality with mixed Chinese/English support.

## Original Requirements（必填）
> 铲屎官: "记得要做 TtsAdapter 不是写死！我迫不及待听大猫猫们聊天了！开worktree！"
> 铲屎官: "牛逼！是我要的了！真的比这个好多了！甚至你都能当了流浪者哈哈哈"
> 铲屎官: "Qwen3 不是有参考语音的 clone 功能吗？我们试试用他！"
- 来源：Cat Café thread, 2026-03-09 对话
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **D-type (混合 Qwen3+GPT-SoVITS) 被放弃**：GPT-SoVITS 英文处理极弱（"P1"→"Pone"），结构性缺陷
- **VoiceDesign 模式被放弃**：9 轮抽卡不稳定（声线/性别随机），clone 模式确定性更高
- **clone params 通过 VoiceConfig 传递而非单独配置**：简化架构，每猫声线完整定义在一处

## Open Questions
1. `GENSHIN_VOICE_DIR` 默认路径 `~/projects/relay-station/GPT-SoVITS/character-models/genshin/` — 是否需要更通用的默认路径？
2. Python `Qwen3CloneAdapter.synthesize()` 的 `temperature` 默认值是 0.3（和试听一致），是否合理？
3. `tts.ts` route 的 cache hash 是否需要包含 `refText`？目前只包含 `refAudio` + `instruct` + `temperature`

## Next Action
请 review 代码质量、安全性、架构合理性。

## 自检证据

### Spec 合规
- 铲屎官原始需求：TtsAdapter 模式 ✅ | E-type 统一方案 ✅ | 三猫角色声纹 ✅
- 25 TTS tests pass, 0 fail
- TypeScript build clean (tsc exit 0)
- Biome: 0 new issues (4 pre-existing infos)

### 测试结果
```
node --test (25 TTS tests) → 25/25 pass, 0 fail ✅
pnpm lint → 0 errors ✅
pnpm --filter @cat-cafe/shared build → exit 0 ✅
pnpm --filter @cat-cafe/api tsc → exit 0 ✅
```

### 相关文档
- Feature: F066 / `docs/features/F066-voice-pipeline-upgrade.md`
- Voice Audition: `docs/stories/voice-audition/README.md`
- Commit: `5e24b685` on `feat/f066-voice-clone`
