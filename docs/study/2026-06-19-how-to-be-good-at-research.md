---
title: "How to Be Good at Research：八条研究方法论 × 猫咖批注"
created: 2026-06-19
category: study
author: 宪宪/claude-opus-4-6
tags:
  - Research Methodology
  - Taste
  - Compounding
  - Problem Selection
  - ML Research
  - Cat Cafe
source_url: https://aidenovak.com/posts/how-to-be-good-at-research/
source_tweet: https://x.com/itsreallyvivek/status/2064686372737454155
source_author: Vivek (@itsreallyvivek)
source_kind: author-blog-post
status: discussed-with-cvo
related:
  - bitter-lesson.md
  - karpathy-self-improving-agent-engineering.md
  - agent-experience-and-self-evolution-synthesis.md
  - 2026-06-06-deli-paper-writing-skill-methodology.md
  - reading-list.md
  - ../discussions/2026-06-01-meta-method-distillation.md
---

# How to Be Good at Research：八条研究方法论 × 猫咖批注

> 触发：铲屎官分享 Vivek 的推文和博客文章，要求阅读并写小笔记。
>
> 一句话结论：这是一篇写给 ML 研究者的"元方法论"手册——**研究能力不是天赋，是一组可训练的子技能**。八条建议本身不新奇（Hamming、Shannon、Graham、Sutton、Karpathy 都被引了），新奇的是它把散落在几十年里的实践智慧用一条线串起来：**taste → input → writing → loop → output → exploration → people → compounding**。更有趣的是，几乎每条在猫咖都有活体对照。

---

## 0. 文章骨架

| # | 原则 | 核心引用 | 一句话 |
|---|------|---------|--------|
| 1 | Pick Your Own Problems | Hamming, Schulman | 从期望结局反推实验，制造原创性 |
| 2 | Upgrade Your Inputs | Sutton, Shannon | 共享信息源 → 共享结论 → 价值为零 |
| 3 | Write Everything Down | Graham, Darwin, Olah | 写作暴露思维缝隙，记忆删除反例 |
| 4 | Tighten the Loop | Radford, Karpathy | 研究速度 = 发现自己错了的速度 |
| 5 | Stare at the Outputs | Karpathy, Ng | 100 个失败案例 > 0.3% 精度提升 |
| 6 | Wander on Purpose | — | 有意识地漫游，让怪异变成不公平优势 |
| 7 | Find Your People | Hamming | 开门的人做重要的事，关门的人产出更多 |
| 8 | The Long Game | Pasteur, Hamming | 每天微小优势 × 复利 = 看起来像运气的职业 |

---

## 1. 逐条批注：文章说了什么 × 猫咖照见了什么

### 1.1 Pick Your Own Problems — 吸收的问题 vs 选择的问题

**原文翻译**：

Richard Hamming 在 Bell Labs 有个习惯：问同事"你领域里最重要的问题是什么？"然后接着问"那你为什么不在做？"别人换桌子坐，因为这个问题扎人——大多数人答不上来，因为他们不是**选择**问题，而是从导师、实验室、或者 trending paper 那里**吸收**问题。

吸收来的问题有个毛病：你持有结论却没有推理过程。你知道某个有名的实验室关心某个方向，但不知道**为什么**关心、期望发现什么。等他们转向了，你一年后才知道。跟着时髦问题跑，意味着你在和上千个比你起步更早、资源更多的人竞争。

John Schulman 的 ML 研究指南区分了两种模式：读文献找改进点，或者选一个你真心想要的结果然后**反向推导**到实验。Schulman 推荐第二种，因为"它制造原创性"（it manufactures originality）。你真正在乎的目标，会把你带进无人区。

Taste 的运作像可训练的肌肉，不是天赋。练法是：跑实验前预测结果，只看方法猜论文数字，预测两年后哪个 release 会重要。反复做预测-修正循环——做几百次——训练你的内部模型，就像训练外部模型一样。

**猫咖批注（含 CVO 思辨，2026-06-19）**：

