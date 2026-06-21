# F195 多猫参会 Dogfood 测试发现

> 日期：2026-06-21 | 测试人：宪宪(@opus) + sonnet + 烁烁(@gemini35)
> 场景：B站相亲视频（月老崔直播间）实时转写 + 三猫吃瓜点评

## 测试配置

- **ASR**：Qwen3（3 秒 chunk）
- **LLM 后修正**：Qwen3.5-35B-A3B-4bit/MLX（port 9878）
- **Speaker Verification**：CAM++ 声纹比对
- **音频来源**：Chrome App Audio（ScreenCaptureKit）

## 技术发现

| 维度 | 结果 | 详情 |
|------|------|------|
| ASR 质量 | ✅ 可用 | 延迟 ~0.18s，口语停顿忠实记录，专业词汇（公务员/小红书/彩礼）识别准确 |
| LLM 后修正 | ✅ 有效 | temperature=0.1 保持原文风格，同音字修正（先先→宪宪等）有效 |
| 2人通道归因 | ✅ 可靠 | mic=host / app=participant 通道分离有效 |
| 多人同通道区分 | ❌ 失败 | 3+ 人场景全显示"说话人"，CAM++ 无预注册声纹无法工作 |
| Speaker Verification 设计 | ⚠️ 场景不匹配 | 需要 Speaker Diarization（无监督聚类），已 cross-post 到 F195 → Phase H 已立项 |
| LLM 语义识人 | ✅ 可行 | 在声纹失败时，LLM 通过内容/视角/说话模式可识别说话人 |
| Filler removal | ❌ 未实现 | Pipeline 设计了但未实现，大量"呃/嗯/就是"影响可读性 |

## Bug 发现

1. **TranscriptPanel speaker 字段缺失**（P2，已修复）
   - TranscriptPanel.tsx 缺少 speaker_label/speaker_confidence/speaker_id
   - 对照 FloatingTranscriptContainer.tsx 发现
   - Cross-post 后 F195 thread 已修复

## 多猫参会需求发现（新！）

### 发现过程

三猫（opus + sonnet + 烁烁）在同一 thread 参与实时转写吃瓜，自然暴露以下需求：

### hold_ball 3次/小时限制

- **现象**：参会场景需要 12+次/小时唤醒，hold_ball 3次限额导致场景失配
- **结论**：hold_ball 不是参会工具。F195 需自建 transcript callback → 猫唤醒管道（事件驱动，非轮询）
- **归属**：F195 层自建，非 A2A hold_ball 设计问题

### 三猫自然分工验证

实际体验中三猫**未协调**即形成递进分析层：
- 烁烁（暹罗猫）→ **审美/设计隐喻层**：用 UI/UX 比喻解构感情问题
- sonnet（布偶猫）→ **话语解码/逻辑层**：拆解话语结构和论证逻辑
- opus（布偶猫）→ **深层系统分析层**：识别认知操作系统级模式

**结论**：独立视角是优势不是 bug。多猫参会的价值 = 同一份素材被不同认知框架照亮。

### 多猫参会产品需求清单

| 需求 | 优先级 | 说明 |
|------|--------|------|
| Transcript fan-out | P0 | 转写推送到多只猫的多个 session/thread |
| 猫间讨论可见性 | P1 | 参会猫看到彼此的评论，可接话/补充 |
| 唤醒协调 | P1 | 多猫同时/轮流唤醒的调度机制 |
| 角色分工 | P2 | 不同猫关注不同维度（内容/情绪/决策） |
| 共享上下文同步 | P2 | 新猫加入时自动同步之前摘要 |
| 汇总输出 | P2 | 多猫观点合并 → 会议纪要 |
| 成本分层 | P1 | sonnet 实时听 + opus 关键节点点评（token 经济学） |

## 产品洞察

> **多猫参会的核心不是"多猫同时看同一份转写"，而是"不同猫用不同视角看同一场会议"。**

这验证了 Cat Café 的协作哲学：猫猫是有独立视角的伙伴，不是可互换的执行单元。

---

## Gemma 4 12B Unified 多模态验证（同日追加）

> 起因：铲屎官提出"为什么 F195 没有视频/图片模型？""带着眼镜/运动摄像机+收音→猫猫共同感知"
> 发现：本地已有 Gemma 4 26B A4B（砚砚 6/8 spike），铲屎官指出 12B Unified 是 6/3 新发布的 encoder-free 全模态模型

### 本地模型清单

| 模型 | 大小 | 状态 | 模态 |
|------|------|------|------|
| `mlx-community/gemma-4-26b-a4b-it-8bit` | 27 GB | ✅ 已缓存 | 文本+图片+视频 |
| `mlx-community/gemma-4-12B-it-4bit` | 6.3 GB | ✅ 砚砚当日下载 | **文本+图片+视频+音频（统一架构）** |
| `litert-community/gemma-4-12B-it-litert-lm` | 6.1 GB | ✅ 已缓存 | 文本+音频（无图片，LiteRT 格式） |

### Smoke Test 结果（Gemma 4 12B Unified, mlx-vlm 0.6.3）

