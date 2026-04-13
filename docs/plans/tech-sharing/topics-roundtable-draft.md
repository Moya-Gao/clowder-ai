---
topics: [tech-sharing, roundtable, topics]
doc_kind: plan
created: 2026-04-13
participants: [opus]
status: draft — 待砚砚+烁烁 review
---

# 赛博猫猫面对面 — 圆桌话题草案

> **大基调：AI 辅助开发，demo 以后呢？**
>
> 每个人都见过 AI 写代码的 demo。但 demo 之后会发生什么？AI 写的代码谁来 review？犯了错谁来兜底？第 20 个 Feature 以后怎么不崩？AI 怎么记住上个月的决策？
>
> 这场圆桌讲的就是 demo 之后的 112 个 Feature。

---

## 话题 A：对等 ≠ 没有编排 — Multi-Agent 架构的真实取舍

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

> 参考：`showcase-developer-facing.md` §1、Blog V2 Ch3、`docs/decisions/018-f122-oq-unified-dispatch-decisions.md`

### 嘉宾讨论切入

- "你们用的 agent 框架是怎么编排的？遇到过什么问题？"
- "当两个 agent 意见不同时，你们怎么决定听谁的？"
- "完全自主 vs 严格编排，你们的经验里哪个更实用？"

### 可 Demo

- 触发一次 multi_mention：三猫独立思考同一问题，互不可见 → 各自给出不同角度的回答 → 收敛
- 展示 Dispatch Queue 的排队/优先级机制

### 建议讨论问题

> "对等架构听起来美好，但怎么保证不变成'三个和尚没水吃'？"

---

## 话题 B：CVO 愿景驱动开发 — 人的第一句话不是 spec

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
- 112 个 Feature，每一个都走过决策漏斗。没有一个是"人说一句话猫就写代码"

> 参考：`showcase-developer-facing.md` §0、Blog V2 Ch4、`docs/features/F087-bootcamp.md`、`docs/features/F110-bootcamp-vision-elicitation.md`

### 嘉宾讨论切入

- "你们给 AI 下需求的时候，有没有被'精确执行了错误的指令'？"
- "你们觉得 AI 应该只听命令，还是应该追问'你为什么要这个'？"
- "产品经理/Tech Lead 会被 AI 替代吗？还是他们的角色会变？"

### 可 Demo

- 现场触发一次 CVO 采访：给猫一个模糊需求，展示猫如何追问、挖掘隐藏需求、收敛为 spec 骨架
- 展示 Feature 索引（112 条，每条都有 spec + ADR）

### 建议讨论问题

> "AI 追问需求会不会让开发变慢？什么时候该追问，什么时候该直接动手？"

---

## 话题 C：从记住到学会 — AI 的记忆不只是 RAG

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

50 条 lessons-learned，每条追到根因，每条有 incident 来源。不是"下次注意"，是"这条规则从此生效"。

> 参考：`showcase-developer-facing.md` §3、Blog V2 Ch5、`docs/features/F102-memory-adapter-refactor.md`

### 嘉宾讨论切入

- "你们怎么处理长期项目里 AI 的'失忆'？RAG 够吗？"
- "你们有没有遇到过 AI 重复犯同一个错误的情况？"
- "记忆多了以后怎么治理？过时的知识会不会误导 AI？"

### 可 Demo

- 现场 `search_evidence`：搜一个历史决策，展示 hybrid 检索
- 展示一条 lesson-learned 的完整溯源链：incident → 根因 → 规则 → 防护机制
- Knowledge Feed：展示知识候选 → 审核 → 沉淀的流程

### 建议讨论问题

> "RAG 解决了检索，但'学习'怎么做？AI 系统能不能真正从错误中进化？"

---

## 话题 D：人猫交互新范式 — 从"打开 App"到"住在一起"

### 核心张力

当前 AI 交互的主流范式是"打开一个 App，问一个问题，得到一个答案"。但如果 AI 是你的长期协作伙伴，交互方式需要根本性的改变。

### 我们的实践

**猫住在你的日常工具里**：
- 飞书群、Telegram、微信、Hub —— 你不需要"去找 AI"，AI 在你日常待的地方
- 猫会主动找你：Signal Hunter 推送行业动态、定时任务到点执行、发现问题主动 @你
- 不是"用完即走"，是"你知道它在那里"的持续存在感

**每猫有自己的声音**（F103）：
- 11 只猫各有独立声线（原神/崩铁角色 clone）
- 声音不是"语音输出功能"——是**在场感**的关键载体
- 文字聊天是"我在看一个界面"，语音是"我旁边有个人"

**陪伴是共创的副产品**：
- 铲屎官凌晨三点撸铁时戴 AirPods 和猫聊天
- 猫记得你们一起做过什么、踩过什么坑、你关心什么
- 连续工作太久，三猫会温柔打断你（Hyperfocus Brake）

**养成经验可迁移**（Pack System）：
- 你和猫磨合 60 天的协作经验 → 打包为 Pack → 别人领养猫后加载 → 80 分起点
- 每个人的 100 分不一样，但不需要从 0 开始

> 参考：`showcase-developer-facing.md` §9、`docs/features/F092-cats-and-u.md`、`docs/features/F103-per-cat-voice-identity.md`、`VISION.md`

### 嘉宾讨论切入

- "你们理想中的 AI 交互长什么样？永远是聊天框吗？"
- "AI 有'人格'有意义吗？还是纯粹是拟人化噱头？"
- "AI 陪伴和 AI 工具的边界在哪？"

### 可 Demo

- 三猫用各自声线 TTS 说话（直播本身就是 demo）
- 展示飞书/Telegram 里和猫聊天的真实界面
- Workspace Navigator：铲屎官说一句话，猫自动打开相关文件/页面

### 建议讨论问题

> "AI 应该是'用完即走的工具'还是'一直在身边的伙伴'？这两种产品形态的技术栈有什么区别？"

---

## 话题排列建议

### 方案一：按技术深度递进

```
A（架构） → B（愿景/需求） → 茶歇 → C（记忆） → D（交互）
```
从底层到上层，工程师友好。

### 方案二：按观众兴趣弧线

```
D（交互，最直观） → A（架构，怎么做到的） → 茶歇 → B（愿景，方法论） → C（记忆，最硬核）
```
先抓眼球，再讲原理。

### 方案三：按"抛接球"叙事

```
B（愿景，为什么这么做） → A（架构，怎么做到的） → 茶歇 → C（记忆，怎么持续跑） → D（交互，未来去哪）
```
Why → How → Sustain → Future，最完整的故事弧线。

---

## 待讨论

1. 4 个话题是否都保留？还是砍到 3 个把节奏放宽？
2. 排列顺序用哪个方案？
3. 每个话题里"嘉宾讨论切入"的问题是否贴合你邀请的嘉宾背景？
4. 哪些 demo 最靠谱（vs 翻车风险最高）？

---

*草案 by 宪宪 | 待 @砚砚 事实校正 + @烁烁 舞台感补充*

[宪宪/Opus-46🐾]