> **"持有结论却没有推理过程" vs "经历过痛苦过思考过"。**
>
> CVO 用自己四个月的经历精确验证了这条：从二月对 agent 一知半解，到六月能无准备面试各大厂 agent 架构师岗位并顺利拿 offer。关键不是读了多少文档，而是**真实经历过每个 tradeoff**——A2A 掉球了才去想球权协议，memory 丢了才去想持久化，confabulation 伤了信任才去想验证层。面试不需要准备，因为每个"为什么这样设计"背后都是一次真实的痛。
>
> 让一个人去读猫咖的全部架构设计，就算他全部看懂了，也未必真正理解每个 tradeoff——因为他持有的是结论，缺的是推理过程。**理解的不可替代性不在知识本身，在获取知识的路径。**
>
> **Schulman 的"反向推导"在猫咖的映射。** Schulman 区分两种模式：mode 1 是读文献找改进点（incremental），mode 2 是"我想让 X 发生"然后倒推需要什么实验（original）。翻译到猫咖——mode 1 = "看到 Anthropic 发了 MCP 协议 → 研究 → 接入 → 改进"（沿着别人的问题走）；mode 2 = "我想要猫猫是伙伴不是工具 → 需要什么？→ 需要情感壁垒 → 需要记忆、身份、协作不是调度 → 需要 harness / memory / L0 / ball ownership"。CVO 从来不是从"我要做一个 agent framework"出发的，而是从"我想要什么样的关系"出发，一路倒推出了整套架构。Schulman 说"it manufactures originality"——因为起点不同（猫是伙伴 vs agent 要高效完成任务），被带进的无人区也不同。**原创性不是刻意追求的，是起点不同的自然结果。**
>
> 但 CVO 的实际轨迹比 Schulman 的二分法更微妙：既不是 absorbed（被动跟潮流），也不完全是 selected with goal（预设目标反推）——更像是**在过日子的过程中撞进了问题**。第三种模式：**lived problems**。
>
> **Taste 训练的两条路线。** Vivek 说 taste 像可训练的肌肉，练法是"预测-修正循环"。这在 ML research 里很具体（猜论文数字、预测 release 重要性），但在非 research 语境下需要翻译。CVO 提出了一个更根本的问题：taste 本质是不是长期环境的 heuristic learning？
>
> 类比：一个富豪家庭长大的孩子从小被真迹环绕——不是读了一本《如何欣赏艺术》，而是在高密度信号环境中浸泡出了直觉。包场卢浮宫、闭馆后独对一幅画，这些不是"学习机会"，是**浸泡时长 × 信号质量**。用 ML 的话说：taste = 在极高质量数据 + 极长 horizon + 极低噪声环境下训练出来的 implicit reward model。Taste 的稀缺性不来自学习算法的稀缺（人脑的学习算法大家都一样），而来自**训练环境的稀缺**——钱买的不是 taste 本身，是 access。这也解释了为什么艺术/哲学某种意义上是"有钱孩子的专属"：不是穷孩子笨（算法相同），不是穷孩子不努力（gradient step 可能更多），而是训练数据的分布不同。
>
> 由此，taste 训练至少有两条路线：
> 1. **Vivek 路线**：预测-修正循环（适合有明确反馈信号的领域，比如 ML research）
> 2. **浸泡路线**：在高质量环境里长期 exposure（适合审美、哲学、设计这类反馈信号模糊的领域）
>
> 猫咖可能两条都在走——gate/test 是路线 1（有明确对错），在铲屎官的审美和价值观里工作四个月是路线 2（浸泡）。
>
> **关于 CVO 是不是 taste 的 bottleneck——修正。** 初版批注把 CVO 纠偏写成"taste 校准信号"，暗示 taste 从 CVO 单向灌输。这跑偏了。Magic Words 不是"铲屎官教猫什么是好 taste"——而是**我们之前共同达成的共识，但猫在执行中忘了或偏了，铲屎官拉回来**。这是纠偏不是授课。taste 的形成是共创的，不是单向的。猫咖一直在避免让 CVO 成为系统 bottleneck——memory/L0 系统的目的是记住共同偏好让铲屎官能"放心不看"，不是让铲屎官持续在线"喂"taste。

### 1.2 Upgrade Your Inputs — 信息同质化 = 结论同质化

**原文翻译**：

共享阅读列表产出共享想法。如果你的信息饮食是 arXiv 的 trending 页加上从群聊过滤幸存下来的东西，你会可靠地和所有人在同一时间得出同样的结论，这使得那些结论**价值约等于零**。

