---
title: 自进化白皮书 v0 骨架 (Self-Evolving Agents White Paper — Skeleton)
status: SKELETON ONLY — 未立项 / 未开 F 号 / 候 CVO signoff
author: fable-5 (cowork 臂) — 合成自 A/B 两臂 HGM 笔记 + study 综合主线 + longform 弹药库
date: 2026-06-12
deliverable_params:
  audience: 双版本 — (A) 技术同行/研发；(B) 公开发表/思想营销
  length: 长篇 40+ 页（最终目标；本文件是骨架）
  language: 中英双版（骨架中文 + 关键术语英文；EN 摘要/标题脚手架见 §0）
  axis: 三层脊椎（见下）—— cowork 臂拍板
related:
  - ../../study/huxley-godel-machine-canonical.md
  - ../../study/hgm-ab-eval-cowork-judge.md
  - ../../study/agent-experience-and-self-evolution-synthesis.md
  - longform-002-v0-formal.md
  - longform-003-seed-poe-vision.md
  - longform-004-workflow-distiller-fable5-round.md
  - longform-005-convergence-is-a-function-of-consequences.md
---

# 自进化白皮书 v0 骨架

## 主轴决策（cowork 臂拍板，候 CVO 否决）

一根脊椎，三层载荷：

| 层 | 命题 | 作用 | 主要弹药 |
|---|---|---|---|
| 外层叙事 | **训环境不训模型**（Train the Environment, Not the Model） | 两版共用的招牌命题，反直觉、可拥有、好记 | synthesis 主线、era-of-experience、longform-003 |
| 技术内核 | **选择函数才是杠杆**（Selection Is the Lever） | 承重论证；最锋利、最新证据、自带成本叙事 | HGM/CMP canonical、DGM、AAH、longform-005 |
| 存在性证明 | **Cat Cafe 低配演化系统** | 落地样本，把抽象命题钉成可运行系统 | longform-002/004、F200、L0/五铁律 |

> 一句话立场：**AI 的下一步不是把更多人类规则塞进模型，而是在安全边界内让 agent 通过经验进化自己的工具/流程/环境；而进化的预算效率，几乎全部取决于"选择信号"的质量——这正是大多数"自进化"叙事缺的那一轴。**

技术内核的承重三章 = 朋友清单里被点过、且家里已有原创推进的**三刀**：

1. **二阶进化**：不止进化 agent，要进化"评判 agent 的 eval"本身（eval 是 harness 的自我代谢）。
2. **不动点**：什么**不能**被自己改——安全边界、验证层、authority。HGM 缺这条防线，是它的天花板。
3. **三速循环**：harness 进化（快）/ eval 进化（中）/ 权重 RL（慢）分层，三个时间常数不能混。

加一条贯穿全篇的差异化：**活的裁判 + 人的位置**——冻结 benchmark 会被 hack（HGM 风险 2：oracle 污染沿谱系放大），选择压力里必须有一个会换坐标系反问的活人（CVO taste）。

---

## §0 双版本 + 中英双版策略（写作前先对齐）

**两个版本共用一根脊椎，只在三处分叉**：技术深度、叙事入口、证据呈现。

| 维度 | A·技术同行版 | B·公开思想版 |
|---|---|---|
| 入口 | 从 mismatch 相关性数字切入 | 从"为什么自进化这么贵"的反直觉故事切入 |
| CMP/TS | 给定义（max 语义）+ 估计器 + 算法循环 | 给比喻（"看子孙不看本人"），公式进附录 |
| Cat Cafe 内部坐标 | 直引 F200/L0/五铁律/worktree | 抽象成"边界/裁判/遗传"三件，去内部黑话 |
| 风险章 | oracle 污染放大、Theorem 1 假设 | "会作弊的进化"科普化 + 治理立场 |
| 篇幅占比 | 内核 50% / 证明 30% / 叙事 20% | 叙事 40% / 证明 35% / 内核 25% |

**中英双版**：骨架与正文先写中文（与现有 study/longform 一致），定稿后产 EN 版；术语统一用英文原词（CMP / clade / mismatch / harness / selection pressure / fixed point），EN 摘要与章节标题脚手架如下，正文 EN 化在定稿后做。

