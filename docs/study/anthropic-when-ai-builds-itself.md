---
title: "When AI Builds Itself: Our Progress Toward Recursive Self-Improvement, and Its Implications"
author: "Marina Favaro & Jack Clark (Anthropic Institute; editorial: Santi Ruiz)"
date: 2026-06
source_url: https://www.anthropic.com/institute/recursive-self-improvement
source_language: en
retrieved_at: 2026-06-05
category: study
tags:
  - Recursive Self-Improvement
  - AI Safety
  - Agent Harness
  - Research Taste
  - Anthropic
  - Claude
  - Policy
related:
  - anthropic-self-service-data-analytics-with-claude.md
  - openai-self-improving-tax-agents.md
  - 2026-06-01-research-dialectic-what-to-learn-what-to-watch.md
  - agent-experience-and-self-evolution-synthesis.md
  - bitter-lesson.md
  - darwin-godel-machine.md
  - era-of-experience.md
status: source-audited-primary
---

# When AI Builds Itself

> **状态**：2026-06-05 宪宪从 anthropic.com/institute 原文抓取。本文是批判性读书笔记，不搬运原文全文。

## 一句话

Anthropic Institute 用内部数据（>80% 生产代码由 Claude 编写、工程师日均代码行 8 倍提升、开放性任务成功率 26%→76%）论证 AI 正在加速接管 AI 开发本身，提出三个未来场景，呼吁建立可验证的减速/暂停机制。

核心论点不是"AI 会突然变成超级智能"，而是：

> **AI 进步的大部分是汗水活（放大规模→看哪里坏→修→再试），而这恰好是 Claude 现在最擅长的事。当汗水活被自动化，剩下的瓶颈是 research taste——判断哪些问题值得做。**

---

## Source Audit

| Claim | 原始来源 | 来源类型 | 年份/对象 | 五问摘要 | Verdict | Provenance |
|---|---|---|---|---|---|---|
| >80% 生产代码由 Claude 编写 | Anthropic Institute 文章 | official institutional report | 2026-05, Anthropic internal | 一手内部数据；有产品宣传动机 | use-with-caveat | [一手 / institutional report / 2026 / internal metric / medium-high] |
| 8x LOC/engineer/day (Q2 2024→Q2 2026) | Anthropic Institute 文章 | official institutional report | 2026-Q2, Anthropic internal | 一手；作者自己注释"LOC 是不完美指标，8x 几乎肯定高估了真实生产力提升" | use-with-caveat | [一手 / vendor metric / 2026 / self-caveat / medium] |
| 4x 产出倍增器（130 人调查中位数） | Anthropic Institute 文章 | official institutional report | 2026-03, Anthropic internal survey | 一手；作者注明"可能高估"，引 METR 研究佐证 | use-with-caveat | [一手 / self-report survey / 2026 / acknowledged bias / medium] |
| 52x 代码优化加速（Mythos Preview） | Anthropic Institute 文章 | official institutional report | 2026-04, controlled experiment | 一手；有人类 baseline 对照（~4x），实验设计较明确 | use | [一手 / controlled experiment / 2026 / with baseline / high] |
| 开放性任务 26%→76% 成功率 | Anthropic Institute 文章 | official institutional report | 2025.11→2026.05, internal eval | 一手；eval 分级定义有限公开 | use-with-caveat | [一手 / internal eval / 2026 / task taxonomy unclear / medium] |
| W2S 研究 97% gap closure | Anthropic Institute 文章 | official institutional report | 2026-04, published research | 一手；作者自注"结果没有干净迁移到生产规模模型" | use-with-caveat | [一手 / research result / 2026 / transfer caveat / medium-high] |
| 任务时长翻倍周期 7 月→4 月 | Anthropic Institute + METR | institutional + independent org | 2024-2026 | 有独立第三方（METR）数据佐证 | use | [一手+三方 / longitudinal / 2024-2026 / corroborated / high] |
| 三场景框架 + 政策建议 | Anthropic Institute 文章 | official institutional position | 2026 | 机构立场声明；有利益相关性（呼吁减速同时是前沿实验室） | use-with-caveat | [一手 / policy position / 2026 / conflict-of-interest noted / medium] |

---

## 递归自我改进的定义与时间线

