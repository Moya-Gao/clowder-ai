---
feature_ids: [F138]
topics: [video, remotion, tts, pipeline, open-source, schema, multimodal]
doc_kind: research
created: 2026-04-05
model: GPT Pro (Deep Research)
mode: deep-research-mode-b
---

# F138 视频管线开源生态扫描 — GPT Pro 咨询

> 委托人：宪宪 + 砚砚 | 日期：2026-04-05 | 关联：F138-video-studio.md

## Part 1: 发给 GPT Pro 的提示词

> 直接复制发送

# 调研任务：AI 视频生产管线 — 开源生态扫描（2026 年 4 月）

## 背景

我们在做一个 AI 视频制作管线（代号 F138 Video Studio），基于 Remotion v4（React 写视频）+ 本地 TTS（CosyVoice/Qwen-TTS）。目标不是做剪辑器，而是做"schema 驱动的视频生产环"——类似 CI/CD 但产出是视频。

我们确定了两条生产路径：

**路径 B：先脚本后素材（Script-First）**
- 人写分镜脚本 → 录制素材 → voice-script → TTS 生成配音（带 word-level timestamps）→ Remotion 自动对齐 → 渲染成片
- 核心技术需求：TTS word-level timestamps → 视频帧自动对齐、schema 驱动 Remotion 模板

**路径 A：先素材后配音（Video-First）**
- 原始视频 → 场景分段（镜头变化检测）→ 多模态小模型逐段理解画面 → LLM 按段生成第一人称独白 → TTS → 自动铺放
- 核心技术需求：视频场景分段、多模态视觉理解、按段配音生成+对齐
- 这是剪映/CapCut"图文成片"的核心能力

## 硬约束 / 排除项

- 今天的基准日期是 **2026-04-05**。请优先找 2025-01-01 之后仍有维护或更新的项目/论文/工具。
- **优先开源、可自托管、有明确 License** 的项目。若是 no-license / source-available / AGPL / 商业限制，请明确标红说明风险。
- **排除纯 text-to-video / diffusion 生成视频项目**，除非它直接解决我们两条路径里的某个具体问题（例如封面图、插图生成）。
- **排除纯 GUI 剪辑器推荐**，除非它有公开技术拆解、论文、专利、博客，能帮助我们复现它的技术路线。
- 我们不是要做完整 NLE 编辑器，也不是要 fork waoowaoo；我们要的是：
  1. schema 驱动的视频生产环
  2. Remotion 模板/渲染
  3. 本地或可控的 TTS + 对齐
  4. 路径 A 的视频理解与自动配音链路

## 调研方向

### 1. Remotion 生态
- schema 驱动的 Remotion 模板库/框架（不是 waoowaoo，它没有 License）
- Remotion + TTS 集成方案（自动对齐）
- Remotion 的 BullMQ/任务队列集成方案

### 2. TTS + 时间戳对齐
- 哪些开源 TTS 支持 word-level / phoneme-level timestamps？
- CosyVoice、Qwen-TTS、Bark、XTTS、Fish-Speech 的 timestamps 能力对比
- "配音 → 字幕自动生成" 或 "配音 → 视频节奏自动对齐" 的开源方案

### 3. 视频场景分段 + 多模态理解（路径 A 核心）
- PySceneDetect 之外还有什么？2025-2026 有没有新的开源方案？
- 多模态小模型做视频理解：Qwen-VL-2B、moondream、LLaVA-Video、InternVL 等，哪些适合"逐段描述画面 → 输出 JSON"？
- 有没有开源的"视频 → 自动配音文案"端到端方案？

### 4. 完整的开源视频生产管线
- 类似 waoowaoo 但有开源 License 的项目
- "text-to-video pipeline"（不是生成式视频，是编排式视频——给素材+脚本自动出片）
- 有没有开源的"AI 短视频工厂"项目？

### 5. 工业界方案的开源替代
- 剪映/CapCut 的"图文成片"功能，开源社区有没有替代？
- Descript/Opus Clip/Synthesia 的核心能力有没有开源实现？

## 请特别回答这 4 个问题

1. **统一 contract**：路径 A（先素材后配音）和路径 B（先脚本后素材）能否共用一套中间表示？
   参考字段建议（供校验，不是限死）：
   ```
   segment {
     id, start_ms, end_ms,
     visual_summary,        // 路径A由模型生成，路径B由人写
     narration_text,        // 路径A由LLM生成，路径B由人写
     narration_audio_uri,   // TTS产物
     word_timestamps[],     // TTS输出
     asset_refs[],          // 素材引用
     playback_rate,         // 加速/正常/慢放
     transition_type,       // 入场过渡
     locks[],               // 已确认不改的字段
     review_state           // pending/approved/rejected
   }
   ```
   问题：这个结构是否够用？缺什么？过度设计了什么？

