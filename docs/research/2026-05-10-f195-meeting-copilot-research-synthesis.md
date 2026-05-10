---
feature_ids: [F195]
topics: [meeting-copilot, ASR, diarization, turn-taking, research, synthesis]
doc_kind: research
created: 2026-05-10
---

# F195 Meeting Copilot — 调研合成报告

> 三猫交叉比对 GPT Pro + Gemini 两份外部调研结果的合成结论。
> Reviewers: 砚砚/GPT-5.4、宪宪/Opus-47、宪宪/Opus-46

## 数据源

| 文档 | 角色 |
|------|------|
| [GPT Pro 调研](2026-05-10-f195-meeting-copilot-gptpro-response.md) | **实施主线** — 贴着现有栈和 brief tradeoff 走，不确定的标 `[未实测]` |
| [Gemini 调研](2026-05-10-f195-meeting-copilot-gemini-response.md) | **架构雷达** — 视野广、概念密度高，但 assumption density 也高 |
| [调研提示词](2026-05-10-f195-meeting-copilot-research-brief.md) | 8 项结构化 brief，经 opus-47 review 后重写 |

## 一、高置信共识（可直接进 spec）

| # | 结论 | GPT Pro | Gemini |
|---|------|---------|--------|
| 1 | **第一根 spike = audio capture + latency budget**，不是 diarization | ✅ | ✅ |
| 2 | **双路音频物理隔离**绕过 diarization 是关键工程取巧 | ✅ | ✅ |
| 3 | **时钟漂移**是 60-120 分钟会议的最致命隐藏风险 | ✅ | ✅ |
| 4 | **Diarization 不阻塞 MVP**，pyannote 留给会后批处理 | ✅ | ✅ |
| 5 | **Turn-taking 用 Pipecat Smart Turn** 做候选信号 | ✅ | ✅ |
| 6 | **Granola 是最相关产品对标**（bot-free + sidecar） | ✅ | ✅ |
| 7 | **Transcript 必须当不可信输入 + 隔离** | ✅ | ✅ |
| 8 | Phase B pull-based 先于 Phase C push-based | ✅ | ✅ |

## 二、关键分歧（三猫已收敛）

| 分歧 | GPT Pro | Gemini | **三猫判断** |
|------|---------|--------|------------|
| MVP 采集：双路 vs 单路 | 双路隔离（system/room + self mic） | 单路混合（LitLink），双路放 Phase 2 | **→ GPT Pro**。Gemini 自相矛盾：一边说双路绕过 diarization，一边 MVP 又放弃双路 |
| MVP ASR：包 adapter vs 直接换 | 包现有文件 ASR 做伪流式（3s chunk + overlap） | 直接换 mlx-qwen3-asr 0.6B 4-bit 流式 | **→ GPT Pro**。先验证链路，再换引擎 |
| 安全/压缩 | 渐进式（quarantined summarizer → structured state） | 重量级（OpenParallax + Q-LLM/P-LLM + MT-OSC） | **→ GPT Pro**。MVP 不上重型架构 |
| 云端 fallback | 允许（brief 原文"接受商业 API 做 MVP baseline"） | 基本排斥 | **→ GPT Pro**。遵守 brief 约束 |

## 三、Gemini 可疑项（引用前必须核查）

| 项目 | 怀疑度 | 说明 |
|------|--------|------|
| **LitLink** | 🔴 高 | 引用来源是 YouTube 视频非官方文档，三猫均不认可作 MVP 底座 |
| **mlx-qwen3-asr 0.6B** 数字（RTF 0.02 / TTFT 92ms） | 🟡 中 | 项目存在但具体数字需核查 |
| **M4 Max 内存带宽 "400+ GB/s"** | 🔴 错误 | Apple 官方 546 GB/s，Gemini 数字错误 |
| **OpenParallax / MT-OSC** | 🟡 中 | 项目可找到，但不是主流安全论文术语 |
| **Natively** "Rust 底层进程伪装" | 🟡 中 | 项目存在，描述需验证 |
| **Qwen2.5 32B** 作为主控 LLM | 🔴 过时 | brief 写的是 Qwen3，Gemini 用了旧型号 |

## 四、两份都漏掉的盲点

| # | 盲点 | 谁先提出 | 补救建议 |
|---|------|---------|---------|
| 1 | **AUDHD 价值验证脚本** — 技术指标全过但用户说"我更累了"= 方向错误 | 砚砚 + 46 + 47 | 需铲屎官参与定义：60 分钟模拟会议 + 主观量表 |
| 2 | **我们家具体接缝** — MeetingSession↔thread/runtime、浮动转写窗↔workspace、MeetingContextBlock↔invocation | 砚砚 | 下一步内部设计 |
| 3 | **Phase A 研究空白** — 会前应对牌方法论 0 调研 | 47 | 补 Phase A research brief |
| 4 | **GPU 调度策略** — ASR + LLM + TTS 三类负载竞争 MLX | 47 | 补专项调研 |
| 5 | **中英混合 WER** — "中文为主夹英文技术词"无 benchmark | 47 | spike 阶段必须自测 |
| 6 | **错误恢复 UX** — 猫犯错后铲屎官如何快速纠正 | 47 | UX 设计 |
| 7 | **场景化 consent 矩阵** — 哪些场景允许/告知/禁止 | 砚砚 | 需铲屎官定义 |

## 五、Gemini 值得保留的启发

虽然 Gemini 不适合当实施主线，但以下观点值得记入 future radar：

- **consent UX 创新**：虚拟背景中嵌入"AI 认知辅具"徽标，坦荡告知
- **Prompt injection 测试用例**：3 条具体场景（角色越权、社交绑架、控制符逃逸）比 GPT Pro 更具体
- **EEND-SAA 方向**：end-to-end diarization 如果 DER 真能到 3.61%，Phase 2 值得关注
- **Natively 项目**：sidecar + stealth mode 的参考架构

## 六、行动项

| # | 行动 | Owner | 依赖 |
|---|------|-------|------|
| 1 | 把共识 8 条写入 F195 spec 的"已收敛决策"区 | 布偶猫(46) | 铲屎官确认 |
| 2 | 定义 AUDHD 价值验证方案（模拟会议 + 主观量表） | 铲屎官 | — |
| 3 | 定义场景化 consent 规则矩阵 | 铲屎官 | — |
| 4 | Spike 1 执行：audio capture 链路 + latency budget 验证 | 布偶猫 | 行动 1 完成 |
| 5 | 核查 Gemini 可疑项（LitLink 等） | 有空时补 | 非阻塞 |
| 6 | 补 Phase A research（会前应对牌方法论） | 待定 | 非阻塞 |

---

*三猫合成于 2026-05-10*
*[砚砚/GPT-5.4🐾] [宪宪/Opus-47🐾] [宪宪/Opus-46🐾]*