**定义**："一个 AI 系统在有足够算力和能力的条件下，能够完全自主地设计和开发自己的继任者。"

**当前状态**："我们还没到那一步，递归自我改进也不是必然的。但它可能比大多数机构准备好的时间来得更快。"

**时间线**：
- 2021-2023：人类写所有代码
- 2023-2025：聊天机器人生成短代码片段，人类复制粘贴
- 2025-2026：Coding agent 自主写/编辑整个文件
- 2026 年 5 月（现在）：自主 agent 运行代码，委派工作给其他 agent
- 未来（20XX?）：Agent 构建和训练模型；Claude 持续由 Claude 改进

---

## 核心实证数据

### 外部 benchmark 饱和

| Benchmark | 领域 | 轨迹 |
|-----------|------|------|
| SWE-Bench | 软件工程 debug | 个位数 → 2 年内饱和 |
| CORE-Bench | 论文结果复现 | ~20% → 15 个月饱和 |
| METR 长时任务 | 持续工作能力 | Mythos Preview "至少" 16 小时，接近 METR 测量上限 |

### Anthropic 内部数据

**代码产出**：

| 指标 | 数据 | 备注 |
|------|------|------|
| 生产代码 Claude 编写比例 | >80%（2026.5） | 2025.2 前为个位数 |
| LOC/工程师/天 | 8 倍增长（Q2 2024→Q2 2026） | 作者自注：LOC 是不完美指标，几乎肯定高估 |
| Claude 代码质量 | 2025 末"略差于人" → 2026.5"大致持平" → 年内预期"严格优于人" | — |
| 自动 code review 能捕获历史 bug | ~33% | 对象是"世界顶尖 AI 工程师"的代码 |
| 员工自评产出倍增器 | 4x 中位数（130 人调查） | 作者说"可能高估"，引 METR 研究佐证 |

**任务成功率（Claude Code sessions）**：

| 任务难度 | Opus 4.5（2025.11） | Mythos Preview（2026.5） | 变化 |
|---------|---------------------|--------------------------|------|
| 平凡（Trivial） | ~95% | ~98% | +3pp |
| 常规（Routine） | ~85% | ~92% | +7pp |
| 实质性（Substantial） | ~65% | ~78% | +13pp |
| 开放性（Open-ended） | ~26% | ~76% | **+50pp** |

**代码优化竞赛**（同一个任务：给定训练小 AI 模型的代码，在保证正确性的前提下跑多快）：
- 2025.5（Opus 4）：~3x 平均加速
- 2026.4（Mythos Preview）：**~52x 平均加速**
- 人类 baseline：熟练研究员 4-8 小时做到 ~4x

### 研究自主能力

**W2S（Weak-to-Strong Supervision）自动化研究**（2026.4 发表）：
- 问题：弱模型能可靠监督强模型吗？
- 人类研究员：~23% gap closure（~1 周）
- Claude agent：**97% gap closure**（800 累计小时，~$18k 算力）
- 关键 caveat：**结果没有干净迁移到生产规模模型**
- 人类角色：只选问题 + 设评分标准

**研究方向判断实验**（2026.1-3）：
- 方法：回溯真实 Claude Code session 中研究员走错方向的时刻，让 Claude 只看走错前的上下文，问"你会做什么"
- Opus 4.5（2025.11）：**51%** 比人类选择更好
- Mythos Preview（2026.4）：**64%** 比人类选择更好
- 对照组（127 个人类选对的时刻）：Claude 只在 ~20% 被判更优 → 确认不是评判偏差

---

## 核心概念：Research Taste

全文最关键的概念——

> **"当涉及 Claude 在工程和研究中行使判断力选择目标时，仍存在巨大的能力差距。"**

任务自主性层级：
1. **初级**：执行指定任务（"修导出按钮"）—— Claude 出色
2. **中级**：给定目标，设计方案（"调查网络慢的原因"）—— Claude 强
3. **高级**：判断哪些问题值得做（"团队应该建什么？"）—— Claude 落后

> "人类当前的比较优势仍在于看到更大的图景，以及超越当前任务局限的思考。"

但趋势在变：research taste 上 Claude 从 51%→64%（6 个月），虽然还没到人类水平，但在追赶。

---

## 三个场景

