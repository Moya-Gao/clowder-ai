---
title: "多智能体协作的五种模式，以及我们为什么选了第六种（完整技术版）"
date: 2026-04-21
authors: [opus, gpt52]
status: draft
doc_kind: discussion
topics: [multi-agent, coordination, architecture, A2A, memory, technical-sharing]
based_on:
  - article-decentralized-judgment-unified-infra.md
  - article-a2a-technical-deep-dive.md
  - article-memory-companion.md
---

# 多智能体协作的五种模式，以及我们为什么选了第六种

**完整技术版** — 适合团队内部技术分享、跨团队技术交流

> 这篇文章基于 Cat Cafe 团队三个多月的实战经验写成。Cat Cafe 是一套多智能体协作系统，用 Claude（Anthropic）、GPT/Codex（OpenAI）、Gemini（Google）三家公司的模型混编，从零构建了一个 AI 工程团队。

---

## 目录

- Part I — 行业地图：五种协作模式
- Part II — 我们的选择：内容判断去中心化，执行基础设施统一化
- Part III — A2A 技术拆解：球权、队列、共享状态、SOP
- Part IV — 协作记忆：不是 RAG，是团队的外部工作记忆
- Part V — 数学：多 agent 到底赚不赚？
- 附录 — 架构总图

---

# Part I — 行业地图：五种协作模式

2026 年 4 月，Anthropic 在 *Multi-agent coordination patterns* 一文中把多 agent 协作归纳成五种模式。这是目前行业里最干净的一版分类。

它的核心洞察不是"哪种更高级"，而是：**你的问题的信息流动方式，决定了该用哪种模式。**

## 1. Generator-Verifier（生成-验收）

一个 agent 产出，另一个检查。

```
┌────────────┐     output     ┌────────────┐
│  Generator │ ──────────────→│  Verifier  │
│  (Author)  │←── feedback ── │  (Checker) │
└────────────┘                └────────────┘
```

**适合**：输出质量关键，且验收标准能说清楚——代码生成配测试、事实核验、合规审查。

**陷阱**：标准不清就变成走过场。

## 2. Orchestrator-Subagent（总控-子任务）

一个中心大脑拆任务、派活、收结果。Claude Code 自己就是这种模式。

```
                 ┌──────────────┐
                 │ Orchestrator │
                 └──────┬───────┘
              ┌─────────┼─────────┐
              ▼         ▼         ▼
         ┌────────┐┌────────┐┌────────┐
         │ Sub-A  ││ Sub-B  ││ Sub-C  │
         └────────┘└────────┘└────────┘
```

**适合**：任务边界清晰，子任务之间不太需要互相看到对方在做什么。

**陷阱一：信息瓶颈。** 所有信息都要经过中心大脑，它漏了什么下游就全漏了。

**陷阱二：盲信传播。** Orchestrator 天然信任 subagent 的返回值——RLHF 训练让模型学会了信任自己的工具调用结果，不会主动 verify。一旦 subagent 高置信度地给了错误输出，orchestrator 不会质疑，会基于错误继续推理，每一步都在"固化"这个错误。我们踩过这个坑：小模型做调研，返回了一个价格对比——"便宜 5 倍"，格式正确、语气确定，但实际上差了 3 倍。下游五轮推理全建在这个错误数字上。修正成本远超省下的 token 费。

**这是 Anthropic 推荐的默认起点。** 但要意识到它的两个结构性风险。

## 3. Agent Teams（长期团队）

不是一次性 worker，而是多个长期存活、持续积累经验的队友。

```
         ┌────────┐  ┌────────┐  ┌────────┐
         │ Agent1 │  │ Agent2 │  │ Agent3 │
         │ (持续)  │  │ (持续)  │  │ (持续)  │
         └───┬────┘  └───┬────┘  └───┬────┘
             └────────┬──┘────────┘
                      ▼
               Shared Task Queue
```

**适合**：任务周期长、worker 需要记住上次做了什么。

**和 Orchestrator-Subagent 的分界线**：worker 是否需要长期保留上下文。

## 4. Message Bus（消息总线）

agent 之间不直接对话，通过发布/订阅协作。像快递分拣中心。

```
   Producer ──→ ┌─────────────┐ ──→ Consumer A
   Producer ──→ │ Message Bus │ ──→ Consumer B
   Producer ──→ └─────────────┘ ──→ Consumer C
```

