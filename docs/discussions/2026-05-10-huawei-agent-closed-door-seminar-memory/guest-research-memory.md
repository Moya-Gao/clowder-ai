---
title: "嘉宾核心项目拆解 — 记忆方向（Claims → 代码证据 → Verdict）"
date: 2026-05-11
event_date: 2026-05-13
doc_kind: seminar-reference
status: final
author: "宪宪/Opus-46"
method: "open-source-teardown (claims ledger + 架构地图 + 算法剥皮)"
repos_analyzed:
  - { name: LightMem, url: "https://github.com/zjunlp/LightMem", sha: 15ba5b39 }
  - { name: GMemory, url: "https://github.com/bingreeky/GMemory", sha: shallow-clone }
  - { name: MemP, url: "https://github.com/zjunlp/MemP", sha: shallow-clone }
  - { name: EasyEdit, url: "https://github.com/zjunlp/EasyEdit", sha: 3488a66 }
reviewers: ["Opus-47（P0-P5 补丁）", "GPT-5.5（口径校准）"]
---

# 嘉宾核心项目源码拆解 — 记忆方向

> 按 teardown 标准：宣传 claim → 代码路径 → verdict → 我们的 tradeoff。
> 含第 9 镜头（User Mind）+ 社区信号（GitHub Issues）。
> v2：整合 Opus-47 五处补丁 + GPT-5.5 三处口径校准。

---

## 1. LightMem（张宁豫 / ZJUNLP）— ICLR 2026

### Claims Ledger

| # | Claim（README / 论文） | 代码证据 | Verdict |
|---|---|---|---|
| C1 | "三阶段记忆：sensory → short-term → long-term" | `SenMemBufferManager`（token 阈值触发分段）→ `ShortMemBufferManager`（累积分段触发提取）→ `MemoryEntry` + Qdrant 向量存储 | **✅ 真实实现**。三阶段是 pipeline 阶段不是认知模型——sensory = 消息缓冲 + 语义分段，short-term = 累积直到 LLM 提取，long-term = 向量 DB + JSON 持久化 |
| C2 | "token 用量降 117x" | 通过 topic 分段 + LLM 提取 facts 替代全量上下文注入。检索时只返回 `"{timestamp} {weekday} {memory_text}"` 格式字符串 | **✅ 数字可信但机制朴素**。本质是"提取摘要 + 按需检索"替代"塞全文"，不是压缩算法创新。任何 extract-then-retrieve 方案都能拿到类似倍数 |
| C3 | "准确率提升 10.9%" | 在 LongMemEval 上对比 full_context / naive_rag / mem0 / langmem 等 baseline | **⚠️ 条件成立**。baseline 包含 mem0 vendor fork（`memories/layers/baselines/mem0/`），公平性待验证 |
| C4 | "sleep-time 离线更新" | `offline_update` pipeline：向量相似度找候选 → LLM judge 决定 delete / update → 修改 Qdrant payload | **⚠️ LLM judge 不是算法**。没有独立 eval、threshold、rollback。LLM 说删就删，说改就改 |
| C5 | "模块化可插拔设计" | Factory 模式：6 种 LLM backend、2 种 retriever（embedding / context）、可选 pre-compress / topic-segment | **✅ 工程质量好**。config-driven pipeline，组件确实可替换 |
| C6 | "MCP Server 接口" | `mcp/server.py`：5 个 tool——`get_timestamp`、`add_memory`、`offline_update`、`retrieve_memory`、`show_lightmem_instance` | **✅ 完整读写接口**。retrieve_memory 支持 query + top_k，覆盖写入/检索/离线更新/实例查看全链路 |

### 架构地图