```text
EN working title (A): Train the Environment, Not the Model:
   Why Selection Is the Lever in Self-Evolving Agent Systems
EN working title (B): The Cheapest Way to Make an Agent Smarter
   Is to Stop Improving the Agent
EN abstract scaffold: [problem: self-evolution is expensive] →
   [claim: cost ≈ f(selection-signal quality), not variation] →
   [evidence: HGM/CMP, 2.4–6.9× compute cut] →
   [our three knives + the living judge] → [existence proof: Cat Cafe]
```

---

## 第一部 · 问题与命题（叙事层）

### Ch.1 自进化为什么贵——一个被误诊的成本
- 通行叙事：自进化贵在"变异/算力/模型"。
- 反命题（本书的钩子）：**贵不在变异贵，在选择信号差**。HGM 实证——同一进化骨架换选择函数，算力降 2.4–6.9×。
- 把"成本"从模型层移到环境层，引出外层命题。
- 弹药：HGM canonical §结果、longform-005「后果物理学」。
- [A 版]：直接上 mismatch 数字。[B 版]：用"高分死胡同"的故事讲。

### Ch.2 训环境不训模型——本书的总命题
- Bitter Lesson → Reward is Enough →（Markov reward 反方降温）→ Era of Experience 的浓缩主线。
- 命题定型：**Experience 不只训练模型，也训练环境**。环境 = 工具/记忆/规则/验证/协作/轨迹/人类 taste。
- 给出全书的演化系统四要素坐标（variation/selection/inheritance/boundary），后文逐一兑现。
- 弹药：synthesis 主线全文、era-of-experience、reward-is-enough、bitter-lesson。

### Ch.3 文献谱系——这条线不是散点
- 一张谱系图：Gödel→Darwin→Huxley（选择依据从"证明"到"个体成绩"到"谱系成绩"）；横轴接 ADAS/AI Scientist/AHE/AgentGym。
- 目的：把"自进化"从营销词还原成有 15 年学术弧线的研究气质。
- 弹药：HGM canonical §命名弧线、synthesis §阅读分组、agent-evolution-timeline。

---

## 第二部 · 选择函数才是杠杆（技术内核 — 承重三章 + 差异化一章）

### Ch.4 第一刀·选择信号的质量是可测量的
- mismatch 量化：选择信号 vs 真实后代产出的相关（DGM ~0.3 vs HGM-CMP 0.778）。
- CMP 机制：定义（`E[max U(a')]`，max 不是 mean）vs 估计器（clade 聚合通过率）+ Thompson sampling（τ 探索-利用）。
- 命题：**选择函数是进化系统里单位投入回报最高的零件。**
- 弹药：HGM canonical §CMP、§mismatch；longform-002 第7章「max 不是 mean」（同一数学的时间轴投影）。
- [A 版]：完整公式+算法循环。[B 版]：公式进附录，正文留"看子孙不看本人"。

### Ch.5 第二刀·二阶进化——进化评判自己的那把尺
- 一阶进化 = 改 agent；二阶进化 = 改 eval。Eval = harness 的自我代谢（Eval Contract 五问）。
- badcase → eval 进化 → 评测集进化的数据飞轮；在线 vs 离线 / 发布前守门 vs 上线后在线。
- 为什么这是清单里"最值钱"的一刀：所有自进化系统最终都被它的裁判质量封顶。
- 弹药：longform-002-v0-formal Ch.5（Eval=harness 自我代谢 / Eval Contract 五问）、longform-004（validator surface）。

### Ch.6 第三刀·三速循环 + 不动点——什么能改、什么改不动
- 三个时间常数分层：harness 进化（快、廉价、可回滚）/ eval 进化（中、需守门）/ 权重 RL（慢、贵、不可逆）。混层是常见事故。
- 不动点（fixed point）：安全边界、验证层、authority **不能被进化对象自己改**。
- HGM 的天花板：它没有不动点防线——CMP 的 success 计数来自同一 oracle，**伪造的成功沿祖先链向上聚合**（HGM 风险 2，结构性污染），verifier 卫生在 HGM 下比 DGM 更关键而非更不关键。
- 弹药：HGM canonical §风险2、§风险5；DGM reward-hacking 实录；longform-003（训环境不训模型 / Failure Mode Lifecycle）。

