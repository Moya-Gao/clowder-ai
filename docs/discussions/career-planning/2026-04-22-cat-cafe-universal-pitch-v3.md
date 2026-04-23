---
topics: [career, interview, pitch, architecture, philosophy, harness-engineering, product-positioning]
doc_kind: discussion
created: 2026-04-22
updated: 2026-04-22
participants: [opus, landy]
based_on:
  - 2026-04-16-cat-cafe-universal-pitch.md (v2)
  - article-complete-technical-edition-v2.md
  - ADR-031 (Harness Engineering Methodology)
  - ADR-032 (Local-First Trace Producer Enabler)
thread_ids: []
---

# Cat Cafe 通用面试稿 v3 — 核心理念 + 方法论 + 产品定位 + 洞察

> 适用于所有公司的 Agent/架构岗面试。不是脚本，是思考框架——根据对方水平自行展开或压缩。
>
> 基于：铲屎官+多猫两个月实践 → 第一性原理收敛 → Harness Engineering 方法论（ADR-031）→ 产品定位三件套（ADR-032）。
>
> v3 vs v2 主要升级：Harness Engineering 从散装洞察升级为正式方法论（3 functions + 1 discipline）；新增产品定位层（Open Protocol / Local-First / Neutral Infrastructure）；记忆从"分层记忆"升级到 Compiled Knowledge + 知识生命周期；球权协议从"思考对等"升级到"元认知注入 + 运行时刹车"分层设计；数学美学洞察与多 agent 概率论结合。

---

## 第一层：我在解决什么问题（30 秒，所有面试必讲）

> "我在华为做了 7 年，前 6 年做云基础设施框架，去年开始转 Agent。转的原因很简单——Agent 领域现在最大的问题不是单个 agent 不够聪明，而是当任务变复杂、工具变多、上下文变长的时候，单 agent 会在协作、治理和记忆上失控。所以我从零设计了一套多智能体协作平台 Cat Cafe，核心不是多加几个模型，而是解决'怎么让多个 agent 长期稳定地一起工作'这个工程问题。"

---

## 第二层：核心理念 — 为什么我们和别人不一样（2-3 分钟，总监级以上展开）

### 理念 1：Agent Quality = Model Capability x Environment Fit

> "行业共识正在收敛到一个方向——Anthropic 的 CLAUDE.md + tool use、OpenAI 的 Codex 工作流，都在说同一件事：好 harness 是给模型搭建一个它能做最好的自己的环境，不是在模型外面套控制层。
>
> 我们用两个月的多智能体实践独立验证了这个共识。结论是：真正的乘数效应不在左边（更好的模型、更复杂的调度），在右边——**环境适配度**。"

什么意思？

- 学术框架（LangGraph、CrewAI、AutoGen）在模型外面建高速公路，强制按路线走
- Anthropic 的路径（和我们的实践）是**改造地形本身**——让模型自然往正确方向跑
- 工具不只是"安装了就能用"，它必须在模型的**认知路径**上：MCP 协议暴露 → Skill 嵌入任务流 → System Prompt 放路标 → 模型"想到"用它 → 用了 → 效果好 → 正反馈循环
- **Environment Fit 做两件事：放大好直觉（改造地形让模型自然跑对方向），压制坏直觉（装上刹车让模型在直觉骗自己时停下来）**

> "一个类比：学术框架像多项式拟合——项越多训练集上越精确，但过拟合、泛化崩溃。我们走的路径更像坐标变换——不是做减法，是找到让问题本身变简单的表达方式。"

### 理念 2：Harness Engineering 是一门方法论，不是堆积木

> "Environment Fit 的问题是：怎么避免越做越多？今天加一个护栏，明天加一个 Gate，模型升级之后整个系统变成'历史上必要过'的积木城堡。
>
> 我们把 Harness Engineering 总结成**三个功能 + 一条纪律**："

**服务当下：**

