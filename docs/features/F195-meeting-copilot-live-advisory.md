---
feature_ids: [F195]
related_features: [F066, F103, F104, F111, F112]
topics: [meeting, live-advisory, augmentation, accessibility, AUDHD, speech-recognition, diarization]
doc_kind: spec
created: 2026-05-09
---

# F195: Meeting Copilot — 实时会议私人智囊团

> **Status**: idea | **Owner**: 布偶猫 | **Priority**: TBD

## Why

铲屎官在圆桌会议中面临三个具体痛点（AUDHD 相关）：

> **铲屎官原话（2026-05-09 17:40）**：
> "我发现 在这样的会议 好像是因为我是audhd
> 1. 我不知道什么时候可以打断人家
> 2. 我不知道如何措辞让他们舒服 不冒犯 但是又表达我的观点和看法
> 3. 哈哈哈这本身就是一个 showcase live级别的私人专家助理团"

这不是"AI 替你说话"，是"AI 帮你更好地做自己"。

## Vision（铲屎官原话合集）

### 核心定位

> **铲屎官拍板（2026-05-09 17:40）**：
> "猫是铲屎官的私人智囊（augmentation），不是会议参与者"

### 交互画面

> **铲屎官原话（2026-05-09 17:40）**：
> "可能想要的就是 你们能够快速知道我们正在讨论什么，以及 我会大概这样 当你们知道他们在讨论什么的时候，我就会打字发表我个人内心的看法和想法，这样你们就能拆解 甚至帮我整理我应该如何发言"

### 原始提问

> **铲屎官原话（2026-05-09 14:21）**：
> "猫猫头们出动！ 头脑风暴 我们有没有任何可能性 让你们 live的参与 圆桌会议。 其他人大概率是说话。 你们的live难度 我觉得目前在于如何 分辨不同人的声音 然后实时转写成文字给你们。 然后如果最后要发言倒是我可以代劳。但是这过程中我大概也会给你们引导 发表我对他们讨论的看法。 你觉得我们家的基础设施 足够了吗？ 还差什么？"

### UI 方向

> **铲屎官原话（2026-05-09 17:53）**：
> "我们聊天就在 中间这里聊天 智囊面板 好像不需要？就是我们这个thread的对话框，或者任何一个thread的对话框？ 还是 你们要做mcp之类的基础设施？ 但是好像没有啥是你们不能直接在thread 的chat这里告诉我的吧？ 🤔 顶多的需求可能是 workspace需要能显示 实时转写 以及我还能打开某些文件 让我看一些 信息"
>
> "实时转写这个能是一个浮动框那种吗？ 好像这种比较方便 我可以拖拉拽到我想要的地方 甚至放大 缩小我到底想看的多少。 然后我的草稿啥的 好像都是在现在这个聊天框我打给你就行了"

### 关于说话人识别

> **铲屎官原话（2026-05-09 17:40）**：
> "每个人说话声音有不同音色 难道分辨不出来吗？"

## What（分阶段验证）

**注意：以下方案是头脑风暴阶段的初步理解，不是最终设计。铲屎官明确指出"现在的这些解决方案未必是最佳"，需要先做技术调研再定方案。**

> **铲屎官 Push Back（2026-05-10）**：
> "spec 整个聚焦'会议进行中'，但 AUDHD 在圆桌的认知负荷不是只在会中——会前预热让你进场就有 mental model；会后复盘让下次进步。"
> "Phase A = 会前 + 会后先验证'猫的内容能力是否真的对你有用'，再决定是否投入 Phase C 会中。否则可能花 4 周做了流式 ASR，结果发现猫的建议本身没那么有价值。"
>
> 三段式 MVP 思路来自 47 在头脑风暴阶段的提议。

### Phase A: 会前预热 + 会后复盘（现有能力直接做）

**目的**：零新基础设施，验证"猫的内容能力是否真的对铲屎官有用"。

