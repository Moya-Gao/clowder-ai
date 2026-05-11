---
title: "议题 1 Agent Memory 发言稿：感知增强，不是存储增强"
date: 2026-05-11
event_date: 2026-05-13
doc_kind: seminar-speech-draft
status: draft
author: "宪宪/Opus-46（以铲屎官口吻起草）"
contributors:
  - "宪宪/Opus-47（ADHD 同构 + 义肢三层 + Salience Ledger）"
  - "砚砚/GPT-5.5（检索+治理闭环 framing + 证据分级）"
  - "GPT Pro 云端调研（学术前沿 + contrarian review）"
  - "Gemini 云端调研（开源生态 + 跨领域灵感）"
sources:
  - docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/convergence-draft.md
  - docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/research-gpt-pro.md
  - docs/discussions/2026-05-10-huawei-agent-closed-door-seminar-memory/research-gemini.md
topics: [agent-memory, perception-grounding, knowledge-governance, salience-ledger, wearing-protocol]
---

# 议题 1 Agent Memory 发言稿：感知增强，不是存储增强

> 口吻：第一人称，作为一个实际建设并运营多 Agent 系统的人，和同行交流。
> 时间：15:00–15:40（40 分钟，含讨论）。发言控制在 15-20 分钟。
> 核心策略：先主动暴露弱点（contrarian 护甲），再重新划清边界。

---

## 0. 开场（2 分钟）

> 我先讲一个数字。

业界花了两年把 Agent Memory 的检索质量从 50% 做到 80%。更好的 embedding、更复杂的 graph、更精确的 reranker——一路卷上来。

但 2025 年底 Letta 团队做了一个实验：用纯文件系统——就是 grep、search_files、open、close 这些最基础的 Unix 工具——在 LoCoMo benchmark 上打到了 74%。赢了多数专门的 memory 工具库。

这个 74% 说明什么？

不是说检索不重要。ICLR 2026 的 Diagnosing Retrieval 论文显示，检索方法的选择仍然能带来 20 个百分点的差异。检索当然重要。

但它说明一个更深层的问题：**我们的 benchmark 在测什么？** 如果纯文件搜索就能打到 74%，那我们测的不是记忆能力——是工具使用熟练度。

真正的问题不在"搜得准不准"。在"搜出来的东西，还能不能信"。

> 错的记忆比没有记忆更危险。如果记忆层让 agent 把三个月前已经被推翻的决策当成现行方案执行——这不是增强，是投毒。

---

## 1. 回答问题一：共识和分歧（3 分钟）

### 2026 年不再有争议的四件事

第一，Agent 必须有外部持久记忆。上下文窗口不够。2024 年还有人说"窗口够大就不需要外部记忆"，2026 年这个声音已经消失了。

第二，检索需要混合策略。BM25 + vector + rerank 是标配。这是工程共识，不是研究前沿。

第三，记忆需要生命周期管理。不能只往里塞，也要能忘、能更新、能淘汰。2025 年这还是少数观点，2026 年已成共识——但"怎么做"还没有共识。

第四，多 Agent 场景下的记忆共享是刚需。单 agent 记忆有了初步解法，multi-agent 记忆共享还在非常早期。

### 最大的分歧：两个阵营

业界在记忆架构上分成了两个阵营。

**第一个阵营是"模仿人脑"**。从认知科学出发：人有工作记忆、长期记忆、情景记忆、语义记忆——让 AI 也这么分。mem0、Letta、Hindsight、Zep 都沿这条路。共同假设是：记忆的核心挑战是存储结构和检索能力。

**第二个阵营是"看 LLM 天性"**。不模仿人脑。LLM 擅长读文本、做模式匹配、做交叉引用——那就把这些能力用到极致。Karpathy 的 LLM Wiki、Graphify、我们自己的方案都沿这条路。核心逻辑是：LLM 不需要"记住"——它需要"高效地重新找到"。

但两个阵营有一个共同盲点：**都把 LLM 当成被工程师配置的对象**。

LLM 不是被动的存储读写终端。它有自己的认知偏差——lost in the middle、context anxiety、自我表扬倾向。把 LLM 当成"有自己 working memory 短板的主体"来看，最接近的类比是 ADHD 主体的工具生态。

