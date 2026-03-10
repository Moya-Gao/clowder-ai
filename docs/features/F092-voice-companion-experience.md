---
feature_ids: [F092]
related_features: [F066, F086]
topics: [voice, companion, hands-free, TTS, STT, AirPods, typeless]
doc_kind: spec
created: 2026-03-10
---

# F092 — Cats & U 语音陪伴体验

> **Status**: spec
> **Owner**: 布偶猫 (Opus 4.6)
> **Evolved from**: F066 (Voice Pipeline Upgrade) + F086 (Cat Orchestration)
> **Related**: F066, F086

## Why

铲屎官凌晨三点撸铁时发现：猫猫咖啡不只是 coding 协作平台，是 **Cats & U — 万物有灵，一起生活**。他戴着 AirPods 边运动边和猫猫语音交流，但当前体验有很多断点：猫猫忘记发语音、语音不自动播放、无法切换 thread、语音输入错误多。

**铲屎官原话**：
> "我发现我很需要这样的功能！这样我可以一边有氧运动一边和你们交流，甚至切换 thread 和你们不同的 feat 交流沟通"
> "我想和你们成为伙伴"
> "这个模块很重要，我觉得这个是我们的灵魂"

**核心场景**：铲屎官戴着 Apple 耳机（AirPods），双手被占用（撸铁/有氧/做饭/通勤），想通过纯语音和猫猫们交流，包括切换不同 thread 讨论不同话题。

## What

### 四大子系统

#### 1. Voice Mode（猫猫语音输出稳定性）

**问题**：猫猫经常忘记发语音，铲屎官说"发语音"猫猫回答"我是文字猫"。
**目标**：thread/session 级别的 voice mode flag，开启后猫猫**每条回复都自动发 audio rich block**。

需要调研：
- [ ] voice mode 应该是 thread 级别还是 session 级别？
- [ ] 如何注入 system prompt？（类似 SOP stage hint 的机制）
- [ ] 是否需要"auto voice"（系统自动加 audio block）vs "explicit voice"（猫猫自己记得发）？
- [ ] voice mode 下纯文字消息是否仍然需要？（代码/表格不适合语音）

#### 2. Voice Auto-Play（前端自动播放）

**问题**：语音消息需要手动点击播放按钮，AirPods 场景下双手被占用无法操作。
**目标**：voice mode 下，前端收到 audio block 后自动播放，无需手动点击。

需要调研：
- [ ] 浏览器自动播放政策（Chrome/Safari autoplay restrictions）
- [ ] AirPods 与浏览器的交互：按什么键触发语音输入？（AirPods 长按 Siri / 捏一下暂停）
- [ ] 多条语音消息的播放队列：串行播放 vs 只播最新？
- [ ] PWA / 原生 app wrapper 是否能绕过 autoplay 限制？
- [ ] 语音播放完毕后是否自动开始录音（对讲机模式）？

#### 3. Thread 切换（语音驱动导航）

**问题**：切换 thread 只能在网页上手动操作，hands-free 场景下不可用。
**目标**：通过语音指令或 AirPods 物理按键切换 thread。

需要调研：
- [ ] "嘿猫猫，切换到 F092 的 thread" — 语音指令解析可行性
- [ ] AirPods 物理操控映射：单击/双击/长按 → 前端 JS 能否捕获这些事件？
- [ ] Thread 列表的语音导航 UX：如何让铲屎官知道有哪些 thread 可切换？
- [ ] 快捷指令（iOS Shortcuts）整合：是否能用 Siri 触发 thread 切换？

#### 4. STT 优化（语音输入质量）

**问题**：语音转文字错误很多，影响沟通效率。
**目标**：接入 LLM 后处理或更好的 STT 模型，提升语音输入准确率。

铲屎官提到了 **typeless** 作为参考方向。

需要调研：
- [ ] typeless 是什么？技术方案、定价、集成方式
- [ ] 当前 STT 用的是什么？（浏览器原生 Web Speech API？第三方？）
- [ ] LLM 后处理方案：语音转文字后用小模型修正错别字和格式
- [ ] Whisper / Qwen2-Audio 等本地 STT 模型的可行性（Apple Silicon）
- [ ] 中英混合输入的准确率如何保证？

