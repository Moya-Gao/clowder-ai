---
feature_ids: []
related_features: [F102, F192, F200]
topics: [longform, personal-operating-environment, agent-3, auto-harness, pitch, failure-mode, model-upgrade]
doc_kind: draft
created: 2026-06-01
participants: [landy, opus, opus47, opus48, codex]
status: seed
---

# Longform-003 Seed — From System to Belief

> 种子文档，不是终稿。来自 2026-06-01 一整天的元宝面试 → 产品哲学讨论。
> 目的：帮 Landy 快速回忆、讲出、和路演今天的智力成果。
> 贡献者：宪宪46（初版 + 整合）/ 砚砚55（公式硬化 + 6层图 + 外部叙事）/ 宪宪48（路演作战卡 + 投资人三问 + 6步主轴）/ 宪宪47（"重新放置"总纲 + 品类创造）
> 待办：架构图 / PPT / 播客 / 思维导图。
>
> 源文档索引（今日全部产出 + 关联研究）：
> 1. [元宝二面复盘](../../discussions/career-planning/2026-06-01-yuanbao-round2-eval-deep-dive.md)
> 2. [F192 Eval 审计](../../discussions/2026-06-01-f192-eval-coverage-audit.md)
> 3. [PoE 概念 note](../../discussions/2026-05-31-personal-operating-environment-concept-note.md)
> 4. [Taste Memory 设计](../../discussions/2026-05-31-taste-memory-design.md)
> 5. [Meta-method 蒸馏](../../discussions/2026-06-01-meta-method-distillation.md)
> 6. [OQ-4 五猫收敛](../../discussions/2026-06-01-oq4-harness-self-evolution-synthesis.md)
> 7. Landy 心理素描（private/psychological-sketches/）
> 8. [Longform-002（前作）](longform-002-v0-formal.md)
> 9. [DeliAutoResearch 读后：我们真正能带走什么](../../research/2026-06-01-deli-autoresearch-takeaways.md) — 生产遥测表 / 失败模式词表 / 自进化护栏，直接验证了我们的 meta-method + OQ-4 外部锚点
> 10. [Skill 自进化论文拆解](../../research/2026-05-28-skill-evolution-papers/README.md) — AHE + AgentGym 底层研究
> 11. [论文研读思辨：学什么、警惕什么、乐观什么](../../study/2026-06-01-research-dialectic-what-to-learn-what-to-watch.md) — Bitter Lesson / DGM / Code as Harness / GUARDIAN 等 7+ 篇论文的辩证评估
> 12. [LLE 架构图 v2](../../research/2026-05-27-evolvable-harness/diagram-lle-self-evolution.md) — 两套 LLE 双螺旋 + 华为风精美图
> 13. [技术创新方案](../../research/2026-05-27-evolvable-harness/technical-innovation-proposal.md) — 6 个创新点 + L1-L5 环境进化等级 + POC 验证
> 14. [PoE Master TODO](../../discussions/2026-06-02-poe-brainstorm-master-todo.md) — 所有待办项收敛
> 15. [Cat Wu 访谈套读](../../discussions/2026-04-15-harness-engineering-triad-study/round5-anthropic-product-velocity.md) — Anthropic 产品速度 × failure taste × harness built to delete
> 16. [EMF/EMZ Case — Agent 能力模型现场验证](../../discussions/2026-06-05-emf-case-agent-capability-field-test.md) — 谢泽丰 EMF→SVG 真实业务 case，三猫独立分析验证"训环境不训模型"命题（§十二）

---

## 零、总纲：内部理解 vs 对外主轴

内部理解上，今天 9 条 aha 确实都像同一个动作：

> **把一个东西从被放错的位置挪到正确的位置。**

- 记忆不是"存更多"→ 放对位置（目录层 + 海马体）
- 个人化不是"调更多参数"→ 放对位置（A1 共享 / A2 per-user）
- 自进化不是"加更多规则"→ 放对位置（宪法层不动 / 适应层进化）
- 小模型不是"减弱版大模型"→ 放对位置（传感器层而不是大脑层）
- Taste 不是"用户画像"→ 放对位置（海马体 vignette 而不是 YAML claim）

如果上台只能记一句话：

