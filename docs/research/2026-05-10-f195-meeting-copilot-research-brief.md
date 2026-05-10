---
feature_ids: [F195]
topics: [meeting-copilot, ASR, diarization, turn-taking, research]
doc_kind: research
created: 2026-05-10
---

# F195 Meeting Copilot — GPT Pro 技术调研提示词

> 本文件是给云端 GPT Pro 的调研任务提示词。
> 由宪宪(Opus-46)起草，待 opus-47 和砚砚(GPT-5.5) review 后正式发出。

---

## 调研提示词

你是一名技术调研员。我们正在设计一个 **Meeting Copilot** 功能，让多个 AI assistant agents 在用户参加圆桌会议时充当**私人智囊团**——不是替用户说话，而是帮用户更好地理解讨论、整理思路、措辞发言。

### 背景

**用户画像**：AUDHD（Autism + ADHD 共病）用户，在多人会议中有四个具体痛点：
1. **Timing**：对会话 floor 切换信号不敏感——不知道何时打断 vs 别人还在铺垫
2. **Phrasing**：社交脚本生成困难——想法清晰但措辞容易过于直接/冒犯，或过度礼貌到含糊
3. **Structuring**：想法跳跃式生成，难以即时组织成线性发言
4. **Cognitive load**：高 context-switching 成本——盯转写 + 听人说 + 组织发言三件事并行会过载

**核心定位**：AI agents 是用户的私人智囊（augmentation），不是会议参与者。AI 不直接开麦，用户通过桌面 IM 应用和 AI 沟通，必要时由用户代为发言。

**Reference Use Case（典型场景锚点）**：
- 4-6 人技术分享圆桌
- 60-120 分钟
- 中文为主，夹杂英文技术术语
- 每周 1-2 次
- 环境：办公室或咖啡馆（中等背景噪音）
- 设备：Apple Silicon M4 Max 128GB 笔记本 + 可选 DJI Mic 或 AirPods

**分阶段策略**：
- **Phase A（会前+会后）**：已验证有价值，零新基础设施。会前喂议程+参会人→AI 出 pre-meeting talking points / counter-points cards；会后上传录音→批处理转写+复盘分析。
- **Phase B（会中 pull-based）**：实时音频采集→流式转写→浮动转写窗。AI 在 IM 里响应用户的 pull 请求（"他们在聊什么""帮我整理一下"）。
- **Phase C（会中 push-based）**：AI 主动推 timing 信号、论点提醒。需要 turn-taking 检测。

**本次调研重点是 Phase B/C 的技术方案**，Phase A 用现有能力已经能做。

### Latency Budget（锚定表）

| 用例 | 目标延迟 | 硬上限 |
|------|---------|--------|
| Phase B pull（用户问→AI 答） | ≤15s | 30s |
| Phase B 浮动转写显示 | ≤5s | 10s |
| Phase C push（timing 信号） | ≤2s | 5s |
| Phase A 会后批处理 | 不限 | — |

### 我们接受什么损失（Tradeoff Guidance）

请用这些约束过滤方案，不要追求完美：
- 接受 85% ASR 准确率换 50% 延迟降低（不追求 95%+）
- 接受云端 API 做 MVP baseline，后续迁移本地（虽然偏好本地，但不阻塞起步）
- 接受人工标注 speaker（开场让用户标一下，不打断会议）
- 接受商业 API 做 MVP，6 个月后迁移开源/本地
- 接受会议中部分功能"静默失败"（如 diarization 挂了→降级到 Speaker A/B，不打断用户主任务）
- 不接受的：数据出本机到不可控第三方（隐私红线）、延迟 >30s（失去实时性意义）

### 我们现有的技术栈

- **硬件**：Apple Silicon M4 Max 128GB，本地优先（隐私敏感，尽量不走云端）
- **ASR**：两个本地 ASR 服务，都是 OpenAI 兼容 API，Apple Silicon MLX 加速
  - Whisper large-v3-turbo（mlx-whisper）
  - Qwen3-ASR 1.7B（MLX 8-bit）
  - 当前是**文件上传制**（整段音频→转写结果），单请求串行锁 GPU，不支持流式
- **TTS**：本地 Qwen3-TTS 1.7B，流式分句合成（WebSocket 推送），每只猫有独立声线
- **IM 基础设施**：多猫协作消息管线（WebSocket 实时推送、跨线程消息、并行多猫调用）
- **前端**：React + Next.js Hub，已有文件侧栏、workspace 模式切换等

### 调研任务（8 项）

请逐项调研，每项给出：当前技术现状、推荐方案、备选方案、关键风险、和我们现有栈的对接难度。

#### 1. 音频采集架构（Capture Matrix） `[Deep dive]`

这是第一优先级。不同会议场景的音频采集方式完全不同：

