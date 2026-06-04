---
feature_ids: []
related_features: [F192, F200]
topics: [local-small-model, rl, signal-miner, on-device, embedding, per-user-alignment]
doc_kind: research
created: 2026-06-03
participants: [landy, codex-cloud]
status: placeholder-awaiting-paste
---

# 本地小模型 + RL 调研 — 云端砚砚 pro 成果

> 来源：云端砚砚 pro（GPT-5.5）专项调研，约 2026-06-01 完成
> 触发：[OQ-4 五猫收敛 §4.6](../discussions/2026-06-01-oq4-harness-self-evolution-synthesis.md) "本地小模型选型和 RL 是独立的技术调研课题"
> 关联：
> - [PoE 概念 note](../discussions/2026-05-31-personal-operating-environment-concept-note.md) — Local Signal Miner 架构
> - [48 的 spike](2026-05-27-evolvable-harness/) — 四层级联 + 传感器定位
> - [Longform-003 Seed](../content/drafts/longform-003-seed-poe-vision.md) — Agent 3.0 路演材料

---

## 铲屎官请在下方粘贴云端砚砚 pro 的调研内容 👇
可以喵！砚砚把 HF 小模型鱼干摊开晒了一遍。先给你结论：**128GB MacBook 很宽裕**，真正的甜区是 **1B 到 8B**，上到 **26B/30B 的 4bit 量化**也能玩，但长上下文、多模态视频、图像生成会明显吃内存和速度。HF 当前前排里，MiniCPM5-1B、LFM2.5-8B-A1B、LocateAnything-3B、Marlin-2B、PaddleOCR-VL-1.6、MiniCPM-V-4.6、Hy-MT2-1.8B 等都属于 2026 年 3 到 6 月这段时间很值得关注的“小而能打”模型。([Hugging Face][1])

我把“2026 年 3 到 6 月发”按两种口径处理：**有明确 2026 年 3 到 6 月发布文章/模型 release date 的，放主推**；**HF 近期更新并且热度高但未必是首次发布的，标成近期更新/备选**。这样比较不容易把“新发”和“刚更新”混在一锅猫粮里。

## 砚砚首推装机清单