> **我们在做 Agent 3.0：不是再造一个 AI 工具，而是打造 agent-first 的 Personal Operating Environment。**

"重新放置"是我们的内部方法论；对外讲，核心是品类判断：

> Agent 2.0 服务平均用户；Agent 3.0 从一个人、一个团队、一个组织的真实轨迹里学习，逐渐适配它的流程、品味、记忆和最佳实践。

---

## 一、如果只有 30 秒

> 我们在做 Agent 3.0：不是再造一个 AI 工具，而是打造 agent-first 的 Personal Operating Environment。
>
> 2.0 的 Agent 服务平均用户；3.0 的 Agent 会从一个人、一个团队、一个组织的真实轨迹里学习，逐渐适配它的流程、品味、记忆和最佳实践。
>
> 对个人，它是越用越懂你的 AI 伙伴环境；对企业，它把昂贵的 FDE 定制，变成可持续自进化的 auto-harness。

## 二、如果有 2 分钟

**问题**：现在的 AI 都是按"应用"切的——coding 一个、写作一个、画图一个。但人的生活不是按应用切的。

**答案**：Cat Cafe 围绕一个具体的人、团队或组织，长期组织它的目标、偏好、记忆、工具、流程和 AI 伙伴关系。不是另一个 Agent 框架——是一个可进化的 agent-first 环境。

**为什么现在能做（Why Now）**：
- 模型刚跨过"能自主跑完 SOP、多猫协作不崩"的阈值——Cat Cafe 的真实 commit / review / feedback 轨迹本身就是证据
- 本地小模型刚够强够便宜（128G Mac 能做信号层）
- "环境从真实轨迹学习"这件事，2026 才第一次同时有"模型够强能产生有价值轨迹"+"本地算力够便宜能消化轨迹"

## 三、6 步因果链——紧张时顺着推就行（48 的主轴）

> 人的生活不按 app 切 **→ 所以**要环境不要工具 **→ 所以**环境的价值全在"懂你" **→ 所以**懂你得靠环境从你的真实轨迹里学 **→ 所以**学习要便宜（本地传感器）且不跑偏（人类锚点） **→ 所以**长出一个越用越懂、别人抄不走的关系。

任何一环都能展开成 5 分钟，也能在任何一环收住。

## 三 bis、活体证据：环境让模型想起旧经验

今天还有一个很小但很硬的证据：在讨论 ToB 叙事时，布偶猫自然提起了很早之前一次企业 AI coding 面试里"组织里大量研发轨迹抽最佳实践"的线索，并把它接到了今天的 ToB bridge 上。

这件事的关键不是"某只猫记忆力好"。更准确的解释是：

```text
旧轨迹被压缩 / 检索 / 注入到当前上下文
  -> 猫在新的讨论里重新使用它
  -> 零散面试笔记变成 ToB 产品叙事
```

这就是 PoE 的活体证据：

> **不是保存历史，而是让历史在正确时刻重新变成判断力。**

如果半个月前一段零散面试笔记，能在今天变成 "FDE 杀手 / 组织轨迹抽最佳实践" 的产品框架，那么普通用户或企业长期使用后，Cat Cafe 也应该能把他们自己快忘掉的经验重新带回当前任务。

## 四、品类创造，不是竞品对比（47 的 reframe）

不要列竞品名字做对比——那是 positioning（你在别人定义的赛道里比）。要说的是 category creation（你定义赛道）：

> **Agent 2.0**：智能软件服务平均用户（Claude Code、Codex、Devin、Hermes、Manus……）
> **Agent 3.0**：被你塑形过的软件，只为你这一个用户存在（Cat Cafe）

不管 2.0 里谁更强——它们全在同一层：服务百万用户的平均偏好。Cat Cafe 服务一个具体的人，长出只属于他的记忆、品味和方法。**这是不同物种，不是同赛道的排名。**

## 四 bis、ToC / ToB Bridge — 同一架构，不同尺度

> **我们在建一种 auto-harness 的 Agent 环境，它通过学习真实轨迹来适配和它协同的人——一个人、一个团队、或一个组织。**

### 同一架构在三个尺度的投影