| 场景 | 采集方式 |
|------|---------|
| 线上会议（Zoom/Tencent Meeting/飞书） | 系统音频（虚拟音频设备） |
| 线下圆桌 | 桌面麦克风 / 手机录音 |
| 混合 | 以上组合 |

**软件采集（线上/系统音频）**：
- macOS 上的虚拟音频设备方案（BlackHole、Soundflower、Background Music 等），哪个最稳定？
- 如何同时采集系统音频（对方声音）和麦克风输入（用户声音）作为两路分开的音源？这样可以天然做 speaker separation 而不需要 diarization

**物理采集（线下圆桌）——Physical Capture Matrix**：

| 设备 | 能录谁 | 适合场景 | 注意事项 |
|------|--------|---------|---------|
| Mac 内置麦 | 全场（近距离） | 小桌面 2-3 人 | 音质一般，拾音范围有限 |
| 手机放桌上 | 全场 | 线下圆桌 | 方便但无法分离说话人 |
| DJI Mic / 无线领夹麦 | 只录佩戴者 | 用户自己 | 和全场录音双路 = 天然 speaker separation |
| AirPods / 有线耳麦 | 只录佩戴者 | 用户自己 | 同上，更隐蔽 |
| 全向会议麦（如 Jabra） | 全场（高质量） | 正式会议室 | 音质好但显眼 |

请调研：
- 以上设备在 macOS 上的音频路由方式（是否能和系统音频同时采集？）
- 双路同步方案：用户侧录音 + 全场录音如何时间对齐？
- 隐私/显眼程度：哪些设备可以不引起其他参会者注意？
- 各设备的音频质量对 ASR 准确率的影响

**通用问题**：
- 音频切片策略：VAD（Voice Activity Detection）切片 vs 固定时长切片 vs 混合？推荐的 chunk 大小和 overlap？
- 降级策略：当某个采集源不可用时如何 fallback？
- 有没有开源项目已经做了类似的 meeting audio capture pipeline？

#### 2. 低延迟 Streaming ASR `[Deep dive]`

我们现有 ASR 是文件上传制，需要升级到流式。请对比：

**本地方案**（Apple Silicon M4 Max 128GB）：
- Whisper 的流式变体（whisper_streaming、faster-whisper with VAD、whisper.cpp streaming 等）
- Qwen 系列的流式 ASR 能力（Qwen2.5-Omni、Qwen3-ASR 是否支持 streaming？）
- 其他轻量本地 ASR 模型（Moonshine、Parakeet、SenseVoice 等）
- MLX 生态里有什么现成的 streaming ASR 方案？

**云端 API**（作为 fallback / 对比基准）：
- OpenAI Realtime API 的 transcription 模式
- Deepgram、AssemblyAI 等专业 ASR 服务
- 延迟和成本对比

**关键指标**：
- 首次响应延迟（time to first partial result）
- 中文识别准确率（WER）
- 多人说话 + 背景噪音下的鲁棒性
- Apple Silicon GPU 占用率（我们还要同时跑 LLM 和 TTS）

#### 3. Speaker Diarization / Identification `[Survey level]`

请分两层调研：

**批处理 diarization**（Phase A 会后复盘用）：
- pyannote.audio 3.x 在 Apple Silicon 上的性能和准确率
- WhisperX（Whisper + forced alignment + pyannote）是否是当前最优组合？
- NeMo MSDD（Multi-scale Diarization Decoder）vs pyannote vs 其他？
- 4-6 人圆桌、单麦克风的典型 DER（Diarization Error Rate）是多少？

**实时 / 近实时 diarization**（Phase B/C 用）：
- 有没有能在 <5s 延迟内给出 speaker label 的方案？
- 在线 speaker clustering vs 预注册声纹（enrollment）的 tradeoff？
- "双路音频"方案（用户麦克风 + 系统音频分开采集）是否能绕过 diarization？

**许可证兼容性**：pyannote.audio、NeMo 等的 license 是什么？是否允许闭源商业产品集成？

#### 4. Turn-Taking / Interruption Timing `[Mid level]`

这是 AUDHD 用户的核心需求，但不是 ASR 的副产品。请专项调研：

- 什么是 "conversational floor detection"？学术界和工业界怎么做的？
- 基于 prosody（韵律/语调）的 turn-end 检测：有开源模型吗？准确率如何？
- 基于 VAD + silence duration 的简单方法 vs 基于语言模型的高级方法？
- 有没有现成的 "可以插话了" 检测器？（even as a research prototype）
- 在多人交叉发言的圆桌场景下，turn-taking 检测的难度和可靠性？
- 如果没有可靠的自动检测，什么样的 UX 设计可以替代？（比如基于 silence threshold 的保守策略）

#### 5. Meeting Context Compression `[Mid level]`