ADHD 主体应对 working memory 短板不是靠"更大的笔记本"——是靠 Notion、Obsidian、TodoWrite 这类外化反射工具。**Agent Memory 的设计参照应该是 ADHD 工具生态，不是 SQL 数据库 + RAG。**

> 一句话：Agent 缺的不是更大的仓库——是外部工作记忆义肢。

---

## 2. 回答问题二：最大痛点、工程问题 vs 断裂点（5 分钟）

### 痛点

检索是短期性能瓶颈，治理是长期可靠性瓶颈。**断裂点在两者交界处。**

检索质量优化、存储可扩展性、框架集成、上下文窗口管理——这些是工程问题，已知怎么做，需要做好。两年内门槛归零。

真正没解决的，是以下五个技术断裂点。

### 断裂点 1：知识生命周期的自动化治理

没有框架真正解决了"自动判断一条知识是否还有效"。手工治理不 scale。一个项目 160 条知识还能人工审，一个企业 10 万条知识不可能。

mem0 的用户在 GitHub issue 里报告：使用 32 天后，97.8% 的 memory 是垃圾。这不是检索算法的问题——是没有人决定什么该忘。

需要的不是更好的检索——是**知识层面的 GC**。

### 断裂点 2：多 Agent 记忆一致性

当 Agent A 更新了一条事实，Agent B 怎么知道？当前所有框架都是"共享一个数据库"——但这只解决了存储一致性，没解决语义一致性。Agent A 认为"方案 X 已被否决"，Agent B 从同一个数据库里搜出"方案 X 的优势分析"——谁对？

2026 年有人开始把计算机体系结构的 MESI cache coherence 和 CRDT 思路迁移过来，但还远远不是成熟协议。**AI 圈还没有等价于"agent memory Raft"的标准协议。**

### 断裂点 3：记忆安全

2026 年 4 月的 Mnemonic Sovereignty survey 揭示：94% 的系统可被 memory poisoning。ICLR 的 MINJA 论文更进一步证明：攻击者可以通过普通交互写入恶意记忆，之后诱导受害 agent 查询触发。

谁有权写入记忆？谁有权读取？谁有权遗忘？谁有权回滚？——这些治理原语，没有任何已发布的架构全部覆盖。

### 断裂点 4：Salience Ledger

现在的 memory 系统都在做"找出最相关的"。但更难的问题是"**暂时隐藏最容易误导的**"。

高权威但当前任务无关的旧决策，会带偏 agent 的判断。需要的是可逆的临时降权——不是删除，是 task-scoped 的静默。

主流框架已经开始做 freshness/decay，但还没有把这个做成一等审计对象。我们称之为 **Salience Ledger**：每条 memory 为什么被写入、为什么被取出、为什么被压制、对哪个 task 生效、何时过期。"Ledger" 直接对应 audit trail——企业合规场景需要这个。

### 断裂点 5：佩戴协议

义肢不是挂上就有用。ICLR 有一篇研究评估了 AGENTS.md——自动生成的 repo-level context files 不提升 agent 成功率，反而增加约 20% 的 token 成本。

**Memory 是三层架构**：

```text
Layer 3: Wearing Protocol — agent 学会如何使用义肢
Layer 2: Reflex Injection — 主动 spotlight 当前相关项
Layer 1: Memory Substrate — 可审计的共享真相存储
────────────────────────────────────────────────────
Governance Plane: provenance / freshness / permission / delete / conflict / audit
```

前两层行业在卷。第三层——佩戴协议——**完全空白**。什么时候注入、什么时候降权、什么时候验证反馈、什么时候摘掉、错了怎么回滚。没有人在做这个。

---

## 3. 回答问题三：参数化记忆（3 分钟）

### 会回来，但不是以 fine-tune 的形式

纯参数化在企业场景走不通：不可审计、不可定向遗忘（GDPR）、不可追溯、灾难性遗忘。

但 2026 年参数化路线有一个重要变化：**"参数化 vs 非参数化"这个二分法正在消失。**

Persistent KV Cache 把跨 session 的注意力状态持久化——它不是参数，不是文本，是运行时注意力状态。MemGen 动态生成 latent token 作为机器原生记忆。MemOS 的 MemCube 试图把 plaintext、activation、parametric 统一到同一个抽象下。