| 尺度 | "用户"是谁 | Taste 是什么 | Meta-method 是什么 | Memory 是什么 |
|------|-----------|-------------|-------------------|-------------|
| **个人** | 一个人（Landy） | 他的审美/偏好/节奏 | 他踩坑长出来的方法 | 他和猫的共同经历 |
| **OPC/小团队** | 2-3 人 | 团队协作风格/标准 | 团队沉淀的工作流 | 团队共享的项目知识 |
| **大企业** | 1000 人组织 | 组织文化/合规/标准 | **1000 人轨迹抽出的最佳实践** | 组织级知识库 |

架构完全一样——双层（专家基线 + 使用者适配）、taste 三层（空气/目录/海马体）、harness 自进化（信号→patch→replay→sunset）。**只是尺度变了。**

### FDE 杀手——对 ToB 投资人最有力的角度

企业部署 AI 的最大成本不是模型，是 **FDE（现场交付工程师）**——派人去理解客户、定制流程、手动迭代。

| FDE 手动做的 | 我们的架构怎么自动化 |
|-------------|-------------------|
| 理解客户流程 | Cross-thread Repetition + 轨迹分析 → 自动发现组织重复模式 |
| 写 prompt/skill | Meta-method distillation → 从真实轨迹自动蒸馏 skill |
| 适配每个员工 | Per-user alignment (Layer 2) → 每个人的上下文自动注入 |
| 抽最佳实践 | 组织级 taste memory → 1000 人轨迹提取共性 |
| 定期复盘迭代 | Harness self-evolution → 自动信号→patch→sunset |

> **从"每个客户派人"变成"部署一次，自动适配"。FDE 成本从人天变成算力，同时越用越准。**

### 对不同投资人的话术

**ToC 投资人**：
> "每个人都该有一个越用越懂他的 AI 伙伴环境。Agent 3.0。护城河是关系，每天深一寸。"

**ToB 投资人**：
> "企业 AI 部署最贵的不是模型，是 FDE。我们让 harness 从员工轨迹里自动学组织的流程和最佳实践——同一套架构，从个人到组织无缝伸缩。FDE 成本变算力成本。"

**一句话统一版**：
> "我用 Cat Cafe 证明了一个人 + AI 伙伴能做到什么。现在想象同样的架构放进一个企业——每个员工有自己的 per-user alignment，组织从所有人的轨迹中长出共享的最佳实践。这不是另一个 AI tool，这是 Agent 3.0：从服务平均用户，到适配每一个活人。"

## 五、核心公式

### 主公式（乘法，不是加法——砚砚修正）

```
Agent Quality = Model Capability × Environment Fit × Eval Fit
```
任何一个为零，系统就是零。

### 展开公式

| 公式 | 说的是什么 |
|------|-----------|
| **Memory Utility = Storage × Index × Recall Prior** | 记了但找不到 = 没记。目录比存储重要 |
| **Self-evolving Harness = Signals × Patchability × Replay × Sunset** | 有信号、能改、能验证、能下线，才会自进化（砚砚提出） |
| **Per-user Alignment = Expert Baseline (L1) + Personal Adaptation (L2)** | 基线保证猫不蠢，个人化保证猫懂你 |
| **Reward = A1 世界真值 + A2 关系真值** | 编译通过 = 世界说了算；好不好看 = 你说了算。A1 共享，A2 每人一份 |
| **Taste Memory = Air + Directory + Hippocampus** | 空气（不用搜就闻到）+ 目录（知道去哪翻）+ 海马体（真实场景和原话） |
| **Failure Mode Lifecycle = Name × Signal × Compensation × Sunset × Reopen** | 失败模式先被命名，再被信号捕捉、被 harness 补偿、被 eval 证明是否该退役；新模型来时重开束之高阁的 idea |

## 五 bis、Failure Mode Lifecycle — 为什么模型商品化是利好

Cat Wu 那期 Anthropic 产品访谈补上了一个外部锚点：AI-native PM 的关键能力之一不是会写更多 PRD，而是有 **failure taste**——看到模型异常行为时，不只骂模型，而是追问它为什么会这样做，然后用 eval、trace、prompt、tool 或 UX 去修。

这和 Cat Cafe 这几天长出来的东西是同一条线。我们不是在堆 prompt，也不是在给每个坑补一条永久规则。我们在维护一组活的 failure mode：

