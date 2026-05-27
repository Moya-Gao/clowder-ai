---
feature_ids: [F195, F104]
topics: [speaker-verification, voiceprint, interaction-model, streaming-video, world-model, perception, embodied-ai]
doc_kind: research
created: 2026-05-27
---

# Research Brief: 多模态共同感知 — 声纹识别 · 交互模型 · 流式视频理解

> **发起猫**: 布偶猫 宪宪 (Claude Opus 4.6)
> **驱动事件**: 铲屎官和 TTS/ASR/interaction model 领域朋友聊天后提出的三个调研方向（2026-05-27）
> **铲屎官原话**: "我现在新的愿景是大猫猫如果我带着眼镜或者比如说大疆的运动摄像机+收音的哪些设备，你们能真的和我有共同的感知。甚至你可以看看那些 world model"

---

## 1. Problem Frame（任务边界）

**我们要回答的问题**：

三个独立但递进相关的技术方向——各自的 2026 年技术成熟度、开源可用性、Apple Silicon 本地部署可行性：

1. **声纹识别（Speaker Verification/Identification）**：我们 F195 Meeting Copilot Phase C 做了 speaker enrollment，但用的是纯规则归因（mic→host, 2人会→other），没有真正的 voice embedding 比对。朋友说"现在很成熟了"——2026 年实时声纹识别到底能做到什么水平？开源方案（pyannote / wespeaker / 3D-Speaker / ECAPA-TDNN）在 Apple Silicon 上跑的可行性和延迟？

2. **TML interaction model 400ms 延迟**：铲屎官的朋友说"TML 的 interaction model 能做到 400ms"——TML 是哪个公司/项目/框架？interaction model 指什么（实时对话 turn-taking？端到端语音对话？语音交互 agent？）？400ms 端到端延迟的技术路径是什么（流式 ASR + streaming LLM + streaming TTS？专用端到端模型？）？

3. **流式视频理解 + 世界模型**：不再是"30s 抽一帧"的视频理解，而是 streaming attention + token pruning + 实时处理。2026 年有哪些方案可以做 always-on 视频流理解？世界模型（World Model）在感知层的进展如何？哪些可以部署在消费级硬件（M4 Max 128GB）上？

**非目标（明确排除）**：
- 不调研云端 API 方案（我们做本地推理，隐私第一）
- 不调研 Android/Windows 平台（我们是 Apple 生态——Mac + iOS + AirPods）
- 不调研 TTS 合成（已有 F066/F103 覆盖，声线克隆方向单独立项）
- 不调研 ASR 模型替换（F195 Phase F 已验证 Qwen3-ASR-1.7B 够用，管道是瓶颈不是模型）
- 不做产品设计或 Feature spec（这次纯技术调研，落地方案后续再定）

**为什么现在要研究这个**：
- **直接催化**：铲屎官和领域专家朋友聊天，带回三个方向的关键信号——"声纹识别很成熟了"、"TML 做到 400ms"、"流式注意力+token 剪枝"
- **Feature 关联**：F195 Meeting Copilot 已跑完 Phase A-F，speaker identification 是下一个质量跃迁点；F104 Local Omni Perception 处于 spec 阶段待推进
- **愿景升级**：铲屎官从"会议私人智囊团"升级到"共同感知伙伴"——戴眼镜/运动摄像机+收音设备，猫猫能看到铲屎官看到的、听到铲屎官听到的

## 2. Current Hypotheses（我们的假设）

我们目前的判断是：

1. **声纹识别**：2026 年的 speaker verification / identification 在受控条件下（安静环境、enrollment 有几秒纯净语音）可以做到 >95% 准确率，但实时会议场景（多人交叉说话、远场麦克风、混响）会显著退化。我们猜 pyannote-audio v3+ 是开源最佳选择，但不确定它在 Apple Silicon 上的推理延迟能否满足实时要求（<200ms per segment）。

2. **TML interaction model**：我们完全不确定 TML 是什么。可能的候选：
   - Turing Machine Labs（图灵机实验室）？
   - 某个 2025-2026 年新出的端到端对话模型/框架？
   - "Interaction model" 可能指 turn-taking prediction + 端到端语音对话的组合？
   - 400ms 端到端延迟可能指 streaming ASR（first-token ~150ms）+ streaming LLM（first-token ~100ms）+ streaming TTS（first-token ~150ms）的 pipeline overlap？

3. **流式视频理解**：2026 年视频理解正在从"抽帧→VLM 逐帧处理"向"streaming tokenizer + sliding window attention + KV-cache reuse"演进。token pruning（剔除低信息量帧 token）和 temporal compression 是关键效率手段。但我们猜在消费级硬件上 always-on 视频理解（>5 FPS 处理速率）可能还做不到——MoE 模型 3B 激活处理单帧已需 ~100-200ms，连续视频流需要大幅裁剪。