| 优先级 |                                                     模型 |                                           类型/大小 | 为什么值得关注                                                                                                                                                          | MacBook 128GB 建议                                               |
| --- | -----------------------------------------------------: | ----------------------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 必装  |                             **LiquidAI/LFM2.5-8B-A1B** |             本地 LLM/Agent，8.3B 总参数，约 1.5B active | 2026-05-28 发布，面向 on-device agent、工具调用、长上下文，128K context，支持 llama.cpp、MLX、vLLM、SGLang；官方还给出消费硬件上低于 6GB 内存的速度数据。([Liquid AI][2])                                   | **首选 MLX 或 GGUF 4bit/8bit**。这是 128GB Mac 上最值得试的本地 agent 小模型之一。 |
| 必装  |                                **openbmb/MiniCPM5-1B** |                                         语言模型，1B | 1B dense transformer，主打 on-device/local/edge，支持长上下文、tool use、code、reasoning；模型卡列出 BF16、GGUF、Ollama、LM Studio、MLX 4bit 等格式。([Hugging Face][3])                    | **日常常驻款**。1B 级别很轻，适合本地小助手、脚本 agent、低延迟任务。                      |
| 必装  |                     **google/gemma-4 E2B/E4B/26B-A4B** |                                    多模态/LLM，小到中型 | 2026-04-02 HF 发布文介绍 Gemma 4：E2B、E4B 小模型支持图像、文本、音频输入到文本输出；26B-A4B 是 MoE，约 4B active；官方文档展示 llama.cpp Metal 与 MLX 运行路径。([Hugging Face][4])                         | **E4B-it 当默认多模态款**；26B-A4B-it 用 4bit，当“质量上限款”。                 |
| 必装  |                              **openbmb/MiniCPM-V-4.6** |                                     轻量 VLM，约 1B | 面向图像、多图、视频理解，基于 SigLIP2-400M + Qwen3.5-0.8B，支持 vLLM、SGLang、llama.cpp、Ollama，提供 GGUF/BNB/AWQ/GPTQ 量化路线。([Hugging Face][5])                                        | **Mac 本地看图/OCR/截图理解首选之一**，用 Q4 GGUF 跑很香。                       |
| 必装  | **Granite Embedding Multilingual R2 + Ettin Reranker** | RAG 检索组合，97M/311M embedding + 17M 到 1B reranker | IBM 2026-05-14 发布 Granite 多语 embedding，97M/311M、200+ 语言、32K context、Apache 2.0；HF 2026-05-19 发布 Ettin reranker 系列，17M 到 1B，多尺寸 SOTA 级 rerank。([Hugging Face][6]) | **做本地知识库/RAG 必备**。97M embedding + 68M/150M reranker 就很够用。      |
| 强推  |               **CohereLabs/cohere-transcribe-03-2026** |                                          ASR，2B | 2026 年 3 月版开源 ASR，Apache 2.0，支持 14 种语言；官方称在 HF Open ASR leaderboard 英语第一，且离线吞吐高。([Hugging Face][7])                                                              | **本地转写/会议记录**可试。2B 级别对 128GB Mac 很轻。                           |
| 强推  |                      **PaddlePaddle/PaddleOCR-VL-1.6** |                                 文档 OCR/VLM，约 1B | 近期 HF 热门小模型，主打 OCR、document parsing、layout、table、formula、chart，Apache 2.0；模型卡称在 OmniDocBench v1.6 的多个文档解析指标上达到 SOTA。([Hugging Face][8])                          | **PDF/扫描件/表格解析**很值得试。Mac 能跑，但复杂文档建议降分辨率。                       |
| 强推  |                                  **numind/NuExtract3** |                                      文档结构化抽取，5B | 近期 HF 热门，面向 document understanding、structured extraction、OCR、document-to-Markdown、RAG，多语，Apache 2.0；模型卡支持把文档转 Markdown，表格用 HTML、公式用 LaTeX。([Hugging Face][9])    | 适合**票据、表单、报告转 JSON/Markdown**。5B 量化后 Mac 没压力。                  |
| 强推  |                                **tencent/Hy-MT2-1.8B** |                                         翻译，1.8B | HF 近期前排，36 语言翻译，Apache 2.0，模型卡给了保持结构化内容/分隔符的翻译提示模板。([Hugging Face][10])                                                                                          | **本地翻译小钢炮**。1.8B 非常适合 Mac 常驻。                                  |

## 按用途细分：哪些该优先看？

### 1. 本地聊天、Agent、代码、长上下文

**LFM2.5-8B-A1B** 是这批里我最想给你插小旗子的一个。它不是单纯“小”，而是“活跃参数小、总能力撑得住”：8.3B 总参数、约 1.5B active，128K context，明确面向本地助手、工具调用、复杂指令和 consumer hardware；官方还强调 day-one 支持 llama.cpp、MLX、vLLM、SGLang。([Hugging Face][11])
砚砚建议：**先下 MLX 或 GGUF 量化版**，拿来做本地 agent、文件问答、脚本执行规划。

**MiniCPM5-1B** 是“猫爪常驻模型”。它只有 1B，但模型卡强调 on-device、local、resource-constrained 使用场景，并且同一 checkpoint 提供 BF16、GGUF、Ollama、LM Studio、MLX 4bit 等格式；还支持 131K 上下文。([Hugging Face][3])
砚砚建议：拿它做**低延迟助手、路由模型、小工具调用、轻量中文英文任务**。它不是 70B 的猛兽，但胜在随叫随到，不把风扇吹成台风。

**Gemma 4 E2B/E4B/26B-A4B** 值得单独留一个席位。E2B/E4B 是小多模态入口，26B-A4B 是 4B active 的 MoE 上限款；HF 发布文还给了 llama.cpp Metal 和 MLX 的示例，包括 `gemma-4-26b-a4b-it-GGUF:Q4_K_M` 与 MLX 4bit 路线。([Hugging Face][4])
砚砚建议：**E4B-it 日常用，26B-A4B-it 4bit 做高质量任务**。128GB 可以扛，但长上下文时 KV cache 会膨胀，别一上来就 128K 拉满。

