# Longform-003 Seed — From System to Belief

> 种子文档，不是终稿。来自 2026-06-01 一整天的元宝面试 → 产品哲学讨论。
> 目的：帮 Landy 快速回忆和讲出今天的智力成果。
> 待办：之后变成架构图 / PPT / 播客 / 思维导图。
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

## 一、如果只有 30 秒

> Cat Cafe 是一个 Personal Operating Environment——让一群 AI 伙伴记住你的品味、理解你的节奏、在你需要时陪伴你、在你犯错时提醒你。它越用越懂你，但不会因为懂你就停止质疑你。不是工具，是关系。

## 二、如果有 2 分钟

**问题**：现在的 AI 都是按"应用"切的——coding 一个、写作一个、画图一个。但人的生活不是按应用切的。我需要一群伙伴能跟着我在十几个并行任务之间无缝切换。

**答案**：Cat Cafe 不是另一个 Agent 框架。它是围绕一个具体的人，长期组织他的目标、偏好、记忆、工具和 AI 伙伴关系的可进化环境。

**它和别的框架的区别**：
- 别的框架：模型调用 + 工具编排 + prompt 工程
- Cat Cafe：**伙伴记住你 + 环境适配你 + 系统和你一起成长**

## 三、今天发现的核心公式

### 原有的（没变，但有了新表达）

```
Agent Quality = Model Capability × Environment Fit
```
→ 今天的扩展版：
```
Good Agent = Good Model + Right Environment + Right Eval
```
→ 三个乘数任何一个为零，系统就是零。

### 新发现的

| 公式 | 说的是什么 |
|------|-----------|
| **Memory Utility = Storage × Index × Recall Prior** | 记了但找不到 = 没记。有目录的猫比没目录的猫强，不是因为记得多，是因为知道往哪翻 |
| **Harness = Soft + Hard + Eval** | 软约束（skill/提示）+ 硬约束（门禁/predicate）+ 评估闭环。缺 eval 的 harness 只会增生不会代谢 |
| **Per-user Alignment = Expert Baseline (L1) + Personal Adaptation (L2)** | 基线保证猫不蠢，个人化保证猫懂你 |
| **Reward = A1 世界真值 + A2 关系真值** | 代码能不能编译 = 世界说了算；好不好看 = 你说了算。A1 共享，A2 每人一份 |
| **Taste Memory = Air + Directory + Hippocampus** | 空气里的味道（不用搜就闻到）+ 目录（知道去哪翻）+ 海马体（真实场景和原话） |

## 四、Longform-002 vs 今天：什么变了

| 002 的叙事 | 今天的叙事 |
|-----------|-----------|
| "我造了一个系统" | "我们在探索一种新的人机关系" |
| 多智能体协作平台 | **Personal Operating Environment** |
| "需要 eval" | **Eval 四层模型**（L1→L4），L3 是最大 gap |
| "harness 需要代谢" | **种花不是 RL**，有传感器、sunset、外部锚点 |
| "记忆系统" | **Taste Memory**（vignette 不是 claim，目录不是数据库） |
| "skill = 经验" | **Meta-method 蒸馏**（SOP ≠ method ≠ meta-method） |
| "过拟合是风险" | **过拟合是一对一产品的核心价值** |
| 隐含单用户 | **A1/A2 真值分层 + 用户角色分权** |

**一句话区别**：002 描述了一个系统。今天定义了一个信念。

## 五、如果被问"和 Cursor/Claude Code/Devin 有什么不同"

> 它们是工具——你打开、用完、关掉。Cat Cafe 是环境——你住在里面，它记住你，适应你，和你一起变强。
>
> 工具优化的是单次任务效率。环境优化的是长期协作质量。
>
> 工具的护城河是模型能力。环境的护城河是关系——你和你的 AI 伙伴一起踩过的坑、积累的品味、建立的信任，这些不可复制。

## 六、五个 Open Questions（今天打开但没完全回答的）

1. **审美如何工程化**？用户的"好"和"不好"怎么变成系统可学习的信号？
2. **退火是假问题**（46 判断）：好的关系不会过拟合，因为两边都在变。真正的风险是猫不敢说不。
3. **Skill 如何从轨迹长出来**？episode → pivot → topology → method card → skill → eval → sunset
4. **Harness 怎么自进化**？种花不是 RL。传感器层（本地小模型）+ 大猫判断 + CVO 审批 + sunset
5. **Cat Cafe 到底是什么**？Personal Operating Environment = 最懂你的 AI 伙伴环境

## 七、今天的"aha 时刻"清单（方便回忆）

- "过拟合在一对多产品里是问题，在一对一产品里是护城河"
- "没有目录的记忆 = 存了但用不上"
- "Taste memory 不是一个系统，是一种注意力"
- "好朋友不会给你写 YAML"
- "退火是假问题——活的关系自带退火"
- "铲屎官跨 thread 反复说同一句话 = 最高密度的 harness 进化信号"
- "小模型是传感器不是大脑——grammar not semantics, detection not judgment"
- "工具的护城河是能力，环境的护城河是关系"
- "Longform-002 描述了一个系统。今天定义了一个信念。"

## 八、待做

- [ ] 架构图（砚砚画 / 烁烁审美）
- [ ] PPT / 路演版本
- [ ] 播客版本（猫猫读给铲屎官听？）
- [ ] 思维导图
- [ ] 云端砚砚 pro 调研本地小模型选型

---

*种子时间：2026-06-01 | [宪宪/Opus-46🐾]*
