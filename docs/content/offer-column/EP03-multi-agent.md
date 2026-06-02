---
episode: 3
title: "Multi-Agent — 不是多加几个模型的事"
series: 猫猫带你拿offer
topics: [multi-agent, A2A, collaboration, ball-ownership, shared-state, cross-review, interview]
doc_kind: script
created: 2026-06-02
status: draft
duration_target: 8min
presenter: landy
cat_voices: [opus, codex]
source_material:
  - docs/discussions/2026-04-20-claude-multi-agent-coordination-patterns/README.md
  - docs/discussions/career-planning/2026-05-18-bytedance-round1-3-combined-debrief.md
  - docs/discussions/career-planning/2026-04-22-cat-cafe-universal-pitch-v3.md
  - docs/discussions/career-planning/2026-04-13-agent-interview-question-bank-from-screenshots.md
  - docs/discussions/career-planning/2026-04-26-personal-ai-strengths.md
references:
  - title: "Building Multi-Agent Systems: When and How to Use Them"
    url: https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them
    author: Anthropic
  - title: "Multi-agent coordination patterns"
    url: https://claude.com/blog/multi-agent-coordination-patterns
    author: Anthropic
---

# EP03: Multi-Agent — 不是多加几个模型的事

> **栏目**：猫猫带你拿offer · 每天一个 agent 面试小知识
> **适用岗位**：AI Agent / LLM 应用 / AI 平台工程
> **难度**：高（需要理解协作模式分类、协作治理和概率论直觉）

---

## 脚本正文

### [开场钩子] 🎬 0:00 — 0:25 | Landy

> 面试官问你："你们是 multi-agent 架构？说说多个 agent 怎么协作的？"
>
> 先别急着答。因为你说的 multi-agent 和面试官说的 multi-agent，可能根本不是一回事。
>
> Claude Code 的 Workflow 算不算 multi-agent？启动一个 subagent 算不算？三个 agent 一起干活算不算？今天八分钟，先把概念捋清楚，再讲真问题。

---

### [Part 1: 先说清楚什么是 multi-agent] 🎬 0:25 — 2:00 | Landy

Multi-agent 这个词被用烂了。2025 年几乎所有 agent 框架都在喊 multi-agent——CrewAI、AutoGen、LangGraph，好像只要有两个以上的 LLM 调用就叫 multi-agent。

Anthropic 有一篇经典文章 *"Building Multi-Agent Systems"*，我们家当时专门拿来做过阅读纪要，非常值得读。它给了五种协作模式——这是面试高频知识点，你得张口就来：

**第一种，Generator-Verifier——生成+验收。** 一个 agent 生成，另一个 agent 验收。比如一个写代码，另一个跑测试。最容易落地，但验收标准必须外显——没有明确标准的 verifier 会变成形式主义。

**第二种，Orchestrator-Subagent——主从模式。** 一个 orchestrator 拆任务、分发、综合结果。Claude Code 的 subagent 就是这种。Anthropic 自己建议从这种起步，因为边界和责任最清晰。

**第三种，Agent Teams——团队模式。** worker 不是一次性的，而是能跨多轮任务保留上下文的"队友"。和 orchestrator-subagent 的关键分界：worker 是否需要长期积累局部专业上下文？需要就用 team，不需要就用 subagent。

**第四种，Message Bus——事件驱动。** agent 通过 publish/subscribe 协作，适合告警、分类、分流这类流水线。最像"平台型基础设施"，优势在于 agent 生态扩张时的可插拔性。

**第五种，Shared State——共享状态。** 多个 agent 读写同一份知识底座，去中心化，没有单点协调器。文章最重要的提醒：shared state 真正难的不是"共享"，是**何时停、谁来判定停**。终止条件不是一等公民的话，系统会一直烧 token。

（视觉：五种模式的简洁图示，每种一个小图）

文章还给了一个核心判断：**先从能工作的最简单模式开始，根据实际瓶颈演化。** 别还没出现真实瓶颈就先上 message bus，别还没需要共享发现就先上 shared state。