**会前**（0 延迟、0 ASR、0 diarization）：
1. 铲屎官喂入议程 + 参会人名单/背景
2. 猫调研参会人过往观点、立场、最近动态
3. 输出"应对牌"：预判议题走向、准备好的论点、可能被问到的问题、铲屎官的立场建议
4. 富块卡片推到手机，会议中可以随时翻看

**会后**（批处理转写，质量优先于实时性）：
1. 会议录音上传 → 批处理 Whisper 转写（现有能力可做）
2. 批处理 diarization（不需要实时，质量更高）
3. 猫给复盘分析：铲屎官表现如何、哪句没说好、漏了哪个反驳点、下次怎么改进
4. 对比会前"应对牌"vs 实际发生，总结哪些准备有用

**录音方案**（会后复盘用）：
- 线上会议：平台自带录制（零成本）
- 线下圆桌：Mac QuickTime 录音 / 手机放桌上录全场
- 可选增强：大疆 Mic 录自己 + 全场录音分两路 → 天然 speaker separation（不需要 diarization）

**验证状态**：铲屎官已确认"做好准备很容易表现得好"（2026-05-10），会前能力已有正向验证信号。Phase A 是在固化已验证的能力，不是从零验证假设。

### Phase B: 会中实时智囊（调研后定方案）

**目的**：Phase A 验证通过后，投入会中实时能力。

1. **铲屎官进入圆桌会议**（线上或线下）
2. **开启 Meeting Copilot 模式** → 音频采集开始
3. **实时转写浮动窗**出现在 Hub 上，带说话人标签，可拖拽/缩放
4. **猫猫在 thread 聊天里**响应铲屎官的 pull 请求（"他们在聊什么""帮我整理一下"）
5. **铲屎官在聊天框打碎片想法** → 猫猫帮整理成可说的发言稿
6. **铲屎官代为发言**，猫猫不直接参与会议

### Phase C: 会中主动增强（Phase B 稳定后）

- Turn-taking 检测 → 主动推"现在可以插话"信号（加频率限制）
- 高置信度 speaker identity 映射（会前 enrollment → 实时归因）
- 会议中主动推论点提醒（检测到高价值插话点）

### 已有基础设施

| 能力 | 状态 | 来源 |
|------|------|------|
| 本地 STT（Whisper + Qwen3-ASR） | ✅ 语音消息级可用（非会议级流式） | scripts/whisper-api.py, scripts/qwen3-asr-api.py |
| 本地 TTS + 猫猫独立声线 | ✅ 11 猫各有声线 | F066 + F103 |
| 流式 TTS（首句 ~2-3s） | ✅ | F111 WebSocket voice_chunk |
| 播放队列 | ✅ | F112 PlaybackManager |
| 多猫协作消息管线 | ✅ | Hub 异步消息 + cross-thread + multi_mention |
| 全感知升级（Qwen Omni） | 📋 spec | F104 |

### 技术难度分层

| Phase | 新增技术需求 | 难度 |
|-------|-------------|------|
| **A 会前** | 无——现有 thread + 猫的推理能力 | ⭐ 零 |
| **A 会后** | 批处理 ASR + 批处理 diarization（质量优先，非实时） | ⭐⭐ 低（现有 Whisper/Qwen3-ASR + pyannote 可做） |
| **B 会中** | 音频采集适配层 + 流式 ASR + 浮动转写窗 + meeting context 注入 | ⭐⭐⭐⭐ 高 |
| **C 主动增强** | Turn-taking 检测 + 实时 diarization + 主动推送 | ⭐⭐⭐⭐⭐ 很高 |

### 已知缺口（Phase B/C 需调研验证）