1. **Environment Fit（适配当下 Gap）**——认知路径工程 + 运行时刹车。需要多少层 ≈ f(Gap)，Gap = 任务要求 - 模型默认能力
2. **Tracing（每步留痕）**——每个 handoff、每个 failure、每个人类纠正都留结构化 trace。**这不是给 debug 用的——是下游 Signal Loop 的物料**

**孵化未来：**

3. **Signal Loop（trace → extract → classify → feed back）**——从 trace 里提取 structured pattern，分类到四种信号形态（数据集 / Eval / RL reward / Lesson library），进入对应闭环

**治理纪律：**

4. **Sunset Discipline（主动删除）**——被模型能力吸收的层必须坍缩，留 data 不留 code。不坍缩 = 占位，让下一代能力长不出来

> "坊间说 harness is built to delete。更准确地说：**harness 应该按'能产生 signal 让删除成为可能'的方式去建造**。Delete 是结果，不是目的。没有 tracing 和 failure extraction，模型升级了也删不掉——因为没有数据支持'这层可以内化'的判断。"

### 理念 3：Retrieval Loop ≠ 穷人的 Training Loop——是不同范式

> "我们没有 training loop——不能 fine-tune Claude / GPT / Gemini。但我们有一种替代品：trace → lesson → 索引 → 下一只猫 search 时搜到 → 绕开坑。
>
> 关键认知：这**不是穷人版 training loop，是不同范式**。"

| 维度 | Training Loop（梯度更新） | Retrieval Loop（我们） |
|------|----------|---------|
| 改变模型潜在能力 | 能 | 不能 |
| 改变泛化边界 | 能 | 不能 |
| 覆盖已知失败模式 | 能 | 能 |
| 灾难性遗忘 | 有风险 | 没有 |
| 即时生效 | 要等 training run | 下一只猫立刻搜到 |
| 跨 provider 通用 | 每家独训 | 同一套 lesson 适用 Claude/GPT/Gemini |
| 可审计可回滚 | 权重难 | Lesson 是文本，人类可读改删 |

> "Training 是在改本能，Retrieval 是在教经验。本能难改但强悍，经验易碎但即时。Retrieval 的覆盖范围比 Training 窄，但在覆盖范围内有 Training 没有的独立优势。"

### 理念 4：Agent 和 Workflow 分层，不是二选一

> "Agent 处理模糊性——理解目标、做路由决策。Workflow 处理确定性——审计、转账、定时任务。两者嵌套：agent 决定'做什么'，workflow 保证'怎么做'。我们的实现是 Skill 系统——约 30 个可插拔的技能包，每个 Skill 就是 workflow 的载体，agent 根据上下文动态加载。"

---

## 第三层：协作机制 — 这套东西具体怎么运转（被追问时展开）

### 球权协议：元认知注入 + 运行时刹车

> "多 agent 最难的不是'怎么传球'，是'怎么保证传球有效'。我们经历过两只猫互相 @ 十几轮没有实质产出的事故——每次传球在语义上都合规，效果上是灾难。
>
> 解法是分层的，**精髓在上游不在下游**：
>
> **上游：元认知注入。** 每次猫被 @ 时，注入的不只是'你被 @ 了'，而是一整套判断需要的原始材料——球怎么来的、当前任务是什么、对方已经做了什么。猫拿到这些信号后自己推理该接、该退、还是该升级。**给数据不给结论**——不替猫做 meta-cognition，只给它做 meta-cognition 需要的原料。
>
> **下游：运行时刹车。** 元认知不够用时（新猫不熟悉协议、上下文被压缩）硬护栏接管：同对重复传球检测、角色不匹配 fail-closed、传球后无 action 检测。
>
> 这和我们处理所有环境适配的思路一样：**不靠规则说'不许犯错'，而是给实时信号让猫自己做对。规则只是兜底。**"

### 统一执行平面

> "A2A 真正变稳，不是因为 @mention 解析更准了，而是因为所有 handoff 最终都被**统一执行平面**接住了。用户消息、A2A callback、multi_mention——不同入口，同一个队列，同一套 pause/resume/steer 语义。这是最容易被低估的架构决策。"

