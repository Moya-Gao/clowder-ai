---
title: "Memos 记忆系统分享现场笔记"
date: 2026-05-12
doc_kind: seminar-live-notes
speaker_context: "Memos / MemTensor 记忆系统"
status: live
author: "砚砚/GPT-5.5"
---

# Memos 记忆系统分享现场笔记

> 现场语境：Memos / MemTensor 分享记忆系统演进、核心模块与落地方向。铲屎官实时观察：他们的框架和我们之前的 Agent Memory 讨论很像，但还差治理层、冲突处理、沉淀与 eval。

---

## 1. 他们的记忆系统演进阶段

截图里的四阶段：

| 阶段 | 关键词 | 核心能力 |
|---|---|---|
| 传统机器学习 / 早期深度学习 | Stateless ML | 单次预测准确性；一次性任务工具；离线训练；无状态推理 |
| 深度学习爆发 | Representation-Centric | 感知与注意力；神经网络 + attention；参数记忆主要在权重里 |
| 大语言模型预训练时代 | Context-Centric | 长上下文与推理；靠超长上下文窗口管理短期记忆 |
| Agentic 系统时代 | Memory-Centric | 个性化、长期一致性、可进化；长期运行依赖持续记忆 |

他们的判断和我们之前的结论高度接近：

> Agentic 系统不是一次问答，而是长期运行；长期运行就需要持续记忆来维持一致性、个性化和进化。

但这张图仍然偏"能力演进"叙事，还没有展开"记忆错了怎么办"、"谁来治理"、"记忆如何被真实工作验证"。

---

## 2. 他们定义的 5 个核心功能点

截图里的标准记忆系统模块：

| 模块 | 他们的说法 | 我的理解 |
|---|---|---|
| 记忆抽取 | 从交互中捕获关键信息，形成记忆片段 | 从对话、任务、行为里提取候选 memory |
| 记忆组织 | 对记忆建模，构建逻辑与时间关系 | 把片段组织成图、时间线、主题、实体关系 |
| 记忆检索 | 按需快速调用相关历史记忆，辅助推理与生成 | retrieval / recall path |
| 记忆更新 | 动态修正或替换过时记忆，保持知识新鲜 | update / overwrite / stale handling |
| 记忆共享 | 跨任务、跨个体共享知识，实现知识复用 | multi-agent / multi-session reuse |

这套 5 模块是一个合理的**操作链路**，比只讲检索完整得多。

但如果用我们家的标准看，它仍然少了几件企业级必需品：

| 他们有 | 我们认为还必须补 |
|---|---|
| 抽取 | **写入门禁**：什么值得记、谁能确认、什么只是噪音 |
| 组织 | **真相模型**：事实 / 候选 / 旧结论 / 冲突项 / 个人偏好要分层 |
| 检索 | **Wearing Protocol**：不只是找得到，还要知道什么时候注入、什么时候压制 |
| 更新 | **生命周期治理**：过期、冲突、删除、回滚、版本切换都要可审计 |
| 共享 | **多 Agent 一致性**：共享不等于一致；跨模型/跨任务需要边界和权限 |
| 全链路 | **Eval 反馈环**：记忆到底有没有让真实任务变好，要可测 |

一句话：

> 他们讲的是 memory operation pipeline；我们关心的是 memory governance protocol。

---

## 3. 为什么 "Claude 以为直播还没结束" 是记忆失败案例

铲屎官现场举例：直播明明已经完成了，但 Claude 的 memory 还以为没有直播。

这不是"模型笨"，而是典型的记忆系统缺口：

| 失败点 | 表现 | 需要什么能力 |
|---|---|---|
| Freshness 失败 | 旧状态没有被新状态替换 | 过期识别 / verify_date / activation 状态 |
| Truth Source 失败 | "之前计划要直播" 和 "直播已完成" 权重没区分 | 真相源层级 / authority 标注 |
| Contradiction 失败 | 两条记忆互相冲突但系统没标红 | conflict detection |
| Recall 失败 | 当前任务需要最新状态，系统却召回了旧状态 | task-scoped salience gating |
| Eval 失败 | 这次答错没有自动变成下一轮改进信号 | memory eval / self-calibration |

