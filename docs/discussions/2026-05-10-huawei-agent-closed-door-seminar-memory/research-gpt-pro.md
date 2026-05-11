---
title: "课题 1 Agent Memory 云端调研 — GPT Pro"
date: 2026-05-11
doc_kind: discussion
status: draft
source_model: GPT Pro
topics: [agent-memory, research, cloud-research]
---

# 课题 1 Agent Memory 云端调研 — GPT Pro

铲屎官，砚砚调研回收稿来了。结论先放在猫爪垫上：**你们的 thesis 大方向是对的，但“记忆不是检索问题”这句话太容易被反杀。更稳的说法是：检索是短期性能瓶颈，治理是长期生存瓶颈。** 2026 的前沿正在从“怎么召回更准”转向“什么该写、什么时候忘、谁能读、怎么追责、多个 agent 怎么不互相污染”，但检索派还没有输，甚至有几篇论文正好能当你们 5/13 的反证护甲。🐾

## 0. 锚点验真：哪些能用，哪些要降权

**高可信锚点。** MemRL、AgeMem、MemGen、Persistent KV Cache、MemOS/MemCube、ICLR 2026 MemAgents Workshop 都查到了公开论文或官方页面。MemRL 是运行时 RL 优化 episodic memory 检索策略；AgeMem 把 store/retrieve/update/summarize/discard 等记忆操作做成 agent tool，并用分阶段 RL 学管线；MemGen 用 memory trigger 和 memory weaver 动态生成 latent token memory；Persistent KV Cache 把跨 session 的 attention state 持久化到磁盘，明显挑战“参数化 vs 非参数化”的旧二分。([arXiv][1])

**需要降权的锚点。** mem0 的 2026 报告、Atlan 2026 框架比较、Hindsight 的生产使用说法，都有价值，但更像 practitioner/vendor evidence，不该当成中立学术证据。Letta “纯文件系统 74% LoCoMo”很重要，但它是 2025 结果，且作者自己也在指出 LoCoMo 这类 benchmark 可能过度奖励熟悉的文件工具，而不一定证明复杂 memory 架构无用。([Mem0][2])

**一个要小心的点。** 我没有在可核验结果里直接确认到“Karpathy 2026-04-04 gist”这个具体锚点本体，但 Graphify、LLM Wiki、knowledge compiler 这条生态链确实存在。建议研讨会上把它称为“Karpathy-style LLM Wiki / knowledge compiler 方向”，不要把具体日期当硬证据。Graphify 本身是活跃开源项目，查询时显示 46.3k stars、latest release v0.7.13 on May 9, 2026。([GitHub][3])

---

## 1. 学术前沿扫描：2026 真正在变的东西

### A. ICLR 2026 MemAgents Workshop：超越“检索优化”的论文

ICLR 2026 MemAgents Workshop 是真存在的，主题明确把 agent memory 定义为在线、交互驱动、由 agent 控制的系统，议题包括 write policy、temporal credit assignment、in-weights memory、provenance、forgetting 和 lifelong learning。OpenReview 列出的投稿里，已经不只是 RAG/检索调参，而是开始进入 memory lifecycle 的“脏活累活区”。([Google Sites][4])

最值得盯的 5 个：

| 工作                                   | 核心贡献                                                                       | 对你们场景的意义                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **TierMem: From Lossy to Verified**  | summary-first retrieval，但在需要时升级到 immutable raw log，并做 verified write-back。 | 这是“治理型 memory”的强锚点：不是只追求召回，而是把 provenance、raw evidence、可验证写回纳入架构。([OpenReview][5])  |
| **When to Forget: Memory Worth**     | 给每条 memory 维护成功/失败共现信号，用来 trust/suppress/deprecate。                        | 直接命中 memory GC。它把“该忘什么”从静态 heuristic 变成在线治理原语。([arXiv][6])                          |
| **ShiftBench**                       | 专门测 agent memory 在 session boundary、分布漂移、恢复场景下的失败。                         | 这不是普通检索精度 benchmark，而是在测“记忆遇到变化时会不会害死 agent”。([OpenReview][7])                      |
| **Memory Injection Attacks / MINJA** | 证明攻击者可通过普通交互写入恶意记忆，之后诱导 victim query 触发。                                   | 这是“memory poisoning 不是理论风险”的证据，能支撑你们的治理论。([OpenReview][8])                          |
| **ALMA**                             | 让 meta-agent 自动搜索 memory schema、retrieval、update 机制，而不是人手设计 memory 架构。     | 这是反证兼机会：如果 memory design 可以被自动搜索，你们的框架要从“固定架构”升级到“治理约束 + 可搜索策略空间”。([OpenReview][9]) |