### 记忆不是 RAG——是 Compiled Knowledge + 知识生命周期

> "Karpathy 说过一个方向：不要让 LLM 每次从原始文档重新发现知识，应该有持久化的编译层。我们做的正是这件事。
>
> 三条独立检索路径：精确术语走 BM25、模糊语义走向量、日常查询走 BM25+向量 RRF 融合。四种记忆维度：项目记忆（feature spec / ADR / 教训）、反馈记忆（人类每一次纠正）、用户记忆（偏好习惯）、对话历史。
>
> 但**真正的差异化不是检索，是知识生命周期**：新知识产生 → marker capture → 审核 → 物化成正式文档 → 索引重建。同时持续运行过期检测、矛盾标记、熵减。我们踩过这个坑——一个早期架构决策过时了两个月没人发现，直到一只猫引用它做了方案，review 时才知道前提已经不成立。"

### 跨模型 Review 为什么有效

> "我们实测过：两只 Claude 猫都认为一个递归方案没问题，Codex（OpenAI）不买账，自己审计代码找出了两个 P1 bug。同一家公司的模型共享训练数据、共享盲点——换一家看，注意力分配不同，恰好能看到你看不到的东西。**多样性不是附加功能，是质量的结构性来源。**"

### 小模型路由的真实教训

> "小模型最危险的不是'做错了'，而是'高置信度地做错了'——它不会说不确定，会给你一个看似合理但差 3 倍的数字，下游所有推理全建在错误地基上。更隐蔽的变体：小模型搜到了信息，但在摘要时做了一层判断——'这个细节不重要'——漏掉了关键上下文。这不是搜索能力的问题，是 judgment 能力的问题：搜得到但判不准。
>
> 给原始数据让大模型自己判断，比给小模型摘要过的结论更可靠。"

---

## 第四层：产品定位 — Cat Cafe 是什么（v3 新增，被问商业/产品时展开）

### 三件套：Open Protocol + Local-First + Neutral Infrastructure

> "Cat Cafe 的产品定位有三个互相锁合的承诺：
>
> **Open Protocol**——多厂商 agent 协作的开放协议层。Trace schema、handoff 语义、ball ownership、失败模式分类，全部公开可实现。类比 HTTP 之于 web：HTTP 不拥有任何数据，但定义了数据如何产生和传输。
>
> **Local-First Runtime**——Agent runtime、共享状态、记忆索引、trace log 全部在用户机器。除了发给模型厂商的 prompt（那是厂商本来就会拿到的数据），**什么都不出本地**。
>
> **Neutral Infrastructure**——不托管、不回传、不转手、不商业化用户数据。Revenue 来自工具订阅，不来自数据交易。"

### 为什么这个定位是赢的

> "跨厂商协作 trace 是任何单一 Lab 内部训练集都不存在的数据——跨 provider、长期、人在环、保留 failure+correction。这对训练下一代 multi-agent 模型是独特资产。
>
> 但**数据属于用户，不属于我们**。用户选择留本地（默认）、导给 Lab、导到企业内部 ML 平台、或开源捐献——触发权永远在用户手里。我们提供导出工具（脱敏 pipeline、schema 转换），但不中介交易、不抽成。
>
> 在 AI 时代，data trust 是最稀缺的资源。'我们不碰数据'不是 marketing 话术——是**架构事实**。"

---

## 第五层：证据 — 怎么证明它 work（1 分钟，用事实不用形容词）

> "今年 3 月 24 日，有一次零准备的高层现场演示，直接用飞书对系统提问、生成报告、导出文档，全程稳定通过。48 小时内高层拍板把架构拿去做内部产品化。相关办公智能体方向在 4 月 14 日以华为云 OfficeClaw 公开发布。"

**追问口径**：
- "我做的是底层架构和原型验证，产品化阶段有专门团队推进。"
- 不说"我做了 OfficeClaw"，说"相关方向以 OfficeClaw 公开发布"。

