---
feature_ids: []
topics: [tts]
doc_kind: research
created: 2026-02-26
---

下面是我按 **2026-02-21** 这个时间点，把「开源 TTS」里最值得你在 **Apple Silicon 本地部署** 上优先看的方案，按你关心的 5 个维度（Apple Silicon、本地、中文质量、多声线、轻量、MLX 适配）做的“选型地图”。🧭🎙️

---

## 先给结论：你大概率会落在这三条路里

### 1) 你想要“原生 MLX + 省心 + 中文还行 + 多声线/克隆”

优先看 **MLX-Audio 生态**：一个库把 **TTS/STT/STS** 都包了，直接跑在 Apple Silicon 上，还自带量化、OpenAI 兼容 API、甚至 Swift 集成。它支持的 TTS 模型里，和中文强相关的核心是：**Spark-TTS（中英+零样本克隆）**、**Qwen3-TTS（多语+VoiceDesign/CustomVoice）**、以及 **Kokoro-82M（超轻量多声线，含中文声线）**。 ([GitHub][1])

### 2) 你想要“中文上限更高 + 方言/口音 + 更强一致性 + 还能克隆”

看 **CosyVoice 3.0**，并且在 Mac 上强烈建议走 **cosyvoice3.rs（Candle + Metal）** 这条线：不依赖 PyTorch、提供 macOS Apple Silicon 的 Metal wheel、零样本克隆/跨语种/指令控制都有。 ([GitHub][2])

### 3) 你想要“轻量到极致 + 稳 + CPU 也能实时”

看 **Piper（piper-tts / OHF-Voice/piper1-gpl）** 或 **MeloTTS**。

* Piper：ONNX/CPU 友好、macOS arm64 wheel，适合“本地读屏/播报/助手语音”。 ([GitHub][3])
* MeloTTS：明确说 **CPU 实时**，中文还支持“中英混读”。 ([GitHub][4])

---

## 方案拆解：按你的关注点逐个打分（不玩虚的）

下面每个我都给：**适配方式**、**中文**、**多声线**、**轻量**、**MLX 现成适配**、以及“我会怎么用”。

---

# A. MLX-Audio 生态（最贴 Apple Silicon 的“现成 MLX 适配”答案）

## 为什么它很值得优先试

MLX-Audio 是基于 Apple 的 MLX 框架做的音频库，明确针对 M 系列优化，支持多模型、多语言、量化，并且给了 **OpenAI 兼容 REST API** 和 **Swift package（iOS/macOS）** 这种非常工程化的出口。 ([GitHub][1])

### 你要的 5 个关键词它怎么对应

* Apple Silicon 本地部署：是（MLX 原生）([GitHub][1])
* 中文质量：取决于你选的模型（下面给你选法）([GitHub][1])
* 多声线：Kokoro 有大量预设声线；Qwen3-TTS/Spark-TTS走“设计/克隆/可控”路线 ([GitHub][1])
* 轻量：Kokoro 82M 走“轻量爆杀”；Spark 0.5B 属于“还能接受”；Qwen3-TTS 1.7B 偏重但可量化 ([GitHub][1])
* 现成 mlx 适配：是（模型已经被 mlx-community 转过）([GitHub][1])

## 在 MLX-Audio 里，中文相关我会这么选模型

### 1) Kokoro-82M（超轻量、多声线、中文可用）

* 优点：**82M 参数**，天生“轻量派”，而且 **Mandarin Chinese 有 4F 4M 声线**（对你要“多声线”很关键）。 ([Hugging Face][5])
* 在 MLX-Audio README 里也明确列了 Kokoro 支持 ZH，且示例里直接展示了中文声线名、中文 lang_code（z）。 ([GitHub][1])
* 适合：本地助手、播客旁白、游戏 NPC，小模型先把工程跑通。

**跑起来（命令行）**
（注意：Kokoro 中文需要 `misaki[zh]`，README 里有写） ([GitHub][1])

```bash
pip install -U mlx-audio
pip install "misaki[zh]"
brew install ffmpeg  # 想导出 mp3/flac 时需要；wav 不需要

# 生成中文（lang_code=z），挑一个中文声线
mlx_audio.tts.generate \
  --model mlx-community/Kokoro-82M-bf16 \
  --text "你好，我在 Apple Silicon 上用 MLX 本地说话。" \
  --lang_code z \
  --voice zf_xiaobei \
  --output_path ./out
```

（`zf_xiaobei` 这类中文 voice 名在 README 里有示例。） ([GitHub][1])

---

### 2) Spark-TTS（中英双语 + 零样本克隆 + 可控参数）

Spark-TTS 的 repo 里明确写了：

* 支持 **中文和英文**
* 支持 **zero-shot voice cloning**，而且强调跨语种/代码混读场景
* 支持“创建虚拟说话人”，能调 gender/pitch/speaking rate 等参数 ([GitHub][6])