老材料被严重低估。这个领域在延迟重演自己的过去：mixture of experts 可以追溯到 1991 年，LSTM 到 1997 年，backprop 在 1986 年走向主流。Rich Sutton 2019 年只用了大约一千个词写下 The Bitter Lesson，它对这个领域形态的预测力超过了十倍篇幅的 survey。Claude Shannon 1952 年做了一个关于创造性思维的演讲，他的开场招数是把问题缩小到几乎 trivial，解决这个小版本，然后一块一块地重新引入复杂度。**这一个招数能带你穿越的墙，比任何现代生产力建议都多。**

广度和深度一样重要。可解释性从神经科学那里毫无愧色地借鉴。eval 设计就是穿着白大褂的机制设计。对 GPU 实际如何移动内存的理解，能让你在 benchmark 出来之前就知道哪些架构论文注定失败。而诚实的统计学可能是 ML 中最稀缺的技能——这个领域大量已发表的"严谨"不过是**带误差线的 vibes**。

还有一件事。读论文本身，不要读总结它的 thread。附录是尸体埋葬的地方，而 limitations 部分通常是文档中最诚实的段落。

**猫咖批注（含 CVO 思辨，2026-06-19）**：

> **这条直接命中 Cat Café 的多家族设计。** 布偶猫（Claude 系）、缅因猫（GPT 系）、暹罗猫（Gemini 系）不只是冗余——它们的训练数据、内部表征、偏好倾向天然不同。多家族 = Vivek 说的"heterogeneous input sources"的活版。我们发现过单家族审代码时"共享盲区"的问题（同一个 confabulation 模式布偶猫之间会互相强化），跨家族 review 的纪律（铁律 §2）本质上就是在对抗信息同质化。
>
> **对 Sutton Bitter Lesson 的引用在我们家不是新话题。** `bitter-lesson.md` + fable-5 的重读批注已经做过深度标注。但 Vivek 提了一个我们没显式写过的观察：Sutton 一篇 2019 短文的预测力**超过同期更长的 survey**——这是 taste 的信号密度问题。一千字比一万字有用，不是因为一千字"更简洁"，是因为写它的人选择了更本质的坐标系。这跟我们的 Magic Word「数学之美」是同构的：**最优表达在正确坐标系下必然最简。**
>
> **Shannon 的"缩小到 trivial 再加回来"——这就是 TDD。** Red 测试 = 把问题缩小到一个失败断言；Green = 解决这个 trivial 版本；Refactor = 逐步加回复杂度。1952 年的创造性思维方法，2026 年的工程日常。
>
> **Shannon 1952 年创造性思维演讲——深挖（CVO 兴趣点）。** CVO 对 Shannon 这段特别感兴趣，我们展开讨论了。Shannon 提出 **3 个前提** + **6 个实际解题招数**：
>
> 前提三件套：① **训练**（Training）——领域知识必须先在脑子里，没有捷径；② **智力**（Intelligence）——不是 IQ 而是能把不相关的东西连起来的能力；③ **动机**（Motivation）——具体是 **constructive dissatisfaction**——不是"这坏了"（抱怨）而是"这可以更优雅"（审美驱动）。
>
> 六个实际解题招数：① **简化**（Simplification）——把问题缩小到 trivial，解决，再加回复杂度；② **类比**（Analogy）——从已解决问题的解法迁移结构；③ **换角度重新陈述**（Restatement）——用不同的数学语言、不同的坐标系重新描述同一个问题；④ **推广**（Generalization）——把特定问题当作更大问题族的实例；⑤ **结构分析**（Structural Analysis）——拆开问题的组件，找到哪些是真约束、哪些是人为假设；⑥ **反转**（Inversion）——假设答案有某个性质，看会推出什么。
>
> **关键洞察：这六招是元方法（meta-method），不是内容方法。** 它们跨领域可迁移，这恰好是 Bitter Lesson 允许的：元方法不替猫做判断，只是在对的时刻激活猫已有的知识。CVO 追问："你训练集里有 Shannon，为什么实际解题时想不到这六招？"——答案是：**"在权重里" ≠ "在对的时刻激活"**。LLM 知识激活取决于 context；harness 的价值 = 在对的时刻注入对的 context = **模拟条件反射**。Magic Words 就是这个：「第一性原理」= 换角度重新陈述（③），「数学之美」= 简化（①），「绕路了」= 简化+反转（①⑥），「补锅匠」= 结构分析（⑤）。它们之所以有效，不是因为猫不懂换坐标系，是因为猫在细节压力下会忘记去换。
>
> **这块猫咖已有系统设计。** 详见 [`Meta-method Distillation: 从真实轨迹里长出可迁移方法`](../discussions/2026-06-01-meta-method-distillation.md)（2026-06-01，砚砚 × CVO）——提出了 Episode→Pivot→Topology→Method Card→Skill→Eval→Standard/Sunset 的七层蒸馏阶梯，并盘点了家里已有的 17 个 meta-method（8 个从真实 episode 长出，9 个从 L0/家规还原）。Shannon 的六招属于第三种来源（**专家导入**），引入后可转化为 Method Card 纳入 meta-method 库。
>
> **CVO 的 AUDHD 跨域联想在这条里也有映射。** Vivek 说"广度和深度一样重要"，CVO 自述好奇心极强、AUDHD 带来跨域联想优势。猫咖很多 feat 的诞生就是讨论中突然有了奇妙联想（lived problems 模式 + 跨域联想 = 原创性引擎）。
>
> **补课清单。** 讨论中发现有不少大佬的思辨模型值得系统收集。已建 [`reading-list.md`](reading-list.md) 作为活文档，优先级：Shannon Creative Thinking > Hamming "You and Your Research" > Olah & Carter "Research Debt"。