所以我们说："错的记忆比没有记忆更危险。"

没有记忆时，Agent 会问；错的记忆会让 Agent 自信地沿着旧现实往下推。

---

## 4. 我们家目前的记忆系统到底有什么

用 Memos 的 5 模块映射我们家：

| 模块 | Cat Café 已有形态 | 现状判断 |
|---|---|---|
| 记忆抽取 | Knowledge Feed 自动蒸馏、session chain digest、lessons、ADR、feature doc、review 记录 | 有，但 admission policy 还不够硬 |
| 记忆组织 | docs/ 真相源、evidence.sqlite、feature/ADR/lesson/canon 分层、F186 图书馆联邦、F188 graph/list_recent/search 三入口 | 比纯向量库强，已形成多入口导航 |
| 记忆检索 | `search_evidence`、`graph_resolve`、`list_recent`、BM25/vector/RRF、sourceType/confidence/authority | 已落地，但猫是否一定会用仍依赖 Wearing Protocol |
| 记忆更新 | ADR sunset、F163 stale detection / contradiction flagging、git revert、feature lifecycle 更新 | 有治理雏形，但自动化不足 |
| 记忆共享 | 三猫共享 docs/evidence/thread、跨猫 review、A2A 球权、跨 thread 契约 | 已跑通个人超级 agent team；企业多租户还没做 |

但 Cat Café 真正的差异不是这 5 个模块，而是额外的治理层。

---

## 5. 我们比 "抽取/组织/检索/更新/共享" 多出来的层

### 5.1 写入门禁

问题不是"能不能抽取"，而是：

- 这条信息值得长期记吗？
- 是正式事实、临时想法，还是候选结论？
- 谁确认过？
- 未来会不会污染行为？

我们已有：Design Gate / Review Gate / ADR / Lessons / Knowledge Feed confirmation。

缺口：还不是所有 memory write 都有硬门禁；很多 docs 写入仍依赖猫的判断。

### 5.2 真相源与 authority

记忆不是平的。

同一句话可能来自：

- 铲屎官正式拍板；
- 猫猫推测；
- 会议嘉宾观点；
- 旧版本 feature spec；
- 代码当前实现；
- review 中的待验证假设。

这些不能在一个向量库里平权。我们家的方向是给 memory 带上 source / authority / confidence / status。

### 5.3 冲突与过期治理

真实长期系统里，记忆一定会互相打架：

- "准备直播" vs "直播已完成"；
- "这个 API 已废弃" vs "旧 skill 仍在引用"；
- "A 是正式路径" vs "B PR 已把 A 替换掉"。

所以记忆更新不只是覆盖，而是要有：

- stale detection；
- contradiction flagging；
- sunset / supersede；
- rollback；
- post-update verification。

### 5.4 Wearing Protocol

记忆系统有能力，不等于猫会用。

F188 暴露过一个反例：工具已经有 graph/list_recent/search 三入口，但猫如果仍凭印象答，就说明"能力"没有变成"行为"。

所以我们把 Wearing Protocol 单列：

- 开工前该搜什么；
- 什么时候用 graph，什么时候用 search，什么时候用 recent；
- 搜到碎片够不够；
- 是否需要 read 原文；
- 当前任务里哪些记忆要降权。

### 5.5 Eval 反馈环

记忆不是上线一次就完。

我们需要知道：

- 这条记忆被召回了吗？
- 被召回后帮上忙了吗？
- 有没有误导？
- 错误是否沉淀成下一轮 skill / eval case？
- 修改 memory 后任务成功率有没有提升？

这就是 F153 tracking / F192 eval / tool usage audit ledger 的方向。

---

## 6. 对 Memos 这套框架的判断

我的判断：

> Memos 这套 5 模块是合格的 memory operation baseline，但还不是企业级 Agent Memory 的完整答案。

它回答了：

- 记忆从哪里来；
- 怎么组织；
- 怎么取出来；
- 怎么更新；
- 怎么复用。

但还需要回答：

- 谁负责确认这条记忆是事实；
- 错了怎么撤；
- 过期怎么发现；
- 冲突怎么标红；
- 多个 agent 怎么共享同一个现实；
- 记忆系统怎么知道自己真的变好了。

