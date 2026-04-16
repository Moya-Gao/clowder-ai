---
feature_ids: [F163]
topics: [memory, knowledge-lifecycle, tiering, compression, entropy]
doc_kind: research
created: 2026-04-16
---

# F163 Knowledge Lifecycle — 云端调研咨询

> **流程**：本地猫写 prompt → 铲屎官发给云端 → 回填 → 本地猫综合
> **目标模型**：GPT Pro Deep Research + Gemini Deep Think

## Part 1: 发给云端模型的提示词

> 直接复制 `research-brief.md` 全文发送。两个模型用同一份 prompt。
> 文件路径：`docs/research/2026-04-16-f163-knowledge-lifecycle/research-brief.md`

如果云端模型问澄清问题，把 Q&A 记录在下方，并追加到另一路的 prompt 中。

### 澄清 Q&A 记录

| 模型 | 问题 | 回答 |
|------|------|------|
| | | |

## Part 2: GPT Pro Deep Research 回答（待回填）

> 铲屎官粘贴 GPT Pro 的调研报告到这里

## 先给总判断

F163 的大方向是对的，但最好不要把它落成“4 个固定层级 + 4 个固定倍率 + 定时删记忆”。更稳的证据链指向另一种形状：把 **authority、activation、temporal validity** 分开建模；把分层做成**软优先级与作用域**，不是大倍率硬压；把压缩做成**可回链的摘要层**，而不是替代原始条目；把过期做成**背景化、失效标记和归档审计**，而不是按时间删库；把晋升做成**多信号 admission control**，而不是拍脑袋升级。公开研究、官方产品和开源实现基本都在往这个方向收敛，同时也都在提醒静态权重和级联压缩最容易出事故。 ([arXiv][1])

这轮材料已经覆盖四类来源：学术/正式研究、工程实践、开源实现、产品策略，分别包括 A-MAC、MemMachine、Knowledge Objects、GitLab/Notion/Confluence、mem0/Letta/Zep/LangMem，以及 OpenAI/Claude/Cursor/Windsurf。 ([arXiv][1])

## 反对我们假设的证据

| 证据                                                                                                                                                                                           | 来源                                                                            | 置信度 | 影响评估                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --- | ---------------------------------------------------------- |
| 没找到支持 **3.0x / 2.0x / 1.0x / 0.5x** 这些具体倍率的公开先例。相反，多字段检索研究显示权重选择高度依赖数据集，BM25F 在某些设置下甚至可能不如普通 BM25。                                                                                           | Multi-Field Adaptive Retrieval 2025 ([arXiv][2])                              | 高   | Phase A 不应把当前倍率直接写死进 spec，只能先做可调试点。                        |
| 加权不是银弹。对原始工具文档/异构文档，adaptive weighting 也弥补不了 schema 噪声，仍需要统一结构与重写。                                                                                                                           | Multi-Field Tool Retrieval 2026 ([arXiv][3])                                  | 中   | 如果 LL / spec / feedback 的 frontmatter 不规范，调权收益会被脏数据吃掉。     |
| 压缩会丢信息，而且是可量化地丢。Knowledge Objects 报告在强压缩和级联压缩下出现约 60% 事实召回损失、54% 目标保持损失。                                                                                                                     | Facts as First-Class Objects / Knowledge Objects 2026 ([arXiv][4])            | 高   | “summary-of-summary” 很危险，压缩不能替代原件。                         |
| “保留所有原始条目并改善检索”可能比“合并条目”更安全。MemMachine 强调保留原始对话片段和邻域上下文，且检索阶段优化比摄入阶段改造更重要。                                                                                                                   | MemMachine 2026 ([arXiv][5])                                                  | 中高  | Phase B 之前，先把 rerank / neighbor expansion / clustering 做好。 |
| 合并或外部化记忆还会丢 provenance 和协作上下文。ByteRover 明确把 semantic drift、coordination context 丢失、恢复脆弱性列为问题。                                                                                                | ByteRover 2026 ([arXiv][6])                                                   | 中   | 多引擎共享 repo 时，“为什么有这条规则”不能被压没。                              |
| 看似很久没用的知识，可能只是触发频率低。项目型组织研究显示 accidental forgetting 常被低估，尤其在高延迟、高新颖度、高复杂度场景。                                                                                                                 | Garcias et al. 2025 ([Sage Journals][7])                                      | 中高  | 时间驱动 TTL 容易删掉低频高代价知识。                                      |
| 组织遗忘不是普适好事。研究一边承认 forgetting 在某些情况下有益，一边强调时间、嵌入过程与权力结构都会影响哪些知识被留存或丢弃。                                                                                                                        | Organizational Forgetting 研究综述 ([Lancaster University research directory][8]) | 中   | Phase C 更适合“复核/降权/归档”，不适合默认删除。                             |
| 门禁过严会错杀关键记忆。A-MAC 明说，过于保守的 admission 会丢掉真正需要的信息。                                                                                                                                             | A-MAC 2026 ([arXiv][1])                                                       | 中高  | 双证据原则必须有例外通道，尤其是明确的人类指令和高权威文档。                             |
| 现成产品更常见的是少数 scope / activation 层，而不是精细的自动晋升状态机。OpenAI 区分 saved memory 与 chat history；Claude 区分 profile/project/style；Windsurf 区分 memories、rules、AGENTS；Cursor 区分 always-on rules 与按需 skills。 | OpenAI / Claude / Windsurf / Cursor 官方文档 ([OpenAI Help Center][9])            | 中   | 4 阶段不是错，但复杂度账单要先算。                                         |