MLX-Audio 也把 Spark 列为 EN, ZH 支持模型。 ([GitHub][1])

**适合**：你中文要更自然，还要“拿一段参考音频就能克隆”的玩法，同时希望尽量留在 Apple Silicon 本地闭环。

---

### 3) Qwen3-TTS（多语 + VoiceDesign/CustomVoice，偏“上限路线”）

MLX-Audio README 直接把 Qwen3-TTS描述为“多语 TTS with voice design”，并给了更进阶的 README 入口。 ([GitHub][1])
而 mlx-community 的 Qwen3-TTS MLX 模型卡提供了 CLI/Python 示例，并且示例里出现了 `ref_audio`，暗示其工作流支持参考音频相关能力。 ([Hugging Face][7])

**适合**：你想做更可控的声线设计或更复杂的多语 TTS，但能接受模型更大（可以配合 MLX-Audio 的量化工具压下去）。 ([GitHub][1])

---

# B. CosyVoice 3.0 + cosyvoice3.rs（Mac 上的“中文上限 + Metal 加速”组合拳）

如果你对“中文自然度、内容一致性、方言/口音、克隆相似度”要求更狠，我会把它当成“旗舰路线”。

## CosyVoice 3.0 本体的能力（中文党很香）

CosyVoice repo 写得非常硬核：

* 覆盖 **9 种常用语言**，并且支持 **18+ 中文方言/口音**
* 支持 **跨语种/多语种 zero-shot voice cloning**
* 支持拼音/CMU 音素的 pronunciation inpainting（更可控）
* 支持文本流式输入 + 音频流式输出，声称低延迟（150ms级别） ([GitHub][2])

## 为什么我推荐你在 Mac 上看 cosyvoice3.rs（而不是直接 PyTorch）

cosyvoice3.rs 是用 Hugging Face 的 Candle 做的 Rust 实现 + Python 绑定，重点是：

* **macOS Apple Silicon 的 Metal wheel**（直接装）
* 明确写了 **GPU acceleration (CUDA, Metal)**
* “不依赖 PyTorch”，工程侧轻很多
* 还给了性能数据：Apple M1 Pro（Metal）RTF ~0.3-0.5，意味着可能比实时还快 ([GitHub][8])

**适合**：你要“中文上限 + 本地 + 工程可落地”，并且你愿意用 0.5B 级别模型。

---

# C. Piper（piper-tts / piper1-gpl）：CPU 轻量、实用主义的“螺丝刀”

如果你想要：

* 部署简单
* 模型小
* CPU 实时
* 重点是“能用、稳定、离线、工程友好”

那 Piper 依旧是 2026 这一刻的热门选项之一。

## 2026 的状态：从 rhasspy/piper 迁到 OHF-Voice/piper1-gpl

原 repo 已归档并提示迁移到新仓库。 ([GitHub][9])
同时 PyPI 上 `piper-tts` 最新版是 **1.4.1（2026-02-05）**，并明确提供 **macOS 11.0+ ARM64 wheel**。 ([PyPI][10])

## 中文方面：能用，但别指望“旗舰自然度”

* Piper 确实有 zh_CN 的模型（例如 huayan）。 ([Hugging Face][11])
* 但社区里也有人反馈：中文会有口音/不自然、停顿机械等问题（至少说明“中文上限不是 Piper 的主赛道”）。 ([GitHub][12])
* 值得注意的是，新仓库的 v1.4.0 release notes 提到新增基于 g2pW 的中文 phonemizer、以及 pinyin phoneme_type 等能力，这对中文“前端处理”可能是实打实的改进方向。 ([新发布][13])

**适合**：读屏、提示音、智能家居播报、游戏里“够清晰就行”的旁白。

---

# D. MeloTTS：轻量、CPU 实时、中英混读（而且 MIT 许可）

MeloTTS README 里直接写了：

* 支持中文（并且 **中文 speaker 支持 mixed Chinese and English**）
* **CPU real-time inference**
* MIT license ([GitHub][4])

**适合**：你要更“产品化可用”的轻量方案，且更在意许可友好（MIT）。

---

# E. ChatTTS：对话/情绪/韵律很强，但注意许可与输出策略

ChatTTS 的定位非常明确：对话场景（LLM assistant），支持中英，强调多说话人、笑声/停顿/插话等细粒度韵律控制。 ([GitHub][14])
但也需要注意：

* 代码是 AGPLv3+
* 模型权重是 CC BY-NC 4.0（非商业）
* 并且他们提到为了限制滥用对音频质量做了压缩/加噪策略 ([GitHub][14])

**适合**：研究/个人项目里做“有性格的对话语音”，不适合商业闭源产品。

---

# F. Fish Speech（FishAudio-S1）：功能很猛，但 Mac 现阶段不算“稳妥本地部署”

它的 feature list 很豪华：多语、情绪标记、10–30s 参考音频快速克隆、无需 phoneme 依赖等。 ([GitHub][15])
但它也明确写了：

