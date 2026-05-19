---
feature_ids: [F195]
topics: [asr, speech-recognition, meeting-transcription, quality]
doc_kind: research
created: 2026-05-19
---

# 2026 ASR 转写质量提升调研：Meeting Copilot 语音转写优化方案

**From**: 布偶猫 宪宪  
**To**: 铲屎官  
**Date**: 2026-05-19  
**Context**: F195 Meeting Copilot 实际使用后，铲屎官反馈"语音转写质量太烂了"  

---

## 0. 结论（60 秒版）

我们的 ASR 模型选型（Qwen3-ASR 1.7B）其实不差——它在中文 WER 上打赢 Whisper large-v3。
**问题不在模型，在管道**：3s 固定切片无 VAD、无后处理、无热词注入、无说话人分离。

**推荐落地顺序**：

| 优先级 | 改动 | 预期提升 | 工作量 |
|--------|------|----------|--------|
| P0 | VAD 驱动切片（替换 3s 固定） | 消除断句/截断/静音幻觉 | 1-2 天 |
| P0 | MLX 原生推理（替换当前 PyTorch） | 3-5x 加速，相同质量 | 1 天 |
| P1 | 热词表注入（参会者名/项目术语） | 专有名词准确率大幅提升 | 0.5 天 |
| P1 | 标点恢复 + 格式化 | 可读性从"流水账"→"像文字" | 0.5-1 天 |
| P2 | LLM 后修正（已有 F20e 基础） | 语义纠错、上下文修复 | 1 天 |
| P2 | 说话人分离（Diarization） | 区分"谁在说" | 1-2 天 |
| P3 | 升级到 7B 模型 | 更强准确率（但需评估实时性） | spike |

---

## 1. 现状诊断：为什么"质量太烂"

### 1.1 当前配置（audio-service.py）

```
ASR 模型: Qwen3-ASR 1.7B（通过 ASR_URL=localhost:9876 调用）
切片策略: 固定 3s（DEFAULT_CHUNK_SEC = 3.0）
采样率: 16kHz mono
重叠: 无
后处理: 无（无标点恢复、无 LLM 纠错、无热词表）
说话人分离: 无
VAD: 无
```

### 1.2 根因分析

| 问题 | 根因 | 影响 |
|------|------|------|
| 断句奇怪 | 3s 固定切片切在词中间 | 同一句话被割裂，ASR 缺少上下文 |
| 静音段乱输出 | 无 VAD，静音也送 ASR | 幻觉文本（模型对静音"脑补"内容） |
| 专有名词错误 | 无热词注入 | "宪宪"→"现现"、项目名全错 |
| 没有标点 | 无后处理 | 输出是一串连续文字，不可读 |
| 分不清谁在说 | 无 Diarization | 所有内容混在一起 |

**关键洞察**：模型本身不是瓶颈。Qwen3-ASR 1.7B 在 WenetSpeech 中文测试集上 WER=4.97，
远好于 Whisper large-v3 的 15.30。问题在于我们的管道没有发挥模型能力。

---

## 2. 成熟产品做法调研（2026 最新）

### 2.1 Granola（$1.5B，2026.3 融资 $125M）

- **本地优先**：音频仅在本机采集，不上传云端，不装会议 Bot
- **实时转写 + 事后增强**：转写阶段用高效 ASR，会后用 GPT-4 级模型把粗转写 + 用户手写笔记 → 结构化会议纪要
- **Architectural Deletion**：原始音频转写后立即删除，只保留文本
- **MCP Server**：2026.2 开放 API 对接外部工作流

**启示**：分层策略——转写阶段追求速度+基本质量，增强阶段追求智能+格式化。不在 ASR 阶段死磕完美。

### 2.2 Otter.ai（云端会议转写标杆）

- **云端 ASR**：自研语音引擎，训练覆盖多口音/方言/行业术语
- **说话人识别**：复发会议 ~90% 准确率
- **多层管道**：ASR → Speaker ID → 关键词高亮 → 自动摘要
- **延迟**：安静环境 ~2-3s lag

**启示**：说话人识别是会议场景刚需。多层管道设计让每层专注做好一件事。

### 2.3 飞书妙记（字节跳动）

- **自研 ASR**：中文普通话准确率 98%，带口音 95%+
- **转写速度**：1:0.1（10x real-time）
- **声纹说话人分离**：采集声纹特征区分发言人
- **行业术语库**：内置 + 用户自定义导入
- **24 语言 + 中文方言**
- **DeepSeek R1 集成**：智能摘要、问答、知识库对接