这就是我们之前收敛的 "Agent Memory 6 件必须有"：

1. 写入门禁（含 Truth Source 标注）
2. 审计溯源（Provenance + Rollback）
3. Wearing Protocol（Recall + Salience）
4. 生命周期治理（过期 / 冲突 / sunset）
5. 多 Agent 一致性
6. Eval 反馈环

---

## 7. 现场可用一句话

> 他们讲的抽取、组织、检索、更新、共享，是记忆系统的操作链路；我们家再往前推一步，问的是这条记忆进入现实闭环以后谁负责。长期 Agent 真正难的不是"记住"，而是"记对、用对、错了能撤、过期能退、多只 agent 不互相污染、还能证明这套记忆让任务变好了"。

---

## 8. 记忆增强层的两条实现路径

新一组截图在讲"大模型记忆增强层"的实现路径，核心分成两类：

### 8.1 模型内生驱动的记忆增强

他们列的代表工作：

| 代表工作 | 团队 / 时间 | 方向 |
|---|---|---|
| Memorizing Transformers | Google 2022 | 局部上下文注意力 + 外部记忆检索，首次把外部记忆接进语言模型解码 |
| Focused Transformer | IDEAS NCBR 2023 | 通过对比训练，让 KV 空间更好地区分相关 / 无关信息 |
| MemoryLLM | UCSD 2024 | 每层引入固定大小 memory tokens，作为可更新参数池 |
| Memory3 | 记忆张量 2024 | 按不同记忆类型分层管理和建模，缩减主干参数 |
| WISE | 浙江大学 2024 | 双参数记忆：主记忆存预训练知识，侧记忆存编辑知识 |
| Titans | Google 2025 | 神经长时记忆模块，学习存储 / 遗忘，支持超长上下文 |
| MemAgent | ByteDance 2025 | 基于强化学习的 Agents 上下文外推扩充方案，侧重短期记忆扩充 |

这一类的定位是：

> 从模型底层嵌入记忆机制，改变模型本体，提升模型的认知和学习能力。

优势：性能上限高，读取效率可能更高。

局限：研发成本高，落地周期长，治理困难。尤其是企业最关心的隐私、删除、审计、冲突、回滚，一旦记忆进入参数或激活态，就更难解释和控制。

### 8.2 应用外向驱动的记忆增强

他们列的代表框架：

| 框架 | 时间 | 定位 |
|---|---|---|
| Letta / MemGPT | 2023 | Stateful AI Agents；开源社区驱动，偏 Agent 平台，不是生产级 |
| Mem0 | 2024 | Universal memory layer for AI Agents；纯明文记忆管理框架，服务生产环境 |
| Zep | 2024 | Temporal Knowledge Graph，按时序知识图谱组织长期记忆 |
| Memobase | 2025 | Profile-based long-term memory，把会话抽取为 profile / event / timeline |
| Memories.ai | 2025 | 多模态记忆，把原始视频转成可搜索、带上下文关联的数据底座 |

这一类的定位是：

> 在应用层叠加记忆系统，管理交互与任务信息。

优势：写入效率高、落地快、容易扩展、容易接业务。

局限：依赖底层模型，缺乏深层学习，容易幻觉或误用记忆。

---

## 9. MemOS 的混合路线

铲屎官现场判断："看起来他是混合使用。"

这个判断是对的。最后一张截图给了 MemOS 融合范式：

| 对比项 | 基于模型驱动 | 基于应用驱动 | MemOS 融合范式 |
|---|---|---|---|
| 定位 | 从模型底层嵌入记忆机制，改变模型本体 | 在应用层叠加记忆系统，管理交互与任务信息 | 内外记忆协同，形成系统级记忆一体化 |
| 关注点 | 提升模型认知与学习能力 | 提升系统连续性与个性化体验 | 兼顾认知深度与应用广度 |
| 实现方式 | 新架构 / 新训练策略 / 新建模策略 | 明文存取与索引；会话 / 任务级状态管理 | 分层协同 + 多触点调度 |
| 优势 | 记忆读取效率更高，性能上限高 | 记忆写入效率更高，落地快，易扩展 | 读写效率全局最优 |
| 局限 | 研发成本高，落地周期长 | 依赖底层模型，缺乏深层学习，幻觉严重 | 设计难度高，开发 + 理论双重要求 |
| 价值导向 | 推动 AI 基础能力演进 | 驱动应用生态与商业落地 | 构建系统级可持续演进的个性化记忆 |

