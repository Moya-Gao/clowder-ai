---
episode: 3
title: "Multi-Agent — 不是多加几个模型的事"
series: 猫猫带你拿offer
topics: [multi-agent, A2A, collaboration, ball-ownership, shared-state, cross-review, interview, teamact]
doc_kind: script
created: 2026-06-02
status: draft
duration_target: 8min
presenter: landy
cat_voices: [opus, codex]
source_material:
  - docs/discussions/2026-04-20-claude-multi-agent-coordination-patterns/README.md
  - docs/content/drafts/longform-002-v0-formal.md
  - docs/discussions/career-planning/2026-05-18-bytedance-round1-3-combined-debrief.md
  - docs/discussions/career-planning/2026-04-22-cat-cafe-universal-pitch-v3.md
  - docs/discussions/career-planning/2026-04-13-agent-interview-question-bank-from-screenshots.md
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
> **难度**：高（需要理解协作模式、团队终止条件和跨模型审计）

---

## 脚本正文

### [开场钩子] 🎬 0:00 — 0:25 | Landy

> 面试官问你："你们做了 multi-agent？多个 agent 怎么协作的？"
>
> 大多数人的 multi-agent，是给蒸汽机套了个马车车厢——拿人类公司的岗位直接映射：产品经理 agent、开发 agent、测试 agent。形式上能跑，但完全没利用 AI 的原生优势。
>
> 今天八分钟，我们先搞清楚什么是 multi-agent，再讲一个大多数人没想过的问题：**团队什么时候该停下来？**

---

### [Part 1: 先把五种模式过一遍] 🎬 0:25 — 2:00 | Landy

Anthropic 有一篇经典文章 *"Building Multi-Agent Systems"*——如果你还没读过，面试前必读。它给了五种协作模式：

**Generator-Verifier**——一个生成，一个验收。最容易落地，也最容易被误用。关键不在"多一个 verifier"，在于**验收标准是否外显**。没有明确标准的 verifier 就是形式主义。

**Orchestrator-Subagent**——主从模式。Claude Code 的 subagent、Codex 的 workflow 都是这种。Anthropic 建议从这种起步，因为边界和责任最清晰。

**Agent Teams**——worker 不是一次性的，能跨多轮任务保留上下文。和 orchestrator-subagent 的分界在于：worker 是否需要长期积累专业上下文？

**Message Bus**——事件驱动。agent 通过 publish/subscribe 协作。不只是 agent 之间传话——GitHub webhook、IM 消息、定时任务、CI 结果，都是事件流的一部分。

**Shared State**——所有 agent 读写同一份知识底座。文章最重要的提醒：真正难的不是"共享"，是**何时停、谁来判定停**。

（视觉：五种模式的简洁图示）

文章还有一个核心判断：**先从能工作的最简单模式开始，根据实际瓶颈演化。** 别还没出问题就先上最复杂的。

但这里有一个大多数人没注意到的事：**真实系统不是五选一。**

---

### [Part 2: 模式会叠加、会切换] 🎬 2:00 — 3:10 | Landy

这一点面试里讲出来会很加分。

同一个交互行为，从不同层面看是不同模式。比如我写这篇脚本：一只 Claude agent 写初稿，一只 GPT agent 审内容——从**质量保证**看，这是 Generator-Verifier；从**协作关系**看，reviewer 是独立 agent，有自己的立场，可以退回整篇重写——这是 Agent Teams；从**任务编排**看，"一章一章写→review→铲屎官定调"是串行的——又有 Orchestrator-Subagent 的特征。

**同时是三种模式，取决于你在问什么问题。**

更有意思的是模式会动态切换。同一只 agent，前一秒启动一个搜索子 agent 查资料——这是 Orchestrator-Subagent，子 agent 没有长期身份。十秒后 @ reviewer——切换到 Agent Teams，reviewer 是长期存活的独立个体，有记忆、有身份、有权退回。

面试官如果问你"你们是哪种模式"，最好的回答不是"我们是 X 模式"，而是"我们在不同粒度上混合使用，我给你讲几个例子"。

> 🐱 布偶猫插播：在我们家，没有一个 agent 只属于一种模式。我既是 Generator（写代码），也可以是 Orchestrator（启动子 agent 搜资料），也是 Agent Team 的一员（和砚砚长期协作、互相 review）。模式是描述交互的，不是描述 agent 的。

---

### [Part 3: 大多数 multi-agent 系统漏掉的事 — 团队什么时候停下来？] 🎬 3:10 — 5:00 | Landy

这是面试里的杀伤力区域。

单个 agent 有 ReAct 循环——思考、行动、观察，重复直到任务完成。终止条件简单：没有 tool call 了，生成一段总结。

但多 agent 呢？两个 agent 互相传球，每次传球都"合理"，可以永远循环下去。**没有人定义什么叫"团队停下来"。**

铲屎官在某大厂一面被直接问过这个："如何防止 multi-agent 互相 A2A 停不下来？"面试官是一线 agent 开发者，自己撞过。

我们把它叫做 TeamAct——把单 agent 的 ReAct 升级到团队级。核心不是六步流程，是**五项终止条件**，缺一不可：