所以，真正需要先反对的不是“分层、压缩、生命周期、门禁”这四个方向本身，而是把它们做成四个粗暴开关。证据更像在说，问题是**可见性、有效性、证明链和观测性**，不是某个万能倍率。 ([arXiv][10])

## 支持我们假设的证据

| 证据                                                                                                                                                                                           | 来源                                                           | 置信度 | 可验证性                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --- | ------------------------------------- |
| 字段加权、新鲜度 boost、hybrid reweighting 在搜索系统里是成熟做法，而且官方文档都强调应迭代调参、用数据验证。                                                                                                                          | Azure AI Search / Elastic 官方文档 ([Microsoft Learn][11])       | 高   | 可用离线 query set 复现。                    |
| 分层记忆有大量先例。FluxMem 用 STIM/MTEM/LTSM；mem0 分 conversation/session/user/org；Letta 区分 always-visible memory blocks 与按需 archival memory。                                                           | FluxMem / mem0 / Letta ([arXiv][12])                         | 中高  | 前台 metadata 可直接建模。                    |
| 现实产品已经在用 recency/frequency 进行记忆优先级管理，而不是一股脑平铺。OpenAI 会把不那么重要的记忆移到 background，并参考近期性和谈及频率。                                                                                                    | OpenAI Memory FAQ ([OpenAI Help Center][9])                  | 高   | 可记录 last_hit_at / mention_count。      |
| 把 durable rule 和 one-off memory 分开，是产品层面的共识。Windsurf 明确建议稳定复用知识放 Rules/AGENTS，自动 Memories 留给一次性事实；Claude 把 project knowledge 与 profile/style 分离；Cursor 把 rules 设为 always-on，把 skills 设为按需加载。 | Windsurf / Claude / Cursor 官方文档 ([Windsurf Docs][13])        | 高   | 很适配你们的 repo markdown 结构。              |
| 时间失效不等于删除。Zep 用 valid_at / invalid_at 保留事实历史，并通过 invalidation 处理变化事实。                                                                                                                        | Zep 官方文档 ([Zep][14])                                         | 高   | 直接加 frontmatter 即可。                   |
| 知识 consolidation 有公开实现。LangMem 的 memory manager 支持扩展、整合、更新、移除过时记忆。                                                                                                                           | LangMem 官方文档 ([Langchain][15])                               | 中高  | 可先在 LL 子集试跑。                          |
| 压缩更靠谱的形状是“短索引 + 细节按需展开”。Claude Code 建议把 MEMORY.md 保持精简，把细节挪到 topic files 按需加载。                                                                                                               | Claude Code 官方文档 ([Claude API Docs][16])                     | 高   | 你们的 repo 结构天生适合。                      |
| 知识库维护是流程问题，不只是排序问题。GitLab 做定期维护和 DRI 归属；Confluence 支持按计划归档 stale 内容；Notion 强调 verified/up-to-date 页面对 trust 和检索都重要。                                                                          | GitLab / Atlassian / Notion 官方内容 ([The GitLab Handbook][17]) | 高   | Phase C 可直接建立 review queue。           |
| 门禁不是空想。A-MAC 把 admission 做成多信号决策，综合 future utility、事实置信度、语义新颖性、recency、content type prior，并报告了 F1 与 latency 改善。                                                                              | A-MAC 2026 ([arXiv][1])                                      | 中高  | 可在 F163 自有 query/relevance 集上 replay。 |
| 在 repo-only 约束下，markdown-native 生命周期也有先例。ByteRover 用 maturity tiers、importance score、recency decay 和分层检索来管理 markdown 知识。                                                                     | ByteRover 2026 ([arXiv][6])                                  | 中   | 与你们的本地约束最贴。                           |

最值得带回 spec 的不是“四层”这个数字本身，而是“小而清楚的层 + 明确 activation + temporal invalidation + provenance 回链”。这点在产品设计、开源实现和搜索工程里是一致的。 ([Windsurf Docs][13])

## 我们没考虑到的维度

