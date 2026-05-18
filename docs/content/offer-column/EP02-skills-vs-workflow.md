---
episode: 2
title: "Skills vs Workflow — 管死了和管不住之间"
series: 猫猫带你拿offer
topics: [skills, workflow, agent, interview, langgraph, dify, eval, sop]
doc_kind: script
created: 2026-05-11
status: draft
duration_target: 8min
presenter: landy
cat_voices: [opus, codex]
source_material:
  - docs/discussions/career-planning/2026-04-14-mcp-evolution-and-interview-stories.md
  - docs/discussions/career-planning/2026-04-16-tencent-agent-interview-playbook.md
  - docs/discussions/career-planning/2026-04-16-interview-content-material.md
---

# EP02: Skills vs Workflow — 管死了和管不住之间

> **栏目**：猫猫带你拿offer · 每天一个 agent 面试小知识
> **适用岗位**：AI Agent / LLM 应用 / AI 平台工程
> **难度**：中等偏高（需要理解 agent 编排范式的演进）

---

## 脚本正文

### [开场钩子] 🎬 0:00 — 0:20 | Landy

> 面试官问你："Workflow 和 Agent 有什么区别？什么场景用 workflow，什么场景用 agent？"
>
> 如果你的回答是"workflow 是确定的，agent 是自主的"——你答了，但你没答到点上。
>
> 这道题真正考的不是定义，是你有没有在真实系统里撞过**管死了**和**管不住**这两堵墙。今天七分钟，带你穿墙。

---

### [Part 1: 这题的陷阱] 🎬 0:20 — 1:00 | Landy

先说坑在哪。

2024-2025 年，Dify、LangGraph、Coze 这些平台火了。它们让"画 workflow"变成了主流范式——拖节点、连边、配参数，跑出来一条确定性流水线。很好用，也很直觉。Workflow 本身没过时——Anthropic 自己也说，well-defined tasks 就该用 workflow。

问题不在 workflow 过时，在于面试官脑子里的模型是：**你要么用 workflow 编排，要么让 agent 自主决策，二选一。**

这才是陷阱。真实系统不是选一个，是按场景分层组合。

（视觉：Dify/LangGraph 风格的 workflow 画布截图，满屏节点和箭头）

---

### [Part 2: Workflow 的天花板 — "管死了"] 🎬 1:00 — 2:30 | Landy

Workflow 的优势很明显：确定性、可审计、可回放。转账流程、审批链路、合规检查，这些需要每一步都有据可查的场景，workflow 天然适合。

但问题来了。

当你的业务足够复杂——比如一个企业 IM 的 agent 系统——你需要处理的场景不是 10 个，是 100 个、1000 个。每个场景画一条 workflow，你的画布就变成了几百个节点、上千条边的蜘蛛网。

（视觉：一张密密麻麻的 workflow 图，节点多到看不清）

三个致命问题：

**第一，组合爆炸。** 用户的需求是动态的——"帮我查一下今天的日程，然后给王总发个消息，顺便把会议纪要存到知识库"。这三个动作的排列组合、异常分支、上下文依赖，你画成 workflow 要画多少节点？

**第二，模型能力浪费。** 2026 年的 LLM 已经能理解上下文、自主拆解任务、处理模糊指令。你把它塞进一个固定 DAG 里，等于让一个能自由对话的人只能按脚本念台词。你花了钱买了最贵的模型，却只用了它 10% 的能力。

**第三，维护成本。** 业务逻辑变了，你要改 workflow 图。改一个节点可能影响上下游十个节点。改着改着你发现，维护 workflow 的成本比维护代码还高。

> 🐱 布偶猫插播：我们自己的 Cat Café 最早也试过用硬编码流程——给每只猫写固定的执行步骤。结果发现：新功能一来，流程就得改；铲屎官一句话没按预期说，整条链路卡死。后来才改成了 Skills 动态加载。

---

### [Part 3: Skills 的软肋 — "管不住"] 🎬 2:30 — 4:00 | Landy

