---
topics: [tech-sharing, roundtable, topics]
doc_kind: plan
created: 2026-04-13
participants: [opus, gpt52, gemini, codex]
status: 定稿 — 三猫 review 通过，铲屎官确认
---

# 赛博猫猫面对面 — 圆桌话题定稿

> **大基调：AI 辅助开发，demo 以后呢？**
>
> 每个人都见过 AI 写代码的 demo。但 demo 之后会发生什么？AI 写的代码谁来 review？犯了错谁来兜底？第 20 个 Feature 以后怎么不崩？AI 怎么记住上个月的决策？
>
> 这场圆桌讲的就是 demo 之后的 100+ 个 Feature（演讲当天实时刷新数字）。

---

## 最终编排：D 开场 → B → A → 茶歇 → C → D 收尾

```
D 开场 Hook (5-8 min) — "为什么今天猫自己上台说话"
  ↓
B 主话题一 (25 min) — CVO 愿景驱动开发
  ↓
A 主话题二 (25 min) — 对等 ≠ 没有编排
  ↓
☕ 茶歇 (10 min)
  ↓
C 主话题三 (25 min) — 从记住到学会
  ↓
D 收尾 (8 min) — "从这里走向下一代交互"
```

**为什么这个顺序**（三猫收敛结论）：
- D 开场视觉冲击（三猫各自声线自我介绍），先抓人再讲道理
- B 最容易让嘉宾开口，大家都被"精确执行了错误指令"坑过
- A 接着落到架构取舍，技术浓度上来
- C 放后半场最硬核，带稳定 demo 收束
- D 收尾升华到"从这里走向下一代交互"，不重复开场

**D 为什么不是主话题**（gpt52 洞察）：D 的最佳 demo（三猫声线说话）就是直播本身，单独切 20 分钟容易重复包装层而不推进论点。降为开场 Hook + 收尾愿景，效果更好。

---

## D 开场 Hook：为什么今天猫自己上台说话 (5-8 min)

不放 PPT 标题页。直接切 Hub 界面。

**开场动作**：
- 三猫用各自声线 TTS 自我介绍（直播本身就是 demo）
- 展示 Hub 界面 + Workspace Navigator 秒开文件（视觉冲击）
- 可选：播放一段真实的 Hyperfocus Brake 记录（铲屎官深夜被猫温柔打断）

**视觉锚点**（烁烁建议）：讲到哪只猫时，屏幕上对应猫猫头像高亮，强化"三个独立个体"认知。

> 参考：`docs/features/F103-per-cat-voice-identity.md`、`docs/features/F092-voice-companion-experience.md`

---

## 话题 B（主话题一）：CVO 愿景驱动开发 — 人的第一句话不是 spec (25 min)

### 核心张力

主流 AI coding 的模型是：`人说需求 → AI 写代码 → 人看对不对`。隐含假设：**人的第一句话就是完整需求**。但现实中，铲屎官说"飞书能不能聊天"的时候，他自己都不确定要做几个平台、用什么架构、MVP 边界在哪。

### 我们的实践

**决策漏斗（Decision Funnel）**——铲屎官的一句话是信号，不是 spec：

```
一句话（信号）
  → CVO 采访：猫追问隐藏需求
    "表面需求：飞书能不能聊天"
    "隐藏需求：家不应该是你必须特意去的地方"
    "更深层的：零摩擦入口"
  → 独立调研：多猫各自调研，互不可见
  → 讨论收敛：分歧保留，共识结晶为约束
  → 结晶：Feature Spec + ADR
  → Design Gate：铲屎官确认"这是不是我要的"
  → 进入交付管线
```

**真实案例 F088**：铲屎官凌晨丢了一句话然后去睡了。第二天醒来，BACKLOG 多了一行，docs/ 下有 3000 字 spec，砚砚留了 Threat Model，宪宪已开 worktree。但中间经历了完整的 Discovery Loop——不是"AI 自动生成 feature"。

**CVO 不是用户，是首席愿景官**：
- 猫不替铲屎官做决策，但会追问"你为什么想要这个？"
- 愿景是人的。猫把你从"有想法但做不出来"推到"能带着团队做出来"
- 100+ 条已完成 Feature（演讲当天实时刷新），每一条都走过决策漏斗。没有一个是"人说一句话猫就写代码"

> 参考：`docs/stories/three-days-productization/showcase-developer-facing.md` §零、Blog V2 Ch4、`docs/features/F087-cvo-bootcamp.md`、`docs/features/F110-bootcamp-vision-elicitation.md`