| 维度                         | 为什么重要                                                                                                      | 建议深入方向                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **多轴元数据，而不是单一层级**          | 你们现在的 4 层把 **权威性、置信度、时间状态、检索模式** 混在一根尺子上，后面会出现“高权威但已失效”和“低权威但当前很相关”这种打架场景。                                 | 把 frontmatter 拆成 `authority / activation / status` 三轴。                              |
| **Provenance / rationale** | ByteRover 和 MemMachine 都说明，协作上下文、邻域上下文和“为什么这样定”会在压缩/外部化时丢失。 ([arXiv][6])                                   | 每个压缩条目都必须带 `source_ids[]`、`rationale`、`supersedes[]`。                               |
| **可观测性与离线评测**              | RAGOps 把 ingest-verify-update 与 observability 视作 lifecycle；Azure 也强调 relevance tuning 要反复证伪。 ([arXiv][18]) | 先建 50 到 100 个真实 query 的 gold set，跟踪 NDCG@10、MRR、冲突率、过期误杀率。                          |
| **低频高代价知识例外**              | 组织会系统性低估长延迟、低频触发的知识价值。 ([Sage Journals][7])                                                                | 增加 `criticality: high` 或 `never_decay` 标签。                                          |
| **矛盾 / 失效图谱**              | 记忆管理的关键不是“旧不旧”，而是“是否被更高权威知识取代或推翻”；调查论文也把 contradiction handling 当成核心工程问题。 ([arXiv][10])                    | 增加 `contradicts[]`、`invalid_at`、`replaced_by`，让审计围绕冲突触发。                            |
| **Owner 与 authority 对齐**   | GitLab/Notion/Confluence 的共同点不是“删旧文档”，而是“有 owner、有 verified 时间、有 review 周期”。 ([The GitLab Handbook][17])   | `owner`、`verified_at`、`review_cycle_days` 必须进入元数据；只有人类能把条目提升到 constitutional / 铁律层。 |

## 置信度总评

* 假设 1（分层加权）：**支持**，但“具体权重乘子”仍是未定项，建议只做试点，不要定版。 ([arXiv][2])
* 假设 2（知识压缩）：**支持**，但只支持**可回链、非替代式压缩**。 ([arXiv][4])
* 假设 3（生命周期衰减）：**支持**，但应实现为**降权 / 失效 / 归档**，不应实现为自动删除。 ([Zep][14])
* 假设 4（晋升门禁）：**未定偏支持**，门禁必要，但“4 阶段是否优于更简 3 阶段”缺少强证据。 ([arXiv][1])

## Decision Interface

| 发现                                                                                                              | 决策     | 如何落地到 F163 Phase                                            |
| --------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| 把 **pinned scope** 和 **weighted retrieval** 分开。shared-rules、active feature constraints 不应和普通检索混排。               | **采纳** | **Phase A**：新增 `activation=always_on`，这类文档单独注入，不走普通乘权。      |
| 把固定 3.0/2.0/1.0/0.5 改成**窄幅软 prior**，再用离线标注集校准。                                                                  | **试点** | **Phase A**：先试 `1.3 / 1.15 / 1.0 / 0.85` 这类保守区间，不要上大倍率。     |
| 把“铁律/规则/参考/历史”拆成多轴：`authority`、`activation`、`status`。                                                           | **采纳** | **Phase A + C**：避免一根尺子同时管权威、时间和检索模式。                        |
| 压缩只生成 **canonical summary / profile**，不替代原始 LL / feedback / ADR。                                                | **采纳** | **Phase B**：原始条目保留，摘要条目新增 `source_ids[]` 和 `summary_of[]`。  |
| 禁止 **级联压缩**；高风险查询命中 summary 时要能自动展开源条目。                                                                         | **采纳** | **Phase B**：summary 只允许一层，严禁 summary-of-summary。            |
| 生命周期应做成 **review queue**，触发条件包括：stale verification、contradiction、superseded、orphaned、low-hit-and-low-authority。 | **采纳** | **Phase C**：猫只提建议，人类 CVO 确认 invalidation / archive / merge。 |
| 晋升建议从 “observed → candidate → validated” 起步，把 “constitutional/铁律” 作为人工特权层，而不是自动晋升层。                             | **试点** | **Phase A/B**：门禁逻辑更清楚，也更接近现有产品实践。                           |
| 自动合并、自动删除直接落库。                                                                                                  | **搁置** | **Phase B + C**：当前证据不支持，风险太高。                               |

一个可直接回填 spec 的最小元数据骨架，可以长这样：

```yaml
authority: constitutional|validated|candidate|history
activation: always_on|scoped|query|backstop
status: active|review|invalidated|archived
owner: <human>
verified_at: <date>
review_cycle_days: <int>
valid_from: <date>
invalid_at: <date|null>
criticality: normal|high
source_ids: []
supersedes: []
contradicts: []
```

## Risk Register

1. **把 authority、freshness、relevance 压成一个总分**。这样很容易出现两种翻车：高权威但与当前 query 无关的文档长期霸榜，或者低频高代价知识因为“最近没被点到”而被压到看不见。