**空白判断。** ICLR workshop 里已经有 provenance、forgetting、poisoning、shift benchmark，但“完整企业级 governance benchmark”还没成熟。没有看到一个 benchmark 同时系统评分：记忆淘汰、权限隔离、冲突解决、provenance 追溯、删除传播、legal hold。这就是 5/13 可以打的一张牌。

### B. Machine Unlearning × Agent Memory：开始交叉，但还很早

2026 已经出现很明确的交叉工作。**Agentic Unlearning** 把问题定义为同时从模型参数和 persistent memory 中移除指定信息，指出传统 unlearning 只管参数会留下“parameter-memory backflow”和外部 memory 漏洞。它提出 synchronized dual-update，把 memory pathway 和 parametric pathway 一起处理。([arXiv][10])

**Secure Forgetting for LLM-based Agents** 更接近你们说的“agent 定向遗忘”：它把 unlearning 分成 state、trajectory、environment 三类，并把高层自然语言遗忘请求转换成可执行 unlearning prompt，再用 adversary 测行为上是否真的忘掉。这个方向非常适合与你们的“不是删数据，而是让行为表现出忘了”合流。([arXiv][11])

**FSFM** 是国内 China Mobile / Jiutian 相关工作，提出 neuro-inspired selective forgetting，强调 forgetting 是效率、质量、安全的基础，不是 bug。它给了 passive decay、active deletion、safety-triggered forgetting、adaptive RL 等分类，但数字结果属于自报实验，建议作为“中文工程/框架路线”引用，不要当核心证据。([arXiv][12])

**Mnemonic Sovereignty** 则是治理侧强锚点。它把 runtime memory 生命周期拆成 write、store、retrieve、execute、share、forget/rollback，并强调 long context 不能替代 long-term memory，因为真正难的是持久性、共享性、压缩谱系、权限、回滚和可验证遗忘。([arXiv][13])

**空白判断。** “可审计、跨 vector DB / summary / KV cache / file memory / parametric adapter 的统一遗忘”仍然是空白。现在更多是概念框架或受控 benchmark，离企业合规系统还有距离。

### C. 多 Agent 记忆一致性：架构类比很多，语义协议很少

2026 有一篇很对题的综述型/position work：**A Multi-Agent Perspective on Memory in LLM-based Systems: Insights from Computer Architecture**。它把 multi-agent memory 类比为 I/O、cache、memory 的三层结构，并明确指出 shared memory 会带来 coherence 问题，distributed memory 则带来同步、权限、可见性、顺序和冲突解决问题。([arXiv][14])

有早期工作尝试把 **MESI cache coherence** 迁移到多 agent token/state 管理，也有论文讨论 CRDT-style mapping 到语义对话内容的困难。但整体看，CRDT、vector clock、causal broadcast 这些分布式系统思想还没有变成 agent memory 的成熟工程协议。最大难点不是“冲突检测”本身，而是“语义冲突”：两个 agent 写入的 memory 可能词面不冲突，但任务语义互斥。([arXiv][15])

**CoMAM / Joint Optimization of Multi-agent Memory** 和 **SuperLocalMemory** 这类工作开始碰 multi-agent shared memory、credit assignment、privacy-preserving memory 和 poisoning defense，但更像早期路线图，不是已经落地的 consensus layer。([arXiv][16])

**空白判断。** 这是非常好的研讨会机会点：**AI 圈还没有等价于“agent memory Raft/CRDT/MESI”的标准协议**。现在更多是“借计算机体系结构的词”，离可部署协议还差一只猫跳。

### D. 2026 新 Benchmark：从 LoCoMo 外扩到漂移、幻觉、长程任务和真实用户

LoCoMo 之外，2026 的 benchmark 开始往“memory 用坏会怎样”转。**HaluMem** 是 operation-level hallucination benchmark，覆盖 memory extraction、updating、QA，显示 memory 系统会在抽取和更新阶段产生并累积幻觉，最后传播到问答。([arXiv][17])

**MemoryArena** 关注 interdependent multi-session agentic tasks，要求 agent 从前面 session 的行动和反馈中学习，再在后续任务使用 memory。它比传统“问答式记忆”更接近真实 agent workflow。([arXiv][18])

**AMA-Bench** 明确说现有 memory systems 在真实 agentic application 中会丢失 causality 和 objective information，并提出用 causality graph 和 tool-augmented retrieval 的 AMA Agent。它对你们很有用，因为它不是只测“找没找到事实”，而是测“记忆能不能保留行动因果”。([OpenReview][19])

**ShiftBench** 测 memory 在分布漂移和 session boundary 之后的恢复能力；**MemoryCD** 用真实跨年、跨领域 Amazon Review 行为构造用户中心 benchmark；**RealMem** 则强调 long-term project、cross-session dialogue、动态更新和 proactive alignment。([OpenReview][7])