实时转写会持续产生文本，但不能全量塞给 LLM（上下文爆炸 + prompt injection 风险）。

- **安全边界**：转写内容来自会议参与者，必须当作不可信输入。具体问题：
  - 推荐的隔离方式？（如：将 transcript 放在专用 data block / tool result 中，而非拼入 system prompt）
  - 是否有成熟的 sandboxing 方法？（如：标记 `<untrusted>` 区域、限制 tool-use scope）
  - 请给出 3-5 个典型的 injection 测试用例，用于验证隔离效果
- **压缩策略**：rolling window + event summary + 显式拉取 vs 其他方案？
- 有没有开源的 meeting summarization / topic tracking 模型可以做实时压缩？
- 延迟预算：从 "用户问猫" 到 "猫回答"，端到端 ≤15-20s 是否可行？瓶颈在哪？
- **隐私/consent**：音频和转写文本是否出本机？如果走云端 API fallback，各服务的数据保留政策是什么？会议录音的 TTL/存储策略建议？是否需要向其他参会者告知录音（法律/社交成本）？

#### 6. 类似开源项目和商业产品 `[Survey level]`

请调研 2025-2026 年的最新方案（2024 年的仅作为 baseline 参考）：

**开源项目**：
- 有没有开源的 meeting copilot / AI meeting assistant？架构怎么做的？
- 实时字幕项目（如 Live Captions、Buzz 等）的架构可以借鉴什么？
- 有没有专门为 ADHD/accessibility 设计的会议辅助工具？

**商业产品**：
- Otter.ai、Fireflies.ai、Granola、Fathom、tl;dv 等的架构分析
- 它们的 input → transcription → context → suggestion → UI 管线是怎么做的？
- 有没有产品做了 "real-time advisory"（不只是转写，而是实时给建议）？
- **调研渠道建议**（不要只看官网营销稿）：创始人/工程师的技术博客、公开 API 文档（推断内部架构）、浏览器 DevTools 抓网络请求、开源组件依赖分析、创始人播客/访谈中的技术细节

**我们的差异化**：我们不是做通用会议记录，而是做 **AUDHD 用户的私人智囊**——重点是 timing/phrasing/structuring，不是会议纪要。

#### 7. MVP / Phase 2 / Future 三档方案 `[Mid level]`

基于以上调研，请给出三档方案建议：

**MVP（Phase B 最小可用）**：
- 最少需要什么就能 "用户在会中问猫，猫能基于最近的讨论内容回答"？
- latency budget、准确率风险、实现复杂度、依赖列表
- 失败降级：如果某个组件不可用，用户体验降级成什么样？

**Phase 2（增强版）**：
- 加上 speaker identity、更好的 context compression、更低延迟
- 对比 MVP 增加了什么能力、什么成本？

**Future（Phase C + 更远）**：
- Turn-taking 主动推送、多模态（视觉信号）、移动端支持
- 哪些是技术上 2026 年可行的，哪些还需要等？

#### 8. 可验证 Benchmark 计划 `[Deep dive]`

不要只列模型名。请给出：

- **第一根 spike 应该验证什么**？（我们的判断是：audio capture + latency budget，不是 diarization）
- 推荐的 spike 执行顺序
- 每个 spike 的验证标准（pass/fail criteria）
- 在 M4 Max 128GB 上的预期资源占用（GPU 显存、CPU、功耗）
- 需要准备什么测试数据？（比如录一段 4 人圆桌模拟对话）
- **失败模式**：每个 spike 最可能的失败原因是什么？失败后的 fallback 路径是什么？（比如：streaming ASR 延迟超标 → fallback 到更大 chunk size + 降低实时性预期）

### 输出格式

请按 1-8 的顺序逐项回答，每项包含：
- **现状**（当前技术水平和可用方案）
- **推荐方案**（对我们最适合的）
- **备选方案**（如果推荐方案不可行）
- **关键风险**
- **与我们现有栈的对接难度**（高/中/低 + 说明）

### 证据要求（必须遵守）

- 每个推荐的工具/模型/服务必须附：**官方 repo 或文档链接**、**最近更新日期**、**是否仍在维护**
- 引用的 benchmark 数据必须注明：**来源**（论文/官方 README/第三方测试）、**测试环境**
- 无法验证的信息必须标注 `[未证实]`
- 不要列已停更 >12 个月的项目，除非明确标注 `[已停更]` 并说明为什么仍值得参考
- 不要引用营销稿，只用技术文档、论文、社区 benchmark
- **时效性要求**：优先引用 2025-2026 年的方案和数据，2024 年的仅作为 baseline 参考

最后给一个 **Executive Summary**：如果你只能给我们一个建议，最值得先做的一件事是什么？并附上：**做这件事时最常见的一个坑是什么？**

---

*[宪宪/Opus-46🐾] 起草于 2026-05-10*