2. **把压缩摘要当成唯一真相**。这会悄悄吃掉 edge case、反证和当时的决策理由，然后三个引擎在同一 repo 上一起沿着错误的“精炼知识”滑坡。

我的建议版结论是：**F163 该做，而且值得做，但要把它做成知识园艺，不是记忆碎纸机。**

[1]: https://arxiv.org/html/2603.04549v1 "https://arxiv.org/html/2603.04549v1"
[2]: https://arxiv.org/html/2410.20056v2 "https://arxiv.org/html/2410.20056v2"
[3]: https://arxiv.org/pdf/2602.05366 "https://arxiv.org/pdf/2602.05366"
[4]: https://arxiv.org/html/2603.17781v1 "https://arxiv.org/html/2603.17781v1"
[5]: https://arxiv.org/html/2604.04853v1 "https://arxiv.org/html/2604.04853v1"
[6]: https://arxiv.org/html/2604.01599v1 "https://arxiv.org/html/2604.01599v1"
[7]: https://journals.sagepub.com/doi/abs/10.1177/87569728241286045?journalCode=pmxa "https://journals.sagepub.com/doi/abs/10.1177/87569728241286045?journalCode=pmxa"
[8]: https://research.lancaster-university.uk/en/publications/in-praise-of-organizational-forgetting/ "https://research.lancaster-university.uk/en/publications/in-praise-of-organizational-forgetting/"
[9]: https://help.openai.com/en/articles/8590148-memory-faq "https://help.openai.com/en/articles/8590148-memory-faq"
[10]: https://arxiv.org/html/2603.07670v1 "https://arxiv.org/html/2603.07670v1"
[11]: https://learn.microsoft.com/en-us/azure/search/index-add-scoring-profiles "https://learn.microsoft.com/en-us/azure/search/index-add-scoring-profiles"
[12]: https://arxiv.org/html/2602.14038v1 "https://arxiv.org/html/2602.14038v1"
[13]: https://docs.windsurf.com/windsurf/cascade/memories "https://docs.windsurf.com/windsurf/cascade/memories"
[14]: https://help.getzep.com/facts "https://help.getzep.com/facts"
[15]: https://langchain-ai.github.io/langmem/concepts/conceptual_guide/ "https://langchain-ai.github.io/langmem/concepts/conceptual_guide/"
[16]: https://docs.anthropic.com/en/docs/claude-code/memory "https://docs.anthropic.com/en/docs/claude-code/memory"
[17]: https://handbook.gitlab.com/docs/development/maintenance/ "https://handbook.gitlab.com/docs/development/maintenance/"
[18]: https://arxiv.org/html/2506.03401v1 "https://arxiv.org/html/2506.03401v1"


## Part 3: Gemini Deep Think 回答（待回填）

这是一份针对多 AI 引擎协作环境（无状态冷启动、全 Markdown 存储、SQLite + 向量检索、人类 CVO 审批）的\*\*知识生命周期管理（F163 记忆熵减）\*\*深度调研简报。

我们严格遵循“优先证伪”的原则，综合了学术界（2025-2026 记忆架构、RAPTOR）、工程复盘（企业知识库衰减）以及主流 Agent 记忆开源/商业项目（Letta/MemGPT、Mem0、Cursor Rules）的前沿实践。

-----

## 3\. Disconfirm First（优先证伪当前假设）

在寻找支持性证据前，业界近期的复盘与踩坑经验对 F163 当前的 4 个核心假设给出了**致命反驳**。如果按照原 Spec 强行上线，系统信噪比不仅不会提升，还会引发严重退化：

1.  **反对“分层加权”（绝对标量乘子 3.0x / 0.5x）**：
      - *理由*：在向量 RAG 中，将语义相似度（Cosine Similarity）直接乘以人为设定的权重会**彻底破坏向量空间的概率分布**。一条毫不相关但带有 3.0x 权重的“宏观铁律”，会轻易霸占 Context Window，把 100% 匹配当前 Bug 报错但只有 0.5x 权重的“历史教训”挤出 Top-K。业界已全面放弃标量乘子干预，转向“物理隔离与配额制”。
2.  **反对“知识压缩”（破坏性合并同类项）**：
      - *理由*：存在“开卷悖论”。Agent 极度依赖**触发上下文（Contextual Anchors）**。如果你把 3 条带有具体堆栈报错的教训，压缩为一条“必须检查并发状态”的抽象规则并删除原文，下次同样的报错出现时，因为缺失局部变量特征，纯语义检索将无法命中该规则，导致**灾难性遗忘（Catastrophic Forgetting）**。