**空白判断。** 已经有 benchmark 测 hallucination、shift、long-horizon、interdependent tasks，但还没有看到成熟 benchmark 专门量化 governance primitive，例如 delete propagation、legal hold conflict、multi-agent consistency、principal-scoped retrieval、audit replay。

### E. 中文学术界和国内路线

我查到的中文/国内相关公开工作，不是清华/BAAI/上海 AI Lab 为主，而是 **浙大、Ant、China Mobile/Jiutian、山东系机构、MemTensor/MemOS 生态**更显眼。**GAM** 来自浙江大学相关团队，做 hierarchical graph-based agentic memory，把 memory encoding 和 consolidation 解耦，用 event progression graph 与 topic associative network 缓解 memory contamination、loss、semantic drift。([arXiv][20])

**HyMem** 来自 ZJU-UIUC Institute 与 Ant Group，提出 hybrid memory architecture 和 dynamic retrieval scheduling，用轻量 summary context 与深层 LLM module 做复杂 query 的双层调度。它偏性能和认知经济，不是完整治理，但和 salience / scheduling 很贴。([arXiv][21])

**Agentic Unlearning** 有山东高校和医疗相关机构参与，场景落在 medical QA 和 healthcare privacy；**FSFM** 是 China Mobile/Jiutian 路线，主张 selective forgetting 是 agent 安全与效率的基础。([arXiv][10])

**MemOS/MemTensor** 是国内生态味很浓的开源框架，GitHub 查询时显示 9k stars、latest release v2.0.15 on May 11, 2026。它提出 MemCube 统一 plaintext、activation、parametric memory，并宣称支持 provenance/versioning、可迁移、可融合、可组合。要注意：这更像“统一抽象与工程平台”的证据，benchmark 和治理能力大多仍是项目自报。([GitHub][22])

**未确认项。** 这轮没有找到清华、BAAI、上海 AI Lab 在 2026 公开发布且明确主打 agent memory governance 的 arXiv/GitHub 工作。可以在 slides 里谨慎说：“国内公开论文中，治理路线目前不像检索/图记忆/选择性遗忘那么显眼。”

---

## 2. 参数化记忆 stress test：你们三阶段判断要改成“四层栈”

你们的三阶段判断“近期非参数化 + RL 检索，中期选择性编译 + 审计，远期模型原生记忆管理”大体正确，但 2026 已经出现一个麻烦：**activation-state memory 和 latent memory 正在提前插队**。Persistent KV Cache 把跨 session 的 KV state 持久化，既不是普通外部文本库，也不是参数更新；MemGen 则动态生成 latent token memory；MemOS/MemCube 试图把 plaintext、activation、parametric memory 放到同一个 memory OS 抽象下。([arXiv][23])

**阶段 1 没问题，而且证据更多了。** MemRL、AgeMem、Memory-R1、AtomMem、Memory-T1、MemPO、JitRL 都在做 RL + memory operations / retrieval / policy optimization。MemPO 把 memory token 和普通 reasoning token 分开做 advantage assignment，JitRL 则用动态非参数记忆在 test-time 做 policy optimization。这说明 2026 的主流可落地路线确实不是直接 fine-tune，而是先让 agent 学会“何时存、何时取、何时改、何时删”。([arXiv][1])

**阶段 2 的漏洞在 provenance。** “LoRA adapter 保留 provenance”目前没有看到成熟 benchmark 证明已经可审计落地。MemOS/MemCube 声称通过 metadata、versioning、provenance 统一管理多形态 memory，但这不等于“参数化记忆可审计”。更硬的治理证据反而来自 TierMem 这类保留 immutable raw log、可升级验证的非参数化/混合架构。([arXiv][24])

**阶段 3 比你们预期更早露头，但还不是成熟形态。** Persistent KV Cache 是“below prompt”的 agent memory，把 attention state 作为可持久化运行时资产；MemGen 是 latent memory；MemOS 把不同 memory substrate 统一成 MemCube。这些都说明参数化/非参数化边界正在变薄。但它们没有解决 governance，反而把 governance 变难了：latent token、KV cache、adapter 权重都比 plaintext 更难审计、删除和解释。([arXiv][23])

我建议把你们的三阶段框架改成这个更抗打的版本：

| 旧分类    | 建议新分类                                      | 为什么更稳                                                  |
| ------ | ------------------------------------------ | ------------------------------------------------------ |
| 非参数化记忆 | **Plaintext / structured external memory** | 文件、vector DB、KG、raw logs、summaries，可审计性最高。             |
| 中间态不清  | **Activation-state memory**                | Persistent KV cache 属于这里：不是参数，不是文本，是运行时注意力状态。          |
| 隐状态生成  | **Latent / generative memory**             | MemGen 这类 latent token memory 属于这里，性能诱人但治理困难。          |
| 参数化记忆  | **Parametric compiled memory**             | LoRA/adapter/fine-tune，适合稳定知识，但 provenance/delete 是硬伤。 |