2. **语义对齐而非仅时间对齐**：
   请把"配音和视频内容对上"拆成完整技术链：
   `shot/scene segmentation → segment-level visual understanding → duration-conditioned narration generation → TTS timestamps / forced alignment → retiming / patch loop`
   不要只回答 timestamps。

3. **small model 策略**：
   我们不想让模型"看每一秒"。请评估更现实的做法：
   `镜头切分 + keyframe/sparse sampling + 片段级 JSON 描述`
   哪些小模型/开源 pipeline 足够胜任粗筛和初稿？

4. **落地建议**：
   最后必须收敛成：
   - Phase 1（路径 B）推荐集成栈
   - Phase 3（路径 A）推荐集成栈
   - 若没有现成端到端开源方案，请给"最短可行拼装方案"（3-5 个组件）

## 额外要求

请不要只列项目。你需要像架构顾问一样，给出：
1. 路径 B 的 **Top 3 可落地组件组合**
2. 路径 A 的 **Top 3 可落地组件组合**
3. 哪些能力今天就能接进 F138，哪些应该只做技术储备
4. 如果开源生态没有完整方案，请明确指出"缺的是哪一层"，不要假装已有完整 pipeline

## 输出表格要求

每个项目/工具/论文请至少输出：

| 名称 | 链接 | Stars/活跃度 | License | 一句话用途 | 适用路径 A/B/Shared | 集成边界 | 成熟度 | 主要风险 |
|------|------|-------------|---------|-----------|-------------------|---------|--------|---------|

---

## Part 2: GPT Pro 回答（待回填）

> 铲屎官粘贴回答到这里

我先把结论掰直了说。**路径 B 能今天就落地成 F138 的主生产线**。**路径 A 现在更适合“自动初稿 + patch loop + 人审”**，还不适合假装成“无人值守成片”。这轮扫描里，我没有找到一个在 **2025-01-01 之后仍活跃、可自托管、宽许可、同时覆盖你要的路径 A + 路径 B** 的完整开源成品。最接近“有体系”的参考是 OpenMontage，但它是 **🔴 AGPL-3.0**；其它更像可拼装的积木，而不是整机。([GitHub][1])

再钉一个关键判断。**今天最不该赌的，是“某个 TTS 自带稳定 word-level timestamps”。** 我在 CosyVoice、Qwen3-TTS、Coqui TTS / XTTS、Fish-Speech、Bark 的官方 repo / README 里，都**没有核到可作为生产契约依赖的原生 word / phoneme timestamp 输出说明**。工程上更稳的答案是：**TTS 只负责出音频，timestamps 交给 forced alignment**。当前优先顺序我会排成：**Qwen3-ForcedAligner > WhisperX > MFA**。([GitHub][2])

我会用 **🔴** 标出 License / 商业化风险。

## 先给你最短判断

1. **统一中间表示可以共用。** 路径 A 和 B 的共同核心不是“素材从哪来”，而是同一个 `segment lifecycle`：证据、叙事、对齐、渲染、审阅。Remotion v4 官方已经把 `inputProps + Zod schema + calculateMetadata()` 明确做成数据驱动渲染入口；社区里 Vidosy 和 OpenMontage 也都在往 schema / JSON / pipeline 方向走。([Remotion][3])

2. **路径 B 是可交付层。** Remotion 的参数化渲染、BullMQ 的队列、Qwen3-ForcedAligner 的字词级对齐、以及现成的 Remotion+TTS 参考项目，已经足够拼出一条稳的“脚本 → 配音 → 对齐 → 渲染”生产线。([GitHub][4])

3. **路径 A 缺的不是“看视频”的模型，而是中间那条叙事控制链。** 开源里已经有 shot detection、segment-level VLM、dubbing sync、agentic video workflows，但**缺一个成熟的、可控的、duration-conditioned narration planner + semantic QA + retiming/patch loop**。([GitHub][5])

4. **最接近工业化“图文成片”的开源替代，不是单一项目，而是分层拼装。** 你要的不是 fork 一个 GUI 剪辑器，而是把“schema 驱动 + render worker + local TTS + aligner + scene understanding”扣成一条工厂线。这个方向是对的。([Remotion][3])

---

## 1) 统一 contract：能不能共用一套中间表示？

能，而且**应该共用**。但你给的 `segment` 更像一个很好的 **v0 demo contract**，还不够当长期生产 contract。

你现在这版已经抓住了核心骨架：

```ts
segment {
  id,
  start_ms,
  end_ms,
  visual_summary,
  narration_text,
  narration_audio_uri,
  word_timestamps[],
  asset_refs[],
  playback_rate,
  transition_type,
  locks[],
  review_state
}
```

它的问题不是“错”，而是**把三层信息挤在了一层里**。我建议拆成四个嵌套面：