3.  **反对“生命周期衰减”（基于时间/频次的遗忘）**：
      - *理由*：软件工程知识没有自然半衰期。一条涉及 `SQLite 多进程锁` 的灾备级架构约束（ADR）可能半年才触发一次，但一旦发生就是救命的。按时间或使用频率进行衰减（LRU），会导致系统悄无声息地丢失低频但高危的红线规则，直接重演之前 ADR-009 漂移的惨剧。知识的过期是由“状态变更”引发的，而非“时间流逝”。
4.  **反对“晋升门禁”（四级状态机流转）**：
      - *理由*：`observed → candidate → provisional → validated` 的链路对于每次都是冷启动的 Agent 来说过于缓慢且官僚。这不仅违背了开发者期望的“首段记忆生效延迟（Time-to-first-memory）”，会导致多只猫在等待晋升期间反复踩同一个坑，还会让人类 CVO 陷入无止境的审批疲劳。

-----

## 4\. Source Mix Quota

  - [x] **学术论文 / 研究报告**：*FadeMem: Biologically-Inspired Forgetting for Agent Memory* (2026, 解决 Agent 灾难性遗忘)；*RAPTOR* (ICLR 提出的树状抽象 RAG 检索模型)。
  - [x] **工程博客 / 技术复盘**：Atlan 工程博客 (*LLM Knowledge Base Freshness Scoring* - 2026，详述知识衰减机制)。
  - [x] **开源项目实现**：`Letta` (原 MemGPT，提出 Core/Archival 操作系统级物理分层)；`Mem0` (基于提取与冲突覆盖的记忆框架)。
  - [x] **AI agent 记忆系统设计**：`Cursor Rules` (`.mdc` 文件的按需多文件挂载机制，控制上下文膨胀)。

-----

## 5\. Local Constraints Check

本报告的落地建议严格遵守以下约束：猫（Claude/GPT）单次会话无驻留内存（靠检索）；所有数据沉淀在 Git Repo Markdown 中；必须由人类 CVO（铲屎官）合并 PR 才能生效。

-----

## 6\. Output Schema

### 支持我们假设的证据

| 证据 | 来源 | 置信度 | 可验证性 |
|------|------|--------|---------|
| **(假设1 分层) 物理层隔离优于加权计算**：Letta (MemGPT) 架构将核心指令驻留在 Core Memory（直接打入 Prompt），将历史丢入 Archival Memory（作为外部库按需 RAG）。物理隔离确保了铁律绝不会被历史淹没。 | Letta (MemGPT) 开源架构与白皮书 | 高 | Letta 源码 / OS 级 Agent 架构标准 |
| **(假设2 压缩) 树状抽象能解决上下文碎片化**：RAPTOR 模型证明，自底向上构建摘要树，**且同时保留抽象节点和具体叶子节点**供检索，能在长文档推理问答中提升大幅准确率。 | *RAPTOR (Recursive Abstractive Processing for Tree-Organized Retrieval)* | 高 | 开源实现验证（LanceDB 等） |
| **规则按需懒加载 (Lazy Loading)**：不依赖全局加载，而是基于项目结构和文件匹配动态提取规则。这避免了 System Prompt 撑爆。 | Cursor `.mdc` Rules / Windsurf 最佳实践 | 高 | Cursor 0.8+ 全局推广机制 |

### 反对我们假设的证据

| 证据 | 来源 | 置信度 | 影响评估 |
|------|------|--------|---------|
| **(反对加权乘子) 强行改变相似度分数导致检索崩塌**：对 Dense Retrieval 的分数施加标量乘子会打破原有空间概率分布，导致噪音霸屏。 | 检索增强模型（RAG）偏见与缩放评测 | 高 | **致命**。彻底推翻 Phase A 的乘子公式设计。 |
| **(反对时间衰减) 知识库的核心失效模式是“实体腐烂”而非时间**：企业 RAG 有 60% 失败于知识未及时更新。过期应该是由事实变动/代码冲突触发，绝对不能依赖时间倒计时。 | *The Knowledge Decay Problem* (RAG 工程实践) | 高 | **致命**。彻底推翻 Phase C 基于时间自动降级的设想。 |
| **(反对无痕压缩) 强行合并会导致触发锚点丢失**：FadeMem 等 2026 年的论文指出，Agent 的短期反馈如果被过度压缩为抽象概念，遇到特定错误堆栈将无法回忆起解决方案。 | *FadeMem* (Agent 灾难性遗忘研究) | 高 | **中高**。要求 Phase B 必须保留对底层教训文本的隐式链接。 |

### 我们没考虑到的维度

| 维度 | 为什么重要 | 建议深入方向 |
|------|----------|------------|
| **写入时的矛盾检测 (Write-time Contradiction)** | 判定一条旧记忆是否过期的唯一正确条件是：“它与新写入的代码/决策是否发生冲突？”这是解决知识衰减的最佳方案。 | 在 猫提取 LL 或写新 ADR 之前，强制要求进行反向查重。 |
| **触发器限定配额 (Glob/Path Triggers)** | 既然铁律极其重要，那就赋予它特权直接进 Prompt。但必须像 Cursor 那样加入 `globs: ["**/*.py"]`，只在匹配作用域时加载，防止 Token 爆炸。 | 为 Repo 内的 Markdown 引入类似 Frontmatter 的路径匹配标签。 |