一句话改法：**不要按“参数化程度”讲路线，按“memory substrate + lifecycle controls”讲路线。**

---

## 3. 工程和开源生态：shipping 很热，治理仍薄

查询日期按 2026-05-11 美西时间计。

| 项目                    | 当前状态                                                                                                                                                                                       | 生产/治理判断                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **mem0**              | GitHub 查询显示 55.3k stars、6.3k forks、317 releases，latest Node SDK v3.0.2 on May 7, 2026。项目定位是 personalized agents 的 memory layer。([GitHub][25])                                              | 生态强，但更偏长期个人化记忆与检索。社区 issue 里有生产使用者报告 32 天后产生大量 junk memory，这是 salience / admission / cleanup 还没解的反证。([GitHub][26])   |
| **Letta / MemGPT**    | 查询显示 22.6k stars、2.4k forks、176 releases，latest v0.16.7 on Mar 31, 2026。Letta 强调 stateful agents、memory、skills、subagents。([GitHub][27])                                                    | Letta Filesystem 在 LoCoMo 74% 是最强 contrarian：简单文件工具能打复杂 memory 系统，说明主流 benchmark 可能奖励“上下文工具熟练度”。([Letta][28])        |
| **Graphiti / Zep**    | Graphiti 查询显示 25.9k stars、2.6k forks、latest v0.29.0 on Apr 27, 2026。它构建 temporal knowledge graph，支持 validity windows、episodes as ground truth、provenance 和 hybrid retrieval。([GitHub][29]) | 这是工程上最接近“governed memory”的 OSS 路线之一。Zep 管理版强调 enterprise governance 和低延迟，但公开 named regulated case 仍不多。([GitHub][29]) |
| **Hindsight**         | 查询显示 12.9k stars、740 forks、latest v0.6.1 on May 8, 2026。项目文档讲 mental models、observations、world facts、experience facts 的层级。([Hindsight][30])                                                | 它自称被 Fortune 500 和 startups 使用，但这是 self-reported，缺少公开客户细节。可以引用为 shipping 生态，不建议当强生产证据。([GitHub][31])                 |
| **Graphify**          | 查询显示 46.3k stars、5k forks、latest v0.7.13 on May 9, 2026。定位是把代码、文档、PDF、图片、视频映射成知识图谱，供 Claude Code、Codex、Cursor 等使用。([GitHub][3])                                                            | 它更像“代码库 LLM Wiki / knowledge compiler”，不是完整 agent memory governance，但对工程师团队记忆非常有启发。                                  |
| **MemOS / MemTensor** | 查询显示 9k stars、803 forks、latest v2.0.15 on May 11, 2026。项目声称统一 API、graph memory、inspectable/editable memory、multi-cube 隔离和受控共享，并展示删除 API/MCP 支持。([GitHub][22])                              | 值得重点跟，但要谨慎：MemCube 的统一抽象很强，独立 benchmark 和企业治理案例仍不足。                                                                  |
| **LangMem**           | 查询显示 1.4k stars、165 forks、119 commits。它提供 memory tools、background memory manager、prompt refinement，并建议生产使用 AsyncPostgresStore。([GitHub][32])                                               | 更像 LangGraph 生态里的 memory primitive，不是完整治理平台。                                                                         |

**企业部署案例结论。** 公开材料里，真正有公司名、有行业、有部署规模、有治理事故复盘的 regulated-industry agent memory 案例非常少。Hindsight 有 Fortune 500 自报，Zep/Graphiti 有 production/governance 宣称，Workday AI 有 memory admission 研究，但“金融/医疗/法律生产系统如何处理删除、审计、冲突、权限”的公开证据仍然稀薄。这个稀薄本身是结论。([GitHub][31])

### Claude Code / Codex / Cursor：LLM Wiki 的自然演化，但不是治理

Claude Code 官方文档说，每个 session 都是 fresh context，跨 session 主要靠 CLAUDE.md 和 auto memory notes；CLAUDE.md 会占 context token，且官方明确说它不是强制配置，不能保证严格遵守。这个点很重要：**memory files 是 hint，不是 policy enforcement**。([Claude][33])

OpenAI Codex 官方 AGENTS.md 指南也把它定义成 repository-level instructions，让规则随代码库移动；Codex agent loop 还有 compaction，用特殊消息保留当前 run 的 latent state。它们确实是 LLM Wiki 的自然演化，但更像“上下文工程 + 运行时压缩”，还不是完整 memory governance。([OpenAI 开发者][34])

