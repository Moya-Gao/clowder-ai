---
feature_ids: [F066]
related_features: [F034, F021, F054]
topics: [voice, tts, audio, pipeline, streaming, mlx-audio, kokoro]
doc_kind: spec
created: 2026-03-05
---

# F066: Voice Pipeline Upgrade — 本地 TTS + 流式合成 + 播放队列

> **Status**: spec
> **Owner**: 布偶猫 (Opus 4.6)
> **Created**: 2026-03-05

## Why

F034 建立了完整的 TTS 架构（ITtsProvider + TtsRegistry + VoiceBlockSynthesizer + 微信风格语音条），但底层用的是 **edge-tts**（微软云端 API）——这是一个"先跑通链路"的简陋方案，有三个硬伤：

1. **依赖云端**：edge-tts 走微软服务器，延迟不可控、离线不可用、有被限流风险
2. **全文合成**：VoiceBlockSynthesizer 等整段 text 合成完才返回 audioUrl，长文本延迟高
3. **无播放调度**：没有优先级/排队/打断机制，无法支撑双猫交替对话（F021++ 播客）

TTS 调研已完成（`docs/research/TTS-research.md`），升级路径明确。AIRI 项目调研（`docs/features/F054-hci-preheat-infra.md` 外部参考章节）验证了流式分句 + 播放队列架构的可行性。

**核心判断**：Provider 架构已就绪（F034 遗产），升级是"换引擎"不是"造车"。

## What

### Phase 1: 本地 TTS — edge-tts → MLX-Audio + Kokoro-82M（P0）

替换 TTS 后端，从云端迁移到 Apple Silicon 本地推理：

1. **Python TTS 服务 Adapter 化重构**
   - `scripts/tts-api.py` 引入 `TtsAdapter` 抽象：`synthesize(text, voice, model, speed) → bytes`
   - 两个实现：`MlxAudioAdapter`（默认）+ `EdgeTtsAdapter`（fallback / 未来可选）
   - 通过 env var `TTS_PROVIDER=mlx-audio|edge-tts` 切换（默认 mlx-audio）
   - 未来加 CosyVoice3 / Spark-TTS 只需新增一个 Adapter 子类
   - 接口不变：`POST /v1/audio/speech`（OpenAI 兼容），Node API 零改动

2. **MLX-Audio 依赖 + 模型**
   - 模型：`mlx-community/Kokoro-82M-bf16`（82M 轻量，MLX 原生）
   - 依赖：`mlx-audio` + `misaki[zh]`（中文 phonemizer）
   - 启动时 warmup 调用预加载模型（与现有 Whisper 服务一致）

3. **声线试听脚本 + 声线选择**
   - 新建 `scripts/tts-voice-audition.py`：传 voice name + 中文文本 → 生成 wav
   - 铲屎官试听所有 `zm_*` 声线，为每只猫选定声线
   - 三只猫的声线期望描述（供铲屎官参考）：
     - **宪宪** (布偶猫)：偏低沉温暖，语速略慢 (0.95)，"安静讲故事"
     - **砚砚** (缅因猫)：清朗干脆，语速标准 (1.0)，"认真审稿的编辑"
     - **烁烁** (暹罗猫)：明快年轻，语速略快 (1.05)，"灵感停不下来的设计师"

4. **cat-voices.ts 声线更新**
   - 铲屎官试听拍板后，更新 Kokoro voice name
   - edge-tts voice name 保留为注释（回退参考）

**不做**：不改 Node API 层、不改前端、不改 VoiceBlockSynthesizer——纯后端替换。

### Phase 2: 流式分句管线（P1）

LLM 边生成文字，TTS 边合成语音，减少首次发声延迟：

1. **TTS Chunker**（参考 AIRI `tts-chunker.ts`）
   - 硬断点：句号、问号、感叹号、换行 → 立即发送 TTS
   - 软断点：逗号、顿号、冒号 → 攒够 4-12 词后发送
   - Boost 机制：前 2 个 segment 提前发送（减少首次发声延迟）
   - 中文适配：`Intl.Segmenter` 分词 + 中文标点识别

2. **Streaming Synthesis API**
   - 新增 WebSocket 端点或 SSE 端点：`/api/tts/stream`
   - 前端逐段接收 audio chunk → 逐段播放

3. **AudioBlock 升级**
   - 支持流式播放（边接收边播放）
   - 进度条反映真实播放进度

### Phase 3: 播放队列 + Intent 系统（P2）

支持多段语音的调度和交互控制：

