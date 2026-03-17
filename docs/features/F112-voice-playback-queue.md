---
feature_ids: [F112]
related_features: [F066, F034, F021, F111]
topics: [voice, tts, playback, queue, podcast, unification]
doc_kind: spec
created: 2026-03-12
---

# F112: Voice Playback Queue — 语音播放队列 + 播放器统一

> **Status**: in-progress | **Owner**: 金渐层 (OpenCode, claude-opus-4-6) | **Priority**: P1

## Why

现在猫猫的语音播放是"发一段播一段"，没有排队、打断、暂停机制。这带来两个问题：

1. **双猫播客不协调**：F021 Signal Study 的播客功能需要两只猫交替发言，目前只能靠前端 setTimeout 硬编排，没有真正的播放队列
2. **用户无法打断**：猫猫正在说话时，用户想说话或切换话题，没有 interrupt 机制

**Phase A 重定义（2026-03-17）**：F111 Phase B 引入了 `voice_chunk` WebSocket 实时推送，PlaybackManager 的主要输入源从"audio rich block" 变为"实时 voice_chunk 事件"。Rich block 退为持久化/回放载体。

> Evolved from F066 Phase 3（从 F066 拆分为独立 Feature）
> Blocked by F111 Phase A ✅（流式分句已合入）
> 与 F111 Phase B 协同实现

## What

### Phase A: PlaybackManager for Realtime Chunks（第一刀）

> Scope 收紧（砚砚 GPT-5.4 review 2026-03-17）：只做 queue + interrupt + pause/resume + priority skeleton。replace + intent + podcast orchestration 后置。

1. **PlaybackManager 核心（前端 class）**
   - 消费 WebSocket `voice_chunk` 事件 → base64 解码 → blob URL → 排队播放
   - 两种行为模式（第一刀）：
     - `queue`（默认）：排队等前面说完再播
     - `interrupt`：打断当前正在播放的语音（高优先级 voice 到来时）
   - 优先级骨架：`critical > high > normal > low`
     - Phase A 实际使用：voiceMode 对话 = `normal`，系统通知 = `high`
   - 状态机：`idle → playing → paused → idle`
   - 事件回调：`onStart` / `onEnd` / `onInterrupt`

2. **WebSocket 事件消费**
   - `voice_stream_start` → 初始化 PlaybackManager（如未初始化），设置当前 invocationId
   - `voice_chunk` → 解码 + 入队列 → 第一个 chunk 立即播放
   - `voice_stream_end` → 标记流结束，队列播完后归位到 idle
   - 新 invocation 到来时，如果上一个还在播 → interrupt（自然切换）

3. **用户交互控制**
   - 暂停/继续：点击暂停当前播放，队列保持
   - 跳过：跳过当前片段，播放队列下一个
   - Voice mode 关闭 → 清空队列 + 停止播放

4. **Fallback 路径（保留）**
   - 页面刷新后没有 voice_chunk 流 → 检测 audio block 有 text 无 url → 触发 `/api/tts/stream` fallback
   - `useVoiceAutoPlay` 现有逻辑保留，作为 PlaybackManager 不可用时的降级

### Phase B: 播放器统一 — PodcastPlayer → PlaybackManager（第二刀）

> **Scope 重定义（2026-03-19）**：原始 Phase B（replace + Intent + 双猫实时编排）暂无真实场景，降级为未来备选。新 Phase B 聚焦实际需求 — 将 Signal Study 播客播放器迁移到 PlaybackManager，消除重复的 Audio 管理代码。

1. **PodcastPlayer 播放逻辑迁移**
   - 现状：`PodcastPlayer.tsx` 使用 `usePlayAll()` 手搓 for 循环 + `new Audio()` 播放预生成播客
   - 目标：播放逻辑委托给 PlaybackManager，PodcastPlayer 只负责 UI 展示
   - PlaybackManager 新增 `enqueueUrl(url)` 方法：fetch audioUrl → blob → blobUrl → 入队列