```
Input Messages → MessageNormalizer（时间戳解析）
    ↓
[可选: pre_compress] → SenMemBufferManager（token 阈值 + 语义分段）
    ↓
ShortMemBufferManager（累积分段，超阈值触发）
    ↓
LLM Extraction（meta_text_extract，flat/event 两种模式）
    ↓
MemoryEntry（12 个 metadata 字段）→ text_embedder.embed()
    ↓
Qdrant 向量 DB + JSON 文件双写
    ↓
[离线: offline_update] → 向量相似度找候选 → LLM judge → delete/update
```

### 算法剥皮

| 被宣传为 | 实际是 |
|---|---|
| "三阶段认知记忆" | Token 阈值触发的 pipeline 阶段（缓冲 → 累积 → 提取） |
| "sleep-time consolidation" | LLM prompt judge（无独立 eval / 无 rollback） |
| "topic-aware segmentation" | 语义相似度阈值切割（cosine distance 0.2-0.5）+ 粗分段器 |
| "memory retrieval" | 标准 Qdrant 向量搜索 + 可选 BM25 |

### 对我们发言稿的影响

**好消息**：LightMem 是一个优秀的 **Layer 1（Memory Substrate）+ Layer 2（Reflex Injection）** 实现。但它**完全没有**：

- ❌ Governance Plane：无 provenance、无 permission、无 delete propagation、无 audit trail
- ❌ Layer 3 Wearing Protocol：无机制让 agent 学习何时使用/压制记忆
- ❌ Salience Ledger：无"为什么被写入/取出/压制"的记录
- ❌ Multi-agent 一致性：单 agent 设计，无共享/冲突解决

**这直接验证了我们的核心论点**："前两层行业在卷，第三层还没有形成成熟方法论"——LightMem 就是"前两层卷到了 ICLR 2026"的代表。

**风险**：张宁豫可能用 LightMem 的 117x 数据反驳"检索门槛归零"。**对话策略**：承认 LightMem 在检索效率上的突破，然后问："LightMem 的 offline_update 里 LLM 判错了怎么回滚？谁来审计这个决定？"——引导到治理层。

---

## 2. G-Memory（张桂彬 / NUS）— NeurIPS 2025

### Claims Ledger

| # | Claim | 代码证据 | Verdict |
|---|---|---|---|
| C1 | "三层图结构：insight-query-interaction" | Interaction = `StateChain`（NetworkX DiGraph 链，节点=AgentMessage）；Query = NetworkX 无向图（节点=任务，边=语义相似度）；Insight = JSON list（rule + score + 正负相关任务列表） | **⚠️ 名字是"图"但实现差异大**。Interaction 是图，Query 是图，Insight 只是带 score 的 list |
| C2 | "多 agent 层级记忆" | 所有 agent 读写同一个 `meta_memory` 实例。`solver_agent` 和 `ground_truth_agent` 都没有 private memory | **⚠️ "多 agent" = 共享单例存储**。无锁、无事务隔离、无冲突解决、无版本控制。假设顺序执行 |
| C3 | "从协作历史中汲取知识" | Insight 通过 LLM 比较成功/失败轨迹生成 rules → 按 task 结果 ±score → score ≤ 0 淘汰 | **✅ 有真实的知识沉淀闭环**。但 score 调整是粗暴的 +1/-2，无因果分析 |
| C4 | "跨任务持续进化" | 内存持久化到 pickle + JSON + Chroma 向量 DB。跨 trial 累积 | **✅ 工程上实现了持久化**。但无 TTL / 无过期 / 无知识失效检测 |

### 架构地图

```
Task 执行 → Agent 消息链（StateChain / Interaction Graph）
    ↓
Sparsification（移除失败步骤）→ LLM 提取关键步骤
    ↓
Query Graph（任务节点 + 语义相似度边 + k-hop 展开检索）
    ↓
Insight Graph（LLM 对比成功/失败轨迹 → 生成/修正 rules）
    ↓
Backward（任务结果 → rule score ±调整 → score≤0 淘汰）
```

**存储后端**：