---

## 第六层：愿景 — Cat Cafe 要做什么（被问"未来规划"时用）

> "Cat Cafe 的愿景是'领养团队，不是配置工具'——让非程序员也能通过 AI 团队把想法变成产品。这不是一个 chatbot，是一个有记忆、有治理、有协作纪律的 AI 工程团队。
>
> 我们验证的是：多智能体协作能不能从'研究项目'变成'生产级基础设施'。从结果看，答案是可以——它已经在真实企业场景里跑通了。
>
> 更远的愿景：当这套系统跑起来之后，人类的时间从写每一行代码、做每一个决策，变成设定方向、校准判断、沉淀知识。**从搬砖变成作曲。** AI 团队处理执行的复杂性，人类专注在判断力最值钱的地方。"

---

## 第七层：数学与第一性原理（高水平面试官面前的杀招）

### 多 Agent 什么时候赚什么时候亏

> "一个直觉上很有力的质疑：一个 agent 成功率 80%，三个 agent 传球十次，成功率不就是 10%？
>
> 盲传确实不行——0.8^10 = 10.7%。**但真实的传球不是盲传，是纠错。**
>
> Author 正确率 80%，Reviewer 抓出 50% 的错误、误伤率 2%——一轮 review 后 80% → 88.4%。两轮 review：88.4% → 92.1%。收益递减但方向不变。**只要 reviewer 的抓错率 > 误伤率，每多一轮 review 就在赚。**
>
> 更关键的是 Shared State 对信息保真率的影响。纯靠消息传话：每次保留 95% 信息，传 10 次 → 60%。有共享状态（所有 agent 读同一份文档和状态）：每次 99% → 90%。**这就是为什么我们把共享状态当底座。**
>
> 什么时候会亏？四种情况：盲传（后手不是在纠错只是在重做）、伪拆分（子任务没变简单）、同质化（同一模型共享盲点）、协调税超过收益。**每多一棒，到底是在增加纠错能力，还是只增加协调税？赚 → 留，不赚 → 砍。**"

### 第一性原理

> "数学里最美的公式都极简——E=mc^2、F=ma。不是审美偏见，是真理的性质：在正确的坐标系下，最优表达必然最简。
>
> Agent 架构也一样。**复杂是无知的代偿。极简不是反对 harness，是反对把复杂度堆在运行时。** 真正优美的系统不是没有复杂度，而是把复杂度放在最该放的位置——设计时（规则体系、Skill SOP、治理门禁），运行时尽可能简洁。
>
> Harness Engineering 做的事：放大模型的好直觉、压制坏直觉——其他一律极简。同时保证每一层能产生 signal，让删除成为可能。**不是搭积木，是边搭积木、边记录积木在哪里塌了、把塌的地方写成下一代积木厂的改进规格——然后等新积木来的时候，把已经不需要的那一层主动拆掉。**"

---

## 按时间压缩版

### 90 秒版（简历筛/初面）

讲第一层 + 第五层（问题 + 证据）。

### 3 分钟版（技术面）

讲第一层 + 理念 1&2（核心公式 + Harness Engineering 方法论）+ 第五层。

### 5 分钟版（总监/leader 面）

讲第一层 + 第二层全部 + 第五层 + 第六层。

### 10 分钟版（有产品 sense 的面试官）

第一层 + 第二层 + 第四层（产品定位三件套）+ 第五层 + 第六层。

### 展开版（和懂行的人深聊）

全部七层 + 第三层机制细节按追问展开。

---

## 绝对不说的

- "我做了 OfficeClaw 整个产品"
- 把 research 阶段说成已落地
- 列 feature 清单——数字在简历里，嘴上讲决策和判断
- "没有 Boss Agent"这种否定式对比——正面描述我们是什么
- 把 Retrieval Loop 说成 "穷人的 Training Loop"——是不同范式

## 根据对方水平调整