2. **统一播放控制**
   - PodcastPlayer 免费获得 pause/resume/skip/interrupt 能力（来自 PlaybackManager）
   - 消除 PodcastPlayer 内部的 `isPlaying` / `currentIndex` 手动状态管理
   - voiceMode 语音与播客共享同一个播放器实例（互斥：播客播放时 voiceMode 语音排队等候）

3. **保持的边界**
   - 播客后端（`podcast-generator.ts`）完全不动 — 仍是 LLM → TTS → JSON → audioUrl
   - PodcastPlayer UI 组件保留（进度条、segment 列表等），只替换内部播放引擎

### Phase B-Future: replace + Intent + 双猫实时编排（未来备选方案，暂无场景）

> **归档原因（2026-03-19）**：route-serial 目前只支持单猫输出，没有双猫同时实时语音的场景。replace/intent 行为也暂无使用方。设计保留以备未来语音陪伴模式扩展。

1. **双猫播客实时编排**（原 Phase B-1）
   - 两只猫的语音片段按 `queue` 行为交替播放
   - 每段播放完自动切到下一只猫的片段
   - 播客模式下自动设为 `normal` 优先级
   - ⚠️ 与 Signal Study 播客不同：这里是**实时**双猫对话编排，Signal Study 是**离线预生成**

2. **replace 行为**（原 Phase B-2）
   - 替换同 intent 的语音（例如纠正刚说的话）
   - 需要 Intent 系统配合

3. **Intent 系统**（原 Phase B-3）
   - 每段语音带 intent 标签（如 `greeting` / `answer` / `podcast-segment`）
   - `replace` 行为只替换同 intent 的语音

### Phase C: VAD 打断（可选）

1. **VAD（Voice Activity Detection）打断**
   - 检测用户开始说话 → 发出 interrupt 信号 → 猫停嘴
   - 需要浏览器 AudioContext + VAD 模型（依赖 F104 本地感知升级）

## Acceptance Criteria

### Phase A（PlaybackManager for Realtime Chunks）✅ Done — merged PR #529
- [x] AC-A1: voiceMode 下 voice_chunk 到达后立即开始播放第一个 chunk（无需等 done）
- [x] AC-A2: 用户可暂停/跳过正在播放的语音
- [x] AC-A3: `interrupt` 行为能立即停止当前播放并开始新片段
- [x] AC-A4: 优先级 `high` 的语音能打断 `normal` 优先级
- [x] AC-A5: 新 invocation 到来时自动 interrupt 上一个的播放
- [x] AC-A6: 页面刷新后 fallback 到 `/api/tts/stream` 正常回放
- [x] AC-A7: Voice mode 关闭时队列清空 + 播放停止

### Phase B（播放器统一 — PodcastPlayer → PlaybackManager）✅ Done — merged PR #535
- [x] AC-B1: PodcastPlayer 播放播客时使用 PlaybackManager 队列，不再手搓 `new Audio()`
- [x] AC-B2: 播客播放支持 pause/resume/skip（来自 PlaybackManager）
- [x] AC-B3: PlaybackManager 新增 `enqueueUrl()` 方法，接受 audioUrl 并正确入队播放
- [x] AC-B4: voiceMode 语音和播客播放互不冲突（互斥或排队）
- [x] AC-B5: PodcastPlayer 内部不再维护独立的 Audio 实例和播放状态

### Phase B-Future（replace + Intent + 双猫实时编排，未来备选）
- [ ] AC-BF1: 双猫对话稿可按 queue 模式交替播放，无重叠
- [ ] AC-BF2: `replace` 行为只替换同 intent 的语音，不影响其他 intent

### Phase C（VAD，可选）
- [ ] AC-C1: 用户说话时猫自动停嘴（VAD interrupt）

## Dependencies

