---
feature_ids: [F138]
topics: [forced-alignment, qwen3, tts, timestamps, mlx]
doc_kind: research
created: 2026-04-05
---

# Qwen3-ForcedAligner 本地集成调研

> 结论：**可用，0.6B 极轻量，MLX 版本可在 M4 Pro 上跑。** 是 Phase 1 对齐层的首选。

## 基本信息

- **模型**: `Qwen/Qwen3-ForcedAligner-0.6B` (Apache-2.0)
- **发布**: 2026-01-29
- **能力**: 文本-语音对齐，输出 word/character 级时间戳，支持 11 种语言（含中文），最长 5 分钟音频
- **精度**: 官方称超过 E2E forced-alignment 模型

## 安装

```bash
# PyPI 包
pip install -U qwen-asr

# 可选：vLLM 后端（更快）
pip install -U qwen-asr[vllm]

# 可选：FlashAttention（加速时间戳推理）
pip install -U flash-attn --no-build-isolation
```

## 用法（Python）

```python
import torch
from qwen_asr import Qwen3ASRModel

model = Qwen3ASRModel.LLM(
    model="Qwen/Qwen3-ASR-1.7B",
    forced_aligner="Qwen/Qwen3-ForcedAligner-0.6B",
    forced_aligner_kwargs=dict(
        dtype=torch.bfloat16,
        device_map="cuda:0",  # 或 "mps" for Apple Silicon
    ),
)

# 对齐：给定音频 + 已知文本 → word timestamps
results = model.transcribe(
    audio=["path_to_audio.wav"],
    language=["Chinese"],
    return_time_stamps=True,
)

for r in results:
    print(r.language, r.text, r.time_stamps)
    # time_stamps = [{"word": "今天", "start": 0.12, "end": 0.45}, ...]
```

## Apple Silicon (MLX)

- `mlx-community/Qwen3-ForcedAligner-0.6B-8bit` — 8-bit 量化版
- `mlx-audio` 库已集成 Qwen3 ASR/ForcedAligner
- 我们的 M4 Pro 上应该无压力（0.6B 模型，8-bit 后约 400MB）

## F138 集成方案

```
CosyVoice 全局配音 → audio.wav
    ↓
Qwen3-ForcedAligner（输入：audio.wav + voice_script 文本）
    ↓
word_timestamps[] → 写入 video-spec.json 的 global_audio.word_timestamps
    ↓
Remotion 消费 word_timestamps 生成 <Sequence> 编排
```

## 备选方案

| 工具 | 优势 | 劣势 |
|------|------|------|
| **WhisperX** (BSD-2) | 生态成熟，21k stars | 2025 后有偏移争议 |
| **MFA** (MIT) | 语言学工具链，兜底 | 集成成本高 |
| **easytranscriber** | PyTorch 原生 FA，快 | 相对新 |

## 来源

- [Qwen3-ForcedAligner-0.6B (HuggingFace)](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B)
- [Qwen3-ASR GitHub](https://github.com/QwenLM/Qwen3-ASR)
- [MLX 8-bit 版本](https://huggingface.co/mlx-community/Qwen3-ForcedAligner-0.6B-8bit)
- [mlx-audio 集成](https://github.com/Blaizzy/mlx-audio/blob/main/mlx_audio/stt/models/qwen3_asr/README.md)