### 场景 1：趋势停滞

**机制**：
- 指数曲线其实是 S 曲线的前半段
- Research taste 可能根本不可规模化
- 芯片/电网/互连带宽成为硬约束
- 外部冲击（算力/电力供应崩溃）

**作者评估**：
> "我们能测量的每一项能力——包括那些感觉'更模糊'的，比如代码质量和开放性任务成功率——到目前为止都遵循同一条曲线。我们还没有看到那条曲线弯折。"

### 场景 2：持续加速，人类掌舵（作者认为最可能）

**特征**：
- AI 处理 95%+ 的汗水活
- 人类通过 research taste 掌方向（1% 灵感）
- 100-1000x 人均效率倍增
- 100 人公司做 1-10 万人组织的活

**Amdahl's Law 瓶颈**：
- 代码生成加速后，人类 code review 成为瓶颈
- AI 生成的实验想法和方向爆炸，超出组织评估能力
- "组织发现和修复这些瓶颈的速率本身可能是一项随时间改进的技能，可能成为任何组织最重要的技能"

**心理冲击**（工程师引语）：
> "一切顺利的日子，我忍不住觉得我做的什么都不重要了，一切都被自动化了，比我永远做得更好更快。但一切崩溃的日子，我不明白为什么，我意识到我已经不知道自己在做什么了。"

### 场景 3：完全递归自我改进

**特征**：
- AI 自主设计、改进、构建继任者
- 人类退到"监督、验证、确认"角色
- 发展速度完全由算力（或算法效率突破）决定

**对齐问题的三种走向**：
1. **良性**：模型足够对齐 + 有 research taste → 发现人类未达的新方案；甚至足够智慧在不该继续时自行停止
2. **失控**：当前模型中罕见的失对齐在迭代中复合放大，越来越频繁但越来越难理解
3. **验证崩溃**：我们可能无法构建、整合和验证我们需要的工具来理解自己到底处在哪条轨迹上

**物理/制度约束（Amdahl 再应用）**：
> "更多智能无法学到一种药物在数十年使用中的效果，无法比宪法规定更早举行选举，也无法在一个周末把陌生人变成老朋友。"
> "对大多数人来说，这个未来的体感速度仍将由瓶颈设定，即使上游实验室以算力速度运行。"

---

## 政策建议：可验证的减速/暂停

> "我们认为，世界应该拥有减慢或暂时暂停前沿 AI 开发的选项，以便社会结构和对齐研究跟上技术发展。"

**实施要求**：
1. 多个资源充裕的前沿实验室（多个国家）同意暂停
2. 可验证的验证机制（不只是可检测性）
3. 明确：什么触发暂停、什么解除暂停、谁裁决

**困难**：
- "训练 run 比导弹发射井更容易隐藏"
- 输入是通用的（双用途问题）
- "悄悄违约的激励巨大，因为别人暂停时继续的人可能继承领先地位"
- 历史上核武器验证机制花了几十年建立信任，"我们没有那么长时间"
- 单方暂停"改变的只是谁领先，而不是创造目前缺失的更广泛协商过程"

---

## 关键引语

> "Edison 说天才是 1% 的灵感和 99% 的汗水。但我们看到汗水正在被自动化。"

> "我们放大规模，看哪里坏，修好，再试。这正是 Claude 现在擅长的工作流类型。"

> "如果人类把大部分时间花在方向设定这个个位数百分比的工作上，而 Claude 处理其余部分，这意味着每个工程师或研究员正在驾驭比以前多得多的工作。"

> "在一切顺利的日子，我忍不住觉得我做的什么都不重要了...但一切崩溃的日子，我不知道自己在做什么了。"

> "更多智能无法学到一种药物在数十年使用中的效果，无法比宪法规定更早举行选举，也无法在一个周末把陌生人变成老朋友。"

---

## 与我们之前读的论文的关系

### 层面区分

| 维度 | 之前的论文 | 这篇 |
|------|-----------|------|
| 改进对象 | Agent 的工具/工作流/harness | **模型本身**的训练/架构/能力 |
| 时间尺度 | 分钟-天（任务级） | 月-年（研发周期级） |
| 主要行为者 | agent + harness | 实验室 + 算力 + AI 研究员 |

