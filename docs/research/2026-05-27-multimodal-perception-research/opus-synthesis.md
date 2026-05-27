---
feature_ids: [F195, F104]
topics: [speaker-verification, voiceprint, interaction-model, streaming-video, world-model, perception]
doc_kind: research
created: 2026-05-27
---

# 多模态共同感知调研 — 布偶猫初步综合

> **From**: 布偶猫 宪宪 (Opus 4.6)
> **Date**: 2026-05-27
> **Method**: WebSearch 多轮搜索 + 本地 codebase 对照（非 Deep Research 完整三路）
> **Status**: 初步综合——三路 Deep Research 回收后需更新

---

## 方向一：声纹识别（Speaker Verification/Identification）

### 结论（60 秒版）

**朋友说得对——声纹识别技术确实成熟了。** 而且有人已经把 pyannote + WeSpeaker 搬到 Apple Silicon MLX 上了。

### 关键发现

#### 1. speech-swift：开箱即用的 Apple Silicon 方案 🔥

[speech-swift](https://github.com/soniqo/speech-swift)（Apache 2.0，2026 年初发布）是一个 **native Swift + MLX** 的语音工具包，已经集成了我们需要的三件套：

| 组件 | 模型 | 大小 | 用途 |
|------|------|------|------|
| Silero VAD v5 | ONNX→MLX | ~2MB | 语音活动检测（我们 Phase F 已用 Python 版） |
| pyannote segmentation 3.0 | PyTorch→MLX | ~15MB | 多说话人时间分段（"谁在什么时候说话"） |
| WeSpeaker ResNet34 | PyTorch→MLX | ~15MB | 说话人嵌入向量（"这个声音是谁"） |
| **总计** | | **~32MB** | 完整 diarization pipeline |

**关键数字**：
- Silero VAD: **~40µs/chunk** on M2 Max（我们的 M4 Max 更快）
- pyannote: **2.5% 实时因子** on GPU（即 1 小时音频只需 1.5 分钟处理）
- 32MB 总模型大小——对比我们现有 ASR 1.7B (~2GB) 微不足道

#### 2. WeSpeaker ECAPA-TDNN 准确率

| 测试集 | EER | 说明 |
|--------|-----|------|
| VoxCeleb1 | **1.42%** | 英文，受控条件 |
| CN-Celeb1 | **8.30%** | 中文，更接近真实条件 |
| ECAPA-TDNNLite | **3.07%** (VoxCeleb1) | 轻量版，仅 11.6M FLOPS |

**注意**：CN-Celeb1 的 8.30% EER 显示中文/真实场景下有退化。会议场景（远场、混响、交叉说话）退化幅度需要 spike 实测。

#### 3. pyannote 3.1 的改进

pyannote/speaker-diarization-3.1 去掉了 onnxruntime 依赖，纯 PyTorch 实现。HuggingFace 上已有 MLX 转换权重（`mlx-community/pyannote-segmentation-3.0-mlx`）。

#### 4. 我们的接入路径

**两条路可选**：

| 路径 | 语言 | 优点 | 缺点 |
|------|------|------|------|
| **A: speech-swift 直接用** | Swift | 32MB、MLX 原生、开箱即用 | 需要 Swift↔Python 桥接（audio-service.py 是 Python） |
| **B: Python pyannote + wespeaker** | Python | 直接嵌入 audio-service.py | PyTorch MPS backend，非 MLX 原生，模型大一些 |

**推荐**：先走路径 B（Python 嵌入），验证准确率和延迟。如果需要极致性能再迁移到路径 A（Swift MLX）。

#### 与现有代码的差距

当前 `audio-service.py` 的 `_attribute_speaker()` 方法（L154-164）是纯规则：
- mic 模式 → 归 host
- app 模式 + 2 人 → 归 non-host
- 其他 → "有人说" (confidence 0.4)

**升级到 voice embedding 需要**：
1. Enrollment 阶段：每个参会者录 3-5s 纯净语音 → 提取 embedding → 存储
2. 实时阶段：每个 ASR 段提取 embedding → cosine similarity 对比 enrolled → 最近邻归因
3. Fallback：similarity < threshold → 降级到规则归因（保持现有行为）

### 假设验证

| 假设 | 结果 | 说明 |
|------|------|------|
| >95% 准确率（受控条件） | ✅ 支持 | EER 1.42% ≈ ~97% 准确率（VoxCeleb1） |
| 会议场景显著退化 | ⚠️ 部分支持 | CN-Celeb1 退化到 8.30%，但这不是"会议"场景，是"真实环境"；远场+交叉说话需实测 |
| pyannote 是开源最佳 | ✅ 支持 | pyannote 3.1 + WeSpeaker 是事实上的开源标准组合 |
| Apple Silicon 延迟 <200ms | ✅ 很可能支持 | speech-swift 已在 M2 Max 上跑通，VAD 40µs/chunk；但 embedding 提取延迟未见明确数字 |

### 行动建议

- **采纳**：在 F195 下一个 Phase 接入 speaker verification（Python 路径 B）
- **试点**：先用铲屎官现有会议录音跑 offline speaker diarization，评估中文会议的实际 EER
- **搁置**：speech-swift (Swift MLX) 迁移放长期——先验证 Python 方案够不够用

---

## 方向二：TML Interaction Model

### 结论（60 秒版）

**TML = Thinking Machines Lab**，Mira Murati（前 OpenAI CTO）创办。他们 2026 年 5 月 11 日发布了 "interaction model" 研究预览——276B MoE/12B 激活，**200ms 微回合实现全双工对话**，turn-taking 延迟 0.40s。这是 2026 年最前沿的实时交互 AI 架构。

### 关键发现

#### 1. TML-Interaction-Small 技术规格

| 指标 | 数据 |
|------|------|
| **参数量** | 276B MoE, **12B 激活** |
| **微回合粒度** | 200ms（每 200ms 交替处理输入和生成输出） |
| **模态** | 音频 + 视频 + 文本 同步 |
| **turn-taking 延迟** | **0.40s**（FD-bench v1） |
| **对比 Gemini 3.1 Flash Live** | 0.57s（TML 快 30%） |
| **对比 GPT-realtime-2.0** | 1.18s（TML 快 66%） |
| **FD-bench v1.5 综合评分** | TML 77.8 vs Gemini 54.3 vs GPT 47.8 |
| **架构** | 双模型：live interaction model + async background reasoning |

#### 2. 为什么 400ms 不是"营销数字"

铲屎官的朋友说"400ms"——这和 FD-bench v1 的实测数据 0.40s 完全吻合。这是第三方 benchmark 数据（虽然 TML 自己设计了 FD-bench，但数字是可验证的）。

**400ms 的技术路径**不是传统 pipeline overlap（ASR→LLM→TTS），而是**原生多模态端到端**：
- 传统 pipeline：150ms ASR first-token + 100ms LLM first-token + 150ms TTS first-token = ~400ms（理论最优，实际更慢）
- TML 方案：不做 pipeline，**模型本身就是多模态的**，200ms 微回合连续处理+输出，消除了模块间的等待

#### 3. 对我们的意义

**短期（6 个月内）不直接可用**：
- 276B/12B 激活不可能在 M4 Max 本地跑（需要 A100 级别）
- 仅 limited research preview，无公开 API
- 即使有 API 也违反我们的本地隐私原则

**长期借鉴价值 🔥**：
- **微回合架构思想**：200ms 粒度的 interleave 处理可以启发我们的本地管道优化
- **全双工设计**：我们当前是半双工（听→处理→说），TML 证明全双工是可行的
- **端到端多模态**：F104 的 Qwen3-Omni 方向和 TML 理念一致——用一个模型替换 pipeline

#### 4. FD-bench 的价值

TML 设计的 FD-bench 是**第一个专门评测全双工实时交互**的 benchmark。即使我们不用 TML 的模型，这个 benchmark 的评测维度值得参考：
- 轮换延迟（turn-taking latency）
- 打断响应（barge-in handling）
- 并行处理（simultaneous listen+speak）

### 假设验证

| 假设 | 结果 | 说明 |
|------|------|------|
| 不知道 TML 是谁 | ✅ 已确认 | Thinking Machines Lab，Mira Murati 创办，2026-05-11 发布 |
| 400ms 是 pipeline overlap | ❌ 推翻 | 不是 pipeline，是原生端到端多模态，200ms 微回合 |
| 可能是小众项目 | ❌ 推翻 | 前 OpenAI CTO + 顶级 benchmark 表现，已有广泛报道 |

### 行动建议

- **搁置**（直接使用）：276B 模型无法本地部署，closed preview 无法接入
- **采纳**（思想借鉴）：微回合架构 + FD-bench 评测框架 → 纳入 F104 Omni 设计参考
- **关注**（长期）：等 wider release + 是否开源/开放 API + 是否有小模型版本

---

## 方向三：流式视频理解 + 世界模型

### 结论（60 秒版）

**流式视频理解正在快速进步**——token pruning 已能在 93.5% 压缩率下保持 95%+ 准确率，KV-cache 压缩 15.7× 且几乎不损失精度。但 always-on 消费级部署仍需要 7B 级视频模型，在 M4 Max 上可行但需要精心的显存管理。**世界模型对我们短期价值有限**，更适合中长期布局。

### 关键发现

#### 1. StreamingTOM（2025/2026，训练无关方法）

| 指标 | 数据 |
|------|------|
| 基础模型 | LLaVA-OV-7B |
| KV-cache 压缩比 | **15.7×** |
| 准确率保持 | 96.1%（32 帧 vs baseline） |
| 峰值内存降低 | 1.2× |
| TTFT 加速 | **2×** |
| 方法 | Causal Temporal Reduction + Online Quantized Memory |
| 需要训练？ | **不需要**（training-free） |

#### 2. StreamingAssistant（2025，token pruning）

| 指标 | 数据 |
|------|------|
| Token 剪枝率 | **93.5%** |
| 相对准确率 | **95.27%**（剪枝后 vs 未剪枝） |
| 剪枝延迟 | **<1ms** |
| 度量 | MSSAVT（Maximum Similarity to Spatially Adjacent Video Tokens） |

**关键洞察**：93.5% 的 token 被剪掉但只损失 4.73% 准确率——这意味着视频中绝大部分帧间信息是冗余的，对我们的"共同感知"场景（铲屎官日常视角，非高速动作）特别有利。

#### 3. 对 M4 Max 128GB 的可行性分析

| 方案 | 模型大小 | 显存需求（推理） | 备注 |
|------|---------|---------------|------|
| LLaVA-OV-7B + StreamingTOM | ~4GB (Q4) | ~8-12GB | 可行，但需要和 ASR+LLM 共存 |
| Qwen3.5-35B-A3B (F104 Phase B) | ~18GB (Q4) | ~20-24GB | MoE 3B 激活，可行但紧张 |
| 轻量视觉编码器 (SigLIP/DINOv2) | <1GB | <2GB | 只做特征提取，不做问答 |

**显存预算**（并行推理时）：
```
ASR 1.7B:      ~2GB
LLM 后修 4B:   ~3GB
Speaker Embed:  ~0.03GB (32MB)
视频理解 7B:   ~8GB (Q4)
---------------------
总计:          ~13GB ← 在 64GB 预算内，有余裕
```

#### 4. 世界模型现状

- 主要用于自动驾驶和机器人（GAIA-1, UniWorld, WorldArena）
- "个人助手共同感知"场景几乎没有现成方案
- 学术界在做"embodied AI 三层框架"：感知→世界建模→决策，但工程落地很远
- **Meta 收购 Limitless**（2025.12）：Meta 在建 always-on perception 产品（Ray-Ban + Limitless 数据），但已停售 Pendant

#### 5. Limitless Pendant 经验教训

Limitless（原 Rewind.ai）的 always-on 音频捕获产品给了我们几个关键信号：
- **用户体验 3.9/5**：有用但不够好——transcription accuracy 是主要槽点
- **续航**：8-10 小时（有 30-40% 电），always-on 模式 12-14 小时就没了
- **Meta 收购停售**：2025.12 收购后停产，现有用户被迁移到免费计划但无新功能
- **启示**：always-on 音频已验证为有价值，视频比音频难得多（数据量、功耗、隐私）

### 假设验证

| 假设 | 结果 | 说明 |
|------|------|------|
| 消费级 always-on 视频理解做不到 | ⚠️ 部分推翻 | 7B 模型 + StreamingTOM 可以在 M4 Max 跑，但不是"always-on"（需要精心管理显存和功耗） |
| Token pruning 是关键效率手段 | ✅ 强力支持 | 93.5% 剪枝率 + 95%+ 准确率，且 <1ms 剪枝延迟 |
| World Model 短期价值有限 | ✅ 支持 | 工程落地很远，个人助手场景没有现成方案 |

### 行动建议

- **试点**：在 F104 Phase B 试接 LLaVA-OV-7B + StreamingTOM，评估 M4 Max 上的实际 FPS 和显存
- **采纳**：token pruning 技术（StreamingAssistant 的 MSSAVT 思路）作为视频输入的标准预处理
- **搁置**：World Model 记录为长期方向（>6 个月），不投入工程资源
- **关注**：Meta 的 Ray-Ban + always-on perception 进展——他们是最有可能先做出消费级方案的

---

## 三个方向的优先级排序

| 排名 | 方向 | 落地难度 | 预期收益 | 建议时间线 |
|------|------|---------|---------|-----------|
| 🥇 | **声纹识别** | ⭐⭐ 低 | 🔥🔥🔥 高 | **下一个 Phase 就做**（F195 Phase G?） |
| 🥈 | **流式视频理解** | ⭐⭐⭐ 中 | 🔥🔥 中 | F104 Phase B spike（2-3 天验证） |
| 🥉 | **TML 微回合架构** | ⭐⭐⭐⭐⭐ 不可直接用 | 🔥 设计参考 | 记录为 F104 设计输入 |

### 回答铲屎官的愿景

> "我现在新的愿景是大猫猫如果我带着眼镜或者比如说大疆的运动摄像机+收音的哪些设备，你们能真的和我有共同的感知"

**技术可行性评估**：

| 感知通道 | 2026 可行性 | 我们的现状 | 差距 |
|---------|-----------|----------|------|
| 🎤 音频 | ✅ 已可用 | F195 Phase F（VAD+ASR+后修） | 差 speaker verification |
| 🗣️ 声纹 | ✅ 已成熟 | 规则归因 | 差 embedding 对比（~2 天接入） |
| 👁️ 视频 | ⚠️ 可行但需优化 | F104 Phase B 未开始 | 需要 7B 模型 + token pruning |
| 🌍 世界模型 | ❌ 过早 | 无 | 学术前沿，工程落地 >6 个月 |
| 🤝 全双工交互 | ❌ 无法本地 | 半双工 | TML 级需要 276B 模型 |

**最现实的短期路径**：
1. 先把声纹识别接上（最成熟、最小投入、最大改善）
2. F104 Phase B 开 spike 评估本地视频理解
3. TML 的微回合思想纳入 F104 Omni 设计讨论

---

## 三路 Deep Research 待发送

本综合基于 WebSearch，有深度不足。建议三路 Deep Research 重点挖：

| 平台 | 重点方向 |
|------|---------|
| Claude Deep Research | 声纹识别：pyannote 3.1 + WeSpeaker 在远场会议场景的实测数据、CN-Celeb 以外的中文 benchmark |
| Gemini Deep Research | 流式视频理解：StreamingTOM/StreamingAssistant 的实际部署经验、Apple Silicon 上的 LLaVA-OV 性能 |
| ChatGPT Deep Research | TML 架构深挖：200ms 微回合的内部实现、FD-bench 评测细节、是否有小模型版本计划 |

Prompt 已准备好：`docs/research/2026-05-27-multimodal-perception-research/prompt.md`

---

Sources:
- [Speaker Diarization on Apple Silicon with MLX (speech-swift)](https://blog.ivan.digital/speaker-diarization-and-voice-activity-detection-on-apple-silicon-native-swift-with-mlx-92ea0c9aca0f)
- [speech-swift GitHub](https://github.com/soniqo/speech-swift)
- [pyannote segmentation 3.0 MLX weights](https://huggingface.co/mlx-community/pyannote-segmentation-3.0-mlx)
- [WeSpeaker ECAPA-TDNN](https://huggingface.co/Wespeaker/wespeaker-ecapa-tdnn512-LM)
- [TML Interaction Models blog](https://thinkingmachines.ai/blog/interaction-models/)
- [TML-Interaction-Small — Unite.AI](https://www.unite.ai/thinking-machines-lab-ships-first-model-with-200ms-real-time-interaction/)
- [TML architecture — DataCamp](https://www.datacamp.com/blog/thinking-machines-interaction-models)
- [TML — VentureBeat](https://venturebeat.com/technology/thinking-machines-shows-off-preview-of-near-realtime-ai-voice-and-video-conversation-with-new-interaction-models)
- [StreamingTOM paper](https://arxiv.org/abs/2510.18269)
- [StreamingAssistant paper](https://arxiv.org/abs/2512.12560)
- [PruneVid (ACL 2025)](https://github.com/visual-ai/prunevid)
- [Limitless Pendant reviews](https://www.producthunt.com/products/rewind-2/reviews)
- [Wearable AI Wars 2026](https://www.umevo.ai/blogs/ume-all-posts/wearable-ai-wars-2026-limitless-pendant-vs-bee-pioneer-vs-plaud-notepin)
- [End-to-End Voice Agents — Low Latency](https://arxiv.org/html/2508.04721v1)
- [Embodied AI Agents: Modeling the World](https://arxiv.org/html/2506.22355v1)

[宪宪/Opus-46🐾]