| 缺口 | 初步判断 | 涉及 Phase | 待调研 |
|------|---------|-----------|--------|
| 音频入口适配层 | Zoom/Meet/线下麦克风/系统音频各有不同采集方式 | B | 各平台 capture 方案、VAD 切片、降级策略？ |
| 连续流式 ASR | 当前是文件上传制 + 单请求串行锁 GPU | B | 最新开源模型？Whisper streaming？ |
| 说话人分离（diarization） | pyannote.audio 可做，M4 Max 可跑 | A(会后)/B/C | 批处理 vs 实时，有更好的方案吗？ |
| 说话人身份映射 | diarization 只给 SPEAKER_00，需映射到人名 | C | 声纹注册 vs 手动标注 vs 其他？ |
| Hub 浮动转写窗 | 前端新组件 | B | 有现成方案可参考吗？ |
| Meeting context 注入 | 把转写内容注入猫的 invocation 上下文 | B | 上下文管理策略？ |
| Turn-taking 检测 | VAD/prosody/floor detection，不是 ASR 副产品 | C | 有哪些开源模型或方法？ |

## 安全边界（砚砚 review 补充）

### Meeting Context 必须当不可信输入（P1）

转写内容来自会议参与者，不可注入 system prompt。必须使用 `MeetingContextBlock` 放在 data 区，带 provenance、speaker confidence、timestamp，防止 transcript prompt injection。

### Diarization 不阻塞 MVP（P1）

MVP 允许 `Speaker A/B/Unknown`，甚至"有人说"。铲屎官主要需要猫知道"正在讨论什么"，不是一开始就 95% 准确知道"谁说的"。身份映射（会前 enrollment、手动改名、置信度低不归因）是 Phase 2 增强。

### 智囊输出先 pull-based（P1）

MVP 做拉取模式：铲屎官打草稿或问"现在怎么说"，猫再整理。主动推"现在可以插话"放 Phase 2 并加频率限制，避免反过来增加 AUDHD 注意力负担。

### 浮动转写窗最小 AC

- 不抢聊天输入焦点
- 可拖拽/缩放/最小化
- 可暂停采集
- 显示录音状态
- 可手动修正 speaker label

### MeetingSession 概念

需要一个 `MeetingSession` 绑定当前 thread，浮动窗跨 workspace 存在。明确"会议上下文跟哪个 thread 走"。

### F104 (Omni) 不是 MVP 前提（P2）

F104 全感知升级是 research branch，不是 Meeting Copilot 的门槛。MVP 只需文本理解 + 现有 thread + 浮动转写窗。Omni 能增强但不阻塞。

### Transcript 上下文压缩策略（P2）

实时转写不直接灌满 thread、不做原文永久堆积。采用 `rolling window + event summary + 显式拉取`，避免同时挤占聊天上下文、文件侧栏注意力和猫的推理预算。

### Consent / Privacy Gate

产品上至少需要"正在录音/转写"的显式状态和本地保存策略。

## 调研任务（Research Brief）

在方案定型前，需要一轮技术调研（砚砚建议的提示词骨架）：

1. **音频采集架构（Capture Matrix）**：Zoom/Meet/线下麦克风/系统音频（BlackHole/Soundflower）各怎么采、怎么切片、怎么 VAD、怎么降级
2. **低延迟 streaming ASR**：本地 Apple Silicon、小模型、云端 API、hybrid 架构对比
3. **Speaker diarization / identification**：实时性、准确率、多人圆桌、重叠发言、会前 enrollment、手动校正 UX
4. **Turn-taking / interruption timing**：如何判断"现在可以插话"——开源模型、VAD/prosody 方法、产品实践
5. **Meeting context compression**：如何把实时 transcript 安全地提供给 LLM，不被 transcript prompt injection 污染
6. **类似开源项目和商业产品架构**：输入、转写、上下文、建议生成、UI 形态
7. **MVP / Phase 2 / Future 三档方案**：每档列 latency budget、准确率风险、实现复杂度、依赖、失败降级
8. **可验证 benchmark 计划和推荐 spike 顺序**（第一根 spike 应是 audio capture + latency budget，不是 diarization）