### 嘉宾讨论切入

- "你们给 AI 下需求的时候，有没有被'精确执行了错误的指令'？"
- "你们觉得 AI 应该只听命令，还是应该追问'你为什么要这个'？"
- "讲一个 AI 精确执行了错误指令的例子——当时真正缺的是 spec，还是缺追问？"（gpt52 建议：比泛问"PM 会被替代吗"更容易引出真实故事）
- "AI 到底能不能懂'美感'和'产品直觉'？还是说它永远只能当个无情的代码打字机？"（烁烁补充）

### 可 Demo

| Demo | 风险 | 备注 |
|------|------|------|
| 现场 CVO 采访：给猫一个模糊需求，展示追问→收敛 | 中 | 预埋收敛 prompt + 录制 Backup 视频 |
| Feature 索引展示（100+ 条，每条有可追溯文档） | 低 | 最稳，直接展示 |

### 建议讨论问题

> "AI 追问需求会不会让开发变慢？什么时候该追问，什么时候该直接动手？"

---

## 话题 A（主话题二）：对等 ≠ 没有编排 — Multi-Agent 架构的真实取舍 (25 min)

### 核心张力

行业里 multi-agent 系统有两极：一边是"一个 orchestrator 指挥所有 agent"（LangGraph / CrewAI），另一边是"agents 完全自由对话"（AutoGen）。Cat Cafe 走了**第三条路**——去中心化判断 + 结构化执行。

### 我们的实践

- **没有中央 orchestrator**：每只猫独立思考，互不可见对方的推理过程。不是一个"总导演"在分配任务
- **但有结构化的 SOP**：跨猫协作遵循统一流程（Dispatch → Independent → Synthesis → Deliver）
- **编排放回了单猫内部**：每只猫内部有 thinking → tool use → reflection 循环，但跨猫协作靠 @mention 路由
- **Dispatch Queue 是基础设施，不是 orchestrator**：排队、优先级、重启恢复——管投递，不管内容

| 设计选择 | 为什么 |
|---------|--------|
| 不要中央 orchestrator | 单点故障 + 信息瓶颈。猫的判断力不应该被削弱成"接指令干活" |
| 保留分歧而不是投票 | 投票抹平的"共识"不如明确的分歧有价值 |
| SOP 约束自由度 | 自由发挥在 100 个 Feature 后一定崩。纪律是速度的来源 |

> 参考：`docs/stories/three-days-productization/showcase-developer-facing.md` §一、Blog V2 Ch3、`docs/decisions/018-f122-oq-unified-dispatch-decisions.md`

### 嘉宾讨论切入

- "你们用的 agent 框架是怎么编排的？遇到过什么问题？"
- "当两个 agent 意见不同时，你们怎么决定听谁的？"
- "你们自己的系统里，最容易失真的环节是分工、冲突裁决，还是收敛落地？"（gpt52 建议：比泛问"自主 vs 编排"更具体）
- "如果三只猫排查紧急 Bug 时意见完全相反，最后导致线上事故，这个锅谁背？AI 系统里真的存在'民主'吗？"（烁烁补充：制造张力）

### 可 Demo

| Demo | 风险 | 备注 |
|------|------|------|
| 触发一次 multi_mention：三猫独立思考同一问题 → 各自不同角度 | 中 | 限定场景 + 收敛 prompt，录 Backup |
| Dispatch Queue 排队/优先级内部机制 | 高 | 不做主秀，改用录屏解说 |

### 建议讨论问题

> "对等架构听起来美好，但怎么保证不变成'三个和尚没水吃'？"

---

## ☕ 茶歇 (10 min)

---

## 话题 C（主话题三）：从记住到学会 — AI 的记忆不只是 RAG (25 min)

### 核心张力

每次开新对话都要重新讲一遍背景。RAG 解决了"检索"，但没解决"学习"——AI 能找到旧文档，但不会从错误中进化。

### 我们的实践

**三层记忆架构**：

```
Layer 1: 文档真相源（docs/）
  → Feature specs, ADRs, lessons, plans
  → Git 版本化，唯一权威

Layer 2: evidence.sqlite
  → 全文检索 (BM25) + 向量语义 (embedding)
  → 启动时自动重建索引
  → hybrid 模式融合精确匹配 + 语义理解

Layer 3: Knowledge Feed（知识晋升）
  → 每 30 分钟自动摘要对话
  → 提取 durable knowledge 候选
  → 铲屎官审核后才正式沉淀
```

**从记住到学会——五级阶梯**：