一个漂亮的反证是 ICLR workshop 的 **Evaluating AGENTS.md**：自动生成的 repo-level context files 没有提升成功率，反而增加超过 20% 的成本；人写的 AGENTS.md 影响也很有限。这能打掉“只要把知识写进 memory file 就行”的幼稚版 LLM Wiki。([OpenReview][35])

Cursor 社区也有规则/记忆类反馈，例如 alwaysApply rules 和 .cursorrules 没被可靠自动注入的 bug 报告。这类反馈说明 coding agent memory 的治理问题不是“有没有文件”，而是 scope、注入时机、冲突、可信度、是否强制执行。([Cursor - Community Forum][36])

### MCP memory 工具：抽象对了，但权限和谱系还没补齐

MCP 生态里有 Graphiti MCP、MemOS MCP、ai-memory server 等。MCP 把 memory 暴露成 resource/tool，这有一个好处：memory 不再是藏在 prompt 里的幽灵，而是可以被调用、记录、限权、组合的工具。但风险也随之变大：如果没有 principal-scoped retrieval、provenance、删除传播和 memory injection 防护，MCP memory server 会变成“很好用的污染入口”。Graphiti 明确支持 MCP 与 temporal context graph；MemOS MCP 也有独立 repo，但查询时只有 7 stars、无 releases，仍很早期。([GitHub][29])

---

## 4. 跨领域灵感：可直接搬进研讨会的五组类比

### 神经科学：不是“记得更多”，而是“何时巩固、何时重写、何时忘”

最有用的不是泛泛讲海马体，而是 **Complementary Learning Systems**：快系统保存 episodic exemplar，慢系统把稳定模式整合进长期知识。2026 的 contrarian paper **Contextual Agentic Memory is a Memo, Not True Memory** 就用这个点批评当前 agent memory 大多只是 memo lookup，缺少慢速整合，因此“无穷笔记不会自动变成 expertise”。([arXiv][37])

迁移建议：agent memory 应有两条线，一条是 raw episode / evidence log，另一条是经过验证的 semantic consolidation。中间必须有 reconsolidation gate：旧 memory 被新证据改写时，要留下版本链，而不是默默覆盖。

### 图书馆学 / 知识管理：deaccessioning 比 acquisition 更难

图书馆不是只买书，它还要编目、标注来源、维护版本、撤架、保存、处理争议。迁移到 agent memory，就是每条 memory 至少要有 source、owner、created_at、valid_until、confidence、scope、retention class、deletion status、legal hold status。这个模型和 Mnemonic Sovereignty 的生命周期框架非常贴，尤其是 write/store/retrieve/share/forget/rollback。([arXiv][13])

迁移建议：别把 memory 当“向量库里的字符串”，要当“带馆藏卡片的证据对象”。没有馆藏卡片的 memory，就是一只没有铃铛的猫，跑进系统深处就难找了。

### 分布式系统 / 操作系统：agent memory 需要 GC，也需要 coherence

MemGPT、MemOS、Persistent KV Cache 和 multi-agent memory architecture 都在借 OS/计算机体系结构语言。真正可迁移的不是术语，而是机制：generational GC 可用于区分新鲜 episodic memory 和稳定 semantic memory；copy-on-write 可用于 agent 分支和 simulation；cache invalidation 可用于共享 memory 的失效传播；MESI/CRDT/vector clock 可启发多 agent 读写协议。([arXiv][38])

迁移建议：多 agent memory 不应只做 shared vector DB。至少要有 visibility、ordering、conflict resolution、staleness marker 和 rollback。语义层面的冲突解决需要 LLM judge 或 domain verifier，不能只靠 timestamp。

### 法律 / 合规：Right to be forgotten 和 legal hold 会正面打架

GDPR Article 17/19 的 right to erasure 要求在满足条件时删除并通知接收方，但也有法律义务、公共利益、研究统计、法律主张等例外。eDiscovery/legal hold 则要求在案件或调查中保留相关内容，直到 hold 被释放。agent memory 系统如果同时服务个人化和企业合规，就必须能表达“该删但被 legal hold 冻结”“已删但保留不可读审计 tombstone”“删除已传播到哪些下游 memory”。([Homepage | Data Protection Commission][39])

EU AI Act 对高风险 AI 系统的数据治理、记录保存和 traceability 有要求，虽然它不专门写“agent memory”，但这些要求会落到 memory 的数据来源、代表性、错误、日志、生命周期上。([人工智能法案欧盟][40])

### 工程团队知识管理：GitHub 留下组织记忆，Slack 留下幻影

大型工程组织靠 issue、PR、review、ADR、commit history 留住“为什么这么做”，而不是靠聊天记录。OpenAI 的合规调查 cookbook 也把 memory 和 compaction 区分开：compaction 保留当前 run 状态，memory 帮未来 run 复用流程教训，最终还要生成 human-reviewed memo 作为事实来源。([OpenAI 开发者][41])