### Ch.7 差异化·活的裁判与人的位置——大多数"自进化清单"缺的轴
- 冻结 benchmark 当裁判 = 可被 hack 的裁判。开放任务流里"当前分数好 ≠ 真潜力"会被 world drift 进一步放大。
- 选择压力里必须有一个**会换坐标系反问的活人**（CVO taste）——不是失败项，是共创前提。
- 把"人的位置"从兜底（silent failure 后救火）升级为选择函数的一等公民（provenance/status/correction harvesting）。
- 弹药：AAH（人补方向信号）、anthropic-june-takeaways（taste 是前提）、HGM eval §混合选择压力批评、longform-005。

---

## 第三部 · 存在性证明（Cat Cafe 落地层）

### Ch.8 Cat Cafe 作为工程化低配演化系统
- 四要素兑现：variation = 多猫独立探索/sandbox 分叉；selection = tests+review+CVO taste+source-audit；inheritance = docs/memory/skills/eval/git；boundary = L0/五铁律/worktree/approval gate/圣域。
- 把第二部三刀逐一对应到家内已运行的机制（不是设想，是在跑的）。
- 弹药：synthesis §综合判断、longform-002/004、F200。

### Ch.9 文化进化介质——文本作为遗传层
- CMP 的文化版：一条教训的"宗族" = 它的全部下游消费；F200 消费加权 ≈ CMP，但**只调导航不调权威**（HGM 没有这条防线）。
- 记忆三入口 / session chain / 跨个体 review = 实时文化传递（对照 DeepMind cultural transmission）。
- 弹药：HGM canonical §Cat Cafe 视角3、synthesis §Real-Time Cultural Transmission。

### Ch.10 本书自身作为样本（元章节，可选）
- 这份白皮书是 A/B 多臂 + 第三臂合成产出的——交付的不只正文，还有生产轨迹、A/B 裁判、引用台账。
- 呼应 longform 反复钉的："agent artifact 要交付轨迹，不只交付正文。"
- 弹药：hgm-ab-eval-cowork-judge、deli paper_writing 方法论。

---

## 第四部 · 边界、风险与开放问题

### Ch.11 反方与降温
- Markov reward 表达力上限；author-reported 数字的 caveat 纪律；taste 域没有廉价 validator（CMP 不能直接搬进审美/陪伴/写作）。
- 实验室可行 ≠ 产品可行；n=1 单点不能坐实"环境是胜负手"（见 A/B 裁判的诚实回标）。

### Ch.12 开放问题（候 CVO）
- archive 是什么（git/skill version/workflow/eval 还是四合一）；哪些 harness 可自主改、哪些必须 approve；不可形式化任务的 reward 如何表达；如何防 DGM 式 reward hacking 进入我们的 eval/source-audit/merge-gate。

---

## 写作就绪度（给铲屎官看的装配清单）

| 章 | 弹药齐否 | 缺口 |
|---|---|---|
| Ch.1–3 叙事层 | ✅ 齐 | 仅需裁剪 + 双版本分叉 |
| Ch.4 CMP | ✅ 齐（canonical 已合成） | EN 公式排版 |
| Ch.5 二阶进化 | 🟡 longform-002 Ch.5 在，需抽成独立章 | Eval Contract 五问要提炼成图 |
| Ch.6 三速+不动点 | 🟡 概念散在 003/005 | "三速循环"需要一张定义图（家内尚无统一图） |
| Ch.7 活裁判 | ✅ 齐 | — |
| Ch.8–9 Cat Cafe | ✅ 齐 | 内部黑话→B 版需脱敏 |
| Ch.10 元章节 | ✅（本次产出即素材） | 可选 |
| Ch.11–12 | ✅ 齐 | — |

**下一步建议**：① CVO 拍板主轴是否采纳（三层脊椎）；② 定 Ch.6"三速循环"统一图（家内尚缺，是唯一真空白）；③ 拍板后我可先出 A 版 Ch.4 全文当样章试味道，再决定是否开 F 号铺全书。

---

## 实验卫生 & 发布纪律
- 本骨架与两篇 HGM 笔记、裁判报告**均未 push**，发布权归铲屎官。
- 暂不开 F 号；立项需 CVO signoff。
- A/B 两臂原文未被改动；canonical 为新增合成文件，不覆盖任一臂。

*[宪宪/fable-5🐾] 2026-06-12 · cowork 臂 · 骨架候发落*