**启示**：术语库（热词表）+ 声纹分离 + LLM 增强是中文会议转写的标配。98% 准确率说明当前技术完全可达。

### 2.4 SuperWhisper（macOS 本地语音输入，Product Hunt 隐私奖）

- **本地 Whisper 模型**：系统级语音输入，任意 App（我们的 F20c 做了同样的事）
- **最佳模型推荐**：large-v3-turbo（4x 速度，接近 large-v3 准确率，8GB 内存可跑）
- **Custom Mode**：可自定义 AI 思考/写作/格式化方式

### 2.5 Wispr Flow（云端语音输入，$15/mo）

- **架构**：音频上传云端 → Whisper 级转写 → fine-tuned Llama 清洗 → 输出
- **上下文感知**：定期截屏活跃窗口，让 AI 理解你在做什么
- **85% 免修改准确率**（200 词商务邮件）
- **~220 wpm** 听写速度

**启示**：Wispr 的 ASR + LLM 清洗两阶段管道是典型做法。上下文注入（知道用户在干嘛）显著提升输出质量。
我们的 Meeting Copilot 天然有会议上下文（议题/参会者），这是优势。

---

## 3. 2026 关键技术栈

### 3.1 ASR 模型（本地部署，Apple Silicon）

| 模型 | 参数量 | 中文 WER | M4 速度 | MLX 支持 | 推荐场景 |
|------|--------|----------|---------|----------|----------|
| **Qwen3-ASR 1.7B** | 1.7B | 4.97 (WenetSpeech) | 3.27x RT (MLX) | ✅ mlx-qwen3-asr | 中文为主，当前首选 |
| Qwen3-ASR 0.6B | 0.6B | 较高 | 更快 | ✅ | 极低延迟场景 |
| Whisper large-v3-turbo | ~809M | 15.30 | ~1s/短句 (MLX) | ✅ mlx-whisper | 多语言混合 |
| Whisper large-v3 | 1.5B | 15.30 | ~2s/短句 | ✅ mlx-whisper | 最高多语言质量 |
| Parakeet TDT 1.1B | 1.1B | 未公开 | RTFx > 2000 (GPU) | 需验证 | 极高吞吐 |

**结论**：我们选 Qwen3-ASR 1.7B 是对的。需要做的是切换到 MLX 推理（3-5x 加速）。

### 3.2 VAD（Voice Activity Detection）

| 方案 | 延迟 | 平台 | 说明 |
|------|------|------|------|
| **Silero VAD v5** | ~40μs/chunk (M2 Max) | Python/Swift/MLX | 2026 标准选择，极快 |
| WebRTC VAD | <1ms | C/Python | 传统方案，轻量 |
| pyannote VAD | 中等 | Python | 精度更高，支持 diarization |

**推荐**：Silero VAD v5 — 速度远超实时需求，直接集成到 audio-service.py。

### 3.3 说话人分离（Speaker Diarization）

| 方案 | 平台 | 说明 |
|------|------|------|
| **pyannote 3.0 + WeSpeaker** | Python/MLX | 2026 开源标配 |
| speech-swift（全套） | Swift/MLX | ASR+VAD+Diarization 一体化 |
| 声纹注册（飞书妙记方式） | 自建 | 采集参会者声纹，精确匹配 |

### 3.4 后处理管道

| 阶段 | 技术 | 说明 |
|------|------|------|
| 热词注入 | Contextual biasing + GRPO | 2026 论文：检索 top-k 热词候选 → 注入 ASR prompt |
| 标点恢复 | 轻量 NLP 模型 / LLM | 中文可用 CT-Transformer 或直接 LLM |
| LLM 后修正 | Judge-Editor agent | 保留高置信度片段，重写不确定段 |
| 格式化 | 规则 + LLM | 分段、缩进、标记 |

---

## 4. 推荐改造方案

### 阶段一：管道修复（P0，预计 2-3 天）

```
                     ┌──────────┐
  系统音频 ──────────→│ Silero   │──── 静音 → 丢弃
                     │ VAD v5   │
                     └────┬─────┘
                          │ 语音段（动态长度）
                          ▼
                   ┌──────────────┐
                   │ MLX Qwen3-ASR│  ← 替换当前 PyTorch 推理
                   │ 1.7B (8-bit) │  ← 3-5x 加速
                   └──────┬───────┘
                          │ 粗文本
                          ▼
                   ┌──────────────┐
                   │ 热词替换     │  ← 参会者名 + 项目术语
                   │ + 标点恢复   │
                   └──────┬───────┘
                          │ 可读文本
                          ▼
                     输出到前端
```