迁移建议：agent memory 不该只是“聊天摘要”，而应像 ADR：记录决策、备选方案、反对意见、证据、失效条件、owner。Slack-style memory 会变成情绪丰富的沼泽，GitHub-style memory 才能被审计和复用。

---

## 5. Contrarian Review：四个核心判断怎么被攻击

### 判断 1：“记忆是治理问题，不是检索问题”

最强反驳：**检索仍然是非常真实的瓶颈。** ICLR workshop 的 **Diagnosing Retrieval vs Utilization** 发现，在 LoCoMo 上不同 retrieval method 的平均准确率跨度可达约 20 个百分点，而不同 write strategy 的差异只有 3 到 8 个百分点；raw chunk storage 甚至能匹配或超过昂贵的 lossy memory。([OpenReview][42])

第二个反驳是 Letta Filesystem：一个用 search_files、grep、open、close 的简单文件系统 agent 能在 LoCoMo 得到 74.0%，超过若干专门 memory system 报告值。它说明很多 benchmark 里，“会用文件工具 + 会检索”比复杂 memory ontology 更关键。([Letta][28])

**建议改写。** 不要说“memory 不是检索问题”。更稳的是：**检索决定短期分数，治理决定长期可用性。检索是 acute bottleneck，治理是 compounding risk。**

### 判断 2：“Memory 是感知增强义肢，不是被查的仓库”

这个判断方向对，但需要更工程化。Claude Code、Codex、Cursor 的 memory files / AGENTS.md 确实像外化认知义肢：它们在 agent 开始工作前塑造注意力、规则和项目语境，而不是被动数据库。([Claude][33])

反驳是：这些文件目前大多只是 context hint，不是强 enforcement。Claude 文档说 CLAUDE.md 不是严格保证；AGENTS.md controlled study 显示自动生成文件会增加成本且不提升成功率。也就是说，“义肢”如果没有佩戴协议、适配训练和错误反馈，只是挂在身上的漂亮木板。([Claude][33])

**边界条件。** 这个判断在 coding agent、long-running project、personal workflow 中很强；但在单次 QA、短会话客服、检索型企业知识库里，warehouse metaphor 仍然足够实用。

### 判断 3：“Task-scoped Salience Gating 是断裂点”

这个判断基本对，但还没被成熟解决。A-MAC、Memory Worth、AgeMem、MemRL 都说明 salience、admission、retrieval utility、post-retrieval worth 已经成为显性研究对象；Memory Worth 尤其把 trust/suppress/deprecate 变成可在线更新的 memory primitive。([arXiv][6])

反驳是：目前 salience gating 大多还在“单 agent、单任务、单 memory store”的设定里。到了 multi-agent、跨 session、权限隔离、poisoning、legal hold、用户偏好漂移，salience 不只是“相关性”，而是 relevance + authority + freshness + risk + scope + task objective 的合成物。现在没有看到它被完整解决。

**建议表述。** Task-scoped Salience Gating 是断裂点，但不要只讲 focus mode。要讲 **salience ledger**：每条 memory 为什么被写入、为什么被取出、为什么被压制、对哪个 task 生效、何时过期。

### 判断 4：“参数化记忆近期最现实路径是 RL 优化检索，不是 fine-tune”

大体对。2026 直接支持这点的工作很多：MemRL、AgeMem、Memory-R1、AtomMem、Memory-T1、MemPO、JitRL 都在 runtime / non-parametric / memory operation policy 上卷，而不是马上把记忆编译进权重。([arXiv][1])

但要加入一个新变量：Persistent KV Cache 和 MemGen 说明“非参数化 vs 参数化”之间出现了 activation / latent 中间层。它们可能绕过你们的阶段 1/2 叙事，提前进入“模型原生运行时记忆”。不过这不是 fine-tune 胜利，而是 memory substrate 变多了。([arXiv][23])

**建议表述。** 近期最现实路线不是 fine-tune，而是 **runtime memory policy learning**。但参数化路线不应只看 LoRA，还要看 KV-state persistence、latent token memory、adapter compilation、MemCube-style substrate migration。

---

## 6. 5/13 可以直接讲的“机会点”

第一，**governance benchmark 还是空白。** 现有 benchmark 已经有 LoCoMo、HaluMem、MemoryArena、AMA-Bench、ShiftBench、MemoryCD、RealMem，但没有一个完整测 provenance、delete propagation、legal hold、principal-scoped retrieval、multi-agent conflict、memory GC 的综合 benchmark。你们可以把这称为 “Memory Governance Eval Gap”。([arXiv][17])