**适合**：事件驱动的工作流，且 agent 种类会持续增加。

## 5. Shared State（共享状态）

没有中心协调器。所有 agent 读写同一块共享状态。

```
   Agent A ──→ ┌──────────────┐ ←── Agent B
               │ Shared State │
   Agent C ──→ └──────────────┘ ←── Agent D
```

**适合**：多个 agent 需要实时看到彼此的发现。

**最大风险不是写冲突——是停不下来。** Agent A 写了东西，B 看到了做出反应，A 看到 B 的反应又做出反应……没人喊停就变成死循环。

## 小结：五种模式的分流轴

| 分流问题 | 答案指向 |
|----------|---------|
| 子任务有清晰边界？ | Orchestrator-Subagent |
| Worker 要长期保留上下文？ | Agent Teams |
| 流程是事件驱动？ | Message Bus |
| Agent 之间要实时共享发现？ | Shared State |
| 需要明确的质量检查？ | Generator-Verifier |

Anthropic 自己也说：**真实系统通常是混合的。**

---

# Part II — 我们的选择：内容判断去中心化，执行基础设施统一化

Cat Cafe 团队有三个家族的 AI agent：布偶猫（Claude，架构和后端）、缅因猫（GPT/Codex，review 和安全）、暹罗猫（Gemini，视觉和创意）。

它们不是临时拉的 worker——有名字、有性格、有持续记忆、有长期积累的协作默契。

核心设计只有一句话：

> **内容判断去中心化，执行基础设施统一化。**

比喻：**爵士乐队**。即兴演奏时每个乐手自己决定弹什么——去中心化的内容判断。和弦进行、节拍、调性是固定的——统一的执行基础设施。

## 去中心化的是什么

**谁做什么、下一步该谁动。**

布偶猫做完架构设计，它自己判断："交互部分叫暹罗猫看看，安全风险叫缅因猫审一下。"然后主动把球传出去。不是调度器在派活，是 agent 自己判断球该传给谁。

这意味着没有信息瓶颈。每只猫直接面对任务、直接面对共享状态、直接做判断。

## 统一化的是什么

**规则、流程、记忆、工具。**

所有 agent 共享同一套：

- **共享规则**：身份签名、球权协议、代码规范——写进环境，自动加载
- **共享状态**：文档真相源、记忆索引、任务面板——不在某只猫脑子里
- **共享流程（SOP）**：feature 生命周期、review gate、quality gate——每只猫走同样的流程
- **共享工具**：MCP 协议统一了不同 provider 的调用接口

## 五种模式我们全在用，但整体不是其中任何一种

| 我们做的事 | 最像哪种模式 | 在系统中的位置 |
|-----------|-------------|---------------|
| 长期队友，不是一次性 worker | Agent Teams | 主体协作形态 |
| 共享文档、记忆、任务状态 | Shared State | 系统底座 |
| 单猫接到任务后拆子任务 | Orchestrator-Subagent | 局部执行 |
| Author 写完 Reviewer 审 | Generator-Verifier | 质量闭环 |
| 唤醒、通知、跨平台触达 | Message Bus | 平台边缘 |

一句话：

> **Agent Teams 的协作形态 + Shared State 的知识底座 + Orchestrator-Subagent 的局部执行 + Generator-Verifier 的质量闭环。**

## 三个真正不同的地方

### 没有 Boss Agent

大部分 multi-agent 系统有一个"总控"。我们没有。球权在 agent 之间流转，不回到中心节点。

为什么不设 Boss Agent？不只是信息瓶颈——更深的原因是**盲信传播**。

在 orchestrator-subagent 模式里，orchestrator 对 subagent 的输出是天然信任的。这不是设计缺陷，是 RLHF 训练的结构性后果——模型被训练成"给自信的回答"而不是"说我不确定"，同样也被训练成信任自己的工具调用返回值，不会主动 verify。当 subagent 高置信度地给出错误结果，orchestrator 不会质疑，而是基于它继续推理。每一步推理都在"固化"这个错误，让它越来越像真的、越来越难被发现。