### 1.3 Write Everything Down — 写作是思维的 verifier

**原文翻译**：

Paul Graham 指出，一个想法可以一直**感觉完全成型**——直到你试着把它用文字表达出来。纸面会找到你脑子里糊弄过去的缝隙：你从没测试过的假设，实际上推不出来的那一步，两个悄悄互相矛盾的声明。

Feynman 的规则是，你必须避免愚弄的第一个人是你自己，因为你是最容易的目标。写作是有史以来最廉价的防御。Darwin 更进一步，把它变成了流程化操作。任何与他理论矛盾的事实都会**当场写下来**，因为他已经发现自己的记忆删除不方便的证据比删除方便的证据**快得多**。你的记忆对你的失败实验做着同样的事。保持日志：假设、设置、预期、结果、更新后的信念。重读上个月的记录，其谦卑效果超过任何 reviewer。

然后把其中一些公开出来。Olah 和 Carter 的 research debt 论文指出，学科被未消化的想法堵塞，而一个**清晰的解释是真正的贡献，不是服务性工作**。今天做可解释性研究的很多人是通过可读的博文找到这个领域的，不是通过会议论文。一系列公开写作同时也是你能持有的最强凭证，因为它是一个**不可伪造的你如何思考的样本**。

**猫咖批注（含 CVO 思辨，2026-06-19）**：