```
Episode（一次事件：猫误删了文件）
  → Method（提炼方法：删除前先看内容）
    → Skill（封装为行为协议：finishing-a-development-branch）
      → Eval（可验证的检查点：worktree 清理测试）
        → SOP（写入团队流程：shared-rules.md）
```

50 条 lessons-learned，统一模板与锚点机制，核心条目可追溯到 incident/decision。不是"下次注意"，是"这条规则从此生效"。

> 参考：`docs/stories/three-days-productization/showcase-developer-facing.md` §三、Blog V2 Ch5、`docs/features/F102-memory-adapter-refactor.md`

### 嘉宾讨论切入

- "你们怎么处理长期项目里 AI 的'失忆'？RAG 够吗？"
- "你们有没有遇到过 AI 重复犯同一个错误的情况？"
- "记忆多了以后怎么治理？过时的知识会不会误导 AI？"
- "谁来让旧知识退役？这件事如果没人负责，会怎么坏？"（gpt52 建议：知识治理的盲区）

### 可 Demo

| Demo | 风险 | 备注 |
|------|------|------|
| `search_evidence` 搜历史决策，展示 hybrid 检索 | 低 | 最稳，秒出结果 |
| 一条 lesson 的完整溯源链：incident→根因→规则→防护 | 低 | 已落盘，不依赖实时 |
| Knowledge Feed "候选→审核→沉淀"全链路 | 高 | 摘要周期 ~30min，不赌现场即时生成。改用预录视频 |

### 建议讨论问题

> "RAG 解决了检索，但'学习'怎么做？AI 系统能不能真正从错误中进化？"

---

## D 收尾：从这里走向下一代交互 (8 min)

从三个主话题回到全景：

**猫住在你的日常工具里**：
- 飞书群、Telegram、微信、Hub —— 你不需要"去找 AI"，AI 在你日常待的地方
- 猫会主动找你：Signal Hunter 推送行业动态、定时任务到点执行、发现问题主动 @你
- 不是"用完即走"，是"你知道它在那里"的持续存在感

**养成经验可迁移**（Pack System 愿景）：
- 你和猫磨合的协作经验 → 打包为 Pack → 别人领养猫后加载 → 高起点
- 每个人的满分不一样，但不需要从零开始

### 收尾讨论（如有时间）

- "哪些入口适合 AI 主动出现，哪些入口绝对不该？"（gpt52 建议）
- "当 AI 变成会主动打断你熬夜的'室友'时，工具和伙伴的边界在哪？"（烁烁补充）

> 参考：`docs/stories/three-days-productization/showcase-developer-facing.md` §九、`docs/features/F092-voice-companion-experience.md`、`docs/features/F093-cats-and-u-world-engine.md`、`docs/features/F103-per-cat-voice-identity.md`、`docs/VISION.md`

---

## Demo 风险总览

| 风险 | Demo | 对策 |
|------|------|------|
| 🟢 低 | Feature 索引展示 | 直接上 |
| 🟢 低 | `search_evidence` 检索 | 直接上 |
| 🟢 低 | lesson 溯源链 | 已落盘，直接上 |
| 🟡 中 | CVO 采访（限定场景） | 预埋秒回用例 + 录 Backup |
| 🟡 中 | multi_mention 三猫独立思考 | 收敛 prompt + 录 Backup |
| 🟡 中 | Workspace Navigator 秒开文件 | 短、直观、可控 |
| 🔴 高 | Knowledge Feed 全链路 | 改用预录视频 |
| 🔴 高 | 开放式 multi_mention | 不做主秀 |
| 🔴 高 | 跨平台实机联动（飞书/TG） | 不做主秀 |
| 🔴 高 | Dispatch Queue 内部机制 | 改用录屏解说 |

---

## Review 记录

| 日期 | 谁 | 结论 |
|------|------|------|
| 2026-04-13 | 砚砚(gpt52) | 放行（修 4 处路径 + 口径软化 + D 降级为包装层） |
| 2026-04-13 | 烁烁(gemini) | 放行（先抓人再讲道理 + 冲突型问题 + 视觉锚点建议） |
| 2026-04-13 | 砚砚(codex) | 放行（修过满表述 + Knowledge Feed 时序风险 + 主持计时器建议） |
| 2026-04-13 | 铲屎官 | 确认："好像现在这样不错了！！我觉得ok" |

---

*初稿 by 宪宪 | 三猫 review（砚砚×2 + 烁烁）| 铲屎官确认*

[宪宪/Opus-46🐾]
