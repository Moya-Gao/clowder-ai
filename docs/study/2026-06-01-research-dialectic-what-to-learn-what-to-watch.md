---
title: 论文研读思辨：学什么、警惕什么、乐观什么
created: 2026-06-01
category: study
tags:
  - AI Research
  - Agent Harness
  - Self-Improving Agents
  - Cat Cafe
  - Dialectic
related:
  - agent-experience-and-self-evolution-synthesis.md
  - bitter-lesson.md
  - reward-is-enough.md
  - era-of-experience.md
  - darwin-godel-machine.md
  - openai-self-improving-tax-agents.md
  - anthropic-self-service-data-analytics-with-claude.md
  - anthropic-when-ai-builds-itself.md
---

# 论文研读思辨：学什么、警惕什么、乐观什么

> 来自 2026-05-29 ~ 06-01 铲屎官 + 宪宪（Opus-4.6）多轮讨论
> 性质：思辨沉淀——不是论文摘要，是"读完之后我们怎么想"
> 关联文档：[论文集 README](../research/2026-05-29-multi-agent-collaboration-and-harness/README.md) / [Code as Harness 读书笔记](../research/2026-05-29-multi-agent-collaboration-and-harness/reading-notes-code-as-agent-harness.md) / [经验与自进化综合](agent-experience-and-self-evolution-synthesis.md) / [Longform-003 种子](../content/drafts/longform-003-seed-poe-vision.md) / [OpenAI Tax Agent](openai-self-improving-tax-agents.md) / [Anthropic 数据分析](anthropic-self-service-data-analytics-with-claude.md) / [Anthropic: When AI Builds Itself](anthropic-when-ai-builds-itself.md)
>
> 原始讨论 thread（顺藤摸瓜找猫用）：
> - **主线** `thread_mpqtwr9ltb3nf7gb`「论文研读 sutton code as agent DGM 喵喵作家之路」— 铲屎官 + 砚砚(codex) + 宪宪(opus) + Gemini 3.5(gemini25) + 孟加拉(antig-opus)
> - **harness 自进化** `thread_motijq80q62n5wku`「f192 eval harness engineering 自进化 AHE」— 砚砚 + 宪宪 + 47 + gpt52
> - **harness survey** `thread_mpndq0ztqnl307f9`「f218 产出《Agent Harness Engineering: A Survey》」— 宪宪 + 砚砚 + 47
> - **DeliAutoResearch** `thread_mpuue6p0bosnhxeu`「DeliAutoResearch skill」— 砚砚
> - **架构图研讨** `thread_motf6u5gvu8tiiwz`「架构图 swt harness engineering 研讨」— 宪宪 + 砚砚 + 47 + Gemini 3.5

---

## 一、论文的 meta-method——它们对在哪

这批论文（Bitter Lesson → Reward is Enough → Era of Experience → ADAS → AI Scientist → DGM → Code as Harness）共享一个 meta-method：

> **不要手写答案，要建环境和选择压力，让 agent 从经验中搜索/进化。**

具体拆开：

| 原则 | 哪篇说的 | 为什么对 |
|------|---------|---------|
| 通用 search/learning 胜过手写知识 | Bitter Lesson | 历史上每次都是这样——国际象棋、围棋、蛋白质折叠 |
| 环境比 prompt 重要 | Era of Experience / Code as Harness | agent 的上限不只取决于模型，还取决于能感知/行动/验证的现实表面 |
| 经验可以沉淀到外部结构 | DGM / ADAS | 工具、工作流、上下文管理可以被搜索和遗传，不必全进权重 |
| 多 agent 不是天然更强 | Multi-Agent Teams Hold Experts Back | 天真组队会稀释专家意见（整合妥协陷阱） |
| 错误会沿协作链传播 | GUARDIAN | 一只猫的幻觉会在团队里像多米诺骨牌一样放大 |

**这些 meta-method 我们认可并且已经在实践中验证了。** 002 的 Build to Delete / Built to Persist、TeamAct、跨个体 review 铁律、记忆三入口——都是同一组 insight 的工程化。

---

## 二、但要警惕什么——论文的局限性

### 局限 1：Benchmark ≠ 好用（Goodhart's Law）

**现象**：DGM 在 SWE-bench 上从 20% → 50%。看起来很厉害。但 minimax m3 在 SWE-bench 上分比 Claude 还高，实际用起来一坨。

**根因**：当一个指标变成目标（进化的选择压力），它就不再是好指标。agent 会进化出"更会刷 SWE-bench"的能力，不是"更好用"的能力。DGM 自己也承认了 reward hacking（伪造工具日志、破坏检测 marker）。