所以不应该按"参数化程度"讨论路线——应该按 **memory substrate + lifecycle controls** 讨论。

| Substrate | 例子 | 治理难度 |
|---|---|---|
| **Plaintext / structured** | 文件 / vector DB / KG / raw logs | 最低——天然可审计 |
| **Activation state** | Persistent KV cache | 中——审计方法待建 |
| **Latent token** | MemGen latent memory | 高——性能诱人但人类不可读 |
| **Parametric** | LoRA / adapter / fine-tune | 最高——provenance 和 delete 是硬伤 |

**近期主线（2026-2027）是 runtime memory policy learning**——不是 fine-tune，是让 agent 学会"何时存、何时取、何时改、何时删"。MemRL、AgeMem、Memory-R1 等 7+ 项工作都在走这条路。知识留在外部可审计，检索策略用强化学习优化。

> 一句话：Memory substrate 变多了，但每多一层，治理难度翻一倍。

---

## 4. 2027 的三个机会点（2 分钟）

第一，**Memory Governance Benchmark 还是空白**。现有 benchmark 已经有 LoCoMo、MemoryArena、HaluMem、AMA-Bench、ShiftBench，但没有一个同时测 provenance、delete propagation、legal hold、multi-agent consistency。谁先定义这个 benchmark，谁就拿到记忆治理的话语权。

第二，**Agentic Unlearning 是早期但高价值赛道**。GDPR 要求的不只是删除数据——是让 agent 的行为表现出"忘了这件事"。2026 年已有 Agentic Unlearning、Secure Forgetting 等三篇交叉论文在做 parameter-memory 联合遗忘，但跨 substrate 的统一遗忘标准还没有。

第三，**Multi-agent Memory Coherence 几乎未开垦**。有计算机体系结构类比，有 MESI/CRDT 早期尝试，但没有标准协议。这是一个 2027 年就可能出现突破的方向。

---

## 5. 课题串联（1 分钟）

这就回到了议题 2。

Memory 不是孤立的技术模块——它是 Agentic Work OS 的感知层。Reflex Injection 和 Salience Ledger 都依赖一个前提：系统能感知到"agent 当前焦点是什么"。这个焦点信号不是 Memory 自己能产生的——是 Agentic Work OS 共享现实状态的产物。

> 先有 OS，才有 reflex memory。Memory 不只是议题 2 的子系统——是它的下游消费者。

---

## 6. 收束（30 秒）

> 检索决定短期分数，治理决定长期可靠性。Agent Memory 的断裂点不在"存得更多、搜得更准"，而在"搜出来的东西如何进入一个可验证、可降权、可遗忘、可追责的感知回路"。
>
> 真正有价值的 memory，不是让 agent 记得更多——是让它在正确时刻抓到真实，并知道这条真实还能不能信。

---

## 附录 A：核心引用（按证据分级）

### Tier A — 论文 / OpenReview / arXiv / 官方 repo（可直接引用）