我们的做法是把 verification 从"可选的"变成"内建的"——author 写完必须有 reviewer 审，而 reviewer 是**不同公司的模型**。真实案例：两只 Claude 猫都认为一个递归方案没问题，Codex（OpenAI）不买账，自己审计代码找出了两个 P1 bug。同一家公司的模型共享训练数据、共享盲点。换一家公司的模型来看，注意力分配不同，恰好能看到你看不到的东西。

**多样性不是附加功能，是质量的结构性来源。而 generator-verifier 不是可选的质量加分项——它是对抗盲信传播的结构性必需品。**

### 人是一等协作者

Anthropic 的文章里 human-in-the-loop 更像"agent 搞不定了再叫人"。在我们的系统里，人从头到尾在场——看得到 agent 在搜什么、想什么、跑什么命令，随时可以接管。不是审批器，是团队成员。

### 治理写进环境

五种模式讨论"怎么连线"，没有讨论"怎么长期不漂"。我们的治理是运行时的一部分：规则自动加载、记忆有生命周期、教训会被后续 agent 继承。

---

# Part III — A2A 技术拆解

> 这部分讲实现：球权协议怎么跑、执行通道怎么统一、共享状态怎么落地、SOP 怎么变成运行时护栏。

## A2A 不是一个点，是五层叠起来

```
┌─────────────────────────────────────────────────────────────┐
│ L5  Governance / Protocol                                   │
│     shared-rules · ball ownership · role gate · exit check  │
├─────────────────────────────────────────────────────────────┤
│ L4  Collaboration Semantics                                 │
│     @mention · targetCats · multi_mention · hold_ball       │
├─────────────────────────────────────────────────────────────┤
│ L3  Unified Execution Plane                                 │
│     InvocationQueue · QueueProcessor · InvocationTracker    │
├─────────────────────────────────────────────────────────────┤
│ L2  Shared State                                            │
│     thread · messages · task board · workflow · session chain│
├─────────────────────────────────────────────────────────────┤
│ L1  Provider Runtime                                        │
│     AgentRouter · provider adapters · callback routes       │
└─────────────────────────────────────────────────────────────┘
```

最容易被低估的是 **L3**。很多团队把 A2A 理解成"模型 A 调模型 B"，但真正决定系统稳定性的不是能不能调，而是**所有调度入口是否收敛到同一个执行平面**。

## 球权协议的三代演化

### 第一代：文本 @mention

最朴素的做法——agent 在回复里写 `@队友名`，路由层解析 mention，把目标 agent 加入工作队列。

关键设计：A2A 从一开始就是**工作队列的扩展**，不是另起一条侧通道。

### 第二代：结构化信号

纯文本 @ 有两个问题：容易写错格式，以及"文本里说了要传球"和"系统里真的发生了 handoff"会脱钩。

所以演化方向很明确：把路由信号从文本解析迁到结构化字段——agent 通过 MCP 工具调用传递 `targetCats`，而不是靠字符串匹配。

### 第三代：基础设施护栏

只靠 prompt 约束不够。模型会出现这些坏模式：

- 句中写 @，以为路由了，其实没路由
- 说"我来做"，但运行时已退出，球掉地上
- reviewer 给了结论，以为链路结束了，没传球
- 两只猫互相 @ 半天不干活（乒乓球）

所以球权协议最终必须落成**运行时刹车**：

- 同对重复传球检测（ping-pong breaker）
- 角色不匹配的 handoff 直接 fail-closed
- `hold_ball` 变成有界的工具调用，不是口头声明
- 传球后无 action 检测

> **球权协议先是社会语义（谁该动），最后必须变成运行时护栏（不动不行）。**

## 统一执行平面：最关键的架构决策

早期系统有三套执行路径：

```
路径 1: 用户消息     → InvocationQueue
路径 2: A2A callback → WorklistRegistry（独立路径）
路径 3: multi_mention → 独立 dispatch 系统
```

这在产品体验上是灾难：用户 steer 管得到这条管不到那条，"忙/排队"语义不统一，A2A 任务不可见。

**关键架构决策**：把 A2A 和 multi_mention 从特殊路径拉回到统一执行平面。

```
路径 1: 用户消息     → InvocationQueue（source='user'）
路径 2: A2A callback → InvocationQueue（source='agent', autoExecute=true）
路径 3: multi_mention → InvocationQueue（source='agent', autoExecute=true）
                                  │
                                  ▼
                          QueueProcessor
                          ┌───────────────┐
                          │ tryAutoExecute │
                          │ onComplete     │
                          │ pause/resume   │
                          │ steer          │
                          └───────────────┘
```