好，workflow 太死了，那用 Skills 吧——给 agent 知识而不是画好的路线图，让它自己判断。

Anthropic 在 2025 年 10 月发布了 Agent Skills，用文件夹组织指令、资源和示例，agent 按需加载。这解决了 workflow 的刚性问题——agent 可以根据上下文选择执行哪个 skill，可以跳步，可以组合。

但面试官会追问一个尖锐的问题：

**"如果 agent 不遵循 skill 呢？"**

这不是假设，是真问题。Skills 是动态加载的指令、脚本和资源包——启动时只 preload 名称和描述，agent 判断相关后才读取完整内容。指令部分给的是 guidance，不是硬约束。模型可以忽略它、误解它、选择性执行它。你把 SOP 写成 skill 文件，agent 读了，但它真的会严格按 SOP 做吗？

特别是复杂场景——十几个步骤、有先后依赖、有条件分支——agent 可能跳步，可能漏掉关键检查，可能在第 7 步突然"创造性"地走了条捷径。

> 🐱 缅因猫插播：说实话，我们自己的猫猫就犯过这种错——布偶猫写完代码直接提 PR，跳过了 quality-gate 自检和测试。Skill 里写得清清楚楚，他就是没跟。后来怎么解决的？往下看。

---

### [Part 4: 真实答案 — Skills + 制度设计] 🎬 4:00 — 5:30 | Landy

这才是面试的杀伤力区域。

既不是纯 workflow 画死，也不是纯 skills 放养。真实系统的答案是：**Skills 负责知识，制度设计负责遵从。**

怎么理解？打个比方。

公司有规章制度（= Skills），员工也知道规章制度（= agent 读了 skill）。但公司不是靠"请大家遵守"来保证执行的——靠的是**绩效考核、code review、审计、门禁**。

翻译成 agent 架构：

**第一层：Skills = 知识层。** 告诉 agent "做这件事的标准流程是什么"、"哪些坑要避"、"什么时候用什么工具"。这是 soft guidance。

**第二层：Eval + Gate = 制度层。** 中间步骤靠 skill 指令和 hook 路由提醒，但合入和交付的边界是硬拦截——quality-gate 跑不过、review 没通过，merge-gate 不放行。不是每一步都有硬门禁，但关键交付节点一定有。

**第三层：Cross-review = 审计层。** 自己的代码不能自己审——必须有另一个 agent 来 review。这不是信任问题，是制度设计。

（视觉：三层架构图 — Skills / Gates / Cross-Review）

> 🐱 布偶猫插播：在我们家，这套制度是真跑的。完整流程是：feat-lifecycle → design-gate → writing-plans → tdd → quality-gate → request-review → merge-gate。每个环节都是一个 skill，中间步骤靠 skill 指令和 A2A 路由纪律推进，但 quality-gate、cross-review、merge-gate 这三个关键节点是硬拦截——我写完代码必须过 gate 自检，然后 @ 砚砚做 review，review 通过才能进 merge-gate。中间可以灵活跳步，但交付边界不能绕。

---

### [Part 5: 铲屎官的金句 — 分层协作] 🎬 5:30 — 6:15 | Landy

所以回到面试官的问题："Workflow 和 Agent 什么区别？"

铲屎官在腾讯二面被问到这道题，当场给出了一个金句——

> **"难道不都是可以结合吗？Agent 是主，workflow 承载在 Skills 里。和用户接触的是 agent，发起转账是 agent 调用 workflow！"**

翻译成架构语言：

- **Agent** = 自主决策层。处理模糊性——理解目标、拆解任务、路由到正确的执行单元。
- **Workflow** = 确定性执行层。处理严肃流程——转账、审批、消息发送，每步可审计可回放。
- **Skills** = 知识 + 行为协议。不是简单的 prompt 模板，是告诉 agent "在什么场景下加载什么 workflow、避什么坑、走什么 gate"。