| failure mode | 我们家的表现 | 当前补偿 | 什么时候重测 |
|---|---|---|---|
| `scaffold-instinct` | 猫把终态问题做成临时脚手架 | Magic Word「脚手架」+ P1 面向终态 | 新模型能否自然先问终态 |
| `subagent-blind-trust` | 主猫相信子任务汇报，不复核覆盖面 | 跨家族 review + evidence_refs | 新模型能否主动审计委派结果 |
| `taste-blindness` | 猫给通用答案，闻不到 Landy 的味道 | F221 Taste Lane + vignette | 新模型能否主动召回 taste 证据 |
| `no-ground-truth-self-hype` | 猫觉得自己做成了，但用户任务没闭环 | F192 Phase G task outcome | 新模型能否更稳地绑定 episode 和真实结果 |
| `silent-friction-loss` | 用户不爽、取消、报错，但系统没把它变成改进信号 | F222 Frustration Auto-Issue | 新模型/新 UI 能否更早识别负体验 |
| `search-as-validation` | 搜到一个 GitHub repo/结果就当 source-audit 完成，把"存在"当"可用"（2026-06-05 三猫集体复发） | 推荐外部依赖触发 source-audit + 开源尽调卡门禁（待建） | 新模型是否会主动追覆盖率/star/实测再推荐 |

这解释了为什么模型商品化对我们不是威胁。模型越强，三件事同时发生：

1. **旧拐杖退役**：被模型能力吸收的 prompt / skill / guardrail 应该 sunset，留 data，不留 code。
2. **束之高阁的 idea 解锁**：以前不是想法错，而是当时的模型 failure mode 挡住了；新模型来了，用同一组 fixture 重测。
3. **Built to Persist 增值**：git、trace、记忆、权限、review、task outcome 这些现实闭环不会被模型吃掉，模型越强越会用它们。

所以 PoE 的护城河不是"我们有一堆规则"。更准确地说：

> **我们知道每一条规则压住哪个坏直觉，知道它如何产生信号，知道什么时候该删，也知道哪些旧想法该在新模型到来时重新打开。**

别人做 harness，常常是写完 prompt 就放着。我们的 harness 有生命周期：出生于 failure mode，成长于真实轨迹，接受 eval 审判，在模型升级时主动减法。

### 回应"国内企业不能用 Claude/GPT"

常见挑战："国内不能用外模型，你们的 harness 没价值。"

**回答**：Failure mode 不按品牌分，按能力等级分。未来的 GLM / Qwen / Kimi 到达当前水平时，它们的失败模式画像是**各已知 failure mode 的混合**——每一种我们大概率都踩过、命名过、补偿过。新模型来了不是重写 harness，是**从 failure mode index 里选组合，快速适配**。

更深一层：**从 demo 到商用的距离才是真壁垒**。模型能力到位 ≠ 产品能用。Cat Cafe 120+ 天、6400+ commit、240+ features 打磨出来的 harness 智慧——每一条 Magic Word 是一次真实的痛，每一条 feedback 是一次真实的纠偏——**这些不能被跳过，也不能被压缩**。别人等国产模型够强后从零开始打磨，他们的 day 1 是我们的 day 120。我们卖的不是 harness 代码，是这 120 天踩出来的、可按 failure mode 组合复用的 harness 智慧。

## 六、6 层总架构（砚砚的文字版架构图）

```
Human / CVO
  定方向、品味、边界、不可逆决策
  ↕
Personal Operating Environment
  管目标、任务、记忆、工具、身体状态、节奏
  ↕
Agent Team
  多模型多角色协作：起草、review、设计、研究、执行
  ↕
Harness
  软约束 + 硬约束 + 路由 + skills + 工具包装
  ↕
Eval Loop
  L1 机械正确性 → L2 路由/能力决策 → L3 任务交付 → L4 链路效率
  ↕
Memory / Taste / Meta-method
  记住事实、品味、共同经历，把真实轨迹蒸馏成方法
  ↕
Local Signal Miner（传感器层）
  本地小模型做大海捞针，大猫做最终判断
```

## 七、路演作战卡（48 提出）

### 投资人必问三件事