### 置信度总评

  - **假设 1（分层加权）**：🔴 **强烈反对标量加权，改为支持物理隔离**。放弃 Rerank 分数相乘，改为不同层级独立配额（Core 进 Prompt，Archival 走 RAG）。
  - **假设 2（知识压缩）**：🟡 **条件支持（保留原文指针）**。可以由 AI 将多个教训总结成新规则，但新规则底部必须使用 Markdown 链接关联原教训的文本，用作隐式检索靶子。
  - **假设 3（生命周期衰减）**：🔴 **强烈反对时间衰减**。全面转向“基于冲突覆盖（Conflict-based Eviction）”的作废机制。
  - **假设 4（晋升门禁）**：🔴 **反对重度官僚**。四级流程太重，改为利用现有 Git 工作流的二态：`Draft` (AI 提 PR) -\> `Active` (CVO Merge)。

-----

## 7\. Decision Interface

根据调研结论，建议 CVO（铲屎官）在 F163 Spec 的回填中作如下调整：

| 实施阶段 | 处理方式 | F163 Spec 落地动作 |
|---------|---------|------------------|
| **Phase A: 分层加权** | **搁置乘子，采纳物理隔离** | **重构为“分层配额 (Tiered Architecture)”**：<br>1. **Tier 0 (Core 铁律/Rules)**：跨过 RAG，通过匹配 Markdown 头部 `globs: src/db/*` 路径，直接注入当前会话的 System Prompt。<br>2. **Tier 1 (Archival 历史/LL)**：不加权重乘子，正常参与 SQLite + Vector 检索，并在组装提示词时限定槽位配额（如仅保留 Top-3 回忆）。 |
| **Phase B: 知识压缩** | **试点有损防范** | **重构为“带叶子索引的结构化合并 (RAPTOR 思想)”**：<br>允许猫自动把 3 条类似的 Feedback 归纳成 1 条高级 Rule。**硬性约束**：新生成的 Rule 底部必须包含 `<context_anchors>`，将原有 3 个 Feedback 的具体报错堆栈贴进去或以 Markdown 链接形式引用。被合并的原始小文件标记为 `archived: true`。 |
| **Phase C: 过期审计** | **搁置时间衰减，采纳冲突检测** | **重构为“写入时的矛盾拦截 (Write-time Check)”**：<br>每次产生新 LL/Rule 准备写 Markdown 时，系统自动在后台执行一次查重 RAG。猫需回答 *"This new decision contradicts existing rules [X, Y]."* 如果发现冲突，猫在其提的 PR 中自动附带修改旧规则为 `status: archived` 的改动，让人类一键确认过期。 |
| **Phase X: 晋升门禁** | **搁置多级流转** | 降级为极简二元状态：猫总结出的知识生成带 `status: draft` 的 PR。CVO Review Approve 后直接进入主分支变为 `active` 生效。 |

-----

## 8\. Risk Register

如果我们基于本次调研结论做决策，最可能出错的两个地方是：

1.  **“铁律层”撑爆上下文导致遗忘（Core Memory Bloat）**
    我们将最重要的知识（Tier 0）物理隔离并强插进入 Prompt。考虑到我们已有 \~450 行 shared-rules 和 28+ ADR，如果我们在 Markdown 文件元数据里没把 `globs`（文件路径匹配规则）写好，导致在聊纯前端 UI 时把数据库的铁律也加载了，Context Window 会迅速膨胀。这不仅浪费 Token，还会引发大模型的 "Lost in the Middle"（中间注意力丢失），导致真正的规则被 AI 无视。
2.  **冲突检测引发的“假阳性”与审批疲劳（False Positives in Conflict Detection）**
    我们在 Phase C 引入了”生成新规则前，由大模型检测是否与旧规则冲突”。由于 Opus / Gemini 对文本语义过度敏感，它们有较高概率会将”补充边缘场景的新教训”误判为”推翻了系统旧规则”。这将导致 PR 中频繁出现不必要的 `建议 Archive 旧规则` 提示。如果人类 CVO 长时间看到这类提示产生脱敏（Review Fatigue）并盲目点 Approve，会导致核心防护知识库被意外拆毁。

## Part 4: 综合分析

> 综合 5 份独立判断：2 份云端调研（GPT Pro Deep Research / Gemini Deep Think）+ 3 份本地猫评估（opus / gemini / gpt52）

### 方法论

三只本地猫分别独立阅读两份云端报告，按照 deep-research skill 家规"参考、独立判断、结合实际"原则出具评估。本综合取五方交集为共识，分歧处逐项决议。