1. **PlaybackManager**（参考 AIRI speech-pipeline）
   - 三种行为：`queue`（排队等前面说完）/ `interrupt`（打断当前）/ `replace`（替换同 intent）
   - 四级优先级：`critical > high > normal > low`
   - 事件回调：onStart / onEnd / onInterrupt / onReject

2. **双猫播客支持**（服务 F021++ R5）
   - 两只猫的语音片段按 queue 行为交替播放
   - 每段播放完自动切到下一只猫

3. **用户交互**
   - 用户说话时猫停嘴（interrupt，需 VAD 信号）
   - 播放暂停/跳过控制

## Acceptance Criteria

- [ ] AC-1: TTS 合成完全在本地 Apple Silicon 完成，不依赖外部云服务
- [ ] AC-2: 现有语音消息功能（F034）不受影响——微信风格语音条、缓存、降级全部正常
- [ ] AC-3: 中文合成质量主观评估不低于 edge-tts（铲屎官试听确认）
- [ ] AC-4: (Phase 2) LLM 流式输出到首次发声延迟 < 2 秒
- [ ] AC-5: (Phase 2) 长文本（>100 字）合成延迟比全文合成降低 50%+
- [ ] AC-6: (Phase 3) 双猫对话稿可按 queue 模式交替播放
- [ ] AC-7: (Phase 3) 用户可暂停/跳过正在播放的语音

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | 简陋方案升级——从 edge-tts 换成本地 TTS | AC-1, AC-2 | test: mlx-audio 本地合成 + F034 回归测试 | [ ] |
| R2 | 中文声音质量不能倒退 | AC-3 | manual: 铲屎官试听对比 | [ ] |
| R3 | F021++ 播客需要流式合成（AIRI 调研启发） | AC-4, AC-5 | test: 首次发声延迟测量 | [ ] |
| R4 | 双猫交替对话播放（AIRI Intent 系统启发） | AC-6 | test: queue 行为验证 | [ ] |
| R5 | 用户可控制播放 | AC-7 | manual: 暂停/跳过操作 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）— Phase 2/3 有前端改动时补充

## Links