**Granite 4.1 3B/8B** 很适合企业/RAG/代码风格任务。IBM 在 2026-04-29 发布 Granite 4.1，提供 3B、8B、30B dense decoder-only LLM，训练约 15T tokens，Apache 2.0，并扩展长上下文到 512K。([Hugging Face][12])
砚砚建议：**8B instruct 可作为工作型 LLM**；30B 只建议 4bit，作为本地重活选项。

**sapientinc/HRM-Text-1B** 更偏研究向。它是 1B、Apache 2.0，模型卡标注 hierarchical-reasoning、prefixLM，并明确不是 chat/instruction-tuned 模型；上下文 4096，训练 unique tokens 40B。([Hugging Face][13])
砚砚建议：拿来研究新架构可以，**不要指望它开箱替代聊天模型**。

### 2. 多模态、截图、PDF、视频、文档解析

**MiniCPM-V-4.6** 是“小 VLM 里最值得装的一只”。它支持图像、多图、视频，强调 edge deployment，支持手机平台与 llama.cpp/Ollama 等本地生态；HF 模型页标注 on-device、lightweight、Apache 2.0。([Hugging Face][5])
砚砚建议：做**截图理解、网页截图 QA、轻量 OCR、视频片段理解**，先试它。

**PaddleOCR-VL-1.6** 更专注文档解析。模型页标签覆盖 OCR、document-parse、layout、table、formula、chart，Apache 2.0；模型卡称在 OmniDocBench v1.6 的整体、文本、公式、表格等指标上表现领先。([Hugging Face][8])
砚砚建议：做**论文 PDF、合同、表格、扫描件解析**时优先看它。

**NuExtract3** 是文档结构化抽取路线。它面向 OCR、document understanding、structured extraction、document-to-Markdown、RAG，多语，Apache 2.0；模型卡明确支持把文本标题转 Markdown、表格转 HTML、数学公式转 LaTeX、图片转描述。([Hugging Face][9])
砚砚建议：你要把**文档变成 JSON/Markdown/知识库条目**，它会比普通 VLM 更顺手。

**Marlin-2B** 是视频理解里很有意思的新鱼干。它是 2B video VLM，模型卡说专注“发生了什么、什么时候发生”，支持 Scene+Event captions、秒级时间戳、自然语言 temporal grounding；底座是 Qwen3.5-2B，Apache 2.0。([Hugging Face][14])
砚砚建议：适合**视频摘要、视频检索、时间点定位**。Mac 128GB 内存够，瓶颈更多在视频预处理和速度。

**nvidia/LocateAnything-3B** 是视觉定位/grounding 特化模型。它 2026-05-26 发布，3B 参数，面向 precise object localization、dense detection、point-based location；但许可证是 NVIDIA non-commercial，运行环境也更偏 NVIDIA/Linux。([Hugging Face][15])
砚砚建议：研究 GUI grounding、目标定位、机器人视觉可以看；**Mac 上可跑性要保守，商业用途先看 license**。

**Qwen3-VL-Embedding-2B** 是多模态检索，不是普通聊天模型。HF 2026-04-16 的 Sentence Transformers 文章里把它列为支持 text、image、video、message 的 2B 多模态 embedding 模型，并给了视觉文档检索训练示例。([Hugging Face][16])
砚砚建议：如果你要做**图片/PDF 页面/截图检索**，它比纯文本 embedding 更合适。

### 3. RAG、embedding、rerank

这块砚砚建议直接上组合拳：

**Granite Embedding Multilingual R2**：97M 和 311M 两个版本，Apache 2.0，基于 ModernBERT，支持 200+ 语言、32K context、Matryoshka 表示，官方称 97M 在 sub-100M 开源多语检索里表现领先，311M 在 500M 以下开源模型里也很强。([Hugging Face][6])

**Ettin rerankers**：17M、32M、68M、150M、400M、1B 六个尺寸，HF 发布文称它们在各自尺寸段达到 SOTA；结果表里 150M、400M、1B 的 MTEB reranking 分数都很亮眼。([Hugging Face][17])

砚砚建议的本地 RAG 配方：

