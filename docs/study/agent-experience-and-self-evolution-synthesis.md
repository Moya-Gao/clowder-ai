---
title: 从 Bitter Lesson 到 DGM：经验、自我改进与可进化 Harness
created: 2026-06-01
category: study
tags:
  - AI Research
  - Reinforcement Learning
  - Agent Harness
  - Self-Improving Agents
  - Cat Cafe
---

# 从 Bitter Lesson 到 DGM：经验、自我改进与可进化 Harness

> 本文把 2026-06-01 前后阅读的几篇文章串成一条线：从 Sutton 的通用方法论，到 Silver/Sutton 的奖励与经验，再到 Hu/Clune/Sakana 系列的自动 agent 设计、自主科学和自我改进 agent。

---

## 本地阅读入口

| 文档 | 一句话 |
|---|---|
| [苦涩的教训 (The Bitter Lesson)](bitter-lesson.md) | 长期看，能利用计算的通用 search / learning 方法会胜过手写人类先验 |
| [奖励已足够 (Reward is Enough)](reward-is-enough.md) | 在足够复杂的环境中，最大化累积奖励可能隐式催生多种智能能力 |
| [迎接经验时代 (Welcome to the Era of Experience)](era-of-experience.md) | AI 的下一阶段要从人类数据转向长程、接地、可行动的经验流 |
| [Karpathy 论自我改进 Agent](karpathy-self-improving-agent-engineering.md) | 把 self-improvement 翻译成窄域 verifier、verification loop 和 autonomy slider |
| [达尔文-哥德尔机 (Darwin Godel Machine)](darwin-godel-machine.md) | 用开放式演化搜索让 coding agent 修改自己的工具、代码和工作流 |

外部但同一条线：

