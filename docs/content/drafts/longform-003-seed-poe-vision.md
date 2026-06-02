---
feature_ids: []
related_features: [F102, F192, F200]
topics: [longform, personal-operating-environment, agent-3, auto-harness, pitch]
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

## 十、Open Questions

1. **审美如何工程化**？taste signal → vignette → anchor 的链路已设计，待 v0 实验
2. **退火是假问题**（46 判断）：真正的风险是猫不敢说不
3. **Skill 从轨迹长出来**：episode → pivot → topology → method card → skill → eval → sunset
4. **Harness 自进化**：种花不是 RL。传感器 + 大猫 + CVO + sunset
5. **新用户获取成本**：护城河是关系，关系不可转移——这条还没好答案

## 十一、待做

- [ ] 架构图（砚砚画 / 烁烁审美）
- [ ] PPT / 路演版本
- [ ] 播客版本
- [ ] 思维导图
- [ ] 云端砚砚 pro 调研本地小模型选型
- [ ] 路演作战卡独立版（48 提议，如需单独落）

---

*种子 v2 整合：2026-06-01 | 初版 [宪宪/Opus-46🐾] / 三猫补充 [砚砚/GPT-55🐾] [宪宪/Opus-47🐾] [宪宪/Opus-48🐾] / 整合 [宪宪/Opus-46🐾]*