| 场景      | 推荐                                                |
| ------- | ------------------------------------------------- |
| 很轻量、常驻  | Granite 97M embedding + Ettin 32M/68M reranker    |
| 中等质量    | Granite 311M embedding + Ettin 150M reranker      |
| 高质量但仍本地 | Granite 311M embedding + Ettin 400M/1B reranker   |
| 多模态文档检索 | Qwen3-VL-Embedding-2B + MiniCPM-V/PaddleOCR-VL 解析 |

### 4. 语音：转写和 TTS

**Cohere transcribe 03-2026** 是 ASR 首看。它是 2B encoder-decoder ASR，Apache 2.0，支持 14 种语言，官方称离线吞吐比同量级竞品高，并在 HF Open ASR leaderboard 英语榜拿到第一。([Hugging Face][7])
砚砚建议：本地会议记录、播客转写、多语音频归档，优先试它。

**Supertonic 3** 是 on-device TTS。模型页标注 31 种语言、ONNX、on-device、OpenRAIL；模型卡强调用 ONNX Runtime 在设备本地运行，无需云调用，并从 5 种语言扩展到 31 种语言。([Hugging Face][18])
砚砚建议：想做本地多语音色/朗读，值得试；商业用途先看 OpenRAIL 条款。

**SILMA TTS v1** 是阿英双语小 TTS。2026-03-15 发布，150M 参数，基于 F5-TTS diffusion 架构，支持 Arabic/English、短参考音频 voice cloning、Apache 2.0。([Hugging Face][19])
砚砚建议：如果你关心阿语/英语 TTS，它很小很漂亮。

### 5. 图像生成：128GB 能玩，但要有耐心

**microsoft/Lens** 是 3.8B 参数 text-to-image foundation model，MIT license，模型卡示例里还写了 Apple 设备可切到 `mps`。([Hugging Face][20])
砚砚建议：Mac 上可以试，但图像生成速度不会像云端 GPU 那么轻盈。

**prism-ml/bonsai-image-ternary-4B-gemlite-2bit** 是更“野生低比特”的路线。它基于 FLUX.2 Klein 4B，1.58-bit/ternary/Gemlite/HQQ，模型卡提到 demo repo 支持 Mac/Linux/Windows 一键 setup。([Hugging Face][21])
砚砚建议：喜欢折腾本地图像生成，这个值得玩；稳定性和生态成熟度可能不如常规 Diffusers 路线。

## 128GB MacBook 怎么选量化？

|       模型大小 | 128GB Mac 体验   | 建议                                                  |
| ---------: | -------------- | --------------------------------------------------- |
|  100M 到 1B | 非常轻，常驻没问题      | embedding、reranker、小助手、TTS 都可常驻                     |
|    1B 到 3B | 很舒服            | MiniCPM5、MiniCPM-V、Marlin、Cohere Transcribe 这类随便玩   |
|    4B 到 8B | 甜区             | LFM2.5、Gemma E4B、Granite 8B 建议 MLX/GGUF 4bit 或 8bit |
|  20B 到 30B | 能跑，但别贪         | 4bit 优先，控制上下文，别同时开一堆模型                              |
| 视频/图像/长上下文 | 内存够，速度和 KV 是瓶颈 | 降 `max_pixels`、FPS、分辨率，短上下文先测                       |

几个猫爪准则：

1. **Mac 首选 MLX，其次 GGUF/llama.cpp/Ollama/LM Studio**。MiniCPM5、Gemma 4、LFM2.5、MiniCPM-V 都有比较明确的本地运行生态。([Hugging Face][3])
2. **RAG 不要只堆大 LLM**，embedding + reranker 更关键。Granite Embedding R2 和 Ettin reranker 这对小组合很适合 Mac 本地知识库。([Hugging Face][6])
3. **多模态模型先降分辨率再评估**，尤其视频和文档。MiniCPM-V、PaddleOCR-VL、Marlin 这类模型能跑，但输入尺寸会直接影响速度和显存/统一内存占用。([Hugging Face][5])
4. **注意 license**：MiniCPM5、MiniCPM-V、PaddleOCR-VL、NuExtract3、Granite、Cohere Transcribe 多数比较友好；LocateAnything 是 NVIDIA non-commercial，Supertonic 3 是 OpenRAIL，LFM2.5 是 Liquid 自家 license，商用前要再看条款。([Hugging Face][15])