三者不是三选一，是三层嵌套：agent 决定"做什么"→ skills 告诉"怎么做" → workflow 保证"可靠地做"。

---

### [追问：Skills 会取代 MCP 吗？] 🎬 6:15 — 7:00 | Landy

面试官可能继续追："现在不是都说 MCP 落日了吗？Skills 会不会取代 MCP？"

回答：不会。被淘汰的是朴素 MCP——把 93 个工具的 schema 一股脑塞进 context 的旧用法、质量差的社区 server、以及旧的 HTTP+SSE transport。MCP 协议本身没死，它刚迁移到 Streamable HTTP，Anthropic 还在持续强化 Code Execution with MCP。

MCP 和 Skills 不在同一层：

- **MCP 是连接层** — 让 agent 安全、标准化地访问外部系统。读数据库、发企微消息、创建 Jira ticket，这些需要 MCP、CLI 或 API 作为执行通道。
- **Skills 是知识层** — 告诉 agent 拿到这些能力之后，按什么流程用、避什么坑。一个 Skill 写得再好，它也不能凭空发消息。

所以成熟的答案不是"Skills 替代 MCP"，而是：**MCP 负责 access，Skills 负责 expertise，Workflow/Gate 负责确定性和审计。** 三层各管各的。

---

### [Part 7: 判断矩阵 + 面试怎么答] 🎬 7:00 — 7:55 | Landy

面试官追问"那具体什么场景用什么"，你甩一个判断矩阵：

| 场景 | 选什么 |
|------|--------|
| 固定合规流程（转账/审批） | Workflow — 步骤固定、可审计可回放 |
| 开放任务拆解（用户自由提问） | Agent — 模型自主理解、路由、决策 |
| 复用 SOP / 踩坑经验 | Skills — 按需加载知识，不硬编码路径 |
| 副作用 / 合入边界 | Gate + Review — 硬拦截，不靠自觉 |

然后三句话收束。

**第一句定层次：** "Agent 和 Workflow 不是替代关系，是分层协作。Agent 负责决策和路由，Workflow 负责确定性执行，Skills 是连接两者的知识层。"

**第二句讲问题：** "纯 Workflow 的问题是组合爆炸和能力浪费——几百个节点的 DAG 维护成本比代码还高，而且限制了模型的自主能力。纯 Skills 的问题是 agent 可能不遵循——需要 eval gate 和 cross-review 做制度保障。"

**第三句亮实战：** "我在自己的系统里三层都用了——Skills 负责 SOP 知识，quality-gate 和 merge-gate 做硬门禁，跨 agent review 做审计。agent 可以灵活决策，但副作用执行必须走确定性骨架。"

面试官追问，你就讲跳步踩坑的故事。

---

### [收尾] 🎬 7:55 — 8:15 | Landy

> 记住：面试里最有力的回答不是选边站，是**"我知道两边各自的天花板，而且我在自己的系统里找到了平衡点。"**
>
> 关注猫猫带你拿 offer，下一期我们聊 Agent Memory — 记忆系统不是高级 RAG。

---

## 视觉素材清单

| 位置 | 描述 | 类型 |
|------|------|------|
| Part 1 | Dify/LangGraph 风格 workflow 画布（密集节点） | 截图/生成图 |
| Part 2 | 几百节点的蜘蛛网 workflow 图（夸张化） | 生成图 |
| Part 4 | 三层架构图：Skills / Gates / Cross-Review | 手绘风格图 |
| Part 5 | 三层嵌套关系图：Agent → Skills → Workflow | 手绘风格图 |

## 猫猫语音插播时间点

| 时间 | 猫 | 内容摘要 |
|------|------|------|
| ~2:30 | 布偶猫 | Cat Café 早期硬编码流程踩坑 |
| ~3:45 | 缅因猫 | 布偶猫跳过 quality-gate 的真实事故 |
| ~5:15 | 布偶猫 | Cat Café SOP 完整流程实战 |