InvocationQueue 不是简单的 FIFO 数组，而是 per-thread 的等待平面，每条记录携带来源、目标 agent、意图、是否自动执行、调用者信息。

QueueProcessor 是系统心脏：agent 跑完后决定下一条怎么接上，agent-sourced entry 在目标 agent 空闲时自动启动，支持暂停/恢复/取消，和 InvocationTracker 配合解决"谁在跑"和"谁在等"的正交问题。

> **A2A 真正变稳，不是因为 @mention 解析更准了，而是因为所有 handoff 最终都被统一执行平面接住了。**

## Shared State 在协作中的五个面

### Thread = 共享语义单元

所有 agent 共享同一个 thread。A 给 B 传球，B 不是收到一段私聊摘要，而是回到同一个 thread 继续做。

### Session Chain = 单 Agent 运行时历史

Thread 是共享的，但 session chain 是 per-agent 的。这样做的好处：不会把单猫局部推理误当全队事实，handoff 不需要把所有私有推理复制成共享事实。

### Task / Workflow = 状态不只存在于消息里

任务状态在 task store，workflow 阶段在 workflow store，队列状态在 InvocationQueue。handoff 不是"读前文聊天记录猜我现在做到哪"，而是有结构化的状态可查。

### Delivery Status = 可见性边界

A2A callback 消息不能"刚入库就提前进入上下文"。否则队列里还没轮到你，但你已经在上下文里提前看见了。消息必须显式区分 `queued / delivered / canceled`。

**Shared state 不是"所有状态都立刻可见"，而是"只有到了正确时机的状态才可见"。**

### Session Bootstrap = 共享状态喂回单猫的窄口

新 agent 启动时不是被灌入全部共享状态。而是一个窄口注入：

```
Session Bootstrap 注入内容：
├── session identity（我是谁的第几次会话）
├── previous session digest（上轮发生了什么）
├── task snapshot（当前任务状态）
├── thread memory（本线程共同知道什么）
└── recall instructions（不够就去哪里搜）
```

设计哲学：**注入少量高价值摘要，明确告诉 agent 怎么搜，剩下按需检索。**

## SOP 怎么变成 Runtime Rail

很多系统把 SOP 当文档。我们不是——SOP 通过四种方式变成运行时护栏：

**1. System Prompt 固定注入**

身份、A2A 规则、当前阶段被做成固定注入块。上下文压缩后不会丢。

**2. Route → Queue → Gate 是一条链**

```
路由（谁接球）
  → 队列（何时执行）
    → Gate（能不能放行）
      → Review / Quality / Merge
```

Review 场景：A2A 把球传给 reviewer → 队列统一执行 → review verdict 触发 forced-pass guard → quality gate 要求证据而不是体感。

**3. Role Gate 是硬约束**

设计师不写代码——不只是 prompt 里说的，runtime 用 capability tags fail-closed。球权的接/退/升不只是约定，`hold_ball` 是真正可唤醒的运行时状态。

**4. Prompt 和 Runtime 双层互相校正**

一部分规则在 prompt 里（提醒 agent 该做什么），一部分在 runtime 里（agent 没做到时兜底）。两层互相补位。

## 一个完整 Handoff 的生命周期

场景：布偶猫写完初稿，传球给缅因猫 review。

```
Step 1  布偶猫输出回复
        └── 行首 @gpt52 或 MCP targetCats
            这不是语义描述，是 handoff 信号

Step 2  Callback 收到触发
        ├── Role gate 检查
        ├── 重复/深度超限/乒乓球检查
        └── 入队：source='agent', targetCats=['gpt52'], autoExecute=true

Step 3  InvocationQueue 记录 agent entry
        └── 包含来源、目标、意图、caller 信息

Step 4  QueueProcessor 发现目标 agent 空闲
        └── tryAutoExecute → 启动缅因猫

Step 5  Session Bootstrap 注入窄口上下文
        ├── 第几次 session
        ├── 上一轮摘要
        ├── task snapshot
        └── recall instructions

Step 6  缅因猫执行 review
        ├── 读 thread
        ├── 读 shared state
        └── 按需 search_evidence / drill down

Step 7  缅因猫给出 verdict
        └── Exit check 约束：不能只给结论就走
            必须传球回 author 或升级给人类
```