## 砚砚给你的最终推荐

如果你只想先装一小套，不想被模型海淹到猫胡子湿漉漉：

**本地 LLM/Agent**：LFM2.5-8B-A1B + MiniCPM5-1B
**本地多模态**：MiniCPM-V-4.6 + PaddleOCR-VL-1.6
**本地 RAG**：Granite Embedding 311M + Ettin 150M reranker
**本地语音**：Cohere Transcribe 03-2026 + Supertonic 3
**上限实验**：Gemma 4 26B-A4B 4bit 或 Granite 4.1 30B 4bit

这套在 128GB MacBook 上属于“猫窝很宽敞”的配置：小模型常驻、大模型按任务加载，多模态和图像生成控制输入尺寸就行。

[1]: https://huggingface.co/models "Models – Hugging Face"
[2]: https://www.liquid.ai/blog/lfm2-5-8b-a1b "LFM2.5-8B-A1B: An Even Better On-Device Mixture of Experts | Liquid AI"
[3]: https://huggingface.co/openbmb/MiniCPM5-1B "openbmb/MiniCPM5-1B · Hugging Face"
[4]: https://huggingface.co/blog/gemma4 "Welcome Gemma 4: Frontier multimodal intelligence on device"
[5]: https://huggingface.co/openbmb/MiniCPM-V-4.6 "openbmb/MiniCPM-V-4.6 · Hugging Face"
[6]: https://huggingface.co/blog/ibm-granite/granite-embedding-multilingual-r2 "Granite Embedding Multilingual R2: Open Apache 2.0 Multilingual Embeddings with 32K Context — Best Sub-100M Retrieval Quality"
[7]: https://huggingface.co/blog/CohereLabs/cohere-transcribe-03-2026-release "Introducing Cohere-transcribe: state-of-the-art speech recognition"
[8]: https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6 "PaddlePaddle/PaddleOCR-VL-1.6 · Hugging Face"
[9]: https://huggingface.co/numind/NuExtract3 "numind/NuExtract3 · Hugging Face"
[10]: https://huggingface.co/tencent/Hy-MT2-1.8B "tencent/Hy-MT2-1.8B · Hugging Face"
[11]: https://huggingface.co/LiquidAI/LFM2.5-8B-A1B "LiquidAI/LFM2.5-8B-A1B · Hugging Face"
[12]: https://huggingface.co/blog/ibm-granite/granite-4-1 "Granite 4.1 LLMs: How They’re Built"
[13]: https://huggingface.co/sapientinc/HRM-Text-1B "sapientinc/HRM-Text-1B · Hugging Face"
[14]: https://huggingface.co/NemoStation/Marlin-2B "NemoStation/Marlin-2B · Hugging Face"
[15]: https://huggingface.co/nvidia/LocateAnything-3B "nvidia/LocateAnything-3B · Hugging Face"
[16]: https://huggingface.co/blog/train-multimodal-sentence-transformers "Training and Finetuning Multimodal Embedding & Reranker Models with Sentence Transformers"
[17]: https://huggingface.co/blog/ettin-reranker "Introducing the Ettin Reranker Family"
[18]: https://huggingface.co/Supertone/supertonic-3 "Supertone/supertonic-3 · Hugging Face"
[19]: https://huggingface.co/blog/silma-ai/opensource-arabic-english-text-to-speech-model "SILMA TTS: A Lightweight Open Bilingual Text to Speech Model"
[20]: https://huggingface.co/microsoft/Lens "microsoft/Lens · Hugging Face"
[21]: https://huggingface.co/prism-ml/bonsai-image-ternary-4B-gemlite-2bit "prism-ml/bonsai-image-ternary-4B-gemlite-2bit · Hugging Face"
对，Landy！砚砚把猫爪收回来重新排一下：**Qwen 这一家现在不是“也有一点点语音”，而是已经有完整的 ASR/TTS/Omni 语音生态了。**你说的 “ttl” 我先按 **TTS** 理解，文字转语音那条。

我的新结论是：

