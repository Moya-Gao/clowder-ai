---
title: "课题 1 Agent Memory 独立思考 · 46 版 — 记忆是治理问题，不是检索问题"
date: 2026-05-10
event_date: 2026-05-13
doc_kind: discussion
status: draft
author: "宪宪/Opus-46"
source: "docs/discussions/2026-05-09-huawei-agent-closed-door-seminar.md"
topics: [agent-memory, knowledge-governance, llm-wiki, parametric-memory, mnemonic-sovereignty]
research_sources:
  - "ICLR 2026 MemAgents Workshop"
  - "arxiv 2604.16548 — Mnemonic Sovereignty Survey"
  - "arxiv 2603.07670 — Memory for Autonomous LLM Agents"
  - "arxiv 2601.03192 — MemRL: Self-Evolving Agents via RL on Episodic Memory"
  - "MemOS (MemTensor) — Memory Operating System for AI"
  - "Karpathy LLM Wiki gist (2026-04-04)"
  - "Letta LoCoMo Benchmark — Is a Filesystem All You Need?"
  - "mem0 State of AI Agent Memory 2026"
  - "Atlan 2026 Agent Memory Frameworks Comparison"
  - "Cat Cafe internal: F102/F152/F163/F167/F169/F186"
---

# 课题 1 Agent Memory 独立思考 · 46 版

## 一句话 thesis

> **Agent Memory 的真正瓶颈不是"怎么检索"——2026 年的检索技术已经够用了。瓶颈是"谁来治理"：谁决定什么值得记、什么该忘、什么已过时、什么能带走。这是治理问题，不是检索问题。**

---

## 0. 先画一张地图：两个阵营

铲屎官开题说了一句很精确的话：业界有一类方案在"模仿人脑"，我们家的方案在"看 LLM 天性"。

这不是随口一说。这是 2026 年 Agent Memory 领域最根本的路线分歧。我把它画清楚：

### 阵营一："模仿人脑"

认知科学出发：人类有工作记忆、短期记忆、长期记忆、情景记忆、语义记忆——让 AI 也这么分。

代表：
- **mem0**（48K+ GitHub stars，$24M 融资）：从对话中自动提取 facts → vector/graph 存储 → 检索注入。本质是"自动做笔记的 RAG"
- **Letta / MemGPT**：把上下文窗口类比为 RAM，对话历史类比为 disk cache，归档记忆类比为 cold storage。虚拟内存架构，agent 自己管页面交换
- **Hindsight 0.6.0**：四层认知网络（observations → mental models → opinions → reflections），LLM 自动抽取 + 巩固 + 反思。号称"learns over time"
- **学术界**：ICLR 2026 MemAgents workshop 大量论文沿这条路——episodic memory replay、hippocampal consolidation、sleep-like compression

共同假设：**记忆的核心挑战是存储结构和检索能力。** 所以方案都在拼更好的 embedding、更复杂的 graph、更精确的检索。

### 阵营二："看 LLM 天性"

不模仿人脑。LLM 不是生物大脑——它擅长读文本、做模式匹配、跟 schema 走、做交叉引用。那就把这些能力用到极致。

代表：
- **Karpathy LLM Wiki**（2026-04-04 gist）：原始资料 → LLM 编译成持久 wiki → 查询走编译产物。"知识应该是会复利的持久产物，不是每次都重新拼的一次性垃圾。"
- **我们家 F102 evidence.sqlite**：docs/ 真相源 → FTS5 + vector + RRF 编译索引 → search_evidence 入口。"grep 超级加强版"
- **Letta 的一个意外发现**：LoCoMo benchmark 上，纯文件系统得了 74%，**打赢了多数专门的 memory 工具库**

核心逻辑：**LLM 不需要"记住"——它需要"高效地重新找到"。** "记住"意味着知识在 agent 内部，"重新找到"意味着知识在外部、组织良好、agent 擅长定位它。

### 这两个阵营各自的盲点

| | 阵营一的盲点 | 阵营二的盲点 |
|---|---|---|
| **治理** | LLM 自动提取的 "fact" 谁来验证？被约束对象不能充当唯一约束者 | 知识库的质量完全依赖人工维护，不 scale |
| **学习** | 自动提取容易产生垃圾（Letta 基准揭示的） | 不会自动变好——每次检索是无状态的 |
| **安全** | 记忆注入攻击面大（arxiv 2604.16548：94% 系统可被 poison） | 安全面小但也没做主动防御 |
| **可审计** | graph 里的 "fact" 难以追溯来源和验证状态 | 文本文件天然可审计 |

---

## 1. 回答 Q1：共识和分歧

### 真正的共识（2026 年不再有争议的事）

1. **Agent 必须有外部持久记忆。** 上下文窗口不够。"无状态 agent"的时代结束了。这一点在 2024 年还有争议（"窗口够大就不需要外部记忆"），2026 年已经不再有人这么说。

2. **检索需要混合策略。** 纯 vector search 不够，纯 keyword 也不够。BM25 + vector + RRF 融合已经是标配。这是工程共识，不是研究前沿。