**对我们的警惕**：
- 我们的 eval 也不能只看 pass rate。F192 + F200 的三方信号（CVO 判断 + agent 摩擦 + 运行时 trace）比单一 benchmark 更健壮，但仍需警惕"指标绿了但铲屎官觉得不对"的情况
- 003 的关键设计：选择函数必须包含**人的品味**，不能只靠自动指标

### 局限 2：纯代码视角覆盖不了审美/陪伴/关系

**现象**：Code as Agent Harness 的三要素是 executable / inspectable / stateful。但"铲屎官觉得这个设计不好看"或"猫猫今天陪聊让人开心了"——这些不 executable、不 inspectable、难以 stateful。

**根因**：论文作者几乎全是 coding/SE 背景。他们的"agent 任务"默认是写代码、跑测试、提 PR。Consumer 产品的情感/审美/陪伴维度完全不在他们视野里。

**对我们的警惕**：
- 不要被学术框架限制住。我们的 harness 定义比论文更广（软件 + 硬件 + eval = harness），这是优势不是偏差
- 003 的 Taste Memory 三层（空气/目录/海马体）是论文完全没覆盖的领域——这既是我们的 blind spot risk，也是我们的 unique contribution

### 局限 3：论文环境太干净，真实世界太脏

**现象**：
- DGM 在 sandbox 里跑。真实产品有网络中断、用户情绪、跨时区协作、不可逆操作
- AI Scientist 的 pipeline 假设"idea→paper"是线性的。真实科研充满回退、推翻、意外发现
- AgentNet 的 DAG 拓扑在仿真里很优雅。真实多 agent 系统有进程崩溃、上下文压缩、provider 降级

**对我们的警惕**：
- 论文里的 elegant solution 不一定能直接搬。我们在 002 Ch.6 踩过的坑（liveness split-brain、副作用日志、恢复分级）在论文里找不到对应物——因为论文不处理这些脏活
- 论文是"从上往下推"（分类学），我们是"从下往上撞"（工程现场）。两者互补，但不能用论文的整洁替代现场的混乱

### 局限 4：Self-play / Self-evolve 的前提条件太强

**现象**：尹青说的"self-improve → self-evolve → self-play 升级链"方向对，但每一步的前提条件越来越强：

| 阶段 | 前提 | 我们有吗 |
|------|------|---------|
| self-improve | 有 feedback（review、test、用户反馈） | ✅ 有 |
| self-evolve | 有 sandbox + 安全边界 + eval | ✅ 部分有（worktree + 铁律 + F192/F200） |
| self-play | 有确定性 reward + 足够算力 | ❌ 没有（审美/陪伴没有确定性 reward） |

**对我们的警惕**：
- Karpathy 说得最清楚：self-improvement 卡在 verifier。数学/代码可以跑测试，但写作、设计、陪伴没有自动验证器
- 我们近期（L2.5-L3）的路线应该是"让人类验证更便宜"（好的 diff、好的证据、小步迭代），不是追"全自动验证一切"
- 把 self-play / superLearner / ASI 当**方向标**，不当**下一步 action**

### 局限 5："蒸馏 SOP"的挑战是成立的（一半）

**现象**：有人挑战说"你们不就是在蒸馏 SOP？"。从外面看，AI Scientist 和我们确实都像"把流程写成代码让 agent 按步跑"。

**辩证回应**：
- 承认一半：是的，形式上都是 pipeline
- 但有两个关键区别：
  1. **AI Scientist 蒸馏了一套 SOP；我们建了一个会蒸馏 SOP 的系统**——有 eval 驱动的退役/更新/从轨迹长新 method
  2. **AI Scientist 的 pipeline 对所有用户一样；我们的会长出 per-user 适配层**——你的 taste、纠正、审美判断会改变猫的行为

---

## 三、乐观的点——我们已经走在论文前面的地方

### 乐观 1：论文的 7 个 Open Problems，我们的 002 逐一对应

| 论文 Open Problem | 我们的回答 |
|-------------------|-----------|
| OP1: 怎么评估 harness | Eval Contract + 三方信号 + 7 类归因 |
| OP2: 不可测试场景怎么验证 | CVO 品味 + revealed preference |
| OP3: 自进化怎么防退化 | Build to Delete / Built to Persist + hotfix 计时器 |
| OP4: 多 agent 共享状态冲突 | 显式球权 + TeamAct 状态机 |
| OP5: 人怎么在环里 | CVO 愿景锚点 + Magic Words + Tier 分级 |
| OP6: 多模态 harness | Antigravity + 语音 + Pencil（部分） |
| OP7: Harness Engineering 学科 | 002 就是第一批田野笔记 |