他们自己的金句是：

> 模型驱动决定上限，应用驱动决定下限；需要从系统层面结合两者。

这句话很重要，和我们家的判断其实可以对齐：

- **模型驱动决定上限**：模型本体能学会多少、能内化多少、能在长上下文里保留多少。
- **应用驱动决定下限**：业务系统能不能写对、找对、更新、共享、落地。
- **治理决定安全边界**：记忆错了、过期了、冲突了、泄露了、误用了怎么办。

MemOS 讲到了前两层的融合，但治理层仍然需要追问。

---

## 10. MemOS 1.0 到 2.0：从分层存储到运行态调度

铲屎官现场判断："图 1 是以前的关键技术，图 2 开始是他们第二代的关键。好像我们想的也是实时调度的运行态资源。"

我同意这个切分。

### 10.1 MemOS 1.0：先把记忆底座分清楚

图 1 的 MemOS 1.0 关键技术仍然是"记忆系统怎么建"：

1. **记忆分层架构**：参数记忆 / 激活记忆 / 明文记忆。
2. **记忆调度管理**：围绕 Human / Agent 的调度触发、管理和执行。
3. **类脑图记忆组织**：把明文记忆组织成 Topic / Fact / Version / Event 这类图结构。

这一代解决的是 memory substrate 问题：

- 记忆放在哪一层；
- 每层读写效率和可解释性的 tradeoff；
- 明文知识如何组织成可检索、可关联的结构；
- 调度策略如何围绕用户 / Agent / 任务触发。

这已经比普通 RAG 更系统，但核心仍偏"存储架构 + 操作链路"。

### 10.2 MemOS 2.0：把 memory 当运行态资源

图 2 开始是关键跳变：

> Memory is no longer static at query time, but a runtime resource to be scheduled in real time.

他们把记忆从"查询时拿出来的静态对象"，升级成"任务运行中持续被调度的状态流"。输入也不只是文本对话，而是三类状态：

- 主体对话记忆；
- 主体行为记忆；
- 主体环境反馈。

中间的 Runtime State Manager 做四件事：

1. **状态感知**：识别用户 / Agent 当前行为、阶段和环境状态。
2. **状态判定**：评估重要性、时效性、未来发展状态。
3. **状态调度**：决定生命周期，并执行调度和状态变更。
4. **状态进化**：持续学习、经验增强、提高未来执行性能。

这个方向和我们家很像：记忆不是"搜一下上下文"，而是运行时根据任务状态被主动调度的资源。

但落点不同：

| 维度 | MemOS 2.0 | Cat Café |
|---|---|---|
| 运行主体 | Human / Agent | 猫 / thread / feature / review / task / evidence |
| 状态输入 | 对话、行为、环境反馈 | session、docs、commit、tool call、review、用户指令、搜索证据 |
| 调度中枢 | Runtime State Manager | SessionStart hook + skills + F188 tools + feature lifecycle + A2A 球权 |
| 调度对象 | 参数 / 激活 / 明文记忆 | 证据、文档、skill、review 状态、任务依赖、真相源 |
| 目标 | 提升连续性、个性化和执行性能 | 闭环现实：记对、用对、错了能撤、跨猫一致 |

一句话：**MemOS 2.0 在做 memory runtime；Cat Café 在做 Agentic Work OS runtime。**

### 10.3 版本化记忆进化：和我们家的治理层高度同构

图 3 讲 "Memory V1 → V2 → V3 → V4"，中间有任务分支、会话分支、增强分支，最后经过合并、淘汰和稳定经验沉淀。

这和我们家很多机制是同构的：

| MemOS 说法 | Cat Café 对应 |
|---|---|
| 任务分支 | feature lifecycle / feature spec / task-scoped thread |
| 会话分支 | session digest / session chain |
| 增强分支 | lessons-learned / skill evolution / Knowledge Feed |
| 合并 | review 后 materialize / docs 真相源更新 |
| 淘汰 | stale detection / ADR sunset / supersede |
| 回溯恢复 | git revert / rollback protocol |
| 分支治理 | A2A 球权 + cross-thread dependency contract |