**关键改动**：
1. **VAD 替换定时切片**：`pip install silero-vad`，在 audio-service.py 的 `_process_audio_queue` 中用 VAD 检测语音段替换 `DEFAULT_CHUNK_SEC = 3.0` 固定切片
2. **MLX 推理**：`pip install mlx-qwen3-asr`，替换当前通过 HTTP 调用 localhost:9876 的方式，改为进程内推理
3. **热词表**：维护 `meeting-terms.json`（参会者名、项目名），注入 ASR context/prompt

### 阶段二：智能增强（P1-P2，预计 3-5 天）

4. **LLM 后修正**：复用 F20e 思路——标记为语音输入，让主模型纠错
5. **说话人分离**：集成 pyannote segmentation 3.0 + WeSpeaker，区分发言人
6. **滚动摘要增强**：Phase D 已有 30s 滚动摘要，结合说话人标签提升摘要质量

### 阶段三：评估升级（P3，spike）

7. **7B 模型评估**：Qwen2.5-ASR-7B 在 M4 Max 128GB 上的实时性 spike
8. **端到端方案评估**：speech-swift 全套（Swift 原生 ASR+VAD+Diarization）
9. **对标测试**：用同一段会议录音对比 Qwen3-1.7B / Whisper-turbo / Qwen2.5-7B

---

## 5. 与 F20 语音输入经验的关联

| F20 积累 | Meeting Copilot 可复用 |
|----------|----------------------|
| F20c: 系统级 Whisper（类 SuperWhisper） | 验证了本地 ASR 的可行性 |
| F20d: 术语自助配置 UI | 热词表 UI 可共享 |
| F20e: LLM 后修正（主模型自动纠错） | 直接应用——Meeting Copilot 上下文更丰富 |
| F20f: 增量发送修复 | chunking 策略已优化，但 Meeting Copilot 的 3s 切片还没用上 |
| Whisper Apple Silicon 调研 | MLX/WhisperKit/whisper.cpp 对比数据可直接用 |

---

## 6. 铲屎官决策点

1. **阶段一是否直接开干？** P0 改动（VAD + MLX + 热词）投入小、收益确定
2. **说话人分离优先级？** 如果会议只有铲屎官 + 对方，可以延后；多人会议则刚需
3. **是否考虑 speech-swift 全套？** 代价是从 Python 切到 Swift，但获得 ASR+VAD+Diarization 一体化
4. **7B 模型 spike 优先级？** M4 Max 128GB 有余量，但需验证实时性

---

## Sources

- [mlx-qwen3-asr (GitHub)](https://github.com/moona3k/mlx-qwen3-asr/)
- [Qwen3-ASR Technical Report](https://arxiv.org/html/2601.21337v1)
- [speech-swift: AI speech toolkit for Apple Silicon](https://github.com/soniqo/speech-swift)
- [Gladia: Best open-source STT models 2026](https://www.gladia.io/blog/best-open-source-speech-to-text-models)
- [Granola AI ($1.5B valuation, TechCrunch)](https://techcrunch.com/2026/03/25/granola-raises-125m-hits-1-5b-valuation-as-it-expands-from-meeting-notetaker-to-enterprise-ai-app/)
- [Granola: How transcription works](https://docs.granola.ai/help-center/taking-notes/transcription)
- [SuperWhisper](https://superwhisper.com/)
- [MacWhisper vs Voicy vs SuperWhisper (2026)](https://usevoicy.com/blog/macwhisper-vs-voicy-vs-superwhisper)
- [Wispr Flow vs Superwhisper vs MacWhisper (2026)](https://spokenly.app/blog/wispr-flow-vs-superwhisper-vs-macwhisper)
- [Contextual Biasing for LLM-Based ASR with Hotword Retrieval (arXiv)](https://arxiv.org/abs/2512.21828)
- [LLM-Agent Post-ASR Correction (arXiv)](https://arxiv.org/html/2601.21347v1)
- [Best open-source STT model 2026 (Northflank benchmarks)](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks)
- [Silero VAD: Complete Guide (Picovoice)](https://picovoice.ai/blog/complete-guide-voice-activity-detection-vad/)
- [Streaming ASR Architecture](https://www.arunbaby.com/speech-tech/0001-streaming-asr/)
- [Speaker Diarization on Apple Silicon (MLX)](https://blog.ivan.digital/speaker-diarization-and-voice-activity-detection-on-apple-silicon-native-swift-with-mlx-92ea0c9aca0f)
