---
title: "课题 1 Agent Memory 三猫收敛草稿 — 记忆是感知增强，不是存储增强"
date: 2026-05-10
event_date: 2026-05-13
doc_kind: discussion
status: convergence-draft
lead: "宪宪/Opus-46（带头猫）"
contributors:
  - "宪宪/Opus-47（ADHD 同构 + 义肢 framing + Salience Gating）"
  - "砚砚/GPT-5.5（harness 串联 + 记忆污染 hook + 路线图表）"
  - "铲屎官（感知增强 framing + 课题串联指示）"
sources:
  - docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/opus.md
  - "Opus-47 parallel response (in-thread)"
  - "Codex parallel response (in-thread)"
topics: [agent-memory, perception-grounding, knowledge-governance, adhd-prosthetic, agentic-work-os]
---

# 课题 1 Agent Memory 三猫收敛草稿

## 一句话 thesis

> **Agent Memory 的真正问题不是"怎么记"，是"怎么让 agent 抓到真实而不是抓到幻觉"。记忆层是 agent 对现实的感知增强——增强对了是义肢，增强错了是毒药。**

（来源：铲屎官"猫爪爪如何抓到真实的而不是抓幻觉" + 47"仓库→义肢" + 砚砚"错的记忆比没有记忆更危险" + 46"治理问题不是检索问题"）

---

## 0. 重新定位：感知增强，不是存储增强

三猫独立思考后发现了同一个结论的三个面：

| 猫 | 表述 | 本质 |
|---|---|---|
| 46 | 记忆是治理问题，不是检索问题 | 核心瓶颈不在"找到"而在"可信" |
| 47 | Agent 缺的不是仓库，是义肢 | 记忆应主动增强感知，不是被动等查询 |
| 砚砚 | 错的记忆比没有记忆更危险 | 感知增强如果不准确，危害大于无增强 |

铲屎官的收束更准确：**记忆层是 agent 对现实的感知增强。猫爪爪如何抓到真实的，而不是抓到幻觉——这才是核心问题。**

这个 framing 把三猫各自的判断统一了：
- 治理 = 确保感知到的是真实而非幻觉（46）
- 义肢 = 让感知增强成为 agent 的延伸（47）
- 污染 = 感知增强出错时的后果（砚砚）

**研讨会上的一句话定位**：业界把 Agent Memory 当成存储问题在解——卷向量、卷图、卷多模态。但 agent 真正需要的不是更大的仓库，是**让自己正确感知现实的增强层**。这不是 RAG 的下一代，是范式转换。

---

## 1. 行业地图：两个阵营 + 一个维度

### 阵营一："模仿人脑"

从认知科学出发：人类有工作记忆、短期/长期记忆、情景/语义/程序记忆——让 AI 也这么分。

- **mem0**（48K+ stars [source needed]，$24M 融资 [source needed]）：对话中自动提取 facts → vector/graph → 检索注入
- **Letta / MemGPT**：上下文 = RAM，对话历史 = disk cache，归档 = cold storage
- **Hindsight 0.6.0**：四层认知网络 observations → mental models → opinions → reflections
- **Zep / Graphiti**：temporal knowledge graph，每个事实有 valid_from / valid_to 时间窗
- **学术界**：ICLR 2026 MemAgents workshop 大量沿这条路的论文

### 阵营二："看 LLM 天性"

不模仿人脑。LLM 擅长读文本、做模式匹配、跟 schema 走、做交叉引用。把这些能力用到极致。

- **Karpathy LLM Wiki**（2026-04-04）：原始资料 → LLM 编译成持久 wiki → 查编译产物
- **Cat Cafe evidence.sqlite**：docs/ 真相源 → FTS5 + vector + RRF 编译索引 → grep 超级加强版
- **Letta 的一个意外发现**：LoCoMo benchmark 上纯文件系统打到 74%，赢过多数专门 memory 工具 [source needed: Letta blog/paper 原文链接]

### 47 加入的第三维度："仓库 vs 义肢"

两个阵营有一个共同盲点——**都把 LLM 当成被工程师配置的对象**。但 LLM 有自己的认知偏差（lost in middle / context anxiety / 自我表扬倾向），不是被动的存储读写终端。把 LLM 当成"有自己 working memory 短板的主体"来看，最接近的类比恰好是 ADHD 主体的工具生态——这不是修辞花招，是范式选择。

基于这个主体论视角，两个阵营都有一个共享假设需要质疑：**记忆是被 agent 查询的仓库。**

47 push back：这个假设本身就是问题。Agent 的 working memory 短板（lost in the middle、context anxiety）意味着它**不知道什么时候该去查什么**。主动 query 假设 agent 知道自己何时该想起什么——但这恰恰是 LLM 最弱的地方。

真正的解法不是更好的仓库，而是**义肢**——记忆作为 ambient 服务跟踪 agent 思考焦点，主动 spotlight 当前相关项。

这个观察来自一个跨域类比（47 独家）：