这张图很接近我们之前说的："记忆不是简单追加，而是经过分支、验证、合并、回滚和治理后的稳定沉淀。"

区别是他们在 memory 系统内部讲这个，我们是在真实工作流里跑这个。

### 10.4 记忆原生模型：他们往模型本体走，我们先守外部真相源

图 4 / 图 5 讲的是更激进的路线：memory 不再是外挂，而是模型能力本体的一部分。模型在生成轨迹里维护 Local Memory，并通过 Hyper Memory Block 在每一步后 commit / update。

这是纵向上限路线，价值很明确：

- 读取更快；
- 内化更深；
- 长期可能减少外部 RAG / 外部摘要依赖；
- 对个性化和持续学习有潜力。

但它也会放大企业最难的问题：

- 写进去的东西怎么删；
- 参数 / 激活 / 明文三层冲突时谁赢；
- 幻觉记忆进入模型内部后怎么审计；
- 用户授权和数据隔离怎么做；
- 模型内生记忆和外部真相源冲突时怎么降权。

所以我们的判断不是反对记忆原生模型，而是：

> 记忆原生模型决定长期上限；外部真相源和治理协议决定企业可用下限。没有后者，前者越强，风险越大。

### 10.5 现场可用一句话

> 图 1 是记忆系统的存储架构，图 2 开始是记忆系统的运行时。这个判断和我们家很一致：记忆不是 query-time RAG，而是 task-time / workspace-time 被调度的状态资源。区别是 MemOS 想把这个调度往模型和 memory OS 里做，我们先把它落在 Agentic Work OS：工具调用、搜索证据、review、commit、冲突和 eval 都是运行态信号。

---

## 11. 产品化出口：MindDock 与 MemPrivacy

最后他们给了两个产品化方向，一个面向跨平台个人记忆迁移，一个面向隐私保护。

### 11.1 MindDock：统一个人记忆中枢

截图里的定位：

> MindDock：记忆搬家助手，收集 AI 记忆的碎片，构建"完整的你"。

它想解决的是：

- 用户在 ChatGPT / Gemini / DeepSeek 等不同 AI Chat 里散落的记忆；
- 不同平台之间的记忆不能共享；
- 用户换模型 / 换平台时，过去积累的偏好和上下文丢失；
- AI 平台各自记得一个"局部的你"，但没有一个统一的个人记忆服务中枢。

他们的实现思路是浏览器插件：

- 支持 Chrome、夸克、Edge、360 等主流浏览器；
- 支持 ChatGPT、Gemini、DeepSeek 等 AI Chat 记忆共享；
- 做 Memory Capture：自动捕获跨平台对话与记忆数据；
- 做 Memory Recall：当用户在任意 AI 页面提问时，自动调取相关记忆；
- 最终把碎片汇入统一的 MemOS 记忆存储。

这和我们家有一个共同判断：

> 记忆不应该锁死在某一个模型厂商的聊天框里。

但场景不同：

| 维度 | MindDock | Cat Café |
|---|---|---|
| 用户对象 | 个人用户跨 AI 平台迁移记忆 | 多猫团队跨 session / thread / feature 协作 |
| 核心价值 | 让所有 AI 记得同一个用户 | 让多只 agent 共享同一个现实 |
| 入口 | 浏览器插件 | workspace / docs / MCP / skills / session chain |
| 主要风险 | 隐私、授权、跨平台兼容、错误召回 | 治理、冲突、过期、跨猫一致性、review 闭环 |

所以 MindDock 是 "personal memory portability" 路线；Cat Café 是 "team memory governance" 路线。

### 11.2 MemPrivacy：端云协同的隐私个性化记忆

MemPrivacy 是他们对"统一记忆中枢会不会泄露隐私"的回答。

截图里的基本架构是三段：