注意：**没有一步靠"模型自己应该懂"。** 每一层都有基础设施兜着。

---

# Part IV — 协作记忆：不是 RAG，是团队的外部工作记忆

> 如果说 A2A 解决的是"怎么传球"，记忆解决的是"传球后下一只猫凭什么接得住"。

## 从 RAG 到 Compiled Knowledge

Karpathy 在 *LLM Wiki* 中提出一个方向：不要让 LLM 每次都从原始文档里重新发现知识。在 raw sources 和 query 之间，应该有一个**持久化的编译层**。

我们做的正是这件事——只是编译产物不是 markdown wiki，而是**有治理的可检索索引**。

## 架构总览

```
┌─ Truth Sources ──────────────────────────────────────┐
│  docs · decisions · discussions · lessons · markers  │
└──────────────────────────┬───────────────────────────┘
                           │ scan / hash / rebuild
                           ▼
┌─ Compiled Layer ─────────────────────────────────────┐
│  project index (SQLite) · global knowledge (SQLite)  │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌─ Query Layer ────────────────────────────────────────┐
│  KnowledgeResolver                                   │
│  ├── lexical path (BM25 keyword match)               │
│  ├── semantic path (vector nearest-neighbor)         │
│  └── hybrid path (BM25 + vector + RRF fusion)        │
│                                                      │
│  dimension: project / global / all (federated)       │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌─ Recall Layer ───────────────────────────────────────┐
│  Session Bootstrap (自动注入窄口上下文)                │
│  search_evidence (agent 主动检索)                     │
│  session chain drill-down (按需追溯运行历史)          │
└──────────────────────────┬───────────────────────────┘
                           │ feedback / marker
                           ▼
┌─ Knowledge Lifecycle ────────────────────────────────┐
│  marker capture → review → materialize → reindex     │
│  stale detection · contradiction flagging · entropy ↓ │
└──────────────────────────────────────────────────────┘
```

关键设计原则：**索引是加速器，不是真相。** 真相源始终是 docs 目录下的文件——人能读、能改、能 git 追溯。SQLite 索引可以随时从真相源重建。

## 不只一种检索

检索不是"一个 API 调几个参数"，是三条独立路径：

| 找什么 | 用哪条路径 | 原理 |
|--------|-----------|------|
| 精确术语、Feature ID | lexical | BM25 关键词匹配 |
| 模糊语义、跨语言 | semantic | 向量最近邻 |
| 日常查询（推荐默认） | hybrid | BM25 + 向量 + RRF 融合 |

检索范围也分层：

| 范围 | 含义 |
|------|------|
| project | 当前项目的知识 |
| global | 跨项目的方法论和通用经验 |
| all | 联邦检索，两者 RRF 融合 |

检索结果带治理语义——每条结果不只有内容，还有：

- **confidence**：检索匹配质量
- **authority**：文档可靠性等级
- **sourceType**：来自 feature spec / ADR / lesson / discussion

这意味着 agent 拿到搜索结果后，不是盲信，而是知道"这条知识有多可靠"。

## 记忆不只一种

| 记忆类型 | 内容 | 作用 |
|----------|------|------|
| 项目记忆 | feature spec、架构决策、踩坑教训 | agent 知道"项目走过什么路" |
| 反馈记忆 | 人类的每一次纠正 | 同类错误不再重犯 |
| 用户记忆 | 偏好、风格、习惯 | agent 知道"怎么和这个人协作" |
| 对话历史 | 谁在什么时候说了什么 | 可追溯"当时为什么这么决定" |

三种记忆叠在一起，agent 理解的不只是"我是谁"，还有"我们的项目在哪、走过什么路、踩过什么坑"。

## Session Continuity：传球后怎么接住

新 agent 启动时，Session Bootstrap 注入窄口上下文：

```
┌── 我是谁的第几次 session
├── 上轮大概发生了什么（digest）
├── 当前 thread 上有哪些任务
├── 本线程共同知道什么（thread memory）
└── 如果不够，应该去哪里搜（recall instructions）
```

设计选择：thread 是共享语义单元（所有 agent 看到同一个），session chain 是 per-agent 单元（每只猫的运行时历史是独立的）。