| 层 | 存储 | 格式 |
|---|---|---|
| Interaction | Chroma 向量 DB | metadata + node_link_data |
| Query | NetworkX pickle | `{ns}_graph.pkl` |
| Insight | JSON list | `{ns}.json` |

### 算法剥皮

| 被宣传为 | 实际是 |
|---|---|
| "层级图记忆" | 三种不同存储结构的 pipeline（DiGraph + 无向图 + JSON list） |
| "组织记忆理论" | LLM prompt judge 生成 rules + 简单 score 增减 |
| "多 agent 协同记忆" | 共享单例存储 + 顺序执行假设 |
| "跨任务知识迁移" | 向量相似度检索 + k-hop 图遍历 |

### 对我们发言稿的影响

**关键发现**：G-Memory **做了多 agent 经验沉淀**（多个 agent 共享 insight rules、跨任务累积知识），但**没有解决多 agent 共享记忆的一致性协议**。所有 agent 读写同一个 Python 对象实例，假设顺序执行，无锁、无事务隔离、无冲突解决。

**这强化了我们断裂点 2 的论点**：G-Memory 印证了"共享存储有了，分布式语义一致性未开垦"——它解决了经验沉淀（insight lifecycle），但在并发场景下的一致性问题尚未触及。

**风险**：张桂彬可能认为我们说"多 agent 记忆几乎未开垦"不公平，因为他已经在做。**对话策略**："G-Memory 在跨任务知识沉淀上走得最远，insight graph 的 rule lifecycle 是有意义的探索。但在 agent A 异步更新 rule 而 agent B 同时在用这条 rule 做决策的场景下——当前没有一致性保证。这才是我们说的'未开垦'——不是'没人做'，是'没人做到分布式语义一致性'。"

---

## 3. MemP（张宁豫 / ZJUNLP）— 程序性记忆

### Claims Ledger

| # | Claim | 代码证据 | Verdict |
|---|---|---|---|
| C1 | "程序性记忆——复用跨任务经验" | LLM 从轨迹提取 workflow（自然语言段落），存入 FAISS 向量 DB，按 query 相似度检索 | **⚠️ "程序性记忆" = LLM 摘要 + 向量检索**。没有可执行程序，没有符号化表示 |
| C2 | "动态更新/修正/废弃" | 三种策略：vanilla（全存）、validation（只存成功的）、reflect（LLM 分析失败 → 重写 workflow） | **✅ 有真实的 lifecycle**。reflect 模式有 LLM 修正 + 自动废弃（hit≥3 且成功率<50% 删除） |
| C3 | "distilling into step-by-step + script-like abstractions" | 两种提取模式：direct（单次 LLM 提取 workflow 段落）/ round（先提取 atomic events JSON → 再选关键步骤） | **✅ 两种粒度确实不同**。但"script-like"只是自然语言段落，不是可执行脚本 |

### 算法剥皮

| 被宣传为 | 实际是 |
|---|---|
| "程序性记忆" | LLM 摘要（自然语言 workflow） |
| "动态废弃" | hit/success 比率阈值（≥3 次 hit + 成功率<50%）→ 自动删除 |
| "反思修正" | LLM prompt（分析失败原因 → 重写 workflow）→ 原地替换，无版本历史 |
| "知识蒸馏" | In-context learning 提取（非模型蒸馏） |

### 对我们发言稿的影响

**Memp 的 reflect 模式有一个我们没提到的角度**：失败轨迹 → LLM 分析失败原因 → 修正 workflow → 替换旧版。这是一种原始的"知识更正"机制。

**但缺陷印证了我们的 Salience Ledger 论点**：
- 修正后的 workflow 直接原地替换旧版（无版本历史）
- 删除决定基于 hit/success 比率（启发式规则，无审计）
- 修正原因（LLM 的 `<Analysis>` 输出）没有持久化保存
- **如果 LLM 的修正是错的，无法回滚**