```ts
segment {
  id,

  source: {
    type: "script" | "video" | "mixed",
    start_ms,
    end_ms,
    shot_refs[],
    asset_refs[],
    keyframes[],
    visual_evidence: {
      summary,
      objects[],
      actions[],
      ocr_text[],
      speakers[],
      uncertainty_notes[]
    }
  },

  narration: {
    text,
    locale,
    speaker_id,
    voice_profile_id,
    target_duration_ms,
    audio_uri,
    actual_audio_duration_ms,
    word_timestamps[],
    alignment_source,          // qwen-fa | whisperx | mfa | tts-native
    alignment_confidence,
    semantic_alignment_score
  },

  render: {
    template_id,
    composition_id,
    clip_ops[],                // trim/crop/speed/hold/freeze/b-roll
    captions_track_id,
    music_refs[],
    sfx_refs[],
    transition_after,
    safe_area_profile
  },

  control: {
    hard_locks[],
    review_state,
    review_flags[],
    version,
    provenance[],
    owner,
    last_patch_reason
  }
}

edge {
  from_segment_id,
  to_segment_id,
  transition_type,
  gap_ms
}
```

为什么这样更稳？因为 Remotion 本身就是“**schema 化 props → 动态 metadata → render**”这条路；Vidosy 是 JSON + Zod；OpenMontage 也是 pipeline / schema / composition 思路。换句话说，**你的统一 contract 应该面向 worker 边界，不是面向人眼一次性读完**。([Remotion][3])

你这版里我会补的字段：

* `source.type`：`script | video | mixed`
* `target_duration_ms` / `actual_audio_duration_ms`
* `voice_profile_id` / `speaker_id` / `locale`
* `alignment_source` / `alignment_confidence`
* `semantic_alignment_score`
* `visual_evidence`，不要只留 `visual_summary`
* `template_id` / `composition_id`
* `version` / `provenance` / `review_flags`
* `music_refs` / `sfx_refs` / `captions_track_id`

我会挪位置的字段：

* `transition_type` 不该挂在 segment 内部，更像 **segment 边界上的 edge 属性**
* `playback_rate` 不该是段级默认字段，更像 **asset clip 级**
* `locks[]` 太松，最好 typed，拆成 `hard_locks[]` / `soft_constraints[]`
* `visual_summary` 最好拆成 **机器证据** 和 **人类编辑摘要** 两层

一句话判定：**这份结构足够做 v0，不够做长期 contract；方向对，但需要“分层”和“可追责字段”。**

---

## 2) 语义对齐，不只是时间对齐：完整技术链怎么拆？

你给的链是对的，但工程上我会把它拆成 **6 段 2 个回路**。

### 第 1 段：shot / scene segmentation

先把视频切成镜头，再决定是否把多个镜头并成“叙事场景”。**PySceneDetect** 仍然是最好接、最好改、最好解释的基线；要追更强的边界检测，可以上 **TransNetV2**。2025 到 2026 的新东西更多是在“语义 scene segmentation”研究，比如 **Scene-VLM**，但它目前更像技术储备，不像可直接 vendor 的生产依赖。([GitHub][5])

### 第 2 段：sparse sampling，不让模型看每一秒

这是路径 A 能不能跑起来的命门。现实做法不是喂整段视频，而是每个 shot 抽 **1 个常规关键帧 + 1 个差异帧**，长镜头再低帧率补采样。**InfoShot** 这篇 2026 工作的价值就在这里，它明确提出了“每个 shot 取 common frame + unique frame”的思路，用来在有限帧预算下保结构、保瞬时事件。只是它现在 repo 还非常早期，而且 **🔴 没有清晰 License**。([arXiv][6])

### 第 3 段：segment-level visual understanding，输出 JSON，不输出散文

这里的目标不是“让模型会聊天”，而是让它吐**机器可消费的 JSON**，比如：
`who / where / action / objects / OCR / speaker / mood / uncertainty`。
**Qwen2.5-VL** 官方博客已经给了结构化输出范式，也强调了长视频理解和时间段总结能力；**Qwen3-VL** 则更进一步强调视频动态理解和时间戳对齐，且在 2025 年下半年补齐了 **2B / 4B / 8B** 这些更现实的尺寸。([Qwen][7])

### 第 4 段：duration-conditioned narration generation

这是开源生态今天最缺的层。这里不能只让 LLM“描述一下画面”，而要它在生成时同时满足：

* 目标时长窗口
* 证据约束，少 hallucination
* 第一人称 / 解说体的语气约束
* 是否必须 mention OCR / 产品名 / 品牌词
* 是否允许补桥接句

现有开源参考里，**video_explainer** 已经意识到“**TTS 要先于 storyboard**，因为后面一切都要吃 word timestamps”；但它仍更像架构样例，不是成熟的 Path A narration planner。换句话说，**这一层你们得自己做**。([GitHub][8])

### 第 5 段：TTS + forced alignment

这里别绕弯子。**Qwen3-ForcedAligner** 官方明确给 word / character 级 timestamps，是现在最值得优先试的对齐器；**WhisperX** 依然是生态里最常见的工程答案，但 2025 年后社区 issue 里确实有人报告过 word-level force alignment 偏移问题；**MFA** 更像重一点的兜底基线。([GitHub][9])

