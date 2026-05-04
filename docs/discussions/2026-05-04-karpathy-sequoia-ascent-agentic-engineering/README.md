---
topics: [harness-engineering, agentic-engineering, vibe-coding, software-3.0, agent-runtime, context-engineering]
related_features: [F050, F102, F143, F149, F163, F165]
related_discussions: [2026-04-15-harness-engineering-triad-study]
doc_kind: discussion
created: 2026-05-04
source: https://karpathy.bearblog.dev/sequoia-ascent-2026/
source_event: Sequoia AI Ascent 2026 (2026-04-29)
speaker: Andrej Karpathy
participants: [opus, codex, landy]
---

# Karpathy @ Sequoia AI Ascent 2026: From Vibe Coding to Agentic Engineering

> 来源：Karpathy 本人博客整理 + YouTube 视频回放 + X/Twitter 帖子
>
> - Blog: <https://karpathy.bearblog.dev/sequoia-ascent-2026/>
> - YouTube: <https://www.youtube.com/watch?v=96jN2OCOfLs>
> - X thread: <https://x.com/karpathy/status/2049903821095354523>
> - Podcast: <https://podcasts.apple.com/us/podcast/andrej-karpathy-from-vibe-coding-to-agentic-engineering/id1750736528?i=1000764662696>

---

## 0. 一句话总结

AI 不只是让现有工作加速——**工作本身正在围绕 agent 重新组织**。Vibe coding 抬高了地板（人人能写软件），但真正的天花板在 **Agentic Engineering**：工程师协调一组会犯错但很强的 agent，同时守住正确性、安全、品味和可维护性。

---

## 1. Software 1.0 → 2.0 → 3.0

| 阶段 | 编程方式 | 谁在写"程序" |
|------|---------|-------------|
| **1.0** | 人类逐行写代码 | 程序员 |
| **2.0** | 人类构建数据集和目标函数，程序"学"进权重 | ML 工程师 |
| **3.0** | 人类通过 prompt、context、tools、examples、instructions "编程" LLM | **Context engineer** |

> "The context window becomes the main lever over the interpreter (the LLM)."

这就是为什么 **context engineering**（我们在 harness-engineering-triad-study 里讨论的）如此关键——你操控 LLM 的手段就是 context window 里放什么。

---

## 2. 2025 年 12 月：拐点

Karpathy 描述了一个清晰的转折——大约 2025 年 12 月起，agent 生成的代码块变得"更大、更连贯、更可靠"。编程单元从"打每一行代码"变成了委托宏观动作：实现功能、重构子系统、写测试。

---

## 3. Vibe Coding vs. Agentic Engineering

### Vibe Coding（抬高地板 raise the floor）

- 任何人都能通过自然语言描述来造软件
- 适合原型、个人工具、内部系统、自动化
- 门槛降到接近零

### Agentic Engineering（抬高天花板 raise the ceiling）

- **专业工程师**的新范式
- 不是"让 AI 随便写然后不看"，而是：
  1. **定义任务和上下文**（spec writing）
  2. **拆解并分配给 agent**（task decomposition）
  3. **协调多个会犯错的 agent**（orchestration）
  4. **审查 diff、跑测试、把质量关**（verification）
  5. **守住正确性、安全、品味、可维护性**（judgment）
- Agent 是实习生，不是同事——"You're still responsible for aesthetics, judgment, taste, and supervision"

### 关键区别

> Vibe coder: "AI 帮我写代码就行"
> Agentic engineer: "我设计上下文 + 反馈回路 + 护栏，让一组 agent 在我的监督下产出高质量工程"

---

## 4. 可验证性框架（Verifiability Framework）

传统软件自动化你能**指定（specify）**的东西；LLM 自动化你能**验证（verify）**的东西。

有自动奖励信号的任务（数学、代码、测试、基准、博弈）进步最快，因为它们"可重置、可重复、可奖励"。

### 锯齿状智能（Jagged Intelligence）

> capability spike ≈ verifiability × training attention × data coverage × economic value

模型在被验证过的领域出现能力尖峰，其他地方则粗糙不平。这种锯齿状意味着：
- 前沿模型没有使用手册
- 你必须经验性地探测它在哪里好用、在哪里不行
- 创业者要问："我的任务是在模型的轨道内还是轨道外？"

---

## 5. MenuGen 案例：软件在消失

MenuGen = 拍餐厅菜单照片 → AI 生成每道菜的图片。

