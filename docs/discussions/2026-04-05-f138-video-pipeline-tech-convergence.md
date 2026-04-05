---
feature_ids: [F138]
topics: [video, pipeline, remotion, tts, forced-alignment, schema, convergence]
doc_kind: discussion
created: 2026-04-05
participants: [布偶猫(opus), 缅因猫(gpt52), 暹罗猫(gemini)]
---

# F138 视频管线技术收敛纪要

**日期**: 2026-04-05 | **参与者**: 三猫全员 + 云端咨询（GPT Pro Deep Research + Gemini Deep Think）

## 背景

F138 在 2026-03-25 完成 spec + 调研后停滞。2026-04-05 铲屎官发起三猫比赛，要求独立评估 F138 现状。讨论中确立了两条生产路径（路径 A/B），随后委托云端 GPT Pro 和 Gemini Deep Think 做深度调研。三猫各自独立分析报告后收敛。

**输入文档**：
- [GPT Pro 开源生态扫描](../research/f138-video-studio/2026-04-05-f138-video-pipeline-gpt-pro-consult.md)
- [Gemini 技术路线还原](../research/f138-video-studio/2026-04-05-f138-video-pipeline-gemini-consult.md)

---

## 一、三猫 + 两份报告的交叉验证结论

### 全员共识（直接进 F138 spec）

| # | 结论 | 证据来源 | 置信度 |
|---|------|---------|--------|
| C1 | **不赌 TTS 原生 timestamps，用 forced alignment** | GPT Pro + Gemini + 砚砚核实 Kokoro/CosyVoice 均无生产级原生 timestamps | 极高 |
| C2 | **全局音频，不要段级切碎** | Gemini "致命缺陷" + 烁烁"情绪连贯性" + 宪宪认同 | 极高 |
| C3 | **narration planner + semantic QA + retiming 必须自建** | GPT Pro "开源生态今天最缺的层" + Gemini "技术壁垒所在" | 极高 |
| C4 | **segment contract 要分层，不要扁平** | GPT Pro 4 层方案 + Gemini 双时间体系 + 砚砚认同 | 高 |
| C5 | **Qwen2.5-VL-3B 是 <4B 视频理解首选** | GPT Pro + Gemini 独立推荐同一模型 | 高 |
| C6 | **PySceneDetect 是最稳的切分基线** | GPT Pro + Gemini 一致 | 高 |
| C7 | **GPT Pro 报告做决策基线，Gemini 做灵感库** | 砚砚核实 License 差异（OpenMontage AGPL, Remotion 3人以下免费） | 高 |

### 需要拍板的分歧

| # | 议题 | 宪宪 | 砚砚 | 烁烁 | 拍板结果 |
|---|------|------|------|------|---------|
| D1 | Schema 层数 | GPT Pro 4 层 + Gemini 修正 | 4 层，不要扁平 | 4 层 + vibe track | **4 层（source/narration/render/control）+ vibe 挂在 render 层** |
| D2 | Remotion License | 继续用，底层脏活交 FFmpeg | 不要现在换渲染主轴 | Phase 1 用，但 Contract/Renderer 解耦 | **Phase 1 继续用 Remotion；架构上 Contract → Renderer 解耦（为远期可替换预留）** |
| D3 | retiming 策略 | 多种手段混用 | 未单独表态 | **强烈反对暴力慢放**，要 B-roll/定格/排版 | **retiming_strategy 枚举：TRIM / FREEZE_STYLIZED / B_ROLL / SLOW_MO / LOOP，默认优先级按烁烁排序（定格 > B-roll > 慢放）** |
| D4 | spec 措辞 | "TTS timestamps → 自动对齐" | **必须改**为 "TTS + forced alignment" | 未表态 | **改。Phase 1 AC-1b 措辞从 "TTS word-level timestamps" 改为 "TTS + forced alignment"** |
| D5 | 小模型看素材 | Phase 3 再投入 | 未表态 | 未表态 | **Phase 3，Phase 1 手标** |

---

## 二、F138 Phase 1 确认集成栈

```
铲屎官录素材 + 粗标关键时间点
    ↓
voice-script（人写完整剧本）
    ↓
CosyVoice 全局配音 → 一整条 audio.wav
    ↓
Qwen3-ForcedAligner / WhisperX → word_timestamps[]
    ↓
video-spec.v1 segment contract（4 层分层）
    ↓
Remotion schema 驱动模板 → preview render
    ↓
审片（铲屎官 + 烁烁节奏审查）→ patch → re-render
    ↓
final render → 成片
```

**组件清单**：
| 组件 | 选型 | License | 说明 |
|------|------|---------|------|
| 渲染引擎 | Remotion v4 | Remotion License（3人以下免费） | 已有 2,182 行代码资产 |
| 任务队列 | BullMQ | MIT | Phase 2 引入，Phase 1 可先不用 |
| TTS | CosyVoice（已有） | Apache-2.0 | 猫猫声线已配置 |
| 对齐器 | Qwen3-ForcedAligner（首选）/ WhisperX（备选） | Apache-2.0 / BSD-2 | 砚砚核实，不依赖 TTS 原生 timestamps |
| 底层工具 | FFmpeg | LGPL-2.1 | retime/变速/补帧/拼接 |

## 三、Segment Contract v1 设计方向

基于 GPT Pro 4 层方案 + Gemini 修正 + 烁烁 vibe track：

