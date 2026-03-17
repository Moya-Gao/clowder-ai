---
feature_ids: [F111]
related_features: [F066, F034, F021]
topics: [voice, tts, streaming, chunker, latency]
doc_kind: spec
created: 2026-03-12
---

# F111: Streaming TTS Chunker — 流式分句合成管线

> **Status**: spec | **Owner**: 金渐层 (OpenCode, claude-opus-4-6) | **Priority**: P1

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
   - 新增端点：`/api/tts/stream`（SSE，前端用 `fetch` + `ReadableStream` 消费）
   - 鉴权：不用浏览器原生 `EventSource`（不支持自定义 header），改用 `fetch` + `ReadableStream` 读取 SSE 流，保留现有 `X-Cat-Cafe-User` header 鉴权链路，无需引入 token/query 鉴权
   - 前端逐段接收 audio chunk（Base64 编码）→ 解码 → 逐段播放
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
| ~~WebSocket 复杂度高于 SSE~~ | **已决**：选 SSE（单向足够，复杂度低） |
| Qwen3-TTS mlx-audio SDK 不支持流式 generate | 三路可选：A) vLLM-Omni serving（真流式）B) KV-cache 手动 step（社区方案）C) Node 层分段调用全量合成（伪流式，最简单） |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 流式协议用 WebSocket 还是 SSE？ | ✅ **已决：SSE**（前端用 `fetch` + `ReadableStream` 消费，非 `EventSource`）。单向推送足够（后端→前端），复杂度远低于 WebSocket，我们有实时推送经验（socket.io 广播）。Binary chunk 用 Base64 编码，每 chunk 0.6-3s 音频约 20-100KB，overhead 可接受。社区主流方案（CloudWells、vLLM-Omni Gradio）也用 HTTP chunked streaming。鉴权方案：`fetch` 保留自定义 header（`X-Cat-Cafe-User`），无需 `EventSource` 的 token/query 折衷。决策者：金渐层 (2026-03-16) |
| OQ-2 | Qwen3-TTS 是否原生支持 streaming output？ | ✅ **已决：模型原生支持，但 mlx-audio SDK 的 `generate_audio()` 不支持**。Qwen3-TTS 论文明确 "dual-track LM for real-time synthesis"，12Hz tokenizer 首包 97ms。但官方 `qwen-tts` SDK 和 `mlx-audio` 的 generate 方法返回完整 waveform。社区方案：KV-cache step-by-step（CloudWells/qwen3-tts-realtime-streaming），vLLM-Omni `/v1/audio/speech/stream` 端点。实施路径：先 C（Node 层 Chunker 分段调用全量合成，伪流式）快速验证体验；**退出条件：若 C 达不到 AC-A1（首发 < 2s）或 AC-A2（延迟降 50%+），直接切方案 A（vLLM-Omni 真流式）**；B（KV-cache 手动 step）保留为研究备胎，不作为主线。决策者：金渐层 (2026-03-16) |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Evolved from** | `docs/features/F066-voice-pipeline-upgrade.md` | Phase 2 原始设计 |
| **Reference** | `docs/features/F054-hci-preheat-infra.md` | AIRI tts-chunker 参考架构 |
| **Research** | `docs/research/TTS-research.md` | TTS 技术调研 |
