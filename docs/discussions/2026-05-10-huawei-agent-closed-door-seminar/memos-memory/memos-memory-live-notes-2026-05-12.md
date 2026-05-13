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

## 10. 和 Cat Café 的对照

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

## 11. 截图索引（本轮聊天上传，待落盘）

本轮铲屎官上传的截图内容已转写到上面几节：

1. **智能系统范式迁移与记忆演进阶段** → 见 §1。
2. **搜索趋势与记忆系统里程碑** → 目前仅作为背景信号：Agent Memory / LLM Memory 在 2024-2025 快速升温，后续如需引用需二次核验原始数据源。
3. **记忆系统核心功能点：抽取 / 组织 / 检索 / 更新 / 共享** → 见 §2。
4. **模型内生驱动的记忆增强代表工作** → 见 §8.1。
5. **应用外向驱动的记忆增强代表框架** → 见 §8.2。
6. **模型驱动 vs 应用驱动 vs MemOS 融合范式对比** → 见 §9。

当前限制：截图是聊天内上传的图片，我没有本地文件路径可直接嵌入 markdown。若后续把截图导出到本目录的 `assets/` 下，再把本节改成真实 `![...](assets/...)` 链接。

---

## 12. 后续要继续记录的点

- 他们是否讲 memory governance / privacy / deletion；
- 是否有 conflict / stale / rollback 设计；
- 是否有 multi-agent memory consistency；
- 是否有真实 eval，而不是只看检索命中率；
- 是否有 "记忆错了如何诊断" 的案例；
- MemTensor 和 MemOS 到底偏平台、偏模型参数化，还是偏操作系统抽象。