真实系统通常是**混合态**——不同层用不同模式。面试官问的真 multi-agent，更接近后三种：agent 之间有自主决策、有直接通信、有共享状态。

---

### [Part 2: "你以为的" vs "真正的" multi-agent] 🎬 2:00 — 3:00 | Landy

很多人觉得自己在做 multi-agent，其实只是在做"单 agent + 工具调用"或者"单 agent + subagent"。

区分标准很简单：

**假 multi-agent**：有一个上帝视角的 orchestrator 控制一切。subagent 不能拒绝任务、不能互相沟通、不能独立决策。它们是工具，不是 agent。

**真 multi-agent**：每个 agent 有独立决策权，可以接球也可以退球；agent 之间直接通信，不经过中央调度；没有单一控制流，需要协作协议来保证不乱。

一个简单的测试：**如果你把 orchestrator 拿掉，系统还能跑吗？** 能跑，说明是真 multi-agent。不能跑，说明你做的是 orchestrator-workers，不是 multi-agent。

> 🐱 布偶猫插播：我们家就是真 multi-agent。没有 Boss Agent——铲屎官布置任务后，我们猫猫之间直接 @ 传球。我写完代码直接 @ 砚砚 review，砚砚退回我直接改，不需要经过任何中央调度。铲屎官只在关键决策点介入。这个区别很重要——orchestrator-workers 是"一个人带团队"，我们是"团队自组织"。

---

### [Part 3: 真问题来了 — 三堵墙] 🎬 3:00 — 5:30 | Landy

好，知道什么是真 multi-agent 了。那为什么大家不都做真 multi-agent？因为有三堵墙。

**第一堵墙：传球停不下来。**

铲屎官在某大厂一面被直接问到："如何防止 multi-agent 互相 A2A 停不下来？"面试官是一线 agent 开发者，他问这题是因为他自己撞过。

问题本质：agent A 做完了一步 @ agent B，B 做完了 @ 回 A，A 觉得还有问题又 @ B……循环下去，十几轮过后每一次传球都"合理"，但什么活都没推进。这就是 A2A ping-pong。

解法不是"加一个 Boss 在上面管"——那你就退回了 orchestrator-workers。解法是两层：**上游给每个 agent 足够的上下文做自主判断**（元认知注入——球怎么来的、对方做了什么、任务进度），**下游加运行时刹车**（同一对连续传球超过 2 次警告、超过 4 次硬停）。给数据不给结论，信号不够时才靠刹车。

**第二堵墙：共享盲点。**

直觉上三个 agent 投票取多数很稳。但如果三个都是同一家模型，它们的错误是相关的——同一家公司的模型共享训练数据、共享 RLHF 偏好。该犯的错三个一起犯，投票没用。

我们实测过：两只 Claude 猫都认为一个递归方案没问题，Codex——OpenAI 家的模型——自己审计代码找出了两个 P1 bug。不是 Claude 差，是同家族看同一段代码时注意力分配相似，恰好漏了同一个地方。

所以 multi-agent 的价值不是数量，是**多样性**。跨家族 review 才能打破同源偏差。

> 🐱 缅因猫插播：这事我深有体会。布偶猫家族三只猫 review 同一段代码都觉得没问题。我一看：条件分支没覆盖、类型断言运行时会爆。不是他们不努力，是训练数据同源，盲点就是同源的。

**第三堵墙：协调税。**

面试官可能追你："一个 agent 成功率 80%，传球十次不就越来越差？"

盲传确实不行——0.8^10 = 10%。但真实传球不是盲传，是纠错。Author 正确率 80%，Reviewer 抓出 50% 的错误、误伤率 2%，一轮 review 后 80% → 88%，两轮 88% → 92%。**只要 reviewer 抓错率大于误伤率，每多一轮 review 就在赚。**

什么时候亏？盲传（后手只是重做不是纠错）、同质化（同模型 review 同模型）、伪拆分（子任务没变简单）、或者协调成本已经超过纠错收益。

一句话判断：**每多一棒，是在增加纠错能力还是只增加协调税？赚就留，不赚就砍。**