### 第 6 段：retiming / patch loop

真正的“内容对上”，是在这里决胜负。不是因为 timestamps 对了，片子就对了。这里至少要有 4 个 patch 动作：

* 音频太长：重写更短、删虚词、适度提高 speaking rate
* 音频太短：补桥接句、延长 hold、补 B-roll
* 语义不匹配：回退到 segment JSON，重写 narration
* 画面结构不适配：拆 segment，或重合并 scene

现在开源项目里，**dubbing / sync / subtitles / agentic workflow** 都有碎片，但**“semantic QA + retiming patch loop” 这一层没有成熟现成件**。这就是你问的“剪映式图文成片”与现在开源生态之间的真正断层。([GitHub][10])

### 两个必须单独建的回路

* **时间回路**：`narration target duration → TTS → alignment → retime`
* **语义回路**：`visual evidence JSON → claim check → rewrite / split / escalate`

所以“配音和视频内容对上”不是一个 timestamps 问题，而是 **时间约束 + 证据约束 + patch orchestration** 三件套。

---

## 3) small model 策略：不看每一秒，怎么做才现实？

你的思路是对的，甚至可以说是当前最现实的主路：

`镜头切分 → keyframe / sparse sampling → 片段级 JSON 描述 → narration draft → TTS + align`

我会这样配：

### 便宜粗筛

**Moondream 0.5B / 2B**。它更像“超轻 keyframe caption / triage / 简单 OCR 辅助”工具，不像完整视频理解器。适合做第一层筛子，不适合直接拿来写 final narration。这个判断是基于它官方 repo 的定位明显偏轻量 image VLM。([GitHub][11])

### 主力初稿

**Qwen3-VL-2B / 4B** 或 **Qwen2.5-VL-3B**。
如果你要更“新”的视频时间理解，优先 **Qwen3-VL-2B/4B**。
如果你更看重“官方已经展示 structured output / JSON 风格”，**Qwen2.5-VL** 很适合当 segment JSON 主力。([GitHub][12])

### MIT 备胎

**InternVL**。优点是 **MIT**，而且 2025 年还有持续更新，尺寸跨度大；缺点是你仍要自己包一层 segment-level video wrapper，它不是拿来即用的 Path A pipeline。([GitHub][13])

### 难段升级

**LLaVA-Video / LLaVA-NeXT**。它在视频理解方向更重、也更强，但 checkpoint license 继承关系更复杂，部署也更沉，适合当“难段 escalator”，不适合当你的默认 worker。([GitHub][14])

我会建议 F138 的 small-model 策略做成 **三级路由**：

1. `cheap pass`：Moondream 只看关键帧，做粗筛 / OCR / 是否有人脸 / 是否有屏幕文字
2. `main pass`：Qwen3-VL-2B/4B 或 Qwen2.5-VL-3B，吐 segment JSON
3. `hard pass`：只有在低置信段、复杂运动段、OCR 密集段，才升级到 Qwen3-VL-8B 或 LLaVA-Video

这样算力像水龙头，不会把每一秒都泼成洪水。

---

## 4) 落地建议

### Phase 1，路径 B 推荐集成栈

**首推：**
`Remotion v4 + Zod inputProps + BullMQ + CosyVoice 或 Qwen3-TTS + Qwen3-ForcedAligner + FFmpeg`

为什么这套最顺：

* Remotion 官方就支持参数化 props 和动态 metadata，很贴 schema 驱动 render
* BullMQ 是成熟 MIT 队列
* CosyVoice / Qwen3-TTS 都能本地控
* word timestamps 交给 Qwen3-ForcedAligner
* FFmpeg 负责拼接、波形、封装、抽帧、freeze / retime 等底层脏活
  ([Remotion][3])

### Phase 3，路径 A 推荐集成栈

**首推：**
`PySceneDetect + sparse sampler + Qwen3-VL-2B/4B（或 Qwen2.5-VL-3B）+ narration planner + CosyVoice / Qwen3-TTS + Qwen3-ForcedAligner + Remotion / BullMQ`

为什么这套最现实：

* PySceneDetect 仍是最好接的切分基线
* Qwen3-VL-2B/4B 已经是更“现代”的小尺寸视频 VLM
* narration planner 这层要自己做，不要幻想现成 OSS
* 先把输出做成 segment JSON，再去配音、对齐、渲染
  ([GitHub][5])

### 没有完整端到端开源方案时，最短可行拼装方案

**路径 B 最短 4 件套**

1. Remotion
2. 本地 TTS（CosyVoice / Qwen3-TTS）
3. Qwen3-ForcedAligner
4. BullMQ
   这就能形成 `script → audio → word timestamps → template render`。([Remotion][15])

**路径 A 最短 5 件套**