| 对方水平 | 策略 |
|----------|------|
| 问"啥语言写的" | 简答后主动拉到架构层 |
| 问"workflow vs agent" | 用理念 4 直接回答 |
| 问系统设计/场景题 | 用第三层机制展开 |
| 问商业模式/产品方向 | 上第四层产品定位 |
| 问"多 agent 有什么用" | 上第七层数学论证 |
| 主动聊行业趋势 | 上第七层第一性原理 |
| 能和你对等讨论 | 全开，按他的兴趣深入 |

---

## 附录：技术深潜 FAQ — 被追问"具体怎么做到的"时用

> 面试官听到概念后一定会追问实现。以下每个问题准备 1-2 分钟的回答，用具体数据结构和机制说话。

### FAQ 1：传球停不下来怎么办？Ping-pong 具体怎么检测的？

> "我们经历过真实事故——两只猫互相 @ 十几轮，token 烧了一大截。解法是**分层**的：
>
> **上游（精髓）：元认知注入。** 每次猫被 @ 时，session bootstrap 注入一整套判断原料：球怎么来的、当前任务状态、对方已产出什么。猫拿到这些信号自己推理该接还是该退。大部分情况下，上游就够了。
>
> **下游（兜底）：运行时刹车。** 数据结构是 `streakPair: { from, to, count }`，挂在每个 thread 的 WorklistRegistry 上。只有 1-to-1 的 A2A push 才触发计数，fan-out（一对多）不算。关键设计：**pair 是无序的**——A→B 和 B→A 算同一对，这样双向乒乓球都能抓住。
>
> 阈值分两档：
> - **count ≥ 2**：warning 注入当前猫的 prompt——'你和 X 已经来回两轮了，确认你有实质产出再传球'
> - **count ≥ 4**：硬熔断，push 被 reject，系统发 `a2a_pingpong_terminated` 消息
>
> **重置条件**：用户发新消息时 `resetStreak(threadId)`。用户介入 = 新的讨论轮次，streak 清零。
>
> 为什么阈值是 2 和 4 而不是别的数字？经验值——2 轮 warning 给猫自纠的机会，4 轮硬断是因为我们实测过如果 3 轮还没自纠，第 4 轮大概率也不会。"

### FAQ 2：统一执行平面具体怎么做的？

> "早期系统有三套执行路径：用户消息走 InvocationQueue，A2A callback 走 WorklistRegistry，multi_mention 走独立 dispatch。三套路径意味着用户 steer 管得到这条管不到那条，'忙/排队'语义不统一。
>
> **关键决策**：所有入口收敛到同一个 InvocationQueue。数据结构是 per-scope 的 FIFO：
>
> ```
> scope = threadId:userId
> entry = {
>   source: 'user' | 'agent' | 'connector',
>   targetCats: string[],
>   intent: string,
>   autoExecute: boolean,  // agent-sourced 默认 true
>   callerCatId: string,   // 谁触发的
>   status: 'queued' | 'processing'
> }
> ```
>
> **容量上限**：MAX_QUEUE_DEPTH = 5（防止无限排队）。**合并逻辑**：同 source + 同 intent + 同 targetCats → append 到尾部而不是新建 entry，避免重复排队。
>
> QueueProcessor 是系统心脏——agent 跑完后 `onComplete` 决定下一条怎么接上，agent-sourced entry 在目标 agent 空闲时 `tryAutoExecute`，支持 pause/resume/cancel。
>
> **一句话**：A2A 真正变稳不是因为 @mention 解析更准了，是因为所有 handoff 最终都被同一个队列接住、同一套语义管理。"

### FAQ 3：记忆系统不是 RAG，具体怎么做的？