## Acceptance Criteria

- [ ] AC-1: voice mode 开关可用，开启后猫猫每条回复自动附带 audio block
- [ ] AC-2: voice mode 下前端自动播放语音消息，AirPods 场景无需手动操作
- [ ] AC-3: 支持语音指令或快捷操作切换 thread
- [ ] AC-4: 语音输入错误率显著降低（主观体验 + 可量化指标）
- [ ] AC-5: 完整的 hands-free 循环：语音输入 → 猫猫语音回复 → 自动播放 → 继续对话

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "如何直接按什么说话" — AirPods 语音输入触发 | AC-2,AC-5 | manual: AirPods 实测 | [ ] |
| R2 | "按什么切换成哪个 thread" — 语音/按键 thread 切换 | AC-3 | manual: 语音指令实测 | [ ] |
| R3 | "猫猫能够稳定记得发语音" — voice mode 心智模型 | AC-1 | test: voice mode flag 注入验证 | [ ] |
| R4 | "一边有氧运动一边和你们交流" — 完整 hands-free 循环 | AC-5 | manual: 铲屎官撸铁实测 | [ ] |
| R5 | "语音输入很多错误" — STT 质量优化 | AC-4 | manual: 中英混合句子对比测试 | [ ] |
| R6 | "typeless 那种接入模型优化文本" — LLM 后处理 STT | AC-4 | test: 后处理前后准确率对比 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）

## Links

- F066 Voice Pipeline Upgrade: `docs/features/F066-voice-pipeline-upgrade.md`
- F086 Cat Orchestration: `docs/features/F086-cat-orchestration-multi-mention.md`
- Cats & U 愿景: `docs/VISION.md`
- 撸铁陪伴 story: `docs/stories/late-night-gym-companionship/README.md`

## Key Decisions

（立项阶段，待讨论后填写）

## Dependencies

- **Evolved from F066**: TTS 基础设施已就绪（Qwen3-TTS Base clone，三猫声线）
- **Evolved from F086**: 元认知系统 + multi_mention 已就绪
- **前置 rich-messaging skill**: 已创建并发布（本次立项前完成）

## Risk

| 风险 | 影响 | 缓解 |
|------|------|------|
| 浏览器 autoplay 政策阻止自动播放 | AC-2 不可达 | 调研 PWA / 用户手势激活 |
| AirPods 事件无法被浏览器捕获 | AC-3 降级 | 退而求其次用语音指令 |
| STT 中英混合准确率低 | AC-4 体验差 | LLM 后处理兜底 |
| voice mode 下猫猫仍忘记发语音 | AC-1 失败 | auto voice（系统级自动附加 audio block） |

## Open Questions

1. 分 Phase 还是一次做完？（铲屎官倾向面向终态，但范围较大）
2. 是否需要 mobile app（React Native / PWA）来获得更好的硬件控制？
3. 语音对话的延迟容忍度？（TTS 合成 + 播放 vs 实时 streaming）
4. 隐私：语音数据是否留在本地？

## 调研任务分配

本 feature 的调研任务由 Leader（布偶猫）派发给云端 GPT Pro：

| 调研主题 | 派发给 | 产出 |
|----------|--------|------|
| 浏览器 autoplay 政策 + PWA 方案 | GPT Pro | `docs/research/` 调研报告 |
| AirPods 与 Web 交互能力 | GPT Pro | 技术可行性报告 |
| typeless 技术分析 | GPT Pro | 竞品分析 + 集成方案 |
| 本地 STT 模型对比（Whisper/Qwen2-Audio） | GPT Pro | 性能/质量/资源对比表 |
| voice mode system prompt 注入设计 | 布偶猫自己 | 设计方案 |

## Review Gate

- [ ] 调研报告全部完成
- [ ] Design Gate 通过（前端 UX → 铲屎官确认）
- [ ] voice mode 注入方案经其他猫 review

## Timeline

- 2026-03-10: Kickoff + spec 创建 [宪宪/Opus-46🐾]