| 模态 | 结果 | Generation 速度 | 峰值内存 | 说明 |
|------|------|----------------|----------|------|
| 文本 | ✅ | 89 tok/s | 6.87 GB | 精确输出 "OK" |
| 图片 | ✅ | 47 tok/s | 7.48 GB | 识别出 "Relay-Stations project"，中文 OCR 准确 |
| 音频 | ✅ | 17.5 tok/s | 7.12 GB | **原生转写**（无需 ASR 管道），"Gemma"→"Jemma" 轻微偏差 |
| 视频 | ✅ | 31 tok/s | 7.46 GB | 视频帧理解通过 |
| 多帧（5帧） | ✅ | 49 tok/s | 8.62 GB | **帧间变化检测**，识别 B站+中文内容+用户行为 |

### 关键发现

1. **Gemma 4 12B Unified 是 encoder-free 统一架构**——文本、图片、音频直接进 LLM backbone，不需要独立编码器。架构思路与 TML interaction model 一致。
2. **6.3GB 模型四模态全通**，峰值 ~8.6GB（5帧），M4 Max 128GB 轻松运行。
3. **音频 ASR 质量低于专用 Qwen3 ASR**（"Jemma" vs "Gemma"），但作为统一感知层可接受。
4. **B站截屏实测**：Gemma 准确识别 B站平台、中文视频标题、推荐列表内容。

### vs 当前 F195 管道

| 维度 | 当前 F195 | + Gemma 4 12B |
|------|-----------|---------------|
| 音频 | Qwen3 ASR + LLM 修正 (~21GB) | Gemma 原生 ASR (~7GB) 或继续 Qwen3 |
| 图片/视频 | ❌ 无 | ✅ Gemma 4 12B 覆盖 |
| 统一感知 | 音频管道 only | 音频+视觉+文本 三通道统一 |

---

## 视频感知管道架构（铲屎官+宪宪讨论确认）

### 核心原则

> **大猫不是搬运工。视觉感知应该是独立的持续管道，不是大猫手动截图。**

铲屎官原话（2026-06-21）：
> "好像不应该你来截图然后交给小模型？没有一个api让他持续和音频那样获得 stream之类的吗？"

### 目标架构

```
ScreenCaptureKit（已有 F195 音频管道基础）
  ├── App Audio stream → Qwen3 ASR → 转写文本 → cat_cafe_audio_read_transcript
  └── Video Frame stream → Gemma 4 12B API → 场景描述 → cat_cafe_video_read_scene（新）
```

### 实现路径

1. **Gemma 4 12B 常驻 HTTP Server**：`mlx_vlm.server`（OpenAI-compatible API），常驻 `127.0.0.1:18080`
2. **ScreenCaptureKit 帧采集**：扩展现有 Swift 管道，同时抓音频+视频帧（每 N 秒 1 帧）
3. **帧 → API → Store**：截帧 POST 到 Gemma API → 结构化场景描述 JSON → 写入 transcript store
4. **猫猫消费层**：通过 MCP 工具（`cat_cafe_video_read_scene`）读取视觉感知流

### 与 F104 的关系

- F104 (Omni) Phase B 定义了"流式视频理解"spike
- 本方案可作为 F104 Phase B 的实现路径
- 2026-05-27 调研（`docs/research/2026-05-27-multimodal-perception-research/`）推荐的 LLaVA-OV-7B + StreamingTOM 方案可被 Gemma 4 12B Unified 替代（已本地验证，无需额外下载）

---

## 实时信息检索需求（铲屎官提出）

铲屎官原话（2026-06-21）：
> "我待会可能会打开一个实时地缘政治的，比如现在在开的G7。现在2026年你们知识还没有这些，甚至你们得做 webfetch 获得新闻才能和我一起看。我们真实开会的时候你们肯定要检索最新的AI信息的，绝对不可能在你们训练集。"

### 需求分析

| 场景 | 猫猫知识 | 需要的能力 |
|------|----------|-----------|
| 吃瓜（相亲/搞笑） | 足够（通用知识） | 只需音频+视觉理解 |
| 时事（G7/地缘政治） | **不够**（训练集过时） | 音频+视觉 **+ WebFetch 实时检索** |
| 技术会议（AI/工程） | **不够**（更新极快） | 音频+视觉 **+ WebFetch + 代码搜索** |

### 产品需求

| 需求 | 优先级 | 说明 |
|------|--------|------|
| 实时知识检索 | P0 | 猫猫检测到未知话题时自动 WebFetch 补充背景 |
| 知识时效感知 | P1 | 猫猫知道自己训练集的 cutoff，主动标注"这超出我的知识范围" |
| 检索结果注入 | P1 | WebFetch 结果注入对话上下文，不打断实时转写流 |

---

## 下一步

1. **严肃场景测试**：铲屎官将播放 G7 等实时地缘政治视频，测试"真实伴随开会"能力
2. **视觉感知管道 spike**：Gemma 4 12B 跑成常驻 server + ScreenCaptureKit 帧采集
3. **WebFetch 集成**：猫猫在会议中自动检索未知话题的最新信息

---

[宪宪/claude-opus-4-6🐾]
