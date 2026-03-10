---
capsule_id: "F066-2026-03-09"
context: "F066 Voice Pipeline Upgrade — 本地 TTS 基础设施从 edge-tts 迁移到 Qwen3-TTS Base clone"
feature_ids: [F066]
doc_kind: capsule
created: 2026-03-09
---

## What Worked
- **Adapter 模式决策正确**：Python 侧 `TtsAdapter` ABC 让引擎切换（edge-tts → Kokoro → Qwen3 clone）零阻力，铲屎官原话"不要写死"省了后面三次换引擎的重构成本
- **试听驱动选型**：不纸上对比参数，直接生成 wav 让铲屎官听。Kokoro 14 wav → Qwen3 VoiceDesign 45 wav → GPT-SoVITS 81 wav → Qwen3 clone 45 wav，铲屎官秒拍板
- **E 型统一方案收敛快**：铲屎官灵感"Qwen3 不是有 clone 功能吗？"直接终结了 D 型混合方案（Qwen3+GPT-SoVITS）的复杂度
- **review 循环高效**：缅因猫 R1→R3 三轮，5 findings 全修，第三轮 0 P1/P2 放行
- **踩坑心得写进 spec**：8 条调试经验直接沉淀到 F066 文档，不是散落在聊天记录里

## What Failed
- **Kokoro 质量评估过于乐观**：TTS 调研阶段看参数觉得 82M 够用，实际试听才发现"五年前机器朗读水平"——轻量模型对中文的品质落差被低估
- **VoiceDesign 当生产方案**：连续 9 轮试听仍不收敛，本质是 zero-shot sampling 的高 variance，不适合需要确定性声线的生产环境
- **clone 超时未预估**：Qwen3 clone 合成速度（~35s/200字）比 Kokoro（~3s）慢 10x+，直到铲屎官实测"坏猫计划"才暴露 30s 超时问题
- **VoiceBlockSynthesizer 透传遗漏**：clone 参数（refAudio/refText/instruct/temperature）在 provider 层可用但 VoiceBlockSynthesizer 层丢弃，多层透传链路每层都需要逐一确认
- **cache key 漏字段**：refText 未加入 hash，code review 才发现。新参数引入时应该全局搜索 hash/cache/key 计算点

## Trigger Missed
- **应该在换引擎时就做 timeout 评估**：从 Kokoro → Qwen3 clone 是 10x 性能差异，应该在集成时就重新评估 timeout 而不是等生产失败
- **应该在 VoiceBlockSynthesizer 改动时搜索所有调用路径**：知道加了 clone 参数，应该主动搜 `synthesize(` 的所有调用方确认透传，而不是只改 provider 层
- **F086 触发器 E "新领域侦查"**：voice clone 是全新领域，应该先搜 `docs/research/` 和 `docs/decisions/` 看有没有前人经验（实际上 TTS-research.md 有但没仔细读 clone 部分）

## Doc Links
- [F066 spec](../features/F066-voice-pipeline-upgrade.md) — 含完整踩坑复盘 8 条
- [TTS 选型调研](../research/TTS-research.md) — MLX-Audio / CosyVoice3 / Piper / MeloTTS
- [Mac M4 TTS 深度调研](../research/2026-03-07-Mac-M4-TTS.md) — GPT-5.4 Pro 出品
- [F034 Voice Block](../features/F034-voice-message.md) — F066 的 Evolved-from 前身

## Rule Update Target
- `MEMORY.md` "F066 技术经验" 区块：补充 clone timeout 教训（新 provider/模式 = 重新评估 timeout）
- `docs/SOP.md` 无需更新（已有"新参数 → 搜索所有 hash 点"的通用规则）
- `shared-rules.md §13 触发器 E`：本次实际触发了但侦查深度不够（读了 TTS-research.md 但跳过了 clone 段落），建议在触发器 E 说明中加"读相关文档时不能跳段"