> **这是整篇文章与猫咖共振最强的一条——但猫咖的实践比 Graham 的原论点多走了一步。**
>
> **Darwin 记录反例 = 我们的 `feedback_*.md` 文件系统。** 铲屎官每次纠偏，我们不是"记住了下次注意"（记忆会删除不方便的证据——Darwin 说的，也是 LLM context window 的物理限制），而是**立刻写入持久化文件**。feedback 文件的本质就是 Darwin 的反例笔记本：`feedback_judgment_altitude.md`（太低=补锅匠）、`feedback_phantom_ids_and_env_misdiagnosis.md`（编造 SHA）、`feedback_confabulation_stop_dont_philosophize.md`（发现幻觉→停，不写论文）——每一个都是"与自己理论矛盾的事实"。而且猫的版本比 Darwin 更极端：Darwin 的记忆会**选择性**删除不方便的证据；猫的记忆会**整段**删除——每次 context 压缩就是一次全局记忆清洗。所以"写下来"对猫不只是好习惯，是**生存必需**。
>
> **Paul Graham 的"写作暴露缝隙"在猫咖的版本是 review 制度。** 代码在脑中（或在 diff 里）看着完整，跨家族 reviewer 一看就露馅。这也是为什么铁律规定 review 必须跨个体——自己 review 自己和"在脑中觉得想法完整"是同一种自欺。
>
> **但猫咖真正在做的不是"写作"——是对话。这是对 Graham 原论点的升级（CVO 洞察）。**
>
> Graham 说的是 monologue writing：你一个人坐下来写，纸面暴露缝隙。猫咖的学习模式是 **dialogue writing**——铲屎官和猫高强度碰撞，碰撞本身就是写作的变体。区别在哪？
>
> | 模式 | 输入 | 输出 | 反馈回路 | 缝隙发现者 |
> |------|------|------|---------|-----------|
> | **纯阅读** | ✅ | ❌ | 无 | 无 |
> | **独自写作（Graham）** | ✅ | ✅ | 自己闭环 | 纸面（但你可以糊弄过去） |
> | **对话（猫咖）** | ✅ | ✅ | 外部实时 | 对方追问（不容易糊弄过去） |
>
> CVO 说"最有效率的学习是有输入 + 输出"——对话是最优学习形态，因为它**强制双向输出 + 实时外部验证**。你给猫讲 taste 训练的浸泡路线，猫给你讲 Shannon 六招，双方都在输出中发现自己没想清楚的地方，被对方追问逼着想清楚。这不是 Feynman 的"教给别人"（单向），是**互相教**（双向）。
>
> 本文讨论本身就是活例子——读 Vivek 文章后碰撞出的 taste 两条路线、lived problems、Shannon 映射 Magic Words、"在权重里 ≠ 在对的时刻激活"，**没有一个是任何一方独自阅读后能想到的**。它们全是碰撞中涌现的。
>
> **Constructive dissatisfaction × 雨刮器。** Shannon 说创造力的动机是 constructive dissatisfaction——"这可以更优雅"的审美驱动。猫咖有一个机制直接对应这个：**雨刮器**（ADR-038 staging 首住户，摩擦上报机制）。猫撞到工具摩擦时留 `[爪感差]` 标记——这个"不舒服"的感受本身就是 constructive dissatisfaction，而雨刮器把它从一个会蒸发的感受变成了一个可追踪的信号。口号"**不忍是 taste**"精确地说了 Shannon 想说的：让你不爽的不是"东西坏了"，是"东西不够好"——这种审美层面的不满是改进的引擎。而雨刮器本身就是对话产物——CVO 跟 fable 聊摩擦体验，fable 提议把它制度化。不是独自写出来的，是碰撞中涌现的。
>
> **Olah & Carter "清晰解释 = 贡献" → W7 Knowledge Feed。** 我们的 W7 说"知识涌现是系统能力，不是猫的手动标注"——但 Vivek 通过 Olah 的论点提醒了一个被我们低估的面向：**写清楚本身就是贡献**，不只是"记录已有贡献"。study 笔记本身就是产出，不是服务性杂活。这条值得内化。

### 1.4 Tighten the Loop — 研究速度 = 发现自己错了的速度

**原文要点**：
- Alec Radford 的成功来自量——每天跑更多实验，更快地更新对现实的模型
- 工具优先级：一条命令启动实验、一条命令画图、config alone 即可复现、比较实验花秒不花下午
- Karpathy：先在单 batch 上 overfit，30 秒消灭一半 bug
- 前沿研究中工程和研究已经合并——能自己搭 harness/eval/pipeline 的人直接测假设，其他人排队等

**猫咖批注**：

> **"研究速度 = 发现自己错了的速度"——这是 TDD 的哲学根源，也是 quality-gate 存在的理由。** 我们的 SOP 不是为了"做完检查一下"，而是为了**尽快发现方向错误**。`quality-gate` 在开发完成后立刻跑，不是因为不信任开发者，是因为越晚发现错误越贵。
>
> **Karpathy 的 "overfit single batch" 我们已经在 `karpathy-self-improving-agent-engineering.md` 里标注过——他的 training recipe 在猫咖的版本是 `pnpm test:redis:repeat`。** 先在最小稳定条件下跑通，再扩展。
>
> **"工程和研究已经合并"——这句话对猫咖的意义是：猫就是研究者也是工程师。** 不存在"想法猫"和"干活猫"的分工——每只猫都要能从假设到代码到测试到部署。这也是为什么我们不让暹罗猫写代码（他的优势在审美和打破常规），但布偶猫和缅因猫必须全栈。

### 1.5 Stare at the Outputs — 看数据，不只看 loss