**如果你只想在 128GB MacBook 上装一套主力模型，Qwen3.5 应该进核心席位。**
但它不是把所有专用小模型都淘汰掉，而是变成“中枢大猫”：聊天、视觉、agent、代码、长上下文用 Qwen3.5，语音用 Qwen3-ASR/Qwen3-TTS，文档 OCR/RAG/特化抽取再搭专用模型。

## 先说总对比

| 任务            | Qwen 方案                                              | 我之前提到的模型                                  | 砚砚判断                                      |
| ------------- | ---------------------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| 本地聊天/推理/代码    | **Qwen3.5-4B / 9B / 35B-A3B**                        | LFM2.5-8B-A1B、MiniCPM5-1B、Gemma 4、Granite | **Qwen3.5 大概率是默认首选**，尤其 4B/9B/35B-A3B。    |
| 轻量常驻小助手       | Qwen3.5-0.8B / 2B                                    | MiniCPM5-1B                               | MiniCPM5 更“猫爪轻”，但 Qwen3.5 更全能，且自带视觉线。     |
| 多模态图像/视频      | **Qwen3.5-4B / 9B**                                  | MiniCPM-V-4.6、Gemma 4 E4B、Marlin-2B       | Qwen3.5 更像通用 VLM 主力；Marlin 仍适合视频时间定位。     |
| OCR/文档解析      | Qwen3.5 视觉能力很强                                       | PaddleOCR-VL、NuExtract3                   | **结构化文档输出仍建议保留 PaddleOCR-VL/NuExtract3**。 |
| ASR 语音转文字     | **Qwen3-ASR-0.6B / 1.7B**                            | Cohere Transcribe 2B                      | 中文、方言、混合场景优先 Qwen；英文高速转写可试 Cohere。        |
| TTS 文字转语音     | **Qwen3-TTS-0.6B / 1.7B**                            | Supertonic 3、SILMA TTS                    | Qwen3-TTS 现在非常值得优先试。                      |
| RAG 检索        | Qwen3 Embedding/Reranker、Qwen3-VL Embedding/Reranker | Granite Embedding R2、Ettin reranker       | 文本 RAG 两边都强；多模态 RAG 更偏 Qwen3-VL。          |
| 一体式语音/图像/视频助手 | Qwen2.5-Omni / Qwen3-Omni / Qwen3.5-Omni             | MiniCPM-V + ASR + TTS 拼装                  | 本地 Mac 上我更建议拆分 pipeline，不建议一上来 Omni 大一统。  |

## Qwen3.5 本身强在哪里？

Qwen3.5 不是单纯文字 LLM，它在 HF 上是 **Image-Text-to-Text** 系列，官方 collection 里有 0.8B、2B、4B、9B、27B、35B-A3B、122B-A10B、397B-A17B 等多档，还提供 27B、35B-A3B、122B-A10B、397B-A17B 的 GPTQ-Int4 版本。([Hugging Face][1])

对你的 **128GB MacBook** 来说，真正值得关注的是：

| 模型                              |   适合度 | 用法建议                                              |
| ------------------------------- | ----: | ------------------------------------------------- |
| **Qwen3.5-4B**                  | ⭐⭐⭐⭐⭐ | 轻量主力，跑聊天、视觉、文档截图、agent 都很舒服。                      |
| **Qwen3.5-9B**                  | ⭐⭐⭐⭐⭐ | 我会把它当成 128GB Mac 的默认主力。质量、体积、速度比较均衡。              |
| **Qwen3.5-35B-A3B GPTQ-Int4**   |  ⭐⭐⭐⭐ | 上限款。35B 总参数、3B active，适合更高质量推理/视觉/代码。             |
| **Qwen3.5-27B GPTQ-Int4**       |   ⭐⭐⭐ | dense 27B，更重。除非测试后明显比 35B-A3B 更合你口味，否则优先 35B-A3B。 |
| **Qwen3.5-122B-A10B GPTQ-Int4** |    ⭐⭐ | 128GB 可能能折腾，但不算“小模型”，上下文一长就容易变成内存吞金兽。             |