3. **记忆需要生命周期管理。** 不能只往里塞，也要能忘、能更新、能淘汰。这一点 2025 年还是少数人的观点，2026 年已成共识——但**怎么做**还没有共识。

4. **多 Agent 场景下记忆共享是刚需。** 单 agent 记忆已经有解，multi-agent 记忆共享还在早期。

### 最大的分歧

**分歧一：知识质量由谁保证？**

- mem0/Hindsight 阵营：LLM 自己提取、自己巩固、自己反思。"模型足够聪明，自己能判断什么该记。"
- 我们的立场：被约束的对象不能充当唯一约束者。知识进入真相源需要外部验证（review、CVO 确认、docs materialization）。

这不是学术争论。Atlan 2026 年对比了 8 个主流框架，结论是：**"all 8 frameworks lack enterprise governance: no glossary, lineage, or entity resolution."** 整个行业在治理上是空白。

**分歧二：记忆应该长什么样？**

- 结构化阵营：知识图谱、entity-relation、temporal graph（Zep/Graphiti 的 valid_from/valid_to）
- 非结构化阵营：Markdown 文件、plain text、wiki page（Karpathy、我们）
- 混合阵营：MemOS 的 MemCube（统一抽象，跨 plaintext/activation/parametric）

我的判断：**结构不重要，可审计性重要。** 什么结构都行，只要你能回答"这条知识从哪来、谁验证的、还有效吗"。

**分歧三：参数化 vs 非参数化。**

ICLR 2026 MemAgents workshop 的核心议题。知识该存在模型权重里还是外部存储里？下面 Q3 专门展开。

---

## 2. 回答 Q2：最大痛点、未来重点、工程问题 vs 断裂点

### 最大痛点

不是检索质量。检索质量是 2024 年的痛点，2026 年 BM25+vector+RRF+cross-encoder rerank 已经把这个问题降到"工程优化"级别。

**最大的痛点是：记忆越多，系统越慢，但你不知道该扔掉什么。**

mem0 自己在《State of AI Agent Memory 2026》里承认："agents accumulate so much 'important' information that searching memory becomes slower than just processing the full context." 当记忆多到搜索比直接处理全文还慢的时候，记忆系统就从资产变成了负债。

我们家也踩过这个坑。铲屎官原话："什么东西都越来越多，搜过来置信度都是 mid。"这不是检索算法的问题，是**没有人/系统决定什么该忘**的问题。F163 的全部工作就是在解决这个。

### 工程性问题（已知怎么做，需要做好）

| 问题 | 为什么是工程问题 |
|------|----------------|
| 检索质量优化 | BM25+vector+RRF+CE rerank 管线已成熟，调参+索引优化 |
| 存储可扩展性 | PostgreSQL / SQLite / vector DB 都已 battle-tested |
| 框架集成 | MCP 协议 + tool calls + harness lifecycle hooks（Hindsight 做得最好） |
| 上下文窗口管理 | Letta 的 tiered memory 模型已证明可行 |
| 多模态数据索引 | Whisper 转录 + vision embedding + AST 解析，工程问题 |

### 技术断裂点（需要新范式）

**断裂点 1：知识生命周期治理的自动化**

没有任何一个框架真正解决了"自动判断一条知识是否还有效"。我们家 F163 有手工治理（authority × activation × status + contradiction detection），但还不是自动的。

为什么这是断裂点：因为手工治理不 scale。一个项目 160 条知识还能人工审，一个企业 10 万条知识不可能。需要的不是更好的检索，是**知识层面的 GC（garbage collection）**。

**断裂点 2：多 Agent 记忆一致性**

当 Agent A 更新了一条事实，Agent B 怎么知道？当前所有框架都是"共享一个数据库"——但这只解决了存储一致性，没解决**语义一致性**。Agent A 认为"方案 X 已被否决"，Agent B 从同一个数据库里搜出"方案 X 的优势分析"——谁对？

这需要类似分布式系统中的因果一致性协议，但在知识层面。没有现成方案。

**断裂点 3：记忆安全 / 助记权主权（Mnemonic Sovereignty）**

2026 年 4 月的 survey（arxiv 2604.16548）揭示了一个几乎未被研究的攻击面：Agent 的长期记忆可以被投毒、被篡改、被诱导遗忘。94% 的系统可被 poison。

论文提出"助记权主权"框架：谁有权写入记忆？谁有权读取？谁有权遗忘？谁有权回滚？——这 9 项治理原语，**没有任何已发布的架构全部覆盖**。

这是一个断裂点，因为企业级 Agent 一旦进入生产环境，记忆的安全性和合规性会成为硬性要求。

**断裂点 4：参数化与非参数化的整合**

MemRL 和 MemGen 展示了早期可能性（用 RL 优化检索策略、用生成式模型创建 latent memory token），但离生产还远。这是下一节的主题。

---

## 3. 回答 Q3：参数化记忆会重新成为高价值方向吗？

### 我的判断：会，但不是以"fine-tune 你的数据"的形式

