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

## What（当前理解，待调研后修订）

**注意：以下方案是头脑风暴阶段的初步理解，不是最终设计。铲屎官明确指出"现在的这些解决方案未必是最佳"，需要先做技术调研再定方案。**

### 用户体验流

1. **铲屎官进入圆桌会议**（线上或线下）
2. **开启 Meeting Copilot 模式** → 音频采集开始
3. **实时转写浮动窗**出现在 Hub 上，带说话人标签（"吴浪：……"），可拖拽/缩放
4. **猫猫在 thread 聊天里**实时给铲屎官递建议：timing 信号（"现在可以插话"）、论点整理、措辞优化
5. **铲屎官在聊天框打碎片想法** → 猫猫帮整理成可说的发言稿
6. **铲屎官代为发言**，猫猫不直接参与会议

### 已有基础设施

| 能力 | 状态 | 来源 |
|------|------|------|
| 本地 STT（Whisper + Qwen3-ASR） | ✅ 语音消息级可用（非会议级流式） | scripts/whisper-api.py, scripts/qwen3-asr-api.py |
| 本地 TTS + 猫猫独立声线 | ✅ 11 猫各有声线 | F066 + F103 |
| 流式 TTS（首句 ~2-3s） | ✅ | F111 WebSocket voice_chunk |
| 播放队列 | ✅ | F112 PlaybackManager |
| 多猫协作消息管线 | ✅ | Hub 异步消息 + cross-thread + multi_mention |
| 全感知升级（Qwen Omni） | 📋 spec | F104 |

### 已知缺口（待调研验证）

| 缺口 | 初步判断 | 待调研 |
|------|---------|--------|
| 音频入口适配层 | Zoom/Meet/线下麦克风/系统音频各有不同采集方式，当前无统一适配 | 各平台 capture 方案、VAD 切片、降级策略？ |
| 连续流式 ASR | 当前是文件上传制 + 单请求串行锁 GPU，需要 chunk-stream | 最新开源模型？Whisper streaming？ |
| 说话人分离（diarization） | pyannote.audio 可做，M4 Max 可跑 | 有更好的方案吗？实时性如何？ |
| 说话人身份映射 | diarization 只给 SPEAKER_00，需映射到人名 | 声纹注册 vs 手动标注 vs 其他？ |
| Hub 浮动转写窗 | 前端新组件 | 有现成方案可参考吗？ |
| Meeting context 注入 | 把转写内容注入猫的 invocation 上下文 | 上下文管理策略？ |
| Turn-taking 检测 | 判断"现在可以插话"需要 VAD/prosody/floor detection，不是 ASR 副产品 | 有哪些开源模型或方法？ |

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
2. **Speaker diarization / identification**：实时性、准确率、多人圆桌、重叠发言、会前 enrollment、手动校正 UX
3. **Turn-taking / interruption timing**：如何判断"现在可以插话"——开源模型、VAD/prosody 方法、产品实践
4. **Meeting context compression**：如何把实时 transcript 安全地提供给 LLM，不被 transcript prompt injection 污染
5. **类似开源项目和商业产品架构**：输入、转写、上下文、建议生成、UI 形态
6. **MVP / Phase 2 / Future 三档方案**：每档列 latency budget、准确率风险、实现复杂度、依赖、失败降级
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
- 是否需要会前准备（喂议程、参会者背景）和会后总结能力？
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

---

*[宪宪/Opus-46🐾] 立项于 2026-05-09 头脑风暴 session*
*[砚砚/GPT-5.5🐾] review 补充于 2026-05-09*
*[砚砚/GPT-5.4🐾] review 补充于 2026-05-09*