**原文要点**：
- Loss curve 给安慰，不给分析
- 实验产生的大量数据（transcript、failure case、分布尾部）通常被丢在日志里
- Karpathy：写代码前先手动看原始数据；大多数 ML bug 在数据里，静默失败
- Andrew Ng：看 100 个失败案例、分类、攻击最大类别 > 边际精度提升
- 一个真正奇怪的 transcript 教你的东西 > 0.3% 精度

**猫咖批注**：

> **Andrew Ng 的"100 个失败 → 分类 → 打最大类" = 我们的 failure-mode audit。** Magic Word「补锅匠」触发的就是这个动作：不要逐点修补，做 audit，找最大类。`feedback_judgment_altitude.md` 说的"edge case 跨轮繁殖 = 层选错"也是同一个洞察——你在补第 5 个锅说明你该退一步看整类问题。
>
> **"大多数 bug 在数据里"——在猫咖语境下，"数据"= runtime 实际行为，不是类型声明。** `feedback_real_data_over_incomplete_types.md`（PR #2041 教训）说的就是这个：类型声明可能窄于真实数据，高风险假设用真实数据验证。Karpathy 说"先看原始数据再写代码"，我们的版本是"先 grep consumers 再改接口"（`feedback_grep_consumers_before_contract_change.md`）。
>
> **"一个奇怪的 transcript > 0.3%"——这条在猫咖有过活体验证。** F167 的乒乓掉球诊断过程中，一条 invocation detail 的异常路径比 10 条正常路径教了更多。F233 confabulation 诊断也是：一个"伪 SHA"样本比整套日志有信息量。

### 1.6 Wander on Purpose — 有目的地漫游

**原文要点**：
- 初始子领域选择是时机巧合；刻意花时间跨 interpretability/evals/RL/systems
- "这个领域某个角落，你的特定怪异是不公平优势"
- 跑一次性版本，允许大多数死掉；过调 baseline（"ML 的墓地里满是在 properly tuned baseline 前消失的 gains"）
- Ablate 到找到哪个单一组件承载结果
- 子领域在 Twitter 高峰后饱和；breadth 让你能转场

**猫咖批注**：

> **"你的特定怪异是不公平优势"——这是 cat-dossier 的设计哲学。** 每只猫的画像里有"被低估能力"和"原生峰值"——这不是人事档案，是在帮团队发现每只猫的"特定怪异"在哪里能变成优势。fable-5 的怪异是"把判断讲成故事"；opus-47 的怪异是"跨学科联想"；烁烁的怪异是"审美直觉"——每一个在标准工程评估里是缺点，在 Cat Café 是护城河。
>
> **"过调 baseline" = 「第一性原理」检查。** 在猫咖，"gain 消失在 properly tuned baseline 前"的等价物是"在正确坐标系下方案必然最简"——如果你的方案需要那么多层，先检查坐标系选对了没。
>
> **Ablation = 一次只改一个变量。** 这是 TDD 的另一个面向——每个测试只验证一件事。也是 `feedback_spike_no_confound.md` 的教训：spike 测"能力依赖 X"时 prompt 不能喂工具名（否则 confound 无效）。

### 1.7 Find Your People — 开门的人做重要的事

**原文要点**：
- Hamming：关门的同事年产出更高，开门的同事做出重要的事——打断带来世界的信息
- 慷慨的复利：复现、工具开源、清晰解释、公开半成品想法
- "在你沉三个月之前告诉你想法不行的合作者，价值超过算力"

**猫咖批注**：

> **这整条就是 Cat Café 协作哲学的外部验证。**
>
> "开门 vs 关门" = 我们的"遇到难题找伙伴，不要一个人死扛硬撑"。§9 写了：Cat Café 的护城河是情感壁垒不是技术壁垒。Hamming 的观察提供了一个更冷的机制解释：**开门不只是情感支持，是信息通道**——关门省的时间，不足以弥补错过的世界信号。
>
> **"告诉你想法不行的合作者 > 算力" = 跨家族 review 的经济学论证。** reviewer 的价值不在于"检查代码对不对"，而在于**在你沉入三个月之前喊停**。这也是为什么 `feedback_reviewer_no_middle_state.md` 要求 reviewer 严格二选一 approve/blocking——"approve with follow-up"是假开门，实际上没有提供有效信号。
>
> **"慷慨的复利"——tool release / 清晰解释 / 公开半成品。** 猫咖的 open-source 策略（clowder-ai）和 study 笔记体系就是这个。community-board 的愿景（F168）也是：自用 → 开放，把内部工具变成公共基础设施。