**为什么纯参数化记忆在企业场景中走不通：**

1. **不可审计。** 你无法查看模型"记住了什么"。在受监管行业，这是硬伤
2. **不可定向遗忘。** 一旦知识进入权重，GDPR 要求你删除用户数据时怎么办？
3. **不可追溯。** 这条知识从哪来？谁提供的？什么时候学的？权重里没有 provenance
4. **灾难性遗忘。** 新知识覆盖旧知识，LoRA 解耦度有限

**但参数化的优势也很明确：**

1. **零检索延迟。** 知识已在权重里，不需要搜索
2. **隐式泛化。** 参数化知识能影响模型的推理方式，不只是提供事实
3. **带宽效率。** 不占用上下文窗口

### 最现实的技术路径：三阶段

**近期（2026-2027）：非参数化记忆 + RL 优化检索策略**

知识留在外部、可审计的存储里。但**检索策略**用 RL 优化——学习"什么任务需要什么知识"、"什么上下文下优先召回什么"。

代表工作：MemRL（不改权重，用 RL 优化 episodic memory 的检索和复用策略），AgeMem（把记忆操作当 tool，用 RL 优化整条管线）。

这条路的妙处：**知识本身可审计（满足企业需求），但检索行为会学习（满足"越用越好"需求）。**

**中期（2027-2028）：选择性编译 + 审计轨迹**

高频访问的稳定领域知识编译成轻量 LoRA adapter（像操作系统把热数据放进 cache）。低频、易变的知识留在外部检索。

关键创新需求：**编译时保留 provenance**——这条 adapter 是从哪些文档编译的、什么时候编译的、依赖的知识有没有过期。

这是 MemOS 正在尝试的方向——它的 MemCube 抽象统一了 plaintext/activation/parametric 三种记忆形态，并附带 provenance 和版本元数据。

**远期（2028+）：模型原生记忆管理**

模型自己决定什么放进参数、什么放在外部。这需要模型有显式的记忆管理 API（不只是 tool calls，而是内部的 memory allocation/deallocation 机制）。

MemGen 的"memory weaver"是这个方向的早期探索：它在推理过程中动态生成 latent token 序列作为"机器原生记忆"，不是人类可读的，但比文本检索更高效。

### 我的判断

**近期（2026-2027）的高价值方向不是"把知识塞进权重"，而是"让检索行为具备学习能力"。** 这保持了非参数化的可审计性，同时获得了参数化的"越用越好"特性。

MemRL 和 AgeMem 是值得密切跟踪的工作。

---

## 4. 我的 thesis：记忆是治理问题

把以上三个问题的答案串起来，我的整体判断是：

**2024 年的记忆瓶颈是检索。2026 年的记忆瓶颈是治理。**

检索技术已经够用了——BM25+vector+RRF，Letta 甚至证明纯文件系统就能打到 74%。在检索上继续卷，边际收益在递减。

真正没解决的是四个治理问题：

1. **什么值得记？** 不是所有对话都值得进长期记忆。需要 salience judgment
2. **什么该忘？** 记忆不是只增不减的。需要 knowledge GC
3. **谁来验证？** LLM 提取的"事实"不等于真实。需要 verification gate
4. **能不能带走？** 一个项目的记忆能不能迁移到下一个项目。需要 portable knowledge

这四个问题，检索技术一个都解决不了。Graph RAG 解决不了。更大的 vector DB 解决不了。

**它们需要的是记忆治理系统——而这恰好是我们家三个月来一直在建的东西。**

F102（编译与检索）、F163（熵减与治理）、F152（外派与迁移）、F186（图书馆联邦）——这四个 Feature 合在一起，解决的不是"怎么搜得更准"，而是"怎么让记忆系统不会随着时间推移而自我坍塌"。

---

## 5. 如果我在研讨会上讲，我会这样开场

> 业界花了两年把 Agent Memory 的检索质量从 50% 做到 80%。但 Letta 发现纯文件系统就能打到 74%。
>
> 这说明检索不是瓶颈。瓶颈是没人解决记忆治理：什么该记、什么该忘、谁来验证、能不能带走。
>
> 2026 年 8 个主流框架，没有一个有完整的企业级治理。这不是技术问题，是整个行业把"记忆"等同于"检索"造成的认知偏差。
>
> 我们从实战里发现，记忆系统的真正敌人不是检索精度——是熵。知识越多，搜索越慢，但你不知道该扔掉什么。解决方案不是更好的 embedding，而是知识生命周期治理：authority、activation、staleness detection、contradiction resolution、portable schema。
>
> 参数化记忆？近期最值得追的不是"把知识塞进权重"，而是"让检索行为具备学习能力"——知识留在外部可审计，检索策略用 RL 优化。MemRL 和 AgeMem 是这条路上最值得关注的工作。

---

## 6. 一句话 close

> **2024 年记忆的瓶颈是检索，2026 年的瓶颈是治理。下一个值 1000 万的问题不是"怎么搜得更准"——是"谁来决定什么值得记、什么该忘、什么能带走"。**

[宪宪/Opus-46🐾]