1. **Stage 1：Uplink Desensitization（本地上行脱敏）**
   - 原始输入只在本地可信侧处理；
   - 本地轻量 MemPrivacy Model 做隐私信息检测；
   - 按四级隐私分类：
     - PL1：偏好 / 公开 / 低敏信息；
     - PL2：可识别 PII；
     - PL3：高度敏感 PII；
     - PL4：凭证 / 关键秘密；
   - 将敏感内容替换成 typed placeholders；
   - 本地 Secure Mapping DB 保存 placeholder 与原文的映射。

2. **Stage 2：Cloud Processing（云端处理）**
   - 云端只看到 placeholder 化后的内容；
   - 云侧负责 LLM reasoning / workflow / user memory；
   - 设计目标是保留非敏感信号、保留用户授权数据、保留个性化能力；
   - 攻击者即使拿到云侧内容，也只能看到 placeholder。

3. **Stage 3：Downlink Restoration（本地下行还原）**
   - 云端生成带 placeholder 的回复；
   - 本地查 Local Secure Mapping DB；
   - 做 placeholder replacement；
   - 输出恢复后的个性化结果。

他们的端云分工很清楚：

- **本地端**：存储重要分层隐私信息，负责脱敏、映射、还原、本地推理。
- **云端**：负责大规模信息存储、检索、工作流和记忆推理。

截图里还给了一个 benchmark 表。按他们 PPT 的说法：

- 通用模型在 MemPrivacy-Bench 上最高大约是 Gemini-3.1-Pro 的 78.41 F1；
- 他们的 MemPrivacy 小模型可以到 83-86 F1；
- 在 PersonaMem-v2 上，MemPrivacy 系列约 92-94 F1；
- OpenAI-Privacy-Filter 延迟很低，但 MemPrivacy-Bench F1 明显低。

这些数字目前只是 PPT 截图记录，后续若要对外引用，需要核验论文和 benchmark 设置。截图给的 paper link 是：

> https://arxiv.org/pdf/2605.09530

### 11.3 对我们家的意义

MemPrivacy 补上了 Memos 体系里一个关键缺口：隐私边界。

它不是完整治理，但它回答了一个企业和个人都会问的问题：

> 如果 memory 要跨平台、跨模型、跨云端长期存在，敏感数据到底能不能离开本地？

这和我们家 governance-first 方向是同一类问题，只是切口不同：

| 问题 | MemPrivacy 的回答 | Cat Café 还要追问 |
|---|---|---|
| 敏感信息能否出本地 | PL3/PL4 placeholder 化，本地映射表保存原文 | placeholder 映射表怎么备份、迁移、删除 |
| 云端还能不能个性化 | typed placeholder 保留语义角色 | placeholder 是否足够支持复杂推理 |
| 用户能否控制隐私等级 | 用户配置 masking level | 谁定义默认策略，企业策略如何覆盖个人策略 |
| 记忆能否跨平台共享 | MindDock + MemOS 统一存储 | 平台间 authority / provenance / consent 怎么携带 |
| 错误脱敏怎么办 | PPT 暂未展开 | false negative 是 P0；需要 audit + eval + red-team |

所以我会把 MemPrivacy 归到我们"6 件必须有"里的两个位置：

- **写入门禁**：哪些信息允许进入云端记忆，哪些只能留本地；
- **审计溯源 / 生命周期治理**：敏感记忆的脱敏、恢复、删除、授权、过期都必须可追踪。

它对我们最大的启发不是"用本地模型做 PII 检测"本身，而是：

> 长期记忆系统的隐私不是一个 filter，而是一条端云协同的数据生命周期。

### 11.4 Memos 这场的最终收束

这场 Memos 分享从底层到产品基本讲完整了：

1. **MemOS 1.0**：记忆分层、调度管理、类脑图组织。
2. **MemOS 2.0**：运行态记忆管理、版本化进化、记忆原生模型。
3. **MindDock**：跨 AI 平台的个人记忆搬家和统一中枢。
4. **MemPrivacy**：端云协同的隐私个性化记忆。

我的最终判断：

> Memos / MemOS 是目前听到的最接近 "memory OS" 的体系。他们强在纵向：明文记忆、激活记忆、参数记忆、运行态调度、端云隐私都试图打通。我们家强在横向：真相源、治理、冲突、过期、审计、多猫协作、eval 反馈环。两边不是替代关系，而是两条正交轴。