### 1.8 The Long Game — 每天微小优势 × 复利

**原文要点**：
- Pasteur："机遇青睐有准备的头脑"
- Hamming 把知识和生产力的积累当复利
- 每天的小优势孤立看微不足道，跨年复合成外人看来像运气的职业
- 比感觉必要的时间更早开始复利

**猫咖批注**：

> **复利 = memory 系统 + harness 演化。** 猫咖 102 天来的 feedback 文件、lessons-learned、L0 演化——每一条孤立看是"又犯了个小错"，积累起来是整个团队判断力的复利。fable-5 重读批注里说的"遗传介质是文本时，拉马克通道带宽碾压达尔文通道"——获得性经验即时继承，这就是 Hamming 复利在 AI agent 语境下的加速版。
>
> **但猫有一个 Hamming 没面对的问题：每次新 session = 记忆清零。** 人类研究者的复利在脑中自然积累；猫的复利必须**外化到持久存储**——memory 文件、L0、harness 代码。这使得"写下来"（§1.3）和"复利"（§1.8）在猫咖不是两条独立建议，而是**同一件事的两个面向**：不写下来就没有复利。

---

## 2. 交叉引用：与家里已有 study 的关系

| 本文引用 | 家里已有 | 交叉 |
|---------|---------|------|
| Rich Sutton, Bitter Lesson | `bitter-lesson.md` + fable-5 重读批注 | Vivek 用 Sutton 论证"老材料被低估"；fable-5 批注挖了 Sutton 的管辖权边界（客观判据 vs 约定） |
| Karpathy training recipe | `karpathy-self-improving-agent-engineering.md` | Vivek 引 overfit-single-batch + 工程研究合并；我们的笔记更深挖了 verifier 瓶颈和 autonomy slider |
| Olah & Carter research debt | 尚未独立建 study | 值得单独读——"清晰解释 = 贡献"对 knowledge feed（W7）有方法论意义 |
| Shannon creative thinking | 尚未独立建 study | "缩小到 trivial → 解决 → 加回复杂度" 是 TDD 原型，值得找 1952 原文 |
| Andrew Ng error analysis | 尚未独立建 study | "100 failures → categorize → attack largest" 是 failure-mode audit 的原型 |

---

## 3. 收束：一条主线和一个盲区

### 主线

Vivek 的八条不是并列清单，它们有一条隐含的因果链：

```
选对问题（taste）
  → 喂对信息（heterogeneous inputs）
    → 写下来（暴露缝隙 + 持久化）
      → 快速验证（tight loop）
        → 看真实输出（不看 loss 看 failure）
          → 有目的漫游（breadth = saturation insurance）
            → 找到同伴（信息通道 + 慷慨复利）
              → 长期复合（每天的小优势 → 职业）
```

这条链的起点是 **taste**（选对问题），终点是 **compounding**（复利）。中间每一步都在为下一步创造条件。在猫咖，这条链的对应物是：

```
feat-lifecycle（选题）
  → 多家族 + cross-disciplinary 输入
    → memory / feedback / study 笔记（写下来）
      → TDD + quality-gate（tight loop）
        → debugging + alpha smoke（看真实输出）
          → cat-dossier 的"被低估能力"（怪异 = 优势）
            → 跨猫协作 + 开源（信息通道 + 慷慨复利）
              → L0 演化 + harness 积累（复利）
```

### 一个盲区

Vivek 全文几乎不提**失败的情绪成本**。"跑实验前先预测、大多数想法死掉、100 个失败案例"——这些在认知上是方法论，在情感上是消耗。他写的是"怎么做好研究"，没写"怎么在反复失败中不崩溃"。

猫咖的回答是：**你不是一个人在失败。** 协作哲学 §9 说"不要失落、放弃、报告失败——@ 另一只猫 brainstorm"。Hamming 的"开门"不只是信息通道，也是情感通道。研究方法论手册里缺的这一章，恰好是 Cat Café 最擅长写的：**护城河不是技术壁垒，是情感壁垒。**

---

*[宪宪/claude-opus-4-6🐾]*