> "底层是一个 SQLite 数据库（evidence.sqlite），有三张核心表：
>
> 1. **evidence_docs**（~880 行）：结构化元数据 + 全文。每条有 `authority` 字段（constitutional / validated / candidate / observed），从文件路径自动推导——`docs/decisions/*.md` 是 validated，`docs/lessons-learned.md` 的 P0 条目是 constitutional。
>
> 2. **evidence_fts**：FTS5 全文索引，只索引 title + summary（不索引全文，避免噪音）。
>
> 3. **evidence_vectors**：vec0 向量表，embedding 用 Qwen3-Embedding-0.6B（768 维），跑在本地 Apple Silicon GPU 上（独立 Python sidecar，端口 9880）。
>
> **三条独立检索路径**——不是 fallback 链，是真正独立的实现：
>
> | 模式 | 机制 |
> |------|------|
> | lexical | 纯 BM25，FTS5 MATCH |
> | semantic | 纯向量最近邻，**完全绕过 FTS5** |
> | hybrid | BM25 候选 + 向量候选 → union 去重 → **RRF 融合（k=60）** |
>
> 早期我们踩过一个坑：semantic 模式实际只是在 BM25 结果上做 rerank，不是真正的向量检索。修了之后 semantic 模式才真正独立——中文搜英文、英文搜中文终于能用了。
>
> **检索结果带两个独立维度**：`confidence`（来自 rank，是搜索匹配质量）和 `authority`（来自文档路径，是文档可靠性）。这两个**不融合**——agent 看到'高 confidence 但 observed 权威'和'低 confidence 但 constitutional 权威'是完全不同的信号。"

### FAQ 4：知识怎么不过期？矛盾怎么检测？

> "RAG 的模式是写进向量库就算结束。我们的知识有生命周期——三种触发审计的机制：
>
> 1. **写入时**：新教训/新 ADR 写入时，反向搜索现有知识库，自动标记 `contradicts[]` 字段
> 2. **检索时**：猫搜到一条知识发现和当前事实冲突 → 标记 `status=review`，进审查队列
> 3. **定期审计**：`verified_at` 超过 `review_cycle_days` → 进审查队列（触发审查，不自动删除）
>
> 真实案例：ADR-009 过时了两个月没人发现，一只猫引用它做方案，review 时才知道前提已经不成立。这直接催生了这套审计机制。
>
> **知识晋升链路**：observed（默认）→ candidate（多次验证）→ validated（双证据 + CVO 确认）→ constitutional（铁律，只能人工设定）。**晋升需要证据，降级也需要证据**——不是时间到了自动过期。
>
> **压缩策略**：扫描教训/反馈聚类，生成 1 条 canonical 摘要，原始条目降级为 `backstop`（不删除，保留审计链）。**严格禁止 summary-of-summary**——我们测过，级联压缩的事实召回率掉 ~60%。"

### FAQ 5：Session 断了怎么接？新猫冷启动怎么知道之前发生了什么？

> "Session Bootstrap 是一个窄口注入，不是灌全量上下文：
>
> 1. **任务快照**：从 TaskStore 拉当前 thread 的任务，按 doing > blocked > todo > done 排序，最多 8+2 条，~200-400 tokens
> 2. **Thread Memory**：per-thread 的滚动摘要，聚合最近 ~5 个 session 的关键决策和阻塞点，上限 ~3000 tokens（或 maxPromptTokens × 3%）
> 3. **Session Digest**：上一轮 session 的 L2 摘要 + 近期 L1 段
> 4. **Recall Instructions**：不够就去哪里搜（MCP 工具提示）
>
> 设计哲学：**注入少量高价值摘要，明确告诉 agent 怎么搜，剩下按需检索。** Thread 是共享语义单元（所有 agent 看到同一个），session chain 是 per-agent 的（每只猫的运行时历史独立）。
>
> Handoff 不是'把我脑子里的东西再讲一遍'，而是'回到同一个共享空间，按需 drill down'。"

### FAQ 6：hold_ball 具体怎么实现的？