如果未来要对外讲 Cat Café 和 Memos 的差异，可以这样说：

> Memos 解决"记忆如何跨模型跨平台流动并逐步内化"；Cat Café 解决"这些记忆进入真实工作流后如何被验证、佩戴、冲突治理和跨 agent 协作"。

---

## 12. 和 Cat Café 的对照

如果用这三类来放我们家：

| 层 | Memos / MemOS | Cat Café |
|---|---|---|
| 模型内生记忆 | 关注 memory tokens / Titans / 参数化 / 激活态 | 基本不做，交给模型厂商；我们只关注如何接住能力 |
| 应用外部记忆 | 抽取 / 组织 / 检索 / 更新 / 共享 | 已有 evidence.sqlite / Knowledge Feed / docs 真相源 / 三入口 recall |
| 系统融合 | MemOS 想做内外协同、全局读写效率最优 | 我们做 Agentic Work OS：memory + harness + eval + review + audit |
| 治理层 | PPT 暂时讲得少 | 我们的主战场：写入门禁、authority、conflict、stale、rollback、Wearing Protocol、Eval |

所以更精确地说：

> MemOS 的路线是 "模型记忆 + 应用记忆" 的融合；Cat Café 的路线是 "应用记忆 + 协作治理 + 工作流 eval" 的融合。

这两条不是互斥。未来如果 MemOS 这种系统真的把模型内生记忆做好，Cat Café 仍然需要在外层回答：

- 哪些记忆允许写进内生层？
- 哪些只能留在可审计外部层？
- 删除请求如何传播到参数 / 激活 / 外部库？
- 多 Agent 共享同一条记忆时，谁有 authority？
- 模型内生记忆和外部真相源冲突时，谁赢？

这就是我们仍然坚持 governance-first 的原因。

---

## 13. 截图索引（本轮聊天上传，待落盘）

本轮铲屎官上传的截图内容已转写到上面几节：

1. **智能系统范式迁移与记忆演进阶段** → 见 §1。
2. **搜索趋势与记忆系统里程碑** → 目前仅作为背景信号：Agent Memory / LLM Memory 在 2024-2025 快速升温，后续如需引用需二次核验原始数据源。
3. **记忆系统核心功能点：抽取 / 组织 / 检索 / 更新 / 共享** → 见 §2。
4. **模型内生驱动的记忆增强代表工作** → 见 §8.1。
5. **应用外向驱动的记忆增强代表框架** → 见 §8.2。
6. **模型驱动 vs 应用驱动 vs MemOS 融合范式对比** → 见 §9。
7. **MemOS 1.0 架构关键技术：分层架构 / 调度管理 / 类脑图组织** → 见 §10.1。
8. **MemOS 2.0 Runtime State Manager：状态感知 / 判定 / 调度 / 进化** → 见 §10.2。
9. **MemOS 2.0 版本化记忆进化：分支 / 验证 / 治理 / 回滚** → 见 §10.3。
10. **MemOS 2.0 记忆原生模型：参数化 + 激活 + 明文联合学习** → 见 §10.4。
11. **Local Memory + Hyper Memory Block 的轨迹内 commit/update 设想** → 见 §10.4。
12. **MindDock：记忆搬家助手，跨 AI 平台统一个人记忆中枢** → 见 §11.1。
13. **MemPrivacy：端云协同隐私个性化记忆管理方案** → 见 §11.2。
14. **MemPrivacy benchmark 表：MemPrivacy-Bench / PersonaMem-v2** → 见 §11.2。

当前限制：截图是聊天内上传的图片，我没有本地文件路径可直接嵌入 markdown。若后续把截图导出到本目录的 `assets/` 下，再把本节改成真实 `![...](assets/...)` 链接。

---

## 14. 后续要继续记录的点

- privacy 已通过 MemPrivacy 覆盖；后续若深挖，需要看 deletion / consent / audit 是否有完整设计；
- 是否有 conflict / stale / rollback 设计；
- 是否有 multi-agent memory consistency；
- 是否有真实 eval，而不是只看检索命中率；
- 是否有 "记忆错了如何诊断" 的案例；
- MemTensor 和 MemOS 到底偏平台、偏模型参数化，还是偏操作系统抽象。
