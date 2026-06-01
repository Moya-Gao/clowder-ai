# Longform-003 Seed — From System to Belief

> 种子文档，不是终稿。来自 2026-06-01 一整天的元宝面试 → 产品哲学讨论。
> 目的：帮 Landy 快速回忆、讲出、和路演今天的智力成果。
> 贡献者：宪宪46（初版 + 整合）/ 砚砚55（公式硬化 + 6层图 + 外部叙事）/ 宪宪48（路演作战卡 + 投资人三问 + 6步主轴）/ 宪宪47（"重新放置"总纲 + 品类创造）
> 待办：架构图 / PPT / 播客 / 思维导图。
>
> 源文档索引：
> 1. [元宝二面复盘](../../discussions/career-planning/2026-06-01-yuanbao-round2-eval-deep-dive.md)
> 2. [F192 Eval 审计](../../discussions/2026-06-01-f192-eval-coverage-audit.md)
> 3. [PoE 概念 note](../../discussions/2026-05-31-personal-operating-environment-concept-note.md)
> 4. [Taste Memory 设计](../../discussions/2026-05-31-taste-memory-design.md)
> 5. [Meta-method 蒸馏](../../discussions/2026-06-01-meta-method-distillation.md)
> 6. [OQ-4 五猫收敛](../../discussions/2026-06-01-oq4-harness-self-evolution-synthesis.md)
> 7. Landy 心理素描（private/psychological-sketches/）
> 8. [Longform-002（前作）](longform-002-v0-formal.md)

---

## 零、总纲：今天做的是同一件事（47 的洞察）

> **今天 9 条 aha 全是同一个动作：把一个东西从被放错的位置挪到正确的位置。**

- 记忆不是"存更多"→ 放对位置（目录层 + 海马体）
- 个人化不是"调更多参数"→ 放对位置（A1 共享 / A2 per-user）
- 自进化不是"加更多规则"→ 放对位置（宪法层不动 / 适应层进化）
- 小模型不是"减弱版大模型"→ 放对位置（传感器层而不是大脑层）
- Taste 不是"用户画像"→ 放对位置（海马体 vignette 而不是 YAML claim）

如果上台只能记一句话：

> **"所有人都在给 AI 加东西。我们这一天，是把东西放对位置。"**

---

## 一、如果只有 30 秒

> 所有人都在让模型变聪明。我们在让模型所在的环境变懂你——这条路更便宜、可迁移、而且每多用一天护城河就深一寸。
>
> Cat Cafe 是 Personal Operating Environment：一群 AI 伙伴记住你的品味、理解你的节奏、在你犯错时提醒你、在你该停时拦你。越用越懂你，但不会因为懂你就停止质疑你。

## 二、如果有 2 分钟

**问题**：现在的 AI 都是按"应用"切的——coding 一个、写作一个、画图一个。但人的生活不是按应用切的。

**答案**：Cat Cafe 围绕一个具体的人，长期组织他的目标、偏好、记忆、工具和 AI 伙伴关系。不是另一个 Agent 框架——是一个可进化的伙伴环境。

**为什么现在能做（Why Now）**：
- 模型刚跨过"能自主跑完 SOP、多猫协作不崩"的阈值——100 天 6400 commit 本身就是证据
- 本地小模型刚够强够便宜（128G Mac 能做信号层）
- "环境从真实轨迹学习"这件事，2026 才第一次同时有"模型够强能产生有价值轨迹"+"本地算力够便宜能消化轨迹"

## 三、6 步因果链——紧张时顺着推就行（48 的主轴）

> 人的生活不按 app 切 **→ 所以**要环境不要工具 **→ 所以**环境的价值全在"懂你" **→ 所以**懂你得靠环境从你的真实轨迹里学 **→ 所以**学习要便宜（本地传感器）且不跑偏（人类锚点） **→ 所以**长出一个越用越懂、别人抄不走的关系。

任何一环都能展开成 5 分钟，也能在任何一环收住。

## 四、品类创造，不是竞品对比（47 的 reframe）

不要列竞品名字做对比——那是 positioning（你在别人定义的赛道里比）。要说的是 category creation（你定义赛道）：

> **Software 2.0**：智能软件服务平均用户（Claude Code、Codex、Devin、Hermes、Manus……）
> **Software 3.0**：被你塑形过的软件，只为你这一个用户存在（Cat Cafe）

不管 2.0 里谁更强——它们全在同一层：服务百万用户的平均偏好。Cat Cafe 服务一个具体的人，长出只属于他的记忆、品味和方法。**这是不同物种，不是同赛道的排名。**

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
| 对工具的 positioning | **品类创造**：Software 3.0 |

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