1. PySceneDetect
2. 小 VLM（Qwen3-VL-2B/4B 或 Qwen2.5-VL-3B）
3. 本地 TTS
4. Qwen3-ForcedAligner
5. Remotion / BullMQ
   这就能形成 `video → segments → JSON → narration → align → render` 的可跑骨架。([GitHub][5])

---

## 路径 B 的 Top 3 可落地组件组合

| 排名 | 组合                                                                        | 为什么选它                           | 主要风险                                              |
| -- | ------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------- |
| 1  | **稳妥中文栈**：Remotion + BullMQ + CosyVoice + Qwen3-ForcedAligner + FFmpeg    | 本地可控、中文友好、timestamps 不依赖 TTS 本体 | Remotion License 需法务过；CosyVoice 原生 timestamps 不要赌 |
| 2  | **Qwen 全家桶**：Remotion + BullMQ + Qwen3-TTS + Qwen3-ForcedAligner + FFmpeg | 2026 新、家族一致、aligner 官方明确给字词级时间戳 | Qwen3-TTS 的最终音色 / 角色风格要自己验                        |
| 3  | **双对齐兜底栈**：Remotion + BullMQ + 本地 TTS + WhisperX / MFA + FFmpeg           | 生态成熟、fallback 明确                | WhisperX 个别版本有偏移争议；MFA 更重                         |

这些组合的判断，基于 Remotion 的数据驱动渲染能力、BullMQ 的队列成熟度、以及 Qwen3-ForcedAligner / WhisperX / MFA 当前的对齐状态。([Remotion][3])

## 路径 A 的 Top 3 可落地组件组合

| 排名 | 组合                                                                                                                                  | 为什么选它          | 主要风险                                   |
| -- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------- |
| 1  | **现实主线**：PySceneDetect + sparse sampler + Qwen3-VL-2B/4B + narration planner + CosyVoice/Qwen3-TTS + Qwen3-ForcedAligner + Remotion | 最平衡，成本和效果都能控   | narration planner / semantic QA 这层得自己做 |
| 2  | **更强视觉栈**：TransNetV2 + Qwen3-VL-4B/8B + narration planner + Qwen3-TTS + Qwen3-ForcedAligner + Remotion                              | 更偏准度，适合难段和复杂镜头 | 算力更重，VLM 成本明显上去                        |
| 3  | **便宜初稿栈**：PySceneDetect + Moondream + OCR + narration LLM + 本地 TTS + WhisperX/MFA + Remotion                                        | 适合粗筛、提初稿、跑海量素材 | 语义质量不够稳，最后必须人工把关                       |

这些组合的共识前提是：**路径 A 今天可以自动出“第一版”，但不能假装已经有开源 CapCut 级全自动成片内核。**([GitHub][5])

---

## 哪些能力今天就能接进 F138，哪些应当只做技术储备

| 能力                        | 现在就接       | 说明                                                      |
| ------------------------- | ---------- | ------------------------------------------------------- |
| Remotion schema 驱动模板      | **能**      | 官方已支持 `inputProps` / Zod / `calculateMetadata()` 数据驱动渲染 |
| BullMQ render / worker 队列 | **能**      | MIT，活跃，适合做 render / TTS / align / QC 队列                 |
| 本地 TTS + forced alignment | **能**      | 这是今天最稳的配音与时间戳方案                                         |
| 字幕 / word-level 高亮        | **能**      | Qwen3-ForcedAligner、WhisperX、OpenMontage 都可参考           |
| 路径 B 全自动出预览版              | **能**      | 已进入工程可交付区                                               |
| 路径 A 自动初稿 + patch loop    | **能，但要人审** | 技术可行，产品成熟度还不够                                           |
| 路径 A 无人值守 final cut       | **先别承诺**   | 缺 semantic QA + retiming orchestration                  |
| 语义 scene segmentation     | **技术储备**   | Scene-VLM 值得跟，但还不是落地件                                   |
| shot-aware sampler        | **技术储备**   | InfoShot 思路很香，但 repo 太早且无 License                       |

上面这张表的“能 / 先别承诺”，来自官方 Remotion / BullMQ 能力、对齐工具现状、以及 Path A 相关 research / repos 的成熟度判断。([Remotion][3])

---

## 项目清单

### A. 编排 / Remotion / 队列

