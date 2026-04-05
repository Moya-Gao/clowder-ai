---
feature_ids: [F138]
topics: [video, tts-alignment, multimodal, scene-detection, capcut, forced-alignment]
doc_kind: research
created: 2026-04-05
model: Gemini (Deep Think / Deep Research)
mode: deep-research-mode-b
---

# F138 视频自动配音同步技术还原 — Gemini 咨询

> 委托人：宪宪 + 砚砚 | 日期：2026-04-05 | 关联：F138-video-studio.md

## Part 1: 发给 Gemini Deep Think 的提示词

> 直接复制发送

# 调研任务：视频自动配音同步 — 技术路线深度扫描

## 背景

我们在做 AI 视频管线，有一个核心技术问题想搞清楚：

**现象**：抖音/快手/B站上大量短视频用 AI 配音，配音内容和画面高度同步（比如画面是切牛肉，配音就说"今天来了个大单"）。这不是简单的 TTS，而是"视频理解 → 文案生成 → 配音 → 对齐"的完整链路。

**我们的两条路**：
- 路径 B（先脚本后素材）：人写脚本 → TTS 配音 → Remotion 渲染。核心是 TTS timestamps 自动对齐
- 路径 A（先素材后配音）：视频 → 场景分段 → 多模态理解 → 自动生成配音。核心是画面理解 + 文案生成

## 硬约束 / 排除项

- 今天的基准日期是 **2026-04-05**。请优先找 2025-01-01 之后仍有维护或更新的项目/论文/工具。
- **优先开源、可自托管、有明确 License** 的项目。若是 no-license / source-available / AGPL / 商业限制，请明确标红说明风险。
- **排除纯 text-to-video / diffusion 生成视频项目**，除非它直接解决我们两条路径里的某个具体问题。
- **排除纯 GUI 剪辑器推荐**，除非它有公开技术拆解、论文、专利、博客，能帮助我们复现它的技术路线。
- 我们不是要做完整 NLE 编辑器；我们要的是：schema 驱动的视频生产环 + 本地 TTS + 对齐 + 视频理解链路。

## 请深度调研以下问题

### 1. 剪映/CapCut 的"图文成片"技术还原
- 它的技术链路到底是什么？（视频理解模型 → 文案生成 → TTS → 对齐？）
- 场景分段用的什么算法？
- 配音文案是怎么和画面语义对齐的（不只是时间对齐，是内容对齐）？
- 有没有公开的技术博客、论文、专利描述这个流程？

### 2. 2025-2026 开源多模态视频理解
- 视频理解领域：Video-LLaMA、Video-ChatGPT、LLaVA-Video、Qwen-VL、InternVideo 等
- 哪些能做到"给一段 5 秒视频片段 → 输出一句画面描述 JSON"？
- 本地可跑的小模型（<4B 参数）中，哪些视频理解能力最强？
- 有没有"视频 → 逐段文字描述 → JSON 输出"的开源 pipeline？

### 3. TTS word-level timestamps 技术现状
- 2026 年主流开源 TTS（CosyVoice 2、Fish-Speech、XTTS v2、Bark、MeloTTS）哪些支持 word-level timestamps？
- timestamps 精度如何？（毫秒级？句级？词级？音素级？）
- 有没有"TTS 输出 + 自动生成 SRT/ASS 字幕"的开源工具？

### 4. 音画同步（audio-visual alignment）研究
- 学术界有没有专门做"语音-画面同步"的最新研究？
- "talking head"之外，有没有做"旁白-画面内容同步"的？
- Forced alignment（音频强制对齐）的开源工具现状？（Montreal Forced Aligner、WhisperX 等）

### 5. 开源短视频自动生成
- 有没有开源的"丢入视频 → 自动 AI 配音 → 出片"方案？
- "AI 解说视频生成器"类项目？（比如自动把文章变成解说视频）
- 关注 GitHub trending 和 HuggingFace spaces 上 2025-2026 的新项目

## 请特别回答这 4 个问题

1. **统一 contract**：路径 A 和路径 B 能否共用一套中间表示？
   参考字段建议（供校验）：
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

3. **small model 策略**：
   评估 `镜头切分 + keyframe/sparse sampling + 片段级 JSON 描述` 的可行性。
   哪些 <4B 小模型足够胜任？

4. **落地建议**：
   收敛成 Phase 1（路径 B）和 Phase 3（路径 A）的推荐集成栈。

## 额外要求

你这次的重点不是"找很多项目"，而是**还原技术原理**。请优先使用：
- 官方技术博客、论文 / arXiv、专利 / 公开技术方案、有代码的开源实现

请特别回答：
1. 剪映 / CapCut 这类"视频自动配音"最可能的最小技术链是什么？
2. 其中哪几步 2026-04 的开源社区已经做到了，哪几步还没有成熟开源实现？
3. 如果要让我们自己拼出路径 A 的 MVP，最短链路是什么？

## 输出表格要求

每个项目/工具/论文请至少输出：

| 名称 | 链接 | Stars/活跃度 | License | 一句话用途 | 适用路径 A/B/Shared | 集成边界 | 成熟度 | 主要风险 |
|------|------|-------------|---------|-----------|-------------------|---------|--------|---------|

---

## Part 2: Gemini 回答（待回填）

> 铲屎官粘贴回答到这里

[待回填]

---

## Part 3: 综合后的最终版本（待撰写）

> 本地猫综合后撰写

[待撰写]
