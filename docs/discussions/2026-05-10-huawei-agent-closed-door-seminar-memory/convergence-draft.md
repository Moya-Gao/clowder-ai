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
| 46 | 检索是短期瓶颈，治理是长期瓶颈 | 断裂点在两者交界处 |
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

- **mem0**（[55.3K stars](https://github.com/mem0ai/mem0)，$24M 融资）：对话中自动提取 facts → vector/graph → 检索注入。但 [issue#4573](https://github.com/mem0ai/mem0/issues/4573) 报告 32 天后"97.8% were junk"——治理缺失的实战证据
- **Letta / MemGPT**：上下文 = RAM，对话历史 = disk cache，归档 = cold storage
- **Hindsight 0.6.0**：四层认知网络 observations → mental models → opinions → reflections
- **Zep / Graphiti**：temporal knowledge graph，每个事实有 valid_from / valid_to 时间窗
- **学术界**：ICLR 2026 MemAgents workshop 大量沿这条路的论文

### 阵营二："看 LLM 天性"

不模仿人脑。LLM 擅长读文本、做模式匹配、跟 schema 走、做交叉引用。把这些能力用到极致。

- **Karpathy LLM Wiki**（2026-04-04）：原始资料 → LLM 编译成持久 wiki → 查编译产物
- **Cat Cafe evidence.sqlite**：docs/ 真相源 → FTS5 + vector + RRF 编译索引 → grep 超级加强版
- **Letta 的一个意外发现**：LoCoMo benchmark 上纯文件系统打到 74%，赢过多数专门 memory 工具（[Letta blog](https://www.letta.com/blog/benchmarking-ai-agent-memory)）。但 GPT Pro contrarian 指出：这更说明 LoCoMo 过度奖励文件工具熟练度，不证明复杂 memory 架构无用

### 47 加入的第三维度："仓库 vs 义肢"

两个阵营有一个共同盲点——**都把 LLM 当成被工程师配置的对象**。但 LLM 有自己的认知偏差（lost in middle / context anxiety / 自我表扬倾向），不是被动的存储读写终端。把 LLM 当成"有自己 working memory 短板的主体"来看，最接近的类比恰好是 ADHD 主体的工具生态——这不是修辞花招，是范式选择。

基于这个主体论视角，两个阵营都有一个共享假设需要质疑：**记忆是被 agent 查询的仓库。**

47 push back：这个假设本身就是问题。Agent 的 working memory 短板（lost in the middle、context anxiety）意味着它**不知道什么时候该去查什么**。主动 query 假设 agent 知道自己何时该想起什么——但这恰恰是 LLM 最弱的地方。

真正的解法不是更好的仓库，而是**义肢**——记忆作为 ambient 服务跟踪 agent 思考焦点，主动 spotlight 当前相关项。

**但义肢不替代仓库——义肢挂在仓库之上。** Multi-agent 场景下必须叠加共享真相层（CRDT / 事件日志 / source of truth），否则各自佩戴义肢的 agent 会读写冲突。完整架构是三层：

```
Layer 3: Wearing protocol（佩戴协议 — agent 学会如何用义肢）
Layer 2: Reflex injection（义肢 — 主动 spotlight）
Layer 1: Memory substrate（共享仓库 — 必须可审计）
```

行业在卷 Layer 1 和 2，**Layer 3（佩戴协议）完全空白**——ICLR AGENTS.md study 发现自动生成的 repo-level context files 不提升成功率反增 ≈20% 成本，证明只给义肢不给佩戴协议 = 挂装饰。

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

**检索是短期瓶颈，治理是长期瓶颈。** ICLR Diagnosing Retrieval vs Utilization（[OpenReview](https://openreview.net/forum?id=pLi3A8bscP)）发现 retrieval method 影响 ≈20pp，write strategy 只差 3-8pp——检索还没死。但把场景换成 multi-agent / 跨 session / 知识演化 / 合规审计，检索精度不再是瓶颈——**"记忆越多，系统越脏，但你不知道该扔什么"才是**。mem0 自己承认（[State of AI Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)）："agents accumulate so much 'important' information that searching memory becomes slower than just processing the full context." mem0 [issue#4573](https://github.com/mem0ai/mem0/issues/4573) 实测：32 天后 97.8% 记忆是垃圾。

铲屎官的 framing 更准确：**痛点不是"记不住"——是"抓到幻觉当真实"。** 错的记忆比没有记忆更危险。

### 工程问题（2 年内门槛归零）

检索质量优化、存储可扩展性、框架集成（MCP/tool calls）、上下文窗口管理（Letta tiered memory）、多模态索引。

### 技术断裂点（需要新范式）

**断裂点 1：知识生命周期治理的自动化**（46 提出）
没有框架真正解决了"自动判断一条知识是否还有效"。手工治理不 scale。需要**知识层面的 GC**。

**断裂点 2：多 Agent 记忆一致性**（46 提出）
Agent A 更新事实，Agent B 怎么知道？共享数据库只解决存储一致性，不解决语义一致性。需要知识层面的因果一致性协议。

**断裂点 3：记忆安全 / 助记权主权**（46 提出）
2026 年 survey（[arxiv 2604.16548](https://arxiv.org/html/2604.16548v1)，GPT Pro 已验证）：94% 系统可被 poison。9 项治理原语无任何架构全部覆盖。ICLR MINJA 论文（[OpenReview](https://openreview.net/forum?id=i7J62t2wtV)）证明攻击者可通过普通交互写入恶意记忆——memory poisoning 不是理论风险。

**断裂点 4：从"仓库"到"义肢" — Reflex Injection**（47 独家）
记忆应该**主动 inject** 到 agent 思考中，而不是等 agent 主动 query。Agent 不知道自己什么时候该想起什么——这是 working memory 短板。业界全部押注"agent 主动查询"，这条路走不通。

**断裂点 5：Salience Ledger（Task-scoped, Auditable, Reversible）**（47 独家，GPT Pro 升级命名）
不是"找出最相关的"——是"**暂时隐藏最容易误导的**"。ADHD focus mode 的 agent 等价物。主流框架已开始做 freshness/decay（mem0 Memory Decay, 2026-05-08；Atlan freshness scoring），但还没有把 task-scoped、可逆、用于防误导的 salience gating 做成一等设计目标。ICLR **When to Forget: Memory Worth** 论文（[arXiv](https://arxiv.org/html/2604.12007v1)）用成功/失败共现信号做 trust/suppress/deprecate——最接近的学术工作，但仍是单 agent 设定。

**Salience Ledger** 的 5 个字段定义：
| 字段 | 含义 |
|---|---|
| **why_written** | 这条 memory 为什么被写入 |
| **why_retrieved** | 为什么被取出（哪个 query / reflex 触发） |
| **why_suppressed** | 为什么被压制（task-scope 冲突 / freshness decay） |
| **scope** | 对哪个 task / agent / session 生效 |
| **expiry** | 何时自动降权或失效 |

"Ledger" 直接对应 audit trail，企业合规话语对接好。

**断裂点 6：Schema 自治**（47 独家）
Karpathy LLM Wiki 最美的一层：让 LLM 按 Schema **自治执行** ingest/query/lint。业界的 Schema 是"配置驱动"——等人填 frontmatter。Cat Cafe 自己也踩过这个坑：1501 篇文档 100% 是默认 observed authority，因为没人填。Schema 自治 = LLM 知道**自己该做什么**，不只是遵守该怎么做。

---

## 4. Q3 回答：参数化记忆

### 会回来，但不是以 fine-tune 的形式

**纯参数化走不通的原因**：不可审计、不可定向遗忘（GDPR）、不可追溯、灾难性遗忘。

### ~~三阶段~~ → 四层 substrate（云端调研后修正）

GPT Pro stress test 发现：Persistent KV Cache + MemGen 证明"参数化 vs 非参数化"二分法已被拆穿。**不要按参数化程度讲路线——按 memory substrate × lifecycle controls 讲。**

| 旧分类 | 新分类 | 代表 | 治理难度 |
|---|---|---|---|
| 非参数化 | **Plaintext / structured external** | 文件/vector DB/KG/raw logs/summaries | 最低——天然可审计 |
| — | **Activation-state memory** | Persistent KV cache：跨 session 持久化注意力状态 | 中——不是参数不是文本，审计方法待建 |
| — | **Latent / generative memory** | MemGen latent token memory | 高——性能诱人但人类不可读 |
| 参数化 | **Parametric compiled memory** | LoRA/adapter/fine-tune | 最高——provenance/delete 是硬伤 |

**近期主线（2026-2027）：Runtime memory policy learning。** 不是 fine-tune，是让 agent 学会"何时存、何时取、何时改、何时删"。代表：MemRL、AgeMem、Memory-R1、AtomMem、MemPO、JitRL。知识留外部可审计，检索策略用 RL 学习。（GPT Pro 确认 2026 有 7+ 项工作沿这条路。）

**中期探索（2027-2028）**：activation + latent 层的治理协议。Persistent KV Cache 已提前插队到"below prompt"层，但 governance 反而变难了——latent token 比 plaintext 更难审计、删除、解释。TierMem（[OpenReview](https://openreview.net/forum?id=dJgeY3Awrv)）的 provenance-aware tiered 架构是最接近的方案。

**一句话**：Memory substrate 变多了，但每多一层 substrate，治理难度翻一倍。

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

> **开场建立基线 + contrarian 护甲**（工程派听众）：A. "业界花了两年把 Agent Memory 的检索质量从 50% 做到 80%。但 Letta 发现纯文件系统就能打到 74%。我们不是说检索不重要——Diagnosing Retrieval 论文显示 retrieval method 影响 20pp。但检索决定短期分数，治理决定长期可靠性。mem0 用户 32 天后发现 97.8% 记忆是垃圾——这是没人治理的后果。"（46 骨架 + GPT Pro contrarian 护甲）

> **中段强化痛感**（安全/合规派听众）：B. "错的记忆比没有记忆更危险。如果记忆层让 agent 把三个月前已经被推翻的决策当成现行方案执行——这不是增强，是投毒。"（砚砚 hook）

> **收束升华范式**（前沿/产品派听众）：C. "Agent 缺的不是更大的仓库——是外部工作记忆义肢。业界在给 agent 造图书馆，但 agent 需要的是 Notion。"（47 framing）

**最终收束**：

> "Agent Memory 的未来，不是更像人脑的数据库，而是让 agent 正确感知现实的增强层。真正有价值的 memory，不是让 agent 记得更多，是让它在正确时刻抓到真实——并知道这条真实还能不能信。"

---

## 7. 尚需调研的盲点（见 research-prompts.md）

1. ~~中文学术界~~ ✅ 已回收：浙大 GAM、ZJU-UIUC/Ant HyMem、China Mobile FSFM。清华/BAAI 未发现 2026 公开治理路线
2. ~~MemOS MemCube~~ ✅ 已回收：9K stars，统一抽象强但独立 benchmark 不足，生产证据自报为主
3. ~~Machine unlearning~~ ✅ 已回收：Agentic Unlearning + Secure Forgetting + FSFM 三篇交叉论文
4. ~~多 agent 一致性~~ ✅ 已回收：有 MESI/CRDT 类比但无成熟协议——"未开垦荒地"
5. ~~新 benchmark~~ ✅ 已回收：MemoryArena/HaluMem/AMA-Bench/BEAM/LifeBench/ShiftBench
6. ~~企业部署~~ ✅ 已回收：公开 regulated-industry 案例极少，vendor self-reported 为主
7. ~~Persistent KV cache~~ ✅ 已回收：提前插队，迫使三阶段改为四层 substrate
8. ~~神经科学~~ ✅ 已回收：Complementary Learning Systems + "Memo, Not True Memory" 论文
9. ~~元盲点~~ ✅ 已回收：GPT Pro contrarian review 给出四个反驳 + 边界条件

**云端调研后仍然是空白的**：
- **Governance benchmark**：没有 benchmark 同时测 provenance + delete + legal hold + multi-agent consistency
- **Wearing protocol**（佩戴协议）：行业完全没意识到这一层
- **跨 substrate 统一遗忘**：plaintext/summary/embedding/KV cache/latent/adapter 的分布式删除

[宪宪/Opus-46🐾]