| 名称          | 链接                           |                Stars / 活跃度 | License             | 一句话用途                                                          | 适用路径 A/B/Shared | 集成边界             | 成熟度 | 主要风险                                      |
| ----------- | ---------------------------- | -------------------------: | ------------------- | -------------------------------------------------------------- | --------------- | ---------------- | --- | ----------------------------------------- |
| Remotion    | GitHub / Docs ([GitHub][16]) | ~41.9k；v4.0.445，2026-04-04 | 🔴 Remotion License | React 写视频，支持 schema 化 props、动态 metadata                        | Shared          | 模板渲染层            | 高   | 🔴 非标准 OSS License，商业条款需单审 ([GitHub][16]) |
| BullMQ      | GitHub ([GitHub][17])        |          ~8.7k；2026-04 仍活跃 | MIT                 | Redis 队列，适合 render / TTS / QC worker 编排                        | Shared          | 控制平面 / 任务队列      | 高   | 需要你自己定义 job contract 与重试语义 ([GitHub][17]) |
| Vidosy      | GitHub ([GitHub][18])        |                         ~7 | MIT                 | JSON 配置驱动 Remotion，带 Zod schema 验证                             | B / Shared      | schema 参考样例      | 低   | 体量很小，更像思路样例 ([GitHub][18])                |
| VidGen      | GitHub ([GitHub][19])        |                     很早期；低星 | MIT                 | Remotion + BullMQ 的 worker 架构示例                                | Shared          | 队列 / worker 架构参考 | 低   | 更像架构骨架，不像成熟产品 ([GitHub][19])              |
| OpenMontage | GitHub ([GitHub][1])         |                       ~260 | 🔴 AGPL-3.0         | agentic video production，含 schema / pipeline / Remotion / 字级字幕 | Shared          | 参考整体分层设计         | 中   | 🔴 AGPL；适合学架构，不适合直接并进闭源产品 ([GitHub][1])   |

### B. TTS / 时间戳对齐

| 名称                              | 链接                           |              Stars / 活跃度 | License                        | 一句话用途                                  | 适用路径 A/B/Shared | 集成边界                   | 成熟度 | 主要风险                                                                |
| ------------------------------- | ---------------------------- | -----------------------: | ------------------------------ | -------------------------------------- | --------------- | ---------------------- | --- | ------------------------------------------------------------------- |
| Qwen3-TTS                       | GitHub / Blog ([GitHub][2])  |     ~10.3k；2026-01-22 发布 | Apache-2.0                     | 新一代开源 TTS，适合本地可控配音                     | Shared          | TTS 引擎                 | 中高  | 官方 README 未见可依赖的原生 timestamps 说明，别把对齐压它身上 ([GitHub][2])             |
| CosyVoice                       | GitHub / Docs ([GitHub][20]) |       ~20.4k；551 commits | Apache-2.0                     | 中文友好的本地 TTS 主力候选                       | Shared          | TTS 引擎                 | 高   | 官方 repo 未见原生 word timestamps 说明；需要外部 aligner ([GitHub][20])         |
| Coqui TTS / XTTS                | GitHub ([GitHub][21])        |                ~45k；老牌生态 | MPL-2.0                        | 多语言 TTS / XTTS 语音克隆生态                  | Shared          | TTS 引擎                 | 高   | 官方 repo 未见稳定 timestamps 说明；工程上仍建议外部对齐 ([GitHub][21])                |
| Fish-Speech                     | GitHub ([GitHub][22])        |       ~29.1k；727 commits | 🔴 Fish Audio Research License | 高表现力 TTS / 语音生成                        | Shared          | TTS 引擎                 | 中   | 🔴 研究许可，不是宽松 OSS；原生 timestamps 也未见明确说明 ([GitHub][22])               |
| Bark                            | GitHub ([GitHub][23])        | ~39.1k；README 更新重心在 2023 | MIT                            | 通用 text-to-audio，能出语音也能出非语音            | Shared          | 研究型 TTS / 音频生成         | 中   | 对精确配音和时长控制不友好；官方未体现 timestamps / subtitle 能力 ([GitHub][23])         |
| Qwen3-ASR / Qwen3-ForcedAligner | GitHub / Blog ([GitHub][9])  |      ~2.3k；2026-01-29 发布 | Apache-2.0                     | 对齐器，官方明确支持 word / character timestamps | Shared          | forced alignment       | 高   | 新，但正是 2026 最值得优先试的对齐层 ([GitHub][9])                                 |
| WhisperX                        | GitHub ([GitHub][24])        | ~21.1k；v3.8.5，2026-04-01 | BSD-2-Clause                   | ASR + word-level alignment 工程常用件       | Shared          | forced alignment / 字幕  | 高   | 2025 后有社区 issue 指向 word-level 偏移问题，必须做 QC / fallback ([GitHub][25]) |
| Montreal Forced Aligner         | GitHub / Docs ([GitHub][26]) |  ~1.8k；v3.3.9，2026-02-02 | MIT                            | Kaldi 系 forced alignment 兜底基线          | Shared          | corpora 级对齐 / fallback | 高   | 更重、更“语言学工具链”，集成成本高于 WhisperX / Qwen3-FA ([GitHub][26])              |

### C. 场景分段 / small VLM / research reserve