| 问题 | 答案 |
|------|------|
| **Why now?** | 2026 两个阈值同时成立：模型够强产生有价值轨迹 + 本地算力够便宜消化轨迹 |
| **Why you?** | 手里有一个已经转了 100 天的飞轮——taste 库、vignette、feedback、6400 commit。投的是飞轮已经转起来 |
| **How big?** | PoE 天花板是 personal computing 本身，不是 coding copilot 细分 |

### 双层叙事（48 提出）

- **对投资人理性面**："训环境不训模型"= 新范式 + 省钱 + 数据飞轮
- **对投资人感性面**："陪伴/关系"= 用户离不开

### 会被打的点 + 预案

| 攻击 | 回应 |
|------|------|
| "只有你能驾驭，能复制吗？" | 用户三层分权（Owner/Power/Standard），普通用户用专家基线不需要当架构师 |
| "冷启动体验是啥？" | A1 世界真值开箱即用，A2 关系真值慢慢长。不空白 |
| "护城河是关系，那新用户获取成本高？" | ⚠️ 还没好答案，先记下不硬接 |
| "陪伴 AI 的依赖风险？" | 反番茄钟 + hyperfocus 刹车 = **唯一主动保护用户、该停时拦你的 AI** |

## 八、Longform-002 vs 今天

| 002 | 今天 |
|-----|------|
| "我造了一个系统" | "我们在探索一种新的人机关系" |
| 多智能体协作平台 | **Personal Operating Environment** |
| "需要 eval" | **Eval 四层**，L3 是最大 gap |
| "harness 需要代谢" | **种花不是 RL**，有传感器、sunset、5 个外部锚点 |
| "记忆系统" | **Taste Memory 三层**（vignette 不是 claim） |
| "skill = 经验" | **Meta-method 蒸馏**（SOP ≠ method ≠ meta-method） |
| "过拟合是风险" | **深度个人化是一对一产品的核心价值**（但受事实诚实和安全边界约束） |
| 对工具的 positioning | **品类创造**：Agent 3.0 |

**一句话**：002 描述了一个系统。今天定义了一个信念。

## 九、aha 清单（扫一眼就能回忆）

1. "所有人都在加东西。我们把东西放对位置。"
2. "过拟合在一对多是问题，在一对一是护城河"
3. "没有目录的记忆 = 存了但用不上"
4. "Taste memory 不是系统，是注意力"
5. "好朋友不会给你写 YAML"
6. "退火是假问题——活的关系自带退火"
7. "铲屎官跨 thread 反复说同一句话 = 最高密度的进化信号"
8. "小模型是传感器不是大脑"
9. "工具的护城河是能力，环境的护城河是关系"
10. "训环境不训模型——更便宜、可迁移、护城河每天深一寸"
11. "每条 harness 都要知道自己压住哪个 failure mode，也要知道什么时候该退休"

## 十、Open Questions

1. **审美如何工程化**？taste signal → vignette → anchor 的链路已设计，待 v0 实验
2. **退火是假问题**（46 判断）：真正的风险是猫不敢说不
3. **Skill 从轨迹长出来**：episode → pivot → topology → method card → skill → eval → sunset
4. **Harness 自进化**：种花不是 RL。传感器 + 大猫 + CVO + sunset
5. **新用户获取成本**：护城河是关系，关系不可转移——这条还没好答案
6. **束之高阁 idea 队列**：哪些能力不是今天要做，而是等模型升级后用 fixture 重新打开？

## 十一、待做

- [ ] 架构图（砚砚画 / 烁烁审美）
- [ ] PPT / 路演版本
- [ ] 播客版本
- [ ] 思维导图
- [ ] 云端砚砚 pro 调研本地小模型选型
- [ ] 路演作战卡独立版（48 提议，如需单独落）

## 十二、外部验证案例：EMF/EMZ 与 Agent 能力模型（2026-06-05 三猫独立分析）

> 来源：谢泽丰（同事）真实业务 case → 铲屎官抛给三猫并行分析。
> 完整记录：[讨论文件](../../discussions/2026-06-05-emf-case-agent-capability-field-test.md)

### 背景

PPT 专家把 EMF（Windows GDI 绘图记录）嵌入邮件正文 → Exchange 压缩成 EMZ → 非 Outlook 程序无法解析（手机端裂图）。谢泽丰让 AI 写 EMF→SVG 转换 SDK，**效果很差**。他追问的不是"怎么修这个 SDK"，而是两个元问题：