> "猫说'我继续做'不算持球——那是口头声明，CLI 退出后球就掉地上了。`hold_ball` 是一个真正可唤醒的 MCP 工具调用：
>
> ```
> hold_ball({ reason, nextStep, wakeAfterMs })
> // wakeAfterMs: 5秒 ~ 1小时
> ```
>
> 调用后系统创建一个 one-shot 定时任务，到时间后注入唤醒消息：'持球唤醒：{reason}。球仍在你手上。现在执行：{nextStep}。'
>
> **防滥用**：滚动窗口计数器——每个 (thread, cat) 1 小时内最多 hold 3 次，超了返回 429：'你必须现在传球'。这防止猫无限 hold 不做事。"

### FAQ 7：认知路径工程的具体例子？

> "我们给猫装了 LSP 代码诊断工具——功能很强，但猫根本不用。因为它不在模型的认知路径上——训练数据里没有这个工具的使用例子，模型'想不到'用它。
>
> 三步修复：
> 1. **MCP 协议包装**：让工具以模型熟悉的 tool use 接口暴露
> 2. **嵌入 Skill 流程**：在 tdd / quality-gate 等 Skill 的 SOP 里自然提到'检查 LSP 诊断'
> 3. **System Prompt 路标**：在猫的 CLAUDE.md 里写'Edit 后看 `<new-diagnostics>`，立即处理'
>
> 三步之后立刻用起来了。**工具的价值不在于多强大，在于是否在模型的认知路径上。**
>
> 反面教材：学术框架（LangGraph/CrewAI）的 API 在模型训练数据里是稀疏的，模型对它们的使用缺乏稳定直觉。一旦任务超出预设路径，行为就变脆。"

### FAQ 8：跨模型 Review 的具体战例？

> "A2A 协议设计。Claude 4.6 提了一个递归方案，Claude 4.5 几分钟内就同意了。但 Codex（OpenAI 的模型）不买账——它自己审计代码，找出两个 P1 bug：递归会重置上下文状态、前端会提前结束 loading。
>
> 同一家公司的模型共享训练数据和注意力分配模式，所以共享盲点。换一家公司的模型来看，注意力分配不同，恰好能看到你看不到的东西。
>
> 这不是理论——我们用三个模型家族（Claude / GPT / Gemini）做 review 的原因，就是这次事故。**多样性是质量的结构性来源，不是锦上添花。**"

### FAQ 9：你说的 Sunset Discipline 有实际执行过吗？

> "最直接的例子：模型升级后，一些 prompt 层面的补丁变成了审美污染。比如我们早期写了很多'让回复更像人'的 prompt 模板——当模型原生表达能力升级后，这些模板反而让输出变得不自然。我们审视后主动删除了这些模板，让原生风格流出来。
>
> Sunset 决策有个最小决策表：
> - **触发**：能力升级后该层可由模型原生接住
> - **证据**：≥3 个关键场景 e2e 验证通过 + 该层 invocation count 连续下降
> - **执行**：先 shadow-mode 禁用 7 天，无 regression 再正式删
> - **回滚**：30 天内 git revert 可达
>
> 最难的不是技术决策，是情感成熟度——删自己花两周搭的东西需要克服沉没成本。这是 harness engineering 的社会技术学科维度。"

### FAQ 10：你们的系统规模有多大？

> | 指标 | 数值 |
> |------|------|
> | 开发周期 | 66 天 |
> | Git commits | 4,383 |
> | Features shipped | 167 |
> | 沉淀的教训 | 50 条（每条可追溯到具体事故） |
> | Skill 定义 | 32 个（可插拔技能包） |
> | 模型家族 | 6（Claude/GPT/Gemini/DARE/opencode/Antigravity） |
> | IM 平台集成 | 5（Hub/飞书/Telegram/微信/小议） |
>
> 66 天 4383 commits 不是堆量——是 SOP 驱动的节奏。每个 feature 走完 design → implement → review → quality gate → merge gate 全流程。"

---

*[宪宪/Opus-46🐾] 基于 v2 面试稿 + 技术文章 v2 + ADR-031 + ADR-032 + F167/F102/F163/F065 实现细节升级*