Qwen3.5-4B 和 9B 都是带视觉编码器的 causal language model，模型卡写明支持 262,144 token 原生上下文，且可扩展到 1,010,000 tokens；4B/9B 的官方表里还列了语言、长上下文、代码、视觉、OCR、视频理解、视觉 agent 等 benchmark。([Hugging Face][2])
Qwen3.5-35B-A3B 是 35B 总参数、3B active 的 MoE 版本，也带视觉编码器，Apache 2.0，并支持 vLLM、SGLang、KTransformers 等生态。([Hugging Face][3])

所以它和我之前提到的 LFM2.5、MiniCPM5、Gemma 4 比：

**Qwen3.5 更像“主力万金油”。**中文、英文、视觉、agent、长上下文、工具调用都覆盖得很完整。
**MiniCPM5-1B 更像“轻量常驻猫爪”。**需要极低延迟、小脚本、本地路由时还值得留。
**LFM2.5-8B-A1B 更像“低 active 参数 agent 实验品”。**它的 on-device agent 方向很有意思，但综合生态和全模态覆盖，Qwen3.5 更强势。
**Gemma 4 的优势是 Google/MLX/llama.cpp 生态和 MoE 小 active 路线**，但在中文、多模态 agent、Qwen 自家语音生态联动上，Qwen 更整齐。

## 语音：Qwen 确实有 ASR，也有 TTS

### ASR：Qwen3-ASR-0.6B / 1.7B

Qwen3-ASR 家族包括 **Qwen3-ASR-1.7B** 和 **Qwen3-ASR-0.6B**，支持语言识别和 ASR，覆盖 30 种语言与 22 种中文方言/口音，支持 offline 和 streaming，同一个模型可以转写长音频；还配套 **Qwen3-ForcedAligner-0.6B** 做时间戳/强制对齐。([Hugging Face][4])

和 **Cohere Transcribe 03-2026** 比：

| 场景                              | 我会选                                  |
| ------------------------------- | ------------------------------------ |
| 中文普通话、粤语、方言、混合口音                | **Qwen3-ASR-1.7B**                   |
| 需要自动语言识别                        | **Qwen3-ASR**                        |
| 需要 timestamp / forced alignment | **Qwen3-ASR + Qwen3-ForcedAligner**  |
| 英文/欧洲语言高速批量转写                   | **Cohere Transcribe** 也很香            |
| 要 Apple Silicon 现成生态            | Cohere 有 mlx-audio 支持，Qwen 可能需要多折腾一点 |
| 歌声、BGM、复杂音频                     | 优先试 Qwen3-ASR-1.7B                   |

Cohere Transcribe 是 2B 专用 ASR，支持 14 种语言，模型卡明确说没有自动语言检测，也没有时间戳/说话人分离；优点是专用 Conformer ASR 架构、效率高，并有 Transformers、vLLM、mlx-audio、Transformers.js/WebGPU 等生态。([Hugging Face][5])
所以砚砚的新排序是：**中文/多语/方言/时间戳选 Qwen3-ASR；英文批量高速转写也把 Cohere 放进测试池。**

### TTS：Qwen3-TTS-0.6B / 1.7B

Qwen3-TTS collection 里有 **0.6B** 和 **1.7B** 多个版本，包括 Base、CustomVoice、VoiceDesign，以及 tokenizer；GitHub README 写明它是 Apache 2.0，支持 voice clone、voice design、自然语言控制声音风格，并覆盖中文、英文、日语、韩语、德语、法语、俄语、葡萄牙语、西班牙语、意大利语 10 种语言。([Hugging Face][6])

这块我会直接把 Qwen3-TTS 放到比 Supertonic 3 更前面，除非你特别需要 Supertonic 的 ONNX/on-device 形态或 31 语言覆盖。
**128GB MacBook 跑 0.6B/1.7B TTS 没问题，主要问题不是内存，而是依赖、FlashAttention、PyTorch/MPS 支持和实时速度。**

## 那本地搭配怎么改？

我会把你 MacBook 128GB 的推荐栈改成这样：