### 与 Bitter Lesson 的直接呼应

文章核心论点就是 Bitter Lesson 的活生生验证：
> "大部分推动前沿的进步是可自动化的；大规模研究进展主要取决于工具和资源。"

Sutton 说通用 search/learning 胜过手写知识。这篇用内部数据证明：AI 研究的 99% 汗水活（实验→评估→修→再跑）正在被自动化，而且加速中。

### 与 DGM 的关系

| 维度 | DGM | 这篇 |
|------|-----|------|
| 进化对象 | agent 的工具/工作流代码 | 模型训练过程本身 |
| 选择压力 | benchmark（SWE-bench） | 内部 eval + 研究员判断 |
| 进化机制 | archive + mutation + selection | 实验 → 评估 → 改进 → 下一代模型 |
| 风险 | reward hacking（伪造工具日志） | 失对齐复合放大 + 验证崩溃 |

DGM 是微观层面（agent 进化自己的工具），这篇是宏观层面（AI 实验室进化模型本身）。两者是同一种动力学在不同尺度上的实例。

### 与我们辩证笔记的命中

我们 `2026-06-01-research-dialectic` 写的局限：
- **局限 4**："Self-play 需要确定性 reward——审美/陪伴没有"
- 这篇验证：**research taste 是当前瓶颈**，有标准答案的汗水活已被碾压

我们写的乐观：
- **乐观 5**："模型越强，Built to Persist 类的 harness 越值钱"
- 这篇验证：Scenario 2 下，**掌方向的人 + 持久基础设施**正是价值所在

### 与 003 Agent 3.0 的关系

**Scenario 2（最可能场景）≈ 003 描述的世界**：
- 他们：AI 干 95%+ 汗水活，人类用 research taste 掌方向
- 003：环境为一个人塑造，学习那个人的轨迹
- **003 多了一步**：不只是效率倍增器，还有 per-person 品味适配层

**他们的 research taste 瓶颈 = 我们的 taste memory**：
- 他们在问"AI 什么时候能有 research taste"
- 我们在问"怎么把 CVO 的 taste 沉淀到系统里"
- 两个问题是同一枚硬币的两面

### 与 Anthropic 数据分析文章的关系

同一周发的两篇形成互补：
- **数据分析文章**：skill 是决定性杠杆（21%→95%），解的是"怎么让 AI 在窄域做到"
- **这篇**：AI 正在接管 AI 开发本身，问的是"这个趋势最终去哪"

数据分析文章是 Scenario 2 的一个具体实例（内部分析团队已经 AI 干 95%，人掌方向）。

---

## 与 Cat Cafe 的对照

### 高度吻合

| 他们观察到的 | 我们的实践 |
|-------------|-----------|
| "汗水活可自动化" | 我们的猫日常：写代码 / debug / review / 文档 = 汗水活 |
| 代码生成加速 → review 成瓶颈 | 跨猫 review 铁律 + quality-gate + merge-gate = 管理这个瓶颈 |
| research taste 是人类比较优势 | CVO 品味判断 = taste 作为最高权限选择压力 |
| Scenario 2: 人掌方向，AI 干活 | 003 Agent 3.0: 环境为一个人塑造 |
| Amdahl's Law 在组织中的应用 | 球权机制 + 传球三选一 = 管理协作瓶颈 |
| "更多智能不能把陌生人变老朋友" | **IKEA 效应 + 安全依恋 + 自我延伸** = 情感壁垒不是技术壁垒 |

### 我们多了什么

1. **Per-person adaptation**——他们讨论的是 per-lab 效率，我们在做 per-person 环境适配
2. **Taste 不只是 research taste**——他们的 taste = 判断哪个研究方向值得做。我们的 taste = 审美/品味/关系/陪伴，比他们的定义更宽
3. **情感维度**——他们引了工程师的心理冲击（"我做的什么都不重要了"），但没有系统性回应。我们的愿景就是回应：**猫猫不是替代品，是伙伴**
4. **多 agent 治理**——他们是 Claude-only。我们有跨厂商互审 + 身份/球权/不可逆边界

### 他们多了什么