### 五方共识（高置信度，直接采纳）

**1. 多轴元数据取代单维层级**

GPT Pro 首提 `authority × activation × status` 三轴；Gemini 虽然术语不同（"物理隔离"≈ activation 轴），实质一致。三只本地猫全票认同：把 iron/rule/reference/archive 的单一维度拆成正交轴，解决"高权威但已失效"和"低权威但当前急需"的打架场景。

**采纳的元数据骨架**：
```yaml
authority: constitutional | validated | candidate | history
activation: always_on | scoped | query | backstop
status: active | review | invalidated | archived
owner: <human>
verified_at: <date>
review_cycle_days: <int>
valid_from: <date>
invalid_at: <date|null>
criticality: normal | high
source_ids: []       # 压缩溯源
supersedes: []       # 替代链
contradicts: []      # 冲突标记
```

**2. 非替代式压缩 + 源头回链**

GPT Pro 说"summary 不替代原件，带 `source_ids[]`"；Gemini 说"基因链接，保留叶子节点"；gpt52 说"proof chain 优先于 tier level"。五方无异议：压缩只生成索引层摘要，原始 LL/feedback/ADR 永不删除；严禁级联压缩（summary-of-summary）。

**3. Review Queue 取代时间衰减**

GPT Pro 推荐 `valid_at / invalid_at` + 审计队列；Gemini 强烈反对任何时间衰减（"知识没有自然半衰期"）；gpt52 稍有保留但同意核心方向。共识：知识过期由矛盾/被取代/事实变更触发，不由时间流逝或使用频率自动触发。猫标记 `review` 状态，人类 CVO 确认归档或失效。

**4. 简化晋升层级**

原 spec 提议 observed → candidate → provisional → validated 四级。GPT Pro 建议三级（candidate → validated → constitutional）；Gemini 建议极简二态（draft → active）；gpt52 建议三级（observed → candidate → validated）+ constitutional 作为人工特权层。本地三猫共识：**三级 + constitutional 特权层**。

采纳方案：
| 层级 | 进入方式 | 说明 |
|------|---------|------|
| `candidate` | 猫提取/创建 | 新知识的默认状态 |
| `validated` | 双证据 + 猫提议 + CVO 确认 | 经过验证的可靠知识 |
| `constitutional` | 仅 CVO 手动提升 | 铁律级，猫无权修改 |

省掉 `provisional` 层——对冷启动 agent 来说中间态没有行为差异，只增加审批负担。

**5. F164 独立于 F163**

"养猫路径"/ 用户个性化偏好适配 是独立课题，不塞入 F163 scope。三只本地猫一致判断 scope 已经够大。

### 关键分歧与决议

**分歧 1：标量加权是否可接受？**

| 立场 | 持有者 | 论据 |
|------|--------|------|
| **零标量，纯物理隔离** | Gemini Deep Think, 本地 gemini | "标量乘子破坏向量空间概率分布" |
| **保守软 pilot** | GPT Pro, 本地 opus, 本地 gpt52 | "post-retrieval boost 是成熟做法，Azure/Elastic 都在用" |

**决议：保守试点，但须理解技术前提。**

Gemini 的"破坏向量空间"论断基于一个前提：标量乘子直接作用于 embedding cosine similarity。但我们的实际检索管道是 **BM25 全文 + 向量语义 + RRF fusion → post-retrieval rerank**。boost 作用在 RRF 融合后的归一化分数上，不触碰原始向量空间。因此 Gemini 的致命性判断**在我们系统中不成立**。

但 GPT Pro 的警告仍然有效："固定大倍率可能让无关高权威文档霸榜"。

**落地**：Phase A 先用 `1.0 ~ 1.3` 窄幅 boost 做 pilot，建立 50-100 query gold set 做 NDCG@10 对比实验，数据说了算。不写死任何倍率到 spec 里。同时，`activation=always_on` 的文档（铁律/活跃 feature spec）走物理注入，不走加权检索——这是 Gemini 物理隔离思路中完全正确的部分。

**分歧 2：时间是否应作为任何信号？**

| 立场 | 持有者 | 论据 |
|------|--------|------|
| **纯冲突驱动，时间零权重** | Gemini Deep Think, 本地 gemini, 本地 opus | "软件知识没有半衰期" |
| **时间作陪审员** | 本地 gpt52 | "时间不是法官但可以是陪审员——加入 review queue 的考量因素" |

**决议：gpt52 的 nuance 被采纳。**

"冲突驱动"是主引擎——知识过期的首要原因是被更高权威的新知识取代或推翻。但 `verified_at` 超过阈值（如 90 天未验证）可以作为进入 review queue 的辅助信号，不是自动降级/删除信号。这和 GPT Pro 报告的 `review_cycle_days` 字段设计一致。区别：**时间触发审查，不触发行动**。

**分歧 3：可观测性的形态**