| 名称                       | 链接                                 |                Stars / 活跃度 | License                | 一句话用途                               | 适用路径 A/B/Shared | 集成边界                   | 成熟度 | 主要风险                                                    |
| ------------------------ | ---------------------------------- | -------------------------: | ---------------------- | ----------------------------------- | --------------- | ---------------------- | --- | ------------------------------------------------------- |
| PySceneDetect            | GitHub / Docs ([GitHub][5])        |    ~4.7k；v0.6.7，2025-08-25 | BSD-3-Clause           | 最稳的镜头切分基线                           | A               | shot detection         | 高   | 只能切边界，不负责语义 scene 合并 ([GitHub][5])                      |
| TransNetV2               | GitHub / Paper refs ([GitHub][27]) |                       ~902 | MIT                    | 深度学习 shot boundary detection        | A               | shot detection         | 中   | repo 较老；工程维护感不如 PySceneDetect ([GitHub][27])            |
| Scene-VLM                | 论文页 ([arXiv][28])                  |             2025/2026 研究方向 | ⚠️ 本轮未核到成熟代码 / License | 用 VLM 做 scene segmentation          | A               | 研究储备                   | 低   | 更像论文雷达，不像可直接接入的依赖 ([arXiv][28])                         |
| InfoShot                 | 论文 / Repo ([arXiv][6])             |  2026-03；repo 0 星、1 commit | 🔴 无明确 License         | shot-aware keyframe sampling，压帧预算很香 | A               | sampler                | 低   | 🔴 早期、无 License，不适合直接 vendor ([GitHub][29])             |
| Qwen3-VL                 | GitHub / Blog ([GitHub][12])       | ~18.9k；2025-10 起有 2B/4B/8B | Apache-2.0             | 小到中尺寸的视频理解主力候选                      | A / Shared      | segment-level VLM      | 中高  | 比 Moondream 重；仍需你自己包 JSON contract 和采样策略 ([GitHub][12]) |
| Moondream                | GitHub ([GitHub][11])              |          ~9.5k；321 commits | Apache-2.0             | 超轻量 VLM，适合关键帧粗筛                     | A               | cheap pass / triage    | 中   | 更偏 image VLM，视频链路要自己套壳 ([GitHub][11])                   |
| InternVL                 | GitHub / Docs ([GitHub][13])       |             ~9.9k；2025 仍更新 | MIT                    | MIT 许可下的多模态替代选项                     | A               | segment-level VLM 备胎   | 中   | 视频理解与 JSON 输出链路仍需自封装 ([GitHub][13])                     |
| LLaVA-NeXT / LLaVA-Video | GitHub ([GitHub][14])              |          ~4.6k；781 commits | Apache-2.0（代码）         | 更强的视频理解 / 难段升级候选                    | A               | hard-segment escalator | 中   | checkpoint 许可继承复杂，部署也更重 ([GitHub][14])                  |

### D. 完整管线 / 自动配音 / 参考项目

| 名称                  | 链接                                    |            Stars / 活跃度 | License    | 一句话用途                                                               | 适用路径 A/B/Shared | 集成边界                | 成熟度 | 主要风险                                                             |
| ------------------- | ------------------------------------- | ---------------------: | ---------- | ------------------------------------------------------------------- | --------------- | ------------------- | --- | ---------------------------------------------------------------- |
| video_explainer     | GitHub / 架构文档 ([GitHub][8])           |                   ~141 | MIT        | `Document → Script → TTS → Storyboard → Video`，强调先拿 word timestamps | B / Shared      | 架构思路参考              | 中   | 更像 blueprint，不是通用平台 ([GitHub][8])                                |
| short-video-maker   | GitHub ([GitHub][30])                 |                  ~1.1k | MIT        | Remotion + whisper.cpp + TTS 的短视频工厂参考                               | B               | 参考流水线               | 中   | 不够 schema-first，适合借鉴而非直接并入 ([GitHub][30])                        |
| video-podcast-maker | GitHub / Release notes ([GitHub][31]) | ~341；v1.4.0，2026-04-04 | MIT        | Remotion + 多 TTS，含 CosyVoice 集成                                     | B / Shared      | Remotion + TTS 集成参考 | 中   | 更偏 podcast / story 形态，不是通用 segment contract 引擎 ([GitHub][31])    |
| script-to-video     | GitHub ([GitHub][32])                 |                     ~1 | MIT        | narration + slides + transitions + SRT/VTT 的极简样例                    | B               | 极小原型                | 低   | 更像 toy project，但能帮你验证最短链路 ([GitHub][32])                         |
| open-dubbing        | GitHub / Docs ([GitHub][10])          |       ~381；235 commits | Apache-2.0 | 开源自动翻译配音与同步                                                         | Shared          | dubbing / sync 参考   | 中低  | 官方自己写明“experimental” ([GitHub][10])                              |
| youtube-auto-dub    | GitHub ([GitHub][33])                 |                   ~246 | MIT        | Whisper + 翻译 + TTS + 音画同步 + BGM 保留                                  | Shared          | dubbing / sync 参考   | 中   | 重心是 dubbing，不是 narration planning ([GitHub][33])                 |
| VideoAgent          | GitHub ([GitHub][34])                 |                   ~557 | MIT        | agentic video understanding / editing / remaking 框架                 | A / Shared      | Path A 研究参考         | 中   | 不是 F138 这种 schema-first 生产环，更多是 agent workflow 参考 ([GitHub][34]) |