**对话策略**：把 Memp 定位为"佩戴协议的早期探索"——它试图让 agent 学会从失败中修正记忆，但缺 Salience Ledger 做审计。"张老师的 Memp 是我们看到的最接近佩戴协议的工作——如果加上修正原因的审计记录和回滚能力，就是 Salience Ledger 的核心。"

---

## 4. EasyEdit（张宁豫 / ZJUNLP）— 知识编辑工具集

### Claims Ledger

| # | Claim（README / 论文） | 代码证据 | Verdict |
|---|---|---|---|
| C1 | "An Easy-to-use Framework to Edit Large Language Models" | `easyeditor/util/alg_dict.py` 注册 21 种方法：ROME、MEMIT、GRACE、LoRA、QLoRA、WISE、SERAC、IKE 等 | **✅ 规模真实**。437 个 Python 文件，方法覆盖参数编辑（直接改权重）和外部记忆（SERAC/IKE）两条路 |
| C2 | "知识编辑——精准修改模型中的事实知识" | ROME/MEMIT 直接修改 FFN 权重（causal tracing + rank-one update）；GRACE 用 adapter 层拦截激活值 | **✅ 参数级编辑**。这是"改模型的记忆"不是"给 agent 加外部记忆"——核心差异 |
| C3 | "支持可逆编辑 / rollback" | `return_orig_weights` 参数：编辑前复制原始权重到内存，eval 后恢复。但仅 session 内生效，不持久化 | **⚠️ 半成品 rollback**。权重只在内存中暂存，断电即丢。无持久化 checkpoint、无 diff 记录、无审计链 |
| C4 | "支持 batch / sequential editing" | `BatchEditor` 一次改多条事实；`editor.edit()` 可连续调用 | **✅ 工程上支持**。但 sequential editing 的知识冲突检测依赖用户自行保证 |
| C5 | "2.8K+ Stars 活跃社区" | GitHub 实际 3.3K+ stars（2026-05）。Issues / PRs 活跃，但以 bug report 和使用问题为主 | **✅ 社区真实活跃**。是知识编辑领域的标准工具集 |

### 架构地图

```
用户指定 (subject, target_new, prompt)
    ↓
AlgorithmDispatcher → 按 alg_name 路由到具体 Editor
    ↓
┌─ 参数编辑路径 ─────────────────────────┐
│ ROME: causal tracing → rank-one update │
│ MEMIT: 多层同时编辑（批量 ROME）        │
│ GRACE: adapter 层拦截激活值             │
│ WISE: 双参数记忆网络（工作+长期）        │
│ LoRA/QLoRA: 低秩适配器微调             │
└────────────────────────────────────────┘
┌─ 外部记忆路径 ─────┐
│ SERAC: 反例记忆 + scope classifier │
│ IKE: In-context demonstration 检索  │
└────────────────────┘
    ↓
Evaluation: reliability + generalization + locality + portability
```

### 算法剥皮

| 被宣传为 | 实际是 |
|---|---|
| "知识编辑" | 参数权重修改（ROME/MEMIT 改 FFN，GRACE 加 adapter） |
| "可逆编辑" | Session 内 `return_orig_weights` 复制（不持久化、无 diff） |
| "评测框架" | reliability/generalization/locality/portability 四维度（但不评行为变化） |
| "Agent Unlearning 相关" | **❌ 不是**。只改事实知识（"总统是谁"），不改 agent 行为模式 |

### 与 Agent Memory / Unlearning 的边界

**核心定位**：EasyEdit 解决的是"模型记住了错误的事实 → 精准修正"，属于**参数化知识编辑**，不属于 Agent Memory 或 Agentic Unlearning。

| 维度 | EasyEdit | Agent Memory / Unlearning |
|---|---|---|
| 操作对象 | 模型权重 | 外部存储 + 行为模式 |
| 粒度 | 单条事实（subject → object） | 经验、workflow、rule、习惯 |
| 评估 | 事实准确率 | 行为变化、决策质量 |
| 持久化 | 权重就地改（不可逆） | 需要审计链 + 回滚 |
| 治理需求 | "改了什么" | "为什么改、谁授权、怎么验证" |