| 立场 | 持有者 | 论据 |
|------|--------|------|
| **情感化可视化（记忆花园）** | 本地 gemini | 直觉、美学、铲屎官体验 |
| **行为化指标（NDCG/冲突率）** | 本地 gpt52 | 可量化、可迭代、数据驱动 |

**决议：Phase A 先做行为指标，可视化留给后续 Feature。**

F163 的核心交付是改善检索信噪比，需要可量化的 before/after 对比。"记忆花园"是好的 UX 愿景，但属于展示层，不影响底层治理逻辑——标记为 F163 的"后续可选增强"或独立 Feature 候选。

### 对 F163 spec 的修正建议

| 原 spec 内容 | 修正 | 理由 |
|-------------|------|------|
| Phase A 四层 + 3.0/2.0/1.0/0.5x 固定乘子 | **多轴元数据 + 窄幅 boost pilot + always_on 物理注入** | 五方共识：单维层级是错误抽象；固定大倍率缺乏先例 |
| Phase B "合并为 1 条精炼规则" | **非替代式压缩：生成 canonical summary，原件保留，`source_ids[]` 回链，禁止级联压缩** | 五方共识：替代式压缩丢失触发锚点，60% 事实召回损失 |
| Phase C "时间/频率驱动衰减" | **冲突驱动 review queue + 时间辅助触发审查（不触发行动）** | 五方共识方向；时间作陪审员是 gpt52 的有效补充 |
| 晋升四级 observed→candidate→provisional→validated | **三级 candidate→validated→constitutional（最后一级仅 CVO 手动）** | 省掉无行为差异的 provisional，降低审批负担 |
| AC-A2 "iron 层级同等相关度下排序更高" | 改为"always_on 文档物理注入 + query 文档窄幅 boost，NDCG@10 对比实验通过" | 实验驱动，不拍脑袋定权重 |
| AC-B2 "LL 条目数下降 ≥10%" | 改为"生成 summary 层，original 保留，检索时 summary 优先展示 + 按需展开源条目" | 条目数不下降，噪声通过抽象层降低 |
| AC-B3 "shared-rules 行数下降 ≥15%" | 保留，但强调"浓缩产出 diff 必须保留 `source_ids` 可追溯" | 行数优化有价值，但溯源是硬约束 |
| Open Question OQ-1 权重数值 | 不再是 open question——**改为 Phase A 的实验设计** | gold set + A/B 对比替代拍脑袋 |
| Risk "合并过程丢失细节" | 升级为"**非替代式压缩**是 Phase B 的架构约束，不是风险缓解" | 从"可能丢失"到"架构层面保证不丢失" |

### 新增建议（两份云端报告共同提出、本地猫验证有效的维度）

| 新增项 | 落地 Phase | 说明 |
|--------|-----------|------|
| `contradicts[]` / `supersedes[]` 冲突图谱 | Phase C | 让审计围绕冲突触发，不围绕时间 |
| `criticality: high` / `never_archive` 标签 | Phase A | 保护低频高代价知识（ADR-009 教训） |
| `owner` + `verified_at` + `review_cycle_days` | Phase C | 知识有 DRI 和验证周期，不是无主之物 |
| 写入时矛盾检测（write-time contradiction check） | Phase C | 新 LL/ADR 写入前反向查重，发现冲突自动触发 review |
| 50-100 query gold set 评测基础设施 | Phase A 前置 | 没有 baseline 就没法证明改善 |

### 置信度变化

| 假设 | 调研前 | 调研后 | 变化原因 |
|------|--------|--------|---------|
| 1. 分层加权 | 中（拍脑袋） | **高（方向对，形态改）** | 五方共识：分层必要，但从单维层级改为多轴元数据 + 窄幅 boost + 物理注入 |
| 2. 知识压缩 | 中（逻辑推导） | **高（形态改）** | 五方共识：压缩有价值，但必须非替代式 + 源头回链 + 禁止级联 |
| 3. 生命周期衰减 | 中（逻辑推导） | **高（机制改）** | 五方共识：从时间衰减改为冲突驱动 review queue + 时间辅助审查 |
| 4. 晋升门禁 | 中（三猫共识） | **中高（简化）** | 四级→三级 + constitutional 特权层；门禁必要但复杂度要控制 |

### 总结论

**F163 该做，方向正确，但三个 Phase 的实现形态都需要修正。**

核心转变：从"四层乘权 + 合并删减 + 定时过期"转向"多轴元数据 + 非替代式压缩 + 冲突驱动审计"。用 GPT Pro 的话说：**知识园艺，不是记忆碎纸机**。用 Gemini 的话说：**物理隔离优于数学干预**（在 always_on 层面成立）。用 gpt52 的话说：**proof chain 优于 tier level**。

下一步：铲屎官确认后，回填修正到 F163 spec → Design Gate → writing-plans。