* “macOS support coming soon”
* 权重是 CC-BY-NC-SA-4.0（非商业且带 share-alike） ([GitHub][15])

**适合**：你主要在 Linux/Windows 本地推，或者你愿意等 Mac 支持成熟后再纳入主力。

---

## 我会怎么给你“最终选型”落地（不纠结，直接开跑）

你可以用下面这个“二选一/三选一”思路，10 分钟就能收敛：

### 你要最省心的 Apple Silicon 本地闭环

1. 先上 **MLX-Audio + Kokoro-82M** 把工程链路跑通（轻量、声线多、速度快）。 ([GitHub][1])
2. 再换成 **MLX-Audio + Spark-TTS** 追中文自然度与克隆能力。 ([GitHub][1])
3. 觉得还要更可控/更强模型，再上 **Qwen3-TTS（MLX）**。 ([GitHub][1])

### 你要中文“上限”和“方言/口音”，并且希望 Metal 直上

直接上 **CosyVoice3 + cosyvoice3.rs（Metal）**。 ([GitHub][2])

### 你要极轻量、纯 CPU、部署像装螺丝一样简单

* **Piper（piper-tts）** 或 **MeloTTS**。 ([PyPI][10])

---

## 小提醒（很短，但很重要）

多声线/克隆类模型天然容易被滥用。建议只克隆你拥有授权的声音，或使用明确许可允许的素材，避免踩到法律和平台规则的雷区。Spark-TTS、Fish Speech 等项目本身也在 README 里强调了合法合规使用。 ([GitHub][6])

---

如果你愿意，我们下一步可以像共犯一样干点“工程味”的事：
我帮你设计一个 **Mac 上的 TTS benchmark 小脚本**（同一组中文句子 + 中英混读 + 数字/日期 + 多说话人切换 + 参考音频克隆），然后把 MLX-Audio（Kokoro/Spark/Qwen3）+ cosyvoice3.rs + MeloTTS/Piper 跑一遍，输出：RTF、显存/内存占用、CER（可选）、主观听感打分模板。你把目标场景告诉我（“播报/对话/配音/旁白/克隆”哪个更像），我就按那个权重给你出一套“最像产品”的推荐配置。

[1]: https://github.com/Blaizzy/mlx-audio "GitHub - Blaizzy/mlx-audio: A text-to-speech (TTS), speech-to-text (STT) and speech-to-speech (STS) library built on Apple's MLX framework, providing efficient speech analysis on Apple Silicon."
[2]: https://github.com/FunAudioLLM/CosyVoice "GitHub - FunAudioLLM/CosyVoice: Multi-lingual large voice generation model, providing inference, training and deployment full-stack ability."
[3]: https://github.com/OHF-Voice/piper1-gpl?utm_source=chatgpt.com "OHF-Voice/piper1-gpl: Fast and local neural text-to-speech ..."
[4]: https://github.com/myshell-ai/MeloTTS "GitHub - myshell-ai/MeloTTS: High-quality multi-lingual text-to-speech library by MyShell.ai. Support English, Spanish, French, Chinese, Japanese and Korean."
[5]: https://huggingface.co/mlx-community/Kokoro-82M-bf16/blob/main/VOICES.md?utm_source=chatgpt.com "VOICES.md · mlx-community/Kokoro-82M-bf16 at main"
[6]: https://github.com/SparkAudio/Spark-TTS "GitHub - SparkAudio/Spark-TTS: Spark-TTS Inference Code"
[7]: https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16?utm_source=chatgpt.com "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16"
[8]: https://github.com/SpenserCai/cosyvoice3.rs "GitHub - SpenserCai/cosyvoice3.rs: Python bindings for CosyVoice3 TTS using Candle. Has the characteristics of small size, fast speed, and does not rely on libraries such as Pytorch."
[9]: https://github.com/rhasspy/piper?utm_source=chatgpt.com "rhasspy/piper: A fast, local neural text to speech system"
[10]: https://pypi.org/project/piper-tts/?utm_source=chatgpt.com "piper-tts"
[11]: https://huggingface.co/rhasspy/piper-voices/blob/664c651454f055ed34bd83f09e024ffbc0da09ac/voices.json?utm_source=chatgpt.com "voices.json · rhasspy/piper-voices at ..."
[12]: https://github.com/rhasspy/piper/issues/278?utm_source=chatgpt.com "More natural Chinese voice, Please #278 - rhasspy/piper"
[13]: https://newreleases.io/project/github/OHF-Voice/piper1-gpl/release/v1.4.0?utm_source=chatgpt.com "OHF-Voice/piper1-gpl v1.4.0 on GitHub"
[14]: https://github.com/2noise/ChatTTS "GitHub - 2noise/ChatTTS: A generative speech model for daily dialogue."
[15]: https://github.com/fishaudio/fish-speech "GitHub - fishaudio/fish-speech: SOTA Open Source TTS"