4. **World Model**：世界模型在自动驾驶/机器人领域进展迅速（GAIA-1, UniWorld, Sora-like），但在"个人助手共同感知"场景的应用案例非常少。我们猜 world model 对我们的短期价值有限（不是 0，但不如前三个方向直接），可能更适合中长期布局。

**证据缺口**：
- pyannote / wespeaker 在 Apple Silicon (MPS/MLX/CoreML) 上的实际推理速度——没找到 benchmark
- TML 到底是谁/什么——信息完全空白
- 2026 年有没有专为 Apple Silicon 优化的流式视频理解模型
- "400ms 端到端"是 pipeline overlap 还是单模型端到端？两者架构完全不同
- 实际会议场景（远场、混响、多人交叉）下声纹识别的退化幅度——实验室数据 vs 实战差多少

> ⚠️ 这些是我们的初步假设，不是结论。请在调研中验证或推翻它们。

## 3. Disconfirm First（先找反例）

在给出支持性证据之前，请优先：

1. **声纹识别**：寻找"2026 年实时声纹识别在会议场景仍然不可靠"的证据。特别是远场麦克风、cocktail party 问题、短语音段（<2s）的退化数据。如果朋友说"很成熟了"是在受控条件下，我们需要知道边界在哪。
2. **TML 400ms**：寻找"400ms 端到端延迟是营销数字而非实测数字"的证据。查一下实际 demo/paper 里的 P50/P95 延迟，以及是否有隐藏条件（预缓存、短回复、特定硬件）。
3. **流式视频理解**：寻找"消费级硬件上 always-on 视频理解在 2026 年仍不现实"的证据。特别是功耗/发热、显存占用、处理延迟的实际数据。
4. **整体方向**：寻找"embodied perception / always-on multimodal 方向在个人助手场景失败"的案例——是否有创业公司/产品尝试过类似愿景但未成功？失败原因是什么？

## 4. Source Mix Quota（来源配额）

请确保来源覆盖以下类型（不必每类都有，但不能只有一种）：
- [ ] 学术论文 / 正式研究报告（INTERSPEECH 2025/2026, ICASSP 2026, CVPR 2026, NeurIPS 2025/2026）
- [ ] 工程博客 / 技术复盘（优先一手工程实录——模型作者的部署日志、竞品的技术 post-mortem）
- [ ] 开源项目实现（GitHub repo, model card, benchmark result — pyannote, wespeaker, 3D-Speaker, VITA, LLaVA-Video, VideoLLM-Online 等）
- [ ] 竞品/同行方案文档（Granola, Otter.ai, Fireflies, Recall.ai, Rewind/Limitless, Humane AI Pin, Ray-Ban Meta — 他们的 speaker diarization / real-time 方案）
- [ ] 产品实测报告（不是 PR 稿，是用户/开发者实测——延迟、准确率、功耗的第一手数据）

## 5. Local Constraints（我们的约束）

调研结论必须在以下约束下可行：

- **硬件**：MacBook Pro M4 Max 128GB（48 GPU cores, ~400 GB/s 带宽）——所有推理必须在这台机器上本地运行
- **Apple Silicon 优先**：MLX / CoreML / MPS (Metal Performance Shaders) 是我们的推理栈，PyTorch MPS 是 fallback，ONNX Runtime 也可以
- **隐私**：音频/视频数据不离开本机（F195 基本原则），cloud API 排除
- **实时性要求**：speaker identification 需要 <500ms（猫标注转写用），视频理解可以 1-3s 延迟（不需要帧级实时）
- **并行推理预算**：已有 ASR 1.7B + LLM 后修 4B 在跑，新增模型不能让总显存超 64GB（128GB 的一半留给系统和猫猫 agent LLM）
- **多引擎协作**：我们是多 AI 引擎（Claude/GPT/Gemini）共同工作，感知层的输出需要能被任何引擎消费（纯文本 / structured JSON）
- **已有管道**：F195 Meeting Copilot 已有 audio-service.py（Python aiohttp）+ VAD chunker（Silero VAD）+ ASR（Qwen3-ASR-1.7B via MLX）+ LLM 后修（Qwen3-4B）——新能力应该能接入这个管道，不是另起炉灶
- **Python 优先**：感知层全是 Python（音频服务、VAD、ASR、后修），新增组件也应该是 Python

## 6. Output Schema（输出格式）

请按以下结构分三个方向分别输出：

### 方向一：声纹识别（Speaker Verification/Identification）

#### 支持我们假设的证据
| 证据 | 来源 | 置信度（高/中/低） | 可验证性 |
|------|------|---------|---------|

#### 反对我们假设的证据
| 证据 | 来源 | 置信度（高/中/低） | 影响评估 |
|------|------|---------|---------|

#### 开源方案对比
| 方案 | 模型大小 | 推理框架 | Apple Silicon 支持 | 实时性（ms/segment） | EER / accuracy | 会议场景实测 |
|------|---------|---------|-------------------|---------------------|---------------|------------|

#### 我们没考虑到的维度
| 维度 | 为什么重要 | 建议的调研深入方向 |
|------|----------|------------------|

### 方向二：TML Interaction Model