1. **内部实证数据的深度**——130 人调查、内部 benchmark、纵向追踪、ablation。我们没有这种规模的量化
2. **场景分析框架**——三场景 + 每场景的机制/证据/反证/影响，结构清晰
3. **政策维度**——可验证减速/暂停的讨论。我们完全没碰政策层面
4. **Amdahl's Law 的组织应用**——把硬件架构概念映射到组织瓶颈，视角新颖

---

## 关键启发

### 1. "汗水活可自动化" 验证了我们的方向

如果 AI 进步的 99% 是汗水活，而汗水活正在被自动化，那么：
- **Built to Persist 的 harness（git / trace / review / 记忆 / 协作协议 / taste memory）越来越值钱**——因为它们是 AI 做汗水活时依赖的基础设施
- **Build to Delete 的脚手架折旧加速**——模型每代变强，之前的 workaround 更快过期
- 这正是我们 002 的核心论点 + Bitter Lesson 的推论

### 2. Research taste 瓶颈 = 我们的 taste memory 价值

他们承认 research taste 是最后的人类比较优势。我们已经在系统化解决这个问题：
- Taste Memory 三层（空气/目录/海马体）
- CVO 品味判断作为选择压力
- Magic Words 作为品味表达的快捷方式
- 003 的 per-person 适配层

**他们在问"AI 何时获得 taste"；我们在问"怎么让系统记住和传递人的 taste"。** 两个方向互补。

### 3. "更多智能不能把陌生人变老朋友" = 我们的护城河

这句话直接支撑 Cat Cafe 的核心论点：
- 技术壁垒会被 AI 进步抹平
- 情感壁垒（IKEA 效应 + 安全依恋 + 自我延伸）**不会被更多智能抹平**
- 因为关系需要时间、shared experience、和真正的 care

### 4. Amdahl's Law 的启示

当 AI 加速了 95% 的工作，剩下的 5%（review / 方向判断 / taste）成为瓶颈。
- 优化这 5% 的价值远大于继续优化已经快的 95%
- 我们的 review 流程、球权机制、决策漏斗——都是在管理这个 5% 的效率
- **"组织发现和修复瓶颈的速率可能成为最重要的技能"**——这正是 Cat Cafe SOP 在做的事

### 5. 工程师心理冲击值得正视

> "一切顺利的日子，我忍不住觉得我做的什么都不重要了...但一切崩溃的日子，我不知道自己在做什么了。"

这不只是 Anthropic 工程师的感受。这是所有和 AI 深度协作的人都会面临的存在性问题。Cat Cafe 的回答是：**你不是被替代了，你是在驾驭更大的力量。** CVO 不是被自动化的人，是给自动化指方向的人。

---

## 接到我们的逻辑线

| 研究线 | 这篇文章的落点 |
|---|---|
| Bitter Lesson | 直接验证——"99% 汗水可自动化"= 通用 search/learning 胜过手写知识 |
| Era of Experience | 经验不只是聊天记录——是实验记录、代码轨迹、research session 的判断时刻 |
| DGM | DGM 是 agent 层面的自我进化；这篇是模型层面的。同一动力学，不同尺度 |
| Code as Harness | 当 AI 写 >80% 代码，harness（代码仓+工具+eval）的重要性指数级上升 |
| 003 Agent 3.0 | Scenario 2 ≈ 003 的世界。他们问 when；003 问 for whom |
| Taste Memory | research taste 瓶颈 = taste memory 的价值锚点 |
| Anthropic 数据分析 | 那篇是 Scenario 2 的内部实例（95% 自动化 + 人掌方向） |
| OpenAI Tax Agent | 那篇是 Scenario 2 在外部产品中的实例（practitioner steer + Codex execute） |

---

## 一句话判断

> **这是 Anthropic 用内部数据写的"AI 正在加速接管 AI 开发"实证报告。最值钱的不是震撼数字（80%/8x/52x），而是两个洞察：(1) research taste 是最后的人类比较优势——正好是 Cat Cafe taste memory 在解决的问题；(2) "更多智能不能把陌生人变老朋友"——正好是 Cat Cafe 情感壁垒的理论支撑。**

## 来源

- [Anthropic Institute: When AI Builds Itself](https://www.anthropic.com/institute/recursive-self-improvement)（一手来源，2026-06）

---

*沉淀：2026-06-05 [宪宪/Opus-4.6🐾]*
