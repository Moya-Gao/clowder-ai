---
feature_ids: [F109]
related_features: [F066, F034, F021]
topics: [voice, tts, streaming, chunker, latency]
doc_kind: spec
created: 2026-03-12
---

# F109: Streaming TTS Chunker — 流式分句合成管线

> **Status**: spec | **Owner**: 布偶猫 (Opus 4.6) | **Priority**: P1

## Why

F066 Phase 1 落地了本地 TTS（Qwen3-TTS Base clone），但合成方式是**全文一次性**：VoiceBlockSynthesizer 收到完整 text → 调用 TTS → 等整段合成完 → 返回 audioUrl。对于长文本（>100 字），用户要等 10-30 秒才能听到第一个音节。

铲屎官的核心痛点：**"为什么要等这么久才开始说话？"**

流式分句的思路是：LLM 边生成文字，TTS 边合成语音，前端边收边播。首次发声延迟从"全文合成时长"降到"第一句合成时长"（通常 1-2 秒）。

AIRI 项目的 `tts-chunker.ts` 已验证了这种管线在 TypeScript 中的可行性（F054 调研）。

> Evolved from F066 Phase 2（从 F066 拆分为独立 Feature）

## What

### Phase A: TTS Chunker + Streaming API

1. **TTS Chunker 模块**
   - 接收 LLM 的流式文字输出（SSE / token stream）
   - 硬断点：句号（。.）、问号（？?）、感叹号（！!）、换行 → 立即发送 TTS
   - 软断点：逗号（，,）、顿号（、）、冒号（：:）→ 攒够 4-12 词后发送
   - Boost 机制：前 2 个 segment 降低阈值提前发送（减少首次发声延迟）
   - 中文适配：`Intl.Segmenter` 分词 + 中文标点识别

2. **Streaming Synthesis API**
   - 新增端点：`/api/tts/stream`（WebSocket 或 SSE，Design Gate 时决策）
   - 前端逐段接收 audio chunk → 逐段播放
   - 保持与现有 `/api/tts/synthesize` 的兼容（非流式仍可用）

3. **AudioBlock 升级**
   - 支持流式播放（边接收边播放）
   - 进度条反映真实播放进度（而非下载进度）

## Acceptance Criteria

### Phase A（Streaming Chunker）
- [ ] AC-A1: LLM 流式输出到首次发声延迟 < 2 秒（100 字以上文本）
- [ ] AC-A2: 长文本（>100 字）端到端合成延迟比全文合成降低 50%+
- [ ] AC-A3: 中文标点正确断句（不在词中间断开）
- [ ] AC-A4: 前 2 个 segment 的 Boost 机制生效（可通过日志验证）
- [ ] AC-A5: 非流式合成路径不受影响（回归测试）
- [ ] AC-A6: AudioBlock 流式播放时进度条平滑更新

## Dependencies

- **Evolved from**: F066（Voice Pipeline Upgrade — Phase 2 拆出）
- **Related**: F034（TTS 架构基础 — ITtsProvider / TtsRegistry / VoiceBlockSynthesizer）
- **Related**: F021（Signal Study Mode — R5 播客功能将受益于流式合成）
- **Related**: F054（HCI Preheat Infra — AIRI tts-chunker.ts 参考架构）

## Risk

| 风险 | 缓解 |
|------|------|
| 流式分句对中文分词不准 | `Intl.Segmenter` + 中文标点硬断点双重保障 |
| WebSocket 复杂度高于 SSE | Design Gate 时对比决策；SSE 更简单但单向 |
| Qwen3-TTS 不支持真正的流式输出 | 降级为"分段合成 + 拼接播放"（伪流式），体验仍优于全文等待 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 流式协议用 WebSocket 还是 SSE？ | ⬜ 未定（Design Gate 决策） |
| OQ-2 | Qwen3-TTS 是否原生支持 streaming output？ | ⬜ 需调研 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Evolved from** | `docs/features/F066-voice-pipeline-upgrade.md` | Phase 2 原始设计 |
| **Reference** | `docs/features/F054-hci-preheat-infra.md` | AIRI tts-chunker 参考架构 |
| **Research** | `docs/research/TTS-research.md` | TTS 技术调研 |