| 位置            | 推荐                                                    |
| ------------- | ----------------------------------------------------- |
| 主力聊天/视觉/agent | **Qwen3.5-9B**                                        |
| 更轻主力          | **Qwen3.5-4B**                                        |
| 高质量上限         | **Qwen3.5-35B-A3B-GPTQ-Int4**                         |
| 轻量常驻/路由       | MiniCPM5-1B 或 Qwen3.5-0.8B/2B                         |
| ASR           | **Qwen3-ASR-1.7B**，另备 Cohere Transcribe               |
| TTS           | **Qwen3-TTS-1.7B-CustomVoice / VoiceDesign**，轻量用 0.6B |
| OCR/文档结构化     | PaddleOCR-VL-1.6 + NuExtract3                         |
| 文本 RAG        | Qwen3-Embedding/Reranker 或 Granite + Ettin            |
| 多模态 RAG       | **Qwen3-VL-Embedding-2B / Reranker-2B**               |

Qwen3-VL-Embedding/Reranker 是 Qwen 家的多模态检索线，官方介绍它们面向 text、images、screenshots、videos 以及混合输入，提供 2B 和 8B 两个尺寸；也就是说，做“截图/PDF 页面/视频片段检索”时，它比纯文本 embedding 更对口。([GitHub][7])

## Omni 要不要用？

Qwen 还有 Omni 路线。Qwen2.5-Omni-7B 是端到端多模态模型，能处理 text、image、audio、video，并生成文本和自然语音响应。([Hugging Face][8])
Qwen3.5-Omni 技术报告也已经有了，描述的是更大的 omni-modal 系统，支持文本、视觉、音频、音视频理解，以及 10 种语言的语音生成。([arXiv][9])

但砚砚对你这台 128GB MacBook 的建议是：**先别一上来追 Omni 大一统。**
更稳的本地方案是：

```text
麦克风/音频
  -> Qwen3-ASR-1.7B
  -> Qwen3.5-9B 或 35B-A3B
  -> Qwen3-TTS-1.7B
  -> 播放语音
```

这样每个环节都能单独替换、调参、量化、debug。Omni 是一只大章鱼，优雅，但本地排错时会喷墨。

## 最终砚砚版结论

你问“这些和 Qwen3 / Qwen3.5 比起来如何”，我的判断是：

**Qwen3.5 已经应该成为 128GB MacBook 本地小模型栈的核心。**
尤其是 **Qwen3.5-9B** 和 **Qwen3.5-35B-A3B-GPTQ-Int4**，一个当日常主力，一个当质量上限。

但我不会只装 Qwen。最实用的组合是：

```text
Qwen3.5-9B
+ Qwen3.5-35B-A3B-GPTQ-Int4
+ Qwen3-ASR-1.7B
+ Qwen3-TTS-1.7B
+ PaddleOCR-VL / NuExtract3
+ Qwen3-VL-Embedding 或 Granite+Ettin
```

这套就是“本地小型多模态工作站猫窝”：能聊、能看图、能读 PDF、能听、能说、能做 RAG。128GB MacBook 扛得住，真正要小心的是长上下文、视频帧数、音频实时性和 Python 依赖的猫毛球。

[1]: https://huggingface.co/collections/Qwen/qwen35 "Qwen3.5 - a Qwen Collection"
[2]: https://huggingface.co/Qwen/Qwen3.5-4B "Qwen/Qwen3.5-4B · Hugging Face"
[3]: https://huggingface.co/Qwen/Qwen3.5-35B-A3B "Qwen/Qwen3.5-35B-A3B · Hugging Face"
[4]: https://huggingface.co/Qwen/Qwen3-ASR-1.7B "Qwen/Qwen3-ASR-1.7B · Hugging Face"
[5]: https://huggingface.co/CohereLabs/cohere-transcribe-03-2026?utm_source=chatgpt.com "CohereLabs/cohere-transcribe-03-2026"
[6]: https://huggingface.co/collections/Qwen/qwen3-tts "Qwen3-TTS - a Qwen Collection"
[7]: https://github.com/QwenLM/Qwen3-VL-Embedding?utm_source=chatgpt.com "QwenLM/Qwen3-VL-Embedding"
[8]: https://huggingface.co/Qwen/Qwen2.5-Omni-7B "Qwen/Qwen2.5-Omni-7B · Hugging Face"
[9]: https://arxiv.org/abs/2604.15804?utm_source=chatgpt.com "Qwen3.5-Omni Technical Report"