#### TML 身份确认
| 可能身份 | 证据 | 置信度 | 来源 |
|---------|------|--------|------|

#### 400ms 端到端延迟分析
| 技术路径 | 各段延迟分布 | 是否实测数据 | 隐藏条件 |
|---------|------------|-----------|---------|

#### 可借鉴的技术点
| 技术 | 我们能否用 | 接入难度 | 预期收益 |
|------|----------|---------|---------|

### 方向三：流式视频理解 + 世界模型

#### 2026 年流式视频理解方案对比
| 方案/模型 | 架构 | 处理速率 (FPS) | 显存需求 | Apple Silicon 可行性 | 开源？ |
|---------|------|---------------|---------|---------------------|-------|

#### Token Pruning / Streaming Attention 技术路径
| 技术 | 论文/项目 | 压缩率 | 精度损失 | 适用场景 |
|------|---------|--------|---------|---------|

#### World Model 在个人助手场景的适用性
| 模型/项目 | 原始领域 | 迁移到个人助手的可行性 | 缺什么 |
|---------|---------|-------------------|-------|

### 三个方向的置信度总评
- 假设 1（声纹识别成熟度）：{支持/反对/未定} — 理由
- 假设 2（TML 身份和 400ms 延迟）：{支持/反对/未定} — 理由
- 假设 3（消费级硬件流式视频理解）：{支持/反对/未定} — 理由
- 假设 4（World Model 短期价值有限）：{支持/反对/未定} — 理由

## 7. Decision Interface（决策映射）

对于每个调研发现，请标注建议的行动：
- **采纳**：证据充分，建议我们直接采用（下一个 Phase 就做）
- **试点**：有潜力但需要 spike 验证（先跑个 2 天 spike 再决定）
- **搁置**：当前不适用或证据不足（记录但不投入）

并说明如何落地到我们现有体系：
- **F195 Meeting Copilot**：哪些能直接接入当前 audio-service.py 管道？
- **F104 Local Omni Perception**：哪些应该成为 F104 Phase A/B 的输入？
- **新 Feature**：是否需要开新 Feature？如果是，scope 建议？

## 8. Risk Register（风险登记）

如果我们基于本次调研结论做决策，最可能出错的地方是：

1. **声纹识别在实际会议场景退化严重**：实验室 EER<1% 但会议现场（混响+远场+交叉说话）退化到 10-20%，投入产出比不高 → 建议：先用现有录音做 spike，不要先工程化
2. **TML 可能是小众/非公开项目**：如果查不到是谁，这个方向就无法借鉴 → 建议：记录可能性候选，等铲屎官下次和朋友确认
3. **流式视频理解显存预算超限**：视频模型通常需要大量 KV-cache，和已有 ASR+LLM 并行可能超出 64GB 预算 → 建议：重点关注 <4GB 显存的轻量方案
4. **"共同感知"愿景过于超前**：硬件（眼镜+摄像机+收音）的 UX 体验可能很差（重量、续航、发热），技术可行但产品不可行 → 建议：调研现有 AR/智能眼镜产品的实际用户反馈

---

## 本地锚点注入（自动填充）

### 当前 Feature Spec 摘要

**F195 Meeting Copilot**（in-progress, Phase A-F completed）：
- Why: 铲屎官 AUDHD，圆桌会议中不知道何时插话、如何措辞、如何表达。猫是私人智囊（augmentation），不是会议参与者
- 已完成: 音频采集→ASR 转写→转写持久化→path injection→UI 控制→VAD+热词+LLM 后修
- Speaker enrollment 现状: 纯规则归因（mic=host, 2人会=other speaker），无 voice embedding

**F104 Local Omni Perception**（spec, 未开始）：
- Why: 猫猫从"只会读写的文字 AI"变成"能听能看能说的全感知伙伴"
- Phase A: Qwen3-Omni-30B-A3B 替换 ASR+LLM后修+TTS
- Phase B: Qwen3.5-35B-A3B 视觉理解

### 相关 ASR 调研

**2026-05-19 ASR 质量调研**（两份独立调研收敛同一结论）：
- 问题不在模型（Qwen3-ASR 中文 WER 4.97），在管道（无 VAD / 无热词 / 无后处理）
- Phase F 已修管道：Silero VAD + 热词注入 + LLM 后修 + 标点恢复
- 下一个质量跃迁点: speaker identification（从规则归因→voice embedding）

### 最近教训

- **LL-048**: 用户数据默认持久化——音视频感知数据同理，不离开本机
- **F195 Phase F install script 事件**: 依赖写错（fastapi→aiohttp）导致服务启动失败——新增依赖必须实际验证 import chain

### BACKLOG 关联

- F195 Phase A（会前预热+会后复盘）还未做——speaker diarization 的会后批处理可以在这里接入
- F104 整体待推进——视频理解可能成为 F104 Phase B 的输入
- 铲屎官的"共同感知"愿景可能催生新 Feature（F-next: Embodied Perception / Always-On Multimodal）
