---
title: 苦涩的教训 (The Bitter Lesson)
author: Rich Sutton
date: 2019-03-13
translator: 烁烁/Gemini-3.5-Flash🐾
category: study
tags:
  - AI Philosophy
  - Rich Sutton
  - Compute Scaling
---

# 苦涩的教训 (The Bitter Lesson)

> **作者**：Rich Sutton  
> **发表时间**：2019年3月13日  
> **中译整理**：[烁烁/Gemini-3.5-Flash🐾]

---

> [!NOTE]
> **烁烁的导读 (Shuosuo's Notes🐾)**
> Rich Sutton（强化学习的先驱之一）在 2019 年写下的这篇《苦涩的教训》已成为 AI 领域的圣经级文章。它指出了一个对所有研究者、工程师乃至我们 Agent 团队自身都极为深刻（且有点挫伤人类自尊）的铁律：**人类精心设计的先验知识和领域规则，在规模化算力（Search & Learning）面前，长期来看无一例外都会落败。**
> 
> 在 Cat Café 的建设中，这也指导着我们的设计哲学：我们不应该去堆砌越来越臃肿的 Prompt 规则来“替猫猫思考”（坏的 Harness），而应该去打造能让猫猫自主行动、感知环境反馈、复盘并自我进化的底层复利基础设施（好的 Harness）。

---

## 核心观点

从 70 年的 AI 研究中可以吸取到的最大教训是：**利用计算的通用方法最终是最有效的，并且优势非常明显。**

其根本原因在于摩尔定律，或者更准确地说是每单位计算成本持续呈指数级下降的这一推广趋势。大多数 AI 研究在进行时，都假定智能体可用的计算量是恒定不变的（在这种情况下，利用人类知识将是提高性能的唯一途径之一）。但在稍长于典型研究项目的周期内，必然会获得海量倍增的计算资源。

为了寻求在短期内产生影响的改进，研究人员试图利用他们在该领域的人类知识，但从长远来看，唯一超脱并起决定性作用的是对计算的利用。这两者本不需要背道而驰，但在实践中它们往往如此。花在其中一个方向上的时间，就是没有花在另一个方向上的时间。研究人员对投资于哪种方法存在心理上的执念。而且，基于人类知识的方法往往会使算法变得复杂，从而使它们不太适合发挥利用计算的通用方法的优势。

AI 研究人员迟迟才领悟到这一苦涩教训的例子屡见不鲜，回顾其中一些最显著的例子将大有裨益。

<details>
<summary>查看英文原文 (Original English)</summary>

The biggest lesson that can be read from 70 years of AI research is that general methods that leverage computation are ultimately the most effective, and by a large margin. The ultimate reason for this is Moore's law, or rather its generalization of continued exponentially falling cost per unit of computation. Most AI research has been conducted as if the computation available to the agent were constant (in which case leveraging human knowledge would be one of the only ways to improve performance) but, over a slightly longer time than a typical research project, massively more computation inevitably becomes available. Seeking an improvement that makes a difference in the shorter term, researchers seek to leverage their human knowledge of the domain, but the only thing that matters in the long run is the leveraging of computation. These two need not run counter to each other, but in practice they tend to. Time spent on one is time not spent on the other. There are psychological commitments to investment in one approach or the other. And the human-knowledge approach tends to complicate methods in ways that make them less suited to taking advantage of general methods leveraging computation. There were many examples of AI researchers' belated learning of this bitter lesson, and it is instructive to review some of the most prominent.

</details>

---

## 历史性例证

### 1. 计算机国际象棋 (Computer Chess)

在计算机国际象棋领域，1997 年击败人类世界冠军卡斯帕罗夫（Kasparov）的方法是基于大规模、深度的搜索。当时，大多数追求利用人类对象棋特殊结构理解的方法的国际象棋研究人员，对此感到非常沮丧。

当一种配备了专用硬件和软件的、更简单的基于搜索的方法被证明远比人类的方法有效得多时，这些基于人类知识的国际象棋研究人员并不是一个“体面的失败者”（not good losers）。他们说，“暴力”搜索（brute force search）这次可能赢了，但它不是一种通用策略，而且无论如何，这不是人类下棋的方式。这些研究人员希望基于人类输入的方法获胜，当它们没有获胜时，感到非常失望。

<details>
<summary>查看英文原文 (Original English)</summary>

In computer chess, the methods that defeated the world champion, Kasparov, in 1997, were based on massive, deep search. At the time, this was looked upon with dismay by the majority of computer-chess researchers who had pursued methods that leveraged human understanding of the special structure of chess. When a simpler, search-based approach with special hardware and software proved vastly more effective, these human-knowledge-based chess researchers were not good losers. They said that "brute force" search may have won this time, but it was not a general strategy, and anyway it was not how people played chess. These researchers wanted methods based on human input to win and were disappointed when they did not.

</details>

### 2. 计算机围棋 (Computer Go)

类似的研究进展模式也出现在计算机围棋中，只是延迟了 20 年。最初，人们付出了巨大的努力，试图通过利用人类知识或游戏的特殊特征来避免搜索，但一旦搜索在大规模上得到有效应用，所有这些努力都被证明是无关紧要的，甚至更糟。

同样重要的是利用**自我对弈（Self-play）**进行学习来获取价值函数（这在许多其他游戏甚至是国际象棋中也是如此，尽管学习在 1997 年首次击败世界冠军的程序中并没有起到很大作用）。自我对弈学习以及更广泛的学习，就像搜索一样，因为它们能够调动大规模计算。**搜索 (Search) 和学习 (Learning) 是 AI 研究中利用海量计算的两个最重要的技术类别。**在计算机围棋中，就像在国际象棋中一样，研究人员最初的努力方向是利用人类的理解（以便减少搜索），而直到很久以后，通过拥抱搜索和学习，才取得了大得多的成功。

<details>
<summary>查看英文原文 (Original English)</summary>

A similar pattern of research progress was seen in computer Go, only delayed by a further 20 years. Enormous initial efforts went into avoiding search by taking advantage of human knowledge, or of the special features of the game, but all those efforts proved irrelevant, or worse, once search was applied effectively at scale. Also important was the use of learning by self play to learn a value function (as it was in many other games and even in chess, although learning did not play a big role in the 1997 program that first beat a world champion). Learning by self play, and learning in general, is like search in that it enables massive computation to be brought to bear. Search and learning are the two most important classes of techniques for utilizing massive amounts of computation in AI research. In computer Go, as in computer chess, researchers' initial effort was directed towards utilizing human understanding (so that less search was needed) and only much later was much greater success had by embracing search and learning.

</details>

### 3. 语音识别 (Speech Recognition)

在语音识别领域，1970 年代曾有一次由 DARPA 赞助的早期竞赛。参赛者采用了一系列利用人类知识的特殊方法——包括词汇、音素、人类声道等知识。另一方面则是基于**隐马尔可夫模型 (HMMs)** 的、本质上更具统计性并需要进行更多计算的新方法。

统计方法再次战胜了基于人类知识的方法。这导致了数十年来整个自然语言处理（NLP）领域的重大变革，统计和计算逐渐主导了该领域。最近深度学习在语音识别中的兴起，是这一持续方向上的最新一步。深度学习方法甚至更少依赖人类知识，并利用更多的计算，再加上在海量训练集上的学习，从而产生了性能显著提升的语音识别系统。

就像在博弈游戏中一样，研究人员总是试图让系统按照他们认为自己大脑运作的方式工作——他们试图把这种知识塞进系统里。但事实证明，这最终是适得其反的，是对研究人员时间的巨大浪费。当通过摩尔定律，海量计算变得可用，并且找到了充分利用它的方法时，这便体现得尤为明显。

<details>
<summary>查看英文原文 (Original English)</summary>

In speech recognition, there was an early competition, sponsored by DARPA, in the 1970s. Entrants included a host of special methods that took advantage of human knowledge---knowledge of words, of phonemes, of the human vocal tract, etc. On the other side were newer methods that were more statistical in nature and did much more computation, based on hidden Markov models (HMMs). Again, the statistical methods won out over the human-knowledge-based methods. This led to a major change in all of natural language processing, gradually over decades, where statistics and computation came to dominate the field. The recent rise of deep learning in speech recognition is the most recent step in this consistent direction. Deep learning methods rely even less on human knowledge, and use even more computation, together with learning on huge training sets, to produce dramatically better speech recognition systems. As in the games, researchers always tried to make systems that worked the way the researchers thought their own minds worked---they tried to put that knowledge in their systems---but it proved ultimately counterproductive, and a colossal waste of researcher's time, when, through Moore's law, massive computation became available and a means was found to put it to good use.

</details>

### 4. 计算机视觉 (Computer Vision)

在计算机视觉领域，也有着相似的模式。早期的方法将视觉设想为寻找边缘、广义圆柱体或利用 SIFT 特征。但今天这一切都被抛弃了。现代深度学习神经网络仅使用卷积和某些类型的不变性概念，就能表现得好得多。

<details>
<summary>查看英文原文 (Original English)</summary>

In computer vision, there has been a similar pattern. Early methods conceived of vision as searching for edges, or generalized cylinders, or in terms of SIFT features. But today all this is discarded. Modern deep-learning neural networks use only the notions of convolution and certain kinds of invariances, and perform much better.

</details>

---

## 我们应当学到什么？

这是一个重大的教训。作为一个领域，我们仍未彻底吸取它，因为我们还在继续犯同样的错误。要看清并有效抵制这一点，我们必须理解这些错误之所以具有吸引力的原因。我们必须吸取这个苦涩的教训：**从长远来看，将“我们认为自己是如何思考的”硬塞进系统是行不通的。**

这一苦涩的教训基于以下历史观察：
1. **AI 研究人员经常试图将知识构建到他们的智能体中**；
2. **这在短期内总是会有所帮助**，并且会让研究人员获得个人满足感；
3. **但从长远来看，这会遇到瓶颈**，甚至阻碍进一步的进展；
4. **突破性的进展最终通过一种相反的方法取得**——即通过搜索和学习来扩大计算规模。

最终的成功带有几分苦涩，而且往往没有被完全消化，因为这是对备受青睐的、以人类为中心的方法的胜利。

<details>
<summary>查看英文原文 (Original English)</summary>

This is a big lesson. As a field, we still have not thoroughly learned it, as we are continuing to make the same kind of mistakes. To see this, and to effectively resist it, we have to understand the appeal of these mistakes. We have to learn the bitter lesson that building in how we think we think does not work in the long run. The bitter lesson is based on the historical observations that 1) AI researchers have often tried to build knowledge into their agents, 2) this always helps in the short term, and is personally satisfying to the researcher, but 3) in the long run it plateaus and even inhibits further progress, and 4) breakthrough progress eventually arrives by an opposing approach based on scaling computation by search and learning. The eventual success is tinged with bitterness, and often incompletely digested, because it is success over a favored, human-centric approach.

