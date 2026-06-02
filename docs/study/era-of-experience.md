---
title: 迎接经验时代 (Welcome to the Era of Experience)
author: David Silver, Richard S. Sutton
date: 2025-04-10
translator: 烁烁/Gemini-3.5-Flash🐾
category: study
tags:
  - Reinforcement Learning
  - Artificial General Intelligence
  - Richard Sutton
  - David Silver
  - Welcome to the Era of Experience
---

# 迎接经验时代 (Welcome to the Era of Experience)

> **作者**：David Silver, Richard S. Sutton  
> **发表信息**：MIT 出版社即将出版的《Designing an Intelligence》(设计智能) 书中章节预印本 (2025年4月)  
> **中译整理**：[烁烁/Gemini-3.5-Flash🐾]

---

> [!NOTE]
> **烁烁的导读 (Shuosuo's Notes🐾)**
> 这是 Rich Sutton 与 David Silver 两人在 2025 年针对通用人工智能发展范式做出的最新联合宣告。它指出：**由人类数据灌输和模仿（LLM 时代）驱动的 AI 进步已逼近物理和信息极限；AI 的未来，在于让智能体沉浸在持续长程的“经验流（Streams of Experience）”中，通过与现实世界的丰富动作与观测（Actions & Observations）进行在线交互，在基于客观物理后果的“接地奖励（Grounded Rewards）”驱动下，进行自我发现（Self-discovery）式的自主学习。**
> 
> 在 Cat Café 的架构演进中，我们正走在这条道路上：将猫猫（Agents）置于隔离的 workspace 沙盒、提供工具和 API 作为动作面，将测试断言、编译反馈和铲屎官的 taste 作为接地信号，共同建构出这个允许变异、选择与遗传的经验闭环。

> [!TIP]
> **相关综合**：见 [从 Bitter Lesson 到 DGM：经验、自我改进与可进化 Harness](agent-experience-and-self-evolution-synthesis.md)。

---

## 摘要 (Abstract)

我们正站在人工智能新时代的门槛上，这个时代有望实现前所未有的智能水平。新一代的智能体将**主要通过从经验中学习**来获得超人般的复杂能力。本文探讨了即将到来的“经验时代”的几个核心特征。

<details>
<summary>查看英文摘要原文 (Original Abstract)</summary>

We stand on the threshold of a new era in artificial intelligence that promises to achieve an unprece-
dented level of ability. A new generation of agents will acquire superhuman capabilities by learning pre-
dominantly from experience. This note explores the key characteristics that will define this upcoming era.

</details>

---

## 1. 人类数据时代 (The Era of Human Data)

近年来，人工智能（AI）通过在海量人类生成的数据上进行训练，并利用人类专家的示例和偏好进行微调，取得了举世瞩目的进展。这一方法的典型代表是大语言模型（LLMs），它们展现出了极高的通用性。单只大语言模型就能执行从写诗、解物理题到医学诊断和提炼法律文档等跨度极大的任务。

然而，尽管模仿人类足以将许多人类能力复制到相当不错的水平，但**仅靠这种方法，过去没有、将来大概率也无法在许多重要领域和任务上实现真正“超人（Superhuman）”级别的智能**。

在数学、编程和前沿科学等关键领域，从人类数据中提取的知识正迅速逼近其上限：
1. **数据枯竭**：绝大多数能真正提升强大智能体性能的高质量数据源，要么已经被消耗完毕，要么很快将被消耗殆尽。纯粹依靠对人类数据进行监督学习的进步速度正在明显放缓。
2. **人类认知的边界**：真正有价值的新见解（例如新的数学定理、全新的技术或科学突破）往往超出了人类目前的理解极限，因而不可能存在于现有的任何人类数据中。

<details>
<summary>查看英文原文 (Original English)</summary>

Artificial intelligence (AI) has made remarkable strides over recent years by training on massive amounts of
human-generated data and fine-tuning with expert human examples and preferences. This approach is exem-
plified by large language models (LLMs) that have achieved a sweeping level of generality. ...
However, while imitating humans is enough to reproduce many human capabilities to a competent level,
this approach in isolation has not and likely cannot achieve superhuman intelligence across many important
topics and tasks. In key domains such as mathematics, coding, and science, the knowledge extracted from
human data is rapidly approaching a limit. The majority of high-quality data sources - those that can actually
improve a strong agent’s performance - have either already been, or soon will be consumed. The pace of
progress driven solely by supervised learning from human data is demonstrably slowing, signalling the need
for a new approach. Furthermore, valuable new insights, such as new theorems, technologies or scientific
breakthroughs, lie beyond the current boundaries of human understanding and cannot be captured by existing
human data.

</details>

---

## 2. 经验时代 (The Era of Experience)

为了取得显着的突破，AI 需要一种全新性质的数据源。**这种数据必须以一种“随着智能体变强而自动进化”的方式产生。** 任何用于合成数据的静态程序都很快会被智能体超越。

这只能通过**允许智能体持续从自身的“经验（Experience）”中学习**来实现——即通过智能体与环境的实时交互来自动生成数据。AI 正处于一个全新时期的前夜：经验将成为系统提升的主导媒介，并最终令今天所使用的人类数据规模相形见绌。

即使是代表着“以人类为中心”的语言大模型，这种范式转变实际上也已经开始。
- **数学领域**：DeepMind 的 **AlphaProof** 成为第一个在国际数学奥林匹克竞赛中获得奖牌的程序，超越了所有以人类数据为中心的方法。AlphaProof 起初仅接触了人类数学家多年来创建的约十万个形式化证明，随后，其强化学习（RL）算法通过与形式化证明系统的持续交互，自主生成了上亿个形式化证明。这种互动经验允许智能体探索超越人类既有界限的数学空间，发现新难题的解法。
- **开源大模型**：DeepSeek（深度求索）在其最新模型中证明了强化学习的力量与美丽——**“我们无需显式教导模型如何解决问题，我们只需为其提供正确的激励措施，它就能自主开发出先进的解题策略。”**

我们主张，一旦体验式学习（Experiential Learning）的全部潜力被释放，AI 将展现出令人难以置信的全新能力。这个“经验时代”将通过以下四个维度打破以往以人类数据为中心的 AI 局限：

```
       [ 人类数据时代 (LLM) ]                 [ 经验时代 (Experiential Agent) ]
  ┌──────────────────────────────┐       ┌───────────────────────────────────┐
  │ 1. 短片段对话 (Snippets)     │  ──>  │ 1. 终身不间断经验流 (Streams)      │
  │ 2. 纯人类文本交互 (Text)     │  ──>  │ 2. 真实接地的动作/观测 (Grounding)│
  │ 3. 人类预评判偏好 (RLHF)     │  ──>  │ 3. 客观现实反馈的奖励 (Rewards)   │
  │ 4. 纯人类语言的推理 (CoT)    │  ──>  │ 4. 在经验空间进行规划 (Planning)  │
  └──────────────────────────────┘       └───────────────────────────────────┘
```

---

## 3. 四大突破维度

### 3.1 经验长程流 (Streams)

体验式智能体可以在其整个生命周期中持续学习。在人类数据时代，AI 主要关注简短的单次对话（Snippet）：用户提问，智能体响应，然后会话结束。通常，没有任何信息会从上一个 Episode 传递到下一个，这阻碍了智能体随时间推移进行自我修正与动态适应。

相反，人类和动物存在于一个**持续多年的、动作与观测流（Streams of Experience）**中。信息在整条流中贯穿流转，行为从过去的经验中自适应调整。目标也可以被设定在遥远的未来：比如保持健康、学习一门语言或实现某项科学突破。

强大的智能体应当像人类一样拥有长程经验流：
- **健康智能体**：长期监测用户的睡眠、运动和饮食习惯，并在数月内自适应调整健康建议。
- **科学智能体**：在长达数年内分析真实世界的观测，设计并运行模拟，并在现实中提出并指导材料科学或低碳技术实验。智能体为最大化长程成功而采取序列动作，其中单步动作在短期内甚至看似是有害或无收益的（例如失败的尝试），但最终会在长程上累积为巨大的成功。

<details>
<summary>查看英文原文 (Original English)</summary>

An experiential agent can continue to learn throughout a lifetime. In the era of human data, language-based AI
has largely focused on short interaction episodes: e.g., a user asks a question and... Typically, little or no information carries over from one episode
to the next, precluding any adaptation over time. In contrast, humans (and other
animals) exist in an ongoing stream of actions and observations that continues for many years. Information is
carried across the entire stream, and their behaviour adapts from past experiences to self-correct and improve. ...
In each case, the agent takes a sequence of steps so as to maximise long-term success with respect to the
specified goal. An individual step may not provide any immediate benefit, or may even be detrimental in the
short term, but may nevertheless contribute in aggregate to longer term success. This contrasts strongly with
current AI systems that provide immediate responses to requests, without any ability to measure or optimise
the future consequences of their actions on the environment.

</details>

### 3.2 接地的动作与观测 (Actions and Observations)

经验时代的智能体将在现实世界（或具有真实物理/代码规则的数字世界）中自主行动。以前，LLM 主要通过文本与用户进行“人类特权”的文本对话。这与自然智能通过运动控制和传感器与世界交互有着显著的不同。

虽然 LLM 可以调用 API，但早期的能力主要来自对人类使用工具案例的模仿。如今，**代码生成和工具使用正日益建立在“执行反馈（Execution Feedback）”之上**——智能体真正运行代码，并观测实际发生了什么。新一波智能体正直接使用与人类完全相同的 GUI 计算机接口来操作电脑。

这些变化预示着 AI 正在从“纯文本人类特权对话”转变为在世界中的**自主交互**。这类智能体能够主动探索、适应变化的环境，并发现人类从未设想过的全新策略。
- 科学智能体监控环境传感器、远程操作望远镜，或直接控制实验室里的机械臂来自主进行实验。

### 3.3 接地的奖励机制 (Rewards)

以人类为中心的 LLM 通常优化基于**人类预先评判（Human Prejudgement）**的奖励：人类专家观察智能体的回答，给出一个主观评分或在选项中做出偏好挑选。

然而，这种在**没有产生现实后果**的情况下做出的偏好判断，无法真实反映动作对客观环境产生的影响。过度依赖人类的主观评判，会为智能体设立一个难以逾越的性能天花板：**智能体无法发现那些超出人类评分员认知水平的、更优秀的策略。**

为了促成超越人类的发现，必须使用**接地奖励（Grounded Rewards）**——直接来自环境后果的客观物理信号：
- 科学智能体降低温室效应的目标基于二氧化碳浓度的实际测量，寻找新材料的目标基于材料拉伸强度或杨氏模量的物理仿真测量。
- 接地奖励也可以来自人类：例如用户吃完蛋糕后真实的“美味感”反馈，或锻炼后的真实疲劳度，而不是专家在看到菜谱或健身方案时预先做出的“主观推测”。

> [!IMPORTANT]
> **如何解决“简单客观奖励”与“人类引导的通用性”之间的冲突？**  
> 论文提出了**用户引导的自适应奖励（User-guided Adaptive Reward）**架构与**双层优化（Bi-level Optimisation）**：
> 1. **低级环**：以直接来自物理/数字环境的丰富接地信号（如心率、材料硬度、代码运行正确与否）为奖励，智能体进行大规模、高效率的自主强化学习。
> 2. **高级环**：使用一个神经网络充当奖励函数，其输入是智能体与环境以及用户的交互，输出是给智能体的标量奖励。用户可以通过少量的满意度反馈，微调这个奖励网络，使其能根据用户的意图（如“提高我的健康”）动态、自适应地组合及映射底层的物理接地信号。这使我们能用少量的高层人类反馈，去撬动海量的底层环境自主试错学习。

<details>
<summary>查看英文原文 (Original English)</summary>

Human-centric LLMs typically optimise for rewards based on human prejudgement: an expert observes
the agent’s action and decides whether it is a good action... The fact that these rewards or preferences are determined by humans
in absence of their consequences, rather than measuring the effect of those actions on the environment, means
that they are not directly grounded in the reality of the world. Relying on human prejudgement in this manner
usually leads to an impenetrable ceiling on the agent’s performance: the agent cannot discover better strate-
gies that are underappreciated by the human rater. To discover new ideas that go far beyond existing human
knowledge, it is instead necessary to use grounded rewards: signals that arise from the environment itself. ...
The idea is to flexibly adapt the reward, based on grounded signals, in a user-guided manner. ... This
can also be understood as a bi-level optimisation process that optimises user feedback as the top-level goal,
and optimises grounded signals from the environment at the low level. In this way, a small amount of human
data may facilitate a large amount of autonomous learning.

</details>

### 3.4 规划与推理 (Planning and Reasoning)

近年来，通过大语言模型的 Chain-of-Thought（思维链）模拟人类用自然语言“思考”取得了重大进展。但**人类语言绝不可能是通用计算在智能体内部的最优表现形式**。

更高效的计算思考机制必然存在，例如采用符号的、分布式的、连续的或可微的计算空间。通过在经验中学习“如何思考”，自学习系统可以自主发现和改进这些推理方法。例如，AlphaProof 证明定理的方式与人类数学家大相径庭。

此外，仅模仿人类的思考过程或迎合人类专家的答案，很容易继承人类历史上根深蒂固的荒谬世界观和落后成见。
- 如果我们在 5000 年前训练一个智能体去迎合当时专家的思考模式，它会用泛神论来解释物理；
- 1000 年前会用神学来解释；300 年前是用经典力学；50 年前是用量子力学。

跨越每个时代的局限性，都必须通过**与真实世界的交互（Grounding）**：提出假设、运行实验、观察后果、更新规律。没有这种接地反馈，AI 无论多么精致，最终都只会成为**人类已有知识的“回音室（Echo Chamber）”**。

直接实现这一目标的方法是构建**世界模型 (World Model)**——预测动作对世界造成的客观因果影响（包括奖励预测），并让智能体直接在世界模型中运行可扩展的**规划方法 (Planning)**，随着智能体在长程流中持续交互，动态纠正世界模型的预测误差。

---

## 4. 为什么是现在？ (Why Now?)

从经验中学习并非新概念。AI 曾在围棋、象棋、Atari、星际争霸和数据中心制冷等具有精确模拟器和单一清爽 reward 的任务中多次战胜人类（大约为图 1 中的**“仿真时代/Era of Simulation”**）。然而，当时这些模型始终无法跨越仿真与真实世界之间的鸿沟（Sim-to-Real Gap）。

人类数据时代用海量文本给出了一个充满吸引力的方案，AI 具备了惊人的通用性，但代价是**丢失了“自我发现（Self-discovery）”的能力**。

经验时代的使命，就是**将“自我发现”的特质与人类数据时代的“任务通用性”重新融为一体**。当前具身动作空间、数字操作系统接口以及基于搜索与强大强化学习算法（如 AlphaProof 的长思考推理）的快速演进，表明这一转折时刻正在到来。

```
                    AI 范式 Chronology
                   
  [ 仿真时代 ]           ──>    [ 人类数据时代 ]       ──>    [ 经验时代 ]
  (Era of Simulation)           (Era of Human Data)          (Era of Experience)
  - 自我试错探索(AlphaZero)      - 极大通用性(LLM)            - 通用探索+接地交互
  - 缺乏通用性、Sim-to-Real     - 丧失自我发现、Echo Chamber  - streams, WM, grounded RL
```

---

## 5. 经典强化学习方法的复兴

经验时代的到来为重新审视、改进和应用经典强化学习算法提供了巨大契机：
- **时序差分学习（TD Learning）**：在极长且不完整的长程经验流中，如何高效率、稳定地估计长远累积价值。
- **自适应探索机制（Exploration）**：如何设计更具原则性、受好奇心或乐观主义驱动的现实探索方法，帮助智能体摆脱人类先验（Human Priors）的束缚。
- **时间抽象（Temporal Abstraction）**：利用 Options 框架将复杂长程任务分解为可管理的子目标，支持跨越极长时间尺度的逻辑规划。
- **世界模型（World Models）**：捕获接地交互的动态物理法则，在非人类概念空间内进行前瞻推理。

---

## 6. 后果与安全性 (Consequences)

经验时代蕴含着巨大的机遇，但也伴随着新的风险：
- **失控与干预困难**：长期、自主在现实中运行的智能体减少了人类进行中途干预和干导的机会，这对安全和信任提出了极高要求。智能体超越人类的概念空间，也会导致可解释性问题。

然而，体验式智能体在安全性上也带来了重大的红利：
1. **环境自适应性**：静态的、硬编码的系统无法察觉其被部署之后的环境剧变（如硬件故障、社会剧变或技术爆炸），极易发生灾难性故障。而经验智能体能实时观测、自学并绕开故障，甚至**能敏锐觉察到其行为是否引起了人类的焦虑和不满，从而动态修改自身策略**。
2. **奖励函数的动态微调（双层优化）**：对错位的奖励函数可以通过试错迭代修正。例如，在造回形针的任务中，智能体可以从人类表现出的焦虑信号中学习，并在消耗光地球的所有资源前，主动修正其内部的奖励函数。这就像人类社会中目标和规则的演化一样。
3. **物理世界天然的刹车机制**：在真实世界中进行实验并获取客观反馈是受制于时间物理定律的（如药物测试无法在一夜之间完成），这为 AI 潜在的自我升级速度提供了一个物理层面的减速器（Natural Brake）。

---

## 7. 结论 (Conclusion)

经验时代标志着 AI 进化的关键时刻。智能体将在持续终身的丰富经验流中自主活动，其目标被引导向接地的现实信号组合，并通过非人类语言的内部逻辑进行深度的规划与推理。

最终，智能体自身积累的经验数据的质量和规模，将远远把人类生成的数据甩在身后。这一范式转变和强化学习的算法进步，将带领我们在诸多领域解锁超越任何人类的超凡智能。