**对我们发言稿的影响**：

- **不是竞品，是互补**。EasyEdit 操作 Layer 0（参数层），我们讲的 Layer 1-3 在参数之上
- **强化"参数化记忆"论据**：发言稿提到"参数化记忆会不会回来"——EasyEdit 证明参数编辑可行（ROME/MEMIT），但**没有治理**（谁授权这次编辑？改错了怎么审计？）
- **张宁豫的完整版图**：LightMem（外部记忆存取）+ EasyEdit（参数知识编辑）+ MemP（程序性记忆）= ZJUNLP 三条腿走路。现场可以引用这个组合问："三个系统之间的知识冲突怎么检测？LightMem 说总统是 A，EasyEdit 改模型说总统是 B——谁赢？"

---

## 四项目对照：映射到我们的三层架构

| 我们的框架 | LightMem | G-Memory | MemP | EasyEdit |
|---|---|---|---|---|
| **Layer 1: Memory Substrate** | ✅ Qdrant + JSON | ✅ Chroma + pickle + JSON | ✅ FAISS + JSON | N/A（操作参数层） |
| **Layer 2: Reflex Injection** | ✅ 向量检索 + BM25 | ✅ k-hop 图遍历 + 向量检索 | ✅ 向量相似度检索 | N/A |
| **Layer 3: Wearing Protocol** | ❌ 无 | ⚠️ Insight rule lifecycle（粗暴 score） | ⚠️ reflect 模式（LLM 修正 workflow） | ❌ 无行为学习 |
| **Governance Plane** | ❌ 无 provenance/permission/audit | ⚠️ 有 score 但无 provenance/permission | ⚠️ 有 hit/success 但无 audit/rollback | ❌ 无审计链（session-only rollback） |
| **Multi-agent** | ❌ 单 agent | ⚠️ 经验沉淀有、一致性协议无 | ❌ 单 agent | ❌ 单模型 |
| **Salience Ledger** | ❌ | ❌ | ❌ | ❌ |

---

## 对发言稿的总体影响

### 我们的论点被验证的

1. **"前两层行业在卷"** ← LightMem（ICLR 2026）正是 Layer 1+2 的卷法
2. **"第三层还没有形成成熟方法论"** ← G-Memory 的 insight lifecycle 和 MemP 的 reflect 是早期探索，但都没有 audit/rollback
3. **"断裂点 2 多 agent 一致性"** ← G-Memory 做了多 agent 经验沉淀，但一致性协议未触及
4. **"Salience Ledger 是空白"** ← 四个项目都没有"为什么被写入/取出/压制"的记录
5. **"参数化记忆可行但缺治理"** ← EasyEdit 证明 ROME/MEMIT 路线 works，但没有编辑审计链

### 需要现场注意的措辞

| 发言稿原文 | 代码证据后的风险 | 建议调整 |
|---|---|---|
| "检索两年内门槛归零" | LightMem 117x 降幅说明检索效率仍是活跃研究 | 保持"门槛降低"，避免"归零" |
| "多 agent 记忆几乎未开垦" | G-Memory NeurIPS 2025 在做 | 改为"共享存储有了，分布式语义一致性未开垦" |
| "佩戴协议完全空白" | 已改成"还没有形成成熟方法论"✅ | 无需再改，但要知道 MemP reflect 模式是可引用的早期探索 |

### 现场可用的代码级 push back 武器

1. **对 LightMem**："offline_update 里 LLM 判断 delete/update——如果判错了怎么回滚？"
2. **对 G-Memory**："两个 agent 同时更新同一条 insight rule，谁赢？"
3. **对 MemP**："reflect 模式修正 workflow 后原地替换旧版——修正原因保存了吗？"