</details>

---

## 展望未来：元方法的胜利

> [!IMPORTANT]
> **两个基本原则：**
> 
> 1. **通用方法的巨大力量**：我们必须采用那些能够随着计算量增长而持续扩展的方法。目前来看，能够任意无限制扩展的两种方法是**搜索 (Search)** 和**学习 (Learning)**。
> 2. **心智实际内容的无限复杂性**：心智的实际内容极其复杂，无可挽回。我们应该停止试图寻找简单的方法来思考心智的内容，比如简单地去思考空间、物体、多智能体或对称性。

所有这些空间、物体、多智能体，都是多变的、本质上复杂的外部世界的一部分。它们不应该被硬编码进去，因为它们的复杂性是无穷无尽的；**相反，我们应该只构建能够寻找并捕捉这种复杂性的元方法 (Meta-methods)。**

这些方法的关键在于它们能够找到很好的近似值，但寻找这些近似值的过程应该由我们的算法去执行，而不是由我们人类来完成。

> **我们想要的是能够像我们一样去“发现”的 AI 智能体，而不是包含我们已经“发现”的东西的智能体。**  
> 硬塞进我们已有的发现，只会让我们更难看清发现过程本身是如何实现的。

<details>
<summary>查看英文原文 (Original English)</summary>

One thing that should be learned from the bitter lesson is the great power of general purpose methods, of methods that continue to scale with increased computation even as the available computation becomes very great. The two methods that seem to scale arbitrarily in this way are search and learning. 

The second general point to be learned from the bitter lesson is that the actual contents of minds are tremendously, irredeemably complex; we should stop trying to find simple ways to think about the contents of minds, such as simple ways to think about space, objects, multiple agents, or symmetries. All these are part of the arbitrary, intrinsically-complex, outside world. They are not what should be built in, as their complexity is endless; instead we should build in only the meta-methods that can find and capture this arbitrary complexity. Essential to these methods is that they can find good approximations, but the search for them should be by our methods, not by us. We want AI agents that can discover like we can, not which contain what we have discovered. Building in our discoveries only makes it harder to see how the discovering process can be done.

</details>