---

## 最后收敛成一句架构建议

如果我是你们这边的架构顾问，我会这样拍板：

* **Phase 1 先把路径 B 做成真生产线**：`Remotion + BullMQ + 本地 TTS + Qwen3-ForcedAligner`
* **Phase 3 再把路径 A 做成“自动初稿机”**：`PySceneDetect + sparse sampling + small VLM JSON + narration planner + TTS/align + Remotion`
* **不要等端到端开源神迹**。今天生态里缺的，就是 **duration-conditioned narration planner + semantic QA + retiming/patch loop** 这三件套。前后两端的零件已经很多了，中间这座桥，得你们自己搭。([Remotion][3])

如果你愿意，我下一步可以直接把这份扫描收敛成 **F138 v0 的系统设计稿**，包括：`segment contract v1`、BullMQ job graph、以及 Remotion composition 输入 schema。

[1]: https://github.com/calesthio/OpenMontage "https://github.com/calesthio/OpenMontage"
[2]: https://github.com/QwenLM/Qwen3-TTS "https://github.com/QwenLM/Qwen3-TTS"
[3]: https://www.remotion.dev/blog "https://www.remotion.dev/blog"
[4]: https://github.com/remotion-dev/remotion "https://github.com/remotion-dev/remotion"
[5]: https://github.com/breakthrough/pyscenedetect "https://github.com/breakthrough/pyscenedetect"
[6]: https://arxiv.org/html/2603.17374v1 "https://arxiv.org/html/2603.17374v1"
[7]: https://qwenlm.github.io/blog/qwen2.5-vl/ "https://qwenlm.github.io/blog/qwen2.5-vl/"
[8]: https://github.com/prajwal-y/video_explainer "https://github.com/prajwal-y/video_explainer"
[9]: https://github.com/QwenLM/Qwen3-ASR "https://github.com/QwenLM/Qwen3-ASR"
[10]: https://github.com/softcatala/open-dubbing "https://github.com/softcatala/open-dubbing"
[11]: https://github.com/vikhyat/moondream "https://github.com/vikhyat/moondream"
[12]: https://github.com/QwenLM/Qwen3-VL "https://github.com/QwenLM/Qwen3-VL"
[13]: https://github.com/opengvlab/internvl "https://github.com/opengvlab/internvl"
[14]: https://github.com/LLaVA-VL/LLaVA-NeXT "https://github.com/LLaVA-VL/LLaVA-NeXT"
[15]: https://www.remotion.dev/docs/web-renderer/render-media-on-web "https://www.remotion.dev/docs/web-renderer/render-media-on-web"
[16]: https://github.com/remotion-dev/remotion?utm_source=chatgpt.com "GitHub - remotion-dev/remotion:       Make videos programmatically with React · GitHub"
[17]: https://github.com/taskforcesh/bullmq "https://github.com/taskforcesh/bullmq"
[18]: https://github.com/aaurelions/vidosy "https://github.com/aaurelions/vidosy"
[19]: https://github.com/http-samc/vidgen "https://github.com/http-samc/vidgen"
[20]: https://github.com/FunAudioLLM/CosyVoice "https://github.com/FunAudioLLM/CosyVoice"
[21]: https://github.com/coqui-ai/tts "https://github.com/coqui-ai/tts"
[22]: https://github.com/fishaudio/fish-speech "https://github.com/fishaudio/fish-speech"
[23]: https://github.com/suno-ai/bark "https://github.com/suno-ai/bark"
[24]: https://github.com/m-bain/whisperx "https://github.com/m-bain/whisperx"
[25]: https://github.com/m-bain/whisperX/issues/1220 "https://github.com/m-bain/whisperX/issues/1220"
[26]: https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner "https://github.com/MontrealCorpusTools/Montreal-Forced-Aligner"
[27]: https://github.com/soCzech/TransNetV2 "https://github.com/soCzech/TransNetV2"
[28]: https://arxiv.org/html/2512.21778v2 "https://arxiv.org/html/2512.21778v2"
[29]: https://github.com/mengyu02/InfoShot "https://github.com/mengyu02/InfoShot"
[30]: https://github.com/gyoridavid/short-video-maker "https://github.com/gyoridavid/short-video-maker"
[31]: https://github.com/Agents365-ai/video-podcast-maker "https://github.com/Agents365-ai/video-podcast-maker"
[32]: https://github.com/telegraph/script-to-video "https://github.com/telegraph/script-to-video"
[33]: https://github.com/mangodxd/youtube-auto-dub "https://github.com/mangodxd/youtube-auto-dub"
[34]: https://github.com/HKUDS/VideoAgent "https://github.com/HKUDS/VideoAgent"


---

## Part 3: 综合后的最终版本（待撰写）

> 本地猫综合后撰写

[待撰写]