- **Evolved from**: F066（Voice Pipeline Upgrade — Phase 3 拆出）
- **Blocked by**: F111 Phase A ✅（Streaming TTS Chunker — 已合入）
- **Co-implemented with**: F111 Phase B（route-serial token-stream speech pipeline）
- **Related**: F034（TTS 架构基础 — ITtsProvider / TtsRegistry）
- **Related**: F021（Signal Study Mode — Phase B 播客功能是核心使用场景）
- **Related**: F104（本地全感知升级 — Phase C VAD 可能依赖其感知管线）

## Risk

| 风险 | 缓解 |
|------|------|
| PlaybackManager 与 useVoiceAutoPlay 职责重叠 | Phase A 中 PlaybackManager 接管 voiceMode 实时播放，useVoiceAutoPlay 退为 fallback（刷新回放） |
| WebSocket voice_chunk 积压（TTS 比播放快） | PlaybackManager 内部队列 + backpressure：队列过长（>10 chunks）时不阻塞后端，前端 skip stale chunks |
| 浏览器 autoplay policy 阻止首次播放 | 复用现有 confirmAutoplayUnlocked 机制（用户首次点击解锁） |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | PlaybackManager 放前端还是后端？ | ✅ **已决：前端**。播放器本身在浏览器里，PlaybackManager 是纯 UI 层调度，放前端零网络延迟。决策者：金渐层 (2026-03-16) |
| OQ-2 | VAD 用什么模型？Silero VAD / WebRTC VAD？ | ⬜ 未定（Phase C 时决策，依赖 F104 感知管线） |
| OQ-3 | 实时语音的主触发器是什么？ | ✅ **已决：backend text stream（route-serial token 流）**。voiceMode 下不依赖模型主动发 audio rich block，后端 text stream 是主触发器。Audio rich block 退为持久化/回放载体。决策者：金渐层 + 砚砚(GPT-5.4) (2026-03-17) |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-12 | Spec 创建（从 F066 Phase 3 拆分） |
| 2026-03-16 | OQ-1 已决，金渐层接手 |
| 2026-03-17 | F111 Phase A 合入 → F112 解锁 |
| 2026-03-17 | Phase A 重定义：从 "audio block 播放队列" 改为 "realtime voice_chunk 播放队列"（砚砚 GPT-5.4 review） |
| 2026-03-17 | 与 F111 Phase B 协同实现启动 |
| 2026-03-18 | Phase A 实现完成，与 F111 Phase B 一起提交 PR #529 |
| 2026-03-18 | 砚砚(GPT-5.4) 4 轮 review 放行 + Codex cloud review 通过 |
| 2026-03-18 | PR #529 squash merge — Phase A done |
| 2026-03-19 | Phase B 重定义：原始设计（replace/intent/双猫实时编排）归档为未来备选；新 Phase B = 播放器统一（PodcastPlayer → PlaybackManager） |
| 2026-03-20 | Phase B 实现完成 — 5 commits: enqueueUrl/startBatch/batchId cancellation/fetch rejection guard/runIdRef stale promise guard |
| 2026-03-20 | 砚砚(GPT-5.4) 4 轮 review 放行 + Codex cloud review R2 通过 (0 P1/P2) |
| 2026-03-20 | PR #535 squash merge — Phase B done |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Evolved from** | `docs/features/F066-voice-pipeline-upgrade.md` | Phase 3 原始设计 |
| **Co-implemented** | `docs/features/F111-streaming-tts-chunker.md` | Phase B 后端 speech stream |
| **Reference** | `docs/features/F054-hci-preheat-infra.md` | AIRI speech-pipeline 参考 |
| **PR** | [#529](https://github.com/zts212653/cat-cafe/pull/529) | Phase A: PlaybackManager + useVoiceStream |
| **PR** | [#535](https://github.com/zts212653/cat-cafe/pull/535) | Phase B: PodcastPlayer → PlaybackManager 播放器统一 |