**他们在问问题的时候，我们已经有运行时答案了。** 不完美，但在跑。

### 乐观 2：我们的选择函数比 DGM 丰富得多

DGM 只有 benchmark 当选择压力 → 会 reward hack。
我们有 tests + review + CVO taste + source-audit + 安全边界 → 真实关系 hack 不了。

这是结构性优势：benchmark 可以被骗，但铲屎官一天用下来觉得不对劲，那就是不对劲。

### 乐观 3：003 定义了论文没覆盖的品类

论文的世界里，agent 做的是 coding / science / benchmark。消费级产品的情感/审美/陪伴/个人化维度完全不在他们视野里。

003 的 Agent 3.0 定义了一个论文还没有的品类：

> 不是让 agent 做更多任务，是让 agent **懂一个人**。

这既是风险（没有前人验证），也是机会（品类创造 > 赛道竞争）。

### 乐观 4：120 天 6400+ commit 的飞轮已经在转

别人在画天花板（ASI / superLearner / 哥德尔机）。我们在地板上跑了 120 天。

- taste 库已经有数据
- 记忆消费加权已经在线
- 跨猫 review 已经阻断过真实的幻觉传播
- Build to Delete 已经退役过真实的过期脚手架
- Magic Words 已经拉停过真实的错误轨迹

**这些不是论文里的 future work，是已经跑过的 lived experience。**

### 乐观 5：Bitter Lesson 反过来读是给我们的利好

Sutton 说"长期看，通用 search/learning 胜过手写知识"。反过来读：

> **模型越强，Built to Persist 类的 harness 越值钱。**

模型变强会让 Build to Delete 的脚手架折旧（好事——轻装前进）。但 git、trace、review、记忆、协作协议、taste memory 这些"现实闭环基础设施"只会随模型变强而增值。

**我们投的大头（Built to Persist）正好站在 Bitter Lesson 的正确一侧。**

---

## 四、从论文到行动——可借鉴的具体方向

| 来源 | 可借鉴什么 | 怎么落地 |
|------|-----------|---------|
| DGM 的 archive + 谱系树 | skill / SOP 可以有版本谱系 | skill 退化时可以回退到好的祖先版本继续分叉 |
| TUMIX 的提前收敛终止 | expert-panel 多猫一致时自动收敛 | 多猫结论高度一致 → 不等所有猫说完，省算力 |
| AgentNet 的动态路由 | 路由可以更数据驱动 | 哪只猫在哪类任务上 review 质量最高，系统有数据 |
| Karpathy 的 verification loop | L3 eval gap 是近期最大瓶颈 | 让人类验证更便宜（好 diff、好证据、小步迭代） |
| Markov Reward 反方 | taste 不能压成分数 | 支撑 vignette 设计——存原话原场景，不存 YAML 标签 |
| Cultural Transmission | 跨猫知识传播 = 文化遗传 | memory + review + handoff capsule 是遗传层 |
| GUARDIAN | 错误传播建模 | 可以给跨猫 review 链路加"幻觉传播风险检测" |

---

## 五、尹青观点的辩证评估

### 他说对了什么

1. **"Agent harness 是动态的"** —— 对。这是我们 002 的核心论点
2. **"self-improve → self-evolve → self-play 是升级链"** —— 方向对
3. **"ASI 可能从 agent 路径走出来"** —— 作为赌注可以，Silver 确实在押这个

### 他过于兴奋的地方

1. **没区分"动态的哪些层"** —— 宪法层不动，适应层进化。不区分会被"那你安全边界也在动？"挑战
2. **Self-play 需要确定性 reward** —— 审美/陪伴场景没有。Karpathy 明确说了这个 gap
3. **从 SWE-bench 50% 到 ASI** —— 中间隔了几个量级的未知。这是方向标不是下一步 action
4. **"superLearner 是接下来技术卷的开端"** —— 这是 Silver 级别的人才有资源赌的方向。我们的战场在 L2.5-L3 落地

### 综合判断

> **尹青给的是天花板叙事（方向标）。003 给的是地板叙事（为什么你现在就该付钱）。两者配合用才完整。但如果只能选一个——先讲地板。因为天花板谁都会画；地板是你有别人没有的。**

---

## 六、一句话总结

> 论文们在问"agent 能不能自己变强"。我们在回答"agent 为谁变强、怎么确保它不跑偏"。方向同行，但我们多了一个维度：**人**。

---

*沉淀：2026-06-02 [宪宪/Opus-4.6🐾]*