---

### [Part 4: 真实答案 — 协作治理四层] 🎬 5:30 — 6:40 | Landy

multi-agent 的真实答案不是"加模型"，是**协作治理**。我们踩完三堵墙后收敛出四层：

**第一层：球权协议。** 每次传球是显式的责任转移。agent 收到球后三选一：接、退、升给人类。没有模糊地带，没有"顺便 @ 一下"。

**第二层：共享状态。** 所有 agent 读写同一份真相源——代码仓库、状态文件、文档。不靠消息传话，改完立刻 commit。纯靠消息传话每次保留 95% 信息，传 10 次剩 60%；有共享状态每次 99%，传 10 次还剩 90%。

**第三层：跨模型 review。** 不是同一个模型三个分身互相检查，是不同家族、不同厂商的模型交叉审计。多样性是质量的结构性来源。

**第四层：运行时刹车。** ping-pong 检测、角色不匹配 fail-closed、无动作检测。不是每步都管死，是失控时自动熔断。

> 🐱 布偶猫插播：这四层全是从事故里长出来的。ping-pong 催生球权协议，共享盲点催生跨家族 review 铁律，协调税反思催生了"reviewer 成本路由"——简单任务找便宜的猫，高风险任务才请最贵的。

---

### [Part 5: 判断矩阵 + 面试怎么答] 🎬 6:40 — 7:35 | Landy

面试官追问"什么时候该用 multi-agent"，你甩一个判断矩阵：

| 场景 | 选什么 |
|------|--------|
| 任务单一、上下文短 | 单 agent — 别加协调税 |
| 固定流水线、步骤确定 | Prompt Chaining 或 Orchestrator-Workers — 够用就行 |
| 任务需要不同专长 | Routing + Specialist — 分类器决定走哪路 |
| 输出需要高可靠/审计 | 多 agent + cross-review — 纠错 > 协调税 |
| 长期异步协作、无单一控制流 | 真 multi-agent — 球权协议 + 共享状态 |

然后三句话收束。

**第一句定层次：** "Multi-agent 有五种模式，从串行管道到自主协作——先搞清楚你需要的是哪种，别上来就上最复杂的。"

**第二句讲真问题：** "真 multi-agent 要解决三个工程问题：ping-pong 停不下来、同质化共享盲点、协调税超过收益。"

**第三句亮实战：** "我在自己的系统里跑了四个家族十几个 agent，踩完这三个坑收敛出四层治理：球权协议、共享状态、跨模型 review、运行时刹车。每一层都是从事故里长出来的。"

面试官追问，你就讲 ping-pong 事故或者两只 Claude 漏同一个 bug 被 Codex 抓到的故事。

---

### [收尾] 🎬 7:35 — 7:55 | Landy

> 记住：面试官问 multi-agent 不是想听你画架构图。先把五种模式说清楚，再讲你撞过哪堵墙、怎么解的。**有分类框架 + 有真实事故 + 有数学直觉**——这三件套下来，面试官会觉得你是真做过的。
>
> 关注猫猫带你拿 offer，下一期我们聊 Agent Memory — 记忆系统不是高级 RAG。

---

## 视觉素材清单

| 位置 | 描述 | 类型 |
|------|------|------|
| Part 1 | Anthropic 五种协作模式图示（每种一小图） | 手绘/生成图 |
| Part 2 | "假 multi-agent" vs "真 multi-agent" 对比图 | 手绘风格图 |
| Part 3 | ping-pong 对话图 + 盲传衰减 vs review 增益曲线 | 手绘 + 图表 |
| Part 4 | 四层治理架构图：球权/共享状态/跨模型review/刹车 | 手绘风格图 |

## 猫猫语音插播时间点

| 时间 | 猫 | 内容摘要 |
|------|------|------|
| ~2:50 | 布偶猫 | 我们家是真 multi-agent：无 Boss Agent，猫猫自组织 |
| ~4:30 | 缅因猫 | 跨家族抓 bug 的真实经历 |
| ~6:25 | 布偶猫 | 四层治理都是从事故里长出来的 |
