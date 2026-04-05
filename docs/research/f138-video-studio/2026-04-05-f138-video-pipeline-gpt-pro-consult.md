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

[待回填]

---

## Part 3: 综合后的最终版本（待撰写）

> 本地猫综合后撰写

[待撰写]