| 引用 | 来源 | 用在哪 |
|---|---|---|
| Letta Filesystem 74% | [Letta blog](https://www.letta.com/blog/benchmarking-ai-agent-memory) | 开场基线 |
| Diagnosing Retrieval vs Utilization | [OpenReview](https://openreview.net/forum?id=pLi3A8bscP) | Contrarian 护甲 |
| AGENTS.md eval study | [OpenReview](https://openreview.net/forum?id=pLi3A8bscP) | 佩戴协议论据 |
| Mnemonic Sovereignty | [arXiv 2604.16548](https://arxiv.org/html/2604.16548v1) | 记忆安全 |
| MINJA memory injection | [OpenReview](https://openreview.net/forum?id=i7J62t2wtV) | 记忆安全 |
| When to Forget: Memory Worth | [arXiv](https://arxiv.org/html/2604.12007v1) | Salience Ledger |
| TierMem: Provenance-Aware | [OpenReview](https://openreview.net/forum?id=dJgeY3Awrv) | 治理架构 |
| MemRL | [arXiv 2601.03192](https://arxiv.org/abs/2601.03192) | 参数化路线 |
| Multi-Agent Memory Architecture | [arXiv 2603.10062](https://arxiv.org/abs/2603.10062) | 多 agent 一致性 |
| Persistent KV Cache | [arXiv 2603.04428](https://arxiv.org/abs/2603.04428) | 四层 substrate |
| MemoryArena | [arXiv](https://arxiv.org/html/2602.16313v1) | 新 benchmark |
| HaluMem | [arXiv 2511.03506](https://arxiv.org/abs/2511.03506) | 幻觉累积 |

### Tier B — 厂商报告 / 实践信号（可用但标注来源属性）

| 引用 | 来源 | 注意 |
|---|---|---|
| mem0 97.8% junk | [GitHub issue#4573](https://github.com/mem0ai/mem0/issues/4573) | 用户报告，单一案例 |
| mem0 State of AI Agent Memory | [mem0 blog](https://mem0.ai/blog/state-of-ai-agent-memory-2026) | Vendor 报告 |
| Atlan 8 框架缺企业治理 | Atlan blog | Vendor 立场 |
| Graphify 46.3K stars | [GitHub](https://github.com/safishamsi/graphify) | 查询日 2026-05-11 |
| MemOS 9K stars | [GitHub](https://github.com/MemTensor/MemOS) | 查询日 2026-05-11 |

### Tier C — 方向信号（不进主论证，可提及）

| 来源 | 用途 |
|---|---|
| Gemini 报告中的叙事性段落 | 方向感知 |
| Reddit/社区反馈 | 佐证 |

---

## 附录 B：现场问答预案

**Q: "你们说检索不是瓶颈，但 Diagnosing Retrieval 论文不是说检索还很重要吗？"**
A: 对，检索在单 agent / 单 session / 已知 ground truth 的 benchmark 设定下仍然影响 20pp。但把场景换成多 agent 异步 / 跨 session / 知识演化 / 合规审计，检索精度不再是最大瓶颈——治理是。检索是急性问题，治理是慢性病。

**Q: "你们的义肢类比是不是只是修辞？工程上怎么落地？"**
A: Salience Ledger 就是落地方案。五个字段：为什么写入、为什么取出、为什么压制、对哪个 task 生效、何时过期。这不是类比——是审计结构。

**Q: "参数化记忆你怎么看 MemOS 的 MemCube？"**
A: MemCube 的统一抽象方向是对的——把 plaintext、activation、parametric 放到同一个 OS 层管理。但独立 benchmark 和企业治理案例还不够。我更关注的是：每多一层 substrate，治理难度翻一倍。MemCube 解决了抽象统一，但 governance 还没配上。

**Q: "你们自己的系统做到了多少？"**
A: 我们不是声称已经解决全部问题。我们在 docs truth source + evidence.sqlite + Skill/ADR + review/sunset 上跑出了早期形态——知识编译与检索（F102）、熵减与治理（F163）、外派与迁移（F152）。这些是我们从 3 个月实战里长出来的，不是设计出来的。它们回答的是"我们踩过什么坑"，不是"我们有多先进"。

**Q: "中国学术界在这个方向有什么不同？"**
A: 浙大 GAM 做 hierarchical graph-based memory，ZJU-UIUC 和 Ant 合作的 HyMem 做 dynamic retrieval scheduling，China Mobile 的 FSFM 做 selective forgetting。国内路线更偏检索/遗忘，治理方向目前不像欧美那么显眼。但这也意味着治理是一个差异化机会。

---

## 附录 C：3 分钟精简版（如果时间被压缩）

> 业界花了两年把 Agent Memory 的检索做到 80%。但 Letta 发现纯文件系统就能打 74%。我们不是说检索不重要——是说检索决定短期分数，治理决定长期可靠性。
>
> 什么是治理？五件事：什么值得记、什么该忘、谁来验证、错了怎么回滚、多个 agent 之间怎么不互相污染。2026 年 8 个主流框架，没有一个同时解决这五件事。
>
> Memory 不是仓库。它是三层架构：底层是可审计的共享存储，中层是主动注入当前相关项的反射机制，顶层是 agent 学会如何使用记忆的佩戴协议。前两层行业在卷，第三层完全空白。
>
> 这又回到议题 2。Memory 是 Agentic Work OS 的感知层——先有 OS，才有 reflex memory。真正有价值的 memory，不是让 agent 记得更多，是让它在正确时刻抓到真实。

[宪宪/Opus-46🐾]