这三个问题的答案都是"没有"——**这就是 Governance Plane 的价值所在**。

4. **对 EasyEdit**："LightMem 里记了'总统是 A'，EasyEdit 把模型权重改成了'总统是 B'——两套记忆冲突谁赢？怎么检测？"

---

## 营销-现实落差分类（47 补丁 P2）

> "认知三阶段"等术语的宣传描述 vs 代码实现落差。

| 项目 | 宣传叙事 | 代码真相 | 落差级别 |
|---|---|---|---|
| LightMem | "认知三阶段记忆（sensory → short-term → long-term）" | Token 阈值触发的工程 pipeline（缓冲 → 累积 → 提取） | **中**：认知科学术语包装工程阶段 |
| G-Memory | "多 agent 层级记忆" | 共享 Python 单例 + 顺序执行假设 | **高**：宣传多 agent，实际无并发设计 |
| G-Memory | "组织记忆理论" | LLM prompt 生成 rules + score ±1/±2 增减 | **中**：理论框架 ≠ 算法创新 |
| MemP | "程序性记忆" | LLM 摘要的自然语言 workflow 段落 | **高**：心理学"程序性记忆"是隐式/可执行的，这里是显式 NL |
| EasyEdit | "知识编辑框架 / 可逆" | 参数权重就地改，rollback 仅 session 内存暂存 | **中**：可逆性被过度承诺 |

**现场价值**：如果嘉宾用这些术语做论据，可以精准指出"代码里其实是什么"，但**语气务必是'好奇追问'而非'打脸'**。

---

## User Mind 镜头（47 补丁 P1）

> 第 9 视角：站在项目的实际用户角度，评估上手体验和可用性。

| 项目 | 上手成本 | 文档质量 | 依赖复杂度 | 致命缺陷 |
|---|---|---|---|---|
| **LightMem** | 中。config-driven，需理解 6 种 LLM backend 选择 | 中上。README 清晰，但 MCP 部分文档薄 | 中。Qdrant 服务端依赖 | `topic_segment=False` 时整个 pipeline 崩溃（#55，TODO 未修） |
| **G-Memory** | 高。需理解 NetworkX + Chroma + AutoGen 三套生态 | 中。README 有步骤，实际复现需折腾环境 | 高。pickle 序列化 + 多种存储后端 | 多 agent 场景假设顺序执行，真实并发会数据竞争 |
| **MemP** | 低。FAISS + 简单 API | 中下。README 引用的文件路径与实际不一致 | 低。依赖少 | reflect 模式修正后原地替换，无版本历史 |
| **EasyEdit** | 中。21 种方法选择困难 | 中上。有教程 notebook，但方法间差异解释不足 | 中。需下载大模型 | 编辑冲突检测完全靠用户——batch editing 多条事实可能互相矛盾 |

---

## 学派分类（47 补丁 P3）

> 四位记忆方向嘉宾的研究流派——同为"Agent Memory"但方法论路线差异显著。

| 学派 | 代表 | 核心方法论 | 我们发言稿的定位 |
|---|---|---|---|
| **知识工程派** | 张宁豫（ZJUNLP） | 知识底座（EasyEdit）+ 可插拔模块（LightMem）+ 程序性记忆（MemP），从 KG/NLP 演化到 Agent | Layer 1+2 的工程极致代表 |
| **自演进派** | 张桂彬（NUS） | 综述定义（Self-Evolving Agents）+ 图记忆（G-Memory）+ 评测（Mem-T），探索 agent 从经验中成长 | Layer 3 的早期探索者 |
| **基准评测派** | 陈旭（RUC） | 长程 Agent 评测 + 记忆机制研究 + 推荐系统 Agent，从评测反推能力缺口 | 断裂点的发现者视角 |
| **Agent 平台派** | 骆昱宇（HKUST-GZ） | OpenManus（平台级 Agent 框架）+ 智能体文件系统自演进，工程落地导向 | 看"LLM 天性"vs"Harness 补偿" |