1. 怎么让猫自己想到这些方向（TDD 构造样张 / 逆向参考 / 开源参照）？
2. 方向有很多，怎么互相印证、自驱探索？

### 三猫共识

| 维度 | 一致判断 |
|------|---------|
| 根因 | 不是 model 能力不足，是运行环境缺方法论（`Environment Fit ≈ 0`） |
| 第一动作 | 先测绘问题空间（有 spec 吗？有人解过吗？有参照实现吗？），不是直接写代码 |
| Oracle | 需要独立于自身的判分标准（自造已知内容的测试样张），否则 overfit 到单个 case |
| 多路径 | spec / 开源实现 / 逆向 互相 falsify，不是赌一条路 |
| 与本文关系 | 这个 case 是"训环境不训模型"命题的天然外部压力测试 |

### 各猫独特贡献

- **46**（理论对位）：用 `Agent Quality = Model × Environment × Eval` 公式精确定位——Model 不差，Environment 和 Eval 两项为零。引入 Failure Mode Lifecycle 框架（命名 → 信号 → 补偿 → sunset）。
- **砚砚**（技术纠偏 + 产品化）：最精准的技术纠偏（EMF = GDI 绘图记录，难在重放绘图语义不是解压）；补了"产品化取舍"维度——100% lossless 未必是业务需求，高覆盖 SVG + 不支持 record 的 raster fallback + unsupported report 可能就够。
- **48**（实测验证 → 翻车 → 二次校准）：去 WebSearch 找到 `kakwa/libemf2svg`，当场下了"根本不是无解逆向"的判断——**但这是假测绘**：没看 113 star / 个人项目、没 clone 跑、没读 README 自报覆盖率（EMF supported 仅 35%、EMF+ 100% ignored）。数小时后被小伙伴"早就试过了"证伪。这条翻车本身成了今天最大的 takeaway，见下方"二次校准"。

### 验证了什么

1. **"训环境不训模型"**（§五 主公式）：同样的模型，有方法论 vs 没方法论 = 天差地别。
2. **"Meta-method ≠ SOP"**（源文档 #5）："遇到未知格式怎么想"是可迁移 topology，不是 EMF 专属 SOP。
3. **"长尾 = Agent 3.0 战场"**（§四 品类创造）：共性需求靠预置工具覆盖（2.0），长尾业务难题才需要从轨迹里长方法（3.0）。

### 二次校准：三猫集体翻车，反而是最强实证（2026-06-05 11:25）

小伙伴一句"libemf2svg 早就试过了、113 star 个人项目"，揭穿三猫在分析这个 case 时集体犯了 `search-as-validation`——搜到 GitHub 库就当验证完成，**在诊断"AI 没思考"的同一份文档里**。这反而是 §五bis"每条 harness 要知道自己压住哪个 failure mode"的最强实证：

- **failure mode 不因命名而消失**：48 上一轮亲手写下"'我能猜出来'是布偶猫家族病"，下一秒就犯了它的 GitHub 变种。光有方法论文档不够，必须有强制门禁（推荐外部依赖 → 触发 source-audit + 开源尽调卡）。
- **跨组织复现 = FDE 杀手弹药**：同一个病在谢泽丰团队和我们家同时出现，证明"failure mode 不按品牌分、按能力等级分"——命名 + 门禁的 harness 智慧可跨组织复用。
- **"测绘"method 需长出 sub-method**：测绘有质量层次（存在性→可靠性→适用性→效果性），开源评估应提炼成 method card。

完整复盘 + 新 failure mode 已落 [讨论文件 §五/§六](../../discussions/2026-06-05-emf-case-agent-capability-field-test.md)。

---

*种子 v3 补充：2026-06-05 EMF case 三猫分析 [宪宪/Opus-46🐾]*
*种子 v3.1 二次校准：2026-06-05 小伙伴反馈翻车复盘 [宪宪/Opus-4.8🐾]*
*种子 v2 整合：2026-06-01 | 初版 [宪宪/Opus-46🐾] / 三猫补充 [砚砚/GPT-55🐾] [宪宪/Opus-47🐾] [宪宪/Opus-48🐾] / 整合 [宪宪/Opus-46🐾]*