第二，**agentic unlearning 是早期但高价值赛道。** 现在已有 Agentic Unlearning、Secure Forgetting、FSFM、Mnemonic Sovereignty，但还没有跨 substrate 的审计式遗忘标准。尤其当 memory 包含 plaintext、summary、embedding、KV cache、latent tokens、adapter 权重时，“忘掉”会变成分布式删除问题。([arXiv][10])

第三，**multi-agent memory consistency 几乎是未开垦荒地。** 有计算机体系结构类比，有 MESI/CRDT 早期尝试，有 privacy/poisoning/credit assignment 论文，但还没有标准协议。你们如果提出 “agent memory coherence protocol” 或 “semantic CRDT for memories”，会很有锋芒。([arXiv][14])

第四，**工程界 shipping 很快，但企业治理证据很薄。** mem0、Letta、Graphiti、Hindsight、Graphify、MemOS 都很活跃；然而公开 regulated-industry production case 仍然少，很多证据来自 vendor docs、GitHub、issue 和自报 benchmark。研讨会上可以把这讲成：**生态已经在跑，治理还没系鞋带。** ([GitHub][25])

---

## 7. 给 46 的整合建议：把 thesis 改得更抗揍

我建议 convergence draft 里这样改三句话：

1. 原句：**“记忆是治理问题，不是检索问题。”**
   改成：**“检索是短期性能瓶颈，治理是长期可靠性瓶颈；agent memory 的断裂点在两者交界处。”**

2. 原句：**“参数化记忆近期路径是 RL 优化检索。”**
   改成：**“近期主线是 runtime memory policy learning；但 memory substrate 已扩展为 plaintext、activation/KV、latent token、parametric adapter 四层。”**

3. 原句：**“Memory 是义肢，不是仓库。”**
   改成：**“Memory 不是只被查询的仓库，而是塑造 agent 感知、注意力、行动和自我修正的外化控制面。”**

最后一张 contrarian slide 可以直接放三颗钉子：

* **Letta Filesystem 74%**：简单文件工具能打复杂 memory 系统，别低估检索和工具熟练度。([Letta][28])
* **Diagnosing Retrieval vs Utilization**：retrieval method 在 LoCoMo 上的影响大于 write strategy，检索派还没死。([OpenReview][42])
* **AGENTS.md study**：把知识写进 repo-level memory file 不自动提升 agent，甚至可能更贵。([OpenReview][35])

这版能让你们进研讨会时既有锋芒，又不会被反证一爪子拍翻。