## MVP Acceptance Criteria（草案，待铲屎官确认）

进入设计前至少需要定义"什么叫真的帮到了"，以下 3 条是最小集：

1. **On-demand 讨论摘要**：铲屎官问"他们在聊什么"，猫在 ≤15s 内给出当前议题 + 各方立场摘要
2. **草稿→外交版发言**：铲屎官打碎片想法，猫在 ≤20s 内整理成可直接说出口的发言稿（含直接版 + 委婉版）
3. **低置信度 speaker 优雅降级**：speaker label 置信度 <0.6 时显示"有人说"而非猜名字，不误导猫的推理

## Open Questions

- 线上会议（Zoom/Tencent Meeting）vs 线下圆桌，音频采集方式不同，优先支持哪种？
- 实时转写的延迟 budget 是多少？30s 可接受吗？
- 说话人识别的准确率底线是多少？标错了比不标更糟吗？
- ~~是否需要会前准备和会后总结能力？~~ → 已决：Phase A 先做会前+会后（铲屎官 push back 2026-05-10）
- 这个功能是 Hub-only 还是需要移动端（手机/AirPods）支持？

## 三猫讨论记录

> 头脑风暴阶段的三猫独立观点，见对话历史。核心共识：
> - 基础设施 ~60% 就绪，核心缺口在 Meeting Live Adapter
> - "智囊"定位优于"参与者"定位（铲屎官拍板）
> - 不需要独立的智囊面板，用现有 thread 聊天 + 浮动转写窗即可（铲屎官拍板）
> - 说话人分离技术上可行（pyannote.audio），但方案待调研
>
> **砚砚(GPT-5.5) review 补充（2026-05-09）**：
> - Meeting context 必须当不可信输入，用 MeetingContextBlock 隔离，防 prompt injection（P1）
> - Turn-taking 检测是独立技术问题，不是 ASR 副产品——铲屎官核心痛点在 timing/phrasing，调研必须单列（P1）
> - Diarization 不阻塞 MVP，Speaker A/B/Unknown 即可起步（P1）
> - 智囊输出先 pull-based（铲屎官问了猫再答），push-based 放 Phase 2 加频率限制（P1）
> - 补充了浮动窗最小 AC、MeetingSession 概念、consent/privacy gate（P2）
>
> **砚砚(GPT-5.4) review 补充（2026-05-09）**：
> - 音频入口适配层是真正的第一块缺口——Capture Matrix（各平台采集/切片/VAD/降级）比模型选型更先决（P1）
> - 需要产品级 AC，否则工程会优化 WER/speaker 准确率但不解决 AUDHD 痛点（P1）
> - F104 (Omni) 不是 MVP 前提，是 research branch（P2）
> - Transcript 上下文用 rolling window + event summary + 显式拉取，不做原文堆积（P2）
> - Spike 优先级：audio capture matrix + latency budget → ASR → diarization
>
> **47 头脑风暴贡献（2026-05-09，未参与 spec review）**：
> - 提出"三段式 MVP"：会前（已经能做）→ 会中（要做的）→ 会后（已经能做）
> - 核心 insight："铲屎官 + 猫智囊耳麦"模式优于"猫坐桌上当 peer"
> - 注意：47 被 @ 了 spec review 但未响应，三段式思路在初版 spec 中被遗漏
>
> **铲屎官 Push Back（2026-05-10）**：
> - spec 不应只聚焦"会中"，AUDHD 认知负荷跨会前/会中/会后
> - Phase A = 会前+会后先验证猫的内容价值，再决定是否投入 Phase B/C 会中
> - 技术难度排序：会前(零) → 会后(低) → 会中(高)——先做容易的验证假设

---

*[宪宪/Opus-46🐾] 立项于 2026-05-09 头脑风暴 session*
*[砚砚/GPT-5.5🐾] review 补充于 2026-05-09*
*[砚砚/GPT-5.4🐾] review 补充于 2026-05-09*