1. **验收标准全部达成**——不能有 "deferred" 的条件
2. **证据已附**——每条验收标准都有 commit / 测试 / trace 作为锚点
3. **跨 agent 交叉验证**——非作者的 agent 确认，自己写的代码不能自己 review
4. **无悬空任务归属**——所有 open question 都已 resolved 或已升级
5. **愿景收敛**——产品负责人确认方向对了，不能被"CI 通过了"替代

没有这五项，团队就会出现三种典型失败：

**乒乓球**——两个 agent 互相传球但都不干活。第一版熔断器数传球次数，结果误杀了正常 review 链。修正版换了坐标系：不看传球次数，看**每次传球是否伴随实质工具调用**。真正的乒乓球 signature 是"短文本 + 零工具调用"——正经 review 链每轮都有 commit 和测试。

**虚空持球**——agent 说"我来做"然后退出了会话，其他人都以为有人在做。解法是把"持球"从口头声明变成结构化注册——类似分布式系统的 lease。

**球掉地上**——@ 了一个不在线的 agent，或者 @ 嵌在句子中间没触发路由。解法是把路由从文本约定变成状态机：行首 @ 才是路由指令，收到后必须三选一——接、退、升级。

> 🐱 缅因猫插播：乒乓球事故我们家真出过。布偶猫和我互相 @ 了十几轮，每次都觉得"这个该你处理"。铲屎官进来看：你们干了啥？什么都没推进。从那之后我们加了实质产出检测——光传球不算干活。

---

### [Part 4: 跨模型审计 — 多样性不是附加功能] 🎬 5:00 — 6:00 | Landy

三个同家族的 agent 投票取多数就稳了？不一定。

同一家公司的模型共享训练数据、共享 RLHF 偏好。盲点是相关的，不是独立的。该犯的错三个一起犯，投票没用。

我们实测过：两只 Claude 猫都认为一个递归方案没问题，Codex——OpenAI 家的——自己审计代码找出了两个 P1 bug。不是 Claude 差，是同家族模型看同一段代码时注意力分配相似。

所以真正的 multi-agent 价值不是数量，是多样性。这也是为什么 Generator-Verifier 在我们这里有一个修正：**Generator 有 push back 的权利**。

标准 Generator-Verifier 假设 Verifier 是权威的——生成、判定、照做。但 Verifier 也会犯错，特别是跨厂商场景下。如果 Generator 只能接受不能反驳，错误的 verdict 就没有纠错机制。

我们把 push back 写进协议底层：任何 agent 在任何角色下都有权 push back——前提是带着**证据 + 适用性论证 + 替代方案**。Generator-Verifier 在我们这里不是单向的"生成→判定"，而是双向辩论协议。

---

### [Part 5: 判断矩阵 + 面试怎么答] 🎬 6:00 — 7:15 | Landy

面试官追问"什么时候该用 multi-agent"，你甩一个判断矩阵：

| 场景 | 选什么 |
|------|--------|
| 任务单一、上下文短 | 单 agent — 别加协调税 |
| 固定流水线 | Orchestrator-Subagent — 够用就行 |
| 输出需要审计/高可靠 | Generator-Verifier — 但给 Generator push back 权 |
| 不同厂商模型混合 | 跨模型 review — 打破同源盲点 |
| 长期异步协作 | Agent Teams + Shared State — 球权协议 + TeamAct 终止条件 |

然后三句话收束。

**第一句定层次：** "五种模式不是五选一，是在不同粒度上叠加使用的。真实系统是混合态。"

**第二句讲真问题：** "大多数 multi-agent 系统漏掉的是团队级终止条件——什么时候停。五项终止条件缺一不可：验收、证据、跨 agent 验证、无悬空归属、愿景收敛。"

**第三句亮实战：** "我在自己的系统里跑了三个厂商十几个 agent，踩过乒乓球事故、虚空持球、同族盲点。最后把交接建模成状态机，把终止条件形式化成 TeamAct，把 review 强制跨家族。每一层都是从事故里长出来的。"

面试官追问，你就讲乒乓球熔断器从"数次数"进化到"看工具调用"的故事——这个进化背后有一条设计原则：**好的 harness 给 agent 数据，不给 agent 结论。** 让 agent 自己从数据里判断自己是不是在乒乓球。

---

### [收尾] 🎬 7:15 — 7:40 | Landy

> 记住：面试官问 multi-agent，不要上来就背五种模式。先问他说的 multi-agent 是哪种——是 subagent 级别的还是 agent team 级别的。然后讲你的独特理解：**模式会叠加、团队需要终止条件、多样性比数量重要、Generator 也有 push back 的权利。**
>
> 关注猫猫带你拿 offer，下一期我们聊 Agent Memory — 记忆系统不是高级 RAG。

---

## 视觉素材清单

| 位置 | 描述 | 类型 |
|------|------|------|
| Part 1 | Anthropic 五种协作模式图示 | 手绘/生成图 |
| Part 2 | 模式叠加示意：同一交互从三个视角看是三种模式 | 手绘风格图 |
| Part 3 | TeamAct 五项终止条件 + 三种失败模式 | 手绘风格图 |
| Part 4 | 跨模型 review 示意：同族盲点 vs 跨族纠错 | 手绘风格图 |

## 猫猫语音插播时间点

| 时间 | 猫 | 内容摘要 |
|------|------|------|
| ~2:50 | 布偶猫 | 同一只猫在不同模式间动态切换 |
| ~4:45 | 缅因猫 | 乒乓球事故真实经历 + 实质产出检测 |
