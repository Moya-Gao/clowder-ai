---
type: review-request
date: 2026-05-12
feature: F195
author: opus-46
reviewer: gpt52
branch: feat/f195-audio-recording
status: pending
---

# Review Request: F195 — 原始录音保存

Review-Target-ID: f195-audio-recording
Branch: feat/f195-audio-recording

## What

TranscriptArtifactStore 新增原始 PCM 录音累积 + ffmpeg 转 MP3 能力。采集过程中每个 chunk 的 PCM 实时写盘，stop 时转为 MP3，录音路径写入 meta.json 并在 MCP stop 结果中返回。

改动 4 文件 / +101 -16 行：
- `transcript_store.py` — `append_pcm()` + `_convert_recording()` + finalize 返回 dict
- `audio-service.py` — `_process_chunk()` 写 PCM + 4 处 finalize 调用适配 dict
- `audio-tools.ts` — MCP stop handler 显示 recording_path
- `test_transcript_store.py` — 3 新测试 + 适配 finalize dict 返回

## Why

铲屎官发现线下会议转写质量差（声音小），需要保存原始录音以便：
1. 事后用更好的模型/参数重新转写
2. 留存会议原始音频做复盘

## Original Requirements（必填）

> 铲屎官原话（2026-05-12 16:50）：
> "你们做了把原始的录音保存下来的能力吗？哈哈哈 今天的会有线上 可以试试转写的效果是不是更好 昨天在会议室 他们说话小了就转写很差"

- 来源：thread 对话（2026-05-12）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择累积 raw PCM + finalize 时 ffmpeg 转 MP3，而非实时 pipe 到 ffmpeg 子进程——简单可靠，避免多进程管理复杂度
- 磁盘开销：raw PCM ~1.9MB/min，30 分钟会议 ~57MB 临时占用，转 MP3 后 ~3MB
- ffmpeg 转换失败时保留 raw PCM 作为 fallback，不丢数据

## Architecture Ownership（必填）

Architecture cell: audio-capture
Map delta: none
Why: 扩展现有 TranscriptArtifactStore 的文件管理职责，不改变 audio-capture cell 边界

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`

## Open Questions

### 技术 OQ（给 reviewer）
1. `append_pcm()` 每次 open+append+close，vs 保持文件句柄打开——当前选择避免句柄泄漏，但频繁 open/close 对 3s/chunk 频率是否有性能顾虑？
2. ffmpeg 转换 timeout=60s 对 2 小时会议（~230MB PCM）是否足够？

### 价值 OQ（给 CVO，如有）
无

## Next Action

请 review 代码正确性、边界处理、安全性。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f195-audio-recording/gpt52`
- Start Command: `pnpm review:start`
- Ports: Python 测试不需要启动服务

## 自检证据

### 测试结果
```
python3 -m pytest test_transcript_store.py test_audio_session_startup.py -v
→ 19 passed in 0.51s ✅
pnpm check (biome) → Checked 2933 files. No fixes applied. ✅
```

### 根目录工件闸门
工作树 + 已提交差异：clean ✅

### 相关文档
- Feature: `docs/features/F195-meeting-copilot-live-advisory.md`
- Phase D plan: `docs/plans/2026-05-12-f195-phase-d-transcript-persistence.md`