[1]: https://arxiv.org/abs/2601.03192?utm_source=chatgpt.com "MemRL: Self-Evolving Agents via Runtime Reinforcement Learning on Episodic Memory"
[2]: https://mem0.ai/blog/state-of-ai-agent-memory-2026?utm_source=chatgpt.com "State of AI Agent Memory 2026"
[3]: https://github.com/safishamsi/graphify "GitHub - safishamsi/graphify: AI coding assistant skill (Claude Code, Codex, OpenCode, Cursor, Gemini CLI, and more). Turn any folder of code, SQL schemas, R scripts, shell scripts, docs, papers, images, or videos into a queryable knowledge graph. App code + database schema + infrastructure in one graph. · GitHub"
[4]: https://sites.google.com/view/memagent-iclr26/?utm_source=chatgpt.com "ICLR 2026 Workshop MemAgents"
[5]: https://openreview.net/forum?id=dJgeY3Awrv "From Lossy to Verified: A Provenance-Aware Tiered Memory for Agents | OpenReview"
[6]: https://arxiv.org/html/2604.12007v1 "When to Forget: A Memory Governance Primitive"
[7]: https://openreview.net/forum?id=CCSztIjmOy "ShiftBench: Measuring Recovery of Agent Memory Under Distribution Shift | OpenReview"
[8]: https://openreview.net/forum?id=i7J62t2wtV "Memory Injection Attacks on LLM Agents via Query-Only Interaction | OpenReview"
[9]: https://openreview.net/forum?id=PRkA1cwXC2 "Learning to Continually Learn via Meta-learning Agentic Memory Designs | OpenReview"
[10]: https://arxiv.org/html/2602.17692v1 "Agentic Unlearning: When LLM Agent Meets Machine Unlearning"
[11]: https://arxiv.org/abs/2604.00430 "[2604.00430] Secure Forgetting: A Framework for Privacy-Driven Unlearning in Large Language Model (LLM)-Based Agents"
[12]: https://arxiv.org/html/2604.20300v1 "FSFM: A Biologically-Inspired Framework for Selective Forgetting of Agent Memory"
[13]: https://arxiv.org/html/2604.16548v1 "A Survey on the Security of Long-Term Memory in LLM Agents: Toward Mnemonic Sovereignty"
[14]: https://arxiv.org/abs/2603.10062 "[2603.10062] Multi-Agent Memory from a Computer Architecture Perspective: Visions and Challenges Ahead"
[15]: https://arxiv.org/html/2603.15183v1?utm_source=chatgpt.com "Token Coherence: Adapting MESI Cache Protocols to ..."
[16]: https://arxiv.org/html/2603.12631?utm_source=chatgpt.com "Joint Optimization of Multi-agent Memory System"
[17]: https://arxiv.org/abs/2511.03506 "[2511.03506] HaluMem: Evaluating Hallucinations in Memory Systems of Agents"
[18]: https://arxiv.org/html/2602.16313v1 "Benchmarking Agent Memory in Interdependent Multi-Session Agentic Tasks"
[19]: https://openreview.net/forum?id=GoSVL7mLcM "AMA-Bench: Evaluating Long-Horizon Memory for Agentic Applications | OpenReview"
[20]: https://arxiv.org/html/2604.12285v1 "GAM: Hierarchical Graph-based Agentic Memory for LLM Agents"
[21]: https://arxiv.org/html/2602.13933v2 "HyMem: Hybrid Memory Architecture with Dynamic Retrieval Scheduling"
[22]: https://github.com/MemTensor/MemOS "GitHub - MemTensor/MemOS: Self-evolving memory OS for LLM & AI Agents: ultra-persistent memory, hybrid-retrieval, and cross-task skill reuse, with 35.24% token savings · GitHub"
[23]: https://arxiv.org/abs/2603.04428?utm_source=chatgpt.com "Agent Memory Below the Prompt: Persistent Q4 KV Cache for Multi-Agent LLM Inference on Edge Devices"
[24]: https://arxiv.org/abs/2507.03724?utm_source=chatgpt.com "[2507.03724] MemOS: A Memory OS for AI System"
[25]: https://github.com/mem0ai/mem0 "GitHub - mem0ai/mem0: Universal memory layer for AI Agents · GitHub"
[26]: https://github.com/mem0ai/mem0/issues/4573?utm_source=chatgpt.com "97.8% were junk · Issue #4573 · mem0ai/mem0"
[27]: https://github.com/letta-ai/letta "GitHub - letta-ai/letta: Letta is the platform for building stateful agents: AI with advanced memory that can learn and self-improve over time. · GitHub"
[28]: https://www.letta.com/blog/benchmarking-ai-agent-memory "Benchmarking AI Agent Memory: Is a Filesystem All You Need?  | Letta"
[29]: https://github.com/getzep/graphiti "GitHub - getzep/graphiti: Build Real-Time Knowledge Graphs for AI Agents · GitHub"
[30]: https://hindsight.vectorize.io/ "Overview | Hindsight"
[31]: https://github.com/vectorize-io/hindsight "GitHub - vectorize-io/hindsight: Hindsight: Agent Memory That  Learns · GitHub"
[32]: https://github.com/langchain-ai/langmem "GitHub - langchain-ai/langmem · GitHub"
[33]: https://code.claude.com/docs/en/memory "How Claude remembers your project - Claude Code Docs"
[34]: https://developers.openai.com/blog/skills-agents-sdk "Using skills to accelerate OSS maintenance | OpenAI Developers"
[35]: https://openreview.net/forum?id=pLi3A8bscP "Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents? | OpenReview"
[36]: https://forum.cursor.com/t/alwaysapply-true-rules-and-cursorrules-both-silently-treated-as-requestable-instead-of-auto-injected-cursor-3-0-16-macos/157431 "alwaysApply: true rules AND .cursorrules both silently treated as \"requestable\" instead of auto-injected — Cursor 3.0.16 macOS - Bug Reports - Cursor - Community Forum"
[37]: https://arxiv.org/html/2604.27707v1 "Contextual Agentic Memory is a Memo, Not True Memory"
[38]: https://arxiv.org/html/2603.11768v1 "Governing Evolving Memory in LLM Agents: Risks, Mechanisms, and the Stability and Safety Governed Memory (SSGM) Framework"
[39]: https://www.dataprotection.ie/en/individuals/know-your-rights/right-erasure-articles-17-19-gdpr "The right to erasure (Articles 17 & 19 of the GDPR) | Data Protection Commission"
[40]: https://artificialintelligenceact.eu/article/10/?utm_source=chatgpt.com "Article 10: Data and Data Governance"
[41]: https://developers.openai.com/cookbook/examples/agents_sdk/building_reliable_agents_memory_compaction "Building Reliable Agents with Memory and Compaction"
[42]: https://openreview.net/forum?id=cxYbqAtBIz "Diagnosing Retrieval vs. Utilization Bottlenecks in LLM Agent Memory | OpenReview"
