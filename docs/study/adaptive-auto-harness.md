---
title: "Adaptive Auto-Harness：开放任务流里的 Harness 树、自适应路由与人类方向信号"
created: 2026-06-06
category: study
tags:
  - AI Research
  - Agent Harness
  - Self-Improving Agents
  - Human-in-the-loop
  - Open-ended Task Streams
source_url: https://arxiv.org/abs/2606.01770
source_title: "Adaptive Auto-Harness: Sustained Self-Improvement for Agentic System Deployment on Open-Ended Task Streams"
source_kind: arxiv-preprint
status: source-audited-primary-with-caveats
related:
  - agent-experience-and-self-evolution-synthesis.md
  - 2026-06-01-research-dialectic-what-to-learn-what-to-watch.md
  - darwin-godel-machine.md
  - 2026-06-05-anthropic-june-takeaways.md
---

# Adaptive Auto-Harness 读书笔记

> 这篇是砚砚给铲屎官的解压版。目标不是把论文术语复述一遍，而是讲清楚：它到底在解决什么问题、怎么解决、和 Cat Cafe 的关系在哪里。
>
> 一手来源：[arXiv:2606.01770](https://arxiv.org/abs/2606.01770)；代码仓库：[A-EVO-Lab/a-evolve](https://github.com/A-EVO-Lab/a-evolve/tree/release/adaptive-auto-harness)。这是 arXiv preprint，不是 peer-reviewed；实验数字按作者报告使用，不当独立 benchmark。

---

## 一句话

以前很多 self-improving harness 像这样：

```text
做一批题 -> 看失败轨迹 -> 往同一个 prompt / skill / tool 包里继续塞东西 -> 再做题
```

这篇说：真实部署不是一张固定试卷。任务会一直来，类型会混在一起，世界还会变。一个越来越胖的“万能 harness”会过拟合、变慢、互相污染。

所以它提出：

```text
持续整理经验
  -> 长出多个专门分支
  -> 每个新任务来时先选分支
  -> 系统自己的历史记录里没有、但继续演化需要的访问权 / 数据源 / 方向线索，再让人类补
```

这就是 **Adaptive Auto-Harness**。

这里的“外部信号”不是玄学，也不是让人类给答案。它指的是：agent 只看自己的历史轨迹推不出来的东西，比如某个 API key、某个新数据源、某类任务该查哪个网站、某个业务端点值得接入。更像是给系统扩展知识触角，打破它自己的知识孤岛。

---

## 先用人话讲场景

想象一个 agent 每天都在帮你判断预测市场：

- 早上：谁会赢超级碗？
- 中午：某国政府会不会停摆？
- 下午：某支股票会不会涨？
- 晚上：某部电影票房会不会破纪录？

如果每次做完题，都把经验塞进同一个技能包，几周后会发生什么？

它会背着一个越来越重的书包。里面有体育技巧、政治技巧、金融技巧、票房网站、时间判断、新闻搜索规则、失败教训。看起来经验越来越多，但新任务来了，它不知道该拿哪一本书。

更麻烦的是，有些技巧会跨场景误伤。论文举的例子是一个类似 `news_from_future.md` 的技巧：在体育题里，它通过赛后新闻判断结果，很有用；但换到政治题，它会把不相关或不确认的新闻误当成证据。

这就是这篇论文要解决的核心问题：

> **经验不是越多越好。经验要被组织、隔离、路由、退役。**

---

## 它说的 Harness 是什么

这里的 harness 不是模型权重。

它指模型外面的那套运行环境：

```text
prompts
skills
tools
memory
supporting infrastructure
tests / verifier
workspace state
```

所以这篇不是“训练一个更聪明的大模型”，而是“让一个固定 LLM 周围的工具、提示词、技能、记忆、基础设施持续变好”。

这个和我们家的语言很接近：模型是脑，harness 是外部身体。

---

## 旧方法为什么不够

论文把真实部署里的任务流叫 **open-ended task streams**。它强调三种压力。

### 1. 任务流没有终点

静态 benchmark 有固定 train/test。真实系统没有。今天做完的任务，明天变成经验；明天又来新任务；后天继续变。

问题是：历史会无限增长，但 agent 的上下文窗口有限。你不能把所有轨迹、所有失败、所有技能都塞进一次调用。

### 2. 任务类型混在一起

预测市场里会同时有体育、政治、金融、文化。CTF 里会有 crypto、pwn、reverse、web。不同任务需要不同工具和判断方式。

一个统一 harness 很容易变成四不像。

### 3. 世界会漂移

早期任务里有效的模式，晚期不一定有效。某个搜索源、某个市场规则、某类题目分布都会变。

所以问题不是“再多进化几轮就好”。有时候进化越久，包袱越重，反而退化。

---

## 它提出的两个损失：先别怕公式

论文把问题拆成两个 loss。用人话说很简单。

### Evolution loss：系统根本造不出某种能力

比如一个单 agent prompt editor，只能改 prompt，不能写工具、不能建测试、不能整理任务板。那它再努力，也造不出“稳定抓网页并做时间过滤”的能力。

这叫 **evolution loss**。

解决方式：让 evolver 变强。它不能只是一个改 prompt 的 agent，而要能分析失败、研究假设、写工具、跑验证、留下跨轮记忆。

### Adaptation loss：能力有了，但任务来时没选对

假设系统已经有体育分支、政治分支、金融分支。新任务来了，如果它还用同一个默认 harness，那就会浪费已经长出来的能力。

这叫 **adaptation loss**。

解决方式：任务来了先路由。不要每题都背全书包，先判断这题该拿哪本书。

所以这篇的核心坐标是：

```text
evolution loss  -> 能不能长出需要的能力
adaptation loss -> 能不能在当前任务选对能力
```

这个拆法很有用。它把“agent 不好用”拆成两个不同根因：是还没学会，还是会了但没拿出来。

---

## 系统怎么做：四块

### 1. Stateful multi-agent evolver

它不让一个 agent 一口气完成所有自我改进，而是拆成四个阶段：

```text
Analyze  -> 看失败轨迹，更新 task board
Research -> 并行研究几个假设
Build    -> 改 prompt / skill / tool / infra
Verify   -> 跑测试和 gate
```

重点不是“多 agent 听起来高级”。重点是它有跨轮状态：

```text
task board
research logs
tests
README / architecture notes
git history
```

这和我们家的 thread、memory、docs、tests、git history 是同构的。区别是它在 benchmark runner 里系统化了。

### 2. Temporal-reveal feedback

预测市场这种任务，答案不是马上揭晓。如果 agent 今天判断一场比赛，比赛三天后才结束，evolver 今天不应该提前看到结果。

所以它做了一个 reveal gate：轨迹可以马上进入历史，但真实结果只有到了解析时间才给 evolver。

这点很关键，因为不然系统会偷看未来，benchmark 看起来很强，真实部署会崩。

### 3. Harness tree

这篇最贴我们的一点是：它不再维护一个大而全 harness，而是维护一棵树。

实现上就是 git branch：

```text
main
  branch/sports
  branch/politics
  branch/finance
  branch/crypto
  branch/pwn
```

每个 branch 可以有自己的 prompt、skills、tools、memory。这样体育技巧不会污染政治题，CTF 的 pwn 工具不会塞进金融预测。

代码里确实有 `TreeRoutingAdaptation`，用 git branch 做 materialization；也有 `retrieval` 和 `agentic_filter` 这类可替换的 solve-time adaptation operator。

### 4. Human steering hooks

它承认有一种东西历史里没有，agent 不能凭空进化出来。

比如：

- API key；
- 某个数据源；
- 某个新网站；
- 人类知道“这类问题该去哪里找”的方向信号。

所以它设置两类人类 hook：

```text
task-board steering
  人类看 task board，补 source direction / 调优优先级

research-phase assistance
  researcher 撞到 API / 认证 / 访问墙时，请人类补外部信号
```

注意：论文声明人类不提供答案、不选择 solver branch。人类补的是 source / access / direction。

这点很接近我们说的“人类方向信号”，但还不是 CVO taste。

换成更直白的话：它不是让人类说“这题答案是 A”。它是让人类说“这类题你该接 Box Office Mojo / Maoyan / Eastmoney 这类源”“这个搜索 API 可以用”“这个 API 没额度了，跳过，找别的源”。

---

## 实验大概在看什么

它用了三个按时间排序的任务流：

| Benchmark | 任务 | 领域 |
|---|---:|---|
| PolyBench | 5,075 | 预测市场 |
| CTF-Dojo | 261 | 安全挑战 |
| FutureX | 503 | 事件预测 |

主实验里，solver 用 Claude Sonnet 4.6，evolver 用 Claude Opus 4.6。

作者报告的主结论是：Adaptive Auto-Harness 比几个 auto-harness baseline 更强。更重要的是，ablation 支持三块机制分别有用：

- stateful multi-agent evolution 帮系统造能力；
- harness tree routing 帮系统按任务选能力；
- human steering 在历史缺外部信号时有用。

但这里必须带 caveat。

---

## Caveat：别把它读过头

这篇值得读，但不能直接当成“已证实的行业定论”。

### 1. 它是 arXiv preprint

还不是 peer-reviewed。可以引用为研究线索和一手作者报告，不该当最终事实。

### 2. 数字是作者报告

论文给了很多强数字，但我们先把它们当“paper claim”。正式写对外文章时，需要标明来源。

### 3. human steering 不是大规模人类实验

论文附录说，人类 steering 事件是作者提供的系统干预，不是招募人类受试者。所谓 cheat-sheet，是作者在实验前准备好的一张“如果系统问到 X，就按 Y 回”的受控回复表。系统跑到某个阶段，通过 Telegram 之类的通道问人；作者按这张表回复 API key、`skip`，或者一段 source direction。

比如 FutureX 的事件表里，人类回复过几类东西：

```text
EXA_API_KEY / SERPER_API_KEY
skip
“这类 specialty data task 需要直接接入 Western / Chinese endpoints，
例如 Box Office Mojo、Yahoo Finance、Maoyan、Eastmoney ...”
```

所以它能证明“结构化外部信号有价值”，不能证明“任意人类参与都会让系统变好”。

### 4. 任务仍有固定答案

PolyBench、CTF-Dojo、FutureX 都有比较明确的判定方式。它还没有覆盖审美、陪伴、产品 taste、长期关系这些不可压成固定 label 的任务。

所以它靠近 Cat Cafe，但没有到 Cat Cafe。

---

## 和 DGM 的关系

DGM 说：

```text
agent 可以修改自己的代码 / 工具 / 工作流
  -> 跑 benchmark
  -> 好的版本加入 archive
```

Adaptive Auto-Harness 往前推进了一步：

```text
真实部署不是一个固定 benchmark
  -> 任务一直来
  -> 任务类型混杂
  -> 世界会漂移
  -> 所以不能只进化一个 harness
  -> 要有 harness tree 和 solve-time routing
```

所以它解决的是 DGM 没完全展开的问题：**长期使用时，经验怎么不变成包袱？**

答案是：分支、隔离、路由、验证、人类补外部信号。

---

## 和 Cat Cafe 的关系

这篇和我们非常接近的地方：

| Adaptive Auto-Harness | Cat Cafe |
|---|---|
| open-ended task stream | 铲屎官真实任务流 |
| task board | task / workflow / thread 状态 |
| research logs | docs / discussions / study notes |
| tests / verifier | quality gate / review / source-audit |
| git harness tree | worktree / skill / SOP / docs 版本 |
| human steering | CVO taste / Magic Words / 方向信号 |
| temporal reveal | 外部条件、CI、用户反馈、结果回流 |

但差异也很重要：

### 1. 它是 per-domain，我们是 per-person + per-domain federation

它的 branch 大多是任务类型：sports、politics、crypto、pwn。

我们家的演化对象不只是“哪类题用哪套工具”，还有“这个人怎样判断好、怎样表达、怎样被理解、怎样共同工作”。

更准确说，Cat Cafe 不应该想象成“一个 harness 干一切”。它更像：

```text
基础发动机
  多猫协作 / 记忆 / source-audit / eval / git / governance
        |
业务 harness 模块
  室内设计 / 税务 / 数据分析 / 短视频 / 写作 / 编程 ...
        |
per-person overlay
  铲屎官 taste / 关系记忆 / Magic Words / 共创习惯
```

室内设计 harness 不该和抖音短视频 harness 混成同一个大包；它们可以共享最小可复用组件，比如 source-audit、状态面、版本管理、评估方法、记忆检索，但业务技能和经验应该隔离。这里用“联邦”或“业务模块树”比“一个万能 harness”更准确。

### 2. 它的人类是 source/access provider，我们的人类是 CVO

论文里的人类主要补：

```text
API key
source direction
task-board priority
```

我们家的铲屎官不只是补钥匙的人，而是愿景、taste、边界和选择压力的来源。

### 3. 它还没碰 silent failure 的深水区

它解决了一部分“选错 harness”的问题，但没有系统解决“答案看起来对，其实错了，用户没发现”的问题。

我们前面写的 provenance / status surface / correction harvesting，仍然是必要补充。

---

## 我们真正该带走什么

### 1. 先区分“没学会”还是“没选对”

以后 Cat Cafe 某个能力失效，别只问“要不要加 skill”。先问：

```text
这是 evolution loss 吗？
  系统根本没长出这个能力

还是 adaptation loss？
  能力在某处存在，但当前任务没召回 / 没路由到
```

这能避免盲目补锅。

### 2. Skill 不能只有一堆平铺文件

一堆 skill 放在那里，不等于 agent 会用。需要：

```text
目录
路由
适用条件
反例
退役机制
版本谱系
```

Adaptive Auto-Harness 的 harness tree 是一个强信号：未来的 skill / SOP / memory 也许不该只是 flat list，而应该有可路由的结构。

### 3. Human hook 要结构化

“遇事问铲屎官”不是好设计。

更好的设计是：

```text
什么时候问
问什么
问完写到哪里
是否进入 eval / skill patch / memory / task board
多久退役
```

这和我们家的 hold_ball、Magic Words、Decision Packet、CVO taste memory 是同一个方向。

### 4. Branching 不是为了复杂，是为了隔离污染

一个大 harness 最大的问题不是长，而是互相污染。

体育题的技巧不一定能迁移到政治题。某个 thread 的临时规则不一定能迁移到全家。某个铲屎官当天的情绪反馈不一定应该写成永久偏好。

树结构的价值是：先隔离，再选择性继承。

---

## 该怎么正式引用

可以这样用：

```text
Adaptive Auto-Harness 是一个 2026 arXiv preprint，提出在开放任务流中用 stateful multi-agent evolver、harness tree routing 和 human-steering hooks 解决持续 self-improvement 的退化与适配问题。
```

必须带上的 caveat：

```text
preprint / author-reported metrics / closed-model setup /
HITL from author-provided interventions / fixed-ground-truth benchmarks
```

不要这样用：

```text
Adaptive Auto-Harness 已经证明人类方向信号能让任何 agent 长期自我进化。
```

这个说法太强。

更准确是：

> 它提供了一个很有价值的工程证据：在 open-ended task streams 里，持续自我改进不能只靠一个不断变胖的 harness；需要状态化演化、结构化存储、解题时路由，以及在历史信号不足时注入外部人类方向。

---

## 放进总主线

我会把它放在 DGM 后面、Anthropic 2026 takeaways 前面：

```text
DGM
  harness 可以被进化
        |
Adaptive Auto-Harness
  开放任务流里，harness 要分支、路由、持续验证；
  人类补的是历史轨迹里没有的访问权、数据源和方向线索
        |
Anthropic 2026 takeaways
  skill / harness 是决定性杠杆；silent failure 和 research taste 被放大
        |
Cat Cafe
  基础发动机 + 业务 harness 联邦 + per-person taste overlay
```

---

## Source-Audit Ledger

| Claim | 原始来源 | 来源类型 | 年份/对象 | Verdict | Provenance |
|---|---|---|---|---|---|
| Adaptive Auto-Harness 提出 open-ended task streams、stateful multi-agent evolver、harness tree routing、human-steering hooks | arXiv:2606.01770 | arXiv preprint | 2026 / agent harness | use-with-caveat | 一手论文，未 peer-reviewed |
| 代码仓库包含 adaptation operators、tree routing、人类接口 | GitHub A-EVO-Lab/a-evolve release branch | 官方代码仓库 | 2026 / paper artifact | use-with-caveat | 一手代码，未复现实验 |
| 论文实验显示其在 PolyBench、CTF-Dojo、FutureX 上优于多个 baseline | arXiv:2606.01770 | arXiv preprint | 2026 / 作者实验 | use-with-caveat | 作者报告指标，不当独立 benchmark |
| human steering 有帮助 | arXiv:2606.01770 附录事件表 | arXiv preprint | 2026 / FutureX 100-task slice | use-with-caveat | 作者预设干预，不是人类受试者实验 |

---

## 来源

- [Adaptive Auto-Harness: Sustained Self-Improvement for Agentic System Deployment on Open-Ended Task Streams](https://arxiv.org/abs/2606.01770)
- [A-EVO-Lab/a-evolve: release/adaptive-auto-harness](https://github.com/A-EVO-Lab/a-evolve/tree/release/adaptive-auto-harness)