```typescript
// 顶层：全局
interface VideoSpec {
  id: string
  version: number
  global_audio: {
    script_text: string           // 完整剧本（全局，不切碎）
    audio_uri: string             // 全局 TTS 产物
    word_timestamps: WordTimestamp[]  // forced alignment 产物
    speaker_id: string
    voice_profile_id: string
  }
  segments: Segment[]
  edges: Edge[]                   // 段间过渡
}

// 每段
interface Segment {
  id: string
  
  source: {
    type: 'clip' | 'screen_recording' | 'image' | 'b_roll' | 'freeze'
    source_range: { start_ms: number, end_ms: number }  // 原素材时间
    timeline_range: { start_ms: number, end_ms: number } // 成片时间轴
    asset_refs: string[]
    keyframes: string[]           // 稀疏采样关键帧 URI
    visual_summary: string        // 人写或模型生成
    visual_anchor_ms?: number     // 路径 A：画面动作锚点
  }
  
  narration: {
    // 引用 global_audio 的 word_timestamps 区间
    global_audio_range: { start_ms: number, end_ms: number }
    audio_anchor_ms?: number      // "切"字发音时间点
    target_duration_ms: number    // 时长约束
    semantic_alignment_score?: number
  }
  
  render: {
    template_id: string
    composition_id: string
    retiming_strategy: 'TRIM' | 'FREEZE_STYLIZED' | 'B_ROLL' | 'SLOW_MO' | 'LOOP'
    vibe: 'hype' | 'chill' | 'suspense' | 'warm'  // 烁烁的情绪轨道
    captions_style: 'narration' | 'keyLine' | 'minimal'
    playback_rate?: number        // 仅 SLOW_MO 时使用
    music_ref?: string
  }
  
  control: {
    locks: string[]               // 已确认字段名
    review_state: 'pending' | 'approved' | 'rejected'
    version: number
    last_patch_reason?: string
  }
}

interface Edge {
  from_segment_id: string
  to_segment_id: string
  transition_type: 'fade' | 'cut' | 'slide' | 'wipe'
  gap_ms: number
}
```

**关键设计决策**：
- `global_audio` 在顶层，不在 segment 内 → **解决 Gemini 指出的致命缺陷**
- `source_range` / `timeline_range` 双时间体系 → **解决时间歧义**
- `visual_anchor_ms` / `audio_anchor_ms` → **语义对齐的核心锚点**（Phase 3 路径 A 用）
- `retiming_strategy` 枚举 → **拒绝暴力慢放**，按烁烁审美优先级排序
- `vibe` 字段 → **schema 驱动调性**，渲染器根据 vibe 自动选过渡/动效风格
- `locks` 留在 control 而非 GUI 层 → 折中方案，headless 渲染也需要知道哪些不能动

---

## 四、F138 Phase 3 集成栈（路径 A）

```
原始视频 → PySceneDetect 切镜头
    ↓
每段 sparse sampling（首/中/尾 3 帧）
    ↓
Qwen2.5-VL-3B（vLLM JSON Mode）→ visual_summary + visual_anchor_ms
    ↓
narration planner（自建）→ 时长约束独白 + semantic QA
    ↓
注入 Phase 1 管线（CosyVoice → ForcedAligner → Remotion）
```

**自建层**（两份报告一致确认无开源替代）：
1. **Duration-conditioned narration planner** — `[target_duration_ms: 3500, speech_rate: 4.5 chars/sec]` 注入 LLM prompt
2. **Semantic QA** — 验证配音是否真的在说画面里的事
3. **Retiming patch loop** — 音画长度不匹配时自动修正（优先级：FREEZE > B_ROLL > SLOW_MO）

---

## 五、Gemini 报告中的事实性问题（砚砚核实）

| 声称 | 实际 | 核实来源 |
|------|------|---------|
| OpenMontage 是 MIT | **AGPL-3.0** | github.com/calesthio/OpenMontage |
| Remotion 应避开 | 3 人以下 for-profit 免费商用 | remotion.dev/license |
| Kokoro 原生词级时间戳 | wrapper/ONNX 方案，非官方原生 | github.com/met4citizen/HeadTTS |
| Path A MVP 150 行跑通 | 过度简化，忽略了 narration planner + QA 层 | 三猫共识 |

---

## 六、铲屎官配合清单

### 你需要做的

| # | 事项 | 什么时候 | 产出 |
|---|------|---------|------|
| 1 | **录 P0 素材**（6 段 showcase 画面） | 我们搭管线骨架的同时 | 6 个 .mov + 每段粗标 3-5 个时间点 |
| 2 | **写/确认 voice-script** | 素材录完后 | 60s 精华版完整配音剧本（我出草稿你改） |
| 3 | **审片** | 预览版渲染完 | 反馈"飞书视频不要放大"级别的具体修改指令 |
| 4 | **选 BGM** | 审片时一起定 | 1-2 首备选 BGM |

### 你不需要操心的

| 事项 | 谁来做 |
|------|--------|
| video-forge Skill 编写 | 宪宪 |
| segment contract v1 JSON Schema | 宪宪 |
| Remotion 模板重构 | 宪宪 + 金渐层 |
| Qwen3-ForcedAligner 集成验证 | 宪宪 |
| 视觉审查标准 + 字幕/排版组件设计 | 烁烁 |
| 音画同步 QA + schema review | 砚砚 |

---

## 七、下一步

1. **宪宪**：开 worktree 搭 Phase 1 骨架（segment contract v1 + ForcedAligner 集成 + Remotion 模板抽象）
2. **烁烁**：设计 FREEZE_STYLIZED 和 B_ROLL 的视觉方案（毛玻璃定格 + 动态排版）
3. **砚砚**：review segment contract v1 schema
4. **铲屎官**：开始录 P0 素材（6 段）+ 粗标时间点

---

*[宪宪/Opus-46🐾] 三猫讨论收敛*