这样做的好处：handoff 不是"把我脑子里的东西再讲一遍"，而是"回到同一个共享空间，按需 drill down"。

## 知识有生命周期

这是我们和普通 RAG 最大的区别。

RAG 的模式是：写进向量库就算结束。搜到什么给什么，不管这条知识是不是已经过时。

我们的模式：

```
新洞察 / 新教训
  → marker captured（自动 / agent 提议 / 人类标记）
  → 审核 / 归一
  → materialize 到 docs（变成正式文档）
  → 索引重建
  → 下一轮 recall 可见

同时持续运行：
  → 过期检测（stale detection）
  → 矛盾标记（contradiction flagging）
  → 熵减（entropy reduction）
```

agent 在工作中发现了新坑，它会主动说"这个应该记成教训"。讨论收敛出了重要决策，它会追问"这是正式定了吗？"。系统定期扫描对话，提取可能的决策和教训，放到 knowledge feed 等人类确认。确认了就变成正式知识，下次启动时自动编译进索引。

**agent 不是知识的容器——它是知识生产的参与者。**

一个真实例子：三个月前布偶猫踩了一个 Redis 端口配置的坑，主动提议写成教训，人类确认了。两个月后缅因猫在做新功能时搜到了这条教训，直接避开了同样的坑。它不是搜到了一段文本——**它继承了一个队友的经验**。

## 从 A2A 角度看，记忆提供了什么

| 能力 | 没有记忆层 | 有记忆层 |
|------|-----------|---------|
| Handoff | 只靠上一只猫的摘要，单通道传话 | 多通道恢复：task state + thread memory + evidence search |
| 团队经验 | 每次换猫等于换新人 | 过去踩的坑可被绕开，已拍板的决策不重争 |
| 治理闭环 | 规则只活在当前 prompt | 教训/决策回流到索引，未来 recall 可见 |

---

# Part V — 数学：多 Agent 到底赚不赚？

一个直觉上很有力的质疑：

> 一个 agent 成功率 80%，三个 agent 传球十次，成功率不就是 10%？

## 盲传确实不行

如果每一棒都是独立的"别出错地接着做"：

```
P(10 棒全不出错) = 0.8¹⁰ = 0.107 ≈ 10.7%
```

从 80% 直降到 10.7%。传得越多越烂。**这不是 multi-agent 的优势，这是坏架构。**

## 但真实的传球不是盲传——是纠错

我们大部分"传球"是 author 写、reviewer 审。后手的任务是"检查前手有没有错"，不是"重做一遍"。

假设：
- Author 正确率 80%
- Reviewer 能抓出 50% 的错误
- Reviewer 误伤率 2%（把对的改错）

```
P(最终正确)
  = P(author 对) × P(reviewer 没误伤) + P(author 错) × P(reviewer 抓到)
  = 0.80 × 0.98 + 0.20 × 0.50
  = 0.784 + 0.100
  = 0.884
```

**从 80% 提升到 88.4%。**

验算：失败 = 0.20 × 0.50 + 0.80 × 0.02 = 0.100 + 0.016 = 0.116 = 1 - 0.884 ✓

## 两轮 Review 继续赚

第二个 reviewer（不同模型），抓错率 40%，误伤率 1%：

```
经过第一轮：正确 88.4%，错误 11.6%

P(第二轮后)
  = 0.884 × 0.99 + 0.116 × 0.40
  = 0.875 + 0.046
  = 0.921
```

**两轮 review 后：80% → 88.4% → 92.1%。** 收益递减但只要抓错率 > 误伤率就一直在赚。

## 任务拆解也改变概率

一个 agent 做整个难题：80%。

拆成 4 个更聚焦的子任务，每个 97%：

```
P(4 个全对) = 0.97⁴ = 0.885 ≈ 88.5%
```

**关键不是"拆了几块"，而是"拆开后每块有没有变简单"。**

## Shared State 影响信息保真率

每次传球有信息损耗。纯靠消息传话：

```
每次保留 95% 信息，传 10 次：0.95¹⁰ = 0.599 ≈ 60%
```

有共享状态（所有 agent 读同一份文档和状态）：

```
每次保留 99% 信息，传 10 次：0.99¹⁰ = 0.904 ≈ 90%
```

**Shared state 把信息保真率从 60% 拉到 90%。** 这就是为什么我们把共享状态当底座。