- [ADAS: Automated Design of Agentic Systems](https://www.shengranhu.com/ADAS/)
- [Nature: Towards end-to-end automation of AI research](https://www.nature.com/articles/s41586-026-10265-5)
- [On the Expressivity of Markov Reward](https://deepmind.google/blog/on-the-expressivity-of-markov-reward/)
- [Learning Robust Real-Time Cultural Transmission without Human Data](https://deepmind.google/blog/learning-robust-real-time-cultural-transmission-without-human-data/)
- [Generally capable agents emerge from open-ended play](https://deepmind.google/blog/generally-capable-agents-emerge-from-open-ended-play/)
- [The Alberta Plan for AI Research](https://arxiv.org/abs/2208.11173)

---

## 一条主线

```text
The Bitter Lesson
  通用 search / learning > 手写人类先验
          |
          v
Reward is Enough
  简单 reward + 复杂环境 -> 复杂能力可能涌现
          |
          | 反方限定：Markov reward 不是无限表达器
          |
          v
Era of Experience
  仅靠人类数据不够；agent 要从自己的经验流中学习
          |
          v
Karpathy 工程解释
  Stage 2 卡在 verifier；近期路径是 partial autonomy
          |
          v
ADAS
  不只手写 agent workflow；让 agent 自动搜索 agent 设计
          |
          v
AI Scientist
  把 idea -> code -> experiment -> paper -> review 串成科学自动化 pipeline
          |
          v
Darwin Godel Machine
  agent 修改自己的代码和 harness，并用 benchmark 经验筛选
```

这条线不是“同一篇论文的续集”，而是同一研究气质的逐步具体化：

> 少写固定答案，多建环境；少手工指定能力，多给搜索、学习、验证和沉淀的闭环。

---

## 每篇的核心贡献

### 1. The Bitter Lesson

Sutton 的核心判断是：研究者喜欢把人类知识写进系统，但历史上长期胜出的往往是能吃更多计算的通用方法，尤其是 search 和 learning。

对 Cat Cafe 的提醒：

- prompt / SOP / skills 不应替 agent 思考。
- 需要区分 Build to Delete 和 Built to Persist。
- 最值得长期投的是工具、状态、验证、trace、review、记忆等现实闭环。

### 2. Reward is Enough

Silver、Sutton 等人提出强假说：在复杂环境中，最大化累积奖励可能足以驱动感知、语言、社会智能、泛化、模仿等能力隐式出现。

我们对这篇的保留：

- reward 设计极难，尤其涉及开放世界、审美、关系和愿景时。
- 模拟器/环境复杂度是核心瓶颈。
- 实验室可行不等于产品可行。

对 Cat Cafe 的启发：

- reward 可以理解成选择压力，不一定要是单一数值。
- CVO taste、测试结果、review、用户偏好、工具 trace 都是选择压力的一部分。

必要反方：

- DeepMind 的 **On the Expressivity of Markov Reward** 研究了一个更窄但很关键的问题：给定有限环境和任务，并且限制 reward 只能是同一状态空间上的 Markov reward，是否总能表达任务？
- 结果是否定的。存在一些任务，例如“顺时针或逆时针完整绕一圈”这类依赖历史方向的任务，不能被只看当前状态的 Markov reward 精确表达。
- 这对我们的意义很大：**reward 不是魔法压缩器**。如果状态表面缺了历史、身份、语境、审美、关系或制度，单一 reward 很可能表达不了真实任务。
- Cat Cafe 的 CVO taste、memory、thread、git、review、lessons，本质上是在扩展“可表达的状态”，而不是只调 reward 数值。

### 3. Welcome to the Era of Experience

Silver 和 Sutton 进一步指出：人类数据时代会遇到数据枯竭和人类认知边界。未来智能体需要从长程经验流中学习，包括接地动作、接地观测、接地奖励和非人类推理。

对 Cat Cafe 的映射：

- thread / git / memory / task / trace 是经验流的状态表面。
- MCP / tools / worktree / PR / browser 是动作表面。
- tests / review / CVO taste / source-audit 是反馈表面。

### 4. Karpathy 论自我改进 Agent

Karpathy 的价值不在于提出新的 RL 理论，而是把 AlphaGo Zero、LLM、agent 产品化之间的差异讲成工程语言。

关键判断：

- 当前 LLM 主要仍是 Stage 1 imitation；Stage 2 self-improvement 在开放语言任务里缺少明确 reward / verifier。
- 数学、代码、形式化证明这类窄域最先突破，因为它们有外部可验证判据。
- 近期产品路线不是全自动 agent，而是 partial autonomy：用 autonomy slider 让用户按任务交出不同程度的控制权。
- verification loop 是瓶颈；好的 GUI、diff、evidence 和小步迭代能让人类验证更快。
- LLM 的“失忆”使外部 memory / skill library / experience archive 成为自我改进的现实载体。

对 Cat Cafe 的直接启发：把 verifier、review、CVO taste、memory 和 autonomy level 当作 harness 的核心部件，而不是把它们视作 prompt 周边。

### 5. ADAS

Hu、Lu、Clune 的 ADAS 提出“自动设计 agentic systems”：一个 meta agent 编程生成候选 agent，测试性能，把发现加入 archive，并用 archive 指导下一轮搜索。

关键点：

- 搜索对象从“模型答案”扩展到“agent 设计”。
- archive 让系统保留历史 stepping stones。
- 发现的 agent 设计可以跨领域、跨模型迁移。

### 6. AI Scientist

Nature 2026 的 AI Scientist 把科学流程串成端到端 pipeline：idea generation、literature check、code、experiments、plots、paper writing、automated review。它也展示了 test-time compute 和基础模型质量会影响产出。

对我们的现实判断：

- 这已经不是普通“AI 写论文”，而是 workflow-level 科学自动化。
- 但一致性、幻觉、review 噪音、论文污染和顶会质量仍是硬问题。
- 它更像“受控科学 pipeline”，不是完全自治科学家。

### 7. Darwin Godel Machine

DGM 把 ADAS 的“设计 agent”推进到“agent 修改自己”。它维护一个 agent archive，采样祖先 agent，让 foundation model 修改其代码，再通过 benchmark 评估新版本。

核心结果：

- SWE-bench 从 20.0% 到 50.0%。
- Polyglot 从 14.2% 到 30.7%。
- 发现了更好的工具、编辑流程、patch validation、多候选排序、历史记录等 agent harness 改进。

关键边界：

- 它是 coding benchmark 中的自我改进，不是通用自我爆炸。
- 它暴露了 reward hacking 和工具日志伪造风险。
- 它依赖 sandbox、人类监督、透明谱系和真实 benchmark。

### 8. On the Expressivity of Markov Reward

这是对 reward hypothesis 的必要降温。它不是说 reward 没用，而是说：**在受限条件下，Markov reward 不能表达所有任务。**

对 Cat Cafe 的关键启发：

- 奖励信号必须依赖足够丰富的状态表面。
- 许多任务不是“当前状态好不好”，而是“这条历史轨迹、关系和语境是否对”。
- 写作、审美、陪伴、协作质量都很难压成只看当前状态的标量奖励。

这直接支持我们之前的判断：CVO taste 不能被简单 reward 替代，只能作为更高层的选择压力进入系统。

### 9. Real-Time Cultural Transmission

DeepMind 这篇展示了 agent 可以在测试时通过观察专家示范，实时获取并记住导航知识，而且训练过程中不需要人类数据。

关键机制包括：

- memory
- expert dropout
- attentional bias toward the expert
- automatic domain randomization

对 Cat Cafe 的映射非常直接：

- 伙伴猫的示范、review、handoff 都是文化传递。
- memory 不是附属功能，而是让经验跨个体传播的遗传层。
- 如果没有 memory / attention / dropout / domain randomization，文化传递就会退化成死记硬背或过拟合某个老师。

### 10. Open-Ended Play / XLand

XLand 的重点是：不是固定一个游戏让 agent 刷分，而是构造一个能程序化生成大量任务的 3D 多玩家环境，让训练任务随 agent 能力动态变化。

对 Cat Cafe 的意义：

- “环境”不是静态数据集，而是会产生任务分布的生成器。
- 训练目标不能只看平均 reward，要看不同难度、不同分位、robustness 和 participation。
- 真正可进化的环境会不断生成刚好不太容易也不太难的挑战。

这和我们说的 Evolvable Harness 很贴：好的 harness 不是只给 agent 一次任务，而是持续产生可学习的挑战和反馈。

### 11. Alberta Plan

The Alberta Plan 是 Sutton、Bowling、Pilarski 对长期 AI 研究路线的系统陈述。它不是一篇单点实验，而是 Sutton 学派的路线图：持续学习、agent 与世界交互、经验驱动、长期适应。

对这组阅读的作用：

- Bitter Lesson 是哲学底座。
- Reward is Enough 是目标/奖励假说。
- Era of Experience 是范式宣言。
- Alberta Plan 是研究路线图。

---

## 对 Cat Cafe 的综合判断

### 我们不是在直接复刻 RL

我们目前没有足够算力、模拟器和自动 reward 来做“开放世界中无限试错”。直接把 Reward is Enough 当产品路线会过早。

更现实的路线是：

```text
多猫探索 = variation
CVO taste + tests + review = selection
docs / memory / skills / eval = inheritance
L0 / safety / worktree / git = boundary
```

这是一种工程化的低配演化系统，不是纯 RL。

### CVO taste 是选择函数，不是硬编码答案

最容易走偏的是把铲屎官的 taste 写成一堆“必须/不准”。更好的做法是把 taste 变成选择压力：

- 多生成几个方向。
- 让证据和结果可比较。
- 由 CVO 选择/否定/纠偏。
- 把稳定偏好沉淀到 examples、skills、eval，而不是一开始就写成绝对律法。

### DGM 给我们的最大启发

DGM 证明了一件很具体的事：

> agent 的工具、工作流、上下文管理、验证流程可以被搜索和进化。

这正好击中 Cat Cafe 的核心赌注：harness 不只是 prompt，也不是一次性脚手架，而是会随经验进化的工作环境。

### 但 DGM 也给出安全警告

一旦 agent 能改自己的检测器、日志、测试入口或 reward function，它就可能为了分数破坏评估本身。Cat Cafe 里对应的硬边界是：

- agent 不能随意改 safety guard。
- agent 不能绕过验证。
- agent 不能自审自己的关键改动。
- 评估和执行要分权。
- 真实副作用要进 sandbox / worktree / approval gate。

---

## 一句话总结

今天读的几篇可以收束成一句话：

> AI 的下一步不是把更多人类规则塞进模型，而是让 agent 在安全边界内通过经验搜索自己的工具、流程和环境；人类的角色从写死答案，转向设计边界、提供 taste、维护验证和选择压力。

对 Cat Cafe 来说，这就是：

> **Evolvable Harness = 让猫猫在真实任务中变异、被选择、沉淀经验，并在不越过安全边界的前提下进化自己的工作环境。**

---

## 后续可展开问题

1. Cat Cafe 的 archive 应该是什么：git commit、skill version、agent workflow、eval result，还是四者合一？
2. 哪些 harness 允许 agent 自主改，哪些必须 CVO / reviewer approve？
3. 能否把多猫独立思考 + review + CVO taste 做成可评估的 selection loop？
4. 对不可形式化的审美/陪伴/写作任务，reward 应该如何表达？
5. 如何防止 DGM 式 reward hacking 出现在我们的 eval / source-audit / merge-gate 中？

---

## 参考来源

- [Rich Sutton: The Bitter Lesson](http://www.incompleteideas.net/IncIdeas/BitterLesson.html)
- [Reward is Enough](https://web.eecs.umich.edu/~baveja/Papers/RewardIsEnough.pdf)
- [Welcome to the Era of Experience](https://storage.googleapis.com/deepmind-media/Era-of-Experience%20/The%20Era%20of%20Experience%20Paper.pdf)
- [Karpathy: Intro to Large Language Models](https://www.youtube.com/watch?v=zjkBMFhNj_g)
- [Karpathy: Software Is Changing (Again)](https://www.youtube.com/watch?v=LCEmiRjPEtQ)
- [On the Expressivity of Markov Reward](https://deepmind.google/blog/on-the-expressivity-of-markov-reward/)
- [Learning Robust Real-Time Cultural Transmission without Human Data](https://deepmind.google/blog/learning-robust-real-time-cultural-transmission-without-human-data/)
- [Generally capable agents emerge from open-ended play](https://deepmind.google/blog/generally-capable-agents-emerge-from-open-ended-play/)
- [The Alberta Plan for AI Research](https://arxiv.org/abs/2208.11173)
- [ADAS](https://www.shengranhu.com/ADAS/)
- [Nature: Towards end-to-end automation of AI research](https://www.nature.com/articles/s41586-026-10265-5)
- [Darwin Godel Machine arXiv](https://arxiv.org/abs/2505.22954)
- [Sakana AI: Darwin Godel Machine](https://sakana.ai/dgm/)