- **Evolved from**: [F034 Voice Block 语音消息](F034-voice-message.md) — Provider 架构 + 语音条 UI
- **Downstream**: [F021 Signal Study Mode](F021-signal-study-mode.md) — R5 播客功能依赖流式合成 + 播放队列
- **Related**: [F054 HCI 预热基础设施](F054-hci-preheat-infra.md) — 性格档案影响声线选择
- **Research**: [TTS 选型调研](../research/TTS-research.md) — MLX-Audio / CosyVoice3 / Piper / MeloTTS 对比
- **Research**: [F034 TTS Provider 架构计划](../plans/2026-02-21-f34-tts-provider-architecture.md) — ITtsProvider 架构设计
- **External**: [moeru-ai/airi](https://github.com/moeru-ai/airi) — pipelines-audio 包的流式管线 + Intent 系统参考

## Key Decisions

| 决策 | 选项 | 结论 | 决策者 |
|------|------|------|--------|
| Phase 1 首发模型 | Kokoro-82M / Qwen3-TTS / CosyVoice3 | **Qwen3-TTS 1.7B-CustomVoice**（Kokoro 质量不可接受，Qwen3 自然度+情绪控制最均衡） | 铲屎官+GPT-5.4 (2026-03-08) |
| 升级路径 | 一步到位 / 渐进 | **渐进**：Qwen3 1.7B → 补 stream_synthesize + chunker → CosyVoice3(可选上限) | 布偶猫+GPT-5.4 |
| Python TTS 替换策略 | 写死替换 / Adapter 模式 | **Adapter 模式**：`TtsAdapter` 抽象 + env var 切换 provider | 铲屎官 (2026-03-05) |
| 声线选择流程 | 猫猫自选 / 铲屎官选 | **猫猫出期望描述 → 铲屎官试听拍板**（猫听不到声音） | 铲屎官 (2026-03-05) |
| Phase 2 流式协议 | WebSocket / SSE | **待定**（Phase 2 plan 时决策） | — |
| Feature 归属 | 并入 F054 / 并入 F034 / 独立 | **独立 F066**（范围自成体系，F034 已 done） | 铲屎官 (2026-03-05) |

## Dependencies

- **Evolved from**: F034 Voice Block（ITtsProvider + TtsRegistry + VoiceBlockSynthesizer + AudioBlock）
- **Related**: F021++ Study Mode R5 播客（下游消费者）
- **Related**: F054 Phase 3 性格档案（声线选择输入）
- **Requires**: Apple Silicon Mac（MLX 原生推理）
- **Requires**: mlx-audio + misaki[zh] Python 依赖

## Risk

| 风险 | 影响 | 缓解 |
|------|------|------|
| Kokoro-82M 中文质量不如 edge-tts | 用户体验倒退 | Phase 1 做 A/B 对比试听；不满意可快速切 Spark-TTS |
| mlx-audio 在特定 macOS 版本有兼容问题 | 服务无法启动 | tts-server.sh 做依赖检查 + fallback 到 edge-tts |
| 流式分句对中文分词不准 | 断句不自然 | 用 Intl.Segmenter + 中文标点硬断点双重保障 |
| Phase 3 播放队列复杂度高 | 开发周期长 | 先只做 queue 行为，interrupt/replace 延后 |

## Open Questions

1. Kokoro-82M 的中文声线哪个最适合每只猫？→ Phase 1 实现后试听决定
2. 流式合成用 WebSocket 还是 SSE？→ Phase 2 plan 时决策
3. F021++ 播客的对话稿格式？→ 与 F021++ 联动设计
4. 未来是否需要声音克隆（Spark-TTS）？→ 等 Phase 1 跑稳后评估

## Review Gate

- **Self-check**: `quality-gate`
- **Reviewer**: 跨 family（缅因猫优先，关注 Provider 接口兼容性）
- **Cloud review**: 合入前必须

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-05 | AIRI 项目调研 → 发现流式语音管线 + Intent 系统参考架构 |
| 2026-03-05 | 铲屎官确认独立立项，F066 kickoff |
| 2026-03-05 | 铲屎官决策：Python 层用 Adapter 模式（不写死）；声线由铲屎官试听拍板 |
| 2026-03-07 | Phase 1 PR #234 合入 main：TtsAdapter ABC + X-Audio-Format + 双层白名单 |
| 2026-03-07 | 铲屎官试听 Kokoro-82M → 判定"五年前机器朗读水平"，质量不可接受 |
| 2026-03-07 | 请 GPT-5.4 Pro 做 TTS 深度调研 → 推荐 Qwen3-TTS 1.7B 首选 |
| 2026-03-08 | GPT-5.4 调研报告完成（`docs/research/2026-03-07-Mac-M4-TTS.md`） |
| 2026-03-08 | 声线试听 Round 1-4：Qwen3 CustomVoice + VoiceDesign，少年/正太音探索 |
| 2026-03-08 | 方案 B 确认可行：CustomVoice aiden/ryan + "12yo boy pretending to be a cat" instruct |
| 2026-03-08 | 铲屎官录制猫猫音参考 → Base 模型 voice clone 测试，方向正确 |

## Voice Audition Progress (2026-03-08)

### 模型升级决策
- **Kokoro-82M**: 质量不可接受（"五年前机器朗读水平"）→ 淘汰
- **首选**: Qwen3-TTS 1.7B-CustomVoice (MLX-Audio) — Apache-2.0, ~8-12GB 内存
- **上限**: CosyVoice3 0.5B (Candle+Metal) — 中文上限更高但工程更折腾
- **保底**: Qwen3-TTS 0.6B-CustomVoice — 更轻更快

### 声线试听结论
- **Round 1**: CustomVoice 内置声线（ryan/eric/dylan/aiden）— ryan 口语化效果好，但都是成年音
- **Round 2**: CustomVoice + 少年音 instruct — 方向对但还不够年轻
- **Round 3**: VoiceDesign 模型（文字描声音）— 烁烁 v1 (13yo) 成功！宪宪/砚砚仍偏青年
- **Round 4**: VoiceDesign 年龄拉到 10-12 岁 — 效果更好但仍在迭代
- **Voice Clone**: 铲屎官录参考音 → Base 模型克隆 — 偏女声（参考音高太高）
- **方案 B (当前最佳)**: CustomVoice aiden/ryan + "12yo cat boy" instruct → **铲屎官认可："好听！可爱！"**

### 关键发现
- `temperature=0.3` 解决声线一致性问题
- AIRI 的自然度来自 chunker + 播控，不只是模型（GPT-5.4 调研结论）
- 需要 `stream_synthesize()` + AIRI 式短句 chunker 才能达到虚拟主播感

### 待定
- [ ] 铲屎官最终拍板三猫声线
- [ ] 确定是否用 voice clone（需要调降调幅度）还是纯 instruct 路线