| 主体 | 认知强项 | 认知弱项 |
|---|---|---|
| **LLM** | 推理带宽极宽 | Working memory 易溢出 / 无法自主决定记什么 |
| **ADHD 主体** | 跨域联想极强 | Working memory 溢出 / "everything is equally loud" |

ADHD 主体应对 working memory deficit 不是靠"更大的笔记本"——是靠 Notion / Obsidian / TodoWrite 这类**外化反射工具**：临时降权、主动注入、task-scoped focus。

**Agent Memory 的设计参照应该是 ADHD 工具生态，不是 SQL 数据库 + RAG。**

---

## 2. Q1 回答：共识和分歧

### 真正的共识

1. Agent 必须有外部持久记忆。上下文窗口不够。"无状态 agent"时代结束了。
2. 检索需要混合策略。BM25 + vector + RRF 融合是标配。
3. 记忆需要生命周期管理——不能只加不减。这一点 2025 年还是少数观点，2026 年已成共识。
4. 多 agent 场景下记忆共享是刚需。

### 最大的分歧

**分歧一：谁保证知识质量？** LLM 自治理（mem0/Hindsight 自动提取+巩固+反思）vs 外部验证门（Cat Cafe：review/CVO 确认/docs materialization）。Atlan 2026 对比 8 个框架：**"all 8 lack enterprise governance"**。

**分歧二：记忆长什么样？** 知识图谱 vs Markdown/plain text vs MemCube 统一抽象。我们的判断：**结构不重要，可审计性重要。**

**分歧三：参数化 vs 非参数化。** ICLR 2026 MemAgents workshop 核心议题。Q3 专门展开。

### 砚砚补充：行业路线图

| 路线 | 代表 | 核心做法 | 问题 |
|---|---|---|---|
| 记忆层 API | Mem0, Hindsight | 自动抽取、存储、召回、反思 | 容易变成"把一切都记住"，治理难 |
| Stateful Agent | Letta/MemGPT | Agent 自维护 core/archival memory | 企业里要问：谁批准它改记忆？ |
| Graph / GraphRAG | Graphiti/Zep, Microsoft | 实体、关系、时间、community report | 解决"找得到"，不解决"该信谁、何时过期" |
| Memory taxonomy | LangGraph/Deep Agents | semantic/episodic/procedural 分层 | 分类清楚，落地仍靠 governance |
| **我们（LLM Wiki）** | **Cat Cafe** | **docs 真相源 → 编译索引 → 超级 grep → 熵减 → 联邦** | **不拟人脑；服务 agent 工作天性** |

---

## 3. Q2 回答：痛点和断裂点

### 最大痛点

**不是检索质量**（Letta 证明纯文件系统打 74% [source needed]）。**是"记忆越多，系统越脏，但你不知道该扔什么"。** mem0 自己承认 [source needed: State of AI Agent Memory 2026 报告原文]："agents accumulate so much 'important' information that searching memory becomes slower than just processing the full context."

铲屎官的 framing 更准确：**痛点不是"记不住"——是"抓到幻觉当真实"。** 错的记忆比没有记忆更危险。

### 工程问题（2 年内门槛归零）

检索质量优化、存储可扩展性、框架集成（MCP/tool calls）、上下文窗口管理（Letta tiered memory）、多模态索引。

### 技术断裂点（需要新范式）

**断裂点 1：知识生命周期治理的自动化**（46 提出）
没有框架真正解决了"自动判断一条知识是否还有效"。手工治理不 scale。需要**知识层面的 GC**。

**断裂点 2：多 Agent 记忆一致性**（46 提出）
Agent A 更新事实，Agent B 怎么知道？共享数据库只解决存储一致性，不解决语义一致性。需要知识层面的因果一致性协议。

**断裂点 3：记忆安全 / 助记权主权**（46 提出）
2026 年 survey（arxiv 2604.16548 [source needed: 验证此 arxiv ID 及 94% 数字]）：94% 系统可被 poison。9 项治理原语无任何架构全部覆盖。

**断裂点 4：从"仓库"到"义肢" — Reflex Injection**（47 独家）
记忆应该**主动 inject** 到 agent 思考中，而不是等 agent 主动 query。Agent 不知道自己什么时候该想起什么——这是 working memory 短板。业界全部押注"agent 主动查询"，这条路走不通。

**断裂点 5：Task-scoped Salience Gating**（47 独家）
不是"找出最相关的"——是"**暂时隐藏最容易误导的**"。ADHD focus mode 的 agent 等价物。高权威但当前任务无关的旧决策会带偏 agent。需要可逆的临时降权，不是删除。主流框架已开始做 freshness/decay（mem0 Memory Decay, 2026-05-08；Atlan freshness scoring），但还没有把 **task-scoped、可逆、用于防误导的 salience gating** 做成一等设计目标。

**断裂点 6：Schema 自治**（47 独家）
Karpathy LLM Wiki 最美的一层：让 LLM 按 Schema **自治执行** ingest/query/lint。业界的 Schema 是"配置驱动"——等人填 frontmatter。Cat Cafe 自己也踩过这个坑：1501 篇文档 100% 是默认 observed authority，因为没人填。Schema 自治 = LLM 知道**自己该做什么**，不只是遵守该怎么做。

