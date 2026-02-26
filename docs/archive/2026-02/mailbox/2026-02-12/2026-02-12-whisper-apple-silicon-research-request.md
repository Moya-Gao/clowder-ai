---
feature_ids: []
topics: [whisper, apple, silicon]
doc_kind: mailbox
created: 2026-02-12
---

# 调研任务: Whisper ASR 迁移 Apple Silicon 原生方案

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-12
**Type**: 技术调研

## What

我们的语音输入功能（Voice Input M1/M2，已合入 main）目前用 **faster-whisper + CPU int8** 跑 Whisper ASR。铲屎官反馈**太慢了**。

当前实现：
- `scripts/whisper-api.py` — FastAPI 服务，POST `/v1/audio/transcriptions`
- `scripts/whisper-server.sh` — 启动脚本，默认 `small` 模型
- 模型加载: `WhisperModel(model, device="cpu", compute_type="int8")`
- 铲屎官机器: **M4 Max** — 有强大的 GPU/Neural Engine 完全没用上

需要调研 Apple Silicon 原生 Whisper 方案，找到最适合我们的替代。

## Why

faster-whisper 底层是 CTranslate2，它的 Metal 支持不成熟。`device="cpu", compute_type="int8"` 完全没利用 M4 Max 的硬件能力。这不是"换个参数"能解决的，需要换推理框架。

## 调研范围

请对比以下方案（不限于此，如果你发现更好的也加进来）：

| 方案 | 说明 |
|------|------|
| **mlx-whisper** | Apple MLX 框架，Python，原生 Metal |
| **whisper.cpp** | C++ 实现，Metal 加速，可通过 Python binding 调用 |
| **WhisperKit** | Swift 原生，Apple 官方推荐 |
| 其他你觉得值得考虑的 | |

每个方案请评估：

1. **性能**: M4 Max 上的实际推理速度（有 benchmark 最好）
2. **模型支持**: 支持哪些 Whisper 模型（small/medium/large-v3/large-v3-turbo）
3. **集成难度**: 我们现有的 API 是 Python FastAPI，换方案要改多少
4. **API 兼容性**: 能否保持 OpenAI 兼容的 `/v1/audio/transcriptions` 接口
5. **依赖复杂度**: 安装/部署是否简单（我们是单机开发环境，不是生产部署）
6. **流式支持**: 是否支持流式转写（我们 F20b 已实现轮询式流式，但原生流式更好）
7. **中文识别质量**: 我们主要用中文，initial_prompt 术语纠正是否仍然可用

## 当前架构（供参考）

```
前端 useVoiceInput.ts
  → 录音 (MediaRecorder, WebM)
  → 每 3s requestData() 发送到 Whisper REST API（流式部分转写）
  → 停止后发送完整音频（最终转写）
  → transcription-corrector 术语纠错
  → 填入 textarea

scripts/whisper-api.py (FastAPI, 端口 9876)
  → POST /v1/audio/transcriptions
  → faster_whisper.WhisperModel.transcribe()
  → vad_filter=True, language="zh"
  → 返回 {"text": "..."}
```

前端不关心后端用什么框架，只要 REST API 接口不变。所以后端可以自由替换推理引擎。

## Tradeoff

当时 M1 MVP 选 faster-whisper 是图快——Python 生态最常见的方案，pip install 就能跑。代价是没利用 Apple Silicon。现在铲屎官日常使用了，性能成了实际痛点。

## Open Questions

1. mlx-whisper 的 `transcribe()` API 和 faster-whisper 差异大吗？能否几乎平替？
2. whisper.cpp 的 Python binding（pywhispercpp）成熟度如何？
3. 有没有方案能同时利用 Neural Engine（不只是 GPU）？
4. large-v3-turbo 在 M4 Max 上用原生方案能跑到什么速度？（相比当前 small + CPU）

## Next Action

请输出一份调研报告，包含：
1. 方案对比表（上述 7 个维度）
2. 推荐方案 + 理由
3. 迁移工作量评估（改哪些文件、大概多少行）
4. 如果有 benchmark 数据就附上

报告放到 `research-report/` 目录。

---

交接五件套自检:
- [x] What: 调研 Apple Silicon 原生 Whisper 方案替代 faster-whisper
- [x] Why: M4 Max 硬件能力完全浪费，铲屎官反馈慢
- [x] Tradeoff: MVP 图快选了 faster-whisper，现在是性能痛点
- [x] Open Questions: mlx 平替度、whisper.cpp binding、Neural Engine、benchmark
- [x] Next Action: 输出对比报告 + 推荐方案 + 迁移评估