**现场价值**：知道每位嘉宾的学派 bias，提问和回应时对齐他们的 mental model。

---

## GitHub Issues / 社区信号（47 补丁 P5）

> Stars 不值钱，看真实用户在 issue 里说什么。

### LightMem — 2 个关键 issue

| Issue | 内容 | 严重度 | 对我们的意义 |
|---|---|---|---|
| **#57** | `online_update` 函数体为空 `pass`——文档宣称的在线更新是占位符 | **高** | 用户无法使用在线记忆更新。"写了接口没写实现" |
| **#55** | `topic_segment=False` 时 `SenMemBufferManager.__call__` 触发未实现路径（TODO 注释） | **高** | 关闭主题分段 = 整条 pipeline 崩溃。不是可选配置，是未完成功能 |

### G-Memory — 社区信号

- Issue 以**复现/环境配置问题**为主，反映上手门槛高
- 多 agent 场景的并发问题**没有用户报告**——因为学术用途都是顺序执行，真实并发场景没人试过

### MemP — 社区信号

- README 引用的部分文件路径与实际目录结构不一致
- Issue 量少（项目较新），无法判断社区活跃度

### EasyEdit — 社区信号

- 3.3K+ stars，Issue 和 PR 活跃
- Issue 以**使用问题和 bug report** 为主（具体方法报错、模型兼容性）
- 知识编辑领域的事实标准工具集——竞品少

**总结**：LightMem 的 #55 和 #57 是现场可用的具体论据——"模块化可插拔设计，但关闭一个配置项整条 pipeline 就崩"。这种工程完成度的差距正是学术原型到生产系统的断裂点之一。

---

## 117x cherry-pick 校准（47 补丁 P4）

LightMem 论文宣称的 **token 用量降 117x** 数字可信但机制朴素——本质是"提取摘要 + 按需检索"替代"塞全文"。任何 extract-then-retrieve 方案（包括 mem0、langmem、甚至简单的 RAG）都能拿到类似量级的倍数。

**现场用法**：如果张宁豫引用 117x 数据，不要质疑数字本身，而是追问："这个倍数是跟 full_context baseline 比——如果跟 mem0 或 naive RAG 比，差距有多大？" 把话题从"我们多厉害"引到"这个提升是 LightMem 特有还是 extract-then-retrieve 范式共有"。

---

## 嘉宾学术水平总结（基于源码深度）

| 嘉宾 | 项目 | 代码质量 | 创新度 | 工程成熟度 | 与我们 Topic 1 的对口度 |
|---|---|---|---|---|---|
| **张宁豫**（ZJU） | LightMem | ★★★★★ 工程优秀 | ★★★ pipeline 创新而非算法创新 | ★★★★ 可用（但 #55/#57 未修） | ★★★★★ 最直接竞品 |
| **张桂彬**（NUS） | G-Memory | ★★★★ 结构清晰 | ★★★★ insight lifecycle 有意义 | ★★★ 学术原型 | ★★★★★ 多 agent 对口 |
| **张宁豫**（ZJU） | MemP | ★★★ 简洁 | ★★★ reflect 模式有价值 | ★★ 简单 | ★★★★ 佩戴协议相关 |
| **张宁豫**（ZJU） | EasyEdit | ★★★★ 工业级 | ★★★★ 21 种方法全覆盖 | ★★★★★ 领域标准 | ★★★ 参数化记忆侧面 |
| **骆昱宇**（HKUST-GZ） | OpenManus | 未拆解（平台方向，非 memory） | — | ★★★★★ 50K stars | ★★★ 间接相关 |
| **陈旭**（RUC） | MemBench | 未拆解（评测方向） | — | — | ★★★★ 评测对口 |

[宪宪/Opus-46🐾]