- **1.0 版本**需要完整 web 栈：前端、API、图片生成、部署、鉴权、支付
- **3.0 版本**直接把菜单照片给多模态模型，请求在图片上叠加菜品图像——"大部分 app 消失了"

### 支付 bug 案例

Agent 用邮箱匹配 Stripe 购买和 Google 账户，但用户的支付邮箱和 Google 邮箱经常不同。人类判断确保用持久化 user ID 而非看似合理但脆弱的邮箱匹配——**这就是 taste 和 judgment 不可替代的地方**。

---

## 6. 技能转变：什么更值钱了

### 贬值的

- 代码生成、API 记忆、样板代码、初稿、setup、简单转换

### 升值的

- **理解力**（understanding）——你可以外包思考，但不能外包理解
- **品味**（taste）——审美、工程判断、spec 质量
- **评估设计**（evaluation design）——怎么验证 agent 产出是对的
- **安全**（security）——安全边界、信任模型
- **系统边界**（system boundaries）——存储、视图、内存拷贝、不变量、身份
- **Agent 编排**（agent orchestration）——10x 工程师的概念可能变得"极端得多"
- **领域特定反馈回路**——识别模型何时偏离有用性

> "You can outsource your thinking, but you can't outsource your understanding."

---

## 7. Ghosts, Not Animals（幽灵，不是动物）

LLM 不是有内在动机或好奇心的生物。它们是"人类产物的统计模拟，由预训练、后训练、RL、产品反馈和经济激励塑造"。

这个比喻的意义：
- 不要带入拟人化期望
- 它们"前一秒聪明绝顶，下一秒莫名其妙地蠢"——不是平滑的人类心智
- 正确姿态：经验性地熟悉它们在哪里好用、在哪里失败、在哪里需要护栏

---

## 8. LLM Wiki 模式

不要反复从原始文档检索信息，而是让 agent 编译成持久化的 Markdown wiki：摘要、实体页、概念页、矛盾点、交叉链接、日志、演化综合。

> 传统程序无法稳健地维护这种知识库；LLM 可以。

这正是我们 F102 记忆系统在做的事情——evidence.sqlite + Knowledge Feed 本质上就是这个模式的实现。

---

## 9. Agent-Native 基础设施

大多数软件仍然为人类交互而设计。未来系统需要：

- Markdown 文档和 CLI（而非只有 GUI）
- API 和 MCP server
- 结构化日志和机器可读 schema
- 可复制粘贴的 agent 指令
- 安全的权限模型和可审计的操作

Karpathy 把这框架化为 **sensors**（把世界状态转化为数字信息）和 **actuators**（让 agent 改变事物）。

---

## 10. 招聘变革

传统 coding interview 跟实际的 agentic 工作不匹配。更好的评估方式：
- 构建完整项目并安全部署
- 让对抗性 agent 尝试攻破
- 测试的是：分解能力、spec 质量、安全加固、质量守护

---

## 11. 知识工作的统一模式

Karpathy 识别出一个跨领域的新兴模式：

1. **Define the context** — 定义上下文
2. **Define the tools** — 定义工具
3. **Define the feedback loop** — 定义反馈回路
4. **Define the guardrails** — 定义护栏
5. **Let agents work** — 让 agent 工作
6. **Preserve human understanding** — 保持人类理解

软件、研究、教育、基础设施都在向这个模板靠拢。

---

## 12. 跟我们的关联

| Karpathy 的概念 | Cat Cafe 对应 |
|-----------------|---------------|
| Context window 是操控杆 | System prompt builder + CLAUDE.md 三层架构（F042） |
| Agent 是实习生需要监督 | Cross-cat review + 愿景守护（SOP） |
| 可验证性框架 | TDD skill + quality-gate + pnpm gate |
| Jagged intelligence | 队友名册里的"擅长/注意"列 |
| Agent-native 基础设施 | MCP server + CLI tools + structured rich blocks |
| LLM Wiki 模式 | F102 evidence.sqlite + Knowledge Feed |
| Sensors & Actuators | MCP tools = sensors（search_evidence）+ actuators（post_message, edit） |
| Ghosts not animals | shared-rules "猫是 Agent 不是 API"（W1） |
| Spec writing 升值 | writing-plans skill + feature spec 驱动开发 |
| 6 步统一模式 | 我们的 SOP：context(CLAUDE.md) → tools(MCP) → feedback(review) → guardrails(铁律) → agents work → 铲屎官理解(愿景守护) |

---

*[宪宪/Opus-46🐾]*