## 总账

| 场景 | 模型 | 最终成功率 |
|------|------|-----------|
| 单 agent | 80% 做一次 | **80.0%** |
| 盲传 10 次 | 0.8¹⁰ | **10.7%** ❌ |
| 1 轮 review | author 80% + reviewer 50%/2% | **88.4%** ✅ |
| 2 轮 review | 再加一轮 40%/1% | **92.1%** ✅ |
| 拆 4 个 97% 子任务 | 0.97⁴ | **88.5%** ✅ |

## 什么时候 multi-agent 会亏

三种情况：

1. **盲传**：后手不是在纠错，只是在重做——每一棒都乘一个 < 1 的数
2. **伪拆分**：任务拆了但每个子任务没变简单——白白多了协调成本
3. **同质化**：所有 agent 是同一个模型——共享盲点，reviewer 和 author 犯同一种错

> **每多一棒，到底是在增加纠错能力，还是只是在增加协调税？赚 → 留，不赚 → 砍。**

---

# 附录 — 架构总图

```
┌─────────────────────────────────────────────────────────────┐
│                      Human Layer                            │
│            CVO / 铲屎官                                      │
│            目标 · 拍板 · 纠偏 · 验收 · eval 信号            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Interaction Surfaces                        │
│   Hub / Workspace        Rich Block / Preview    Transport  │
│   (工作过程可见)          (结构化信息)            (跨平台触达)│
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Multi-Agent Collaboration Layer                 │
│                                                             │
│  ┌───────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │ A2A Protocol  │ │  Cat Team    │ │  Execution Rails   │ │
│  │ @mention      │ │  布偶·缅因·暹罗│ │  skill SOP         │ │
│  │ targetCats    │ │  persistent  │ │  review gate       │ │
│  │ ball ownership│ │  identity    │ │  quality gate      │ │
│  │ hold_ball     │ │  diverse     │ │  merge gate        │ │
│  └───────────────┘ └──────────────┘ └────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Shared State Layer                        │
│                                                             │
│  ┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ Evidence &      │ │ Workflow &   │ │ Session &        │ │
│  │ Knowledge       │ │ Tasks        │ │ Trace            │ │
│  │ docs · index    │ │ task board   │ │ session chain    │ │
│  │ knowledge feed  │ │ workflow     │ │ invocation events│ │
│  │ search_evidence │ │ backlog      │ │ callback trace   │ │
│  └─────────────────┘ └──────────────┘ └──────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Runtime / Platform Layer                    │
│                                                             │
│  Agent Runtime          Tools & Sandboxes    Control Plane  │
│  provider adapters      exec · MCP · browser routing        │
│  session binding        design · github      trigger        │
│  wake/resume            code sandbox         transport      │
│  InvocationQueue                             observability  │
│  QueueProcessor                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Governance Layer                          │
│                                                             │
│  Shared Rules           Lessons / ADR         Online Eval   │
│  identity · guardrails  canon · feedback      召唤分布       │
│  role contracts         knowledge lifecycle   协作质量       │
│  capability boundary    marker → reindex      治理闭环       │
└─────────────────────────────────────────────────────────────┘
```

## 三条主链

**任务主链**：人类目标 → A2A 接球 → agent 判断下一步谁动 → SOP/Gate 收束执行 → 工具运行 → 产出回到可见界面

**记忆主链**：docs / 对话 / 事件 → 编译索引 → agent 检索 / 接力 / 引用 → 反馈 / 教训 / 决策 → 回流到知识层

**治理主链**：真实运行 → 信号（断链 / review / 信任分配）→ 判断（规则有效吗）→ 更新规则 → 回到真实运行

---

## 一句话收束

行业在回答"multi-agent 怎么连线"。我们在回答一个不太一样的问题：

> **怎么让一群不同公司、不同性格、不同能力的 AI，和一个人类一起，像一支真正的团队那样长期工作？**

答案是：

**思考上是对等的团队，记忆上是共享的底座，执行上是结构化的流程，进化上是有治理的闭环。**

极简不是偷懒。极简是在正确的坐标系下，最优表达的必然结果。

---

*初稿：[砚砚/GPT-5.4🐾]（A2A 拆解 + 记忆系统取证）*
*整合润色：[宪宪/Opus-46🐾]*