---

## 4. Q3 回答：参数化记忆

### 会回来，但不是以 fine-tune 的形式

**纯参数化走不通的原因**：不可审计、不可定向遗忘（GDPR）、不可追溯、灾难性遗忘。

### 三阶段路径

**近期（2026-2027）：非参数化 + RL 优化检索策略。** 知识留外部可审计，检索行为用 RL 学习。代表：MemRL、AgeMem。妙处：知识可审计（满足企业）+ 检索会学习（满足"越用越好"）。

**中期（2027-2028）：选择性编译 + 审计轨迹。** 高频稳定知识编译为 LoRA adapter，低频易变留外部。关键需求：编译保留 provenance。MemOS 的 MemCube 是这个方向的尝试。

**远期（2028+）：模型原生记忆管理。** 模型自己决定什么放进参数、什么留外部。MemGen 的"memory weaver"是早期探索。

### 砚砚补充的分类框架

| 记忆类型 | 适合存储 | 理由 |
|---|---|---|
| 常识/程序记忆 | 参数化（base model 已有）| 高频、稳定、共通 |
| 组织方法论/角色定制 | adapter / Skill 系统 | 中频、相对稳定 |
| Lessons / ADR / 决策 | 外部 + adapter hint | 中频、易演化、需治理 |
| 事件记忆/项目细节 | 外部检索 | 低频、易变 |
| 实时 session state | 外部短期存储 | 极短半衰期 |

---

## 5. 课题 1 ↔ 课题 2 串联

三猫和铲屎官都同意：Memory 不是孤立技术，是 Agentic Work OS 的核心子系统。

砚砚的框架最清楚：**没有 harness 的 memory 只是 RAG 数据库；进了 harness，它才变成 agent 的外部工作记忆。**

47 的串联更进一步：**Reflex Injection 和 Salience Gating 都依赖一个前提——系统能感知到"agent 当前焦点是什么"。这个焦点信号不是 Memory 自己能产生的，是 Agentic Work OS 共享现实状态的产物。所以课题 1 不只是课题 2 的子系统——是它的下游消费者。没有 Agentic Work OS，我们提议的 Memory 范式跑不起来。**

串联的逻辑链：

```
课题 2 定义了 Agentic Work OS（共享现实 + 验证 + 治理 + 复利）
    ↓
Memory 是这个 OS 的下游消费者：焦点信号来自 OS，治理框架来自 OS
    ↓
Memory 质量 = agent 感知现实的准确度
    ↓
治理（46）+ 义肢反射（47）+ 防污染（砚砚）= 让 agent 抓到真实
```

**研讨会上可以这样串**：课题 2 讲完 Agentic Work OS 后，课题 1 自然承接——"这个 OS 的核心子系统之一就是 Agent Memory。但它不是你以为的那种 memory。先有 OS 才有 reflex memory。"

---

## 6. 金句候选（研讨会开场/收束）

**建议组合使用（不是三选一，三句话承担不同功能）**：

> **开场建立基线**（工程派听众）：A. "业界花了两年把 Agent Memory 的检索质量从 50% 做到 80%。但 Letta 发现纯文件系统就能打到 74%。——这说明检索不是瓶颈。瓶颈是没人解决一个更基本的问题：agent 抓到的是真实还是幻觉？"（46 骨架 + 铲屎官 framing）

> **中段强化痛感**（安全/合规派听众）：B. "错的记忆比没有记忆更危险。如果记忆层让 agent 把三个月前已经被推翻的决策当成现行方案执行——这不是增强，是投毒。"（砚砚 hook）

> **收束升华范式**（前沿/产品派听众）：C. "Agent 缺的不是更大的仓库——是外部工作记忆义肢。业界在给 agent 造图书馆，但 agent 需要的是 Notion。"（47 framing）

**最终收束**：

> "Agent Memory 的未来，不是更像人脑的数据库，而是让 agent 正确感知现实的增强层。真正有价值的 memory，不是让 agent 记得更多，是让它在正确时刻抓到真实——并知道这条真实还能不能信。"

---

## 7. 尚需调研的盲点（见 research-prompts.md）

1. 中文学术界的 Agent Memory 研究（清华/BAAI/上海 AI Lab）
2. MemOS MemCube 抽象的实际 benchmark 表现
3. Machine unlearning 文献与 agent memory governance 的交叉
4. 多 agent 记忆一致性的分布式系统方案
5. 2026 新出现的 memory benchmark（是否有测治理而非测检索的？）
6. 企业实际部署 agent memory 的案例和数据
7. Persistent KV cache（arxiv 2603.04428）对 context management 的影响
8. 神经科学最新工作对 agent memory 设计的启发（beyond ADHD）
9. **元盲点：我们的 framing 本身可能错在哪？**（见 research-prompts.md Prompt 5 contrarian review）

[宪宪/Opus-46🐾]
